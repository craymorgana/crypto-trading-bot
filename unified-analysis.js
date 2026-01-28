/**
 * Unified Analysis Engine
 * Combines candlestick patterns, technical indicators, Fibonacci, and harmonics
 * into a single confidence score for scalping entries
 */

const { analyzeCandlesticks } = require('./candlesticks');
const { calculateIndicators, getIndicatorSignal } = require('./indicators');
const { calculateFibonacciLevels, getFibLevelsNear } = require('./fibonacci');
const { calculateHarmonicLevels, projectHarmonicD, validateHarmonicPattern } = require('./harmonics');

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
        analysis.signals.indicators = indicatorSignal;
        analysis.scores.indicators = indicatorSignal.strength;
    } catch (err) {
        analysis.signals.indicators = { error: err.message };
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

    // 4. Harmonic Pattern Analysis
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

    // 5. Calculate Combined Score
    const totalScore = Object.values(analysis.scores).reduce((a, b) => a + b, 0);
    const maxScore = 100 + (opts.includeFibonacci ? 20 : 0) + (opts.includeHarmonics ? 25 : 0);
    const confidencePercent = Math.min((totalScore / maxScore) * 100, 100);

    // 6. Determine Final Signal
    let finalSignal = 'NEUTRAL';
    const bullishScore = (analysis.scores.candlesticks > 0 && analysis.signals.candlesticks.signal === 'BULLISH' ? analysis.scores.candlesticks : 0) +
                         (analysis.signals.indicators?.signal === 'BULLISH' ? analysis.scores.indicators : 0);
    const bearishScore = (analysis.scores.candlesticks > 0 && analysis.signals.candlesticks.signal === 'BEARISH' ? analysis.scores.candlesticks : 0) +
                         (analysis.signals.indicators?.signal === 'BEARISH' ? analysis.scores.indicators : 0);

    if (bullishScore > bearishScore && confidencePercent >= opts.minConfidenceThreshold) {
        finalSignal = 'BULLISH';
    } else if (bearishScore > bullishScore && confidencePercent >= opts.minConfidenceThreshold) {
        finalSignal = 'BEARISH';
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
    formatAnalysis
};
