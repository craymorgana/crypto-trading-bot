/**
 * Unified Analysis Engine
 * Combines candlestick patterns, technical indicators, Fibonacci, and harmonics
 * into a single confidence score for scalping entries
 */

const { analyzeCandlesticks } = require('./candlesticks');
const { calculateIndicators, getIndicatorSignal, detectHiddenBullishDivergenceRSI, detectHiddenBullishDivergenceMACD, calculateVolumeFilter, calculateVolatility, calculateMarketRegime } = require('./indicators');
const { calculateFibonacciLevels, getFibLevelsNear } = require('./fibonacci');
const { calculateHarmonicLevels, projectHarmonicD, validateHarmonicPattern, validateHarmonicRatios } = require('./harmonics');

/**
 * Find swing highs and lows in price action
 * @param {Array} ohlcv - CCXT OHLCV array
 * @param {number} lookback - Bars to look left/right for swings (default: 3)
 * @returns {Array} - Array of swing points with price, index, and type
 */
function findSwingPoints(ohlcv, lookback = 3) {
    const swings = [];
    
    for (let i = lookback; i < ohlcv.length - lookback; i++) {
        const current = ohlcv[i][4];
        const high = ohlcv[i][2];
        const low = ohlcv[i][3];
        
        // Check for swing high
        let isSwingHigh = true;
        let isSwingLow = true;
        
        for (let j = 1; j <= lookback; j++) {
            if (ohlcv[i - j][2] >= high || ohlcv[i + j][2] >= high) isSwingHigh = false;
            if (ohlcv[i - j][3] <= low || ohlcv[i + j][3] <= low) isSwingLow = false;
        }
        
        if (isSwingHigh) {
            swings.push({ index: i, price: high, type: 'high', timestamp: ohlcv[i][0] });
        }
        if (isSwingLow) {
            swings.push({ index: i, price: low, type: 'low', timestamp: ohlcv[i][0] });
        }
    }
    
    return swings;
}

/**
 * Unified analysis combining all signals
 * @param {Array} ohlcv - CCXT OHLCV array (need 100+ candles for indicators)
 * @param {Object} options - Analysis configuration
 * @returns {Object} - Complete analysis with combined score
 */
