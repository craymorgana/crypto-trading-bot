/**
 * Trading Configuration
 * Define which symbols to trade and their parameters
 */

module.exports = {
    // Trading symbols - Coinbase uses product_id format (e.g., BTC-USD, ETH-USD)
    tradingSymbols: [
        'BTC-USD',
        'ETH-USD',
        'XRP-USD',
        'ADA-USD',
        'SOL-USD',
        'LTC-USD'
    ],

    // Risk parameters (applied to all symbols)
    riskParams: {
        maxPositions: 3,           // Max concurrent positions across all symbols
        riskPerTrade: 0.05,        // 5% risk per trade (reduced from 33%)
        takeProfitRatio: 1.5,      // 1.5:1 risk/reward ratio
        maxDrawdown: 0.05,         // 5% max drawdown threshold
        accountBalance: 10000      // Starting balance ($10,000)
    },

    // Analysis parameters
    analysisParams: {
        minConfidenceThreshold: 40,     // Minimum confidence % to enter trade
        candleInterval: '1m',           // 1-minute candles (Coinbase doesn't support 3m)
        ohlcvHistory: 100,              // Fetch 100 candles for indicators
        checkInterval: 10000            // Check every 10 seconds
    }
};
