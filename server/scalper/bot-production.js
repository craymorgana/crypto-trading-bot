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
    lastModeCheck: 0,
    lastReconcileTime: 0
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

    // Sync with existing Kraken open orders so we don't double-up
    try {
        console.log('🔄 Syncing with existing Kraken open orders...');
        const openOrders = await exchange.fetchOpenOrders();
        
        // Track which symbols already have conditional close (stop-loss) orders
        // These indicate an active position that the bot previously opened
        const symbolsWithOrders = new Set();
        for (const order of openOrders) {
            if (order.symbol && PRODUCTION_CONFIG.tradingSymbols.includes(order.symbol)) {
                symbolsWithOrders.add(order.symbol);
            }
        }
        
        // Mark those symbols as having positions so we don't re-enter
        for (const sym of symbolsWithOrders) {
            try {
                const ticker = await exchange.fetchTicker(sym);
                const currentPrice = ticker.last;
                
                // Create a placeholder position so the manager won't open a new one
                positionManager.positions.push({
                    id: `synced_${sym}_${Date.now()}`,
                    symbol: sym,
                    signal: 'BULLISH',
                    entryPrice: currentPrice,
                    stopPrice: currentPrice * 0.99,
                    targetPrice: currentPrice * 1.01,
                    positionSize: 0,
                    riskAmount: 0,
                    confidence: 0,
                    timestamp: new Date(),
                    analysis: {},
                    status: 'OPEN',
                    synced: true  // Flag so we know this is a synced placeholder
                });
                console.log(`   📌 Synced existing position: ${sym} (has open orders on Kraken)`);
            } catch (err) {
                console.warn(`   ⚠️  Could not sync ${sym}: ${err.message}`);
            }
        }
        
        console.log(`   ✅ Found ${symbolsWithOrders.size} existing positions on Kraken`);
        console.log(`   📊 Position tracker: ${positionManager.positions.length}/${PRODUCTION_CONFIG.maxPositions}\n`);
    } catch (err) {
        console.warn('⚠️  Could not sync Kraken orders:', err.message);
    }

    console.log('✅ Bot initialized. Connecting to Kraken...\n');

    return { exchange, positionManager };
}

/**
 * Reconcile bot positions with actual Kraken order state.
 * - Detects filled SL or TP orders
 * - Cancels orphaned counterpart orders
 * - Closes the position in data-logger so dashboard shows it
 * - Re-places missing TP orders if needed
 */