function analyzeForScalping(ohlcv, options = {}) {
    const opts = {
        includeHarmonics: options.includeHarmonics || true,
        includeFibonacci: options.includeFibonacci || true,
        minConfidenceThreshold: options.minConfidenceThreshold || 50,
        ...options
    };

    if (!ohlcv || ohlcv.length < 26) {
        return { 
            error: 'Insufficient data (need 26+ candles)',
            signal: 'NEUTRAL',
            confidence: 0
        };
    }

    const analysis = {
        timestamp: new Date(),
        currentPrice: ohlcv[ohlcv.length - 1][4],
        signals: {},
        scores: {}
    };

    // 1. Candlestick Pattern Analysis
    try {
        const candleAnalysis = analyzeCandlesticks(ohlcv.slice(0, -1));
        analysis.signals.candlesticks = candleAnalysis;
        analysis.scores.candlesticks = candleAnalysis.confidence;
    } catch (err) {
        analysis.signals.candlesticks = { error: err.message };
        analysis.scores.candlesticks = 0;
    }

    // 2. Technical Indicators Analysis
    try {
        const indicators = calculateIndicators(ohlcv);
        const indicatorSignal = getIndicatorSignal(indicators);
        
        // 2a. Hidden Bullish Divergence Detection
        let divergenceSignal = 'NEUTRAL';
        let divergenceStrength = 0;
        const rsiDivergence = detectHiddenBullishDivergenceRSI(ohlcv, indicators.rsiValues);
        const macdDivergence = detectHiddenBullishDivergenceMACD(ohlcv, indicators.macdValues);
        
        if (rsiDivergence.detected || macdDivergence.detected) {
            divergenceSignal = 'BULLISH';
            divergenceStrength = Math.max(rsiDivergence.strength, macdDivergence.strength);
        }
        
        analysis.signals.indicators = indicatorSignal;
        analysis.signals.divergence = {
            rsiDivergence,
            macdDivergence,
            detected: rsiDivergence.detected || macdDivergence.detected,
            signal: divergenceSignal,
            strength: divergenceStrength
        };
        
        // Boost indicator score if divergence is present
        analysis.scores.indicators = indicatorSignal.strength;
        if (divergenceSignal === 'BULLISH') {
            analysis.scores.indicators = Math.min(100, analysis.scores.indicators + divergenceStrength * 0.5);
        }
    } catch (err) {
        analysis.signals.indicators = { error: err.message };
        analysis.signals.divergence = { error: err.message };
        analysis.scores.indicators = 0;
    }

    // 3. Fibonacci Support/Resistance
    if (opts.includeFibonacci) {
        try {
            const high = Math.max(...ohlcv.slice(-20).map(c => c[2]));
            const low = Math.min(...ohlcv.slice(-20).map(c => c[3]));
            const fibLevels = calculateFibonacciLevels(high, low);
            const nearbyLevels = getFibLevelsNear(analysis.currentPrice, fibLevels, 0.5);
            
            analysis.signals.fibonacci = {
                fibLevels,
                nearbyLevels,
                hasSupport: nearbyLevels.length > 0
            };
            
            // Score: 20 points if price is at Fib level
            analysis.scores.fibonacci = nearbyLevels.length > 0 ? 20 : 0;
        } catch (err) {
            analysis.signals.fibonacci = { error: err.message };
            analysis.scores.fibonacci = 0;
        }
    }

    // 4. Volume, Volatility, and Market Regime Filters
    try {
        const volumeFilter = calculateVolumeFilter(ohlcv, 20);
        const volatility = calculateVolatility(ohlcv, 14);
        const marketRegime = calculateMarketRegime(ohlcv, 14);

        analysis.signals.filters = {
            volume: volumeFilter,
            volatility: volatility,
            marketRegime: marketRegime
        };

        // Bonus points for favorable conditions
        let filterBonus = 0;
        if (volumeFilter.isAboveAverage) filterBonus += 5;
        if (volatility.isHighVolatility) filterBonus += 5;
        if (marketRegime.regime === 'trending' && marketRegime.strength > 50) filterBonus += 10;

        analysis.scores.filters = filterBonus;
    } catch (err) {
        analysis.signals.filters = { error: err.message };
        analysis.scores.filters = 0;
    }

    // 5. Harmonic Pattern Analysis
    if (opts.includeHarmonics) {
        try {
            // Get 4-point price action: X=20 candles ago, A=15 ago, B=10 ago, C=current
            const points = [
                ohlcv[ohlcv.length - 20][4],  // X
                ohlcv[ohlcv.length - 15][4],  // A
                ohlcv[ohlcv.length - 10][4],  // B
                ohlcv[ohlcv.length - 1][4]    // C
            ];

            const harmonicLevels = calculateHarmonicLevels(points);
            const gartleyValidation = validateHarmonicPattern(
                analysis.currentPrice, 
                points, 
                'gartley', 
                2
            );

            analysis.signals.harmonics = {
                levels: harmonicLevels,
                gartleyValidation,
                isValid: gartleyValidation.valid
            };

            // Score: 25 points if harmonic pattern is valid
            analysis.scores.harmonics = gartleyValidation.valid ? 25 : 0;
        } catch (err) {
            analysis.signals.harmonics = { error: err.message };
            analysis.scores.harmonics = 0;
        }
    }

    // 6. Calculate Combined Score
    // Additive scoring: candlesticks + indicators form base, Fib/harmonics add bonus
    let totalScore = 0;
    
    // Candlestick patterns: 0-40 points (scaled from 0-100)
    totalScore += (analysis.scores.candlesticks / 100) * 40;
    
    // Indicators: 0-40 points (scaled from 0-100)
    totalScore += (analysis.scores.indicators / 100) * 40;
    
    // Fibonacci: +10 bonus points if near support/resistance
    if (analysis.scores.fibonacci > 0) {
        totalScore += 10;
    }
    
    // Harmonics: +10 bonus points if valid pattern
    if (analysis.scores.harmonics > 0) {
        totalScore += 10;
    }

    // Filter bonus: +5-20 points for volume, volatility, and trending market
    if (analysis.scores.filters > 0) {
        totalScore += analysis.scores.filters;
    }
    
    // Convert to percentage (max possible = 120, normalized to 100)
    const confidencePercent = Math.min(100, totalScore);

    // 7. Determine Final Signal
    // Signals must NOT conflict (BULLISH vs BEARISH) - neutral is OK
    let finalSignal = 'NEUTRAL';
    const candlestickSignal = analysis.signals.candlesticks?.signal || 'NEUTRAL';
    const indicatorSignal = analysis.signals.indicators?.signal || 'NEUTRAL';
    
    // Reject conflicting signals (opposite directions)
    const hasConflict = 
        (candlestickSignal === 'BULLISH' && indicatorSignal === 'BEARISH') ||
        (candlestickSignal === 'BEARISH' && indicatorSignal === 'BULLISH');
    
    if (!hasConflict) {
        // Take whichever signal is not neutral, or if both agree use that
        if (candlestickSignal !== 'NEUTRAL' || indicatorSignal !== 'NEUTRAL') {
            finalSignal = candlestickSignal !== 'NEUTRAL' ? candlestickSignal : indicatorSignal;
        }
    }

    analysis.finalSignal = finalSignal;
    analysis.confidence = Math.round(confidencePercent);
    analysis.meetsThreshold = confidencePercent >= opts.minConfidenceThreshold;

    return analysis;
}

