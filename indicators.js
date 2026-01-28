const { RSI, MACD, BollingerBands } = require('technicalindicators');

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
        }
    };
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

    if (bullishCount > bearishCount) {
        signal = 'BULLISH';
        strength = Math.min(bullishCount * 33, 100); // Max 100%
    } else if (bearishCount > bullishCount) {
        signal = 'BEARISH';
        strength = Math.min(bearishCount * 33, 100);
    }

    return { signal, strength, indicators: indicators, confluenceSignals: signals };
}

module.exports = { calculateIndicators, getIndicatorSignal };