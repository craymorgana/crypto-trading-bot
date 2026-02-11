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
const { calculateVolatility } = require('../shared/indicators');

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
    running: false,  // Start STOPPED - wait for START_BOT command
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
    const usdBalance = balance?.USD?.free ?? 0;
    console.log(`   Kraken USD Balance: $${usdBalance?.toFixed(2) || '0.00'}`);
    
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
    const COMMAND_CHECK_INTERVAL = 5; // Check for commands more frequently

    console.log('⏸️  Bot initialized but STOPPED. Click "Start Bot" in dashboard to begin trading.\n');

    // Main loop - always runs to check for commands
    while (true) {
        checkCounter++;
        const timestamp = new Date().toLocaleTimeString();

        try {
            // Always check for commands (START_BOT, STOP_BOT)
            if (checkCounter % COMMAND_CHECK_INTERVAL === 0) {
                const pendingCommands = dataLogger.getPendingCommands();
                for (const cmd of pendingCommands) {
                    if (cmd.type === 'START_BOT' && !botState.running) {
                        botState.running = true;
                        console.log(`[${timestamp}] ▶️  BOT STARTED`);
                        dataLogger.markCommandProcessed(cmd.id, { success: true });
                    } else if (cmd.type === 'STOP_BOT' && botState.running) {
                        botState.running = false;
                        console.log(`[${timestamp}] ⏸️  BOT STOPPED`);
                        dataLogger.markCommandProcessed(cmd.id, { success: true });
                    } else if (cmd.type === 'RESTART_BOT') {
                        botState.running = true;
                        console.log(`[${timestamp}] 🔄 BOT RESTARTED`);
                        dataLogger.markCommandProcessed(cmd.id, { success: true });
                    } else {
                        // Mark other commands as processed to avoid buildup
                        dataLogger.markCommandProcessed(cmd.id, { skipped: true });
                    }
                }
            }

            // If bot is stopped, just sleep and continue checking for commands
            if (!botState.running) {
                await sleep(1000);
                continue;
            }

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
                    
                    // Fetch live balance when switching to LIVE mode
                    if (newExecutionMode === 'LIVE') {
                        try {
                            const balance = await exchange.fetchBalance();
                            const usdBalance = balance?.USD?.free ?? 0;
                            console.log(`[${timestamp}] 💰 Live Kraken balance: $${usdBalance.toFixed(2)}`);
                            positionManager.accountBalance = usdBalance;
                            positionManager.availableBalance = usdBalance;
                            dataLogger.updateStats({ currentBalance: usdBalance, availableBalance: usdBalance });
                        } catch (err) {
                            console.error(`[${timestamp}] ❌ Failed to fetch balance: ${err.message}`);
                        }
                    }
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

                        // Only take BULLISH signals (long-only, no margin/shorting available)
                        if (analysis.meetsThreshold && analysis.finalSignal === 'BULLISH') {
                            console.log(`[${timestamp}] 📈 SIGNAL DETECTED`);
                            console.log(`   Symbol: ${symbol}`);
                            console.log(`   Signal: ${analysis.finalSignal}`);
                            console.log(`   Confidence: ${(analysis.confidence || 0).toFixed(0)}%`);
                            console.log(`   Current Price: $${(currentPrice || 0).toFixed(2)}\n`);

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
                                // Calculate ATR for stop/target
                                const atrData = calculateVolatility(ohlcv, 14);
                                const atr = atrData.atr || (currentPrice * 0.01); // Fallback to 1% if ATR fails
                                
                                // Calculate stop and target based on ATR and config
                                const stopMultiplier = PRODUCTION_CONFIG.stopMultiplier || 1.5;
                                const takeProfitRatio = PRODUCTION_CONFIG.takeProfitRatio || 1.5;
                                
                                // BULLISH only: Stop below entry, target above
                                const stopPrice = currentPrice - (atr * stopMultiplier);
                                const targetPrice = currentPrice + (atr * stopMultiplier * takeProfitRatio);

                                const tradeData = {
                                    symbol,
                                    entryPrice: currentPrice,
                                    stopPrice,
                                    targetPrice,
                                    signal: analysis.finalSignal,
                                    confidence: analysis.confidence,
                                    swingHigh: null,
                                    swingLow: null
                                };

                                // First get position sizing from risk manager
                                const result = positionManager.openPosition(tradeData);
                                
                                if (result.success) {
                                    // ALWAYS re-check execution mode before any trade
                                    const currentExecutionMode = loadExecutionModeFromState();
                                    botState.executionMode = currentExecutionMode;
                                    
                                    // If LIVE mode, execute real trade on Kraken
                                    if (currentExecutionMode === 'LIVE') {
                                        try {
                                            const tradeResponse = await axios.post(`${DASHBOARD_API}/execute-trade`, {
                                                symbol,
                                                side: 'buy',  // Long-only: always buying
                                                quantity: result.trade.positionSize,
                                                entryPrice: result.trade.entryPrice,
                                                stopPrice: result.trade.stopPrice,
                                                takeProfitPrice: result.trade.targetPrice
                                            });
                                            
                                            if (tradeResponse.data.success) {
                                                console.log(`[${timestamp}] 🔴 LIVE TRADE EXECUTED`);
                                                console.log(`   Entry Order ID: ${tradeResponse.data.order?.id || 'N/A'}`);
                                                const condClose = tradeResponse.data.order?.conditionalClose;
                                                if (condClose) {
                                                    console.log(`   🛑 Stop-Loss (conditional close): trigger=$${condClose.triggerPrice.toFixed(2)}, limit=$${condClose.limitPrice.toFixed(2)}`);
                                                } else {
                                                    console.log(`   ⚠️  No conditional stop-loss attached`);
                                                }
                                                const tp = tradeResponse.data.takeProfit;
                                                if (tp) {
                                                    console.log(`   🎯 Take-Profit: trigger=$${tp.triggerPrice.toFixed(2)}, limit=$${tp.limitPrice.toFixed(2)} (ID: ${tp.id})`);
                                                } else {
                                                    console.log(`   ⚠️  No take-profit order placed`);
                                                }
                                                console.log('');
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
                                        console.log(`[${timestamp}] 📊 TRADE OPENED (SIMULATED) - BUY`);
                                        console.log(`   Entry: $${(result.trade.entryPrice || 0).toFixed(2)}`);
                                        console.log(`   Stop: $${(result.trade.stopPrice || 0).toFixed(2)}`);
                                        console.log(`   Target: $${(result.trade.targetPrice || 0).toFixed(2)}`);
                                        console.log(`   Position Size: ${(result.trade.positionSize || 0).toFixed(4)}\n`);
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
                            console.log(`   Exit Price: $${(currentPrice || 0).toFixed(2)}`);
                            console.log(`   P&L: $${(exitTrade.profit || 0).toFixed(2)} (${((exitTrade.profitPercent || 0) * 100).toFixed(2)}%)\n`);

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
                console.log(`   Balance: $${(positionManager.accountBalance || 0).toFixed(2)}`);
                console.log(`   Win Rate: ${stats.winRate || '0%'}\n`);
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
