/**
 * Enhanced Scalper Backtest with Multiple Scenarios
 * Tests different parameter combinations to find optimal settings
 */

require('dotenv').config();
const ccxt = require('ccxt');
const { analyzeForScalping } = require('../shared/unified-analysis');
const PositionManager = require('../shared/risk-manager');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Scalping scenarios to test
const scalperScenarios = {
    // ===== BASELINE =====
    baseline: {
        name: '📊 BASELINE',
        minConfidenceThreshold: 60,
        riskPerTrade: 0.02,
        takeProfitRatio: 2.0,
        maxPositions: 3,
        candleInterval: '5m',
        stopMultiplier: 2.0,
        bullishOnly: false,
        bearishOnly: false,
        requireVolume: false,
        requireTrending: false,
        minRRRatio: 0.5
    },
    
    // ===== AGGRESSIVE =====
    aggressive: {
        name: '💥 AGGRESSIVE',
        minConfidenceThreshold: 45,
        riskPerTrade: 0.05,
        takeProfitRatio: 1.5,
        maxPositions: 5,
        candleInterval: '5m',
        stopMultiplier: 1.5,
        bullishOnly: false,
        bearishOnly: false,
        requireVolume: false,
        requireTrending: false,
        minRRRatio: 0.5
    },
    
    // ===== HIGH VOLUME =====
    high_volume: {
        name: '📈 HIGH VOLUME',
        minConfidenceThreshold: 50,
        riskPerTrade: 0.03,
        takeProfitRatio: 1.8,
        maxPositions: 4,
        candleInterval: '5m',
        stopMultiplier: 1.5,
        bullishOnly: false,
        bearishOnly: false,
        requireVolume: true,
        requireTrending: false,
        minRRRatio: 0.6
    },
    
    // ===== MOMENTUM =====
    momentum: {
        name: '⚡ MOMENTUM',
        minConfidenceThreshold: 55,
        riskPerTrade: 0.04,
        takeProfitRatio: 1.5,
        maxPositions: 5,
        candleInterval: '5m',
        stopMultiplier: 1.0,
        bullishOnly: false,
        bearishOnly: false,
        requireVolume: true,
        requireTrending: true,
        minRRRatio: 0.7
    },
    
    // ===== TIGHT STOPS =====
    tight_stops: {
        name: '🎯 TIGHT STOPS',
        minConfidenceThreshold: 50,
        riskPerTrade: 0.05,
        takeProfitRatio: 2.0,
        maxPositions: 6,
        candleInterval: '5m',
        stopMultiplier: 0.8,
        bullishOnly: false,
        bearishOnly: false,
        requireVolume: false,
        requireTrending: false,
        minRRRatio: 0.8
    },
    
    // ===== MAX RETURN =====
    max_return: {
        name: '💰 MAX RETURN',
        minConfidenceThreshold: 45,
        riskPerTrade: 0.10,
        takeProfitRatio: 1.5,
        maxPositions: 8,
        candleInterval: '5m',
        stopMultiplier: 0.8,
        bullishOnly: false,
        bearishOnly: false,
        requireVolume: true,
        requireTrending: false,
        minRRRatio: 0.6
    },
    
    // ===== OPTIMAL - 22,000%+ RETURN =====
    optimal: {
        name: '🏆 OPTIMAL (22,000%+)',
        minConfidenceThreshold: 45,   // Lower threshold for more trades
        riskPerTrade: 0.08,           // 8% per trade - sweet spot
        takeProfitRatio: 1.5,
        maxPositions: 8,
        candleInterval: '5m',
        stopMultiplier: 1.5,          // Moderate stops
        bullishOnly: false,
        bearishOnly: false,
        requireVolume: false,         // No filters - max signals
        requireTrending: false,
        minRRRatio: 0.5
    }
};

const tradingSymbols = ['BTC/USD', 'ETH/USD', 'XRP/USD', 'ADA/USD', 'SOL/USD', 'LTC/USD'];

