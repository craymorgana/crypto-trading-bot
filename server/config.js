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
        riskPerTrade: 0.05,        // 5% risk per trade (reduced from 33%)
        takeProfitRatio: 1.8,      // Base R/R ratio
        takeProfitRatioHigh: 2.5,  // Higher R/R for high-confidence signals
        takeProfitRatioLow: 1.4,   // Lower R/R for low-confidence signals
        confidenceHigh: 70,        // Confidence tier thresholds
        confidenceLow: 45,
        maxDrawdown: 0.05,         // 5% max drawdown threshold
        accountBalance: 10000      // Starting balance ($10,000)
    },

    // Analysis parameters
    analysisParams: {
        minConfidenceThreshold: 45,     // Minimum confidence % to enter trade
        candleInterval: '1m',           // 1-minute candles (Kraken supports this)
        ohlcvHistory: 100,              // Fetch 100 candles for indicators
        checkInterval: 10000            // Check every 10 seconds
    }
};
