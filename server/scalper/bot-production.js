/**
 * Production Bot - Unified Strategy Mode Switch
 * Supports both Scalping (3m) and Swing Trading (4h) modes
 * Mode can be switched via GUI dashboard or bot-mode-state.json
 * 
 * Usage: node server/scalper/bot-production.js
 */

require('dotenv').config();
const ccxt = require('ccxt');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { analyzeForSwinging, formatAnalysis } = require('../shared/unified-analysis');
const PositionManager = require('../shared/risk-manager');
const dataLogger = require('../shared/data-logger');
const { getConfig } = require('../shared/strategy-configs');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Dashboard API base URL
const DASHBOARD_API = 'http://localhost:3000/api';

// Path to mode state file (written by dashboard)
const BOT_MODE_STATE_FILE = path.join(__dirname, '..', 'shared', 'bot-mode-state.json');
const BOT_EXECUTION_STATE_FILE = path.join(__dirname, '..', 'shared', 'bot-execution-state.json');

// Default production config (SWING ULTRA 17%)
const DEFAULT_PRODUCTION_CONFIG = {
    name: '💥 ULTRA 17% SWING PRODUCTION',
    minConfidenceThreshold: 23,
    riskPerTrade: 0.17,
    takeProfitRatio: 1.2,
    maxPositions: 7,
    candleInterval: '4h',
    stopMultiplier: 0.6,
    bearishOnly: true,
    tradingSymbols: [
        'BTC/USD',
        'ETH/USD',
        'XRP/USD',
        'ADA/USD',
        'SOL/USD',
        'LTC/USD'
    ]
};

let PRODUCTION_CONFIG = DEFAULT_PRODUCTION_CONFIG;

const botState = {
    running: true,
    mode: 'SWING', // Can be SCALPING or SWING
    executionMode: 'SIMULATED', // Can be SIMULATED or LIVE
    tradesThisSession: 0,
    sessionStartTime: new Date(),
    lastCandleTimeMap: {},
    lastModeCheck: 0
};

/**
 * Load execution mode from state file
 */
function loadExecutionModeFromState() {
    try {
        if (fs.existsSync(BOT_EXECUTION_STATE_FILE)) {
            const data = fs.readFileSync(BOT_EXECUTION_STATE_FILE, 'utf8');
            const state = JSON.parse(data);
            if (state.mode && (state.mode === 'SIMULATED' || state.mode === 'LIVE')) {
                return state.mode;
            }
        }
    } catch (err) {
        console.warn('[BOT] Failed to read execution mode state file:', err.message);
    }
    return 'SIMULATED'; // Default to simulated for safety
}

/**
 * Load current mode from state file
 */
function loadModeFromState() {
    try {
        if (fs.existsSync(BOT_MODE_STATE_FILE)) {
            const data = fs.readFileSync(BOT_MODE_STATE_FILE, 'utf8');
            const state = JSON.parse(data);
            if (state.mode && (state.mode === 'SCALPING' || state.mode === 'SWING')) {
                return state.mode;
            }
        }
    } catch (err) {
        console.warn('[BOT] Failed to read mode state file:', err.message);
    }
    return 'SWING'; // Default to swing for production
}

/**
 * Update bot configuration based on current mode
 */
function updateConfigFromMode() {
    const currentMode = botState.mode;
    const newConfig = getConfig(currentMode);
    PRODUCTION_CONFIG = {
        ...newConfig,
        name: `${newConfig.name} (${currentMode})`
    };
    console.log(`[${new Date().toLocaleTimeString()}] 🔄 Config updated to: ${PRODUCTION_CONFIG.name}`);
}