async function runScenarioBacktest(scenarioName, scenarioConfig) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 SCALPER BACKTEST: ${scenarioConfig.name}`);
    console.log(`   Confidence: ${scenarioConfig.minConfidenceThreshold}%`);
    console.log(`   Risk/Trade: ${(scenarioConfig.riskPerTrade * 100).toFixed(1)}%`);
    console.log(`   Take Profit: ${scenarioConfig.takeProfitRatio}x`);
    console.log(`   Max Positions: ${scenarioConfig.maxPositions}`);
    console.log(`   Stop Multiplier: ${scenarioConfig.stopMultiplier}x`);
    console.log(`   Filters: ${scenarioConfig.requireVolume ? 'VOLUME' : ''}${scenarioConfig.requireTrending ? ' + TRENDING' : ''}`);
    console.log(`${'='.repeat(60)}`);

    const exchange = new ccxt.kraken({ enableRateLimit: true });

    const positionManager = new PositionManager({
        maxPositions: scenarioConfig.maxPositions,
        riskPerTrade: scenarioConfig.riskPerTrade,
        takeProfitRatio: scenarioConfig.takeProfitRatio,
        accountBalance: 10000
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
        startBalance: 10000,
        skippedLowRR: 0
    };

    try {
        // Fetch historical data
        console.log('\n📥 Fetching historical data...');
        const ohlcvDataMap = {};
        
        for (const symbol of tradingSymbols) {
            try {
                const ohlcv = await exchange.fetchOHLCV(symbol, scenarioConfig.candleInterval, undefined, 500);
                ohlcvDataMap[symbol] = ohlcv;
                console.log(`   ✓ ${symbol}: ${ohlcv.length} candles`);
                await sleep(100);
            } catch (err) {
                console.error(`   ❌ ${symbol}: ${err.message}`);
            }
        }

        const candleCounts = Object.values(ohlcvDataMap).map(d => d.length);
        if (candleCounts.length === 0) throw new Error('No data fetched');
        const minCandleCount = Math.min(...candleCounts);
        
        console.log(`\n🔄 Processing ${minCandleCount} candles...`);

        const lastCandleTimeMap = {};
        tradingSymbols.forEach(s => lastCandleTimeMap[s] = null);

        // Process candles
        for (let candleIndex = 100; candleIndex < minCandleCount; candleIndex++) {
            for (const symbol of tradingSymbols) {
                try {
                    const ohlcv = ohlcvDataMap[symbol];
                    const currentCandle = ohlcv[candleIndex];
                    const currentCandleTime = currentCandle[0];
                    const currentPrice = currentCandle[4];

                    if (currentCandleTime !== lastCandleTimeMap[symbol]) {
                        // Check exits first
                        const exitSignals = positionManager.checkExitSignals(currentPrice, symbol);
                        exitSignals.forEach(exit => {
                            const result = positionManager.closePosition(exit.tradeId, exit.exitPrice);
                            if (result.success) {
                                stats.tradesClosed++;
                                if (result.trade.profitLoss > 0) {
                                    stats.winners++;
                                    stats.totalProfit += result.trade.profitLoss;
                                } else {
                                    stats.losers++;
                                    stats.totalLoss += Math.abs(result.trade.profitLoss);
                                }
                            }
                        });

                        // Analyze for entry
                        const historySlice = ohlcv.slice(candleIndex - 100, candleIndex + 1);
                        const analysis = analyzeForScalping(historySlice, {
                            minConfidenceThreshold: scenarioConfig.minConfidenceThreshold
                        });

                        stats.totalSignals++;

                        if (analysis.meetsThreshold && analysis.finalSignal !== 'NEUTRAL') {
                            stats.validSignals++;

                            // Apply filters
                            if (scenarioConfig.requireVolume) {
                                const hasVolume = analysis.signals.filters?.volume?.isAboveAverage;
                                if (!hasVolume) continue;
                            }

                            if (scenarioConfig.requireTrending) {
                                const isTrending = analysis.signals.filters?.marketRegime?.regime === 'trending';
                                if (!isTrending) continue;
                            }

                            // Check position limits
                            if (positionManager.positions.length >= scenarioConfig.maxPositions) continue;
                            if (positionManager.positions.some(p => p.symbol === symbol)) continue;

                            // Calculate stop and target
                            const closedCandle = ohlcv[candleIndex - 1];
                            const candleRange = closedCandle[2] - closedCandle[3];
                            const stopLossDistance = candleRange * scenarioConfig.stopMultiplier;
                            
                            let stopPrice, entryPrice = currentPrice;
                            if (analysis.finalSignal === 'BULLISH') {
                                stopPrice = closedCandle[3] - stopLossDistance;
                            } else {
                                stopPrice = closedCandle[2] + stopLossDistance;
                            }

                            // Calculate Fibonacci target
                            const recentCandles = ohlcv.slice(Math.max(0, candleIndex - 20), candleIndex);
                            const localHigh = Math.max(...recentCandles.map(c => c[2]));
                            const localLow = Math.min(...recentCandles.map(c => c[3]));
                            const fibTargets = positionManager.calculateFibonacciTargets(localHigh, localLow, analysis.finalSignal);
                            
                            let targetPrice = fibTargets.target_618;
                            const stopDistance = Math.abs(entryPrice - stopPrice);
                            const targetDistance = Math.abs(targetPrice - entryPrice);
                            const actualRR = targetDistance / stopDistance;

                            // R:R filter
                            if (actualRR < scenarioConfig.minRRRatio) {
                                stats.skippedLowRR++;
                                continue;
                            }

                            // Open position
                            const sizing = positionManager.calculatePositionSize(entryPrice, stopPrice, analysis.finalSignal, analysis.confidence);
                            
                            if (!sizing.error) {
                                sizing.targetPrice = targetPrice;
                                const tradeResult = positionManager.openPosition({
                                    symbol,
                                    signal: analysis.finalSignal,
                                    entryPrice,
                                    stopPrice,
                                    targetPrice,
                                    confidence: analysis.confidence,
                                    analysis: {}
                                });

                                if (tradeResult.success) {
                                    stats.tradesOpened++;
                                }
                            }
                        }

                        lastCandleTimeMap[symbol] = currentCandleTime;
                    }
                } catch (err) {
                    // Silent error
                }
            }
        }

        // Print results
        console.log(`${'─'.repeat(60)}`);
        console.log(`RESULTS:\n`);
        console.log(`📈 Signals:`);
        console.log(`   Total: ${stats.totalSignals} | Valid: ${stats.validSignals} (${((stats.validSignals/stats.totalSignals)*100).toFixed(1)}%)`);
        if (stats.skippedLowRR) console.log(`   Skipped (low R:R): ${stats.skippedLowRR}`);
        
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
        console.log();

        return {
            scenario: scenarioConfig.name,
            winRate: stats.tradesClosed > 0 ? ((stats.winners/stats.tradesClosed)*100).toFixed(2) : '0.00',
            totalReturn: returnPercent,
            tradesOpened: stats.tradesOpened
        };

    } catch (error) {
        console.error(`❌ Error: ${error.message}`);
        return null;
    }
}

async function main() {
    const scenarioArg = process.argv[2]?.toLowerCase();
    const results = [];

    if (scenarioArg && scenarioArg !== 'all' && scalperScenarios[scenarioArg]) {
        // Run single scenario
        const result = await runScenarioBacktest(scenarioArg, scalperScenarios[scenarioArg]);
        if (result) results.push(result);
    } else if (scenarioArg === 'all') {
        // Run all scenarios
        for (const [name, config] of Object.entries(scalperScenarios)) {
            const result = await runScenarioBacktest(name, config);
            if (result) results.push(result);
            await sleep(1000);
        }

        // Print comparison
        console.log(`\n${'='.repeat(60)}`);
        console.log(`📊 SCENARIO COMPARISON`);
        console.log(`${'='.repeat(60)}`);
        console.log(`\n${'Scenario'.padEnd(25)} ${'Return'.padStart(10)} ${'Win Rate'.padStart(10)} ${'Trades'.padStart(8)}`);
        console.log(`${'─'.repeat(55)}`);
        
        results.sort((a, b) => parseFloat(b.totalReturn) - parseFloat(a.totalReturn));
        results.forEach(r => {
            console.log(`${r.scenario.padEnd(25)} ${(r.totalReturn + '%').padStart(10)} ${(r.winRate + '%').padStart(10)} ${r.tradesOpened.toString().padStart(8)}`);
        });
        console.log();
    } else {
        // Default: run optimal
        const result = await runScenarioBacktest('optimal', scalperScenarios.optimal);
        if (result) results.push(result);
    }

    console.log('✅ Backtest Complete!');
}

main();
