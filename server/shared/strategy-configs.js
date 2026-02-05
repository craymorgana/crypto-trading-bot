/**
 * Trading Strategy Configurations
 * Centralized strategy definitions for mode switching
 */

const STRATEGY_CONFIGS = {
    SCALPING: {
        name: '📊 Scalping Mode',
        minConfidenceThreshold: 60,
        riskPerTrade: 0.02,
        takeProfitRatio: 1.5,
        maxPositions: 3,
        candleInterval: '5m',
        stopMultiplier: 1.5,
        bearishOnly: false,
        bullishOnly: false,
        tradingSymbols: [
            'BTC/USD',
            'ETH/USD',
            'XRP/USD',
            'ADA/USD',
            'SOL/USD',
            'LTC/USD'
        ]
    },
    SWING: {
        name: '💥 ULTRA 17% Swing Trading',
        minConfidenceThreshold: 23,
        riskPerTrade: 0.17,
        takeProfitRatio: 1.2,
        maxPositions: 7,
        candleInterval: '4h',
        stopMultiplier: 0.6,
        bearishOnly: true,
        bullishOnly: false,
        tradingSymbols: [
            'BTC/USD',
            'ETH/USD',
            'XRP/USD',
            'ADA/USD',
            'SOL/USD',
            'LTC/USD'
        ]
    }
};

function getConfig(mode) {
    const normalized = (typeof mode === 'string' ? mode.toUpperCase() : 'SCALPING');
    return STRATEGY_CONFIGS[normalized] || STRATEGY_CONFIGS.SCALPING;
}

function getAllConfigs() {
    return STRATEGY_CONFIGS;
}

module.exports = {
    STRATEGY_CONFIGS,
    getConfig,
    getAllConfigs
};