async function reconcileKrakenOrders(exchange, positionManager) {
    const timestamp = new Date().toLocaleTimeString();

    if (botState.executionMode !== 'LIVE') return;

    try {
        // Fetch all open orders and recent closed orders from Kraken
        const openOrders = await exchange.fetchOpenOrders();
        
        // Build a map of open order IDs for quick lookup
        const openOrderIds = new Set(openOrders.map(o => o.id));

        // Fetch recent closed orders (last 50)
        let closedOrders = [];
        try {
            closedOrders = await exchange.fetchClosedOrders(undefined, undefined, 50);
        } catch (err) {
            console.warn(`[${timestamp}] ⚠️  Could not fetch closed orders: ${err.message}`);
        }
        const closedOrderMap = {};
        closedOrders.forEach(o => { closedOrderMap[o.id] = o; });

        // Check each tracked position
        const positionsToRemove = [];
        
        for (const pos of positionManager.positions) {
            if (!pos.krakenOrderIds) continue; // No order IDs tracked (synced placeholder)

            const { entryOrderId, stopOrderId, tpOrderId } = pos.krakenOrderIds;
            
            // Check if TP was filled
            let tpFilled = false;
            let tpFillPrice = null;
            if (tpOrderId) {
                if (!openOrderIds.has(tpOrderId)) {
                    // TP no longer open — check if it was filled
                    const closedTp = closedOrderMap[tpOrderId];
                    if (closedTp && (closedTp.status === 'closed' || closedTp.filled > 0)) {
                        tpFilled = true;
                        tpFillPrice = closedTp.average || closedTp.price || pos.targetPrice;
                    }
                }
            }

            // Check if SL was filled (conditional close becomes a closed order)
            let slFilled = false;
            let slFillPrice = null;
            if (stopOrderId) {
                if (!openOrderIds.has(stopOrderId)) {
                    const closedSl = closedOrderMap[stopOrderId];
                    if (closedSl && (closedSl.status === 'closed' || closedSl.filled > 0)) {
                        slFilled = true;
                        slFillPrice = closedSl.average || closedSl.price || pos.stopPrice;
                    }
                }
            }

            // Also check: if we have NO open orders for this symbol at all,
            // and the position has been open a while, the SL conditional close may have triggered
            if (!tpFilled && !slFilled && !stopOrderId) {
                const symbolOrders = openOrders.filter(o => o.symbol === pos.symbol);
                if (symbolOrders.length === 0 && pos.entryPrice) {
                    // No orders left — position was likely closed by conditional close
                    try {
                        const ticker = await exchange.fetchTicker(pos.symbol);
                        const currentPrice = ticker.last;
                        // If price is below entry, likely SL hit
                        slFilled = true;
                        slFillPrice = currentPrice;
                        console.log(`[${timestamp}] 🔍 No open orders for ${pos.symbol} — assuming SL triggered at ~$${currentPrice.toFixed(2)}`);
                    } catch (err) {
                        // skip
                    }
                }
            }

            // Handle TP fill: cancel SL, close position as win
            if (tpFilled) {
                console.log(`[${timestamp}] 🎯 TAKE-PROFIT FILLED: ${pos.symbol} @ $${tpFillPrice?.toFixed(2)}`);
                
                // Cancel the stop-loss if it's still open
                if (stopOrderId && openOrderIds.has(stopOrderId)) {
                    try {
                        await exchange.cancelOrder(stopOrderId, pos.symbol);
                        console.log(`[${timestamp}]    🗑️  Cancelled orphan stop-loss order ${stopOrderId}`);
                    } catch (err) {
                        console.warn(`[${timestamp}]    ⚠️  Could not cancel SL ${stopOrderId}: ${err.message}`);
                    }
                }

                // Also cancel any other open orders for this symbol (conditional close remnants)
                for (const order of openOrders) {
                    if (order.symbol === pos.symbol && order.id !== tpOrderId) {
                        try {
                            await exchange.cancelOrder(order.id, pos.symbol);
                            console.log(`[${timestamp}]    🗑️  Cancelled extra order ${order.id} for ${pos.symbol}`);
                        } catch (err) { /* ignore */ }
                    }
                }

                // Close in data-logger
                const profitLoss = (tpFillPrice - pos.entryPrice) * (pos.positionSize || 0);
                const profitLossPercent = pos.entryPrice > 0 ? ((tpFillPrice - pos.entryPrice) / pos.entryPrice) * 100 : 0;
                dataLogger.closeTrade(pos.id, tpFillPrice, 'TARGET_HIT', profitLoss, profitLossPercent);

                positionsToRemove.push(pos.id);
                console.log(`[${timestamp}]    💰 P&L: $${profitLoss.toFixed(2)} (${profitLossPercent.toFixed(2)}%)`);
            }

            // Handle SL fill: cancel TP, close position as loss
            if (slFilled && !tpFilled) {
                console.log(`[${timestamp}] 🛑 STOP-LOSS FILLED: ${pos.symbol} @ $${slFillPrice?.toFixed(2)}`);

                // Cancel the take-profit if it's still open
                if (tpOrderId && openOrderIds.has(tpOrderId)) {
                    try {
                        await exchange.cancelOrder(tpOrderId, pos.symbol);
                        console.log(`[${timestamp}]    🗑️  Cancelled orphan take-profit order ${tpOrderId}`);
                    } catch (err) {
                        console.warn(`[${timestamp}]    ⚠️  Could not cancel TP ${tpOrderId}: ${err.message}`);
                    }
                }

                // Also cancel any other open orders for this symbol
                for (const order of openOrders) {
                    if (order.symbol === pos.symbol && order.id !== stopOrderId) {
                        try {
                            await exchange.cancelOrder(order.id, pos.symbol);
                            console.log(`[${timestamp}]    🗑️  Cancelled extra order ${order.id} for ${pos.symbol}`);
                        } catch (err) { /* ignore */ }
                    }
                }

                // Close in data-logger
                const profitLoss = (slFillPrice - pos.entryPrice) * (pos.positionSize || 0);
                const profitLossPercent = pos.entryPrice > 0 ? ((slFillPrice - pos.entryPrice) / pos.entryPrice) * 100 : 0;
                dataLogger.closeTrade(pos.id, slFillPrice, 'STOP_HIT', profitLoss, profitLossPercent);

                positionsToRemove.push(pos.id);
                console.log(`[${timestamp}]    💸 P&L: $${profitLoss.toFixed(2)} (${profitLossPercent.toFixed(2)}%)`);
            }

            // Check if TP is missing but position still open (failed TP placement)
            if (!tpFilled && !slFilled && tpOrderId === null && pos.targetPrice && !pos.synced) {
                console.log(`[${timestamp}] ⚠️  ${pos.symbol} has no TP order — attempting to place one...`);
                try {
                    await exchange.loadMarkets();
                    const market = exchange.market(pos.symbol);
                    const balance = await exchange.fetchBalance();
                    const base = market.base;
                    const freeBase = balance.free?.[base] ?? 0;
                    const minAmount = market.limits?.amount?.min || 0;

                    if (freeBase > minAmount) {
                        const tpQty = parseFloat(exchange.amountToPrecision(pos.symbol, freeBase));
                        const tpTrigger = parseFloat(exchange.priceToPrecision(pos.symbol, pos.targetPrice));
                        const tpLimitRaw = tpTrigger * 0.997;
                        const tpLimit = parseFloat(exchange.priceToPrecision(pos.symbol, tpLimitRaw));

                        const tpOrder = await exchange.createOrder(
                            pos.symbol, 'take-profit-limit', 'sell', tpQty, tpTrigger, { price2: tpLimit }
                        );
                        pos.krakenOrderIds.tpOrderId = tpOrder.id;
                        dataLogger.updateTradeOrders(pos.id, { tpOrderId: tpOrder.id });
                        console.log(`[${timestamp}]    🎯 TP placed: trigger=$${tpTrigger}, limit=$${tpLimit} (ID: ${tpOrder.id})`);
                    }
                } catch (err) {
                    console.warn(`[${timestamp}]    ⚠️  TP retry failed: ${err.message}`);
                }
            }
        }

        // Remove closed positions from position manager
        if (positionsToRemove.length > 0) {
            positionManager.positions = positionManager.positions.filter(p => !positionsToRemove.includes(p.id));

            // Update balance from Kraken
            try {
                const balance = await exchange.fetchBalance();
                const usdBalance = balance?.USD?.free ?? 0;
                positionManager.accountBalance = usdBalance;
                dataLogger.updateStats({
                    currentBalance: usdBalance,
                    availableBalance: usdBalance,
                    openPositions: positionManager.positions.length
                });
                console.log(`[${timestamp}] 💰 Updated balance: $${usdBalance.toFixed(2)} | Open positions: ${positionManager.positions.length}`);
            } catch (err) {
                console.warn(`[${timestamp}] ⚠️  Balance update failed: ${err.message}`);
            }
        }
    } catch (err) {
        console.error(`[${timestamp}] ❌ Reconciliation error: ${err.message}`);
    }
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
    const RECONCILE_INTERVAL_MS = 60000; // Reconcile Kraken orders every 60 seconds

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
            
            // Reconcile Kraken orders every 60 seconds (detect SL/TP fills, cancel orphans)
            const now = Date.now();
            if (botState.executionMode === 'LIVE' && (now - botState.lastReconcileTime) > RECONCILE_INTERVAL_MS) {
                botState.lastReconcileTime = now;
                await reconcileKrakenOrders(exchange, positionManager);
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
                            const existingOnSymbol = positionManager.positions.find(p => p.symbol === symbol);
                            const openPositions = positionManager.positions.length;
                            if (existingOnSymbol) {
                                // Already have a position on this symbol, skip
                            } else if (openPositions < PRODUCTION_CONFIG.maxPositions) {
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
                                                // Store Kraken order IDs on the position for reconciliation
                                                result.trade.krakenOrderIds = {
                                                    entryOrderId: tradeResponse.data.order?.id || null,
                                                    stopOrderId: null,  // Conditional close — tracked via symbol
                                                    tpOrderId: tradeResponse.data.takeProfit?.id || null
                                                };

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
                                        id: result.trade.id,
                                        symbol,
                                        signal: analysis.finalSignal,
                                        entryTime: new Date(),
                                        entryPrice: result.trade.entryPrice,
                                        stopPrice: result.trade.stopPrice,
                                        targetPrice: result.trade.targetPrice,
                                        confidence: analysis.confidence,
                                        positionSize: result.trade.positionSize,
                                        krakenOrderIds: result.trade.krakenOrderIds || null
                                    });

                                    botState.tradesThisSession++;
                                }
                            }
                        }

                        botState.lastCandleTimeMap[symbol] = currentCandleTime;
                    }

                    // Check exit signals (simulated mode only — live uses Kraken reconciliation)
                    if (botState.executionMode !== 'LIVE') {
                        const exitSignals = positionManager.checkExitSignals(currentPrice);
                        for (const exitTrade of exitSignals) {
                            if (exitTrade.trade.symbol === symbol) {
                                const closedResult = positionManager.closePosition(exitTrade.tradeId, currentPrice);
                                if (closedResult.success) {
                                    console.log(`[${timestamp}] 🎯 POSITION CLOSED (SIMULATED)`);
                                    console.log(`   Symbol: ${symbol}`);
                                    console.log(`   Exit Price: $${(currentPrice || 0).toFixed(2)}`);
                                    console.log(`   P&L: $${closedResult.trade.profitLoss.toFixed(2)} (${closedResult.trade.profitLossPercent.toFixed(2)}%)\n`);

                                    dataLogger.closeTrade(
                                        exitTrade.tradeId,
                                        currentPrice,
                                        exitTrade.reason,
                                        closedResult.trade.profitLoss,
                                        closedResult.trade.profitLossPercent
                                    );
                                }
                            }
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
