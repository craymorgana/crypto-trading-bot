require('dotenv').config();
const ccxt = require('ccxt');
const { analyzeForScalping, analyzeForSwinging, formatAnalysis } = require('../shared/unified-analysis');
const PositionManager = require('../shared/risk-manager');
const dataLogger = require('../shared/data-logger');
const config = require('../shared/config');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const botState = {
    paused: false,
    mode: 'SCALPING'
};

const applyRiskParams = (positionManager, params) => {
    if (!params) return;
    Object.keys(params).forEach(key => {
        positionManager.config[key] = params[key];
    });
};

async function runBot() {
    const exchange = new ccxt.kraken({
        'enableRateLimit': true,
        'apiKey': process.env.KRAKEN_KEY,
        'secret': process.env.KRAKEN_SECRET
    });

    // Initialize position manager with risk parameters
    const positionManager = new PositionManager(config.riskParams);

    // Initialize data logger with starting balance
    dataLogger.resetData(positionManager.accountBalance);

    // Track last candle time per symbol to detect new candles
    const lastCandleTimeMap = {};
    let lastLoggedCandleTime = null;
    config.tradingSymbols.forEach(symbol => {
        lastCandleTimeMap[symbol] = null;
    });

    console.log(`\n🚀 Starting SCALPING BOT for MULTIPLE PAIRS`);
    console.log(`📊 Trading Pairs: ${config.tradingSymbols.join(', ')}`);
    console.log(`📊 Exchange: Kraken`);
    console.log(`🎯 Max Positions: ${positionManager.config.maxPositions}`);
    console.log(`💰 Risk Per Trade: ${positionManager.config.riskPerTrade * 100}%`);
    console.log(`📈 Dashboard: http://localhost:3000`);
    console.log(`=`.repeat(50));

    while (true) {
        try {
            // Process all trading symbols
            for (const symbol of config.tradingSymbols) {
                try {
                    // 1. Fetch OHLCV data (need 100+ for technical indicators)
                    const activeParams = botState.mode === 'SWING'
                        ? config.swingAnalysisParams
                        : config.analysisParams;

                    const ohlcv = await exchange.fetchOHLCV(
                        symbol,
                        activeParams.candleInterval,
                        undefined,
                        activeParams.ohlcvHistory
                    );

                    const currentCandle = ohlcv[ohlcv.length - 1];
                    const closedCandle = ohlcv[ohlcv.length - 2];
                    const currentCandleTime = currentCandle[0];
                    const currentPrice = currentCandle[4];

                    // 2. Only run analysis if a new candle has closed
                    if (currentCandleTime !== lastCandleTimeMap[symbol]) {
                        // Log candle close once per close time
                        if (currentCandleTime !== lastLoggedCandleTime) {
                            console.log(`\n🕯️  New candle close detected on kraken [${new Date(currentCandleTime).toLocaleTimeString()}]`);
                            console.log(`================`);
                            lastLoggedCandleTime = currentCandleTime;
                        }

                        // Run unified analysis on closed candles
                        const analysis = botState.mode === 'SWING'
                            ? analyzeForSwinging(ohlcv.slice(0, -1), {
                                minConfidenceThreshold: activeParams.minConfidenceThreshold
                            })
                            : analyzeForScalping(ohlcv.slice(0, -1), {
                                minConfidenceThreshold: activeParams.minConfidenceThreshold
                            });

                        // Log signal to data logger
                        dataLogger.logSignal({
                            symbol: symbol,
                            signal: analysis.finalSignal,
                            confidence: analysis.confidence,
                            pattern: analysis.signals.candlesticks?.pattern,
                            indicators: analysis.signals.indicators,
                            fibonacci: analysis.signals.fibonacci?.hasSupport,
                            harmonics: analysis.signals.harmonics?.isValid,
                            meetsThreshold: analysis.meetsThreshold
                        });

                        // 3. Check exit signals for open positions on this symbol
                        const exitSignals = positionManager.checkExitSignals(currentPrice, symbol);
                        exitSignals.forEach(exit => {
                            const result = positionManager.closePosition(exit.tradeId, exit.exitPrice);
                            if (result.success) {
                                const trade = result.trade;

                                // Log to data logger
                                dataLogger.closeTrade(
                                    exit.tradeId,
                                    exit.exitPrice,
                                    exit.reason,
                                    trade.profitLoss,
                                    trade.profitLossPercent
                                );
                            }
                        });

                        // Update account stats
                        dataLogger.updateStats({
                            currentBalance: positionManager.accountBalance,
                            totalReturn: ((positionManager.accountBalance - positionManager.initialBalance) / positionManager.initialBalance) * 100
                        });

                        // 4. Check for new entry signals (only when not paused and BULLISH only - long-only trading)
                        if (!botState.paused && analysis.meetsThreshold && analysis.finalSignal === 'BULLISH') {
                            const closedCandle = ohlcv[ohlcv.length - 2];

                            // Calculate ATR for stop loss (simplified: candle range * multiplier)
                            const candleRange = closedCandle[2] - closedCandle[3];
                            const stopLossDistance = candleRange * (activeParams.stopMultiplier || 1.5);

                            // BULLISH only: Stop below the low
                            const entryPrice = currentPrice;
                            const stopPrice = closedCandle[3] - stopLossDistance;

                            // Calculate position size and check if we can enter
                            const sizing = positionManager.calculatePositionSize(
                                entryPrice,
                                stopPrice,
                                analysis.finalSignal,
                                analysis.confidence
                            );

                            if (!sizing.error) {
                                const tradeResult = positionManager.openPosition({
                                    symbol: symbol,
                                    signal: analysis.finalSignal,
                                    entryPrice,
                                    stopPrice,
                                    confidence: analysis.confidence,
                                    analysis: {
                                        pattern: analysis.signals.candlesticks?.pattern,
                                        indicators: analysis.signals.indicators?.signal,
                                        fibonacci: analysis.signals.fibonacci?.hasSupport,
                                        harmonics: analysis.signals.harmonics?.isValid
                                    }
                                });

                                if (tradeResult.success) {
                                    const trade = tradeResult.trade;

                                    // Log to data logger
                                    dataLogger.logTrade({
                                        id: trade.id,
                                        symbol: trade.symbol,
                                        signal: trade.signal,
                                        entryTime: trade.timestamp,
                                        entryPrice: trade.entryPrice,
                                        stopPrice: trade.stopPrice,
                                        targetPrice: trade.targetPrice,
                                        confidence: trade.confidence,
                                        positionSize: trade.positionSize,
                                        pattern: analysis.signals.candlesticks?.pattern,
                                        indicators: analysis.signals.indicators?.signal
                                    });
                                }
                            }
                        }

                        lastCandleTimeMap[symbol] = currentCandleTime;

                    }
                } catch (symbolError) {
                    console.error(`❌ Error processing ${symbol}: ${symbolError.message}`);
                }
            }

            // 5. Process pending commands
            const pendingCommands = dataLogger.getPendingCommands();
            for (const cmd of pendingCommands) {
                if (cmd.type === 'CLOSE_POSITION') {
                    console.log(`\n👨‍💻 Manual close requested for trade ${cmd.tradeId}`);
                    const tradeToClose = positionManager.positions.find(t => t.id === cmd.tradeId);

                    if (tradeToClose) {
                        try {
                            const ticker = await exchange.fetchTicker(tradeToClose.symbol);
                            const currentPrice = ticker.last;
                            const result = positionManager.closePosition(cmd.tradeId, currentPrice);

                            if (result.success) {
                                const trade = result.trade;
                                console.log(`✅ Manually closed ${trade.symbol} at ${currentPrice}`);

                                dataLogger.closeTrade(
                                    cmd.tradeId,
                                    currentPrice,
                                    'MANUAL_CLOSE',
                                    trade.profitLoss,
                                    trade.profitLossPercent
                                );

                                dataLogger.markCommandProcessed(cmd.id, { success: true, trade });
                            } else {
                                console.log(`⚠️ Failed to close trade: ${result.error}`);
                                dataLogger.markCommandProcessed(cmd.id, { success: false, error: result.error });
                            }
                        } catch (err) {
                            console.error(`❌ Error fetching ticker for manual close: ${err.message}`);
                            dataLogger.markCommandProcessed(cmd.id, { success: false, error: err.message });
                        }
                    } else {
                        console.log(`⚠️ Trade ${cmd.tradeId} not found or already closed`);
                        dataLogger.markCommandProcessed(cmd.id, { success: false, error: 'Trade not found' });
                    }
                } else if (cmd.type === 'STOP_BOT') {
                    botState.paused = true;
                    console.log('⏸ Bot paused - entries disabled');
                    dataLogger.markCommandProcessed(cmd.id, { success: true, paused: true });
                } else if (cmd.type === 'START_BOT') {
                    botState.paused = false;
                    console.log('▶ Bot resumed - entries enabled');
                    dataLogger.markCommandProcessed(cmd.id, { success: true, paused: false });
                } else if (cmd.type === 'RESTART_BOT') {
                    botState.paused = false;
                    lastLoggedCandleTime = null;
                    Object.keys(lastCandleTimeMap).forEach(symbol => {
                        lastCandleTimeMap[symbol] = null;
                    });
                    console.log('🔄 Bot restart requested - state reset');
                    dataLogger.markCommandProcessed(cmd.id, { success: true, restarted: true });
                } else if (cmd.type === 'SET_MODE') {
                    const nextMode = (cmd.mode || '').toUpperCase();
                    if (['SCALPING', 'SWING'].includes(nextMode)) {
                        botState.mode = nextMode;
                        if (botState.mode === 'SWING') {
                            applyRiskParams(positionManager, config.swingRiskParams);
                        } else {
                            applyRiskParams(positionManager, config.riskParams);
                        }
                        console.log(`🧭 Trading mode set to ${botState.mode}`);
                        dataLogger.markCommandProcessed(cmd.id, { success: true, mode: botState.mode });
                    } else {
                        dataLogger.markCommandProcessed(cmd.id, { success: false, error: 'Invalid mode' });
                    }
                } else if (cmd.type === 'CANCEL_ALL_TRADES') {
                    const openTrades = [...positionManager.positions];
                    let closedCount = 0;
                    let errorCount = 0;

                    for (const trade of openTrades) {
                        try {
                            const ticker = await exchange.fetchTicker(trade.symbol);
                            const currentPrice = ticker.last;
                            const result = positionManager.closePosition(trade.id, currentPrice);

                            if (result.success) {
                                const closedTrade = result.trade;
                                dataLogger.closeTrade(
                                    trade.id,
                                    currentPrice,
                                    'CANCEL_ALL',
                                    closedTrade.profitLoss,
                                    closedTrade.profitLossPercent
                                );
                                closedCount++;
                            } else {
                                errorCount++;
                            }
                        } catch (err) {
                            errorCount++;
                        }
                    }

                    console.log(`⛔ Cancel-all completed: ${closedCount} closed, ${errorCount} errors`);
                    dataLogger.markCommandProcessed(cmd.id, { success: true, closedCount, errorCount });
                }
            }

            // Check every X seconds
            await sleep(config.analysisParams.checkInterval);

        } catch (error) {
            console.error("❌ Loop Error: ", error.message);
            await sleep(5000);
        }
    }
}

runBot();