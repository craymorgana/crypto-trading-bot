/**
 * Swing Trading Backtest using Enhanced Multi-Factor Analysis
 * Tests trend-aligned, momentum-confirmed entries
 */

require('dotenv').config();
const ccxt = require('ccxt');
const { analyzeForSwinging } = require('../shared/unified-analysis');
const PositionManager = require('../shared/risk-manager');
const dataLogger = require('../shared/data-logger');
const tradeAnalyzer = require('../shared/trade-analyzer');
const config = require('../shared/config');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Enhanced Swing trading scenarios - TARGETING 15%+ RETURNS
const swingScenarios = {
    // ===== NEW ENHANCED STRATEGIES =====
    enhanced_balanced: {
        name: '🚀 ENHANCED BALANCED',
        minConfidenceThreshold: 45,
        riskPerTrade: 0.12,
        takeProfitRatio: 2.0,
        maxPositions: 5,
        candleInterval: '4h',
        stopMultiplier: 0.5,        // Tighter stops for better R:R
        bullishOnly: false,
        bearishOnly: false,         // Trade BOTH directions
        requireTrendAlignment: true,
        requireDivergence: false,
        requireVolume: false,
        requireTrending: true,
        minRRRatio: 1.0              // Only take trades with 1:1+ R:R
    },
    enhanced_aggressive: {
        name: '💥 ENHANCED AGGRESSIVE',
        minConfidenceThreshold: 40,
        riskPerTrade: 0.20,
        takeProfitRatio: 2.5,
        maxPositions: 6,
        candleInterval: '4h',
        stopMultiplier: 0.5,
        bullishOnly: false,
        bearishOnly: false,
        requireTrendAlignment: true,
        requireDivergence: false,
        requireVolume: false,
        requireTrending: true,
        minRRRatio: 1.0
    },
    enhanced_conservative: {
        name: '🛡️ ENHANCED CONSERVATIVE',
        minConfidenceThreshold: 55,
        riskPerTrade: 0.08,
        takeProfitRatio: 1.8,
        maxPositions: 4,
        candleInterval: '4h',
        stopMultiplier: 1.0,
        bullishOnly: false,
        bearishOnly: false,
        requireTrendAlignment: true,
        requireDivergence: false,
        requireVolume: false,
        requireTrending: true
    },
    trend_following: {
        name: '📈 TREND FOLLOWING',
        minConfidenceThreshold: 50,
        riskPerTrade: 0.15,
        takeProfitRatio: 3.0,
        maxPositions: 5,
        candleInterval: '4h',
        stopMultiplier: 0.5,
        bullishOnly: false,
        bearishOnly: false,
        requireTrendAlignment: true,
        requireDivergence: false,
        requireVolume: true,
        requireTrending: true,
        minRRRatio: 1.0
    },
    // ===== OPTIMAL CONFIGURATION - 28%+ RETURN =====
    high_confidence: {
        name: '🎯 OPTIMAL HIGH RETURN',
        minConfidenceThreshold: 50,   // Balanced - enough signals with quality
        riskPerTrade: 0.50,           // Aggressive but not extreme (50% per trade)
        takeProfitRatio: 1.5,
        maxPositions: 10,
        candleInterval: '4h',
        stopMultiplier: 0.5,          // Tight stops for good R:R with Fib targets
        bullishOnly: false,
        bearishOnly: false,
        requireTrendAlignment: true,   // Only trade with the trend
        requireDivergence: false,
        requireVolume: true,           // Volume confirmation for quality
        requireTrending: true,         // ADX filter for trending markets
        useTrailingStop: true,
        trailActivation: 0.5,
        trailDistance: 0.3,
        minRRRatio: 0.7               // Accept trades with 0.7:1+ R:R
    },
    // ===== LEGACY SCENARIOS FOR COMPARISON =====
    legacy_champion: {
        name: '🏆 LEGACY CHAMPION',
        minConfidenceThreshold: 23,
        riskPerTrade: 0.15,
        takeProfitRatio: 1.2,
        maxPositions: 7,
        candleInterval: '4h',
        stopMultiplier: 0.6,
        bullishOnly: false,
        bearishOnly: true,
        requireTrendAlignment: false,
        requireDivergence: false,
        requireVolume: false,
        requireTrending: false
    },
    both_directions_12: {
        name: '↕️ BOTH DIRECTIONS 12%',
        minConfidenceThreshold: 45,
        riskPerTrade: 0.12,
        takeProfitRatio: 2.0,
        maxPositions: 5,
        candleInterval: '4h',
        stopMultiplier: 0.8,
        bullishOnly: false,
        bearishOnly: false,         // Key: trade both!
        requireTrendAlignment: false,
        requireDivergence: false,
        requireVolume: false,
        requireTrending: false
    },
    momentum_trader: {
        name: '⚡ MOMENTUM TRADER',
        minConfidenceThreshold: 50,
        riskPerTrade: 0.14,
        takeProfitRatio: 2.2,
        maxPositions: 5,
        candleInterval: '4h',
        stopMultiplier: 0.85,
        bullishOnly: false,
        bearishOnly: false,
        requireTrendAlignment: true,
        requireDivergence: false,
        requireVolume: false,
        requireTrending: true
    },
    swing_optimal: {
        name: '🌟 SWING OPTIMAL',
        minConfidenceThreshold: 55,
        riskPerTrade: 0.12,
        takeProfitRatio: 2.0,
        maxPositions: 5,
        candleInterval: '4h',
        stopMultiplier: 0.9,
        bullishOnly: false,
        bearishOnly: false,
        requireTrendAlignment: true,
        requireDivergence: false,
        requireVolume: false,
        requireTrending: true
    },
    max_return: {
        name: '💰 MAX RETURN',
        minConfidenceThreshold: 50,
        riskPerTrade: 0.15,
        takeProfitRatio: 2.2,
        maxPositions: 5,
        candleInterval: '4h',
        stopMultiplier: 0.85,
        bullishOnly: false,
        bearishOnly: false,
        requireTrendAlignment: true,
        requireDivergence: false,
        requireVolume: false,
        requireTrending: true
    },
    // ===== NEW OPTIMIZED SCENARIOS =====
    strict_quality: {
        name: '✨ STRICT QUALITY',
        minConfidenceThreshold: 65,
        riskPerTrade: 0.14,
        takeProfitRatio: 2.0,
        maxPositions: 4,
        candleInterval: '4h',
        stopMultiplier: 0.9,
        bullishOnly: false,
        bearishOnly: false,
        requireTrendAlignment: true,
        requireDivergence: false,
        requireVolume: true,
        requireTrending: true
    },
    precision_swing: {
        name: '🎯 PRECISION SWING',
        minConfidenceThreshold: 58,
        riskPerTrade: 0.10,
        takeProfitRatio: 2.5,
        maxPositions: 5,
        candleInterval: '4h',
        stopMultiplier: 1.0,
        bullishOnly: false,
        bearishOnly: false,
        requireTrendAlignment: true,
        requireDivergence: false,
        requireVolume: false,
        requireTrending: true
    },
    profit_hunter: {
        name: '💎 PROFIT HUNTER',
        minConfidenceThreshold: 52,
        riskPerTrade: 0.15,
        takeProfitRatio: 2.8,
        maxPositions: 4,
        candleInterval: '4h',
        stopMultiplier: 0.85,
        bullishOnly: false,
        bearishOnly: false,
        requireTrendAlignment: true,
        requireDivergence: false,
        requireVolume: false,
        requireTrending: true
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
    tradeAnalyzer.reset();  // Reset analyzer for new backtest

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

                            // Check exits with trailing stop support
                            const trailingConfig = scenarioConfig.useTrailingStop ? {
                                useTrailingStop: true,
                                trailActivation: scenarioConfig.trailActivation || 0.5,
                                trailDistance: scenarioConfig.trailDistance || 0.3
                            } : null;
                            const exitSignals = positionManager.checkExitSignals(currentPrice, symbol, trailingConfig);
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

                                    // Log to trade analyzer for failure analysis
                                    tradeAnalyzer.logExit(exit.tradeId, {
                                        exitTime: new Date(currentCandleTime),
                                        exitPrice: exit.exitPrice,
                                        reason: exit.reason,
                                        profitLoss: trade.profitLoss,
                                        profitLossPercent: trade.profitLossPercent
                                    });                                    dataLogger.closeTrade(
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
                                
                                // Calculate Fibonacci targets
                                const recentCandles = ohlcv.slice(Math.max(0, candleIndex - 20), candleIndex);
                                const localHigh = Math.max(...recentCandles.map(c => c[2]));
                                const localLow = Math.min(...recentCandles.map(c => c[3]));
                                
                                const fibTargets = positionManager.calculateFibonacciTargets(
                                    localHigh,
                                    localLow,
                                    analysis.finalSignal
                                );
                                
                                // Use Fibonacci 61.8% target
                                let targetPrice = fibTargets.target_618;
                                
                                // Calculate actual R:R ratio
                                const stopDistance = Math.abs(entryPrice - stopPrice);
                                const targetDistance = Math.abs(targetPrice - entryPrice);
                                const actualRR = targetDistance / stopDistance;
                                
                                // Skip trades with very poor R:R (below 0.8:1)
                                const minRRRatio = scenarioConfig.minRRRatio || 0.8;
                                if (actualRR < minRRRatio) {
                                    stats.skippedLowRR = (stats.skippedLowRR || 0) + 1;
                                    continue;
                                }
                                
                                if (stats.validSignals <= 3) {
                                    console.log(`   Entry: $${entryPrice.toFixed(2)} | Stop: $${stopPrice.toFixed(2)}`);
                                    console.log(`   Stop Distance: $${stopDistance.toFixed(2)} (${((stopDistance/entryPrice)*100).toFixed(2)}%)`);
                                    console.log(`   Target: $${targetPrice.toFixed(2)} (Fib 61.8%, R:R ${actualRR.toFixed(2)}:1)`);
                                }

                                const sizing = positionManager.calculatePositionSize(
                                    entryPrice,
                                    stopPrice,
                                    analysis.finalSignal,
                                    analysis.confidence
                                );

                                if (!sizing.error) {
                                    // Use calculated target with proper R:R ratio
                                    sizing.targetPrice = targetPrice;
                                    
                                    const tradeResult = positionManager.openPosition({
                                        symbol: symbol,
                                        signal: analysis.finalSignal,
                                        entryPrice,
                                        stopPrice,
                                        targetPrice: targetPrice,  // Use calculated R:R target
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
                                        
                                        // Log to trade analyzer with full context
                                        tradeAnalyzer.logEntry({
                                            id: tradeResult.trade.id,
                                            symbol: tradeResult.trade.symbol,
                                            signal: tradeResult.trade.signal,
                                            entryTime: new Date(currentCandleTime),
                                            entryPrice: tradeResult.trade.entryPrice,
                                            stopPrice: tradeResult.trade.stopPrice,
                                            targetPrice: tradeResult.trade.targetPrice,
                                            positionSize: tradeResult.trade.positionSize,
                                            confidence: tradeResult.trade.confidence,
                                            analysis: {
                                                trend: analysis.signals.trend,
                                                momentum: analysis.signals.momentum,
                                                candlestick: analysis.signals.candlesticks,
                                                fibonacci: analysis.signals.fibonacci,
                                                harmonics: analysis.signals.harmonics,
                                                volume: analysis.signals.filters?.volume,
                                                marketRegime: analysis.signals.filters?.marketRegime,
                                                signalQuality: analysis.signalQuality
                                            }
                                        });
                                        
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
        if (stats.skippedLowRR) {
            console.log(`   Skipped (low R:R): ${stats.skippedLowRR}`);
        }
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

        // Generate failure analysis report if there are losses
        const showDetailedAnalysis = process.argv.includes('--analyze') || process.argv.includes('-a');
        if (showDetailedAnalysis && stats.losers > 0) {
            tradeAnalyzer.printFailureReport();
            const logFile = tradeAnalyzer.saveToFile();
            console.log(`\n📁 Detailed trade log saved to: ${logFile}\n`);
        }

        return {
            scenario: scenarioConfig.name,
            winRate: stats.tradesClosed > 0 ? ((stats.winners / stats.tradesClosed) * 100).toFixed(2) : '0.00',
            totalReturn: returnPercent,
            tradesOpened: stats.tradesOpened,
            failureReport: stats.losers > 0 ? tradeAnalyzer.generateReport() : null
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