async function initializeBot() {
    console.log('\n╭────────────────────────────────────────────────╮');
    console.log('│  🤖 PRODUCTION BOT - KRAKEN LIVE                  │');
    console.log(`│  Mode: ${botState.executionMode === 'LIVE' ? '🔴 LIVE TRADING' : '📊 SIMULATED'}                        │`);
    console.log('╰────────────────────────────────────────────────╯\n');

    console.log('📊 Strategy Parameters:');
    console.log(`   Risk Per Trade: ${(PRODUCTION_CONFIG.riskPerTrade * 100).toFixed(0)}%`);
    console.log(`   Max Positions: ${PRODUCTION_CONFIG.maxPositions}`);
    console.log(`   Confidence Threshold: ${PRODUCTION_CONFIG.minConfidenceThreshold}%`);
    console.log(`   Filter: Bearish Only`);
    console.log(`   Pairs: ${PRODUCTION_CONFIG.tradingSymbols.join(', ')}`);
    console.log(`   Timeframe: ${PRODUCTION_CONFIG.candleInterval}\n`);

    // Check if API credentials are loaded
    if (!process.env.KRAKEN_US_KEY || !process.env.KRAKEN_US_SECRET) {
        console.error('❌ Kraken API credentials not found in .env file');
        console.error('   Required: KRAKEN_US_KEY and KRAKEN_US_SECRET');
        process.exit(1);
    }

    const exchange = new ccxt.kraken({
        'enableRateLimit': true,
        'apiKey': process.env.KRAKEN_US_KEY,
        'secret': process.env.KRAKEN_US_SECRET
    });

    // Fetch actual account balance from Kraken
    console.log('💰 Fetching account balance from Kraken...');
    const balance = await exchange.fetchBalance();
    const usdBalance = balance['USD']?.free || 0;
    console.log(`   Kraken USD Balance: $${usdBalance.toFixed(2)}`);
    
    if (usdBalance === 0) {
        console.log('   ⚠️  Zero balance detected');
    }
    
    if (botState.executionMode === 'LIVE' && usdBalance === 0) {
        console.log('   🚫 Cannot trade in LIVE mode with $0 balance');
        console.log('   Switching to SIMULATED mode...\n');
        botState.executionMode = 'SIMULATED';
    } else {
        console.log('');
    }

    const riskParams = {
        maxPositions: PRODUCTION_CONFIG.maxPositions,
        riskPerTrade: PRODUCTION_CONFIG.riskPerTrade,
        takeProfitRatio: PRODUCTION_CONFIG.takeProfitRatio,
        takeProfitRatioHigh: PRODUCTION_CONFIG.takeProfitRatio + 0.3,
        takeProfitRatioLow: PRODUCTION_CONFIG.takeProfitRatio - 0.2,
        confidenceHigh: 75,
        confidenceLow: 60,
        maxDrawdown: 0.10,
        accountBalance: usdBalance
    };

    const positionManager = new PositionManager(riskParams);
    dataLogger.resetData(positionManager.accountBalance);

    // Initialize last candle times
    PRODUCTION_CONFIG.tradingSymbols.forEach(symbol => {
        botState.lastCandleTimeMap[symbol] = null;
    });

    console.log('✅ Bot initialized. Connecting to Kraken...\n');

    return { exchange, positionManager };
}

