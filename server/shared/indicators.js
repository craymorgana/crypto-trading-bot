const { RSI, MACD, BollingerBands, ATR, ADX } = require('technicalindicators');

/**
 * Calculate volume filter - checks if current volume is above average
 * @param {Array} ohlcv - CCXT OHLCV array
 * @param {number} period - Lookback period for average (default: 20)
 * @returns {Object} - {isAboveAverage, currentVolume, avgVolume, ratio}
 */
function calculateVolumeFilter(ohlcv, period = 20) {
    if (!ohlcv || ohlcv.length < period) {
        return { isAboveAverage: false, currentVolume: 0, avgVolume: 0, ratio: 0 };
    }

    const volumes = ohlcv.slice(-period).map(c => c[5]);
    const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    const currentVolume = ohlcv[ohlcv.length - 1][5];
    const ratio = currentVolume / avgVolume;

    return {
        isAboveAverage: ratio > 1.2, // 20% above average
        currentVolume,
        avgVolume,
        ratio: ratio.toFixed(2)
    };
}

/**
 * Calculate ATR (Average True Range) for volatility detection
 * @param {Array} ohlcv - CCXT OHLCV array
 * @param {number} period - ATR period (default: 14)
 * @returns {Object} - {atr, isHighVolatility}
 */
function calculateVolatility(ohlcv, period = 14) {
    if (!ohlcv || ohlcv.length < period + 1) {
        return { atr: 0, isHighVolatility: false };
    }

    const atrInput = ohlcv.map(c => ({
        high: c[2],
        low: c[3],
        close: c[4]
    }));

    const atrValues = ATR.calculate({ period, high: ohlcv.map(c => c[2]), low: ohlcv.map(c => c[3]), close: ohlcv.map(c => c[4]) });
    const currentATR = atrValues[atrValues.length - 1];
    const avgATR = atrValues.slice(-20).reduce((a, b) => a + b, 0) / Math.min(20, atrValues.length);

    return {
        atr: currentATR,
        isHighVolatility: currentATR > avgATR * 1.2 // 20% above average ATR
    };
}

/**
 * Calculate market regime (trending vs ranging) using ADX
 * @param {Array} ohlcv - CCXT OHLCV array
 * @param {number} period - ADX period (default: 14)
 * @returns {Object} - {adx, regime: 'trending'|'ranging', strength}
 */
function calculateMarketRegime(ohlcv, period = 14) {
    if (!ohlcv || ohlcv.length < period + 1) {
        return { adx: 0, regime: 'ranging', strength: 0 };
    }

    const adxValues = ADX.calculate({
        period,
        high: ohlcv.map(c => c[2]),
        low: ohlcv.map(c => c[3]),
        close: ohlcv.map(c => c[4])
    });

    const currentADX = adxValues[adxValues.length - 1];
    const adxValue = currentADX?.adx || 0;

    let regime = 'ranging';
    let strength = 0;

    if (adxValue > 25) {
        regime = 'trending';
        strength = Math.min(100, ((adxValue - 25) / 50) * 100); // Scale 25-75 to 0-100
    } else {
        regime = 'ranging';
        strength = Math.max(0, ((25 - adxValue) / 25) * 100);
    }

    return {
        adx: adxValue,
        regime,
        strength: Math.round(strength),
        pdi: currentADX?.pdi || 0,
        mdi: currentADX?.mdi || 0
    };
}

/**
 * Calculate technical indicators for scalping strategy
 * @param {Array} ohlcv - CCXT OHLCV array: [timestamp, open, high, low, close, volume]
 * @returns {Object} - RSI, MACD, Bollinger Bands with latest values
 */
