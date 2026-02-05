/**
 * Swing Trading Backtest using Fibonacci + Harmonics on High Timeframes
 */

require('dotenv').config();
const ccxt = require('ccxt');
const { analyzeForSwinging } = require('../shared/unified-analysis');
const PositionManager = require('../shared/risk-manager');
const dataLogger = require('../shared/data-logger');
const config = require('../shared/config');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Swing trading scenarios - TARGETING 10%+ RETURNS
const swingScenarios = {
    // Current champion - baseline
    current_champion: {
        name: '🏆 CHAMPION +9.45%',
        minConfidenceThreshold: 23,
        riskPerTrade: 0.15,
        takeProfitRatio: 1.2,
        maxPositions: 7,
        candleInterval: '4h',
        stopMultiplier: 0.6,
        bullishOnly: false,
        bearishOnly: true,
        requireDivergence: false,
        requireVolume: false,
        requireTrending: false
    },
    // Lower risk, more positions
    conservative_diversified: {
        name: '🛡️ CONSERVATIVE 13%',
        minConfidenceThreshold: 23,
        riskPerTrade: 0.13,
        takeProfitRatio: 1.2,
        maxPositions: 7,
        candleInterval: '4h',
        stopMultiplier: 0.6,
        bullishOnly: false,
        bearishOnly: true,
        requireDivergence: false,
        requireVolume: false,
        requireTrending: false
    },
    // Moderate risk, more positions
    moderate_diversified: {
        name: '⚖️ MODERATE 14%',
        minConfidenceThreshold: 23,
        riskPerTrade: 0.14,
        takeProfitRatio: 1.2,
        maxPositions: 7,
        candleInterval: '4h',
        stopMultiplier: 0.6,
        bullishOnly: false,
        bearishOnly: true,
        requireDivergence: false,
        requireVolume: false,
        requireTrending: false
    },
    // Higher risk, more positions
    aggressive_diversified: {
        name: '🚀 AGGRESSIVE 16%',
        minConfidenceThreshold: 23,
        riskPerTrade: 0.16,
        takeProfitRatio: 1.2,
        maxPositions: 7,
        candleInterval: '4h',
        stopMultiplier: 0.6,
        bullishOnly: false,
        bearishOnly: true,
        requireDivergence: false,
        requireVolume: false,
        requireTrending: false
    },
    // Max risk, more positions
    ultra_diversified: {
        name: '💥 ULTRA 17%',
        minConfidenceThreshold: 23,
        riskPerTrade: 0.17,
        takeProfitRatio: 1.2,
        maxPositions: 7,
        candleInterval: '4h',
        stopMultiplier: 0.6,
        bullishOnly: false,
        bearishOnly: true,
        requireDivergence: false,
        requireVolume: false,
        requireTrending: false
    },
    // 15% with 8 positions
    max_diversified: {
        name: '🎲 MAX DIV 8 POS',
        minConfidenceThreshold: 23,
        riskPerTrade: 0.15,
        takeProfitRatio: 1.2,
        maxPositions: 8,
        candleInterval: '4h',
        stopMultiplier: 0.6,
        bullishOnly: false,
        bearishOnly: true,
        requireDivergence: false,
        requireVolume: false,
        requireTrending: false
    },
    // 15% with tighter stops
    tight_diversified: {
        name: '✂️ TIGHT 15%',
        minConfidenceThreshold: 23,
        riskPerTrade: 0.15,
        takeProfitRatio: 1.2,
        maxPositions: 7,
        candleInterval: '4h',
        stopMultiplier: 0.55,
        bullishOnly: false,
        bearishOnly: true,
        requireDivergence: false,
        requireVolume: false,
        requireTrending: false
    },
    // 16% with 8 positions
    mega_diversified: {
        name: '🎯 MEGA 16% 8POS',
        minConfidenceThreshold: 23,
        riskPerTrade: 0.16,
        takeProfitRatio: 1.2,
        maxPositions: 8,
        candleInterval: '4h',
        stopMultiplier: 0.6,
        bullishOnly: false,
        bearishOnly: true,
        requireDivergence: false,
        requireVolume: false,
        requireTrending: false
    },
    // 15% with wider stops
    wide_diversified: {
        name: '📏 WIDE 15%',
        minConfidenceThreshold: 23,
        riskPerTrade: 0.15,
        takeProfitRatio: 1.2,
        maxPositions: 7,
        candleInterval: '4h',
        stopMultiplier: 0.65,
        bullishOnly: false,
        bearishOnly: true,
        requireDivergence: false,
        requireVolume: false,
        requireTrending: false
    },
    // Perfect balance attempt
    optimal: {
        name: '⚡ OPTIMAL',
        minConfidenceThreshold: 23,
        riskPerTrade: 0.155,
        takeProfitRatio: 1.2,
        maxPositions: 7,
        candleInterval: '4h',
        stopMultiplier: 0.58,
        bullishOnly: false,
        bearishOnly: true,
        requireDivergence: false,
        requireVolume: false,
        requireTrending: false
    }
};

