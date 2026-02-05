/**
 * Quick Backtest Runner with Parameter Variations
 * Run different backtest scenarios to optimize strategy parameters
 * 
 * Usage: node quick-backtest.js [scenario]
 * Scenarios: conservative, moderate, aggressive, or a JSON config string
 */

require('dotenv').config();
const ccxt = require('ccxt');
const { analyzeForScalping, analyzeForSwinging } = require('../shared/unified-analysis');
const PositionManager = require('../shared/risk-manager');
const dataLogger = require('../shared/data-logger');
const config = require('../shared/config');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Predefined scenarios
const scenarios = {
    conservative: {
        name: '🛡️  CONSERVATIVE',
        minConfidenceThreshold: 80,
        riskPerTrade: 0.10,
        takeProfitRatio: 2.8,
        maxPositions: 2,
        candleInterval: '5m',
        stopMultiplier: 2.5
    },
    optimized: {
        name: '⭐ OPTIMIZED (NEW)',
        minConfidenceThreshold: 75,
        riskPerTrade: 0.12,
        takeProfitRatio: 3.0,
        maxPositions: 3,
        candleInterval: '5m',
        stopMultiplier: 2.3
    },
    moderate: {
        name: '⚖️  MODERATE',
        minConfidenceThreshold: 55,
        riskPerTrade: 0.05,
        takeProfitRatio: 2.0,
        maxPositions: 2,
        candleInterval: '5m',
        stopMultiplier: 1.8
    },
    aggressive: {
        name: '🚀 AGGRESSIVE',
        minConfidenceThreshold: 50,
        riskPerTrade: 0.08,
        takeProfitRatio: 2.2,
        maxPositions: 3,
        candleInterval: '5m',
        stopMultiplier: 1.6,
        enableDebug: true  // Enable debug for first 5 signals
    },
    hourly: {
        name: '⏰ HOURLY',
        minConfidenceThreshold: 70,
        riskPerTrade: 0.10,
        takeProfitRatio: 3.0,
        maxPositions: 2,
        candleInterval: '1h',
        stopMultiplier: 3.0
    },
    fourhour: {
        name: '📅 FOUR HOUR',
        minConfidenceThreshold: 75,
        riskPerTrade: 0.10,
        takeProfitRatio: 3.5,
        maxPositions: 2,
        candleInterval: '4h',
        stopMultiplier: 3.5
    },
    swing: {
        name: '🌊 SWING (4H Harmonics)',
        minConfidenceThreshold: 45,
        riskPerTrade: 0.15,
        takeProfitRatio: 3.0,
        maxPositions: 3,
        candleInterval: '4h',
        stopMultiplier: 3.0,
        useSwingAnalysis: true
    }
};