function calculateIndicators(ohlcv) {
    if (!ohlcv || ohlcv.length < 26) {
        return { 
            rsi: null, 
            macd: null, 
            bb: null, 
            error: 'Insufficient candle history (need 26+)' 
        };
    }

    const closes = ohlcv.map(candle => candle[4]); // Closing prices

    // Calculate RSI (period: 14)
    const rsiValues = RSI.calculate({ values: closes, period: 14 });
    const latestRsi = rsiValues[rsiValues.length - 1];

    // Calculate MACD (12/26/9)
    const macdValues = MACD.calculate({
        values: closes,
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9,
        SimpleMAOscillator: false,
        SimpleMASignal: false
    });
    const currentMacd = macdValues[macdValues.length - 1];

    // Calculate Bollinger Bands (20/2)
    const bbValues = BollingerBands.calculate({
        period: 20,
        values: closes,
        stdDev: 2
    });
    const latestBb = bbValues[bbValues.length - 1];

    return {
        rsi: {
            value: latestRsi,
            overbought: latestRsi > 70,
            oversold: latestRsi < 30
        },
        macd: {
            macd: currentMacd.MACD,
            signal: currentMacd.signal,
            histogram: currentMacd.histogram,
            bullish: currentMacd.histogram > 0,
            bearish: currentMacd.histogram < 0
        },
        bb: {
            upper: latestBb.upper,
            middle: latestBb.middle,
            lower: latestBb.lower,
            closeToUpper: closes[closes.length - 1] > latestBb.upper * 0.98,
            closeToLower: closes[closes.length - 1] < latestBb.lower * 1.02
        },
        // Return raw arrays for divergence detection
        rsiValues: rsiValues,
        macdValues: macdValues,
        closes: closes
    };
}

/**
 * Detect hidden bullish divergence on RSI
 * Hidden divergence = Price makes lower low, but RSI makes higher low
 * Typically occurs during uptrends and signals strength continuation
 * @param {Array} ohlcv - CCXT OHLCV array
 * @param {Array} rsiValues - Array of RSI values corresponding to closes
 * @returns {Object} - {detected: boolean, strength: 0-100}
 */
function detectHiddenBullishDivergenceRSI(ohlcv, rsiValues) {
    if (!ohlcv || !rsiValues || ohlcv.length < 10 || rsiValues.length < 10) {
        return { detected: false, strength: 0 };
    }

    const closes = ohlcv.map(c => c[4]);
    const recent = Math.min(20, ohlcv.length);
    
    // Find recent price low and RSI low
    let priceLowIdx = ohlcv.length - 1;
    let priceLow = closes[priceLowIdx];
    
    let rsiLowIdx = rsiValues.length - 1;
    let rsiLow = rsiValues[rsiLowIdx];

    // Look back to find prior swing low (within last 20 candles)
    for (let i = ohlcv.length - 2; i >= Math.max(ohlcv.length - 20, 0); i--) {
        if (closes[i] < priceLow) {
            priceLow = closes[i];
            priceLowIdx = i;
        }
        if (rsiValues[i] < rsiLow) {
            rsiLow = rsiValues[i];
            rsiLowIdx = i;
        }
    }

    // Hidden bullish divergence detection:
    // 1. Most recent close should be higher than prior low (price recovering)
    // 2. Most recent RSI low should be HIGHER than prior RSI low
    const currentPrice = closes[closes.length - 1];
    const currentRSI = rsiValues[rsiValues.length - 1];
    
    const priorLowPrice = closes[priceLowIdx - 1] || priceLow;
    const priorLowRSI = rsiValues[rsiLowIdx - 1] || rsiLow;

    // Hidden bullish = Current price is lower than prior low, but RSI is higher
    const isPriceLower = closes[closes.length - 1] < priorLowPrice;
    const isRSIHigher = currentRSI > priorLowRSI;

    if (isPriceLower && isRSIHigher) {
        const rsiStrength = (currentRSI - priorLowRSI) / 50 * 100; // Normalize to 0-100
        return { detected: true, strength: Math.min(100, Math.max(0, rsiStrength)) };
    }

    return { detected: false, strength: 0 };
}

/**
 * Detect hidden bullish divergence on MACD
 * Hidden divergence = Price makes lower low, but MACD histogram makes higher low
 * @param {Array} ohlcv - CCXT OHLCV array
 * @param {Array} macdValues - Array of MACD values
 * @returns {Object} - {detected: boolean, strength: 0-100}
 */