/**
 * Swing analysis using Fibonacci + Harmonics (high timeframe)
 * @param {Array} ohlcv - CCXT OHLCV array
 * @param {Object} options - Analysis configuration
 * @returns {Object}
 */
function analyzeForSwinging(ohlcv, options = {}) {
    const opts = {
        minConfidenceThreshold: options.minConfidenceThreshold || 65,
        fibLookback: options.fibLookback || 60,
        harmonicTolerance: options.harmonicTolerance || 3,
        ...options
    };

    if (!ohlcv || ohlcv.length < 60) {
        return {
            error: 'Insufficient data (need 60+ candles)',
            signal: 'NEUTRAL',
            confidence: 0
        };
    }

    const analysis = {
        timestamp: new Date(),
        currentPrice: ohlcv[ohlcv.length - 1][4],
        signals: {},
        scores: {}
    };

    // Fibonacci Support/Resistance (for target levels, not entry filter)
    try {
        const slice = ohlcv.slice(-opts.fibLookback);
        const high = Math.max(...slice.map(c => c[2]));
        const low = Math.min(...slice.map(c => c[3]));
        const fibLevels = calculateFibonacciLevels(high, low);
        const nearbyLevels = getFibLevelsNear(analysis.currentPrice, fibLevels, 3.0);  // 3% tolerance

        analysis.signals.fibonacci = {
            fibLevels,
            nearbyLevels,
            hasSupport: nearbyLevels.length > 0
        };

        // Fibonacci adds 20 points if price is near a level
        analysis.scores.fibonacci = nearbyLevels.length > 0 ? 20 : 0;
    } catch (err) {
        analysis.signals.fibonacci = { error: err.message };
        analysis.scores.fibonacci = 0;
    }

    // Harmonics (Gartley + Bat + Butterfly) - Properly detect XABCD patterns
    try {
        // Find actual swing points in recent price action (last 80 candles)
        const recentOhlcv = ohlcv.slice(-80);
        const swingPoints = findSwingPoints(recentOhlcv);
        
        // We need at least 4 swing points (X, A, B, C) to form a pattern
        if (swingPoints.length >= 4) {
            // Take last 4 swing points
            const [X, A, B, C] = swingPoints.slice(-4);
            const prices = [X.price, A.price, B.price, C.price];
            
            // First validate the XABC ratios match known patterns
            const gartleyRatios = validateHarmonicRatios(prices, 'gartley', 15);  // 15% ratio tolerance
            const batRatios = validateHarmonicRatios(prices, 'bat', 15);
            const butterflyRatios = validateHarmonicRatios(prices, 'butterfly', 15);

            // Only check D validation if pattern ratios are valid
            let validPattern = null;
            if (gartleyRatios.valid) {
                const validation = validateHarmonicPattern(analysis.currentPrice, prices, 'gartley', 8);
                if (validation.valid) validPattern = validation;
            }
            if (!validPattern && batRatios.valid) {
                const validation = validateHarmonicPattern(analysis.currentPrice, prices, 'bat', 8);
                if (validation.valid) validPattern = validation;
            }
            if (!validPattern && butterflyRatios.valid) {
                const validation = validateHarmonicPattern(analysis.currentPrice, prices, 'butterfly', 8);
                if (validation.valid) validPattern = validation;
            }

            analysis.signals.harmonics = {
                swingPoints: swingPoints.slice(-4),
                gartleyRatios,
                batRatios,
                butterflyRatios,
                isValid: Boolean(validPattern)
            };

            // Harmonics adds 25 points if BOTH ratios and D validation pass
            analysis.scores.harmonics = validPattern ? 25 : 0;
        } else {
            analysis.signals.harmonics = {
                swingPoints: [],
                isValid: false
            };
            analysis.scores.harmonics = 0;
        }
    } catch (err) {
        analysis.signals.harmonics = { error: err.message };
        analysis.scores.harmonics = 0;
    }

    const scores = [];
    if (analysis.scores.fibonacci > 0) scores.push(analysis.scores.fibonacci);
    if (analysis.scores.harmonics > 0) scores.push(analysis.scores.harmonics);

    // If no scores, return neutral with low confidence
    const confidencePercent = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / Math.max(scores.length, 1)) : 0;

    let finalSignal = 'NEUTRAL';
    
    // Signal logic: Use Fibonacci OR Harmonics (not requiring both)
    if (analysis.signals.harmonics?.isValid) {
        const projection = projectHarmonicD([
            ohlcv[ohlcv.length - 60][4],
            ohlcv[ohlcv.length - 45][4],
            ohlcv[ohlcv.length - 30][4],
            ohlcv[ohlcv.length - 1][4]
        ], 'gartley');
        if (!projection.error && projection.direction === 'bullish') {
            finalSignal = 'BULLISH';
        } else if (!projection.error && projection.direction === 'bearish') {
            finalSignal = 'BEARISH';
        }
    } else if (analysis.signals.fibonacci?.hasSupport) {
        // Use last 3 candles to determine direction at Fib level
        const recentCandles = ohlcv.slice(-4, -1);
        const bullishCount = recentCandles.filter(c => c[4] > c[1]).length;
        const bearishCount = recentCandles.filter(c => c[4] < c[1]).length;
        
        if (bullishCount >= 2) finalSignal = 'BULLISH';
        else if (bearishCount >= 2) finalSignal = 'BEARISH';
    }

    analysis.finalSignal = finalSignal;
    analysis.confidence = Math.round(confidencePercent);
    analysis.meetsThreshold = confidencePercent >= opts.minConfidenceThreshold;

    return analysis;
}