async function runBacktestWithScenario(scenarioConfig) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 BACKTEST: ${scenarioConfig.name}`);
    console.log(`   Confidence: ${scenarioConfig.minConfidenceThreshold}%`);
    console.log(`   Risk/Trade: ${(scenarioConfig.riskPerTrade * 100).toFixed(1)}%`);
    console.log(`   Profit Target: ${scenarioConfig.takeProfitRatio.toFixed(1)}x`);
    console.log(`   Max Positions: ${scenarioConfig.maxPositions}`);
    console.log(`   Candle Interval: ${scenarioConfig.candleInterval}`);
    console.log(`${'='.repeat(60)}\n`);

    const exchange = new ccxt.kraken({
        'enableRateLimit': true,
        'apiKey': process.env.KRAKEN_KEY,
        'secret': process.env.KRAKEN_SECRET
    });

    // Initialize position manager with custom risk parameters
    const riskParams = {
        maxPositions: scenarioConfig.maxPositions,
        riskPerTrade: scenarioConfig.riskPerTrade,
        takeProfitRatio: scenarioConfig.takeProfitRatio,
        takeProfitRatioHigh: scenarioConfig.takeProfitRatio + 0.7,
        takeProfitRatioLow: scenarioConfig.takeProfitRatio - 0.4,
        confidenceHigh: 70,
        confidenceLow: 45,
        maxDrawdown: 0.05,
        accountBalance: 10000
    };

    const positionManager = new PositionManager(riskParams);
    dataLogger.resetData(positionManager.accountBalance);

    const tradingSymbols = config.tradingSymbols;

    const lastCandleTimeMap = {};
    let lastLoggedCandleTime = null;
    tradingSymbols.forEach(symbol => {
        lastCandleTimeMap[symbol] = null;
    });

    const stats = {
        totalSignals: 0,
        validSignals: 0,
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
        console.log('📥 Fetching historical data...');
        const ohlcvDataMap = {};
        
        for (const symbol of tradingSymbols) {
            try {
                const ohlcv = await exchange.fetchOHLCV(
                    symbol,
                    scenarioConfig.candleInterval,
                    undefined,
                    1000
                );
                ohlcvDataMap[symbol] = ohlcv;
                console.log(`   ✓ ${symbol}: ${ohlcv.length} candles`);
            } catch (err) {
                console.error(`   ❌ ${symbol}: ${err.message}`);
            }
        }

        const candleCounts = Object.values(ohlcvDataMap).map(data => data.length);
        if (candleCounts.length === 0) {
            throw new Error('No historical data fetched. Check symbols and exchange settings.');
        }
        const minCandleCount = Math.min(...candleCounts);
        console.log(`\n🔄 Processing ${minCandleCount} candles...\n`);

        // Process candles silently (no verbose logging)
        for (let candleIndex = 100; candleIndex < minCandleCount; candleIndex++) {
            try {
                for (const symbol of tradingSymbols) {
                    try {
                        const ohlcv = ohlcvDataMap[symbol];
                        const currentCandle = ohlcv[candleIndex];
                        const currentCandleTime = currentCandle[0];
                        const currentPrice = currentCandle[4];

                        if (currentCandleTime !== lastCandleTimeMap[symbol]) {
                            const analysis = scenarioConfig.useSwingAnalysis
                                ? analyzeForSwinging(ohlcv.slice(0, candleIndex), {
                                    minConfidenceThreshold: scenarioConfig.minConfidenceThreshold
                                })
                                : analyzeForScalping(ohlcv.slice(0, candleIndex), {
                                    minConfidenceThreshold: scenarioConfig.minConfidenceThreshold
                                });

                            stats.totalSignals++;
                            
                            // Debug first 5 signals
                            if (scenarioConfig.enableDebug && stats.totalSignals <= 5) {
                                console.log(`\n🔍 Debug Signal #${stats.totalSignals}:`);
                                console.log(`   Symbol: ${symbol}`);
                                console.log(`   Signal: ${analysis.finalSignal}`);
                                console.log(`   Confidence: ${analysis.confidence}%`);
                                console.log(`   Meets Threshold: ${analysis.meetsThreshold}`);
                                console.log(`   Candlestick: ${analysis.signals.candlesticks?.signal} (${analysis.scores.candlesticks})`);
                                console.log(`   Indicators: ${analysis.signals.indicators?.signal} (${analysis.scores.indicators})`);
                                console.log(`   Harmonics Valid: ${analysis.signals.harmonics?.isValid}`);
                                console.log(`   Fib Support: ${analysis.signals.fibonacci?.hasSupport}`);
                            }

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

                            // Check exits
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

                                    dataLogger.closeTrade(
                                        exit.tradeId,
                                        exit.exitPrice,
                                        exit.reason,
                                        trade.profitLoss,
                                        trade.profitLossPercent
                                    );
                                }
                            });

                            dataLogger.updateStats({
                                currentBalance: positionManager.accountBalance,
                                totalReturn: ((positionManager.accountBalance - positionManager.initialBalance) / positionManager.initialBalance) * 100
                            });

                            // Check entries
                            if (analysis.meetsThreshold && analysis.finalSignal !== 'NEUTRAL') {
                                stats.validSignals++;
                                
                                // Debug logging for first few valid signals
                                if (stats.validSignals <= 3) {
                                    console.log(`\n🔍 Valid Signal #${stats.validSignals}:`);
                                    console.log(`   Symbol: ${symbol}`);
                                    console.log(`   Signal: ${analysis.finalSignal}`);
                                    console.log(`   Confidence: ${analysis.confidence}%`);
                                }
                                
                                const closedCandle = ohlcv[candleIndex - 1];
                                const candleRange = closedCandle[2] - closedCandle[3];
                                
                                // Use scenario-specific stop multiplier when provided
                                const stopMultiplier = typeof scenarioConfig.stopMultiplier === 'number'
                                    ? scenarioConfig.stopMultiplier
                                    : (scenarioConfig.candleInterval === '5m' ? 2.0 : 1.5);
                                const stopLossDistance = candleRange * stopMultiplier;
                                
                                let stopPrice, entryPrice = currentPrice;

                                if (analysis.finalSignal === 'BULLISH') {
                                    stopPrice = closedCandle[3] - stopLossDistance;
                                } else {
                                    stopPrice = closedCandle[2] + stopLossDistance;
                                }
                                
                                if (stats.validSignals <= 3) {
                                    console.log(`   Entry: $${entryPrice.toFixed(2)} | Stop: $${stopPrice.toFixed(2)}`);
                                    console.log(`   Stop Distance: $${Math.abs(entryPrice - stopPrice).toFixed(2)}`);
                                }

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
                                        stats.tradesOpened++;
                                    } else if (tradeResult.error && stats.tradesOpened === 0 && stats.validSignals < 5) {
                                        console.log(`❌ Trade rejected: ${tradeResult.error}`);
                                    }
                                    
                                    if (tradeResult.success) {
                                        dataLogger.logTrade({
                                            id: tradeResult.trade.id,
                                            symbol: tradeResult.trade.symbol,
                                            signal: tradeResult.trade.signal,
                                            entryTime: tradeResult.trade.timestamp,
                                            entryPrice: tradeResult.trade.entryPrice,
                                            stopPrice: tradeResult.trade.stopPrice,
                                            targetPrice: tradeResult.trade.targetPrice,
                                            confidence: tradeResult.trade.confidence,
                                            positionSize: tradeResult.trade.positionSize,
                                            pattern: analysis.signals.candlesticks?.pattern,
                                            indicators: analysis.signals.indicators?.signal
                                        });
                                    }
                                } else if (stats.tradesOpened === 0 && stats.validSignals < 5) {
                                    console.log(`❌ Sizing failed: ${sizing.error}`);
                                }
                            }

                            lastCandleTimeMap[symbol] = currentCandleTime;
                            stats.processedCandles++;
                        }
                    } catch (symbolError) {
                        // Silent error handling during backtest
                    }
                }
            } catch (error) {
                // Silent error handling during backtest
            }
        }

        // Print Results
        console.log(`${'─'.repeat(60)}`);
        console.log(`RESULTS:\n`);
        console.log(`📈 Signals:`);
        console.log(`   Total: ${stats.totalSignals} | Valid: ${stats.validSignals} (${((stats.validSignals/stats.totalSignals)*100).toFixed(1)}%)`);
        console.log(`\n💼 Trades:`);
        console.log(`   Opened: ${stats.tradesOpened} | Closed: ${stats.tradesClosed}`);
        console.log(`   Winners: ${stats.winners} | Losers: ${stats.losers}`);
        if (stats.tradesClosed > 0) {
            console.log(`   Win Rate: ${((stats.winners/stats.tradesClosed)*100).toFixed(2)}%`);
        }
        console.log(`\n💰 P&L:`);
        const netProfit = positionManager.accountBalance - stats.startBalance;
        const returnPercent = (netProfit / stats.startBalance * 100).toFixed(2);
        console.log(`   Start: $${stats.startBalance.toFixed(2)} | End: $${positionManager.accountBalance.toFixed(2)}`);
        console.log(`   Net: $${netProfit.toFixed(2)} (${returnPercent}%)\n`);

        return {
            scenario: scenarioConfig.name,
            winRate: stats.tradesClosed > 0 ? (stats.winners / stats.tradesClosed * 100).toFixed(2) : 0,
            totalReturn: returnPercent,
            tradesOpened: stats.tradesOpened
        };

    } catch (error) {
        console.error("❌ Error:", error.message);
    }
}