async function runProductionBot() {
    // Load initial modes
    botState.mode = loadModeFromState();
    botState.executionMode = loadExecutionModeFromState();
    updateConfigFromMode();
    
    const { exchange, positionManager } = await initializeBot();
    
    // Register exchange with dashboard for trade execution
    try {
        const { registerExchange } = require('../dashboard.js');
        registerExchange(exchange);
        console.log('✅ Exchange registered with dashboard\n');
    } catch (err) {
        console.warn('⚠️  Could not register exchange with dashboard:', err.message);
    }

    let checkCounter = 0;
    const MODE_CHECK_INTERVAL = 30; // Check for mode changes every 30 iterations

    while (botState.running) {
        checkCounter++;
        const timestamp = new Date().toLocaleTimeString();

        try {
            // Periodically check for mode changes from dashboard
            if (checkCounter % MODE_CHECK_INTERVAL === 0) {
                const newMode = loadModeFromState();
                const newExecutionMode = loadExecutionModeFromState();
                
                if (newMode !== botState.mode) {
                    console.log(`[${timestamp}] 🔔 MODE CHANGE DETECTED: ${botState.mode} → ${newMode}`);
                    botState.mode = newMode;
                    updateConfigFromMode();
                    botState.lastCandleTimeMap = {}; // Reset candle tracking for new timeframe
                }
                
                if (newExecutionMode !== botState.executionMode) {
                    console.log(`[${timestamp}] 🔔 EXECUTION MODE CHANGE: ${botState.executionMode} → ${newExecutionMode}`);
                    botState.executionMode = newExecutionMode;
                    const modeLabel = newExecutionMode === 'LIVE' ? '🔴 LIVE TRADING' : '📊 SIMULATED';
                    console.log(`[${timestamp}] ${modeLabel} mode activated`);
                }
            }
            
            // Fetch fresh data
            const ohlcvDataMap = {};
            for (const symbol of PRODUCTION_CONFIG.tradingSymbols) {
                try {
                    const ohlcv = await exchange.fetchOHLCV(
                        symbol,
                        PRODUCTION_CONFIG.candleInterval,
                        undefined,
                        500
                    );
                    ohlcvDataMap[symbol] = ohlcv;
                } catch (err) {
                    console.error(`[${timestamp}] ❌ Error fetching ${symbol}: ${err.message}`);
                    throw err; // Re-throw to exit on first API error
                }
            }

            // Analyze each symbol
            for (const symbol of PRODUCTION_CONFIG.tradingSymbols) {
                try {
                    const ohlcv = ohlcvDataMap[symbol];
                    if (!ohlcv || ohlcv.length < 100) continue;

                    const currentCandle = ohlcv[ohlcv.length - 1];
                    const currentCandleTime = currentCandle[0];
                    const currentPrice = currentCandle[4];

                    // Check if new candle closed
                    if (currentCandleTime !== botState.lastCandleTimeMap[symbol]) {
                        // Analyze completed candle
                        const analysis = analyzeForSwinging(ohlcv.slice(0, -1), {
                            minConfidenceThreshold: PRODUCTION_CONFIG.minConfidenceThreshold
                        });

                        // Apply bearish-only filter
                        if (analysis.meetsThreshold && analysis.finalSignal === 'BEARISH') {
                            console.log(`[${timestamp}] 📈 SIGNAL DETECTED`);
                            console.log(`   Symbol: ${symbol}`);
                            console.log(`   Signal: ${analysis.finalSignal}`);
                            console.log(`   Confidence: ${analysis.confidence.toFixed(0)}%`);
                            console.log(`   Current Price: $${currentPrice.toFixed(2)}\n`);

                            dataLogger.logSignal({
                                symbol,
                                signal: analysis.finalSignal,
                                confidence: analysis.confidence,
                                pattern: null,
                                indicators: analysis.signals.indicators,
                                fibonacci: analysis.signals.fibonacci?.hasSupport,
                                harmonics: analysis.signals.harmonics?.isValid,
                                meetsThreshold: analysis.meetsThreshold
                            });

                            // Attempt entry
                            const openPositions = positionManager.positions.length;
                            if (openPositions < PRODUCTION_CONFIG.maxPositions) {
                                const entry = {
                                    symbol,
                                    entryPrice: currentPrice,
                                    signal: analysis.finalSignal,
                                    confidence: analysis.confidence,
                                    timestamp: new Date()
                                };

                                const tradeData = {
                                    symbol,
                                    entryPrice: currentPrice,
                                    signal: analysis.finalSignal,
                                    confidence: analysis.confidence,
                                    swingHigh: null,
                                    swingLow: null
                                };

                                // First get position sizing from risk manager
                                const result = positionManager.openPosition(tradeData);
                                
                                if (result.success) {
                                    // If LIVE mode, execute real trade on Kraken
                                    if (botState.executionMode === 'LIVE') {
                                        try {
                                            const tradeResponse = await axios.post(`${DASHBOARD_API}/execute-trade`, {
                                                symbol,
                                                side: analysis.finalSignal.toLowerCase() === 'bearish' ? 'sell' : 'buy',
                                                quantity: result.trade.positionSize,
                                                entryPrice: result.trade.entryPrice,
                                                stopPrice: result.trade.stopPrice,
                                                takeProfitPrice: result.trade.targetPrice
                                            });
                                            
                                            if (tradeResponse.data.success) {
                                                console.log(`[${timestamp}] 🔴 LIVE TRADE EXECUTED`);
                                                console.log(`   Entry Order ID: ${tradeResponse.data.order.id}`);
                                                console.log(`   Stop-Loss: $${tradeResponse.data.closeOrder?.triggerPrice.toFixed(2)}`);
                                                console.log(`   Take-Profit: ${tradeResponse.data.takeProfit ? '$' + tradeResponse.data.takeProfit.price.toFixed(2) : 'N/A'}\n`);
                                            } else {
                                                throw new Error(tradeResponse.data.error || 'Unknown error');
                                            }
                                        } catch (err) {
                                            console.error(`[${timestamp}] ❌ LIVE TRADE FAILED: ${err.message}`);
                                            console.log(`[${timestamp}] 🔄 RECOVERY: Removing position from manager (desync avoided)`);
                                            // IMPORTANT: Remove from position manager to avoid state mismatch
                                            positionManager.positions = positionManager.positions.filter(p => p !== result.trade);
                                            continue;
                                        }
                                    } else {
                                        // SIMULATED mode - just log
                                        console.log(`[${timestamp}] 📊 TRADE OPENED (SIMULATED)`);
                                        console.log(`   Entry: $${result.trade.entryPrice.toFixed(2)}`);
                                        console.log(`   Stop: $${result.trade.stopPrice.toFixed(2)}`);
                                        console.log(`   Target: $${result.trade.targetPrice.toFixed(2)}`);
                                        console.log(`   Position Size: ${result.trade.positionSize.toFixed(4)}\n`);
                                    }

                                    dataLogger.logTrade({
                                        symbol,
                                        signal: analysis.finalSignal,
                                        entryPrice: result.trade.entryPrice,
                                        stopPrice: result.trade.stopPrice,
                                        targetPrice: result.trade.targetPrice,
                                        confidence: analysis.confidence,
                                        positionSize: result.trade.positionSize
                                    });

                                    botState.tradesThisSession++;
                                }
                            }
                        }

                        botState.lastCandleTimeMap[symbol] = currentCandleTime;
                    }

                    // Check exit signals
                    const exitSignals = positionManager.checkExitSignals(currentPrice);
                    for (const exitTrade of exitSignals) {
                        if (exitTrade.symbol === symbol) {
                            console.log(`[${timestamp}] 🎯 POSITION CLOSED`);
                            console.log(`   Symbol: ${symbol}`);
                            console.log(`   Exit Price: $${currentPrice.toFixed(2)}`);
                            console.log(`   P&L: $${exitTrade.profit.toFixed(2)} (${(exitTrade.profitPercent * 100).toFixed(2)}%)\n`);

                            dataLogger.closeTrade(exitTrade.tradeId, currentPrice);
                        }
                    }
                } catch (symbolErr) {
                    // Silent error
                }
            }

            // Log session stats every 10 checks
            if (checkCounter % 10 === 0) {
                const stats = positionManager.getPerformanceStats();
                console.log(`[${timestamp}] 📊 SESSION STATS`);
                console.log(`   Trades Opened: ${botState.tradesThisSession}`);
                console.log(`   Open Positions: ${positionManager.positions.length}/${PRODUCTION_CONFIG.maxPositions}`);
                console.log(`   Balance: $${positionManager.accountBalance.toFixed(2)}`);
                console.log(`   Win Rate: ${stats.winRate.toFixed(1)}%\n`);
            }

            await sleep(300000); // Check every 5 minutes
        } catch (error) {
            console.error(`[${timestamp}] 💥 Fatal Error: ${error.message}`);
            console.error(`Stack: ${error.stack}`);
            await sleep(60000); // Retry after 1 minute
        }
    }
}

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n🛑 Shutting down gracefully...');
    botState.running = false;
    setTimeout(() => process.exit(0), 5000);
});

// Start bot
runProductionBot().catch(err => {
    console.error('❌ Bot failed:', err.message);
    process.exit(1);
});
