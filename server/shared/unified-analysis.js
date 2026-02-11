/**
 * Unified Analysis Engine
 * Combines candlestick patterns, technical indicators, Fibonacci, and harmonics
 * into a single confidence score for scalping entries
 */

const { analyzeCandlesticks } = require('./candlesticks');
const { calculateIndicators, getIndicatorSignal, detectHiddenBullishDivergenceRSI, detectHiddenBullishDivergenceMACD, calculateVolumeFilter, calculateVolatility, calculateMarketRegime, calculateTrendFilter, calculateMomentum, calculateStochastic } = require('./indicators');
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
 * Enhanced Swing analysis combining trend, momentum, patterns, and levels
 * Uses multi-factor confirmation for higher quality signals
 * @param {Array} ohlcv - CCXT OHLCV array
 * @param {Object} options - Analysis configuration
 * @returns {Object}
 */
function analyzeForSwinging(ohlcv, options = {}) {
    const opts = {
        minConfidenceThreshold: options.minConfidenceThreshold || 45,
        fibLookback: options.fibLookback || 60,
        harmonicTolerance: options.harmonicTolerance || 3,
        requireTrendAlignment: options.requireTrendAlignment !== false,
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

    // ===== 1. TREND ANALYSIS (0-30 points) =====
    try {
        const trendFilter = calculateTrendFilter(ohlcv);
        analysis.signals.trend = trendFilter;
        
        // Score based on trend alignment
        if (trendFilter.aligned) {
            analysis.scores.trend = 30;
        } else if (trendFilter.strength >= 75) {
            analysis.scores.trend = 25;
        } else if (trendFilter.strength >= 50) {
            analysis.scores.trend = 15;
        } else {
            analysis.scores.trend = 5;
        }
    } catch (err) {
        analysis.signals.trend = { error: err.message, trend: 'NEUTRAL' };
        analysis.scores.trend = 0;
    }

    // ===== 2. MOMENTUM ANALYSIS (0-25 points) =====
    try {
        const momentum = calculateMomentum(ohlcv);
        analysis.signals.momentum = momentum;
        analysis.scores.momentum = Math.round(momentum.score * 0.25);
    } catch (err) {
        analysis.signals.momentum = { error: err.message, momentum: 'NEUTRAL' };
        analysis.scores.momentum = 0;
    }

    // ===== 3. CANDLESTICK PATTERNS (0-20 points) =====
    try {
        const candleAnalysis = analyzeCandlesticks(ohlcv.slice(0, -1));
        analysis.signals.candlesticks = candleAnalysis;
        // Scale candlestick confidence (0-40) to 0-20 points
        analysis.scores.candlesticks = Math.round((candleAnalysis.confidence / 100) * 20);
    } catch (err) {
        analysis.signals.candlesticks = { error: err.message, signal: 'NEUTRAL' };
        analysis.scores.candlesticks = 0;
    }

    // ===== 4. FIBONACCI LEVELS (0-15 points) =====
    try {
        const slice = ohlcv.slice(-opts.fibLookback);
        const high = Math.max(...slice.map(c => c[2]));
        const low = Math.min(...slice.map(c => c[3]));
        const fibLevels = calculateFibonacciLevels(high, low);
        const nearbyLevels = getFibLevelsNear(analysis.currentPrice, fibLevels, 2.0);  // 2% tolerance

        analysis.signals.fibonacci = {
            fibLevels,
            nearbyLevels,
            hasSupport: nearbyLevels.length > 0
        };

        analysis.scores.fibonacci = nearbyLevels.length > 0 ? 15 : 0;
    } catch (err) {
        analysis.signals.fibonacci = { error: err.message };
        analysis.scores.fibonacci = 0;
    }

    // ===== 5. HARMONIC PATTERNS (0-10 points) =====
    try {
        const recentOhlcv = ohlcv.slice(-80);
        const swingPoints = findSwingPoints(recentOhlcv);
        
        if (swingPoints.length >= 4) {
            const [X, A, B, C] = swingPoints.slice(-4);
            const prices = [X.price, A.price, B.price, C.price];
            
            const gartleyRatios = validateHarmonicRatios(prices, 'gartley', 15);
            const batRatios = validateHarmonicRatios(prices, 'bat', 15);
            const butterflyRatios = validateHarmonicRatios(prices, 'butterfly', 15);

            let validPattern = null;
            if (gartleyRatios.valid) {
                const validation = validateHarmonicPattern(analysis.currentPrice, prices, 'gartley', 8);
                if (validation.valid) validPattern = { name: 'gartley', ...validation };
            }
            if (!validPattern && batRatios.valid) {
                const validation = validateHarmonicPattern(analysis.currentPrice, prices, 'bat', 8);
                if (validation.valid) validPattern = { name: 'bat', ...validation };
            }
            if (!validPattern && butterflyRatios.valid) {
                const validation = validateHarmonicPattern(analysis.currentPrice, prices, 'butterfly', 8);
                if (validation.valid) validPattern = { name: 'butterfly', ...validation };
            }

            analysis.signals.harmonics = {
                swingPoints: swingPoints.slice(-4),
                validPattern,
                isValid: Boolean(validPattern)
            };

            analysis.scores.harmonics = validPattern ? 10 : 0;
        } else {
            analysis.signals.harmonics = { swingPoints: [], isValid: false };
            analysis.scores.harmonics = 0;
        }
    } catch (err) {
        analysis.signals.harmonics = { error: err.message };
        analysis.scores.harmonics = 0;
    }

    // ===== 6. VOLUME & VOLATILITY FILTER (Bonus 0-10 points) =====
    try {
        const volumeFilter = calculateVolumeFilter(ohlcv, 20);
        const volatility = calculateVolatility(ohlcv, 14);
        const marketRegime = calculateMarketRegime(ohlcv, 14);

        analysis.signals.filters = {
            volume: volumeFilter,
            volatility: volatility,
            marketRegime: marketRegime
        };

        let filterBonus = 0;
        if (volumeFilter.isAboveAverage) filterBonus += 5;
        if (marketRegime.regime === 'trending' && marketRegime.strength > 30) filterBonus += 5;

        analysis.scores.filters = filterBonus;
    } catch (err) {
        analysis.signals.filters = { error: err.message };
        analysis.scores.filters = 0;
    }

    // ===== CALCULATE TOTAL CONFIDENCE SCORE =====
    const totalScore = 
        (analysis.scores.trend || 0) +
        (analysis.scores.momentum || 0) +
        (analysis.scores.candlesticks || 0) +
        (analysis.scores.fibonacci || 0) +
        (analysis.scores.harmonics || 0) +
        (analysis.scores.filters || 0);
    
    // Max possible: 30 + 25 + 20 + 15 + 10 + 10 = 110 -> normalize to 100
    const confidencePercent = Math.min(100, Math.round(totalScore));

    // ===== DETERMINE FINAL SIGNAL =====
    // Use strict multi-factor consensus - REQUIRE trend + momentum agreement
    const trendSignal = analysis.signals.trend?.trend || 'NEUTRAL';
    const trendStrength = analysis.signals.trend?.strength || 0;
    const momentumSignal = analysis.signals.momentum?.momentum || 'NEUTRAL';
    const momentumScore = analysis.signals.momentum?.score || 0;
    const candleSignal = analysis.signals.candlesticks?.signal || 'NEUTRAL';
    
    let finalSignal = 'NEUTRAL';
    let signalQuality = 'WEAK';
    
    // STRICT REQUIREMENT: Trend and momentum must both agree
    const trendMomentumAlign = (trendSignal === momentumSignal) && trendSignal !== 'NEUTRAL';
    
    // Additional score based on alignment
    let alignmentBonus = 0;
    if (trendMomentumAlign) {
        alignmentBonus += 10;
        // Check if candlestick pattern also agrees
        if (candleSignal === trendSignal) {
            alignmentBonus += 10;
            signalQuality = 'STRONG';
        } else if (candleSignal === 'NEUTRAL') {
            signalQuality = 'MODERATE';
        } else {
            // Candlestick disagrees - reduce confidence
            signalQuality = 'WEAK';
            alignmentBonus -= 5;
        }
    }
    
    // Only generate signal if trend and momentum align
    if (trendMomentumAlign && trendStrength >= 50) {
        finalSignal = trendSignal;
    }
    // Relaxed mode: If trend is very strong (75+), allow signal even with weak momentum
    else if (trendStrength >= 75 && trendSignal !== 'NEUTRAL' && momentumSignal !== (trendSignal === 'BULLISH' ? 'BEARISH' : 'BULLISH')) {
        finalSignal = trendSignal;
        signalQuality = 'MODERATE';
    }
    // High momentum with any trend direction
    else if (momentumScore >= 60 && momentumSignal !== 'NEUTRAL' && trendSignal !== (momentumSignal === 'BULLISH' ? 'BEARISH' : 'BULLISH')) {
        finalSignal = momentumSignal;
        signalQuality = 'MODERATE';
    }
    
    // Apply alignment bonus to confidence
    const adjustedConfidence = Math.min(100, confidencePercent + alignmentBonus);
    
    // Block signals that conflict with very strong trends
    if (opts.requireTrendAlignment && trendStrength >= 80) {
        if (finalSignal === 'BULLISH' && trendSignal === 'BEARISH') {
            finalSignal = 'NEUTRAL';
        }
        if (finalSignal === 'BEARISH' && trendSignal === 'BULLISH') {
            finalSignal = 'NEUTRAL';
        }
    }

    analysis.finalSignal = finalSignal;
    analysis.confidence = adjustedConfidence;
    analysis.signalQuality = signalQuality;
    analysis.meetsThreshold = adjustedConfidence >= opts.minConfidenceThreshold && finalSignal !== 'NEUTRAL';
    analysis.alignment = { 
        trendMomentum: trendMomentumAlign, 
        trendStrength, 
        momentumScore,
        bonus: alignmentBonus 
    };

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
