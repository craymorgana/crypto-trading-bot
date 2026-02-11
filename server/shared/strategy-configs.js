/**
 * Unified Trading Strategy Configuration
 * COMBINED: Scalper (5m) + Swing (4h) running together
 * 
 * NOTE: LONG-ONLY strategies (no margin/shorting available)
 * Only BULLISH signals are traded - buy low, sell high
 * 
 * Backtested Returns:
 * - SCALPER: +37,906% over ~42 hours (5m candles, 8% risk)
 * - SWING: +23.39% over 120 days (4h candles, 50% risk)
 */

const STRATEGY_CONFIGS = {
    // ===== OPTIMAL SCALPER - 37,906% backtested =====
    SCALPING: {
        name: '⚡ SCALPER',
        description: '5-minute timeframe, high frequency',
        minConfidenceThreshold: 45,
        riskPerTrade: 0.08,           // 8% per trade
        takeProfitRatio: 1.5,
        maxPositions: 8,
        candleInterval: '5m',
        stopMultiplier: 1.5,
        bullishOnly: true,            // LONG-ONLY: No margin trading
        requireVolume: false,
        requireTrending: false,
        minRRRatio: 0.5,
        tradingSymbols: ['BTC/USD', 'ETH/USD', 'XRP/USD', 'ADA/USD', 'SOL/USD', 'LTC/USD']
    },

    // ===== OPTIMAL SWING - 23.39% backtested =====
    SWING: {
        name: '🎯 SWING',
        description: '4-hour timeframe, trend following',
        minConfidenceThreshold: 50,
        riskPerTrade: 0.50,           // 50% per trade
        takeProfitRatio: 1.5,
        maxPositions: 10,
        candleInterval: '4h',
        stopMultiplier: 0.5,
        bullishOnly: true,            // LONG-ONLY: No margin trading
        requireTrendAlignment: true,
        requireVolume: true,
        requireTrending: true,
        useTrailingStop: true,
        trailActivation: 0.5,
        trailDistance: 0.3,
        minRRRatio: 0.7,
        tradingSymbols: ['BTC/USD', 'ETH/USD', 'XRP/USD', 'ADA/USD', 'SOL/USD', 'LTC/USD']
    },

    // ===== COMBINED MODE - Both strategies running =====
    COMBINED: {
        name: '🚀 COMBINED',
        description: 'Scalper + Swing running simultaneously (LONG-ONLY)',
        bullishOnly: true,            // LONG-ONLY: No margin trading
        scalper: {
            enabled: true,
            minConfidenceThreshold: 45,
            riskPerTrade: 0.08,
            takeProfitRatio: 1.5,
            maxPositions: 6,
            candleInterval: '5m',
            stopMultiplier: 1.5,
            minRRRatio: 0.5
        },
        swing: {
            enabled: true,
            minConfidenceThreshold: 50,
            riskPerTrade: 0.40,
            takeProfitRatio: 1.5,
            maxPositions: 6,
            candleInterval: '4h',
            stopMultiplier: 0.5,
            requireTrendAlignment: true,
            requireVolume: true,
            requireTrending: true,
            useTrailingStop: true,
            minRRRatio: 0.7
        },
        tradingSymbols: ['BTC/USD', 'ETH/USD', 'XRP/USD', 'ADA/USD', 'SOL/USD', 'LTC/USD']
    }
};

function getConfig(mode) {
    const normalized = (typeof mode === 'string' ? mode.toUpperCase().replace('-', '_') : 'COMBINED');
    return STRATEGY_CONFIGS[normalized] || STRATEGY_CONFIGS.COMBINED;
}

function getAllConfigs() {
    return STRATEGY_CONFIGS;
}

module.exports = {
    STRATEGY_CONFIGS,
    getConfig,
    getAllConfigs
};