async function runSwingBacktest(scenarioConfig) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 SWING BACKTEST: ${scenarioConfig.name}`);
    console.log(`   Confidence: ${scenarioConfig.minConfidenceThreshold}%`);
    console.log(`   Risk/Trade: ${(scenarioConfig.riskPerTrade * 100).toFixed(1)}%`);
    console.log(`   Profit Target: ${scenarioConfig.takeProfitRatio.toFixed(1)}x`);
    console.log(`   Max Positions: ${scenarioConfig.maxPositions}`);
    console.log(`   Candle Interval: ${scenarioConfig.candleInterval}`);
    console.log(`   Stop Multiplier: ${scenarioConfig.stopMultiplier.toFixed(1)}x`);
    
    const filters = [];
    if (scenarioConfig.bullishOnly) filters.push('BULLISH ONLY');
    if (scenarioConfig.bearishOnly) filters.push('BEARISH ONLY');
    if (scenarioConfig.requireDivergence) filters.push('DIVERGENCE');
    if (scenarioConfig.requireVolume) filters.push('HIGH VOLUME');
    if (scenarioConfig.requireTrending) filters.push('TRENDING');
    console.log(`   Filters: ${filters.length > 0 ? filters.join(' + ') : 'NONE'}`);
    console.log(`${'='.repeat(60)}\n`);

    const exchange = new ccxt.kraken({
        'enableRateLimit': true,
        'apiKey': process.env.KRAKEN_KEY,
        'secret': process.env.KRAKEN_SECRET
    });

    const riskParams = {
        maxPositions: scenarioConfig.maxPositions,
        riskPerTrade: scenarioConfig.riskPerTrade,
        takeProfitRatio: scenarioConfig.takeProfitRatio,
        takeProfitRatioHigh: scenarioConfig.takeProfitRatio + 0.7,
        takeProfitRatioLow: scenarioConfig.takeProfitRatio - 0.5,
        confidenceHigh: 75,
        confidenceLow: 60,
        maxDrawdown: 0.10,
        accountBalance: 10000
    };

    const positionManager = new PositionManager(riskParams);
    dataLogger.resetData(positionManager.accountBalance);

    const tradingSymbols = config.tradingSymbols;
    const lastCandleTimeMap = {};
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
        processedCandles: 0,
        maxConcurrentPositions: 0,
        totalCapitalAllocated: 0,
        positionSnapshots: []
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
        
        // Calculate test duration
        const firstCandle = ohlcvDataMap[tradingSymbols[0]][0];
        const lastCandle = ohlcvDataMap[tradingSymbols[0]][minCandleCount - 1];
        const durationMs = lastCandle[0] - firstCandle[0];
        const durationDays = Math.floor(durationMs / (1000 * 60 * 60 * 24));
        
        console.log(`\n🔄 Processing ${minCandleCount} candles...`);
        console.log(`📅 Test Duration: ${durationDays} days (${new Date(firstCandle[0]).toLocaleDateString()} - ${new Date(lastCandle[0]).toLocaleDateString()})\n`);

        // Process candles
        for (let candleIndex = 100; candleIndex < minCandleCount; candleIndex++) {
            try {
                // Track position utilization every 10 candles
                if (candleIndex % 10 === 0) {
                    const openPositions = positionManager.positions.length;
                    stats.maxConcurrentPositions = Math.max(stats.maxConcurrentPositions, openPositions);
                    const allocatedCapital = openPositions * scenarioConfig.riskPerTrade;
                    stats.totalCapitalAllocated += allocatedCapital;
                    stats.positionSnapshots.push({
                        candle: candleIndex,
                        openPositions,
                        allocatedPercent: (allocatedCapital * 100).toFixed(1)
                    });
                }

                for (const symbol of tradingSymbols) {
                    try {
                        const ohlcv = ohlcvDataMap[symbol];
                        const currentCandle = ohlcv[candleIndex];
                        const currentCandleTime = currentCandle[0];
                        const currentPrice = currentCandle[4];

                        if (currentCandleTime !== lastCandleTimeMap[symbol]) {
                            // Use swing analysis instead of scalping
                            const analysis = analyzeForSwinging(ohlcv.slice(0, candleIndex), {
                                minConfidenceThreshold: scenarioConfig.minConfidenceThreshold
                            });

                            stats.totalSignals++;

                            dataLogger.logSignal({
                                symbol: symbol,
                                signal: analysis.finalSignal,
                                confidence: analysis.confidence,
                                pattern: null,
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
                                // Apply bullishOnly filter
                                if (scenarioConfig.bullishOnly && analysis.finalSignal !== 'BULLISH') {
                                    continue; // Skip bearish signals if bullishOnly mode
                                }

                                // Apply bearishOnly filter
                                if (scenarioConfig.bearishOnly && analysis.finalSignal !== 'BEARISH') {
                                    continue; // Skip bullish signals if bearishOnly mode
                                }
                                
                                // Apply requireDivergence filter
                                if (scenarioConfig.requireDivergence) {
                                    const hasDivergence = analysis.signals.divergence?.detected;
                                    if (!hasDivergence) {
                                        continue; // Skip signals without divergence if required
                                    }
                                }

                                // Apply volume filter
                                if (scenarioConfig.requireVolume) {
                                    const hasVolume = analysis.signals.filters?.volume?.isAboveAverage;
                                    if (!hasVolume) {
                                        continue; // Skip low volume signals
                                    }
                                }

                                // Apply trending market filter
                                if (scenarioConfig.requireTrending) {
                                    const isTrending = analysis.signals.filters?.marketRegime?.regime === 'trending';
                                    if (!isTrending) {
                                        continue; // Skip ranging market signals
                                    }
                                }
                                
                                stats.validSignals++;
                                
                                // Debug first 3 valid signals
                                if (stats.validSignals <= 3) {
                                    console.log(`\n🔍 Valid Signal #${stats.validSignals}:`);
                                    console.log(`   Symbol: ${symbol}`);
                                    console.log(`   Signal: ${analysis.finalSignal}`);
                                    console.log(`   Confidence: ${analysis.confidence}%`);
                                    if (scenarioConfig.requireDivergence) {
                                        console.log(`   Divergence: RSI=${analysis.signals.divergence?.rsiDivergence?.detected}, MACD=${analysis.signals.divergence?.macdDivergence?.detected}`);
                                    }
                                    if (scenarioConfig.requireVolume) {
                                        console.log(`   Volume Ratio: ${analysis.signals.filters?.volume?.ratio}x`);
                                    }
                                    if (scenarioConfig.requireTrending) {
                                        console.log(`   Market: ${analysis.signals.filters?.marketRegime?.regime} (ADX: ${analysis.signals.filters?.marketRegime?.adx?.toFixed(1)})`);
                                    }
                                }
                                
                                const closedCandle = ohlcv[candleIndex - 1];
                                const candleRange = closedCandle[2] - closedCandle[3];
                                const stopMultiplier = scenarioConfig.stopMultiplier || 3.0;
                                const stopLossDistance = candleRange * stopMultiplier;
                                
                                let stopPrice, entryPrice = currentPrice;

                                if (analysis.finalSignal === 'BULLISH') {
                                    stopPrice = closedCandle[3] - stopLossDistance;
                                } else {
                                    stopPrice = closedCandle[2] + stopLossDistance;
                                }
                                
                                // Calculate Fibonacci targets from local swing high/low
                                const recentCandles = ohlcv.slice(Math.max(0, candleIndex - 20), candleIndex);
                                const localHigh = Math.max(...recentCandles.map(c => c[2]));
                                const localLow = Math.min(...recentCandles.map(c => c[3]));
                                
                                const fibTargets = positionManager.calculateFibonacciTargets(
                                    localHigh,
                                    localLow,
                                    analysis.finalSignal
                                );
                                
                                if (stats.validSignals <= 3) {
                                    console.log(`   Entry: $${entryPrice.toFixed(2)} | Stop: $${stopPrice.toFixed(2)}`);
                                    console.log(`   Stop Distance: $${Math.abs(entryPrice - stopPrice).toFixed(2)}`);
                                    console.log(`   Fib Targets: 50%=$${fibTargets.target_50.toFixed(2)} | 61.8%=$${fibTargets.target_618.toFixed(2)} | 100%=$${fibTargets.target_100.toFixed(2)}`);
                                }

                                const sizing = positionManager.calculatePositionSize(
                                    entryPrice,
                                    stopPrice,
                                    analysis.finalSignal,
                                    analysis.confidence
                                );

                                if (!sizing.error) {
                                    // Override targetPrice with Fibonacci 61.8% level for swing trading
                                    sizing.targetPrice = fibTargets.primary;
                                    
                                    const tradeResult = positionManager.openPosition({
                                        symbol: symbol,
                                        signal: analysis.finalSignal,
                                        entryPrice,
                                        stopPrice,
                                        targetPrice: fibTargets.primary,  // Pass Fib target
                                        confidence: analysis.confidence,
                                        analysis: {
                                            pattern: null,
                                            indicators: null,
                                            fibonacci: analysis.signals.fibonacci?.hasSupport,
                                            harmonics: analysis.signals.harmonics?.isValid
                                        }
                                    });

                                    if (tradeResult.success) {
                                        stats.tradesOpened++;
                                        
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
                                            pattern: null,
                                            indicators: null
                                        });
                                    }
                                }
                            }

                            lastCandleTimeMap[symbol] = currentCandleTime;
                            stats.processedCandles++;
                        }
                    } catch (symbolError) {
                        // Silent error handling
                    }
                }
            } catch (error) {
                // Silent error handling
            }
        }

        // Print results
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
        console.log(`   Net: $${netProfit.toFixed(2)} (${returnPercent}%)`);
        console.log(`   🔄 Balance Used: Available balance updated per trade (spot trading mode)`);
        
        // Capital utilization stats
        const avgAllocated = stats.positionSnapshots.length > 0 
            ? (stats.totalCapitalAllocated / stats.positionSnapshots.length) * 100 
            : 0;
        const maxPossibleAllocation = scenarioConfig.maxPositions * scenarioConfig.riskPerTrade * 100;
        const avgIdleCapital = 100 - avgAllocated;
        
        console.log(`\n📊 Capital Utilization:`);
        console.log(`   Max Concurrent Positions: ${stats.maxConcurrentPositions} / ${scenarioConfig.maxPositions}`);
        console.log(`   Avg Capital Deployed: ${avgAllocated.toFixed(1)}%`);
        console.log(`   Avg Idle Capital: ${avgIdleCapital.toFixed(1)}%`);
        console.log(`   Max Possible Allocation: ${maxPossibleAllocation.toFixed(0)}% (${scenarioConfig.maxPositions} × ${(scenarioConfig.riskPerTrade * 100).toFixed(0)}%)`);
        console.log();

        return {
            scenario: scenarioConfig.name,
            winRate: stats.tradesClosed > 0 ? ((stats.winners / stats.tradesClosed) * 100).toFixed(2) : '0.00',
            totalReturn: returnPercent,
            tradesOpened: stats.tradesOpened
        };

    } catch (error) {
        console.error("❌ Error:", error.message);
    }
}