async function main() {
    const arg = process.argv[2] || 'moderate';
    let scenarioConfig;

    if (scenarios[arg]) {
        scenarioConfig = scenarios[arg];
    } else if (arg === 'all') {
        console.log('\n🧪 Running ALL scenarios for comparison...\n');
        const results = [];
        for (const [key, scenario] of Object.entries(scenarios)) {
            const result = await runBacktestWithScenario(scenario);
            results.push(result);
            await sleep(1000);
        }
        
        console.log(`\n${'='.repeat(60)}`);
        console.log('📊 COMPARISON SUMMARY');
        console.log(`${'='.repeat(60)}\n`);
        const safeResults = results.filter(Boolean);
        safeResults.forEach((r, i) => {
            console.log(`${i + 1}. ${r.scenario}`);
            console.log(`   Win Rate: ${r.winRate}% | Return: ${r.totalReturn}% | Trades: ${r.tradesOpened}`);
        });
        console.log();
        return;
    } else {
        console.log(`\n⚠️  Unknown scenario: ${arg}`);
        console.log(`\nAvailable scenarios:`);
        console.log(`  - conservative  (safer, fewer trades)`);
        console.log(`  - moderate      (balanced)`);
        console.log(`  - aggressive    (more trades, higher risk)`);
        console.log(`  - all           (run all scenarios)\n`);
        process.exit(1);
    }

    await runBacktestWithScenario(scenarioConfig);
}

main();