/**
 * Format analysis for logging
 * @param {Object} analysis - Output from analyzeForScalping()
 * @returns {string} - Formatted output
 */
function formatAnalysis(analysis) {
    if (analysis.error) {
        return `❌ Analysis Error: ${analysis.error}`;
    }

    const lines = [
        `\n📊 === UNIFIED ANALYSIS [${analysis.timestamp.toLocaleTimeString()}] ===`,
        `Current Price: $${analysis.currentPrice.toFixed(2)}`,
        `Pattern: ${analysis.signals.candlesticks?.pattern || 'None'} (${analysis.scores.candlesticks}%)`,
        `Indicators: ${analysis.signals.indicators?.signal || 'N/A'} (${analysis.scores.indicators}%)`,
        `Fibonacci: ${analysis.signals.fibonacci?.hasSupport ? '✓ At Level' : '✗ No Level'} (${analysis.scores.fibonacci}%)`,
        `Harmonics: ${analysis.signals.harmonics?.isValid ? '✓ Valid Pattern' : '✗ Invalid'} (${analysis.scores.harmonics}%)`,
        ``,
        `🎯 FINAL SIGNAL: ${analysis.finalSignal}`,
        `📈 Confidence: ${analysis.confidence}% ${analysis.meetsThreshold ? '✓ READY' : '✗ TOO LOW'}`,
    ];

    return lines.join('\n');
}

module.exports = {
    analyzeForScalping,
    analyzeForSwinging,
    formatAnalysis
};