async function main() {
    const arg = process.argv[2] || 'moderate';

    if (swingScenarios[arg]) {
        await runSwingBacktest(swingScenarios[arg]);
    } else if (arg === 'all') {
        console.log('\n🧪 Running ALL SWING scenarios for comparison...\n');
        const results = [];
        for (const [key, scenario] of Object.entries(swingScenarios)) {
            const result = await runSwingBacktest(scenario);
            results.push(result);
            await sleep(1000);
        }
        
        console.log(`\n${'='.repeat(60)}`);
        console.log('📊 SWING COMPARISON SUMMARY');
        console.log(`${'='.repeat(60)}\n`);
        const safeResults = results.filter(Boolean);
        safeResults.forEach((r, i) => {
            console.log(`${i + 1}. ${r.scenario}`);
            console.log(`   Win Rate: ${r.winRate}% | Return: ${r.totalReturn}% | Trades: ${r.tradesOpened}`);
        });
        
        // Calculate totals
        const totalTrades = safeResults.reduce((sum, r) => sum + r.tradesOpened, 0);
        const avgWinRate = (safeResults.reduce((sum, r) => sum + parseFloat(r.winRate), 0) / safeResults.length).toFixed(2);
        const avgReturn = (safeResults.reduce((sum, r) => sum + parseFloat(r.totalReturn), 0) / safeResults.length).toFixed(2);
        const bestReturn = Math.max(...safeResults.map(r => parseFloat(r.totalReturn))).toFixed(2);
        const worstReturn = Math.min(...safeResults.map(r => parseFloat(r.totalReturn))).toFixed(2);
        
        console.log(`\n${'─'.repeat(60)}`);
        console.log('📈 AGGREGATE STATS:');
        console.log(`   Total Trades Executed: ${totalTrades}`);
        console.log(`   Average Win Rate: ${avgWinRate}%`);
        console.log(`   Average Return: ${avgReturn}%`);
        console.log(`   Best Return: ${bestReturn}%`);
        console.log(`   Worst Return: ${worstReturn}%`);
        console.log(`   Scenarios Tested: ${safeResults.length}`);
        console.log();
    } else {
        console.log(`\n⚠️  Unknown scenario: ${arg}`);
        console.log(`\nAvailable scenarios:`);
        console.log(`  - conservative  (safer, fewer trades)`);
        console.log(`  - moderate      (balanced)`);
        console.log(`  - aggressive    (more trades, higher risk)`);
        console.log(`  - hourly        (1h timeframe)`);
        console.log(`  - all           (run all scenarios)\n`);
        process.exit(1);
    }
}

main();
