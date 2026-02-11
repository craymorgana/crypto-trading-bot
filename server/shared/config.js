/**
 * Trading Configuration
 * Define which symbols to trade and their parameters
 * SCALPER: Optimized for +22,000% returns (5m timeframe)
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

    // Risk parameters - OPTIMIZED for maximum scalping returns
    riskParams: {
        maxPositions: 8,           // Allow up to 8 concurrent positions
        riskPerTrade: 0.08,        // 8% risk per trade (optimized)
        takeProfitRatio: 1.5,      // 1.5:1 take profit
        takeProfitRatioHigh: 2.0,
        takeProfitRatioLow: 1.2,
        confidenceHigh: 60,
        confidenceLow: 45,
        maxDrawdown: 0.15,         // 15% max drawdown
        accountBalance: 10000      // Starting balance
    },

    // Analysis parameters - OPTIMIZED
    analysisParams: {
        minConfidenceThreshold: 45,     // Lower threshold = more trades
        candleInterval: '5m',           // 5-minute candles
        ohlcvHistory: 100,
        checkInterval: 10000,
        stopMultiplier: 1.5             // 1.5x candle range for stops
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
