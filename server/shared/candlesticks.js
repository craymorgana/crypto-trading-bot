const { patternChain, allPatterns } = require('candlestick');

/**
 * Categorizes and weights the patterns found by the patternChain
 * @param {Array} ohlcv - Standard CCXT candle array
 */
function analyzeCandlesticks(ohlcv) {
    if (!ohlcv || ohlcv.length < 5) return { signal: 'NEUTRAL', confidence: 0, pattern: 'None' };

    // 1. Format candles for the library
    const formatted = ohlcv.map(c => ({
        open: Number(c[1]), 
        high: Number(c[2]), 
        low: Number(c[3]), 
        close: Number(c[4])
    }));
    
    // 2. Scan the entire series for ALL available patterns
    const matches = patternChain(formatted, allPatterns);
    
    // 3. Filter for the most recent candle (the pattern must have just completed)
    const lastIndex = formatted.length - 1;
    const latestMatches = matches.filter(m => m.index === lastIndex);

    const lastPatternMatch = matches.find(m => m.index === lastIndex);
    
    if (latestMatches.length === 0) {
        return { signal: 'NEUTRAL', confidence: 0, pattern: 'None' };
    }

    // 4. Probability Mapping
    // We group patterns by their historical strength
    const patternWeights = {
        // TIER 1: High Probability (Triple Patterns) - +40% to bot confidence
        'morningStar': { signal: 'BULLISH', weight: 40 },
        'threeWhiteSoldiers': { signal: 'BULLISH', weight: 40 },
        'eveningStar': { signal: 'BEARISH', weight: 40 },
        'threeBlackCrows': { signal: 'BEARISH', weight: 40 },

        // TIER 2: Moderate Probability (Double Patterns) - +25% to bot confidence
        'bullishEngulfing': { signal: 'BULLISH', weight: 25 },
        'bullishHarami': { signal: 'BULLISH', weight: 20 },
        'bullishKicker': { signal: 'BULLISH', weight: 30 },
        'bearishEngulfing': { signal: 'BEARISH', weight: 25 },
        'piercingLine': { signal: 'BULLISH', weight: 25 },

        // TIER 3: Low Probability/Too Many False Signals - Reduced weights
        'hammer': { signal: 'BULLISH', weight: 8 },          // Reduced from 15
        'invertedHammer': { signal: 'BULLISH', weight: 8 },  // Reduced from 15
        'shootingStar': { signal: 'BEARISH', weight: 8 },    // Reduced from 15
        'hangingMan': { signal: 'BEARISH', weight: 8 },      // Reduced from 15
        'doji': { signal: 'NEUTRAL', weight: 0 }             // Disabled - too indecisive for scalping
    };

    // 5. Select the strongest pattern found on the current candle
    let bestPattern = { signal: 'NEUTRAL', confidence: 0, pattern: 'None' };

    latestMatches.forEach(match => {
        const entry = patternWeights[match.pattern];
        if (entry && entry.weight > bestPattern.confidence) {
            bestPattern = {
                signal: entry.signal,
                confidence: entry.weight,
                pattern: match.pattern
            };
        }
    });

    return bestPattern;
}

module.exports = { analyzeCandlesticks };