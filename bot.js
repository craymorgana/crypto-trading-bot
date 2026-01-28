require('dotenv').config();
const ccxt = require('ccxt');
const { analyzeForScalping, formatAnalysis } = require('./unified-analysis');
const PositionManager = require('./risk-manager');
const dataLogger = require('./data-logger');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runBot() {
    const exchange = new ccxt.binanceus({
        'enableRateLimit': true,
        'apiKey': process.env.BINANCE_US_KEY,
        'secret': process.env.BINANCE_US_SECRET
    });

    // Initialize position manager with risk parameters
    const positionManager = new PositionManager({
        maxPositions: 3,
        riskPerTrade: 0.02, // 2% risk per trade
        takeProfitRatio: 1.5, // 1.5:1 risk/reward
        maxDrawdown: 0.05, // 5% max drawdown
        accountBalance: 1000 // Starting balance
    });

    // Initialize data logger with starting balance
    dataLogger.resetData(positionManager.accountBalance);

    let lastCandleTime = null;
    
    console.log(`\n🚀 Starting SCALPING BOT for ${process.env.SYMBOL}`);
    console.log(`📊 Analysis Interval: 3-minute candles`);
    console.log(`🎯 Max Positions: ${positionManager.config.maxPositions}`);
    console.log(`💰 Risk Per Trade: ${positionManager.config.riskPerTrade * 100}%`);
    console.log(`📈 Dashboard: http://localhost:3000`);
    console.log(`=`.repeat(50));

    while (true) {
        try {
            // 1. Fetch OHLCV data (need 100+ for technical indicators)
            const ohlcv = await exchange.fetchOHLCV(process.env.SYMBOL, '3m', undefined, 100);
            
            const currentCandle = ohlcv[ohlcv.length - 1];
            const closedCandle = ohlcv[ohlcv.length - 2];
            const currentCandleTime = currentCandle[0];
            const currentPrice = currentCandle[4];

            // 2. Only run analysis if a new candle has closed
            if (currentCandleTime !== lastCandleTime) {
                
                // Run unified analysis on closed candles
                const analysis = analyzeForScalping(ohlcv.slice(0, -1), {
                    minConfidenceThreshold: 60
                });

                // Log signal to data logger
                dataLogger.logSignal({
                    symbol: process.env.SYMBOL,
                    signal: analysis.finalSignal,
                    confidence: analysis.confidence,
                    pattern: analysis.signals.candlesticks?.pattern,
                    indicators: analysis.signals.indicators,
                    fibonacci: analysis.signals.fibonacci?.hasSupport,
                    harmonics: analysis.signals.harmonics?.isValid,
                    meetsThreshold: analysis.meetsThreshold
                });

                console.log(formatAnalysis(analysis));

                // 3. Check exit signals for open positions
                const exitSignals = positionManager.checkExitSignals(currentPrice);
                exitSignals.forEach(exit => {
                    const result = positionManager.closePosition(exit.tradeId, exit.exitPrice);
                    if (result.success) {
                        const trade = result.trade;
                        console.log(`\n✅ TRADE CLOSED [${exit.reason}]`);
                        console.log(`   Entry: $${trade.entryPrice.toFixed(2)} → Exit: $${exit.exitPrice.toFixed(2)}`);
                        console.log(`   P&L: $${trade.profitLoss.toFixed(2)} (${trade.profitLossPercent.toFixed(2)}%)`);

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
                    const prevCandle = ohlcv[ohlcv.length - 3];
                    
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
                            symbol: process.env.SYMBOL,
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
                            console.log(`\n🟢 NEW TRADE OPENED [${analysis.finalSignal}]`);
                            console.log(`   Entry: $${trade.entryPrice.toFixed(2)}`);
                            console.log(`   Stop:  $${trade.stopPrice.toFixed(2)}`);
                            console.log(`   Target: $${trade.targetPrice.toFixed(2)}`);
                            console.log(`   Size: ${trade.positionSize.toFixed(4)} | Risk: $${trade.riskAmount.toFixed(2)}`);
                            console.log(`   Confidence: ${trade.confidence}%`);

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
                                pattern: analysis.signals.candlesticks?.pattern,
                                indicators: analysis.signals.indicators?.signal
                            });
                        } else {
                            console.log(`⚠️  Trade rejected: ${tradeResult.error}`);
                        }
                    }
                }

                // 5. Log performance stats every 10 candles
                if (lastCandleTime && (lastCandleTime / 3 / 10) % 10 === 0) {
                    const stats = positionManager.getPerformanceStats();
                    console.log(`\n📈 PERFORMANCE: ${stats.totalTrades} trades | Win Rate: ${stats.winRate} | Return: ${stats.totalReturn}`);
                }

                lastCandleTime = currentCandleTime;
            } else {
                // Heartbeat
                process.stdout.write("."); 
            }

            // Check every 10 seconds
            await sleep(10000);

        } catch (error) {
            console.error("❌ Loop Error: ", error.message);  
            await sleep(5000); 
        }
    }
}

runBot();