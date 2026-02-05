/**
 * Trading Configuration
 * Define which symbols to trade and their parameters
 */

module.exports = {
    // Trading symbols - Kraken uses format like BTC/USD, ETH/USD, etc.
    tradingSymbols: [
        'BTC/USD',
        'ETH/USD',
        'XRP/USD',
        'ADA/USD',
        'SOL/USD',
        'LTC/USD'
    ],

    // Risk parameters (applied to all symbols)
    riskParams: {
        maxPositions: 3,           // Max concurrent positions across all symbols
        riskPerTrade: 0.02,        // 2% risk per trade (conservative)
        takeProfitRatio: 2.0,      // Base R/R ratio (need 2:1 for positive expectancy)
        takeProfitRatioHigh: 2.5,  // Higher R/R for high-confidence signals
        takeProfitRatioLow: 1.8,   // Lower R/R for low-confidence signals
        confidenceHigh: 75,        // Confidence tier thresholds (stricter)
        confidenceLow: 60,
        maxDrawdown: 0.05,         // 5% max drawdown threshold
        accountBalance: 10000      // Starting balance ($10,000)
    },

    // Analysis parameters
    analysisParams: {
        minConfidenceThreshold: 60,     // Balanced threshold for signal quality
        candleInterval: '5m',           // 5-minute candles (better performance than 1m)
        ohlcvHistory: 100,              // Fetch 100 candles for indicators
        checkInterval: 10000,           // Check every 10 seconds
        stopMultiplier: 2.0             // Wider stops to avoid noise (candle range * 2)
    },

    // Swing trading parameters (high timeframe)
    swingAnalysisParams: {
        minConfidenceThreshold: 60,
        candleInterval: '4h',
        ohlcvHistory: 200,
        checkInterval: 60000,           // Check every 60 seconds
        stopMultiplier: 3.5
    },

    // Swing trading risk parameters
    swingRiskParams: {
        maxPositions: 2,
        riskPerTrade: 0.12,
        takeProfitRatio: 3.5,
        takeProfitRatioHigh: 4.0,
        takeProfitRatioLow: 2.5,
        confidenceHigh: 70,
        confidenceLow: 50,
        maxDrawdown: 0.10,
        accountBalance: 10000
    }
};
