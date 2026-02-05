require('dotenv').config();
const ccxt = require('ccxt');
const { analyzeForScalping } = require('../shared/unified-analysis');
const PositionManager = require('../shared/risk-manager');
const dataLogger = require('../shared/data-logger');
const config = require('../shared/config');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runBacktest() {
    console.log(`\n🚀 Starting BACKTEST SIMULATION`);
    console.log(`📊 Trading Pairs: ${config.tradingSymbols.join(', ')}`);
    console.log(`📈 Exchange: Kraken (Historical Data)`);
    console.log(`🎯 Max Positions: ${config.riskParams.maxPositions}`);
    console.log(`💰 Risk Per Trade: ${config.riskParams.riskPerTrade * 100}%`);
    console.log(`📊 Starting Balance: $${config.riskParams.accountBalance}`);
    console.log(`=`.repeat(50));

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

    // Statistics tracking
    const stats = {
        totalSignals: 0,
        validSignals: 0,
        bullishSignals: 0,
        bearishSignals: 0,
        tradesOpened: 0,
        tradesClosed: 0,
        winners: 0,
        losers: 0,
        totalProfit: 0,
        totalLoss: 0,
        startBalance: positionManager.accountBalance,
        processedCandles: 0
    };

    try {
        // Fetch historical data for each symbol
        console.log('\n📥 Fetching historical data for all symbols...');
        const ohlcvDataMap = {};
        
        for (const symbol of config.tradingSymbols) {
            try {
                console.log(`   Fetching ${symbol}...`);
                const ohlcv = await exchange.fetchOHLCV(
                    symbol,
                    config.analysisParams.candleInterval,
                    undefined,
                    config.analysisParams.ohlcvHistory * 5  // Get 5x more candles for backtesting
                );
                ohlcvDataMap[symbol] = ohlcv;
                console.log(`   ✓ ${symbol}: ${ohlcv.length} candles loaded`);
            } catch (err) {
                console.error(`   ❌ Error fetching ${symbol}: ${err.message}`);
            }
        }

            const candleCounts = Object.values(ohlcvDataMap).map(data => data.length);
            if (candleCounts.length === 0) {
                throw new Error('No historical data fetched. Check symbols and exchange settings.');
            }
            const minCandleCount = Math.min(...candleCounts);
            console.log(`\n🔄 Processing ${minCandleCount} candles across all symbols...`);
        console.log(`=`.repeat(50));

        // Simulate candle-by-candle processing
        for (let candleIndex = config.analysisParams.ohlcvHistory; candleIndex < minCandleCount; candleIndex++) {
            try {
                // Process all symbols for this candle index
                for (const symbol of config.tradingSymbols) {
                    try {
                        const ohlcv = ohlcvDataMap[symbol];
                        const currentCandle = ohlcv[candleIndex];
                        const currentCandleTime = currentCandle[0];
                        const currentPrice = currentCandle[4];

                        // 2. Only run analysis if a new candle has closed
                        if (currentCandleTime !== lastCandleTimeMap[symbol]) {
                            // Log candle close once per close time
                            if (currentCandleTime !== lastLoggedCandleTime) {
                                console.log(`\n🕯️  Candle ${candleIndex} | Time: ${new Date(currentCandleTime).toLocaleString()}`);
                                console.log(`================`);
                                lastLoggedCandleTime = currentCandleTime;
                            }

                            // Run unified analysis on closed candles (slice to exclude current)
                            const analysis = analyzeForScalping(ohlcv.slice(0, candleIndex), {
                                minConfidenceThreshold: config.analysisParams.minConfidenceThreshold
                            });

                            stats.totalSignals++;
                            if (analysis.finalSignal === 'BULLISH') stats.bullishSignals++;
                            if (analysis.finalSignal === 'BEARISH') stats.bearishSignals++;

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
                                    stats.tradesClosed++;

                                    if (trade.profitLoss > 0) {
                                        stats.winners++;
                                        stats.totalProfit += trade.profitLoss;
                                    } else {
                                        stats.losers++;
                                        stats.totalLoss += Math.abs(trade.profitLoss);
                                    }

                                    console.log(`   ✅ CLOSED ${exit.reason}: ${symbol} @ $${exit.exitPrice.toFixed(2)} | P&L: ${trade.profitLossPercent >= 0 ? '+' : ''}${trade.profitLossPercent.toFixed(2)}%`);

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
                                stats.validSignals++;
                                const closedCandle = ohlcv[candleIndex - 1];

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
                                        stats.tradesOpened++;

                                        console.log(`\n   📈 SIGNAL: ${analysis.finalSignal} | ${symbol}`);
                                        console.log(`      Pattern: ${analysis.signals.candlesticks?.pattern || 'N/A'}`);
                                        console.log(`      Entry: $${entryPrice.toFixed(2)} | Stop: $${stopPrice.toFixed(2)} | Target: $${trade.targetPrice.toFixed(2)}`);
                                        console.log(`      Confidence: ${analysis.confidence.toFixed(1)}% | Size: ${trade.positionSize.toFixed(8)} units`);

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
                                    } else if (!sizing.error) {
                                        console.log(`   ⚠️  Could not open position: ${tradeResult.error}`);
                                    }
                                }
                            }

                            lastCandleTimeMap[symbol] = currentCandleTime;
                            stats.processedCandles++;
                        }
                    } catch (symbolError) {
                        console.error(`   ❌ Error processing ${symbol}: ${symbolError.message}`);
                    }
                }

            } catch (error) {
                console.error("❌ Candle Processing Error: ", error.message);
            }
        }

        // Final Summary
        console.log(`\n\n${'='.repeat(50)}`);
        console.log(`📊 BACKTEST SUMMARY`);
        console.log(`${'='.repeat(50)}`);
        console.log(`\n📈 Trading Statistics:`);
        console.log(`   Candles Processed: ${stats.processedCandles}`);
        console.log(`   Total Signals: ${stats.totalSignals}`);
        console.log(`   Valid Signals (met threshold): ${stats.validSignals}`);
        console.log(`     - Bullish: ${stats.bullishSignals}`);
        console.log(`     - Bearish: ${stats.totalSignals - stats.bullishSignals - (stats.totalSignals - stats.bullishSignals - stats.bearishSignals)}`);
        console.log(`\n💼 Trade Performance:`);
        console.log(`   Trades Opened: ${stats.tradesOpened}`);
        console.log(`   Trades Closed: ${stats.tradesClosed}`);
        console.log(`   Winners: ${stats.winners}`);
        console.log(`   Losers: ${stats.losers}`);
        
        if (stats.tradesClosed > 0) {
            const winRate = (stats.winners / stats.tradesClosed * 100).toFixed(2);
            console.log(`   Win Rate: ${winRate}%`);
        }

        console.log(`\n💰 P&L Summary:`);
        console.log(`   Starting Balance: $${stats.startBalance.toFixed(2)}`);
        console.log(`   Ending Balance: $${positionManager.accountBalance.toFixed(2)}`);
        console.log(`   Total Profit: $${stats.totalProfit.toFixed(2)}`);
        console.log(`   Total Loss: $${stats.totalLoss.toFixed(2)}`);
        const netProfit = positionManager.accountBalance - stats.startBalance;
        const returnPercent = (netProfit / stats.startBalance * 100).toFixed(2);
        console.log(`   Net P&L: $${netProfit.toFixed(2)} (${returnPercent}%)`);

        console.log(`\n✅ Backtest Complete!\n`);

    } catch (error) {
        console.error("❌ Backtest Error: ", error.message);
        console.error(error);
    }
}

runBacktest();