function detectHiddenBullishDivergenceMACD(ohlcv, macdValues) {
    if (!ohlcv || !macdValues || ohlcv.length < 10 || macdValues.length < 10) {
        return { detected: false, strength: 0 };
    }

    const closes = ohlcv.map(c => c[4]);
    const recent = Math.min(20, ohlcv.length);
    
    // Find recent price low and MACD histogram low
    let priceLowIdx = ohlcv.length - 1;
    let priceLow = closes[priceLowIdx];
    
    let macdLowIdx = macdValues.length - 1;
    let macdLow = macdValues[macdLowIdx].histogram;

    // Look back to find prior swing low (within last 20 candles)
    for (let i = ohlcv.length - 2; i >= Math.max(ohlcv.length - 20, 0); i--) {
        if (closes[i] < priceLow) {
            priceLow = closes[i];
            priceLowIdx = i;
        }
        if (macdValues[i] && macdValues[i].histogram < macdLow) {
            macdLow = macdValues[i].histogram;
            macdLowIdx = i;
        }
    }

    // Hidden bullish divergence on MACD
    const currentPrice = closes[closes.length - 1];
    const currentMACDHist = macdValues[macdValues.length - 1].histogram;
    
    const priorLowPrice = closes[priceLowIdx - 1] || priceLow;
    const priorLowMACD = macdValues[macdLowIdx - 1]?.histogram || macdLow;

    // Hidden bullish = Current price is lower than prior low, but MACD histogram is higher
    const isPriceLower = closes[closes.length - 1] < priorLowPrice;
    const isMACDHistHigher = currentMACDHist > priorLowMACD;

    if (isPriceLower && isMACDHistHigher) {
        const macdStrength = (currentMACDHist - priorLowMACD) / 0.002 * 100; // Scale based on typical histogram range
        return { detected: true, strength: Math.min(100, Math.max(0, macdStrength)) };
    }

    return { detected: false, strength: 0 };
}

/**
 * Get scalping signal based on indicator confluence
 * @param {Object} indicators - Output from calculateIndicators()
 * @returns {Object} - Signal with direction and strength
 */
function getIndicatorSignal(indicators) {
    if (!indicators || !indicators.rsi || !indicators.macd) {
        return { signal: 'NEUTRAL', strength: 0, reason: 'Insufficient data' };
    }

    let bullishCount = 0;
    let bearishCount = 0;
    let signals = [];

    // RSI confluence
    if (indicators.rsi.oversold) {
        bullishCount++;
        signals.push('RSI oversold');
    } else if (indicators.rsi.overbought) {
        bearishCount++;
        signals.push('RSI overbought');
    }

    // MACD confluence
    if (indicators.macd.bullish) {
        bullishCount++;
        signals.push('MACD bullish');
    } else if (indicators.macd.bearish) {
        bearishCount++;
        signals.push('MACD bearish');
    }

    // Bollinger Bands confluence
    if (indicators.bb.closeToLower) {
        bullishCount++;
        signals.push('Price at BB lower');
    } else if (indicators.bb.closeToUpper) {
        bearishCount++;
        signals.push('Price at BB upper');
    }

    let signal = 'NEUTRAL';
    let strength = 0;

    // Improved scoring: Single indicators get lower weight, multiple = higher
    // This filters false signals while keeping trading volume
    if (bullishCount > bearishCount) {
        signal = 'BULLISH';
        // 1 indicator = 40%, 2 = 70%, 3 = 100%
        strength = bullishCount === 1 ? 40 : (bullishCount === 2 ? 70 : 100);
    } else if (bearishCount > bullishCount) {
        signal = 'BEARISH';
        strength = bearishCount === 1 ? 40 : (bearishCount === 2 ? 70 : 100);
    }

    return { signal, strength, indicators: indicators, confluenceSignals: signals };
}

module.exports = { 
    calculateIndicators, 
    getIndicatorSignal, 
    detectHiddenBullishDivergenceRSI,
    detectHiddenBullishDivergenceMACD,
    calculateVolumeFilter,
    calculateVolatility,
    calculateMarketRegime
};