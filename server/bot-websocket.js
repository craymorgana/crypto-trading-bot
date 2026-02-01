require('dotenv').config();
const ccxt = require('ccxt');
const KrakenWebSocket = require('./websocket-handler');
const { analyzeForScalping } = require('./unified-analysis');
const PositionManager = require('./risk-manager');
const dataLogger = require('./data-logger');
const config = require('./config');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runBot() {
    const exchange = new ccxt.kraken({
        'enableRateLimit': true,
        'apiKey': process.env.BINANCE_US_KEY,
        'secret': process.env.BINANCE_US_SECRET
    });

    // Initialize position manager with risk parameters
    const positionManager = new PositionManager(config.riskParams);

    // Initialize data logger with starting balance
    // TODO: FUTURE - Fetch real account balance from Coinbase API here
    // const balance = await exchange.fetchBalance();
    // positionManager.accountBalance = balance.total['USD'];
    dataLogger.resetData(positionManager.accountBalance);

    // Track last candle time per symbol to detect new candles
    const lastCandleTimeMap = {};
    let lastLoggedCandleTime = null;
    config.tradingSymbols.forEach(symbol => {
        lastCandleTimeMap[symbol] = null;
    });

    console.log(`\n🚀 Starting SCALPING BOT for MULTIPLE PAIRS`);
    console.log(`📊 Trading Pairs: ${config.tradingSymbols.join(', ')}`);
    console.log(`📊 Exchange: Kraken (WebSocket)`);
    console.log(`🎯 Max Positions: ${positionManager.config.maxPositions}`);
    console.log(`💰 Risk Per Trade: ${positionManager.config.riskPerTrade * 100}%`);
    console.log(`📈 Dashboard: http://localhost:3000`);
    console.log(`=`.repeat(50));

    // Register immediate close trade handler
    const { registerCloseTradeHandler } = require('./dashboard');
    registerCloseTradeHandler(async (tradeId) => {
        const tradeToClose = positionManager.positions.find(t => t.id === tradeId);
        
        if (!tradeToClose) {
            return { success: false, error: 'Trade not found' };
        }

        try {
            const ticker = await exchange.fetchTicker(tradeToClose.symbol);
            const currentPrice = ticker.last;

            const result = positionManager.closePosition(tradeId, currentPrice);

            if (result.success) {
                const trade = result.trade;
                console.log(`✅ Manually closed ${trade.symbol} at ${currentPrice}`);

                dataLogger.closeTrade(
                    tradeId,
                    currentPrice,
                    'MANUAL_CLOSE',
                    trade.profitLoss,
                    trade.profitLossPercent
                );

                // Update account stats immediately
                dataLogger.updateStats({
                    currentBalance: positionManager.accountBalance,
                    availableBalance: positionManager.getAvailableBalance(),
                    totalReturn: ((positionManager.accountBalance - positionManager.initialBalance) / positionManager.initialBalance) * 100
                });

                return { success: true, trade };
            } else {
                return { success: false, error: result.error };
            }
        } catch (err) {
            console.error(`❌ Error closing trade: ${err.message}`);
            return { success: false, error: err.message };
        }
    });

    // Initialize WebSocket
    const ws = new KrakenWebSocket(config);

    try {
        await ws.connect();
    } catch (error) {
        console.error('Failed to connect WebSocket:', error.message);
        process.exit(1);
    }

    // Handle price updates from WebSocket
    ws.on('price_update', async (priceData) => {
        const symbol = priceData.symbol;
        const currentPrice = priceData.price;

        try {
            // 1. Fetch OHLCV data for analysis (need 100+ for technical indicators)
            const ohlcv = await exchange.fetchOHLCV(symbol, config.analysisParams.candleInterval, undefined, config.analysisParams.ohlcvHistory);

            const currentCandle = ohlcv[ohlcv.length - 1];
            const currentCandleTime = currentCandle[0];

            // 2. Only run analysis if a new candle has closed
            if (currentCandleTime !== lastCandleTimeMap[symbol]) {
                // Log candle close once per close time
                if (currentCandleTime !== lastLoggedCandleTime) {
                    console.log(`\n🕯️  New candle close detected on kraken [${new Date(currentCandleTime).toLocaleTimeString()}]`);
                    console.log(`================`);
                    lastLoggedCandleTime = currentCandleTime;
                }

                // Run unified analysis on closed candles
                const analysis = analyzeForScalping(ohlcv.slice(0, -1), {
                    minConfidenceThreshold: config.analysisParams.minConfidenceThreshold
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

                // 4. Check for new entry signals
                if (analysis.meetsThreshold && analysis.finalSignal !== 'NEUTRAL') {
                    const closedCandle = ohlcv[ohlcv.length - 2];
                    const entryPrice = currentCandle[4]; // Use current candle close price

                    // Calculate ATR for stop loss (simplified: 1.5x current candle range)
                    const candleRange = closedCandle[2] - closedCandle[3];
                    const stopLossDistance = candleRange * 1.5;

                    let stopPrice;

                    if (analysis.finalSignal === 'BULLISH') {
                        stopPrice = closedCandle[3] - stopLossDistance; // Below the low
                    } else {
                        stopPrice = closedCandle[2] + stopLossDistance; // Above the high
                    }

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
    });

    // Handle heartbeats to keep connection alive
    ws.on('heartbeat', (data) => {
        // Connection is alive, no action needed
    });

    // Also check for candle closes on a timer to catch missed updates
    setInterval(async () => {
        for (const symbol of config.tradingSymbols) {
            try {
                const ohlcv = await exchange.fetchOHLCV(symbol, config.analysisParams.candleInterval, undefined, config.analysisParams.ohlcvHistory);
                const currentCandle = ohlcv[ohlcv.length - 1];
                const currentCandleTime = currentCandle[0];
                const currentPrice = currentCandle[4];

                // Check if this is a new candle
                if (currentCandleTime !== lastCandleTimeMap[symbol]) {
                    // Log candle close once per close time
                    if (currentCandleTime !== lastLoggedCandleTime) {
                        console.log(`\n🕯️  New candle close detected on coinbase [${new Date(currentCandleTime).toLocaleTimeString()}]`);
                        console.log(`================`);
                        lastLoggedCandleTime = currentCandleTime;
                    }

                    // Run unified analysis on closed candles
                    const analysis = analyzeForScalping(ohlcv.slice(0, -1), {
                        minConfidenceThreshold: config.analysisParams.minConfidenceThreshold
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

                    // 4. Check for new entry signals
                    if (analysis.meetsThreshold && analysis.finalSignal !== 'NEUTRAL') {
                        const closedCandle = ohlcv[ohlcv.length - 2];

                        // Calculate ATR for stop loss (simplified: 1.5x current candle range)
                        const candleRange = closedCandle[2] - closedCandle[3];
                        const stopLossDistance = candleRange * 1.5;

                        let stopPrice, entryPrice = currentPrice;

                        if (analysis.finalSignal === 'BULLISH') {
                            stopPrice = closedCandle[3] - stopLossDistance; // Below the low
                        } else {
                            stopPrice = closedCandle[2] + stopLossDistance; // Above the high
                        }

                        // Calculate position size and check if we can enter
                        const sizing = positionManager.calculatePositionSize(entryPrice, stopPrice, analysis.finalSignal);

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
            } catch (error) {
                console.error(`❌ Error checking candles for ${symbol}: ${error.message}`);
            }
        }
    }, config.analysisParams.checkInterval);

    // Handle heartbeats to keep connection alive
    ws.on('heartbeat', (data) => {
        // Connection is alive, no action needed
    });

    // Check for commands every 2 seconds
    setInterval(async () => {
        const pendingCommands = dataLogger.getPendingCommands();
        for (const cmd of pendingCommands) {
            if (cmd.type === 'CLOSE_POSITION') {
                // Mark as processed immediately to prevent duplicate execution
                dataLogger.markCommandProcessed(cmd.id, { success: false, error: 'Processing...' });
                
                console.log(`\n👨‍💻 Manual close requested for trade ${cmd.tradeId}`);

                // Find trade in active positions
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

                            // Update account stats immediately after closing
                            dataLogger.updateStats({
                                currentBalance: positionManager.accountBalance,
                                availableBalance: positionManager.getAvailableBalance(),
                                totalReturn: ((positionManager.accountBalance - positionManager.initialBalance) / positionManager.initialBalance) * 100
                            });

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
            }
        }
    }, 2000);

    // Keep the bot running
    await new Promise(() => {
        // This never resolves, keeping the process alive
    });
}

runBot();
