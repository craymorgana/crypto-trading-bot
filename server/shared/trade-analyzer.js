/**
 * Trade Analyzer - Detailed logging and analysis of trade outcomes
 * Tracks why trades succeeded or failed to enable strategy improvements
 */

const fs = require('fs');
const path = require('path');

const TRADE_LOG_FILE = path.join(__dirname, 'trade-analysis.json');

class TradeAnalyzer {
    constructor() {
        this.trades = [];
        this.stats = {
            totalTrades: 0,
            winners: 0,
            losers: 0,
            stopHits: 0,
            targetHits: 0,
            avgWinPercent: 0,
            avgLossPercent: 0,
            failureReasons: {}
        };
    }

    /**
     * Reset the analyzer for a new backtest
     */
    reset() {
        this.trades = [];
        this.stats = {
            totalTrades: 0,
            winners: 0,
            losers: 0,
            stopHits: 0,
            targetHits: 0,
            avgWinPercent: 0,
            avgLossPercent: 0,
            failureReasons: {}
        };
    }

    /**
     * Log a trade entry with full analysis context
     * @param {Object} tradeData - Complete trade entry data
     */
    logEntry(tradeData) {
        const entry = {
            id: tradeData.id,
            symbol: tradeData.symbol,
            signal: tradeData.signal,
            entryTime: tradeData.entryTime || new Date(),
            entryPrice: tradeData.entryPrice,
            stopPrice: tradeData.stopPrice,
            targetPrice: tradeData.targetPrice,
            positionSize: tradeData.positionSize,
            confidence: tradeData.confidence,
            
            // Analysis context at entry
            analysis: {
                trendDirection: tradeData.analysis?.trend?.trend || 'UNKNOWN',
                trendStrength: tradeData.analysis?.trend?.strength || 0,
                trendAligned: tradeData.analysis?.trend?.aligned || false,
                momentumSignal: tradeData.analysis?.momentum?.momentum || 'UNKNOWN',
                momentumScore: tradeData.analysis?.momentum?.score || 0,
                candlePattern: tradeData.analysis?.candlestick?.pattern || 'NONE',
                candleSignal: tradeData.analysis?.candlestick?.signal || 'NEUTRAL',
                fibonacciNear: tradeData.analysis?.fibonacci?.hasSupport || false,
                harmonicsValid: tradeData.analysis?.harmonics?.isValid || false,
                volumeAboveAvg: tradeData.analysis?.volume?.isAboveAverage || false,
                volumeRatio: tradeData.analysis?.volume?.ratio || 1.0,
                marketRegime: tradeData.analysis?.marketRegime?.regime || 'UNKNOWN',
                adx: tradeData.analysis?.marketRegime?.adx || 0,
                signalQuality: tradeData.analysis?.signalQuality || 'UNKNOWN'
            },
            
            // Price context at entry
            priceContext: {
                stopDistance: Math.abs(tradeData.entryPrice - tradeData.stopPrice),
                stopDistancePercent: ((Math.abs(tradeData.entryPrice - tradeData.stopPrice) / tradeData.entryPrice) * 100).toFixed(2),
                targetDistance: Math.abs(tradeData.targetPrice - tradeData.entryPrice),
                targetDistancePercent: ((Math.abs(tradeData.targetPrice - tradeData.entryPrice) / tradeData.entryPrice) * 100).toFixed(2),
                riskRewardRatio: (Math.abs(tradeData.targetPrice - tradeData.entryPrice) / Math.abs(tradeData.entryPrice - tradeData.stopPrice)).toFixed(2)
            },
            
            // Exit data (filled on close)
            exit: null
        };

        this.trades.push(entry);
        return entry;
    }

    /**
     * Log a trade exit with failure analysis
     * @param {string} tradeId - Trade ID
     * @param {Object} exitData - Exit details
     */
    logExit(tradeId, exitData) {
        const trade = this.trades.find(t => t.id === tradeId);
        if (!trade) return null;

        const profitLoss = exitData.profitLoss;
        const profitLossPercent = exitData.profitLossPercent;
        const isWinner = profitLoss > 0;
        const exitReason = exitData.reason;

        // Analyze WHY the trade failed (if it did)
        let failureAnalysis = null;
        if (!isWinner && exitReason === 'STOP_HIT') {
            failureAnalysis = this.analyzeFailure(trade, exitData);
        }

        trade.exit = {
            exitTime: exitData.exitTime || new Date(),
            exitPrice: exitData.exitPrice,
            exitReason: exitReason,
            profitLoss: profitLoss,
            profitLossPercent: profitLossPercent,
            isWinner: isWinner,
            holdTimeMs: new Date(exitData.exitTime || new Date()) - new Date(trade.entryTime),
            failureAnalysis: failureAnalysis
        };

        // Update stats
        this.stats.totalTrades++;
        if (isWinner) {
            this.stats.winners++;
            this.stats.targetHits++;
        } else {
            this.stats.losers++;
            this.stats.stopHits++;
            
            // Categorize failure reason
            if (failureAnalysis?.primaryCause) {
                const cause = failureAnalysis.primaryCause;
                this.stats.failureReasons[cause] = (this.stats.failureReasons[cause] || 0) + 1;
            }
        }

        return trade;
    }

    /**
     * Analyze why a trade failed
     * @param {Object} trade - The trade entry data
     * @param {Object} exitData - Exit data
     * @returns {Object} - Failure analysis
     */
    analyzeFailure(trade, exitData) {
        const issues = [];
        let primaryCause = 'UNKNOWN';

        // 1. Check if trend was weak or against trade
        if (trade.analysis.trendStrength < 50) {
            issues.push({
                issue: 'WEAK_TREND',
                detail: `Trend strength was only ${trade.analysis.trendStrength}% at entry`,
                severity: 'HIGH'
            });
            primaryCause = 'WEAK_TREND';
        }

        if (trade.analysis.trendDirection !== trade.signal) {
            issues.push({
                issue: 'COUNTER_TREND',
                detail: `Traded ${trade.signal} against ${trade.analysis.trendDirection} trend`,
                severity: 'CRITICAL'
            });
            primaryCause = 'COUNTER_TREND';
        }

        // 2. Check momentum alignment
        if (trade.analysis.momentumSignal !== trade.signal) {
            issues.push({
                issue: 'MOMENTUM_MISALIGNED',
                detail: `Momentum was ${trade.analysis.momentumSignal} while trading ${trade.signal}`,
                severity: 'HIGH'
            });
            if (primaryCause === 'UNKNOWN') primaryCause = 'MOMENTUM_MISALIGNED';
        }

        if (trade.analysis.momentumScore < 40) {
            issues.push({
                issue: 'LOW_MOMENTUM',
                detail: `Momentum score was only ${trade.analysis.momentumScore}`,
                severity: 'MEDIUM'
            });
        }

        // 3. Check volume
        if (!trade.analysis.volumeAboveAvg) {
            issues.push({
                issue: 'LOW_VOLUME',
                detail: `Volume ratio was ${trade.analysis.volumeRatio}x (below average)`,
                severity: 'MEDIUM'
            });
            if (primaryCause === 'UNKNOWN') primaryCause = 'LOW_VOLUME';
        }

        // 4. Check market regime
        if (trade.analysis.marketRegime === 'ranging' || trade.analysis.adx < 20) {
            issues.push({
                issue: 'RANGING_MARKET',
                detail: `Market was ranging with ADX of ${trade.analysis.adx?.toFixed(1)}`,
                severity: 'HIGH'
            });
            if (primaryCause === 'UNKNOWN') primaryCause = 'RANGING_MARKET';
        }

        // 5. Check stop distance (too tight?)
        const stopDistPercent = parseFloat(trade.priceContext.stopDistancePercent);
        if (stopDistPercent < 1.5) {
            issues.push({
                issue: 'STOP_TOO_TIGHT',
                detail: `Stop was only ${stopDistPercent}% away from entry`,
                severity: 'HIGH'
            });
            if (primaryCause === 'UNKNOWN') primaryCause = 'STOP_TOO_TIGHT';
        }

        // 6. Check confidence level
        if (trade.confidence < 55) {
            issues.push({
                issue: 'LOW_CONFIDENCE',
                detail: `Confidence was ${trade.confidence}% at entry`,
                severity: 'MEDIUM'
            });
            if (primaryCause === 'UNKNOWN') primaryCause = 'LOW_CONFIDENCE';
        }

        // 7. Check signal quality
        if (trade.analysis.signalQuality === 'WEAK') {
            issues.push({
                issue: 'WEAK_SIGNAL',
                detail: 'Signal quality was rated WEAK at entry',
                severity: 'HIGH'
            });
            if (primaryCause === 'UNKNOWN') primaryCause = 'WEAK_SIGNAL';
        }

        // 8. Check if there was NO candlestick confirmation
        if (trade.analysis.candleSignal === 'NEUTRAL' || trade.analysis.candleSignal !== trade.signal) {
            issues.push({
                issue: 'NO_CANDLE_CONFIRMATION',
                detail: `Candlestick pattern was ${trade.analysis.candleSignal}/${trade.analysis.candlePattern}`,
                severity: 'MEDIUM'
            });
        }

        return {
            primaryCause,
            issues,
            issueCount: issues.length,
            recommendation: this.getRecommendation(primaryCause)
        };
    }

    /**
     * Get recommendation based on failure cause
     */
    getRecommendation(cause) {
        const recommendations = {
            'COUNTER_TREND': 'Strictly enforce trend alignment - never trade against the trend',
            'WEAK_TREND': 'Increase minimum trend strength requirement to 60%+',
            'MOMENTUM_MISALIGNED': 'Require momentum to match signal direction',
            'LOW_MOMENTUM': 'Set minimum momentum score threshold of 50+',
            'LOW_VOLUME': 'Always require volume above average for entries',
            'RANGING_MARKET': 'Only trade when ADX > 25 (trending market)',
            'STOP_TOO_TIGHT': 'Increase stop multiplier or minimum stop distance to 2%+',
            'LOW_CONFIDENCE': 'Raise minimum confidence threshold to 60%+',
            'WEAK_SIGNAL': 'Require STRONG or MODERATE signal quality rating',
            'NO_CANDLE_CONFIRMATION': 'Require candlestick pattern confirmation'
        };
        return recommendations[cause] || 'Review trade setup criteria';
    }

    /**
     * Generate failure analysis report
     * @returns {Object} - Complete analysis report
     */
    generateReport() {
        // Calculate averages
        const winners = this.trades.filter(t => t.exit?.isWinner);
        const losers = this.trades.filter(t => t.exit && !t.exit.isWinner);

        const avgWinPercent = winners.length > 0 
            ? winners.reduce((sum, t) => sum + t.exit.profitLossPercent, 0) / winners.length 
            : 0;
        
        const avgLossPercent = losers.length > 0 
            ? losers.reduce((sum, t) => sum + Math.abs(t.exit.profitLossPercent), 0) / losers.length 
            : 0;

        // Aggregate failure reasons
        const failureBreakdown = {};
        losers.forEach(t => {
            if (t.exit.failureAnalysis?.issues) {
                t.exit.failureAnalysis.issues.forEach(issue => {
                    if (!failureBreakdown[issue.issue]) {
                        failureBreakdown[issue.issue] = { count: 0, severity: issue.severity, details: [] };
                    }
                    failureBreakdown[issue.issue].count++;
                    failureBreakdown[issue.issue].details.push({
                        symbol: t.symbol,
                        signal: t.signal,
                        detail: issue.detail
                    });
                });
            }
        });

        // Sort failures by count
        const sortedFailures = Object.entries(failureBreakdown)
            .sort((a, b) => b[1].count - a[1].count)
            .map(([issue, data]) => ({
                issue,
                count: data.count,
                percentage: ((data.count / losers.length) * 100).toFixed(1) + '%',
                severity: data.severity,
                recommendation: this.getRecommendation(issue)
            }));

        // Analyze by symbol performance
        const symbolPerformance = {};
        this.trades.forEach(t => {
            if (!symbolPerformance[t.symbol]) {
                symbolPerformance[t.symbol] = { trades: 0, wins: 0, losses: 0, pnl: 0 };
            }
            symbolPerformance[t.symbol].trades++;
            if (t.exit?.isWinner) {
                symbolPerformance[t.symbol].wins++;
            } else if (t.exit) {
                symbolPerformance[t.symbol].losses++;
            }
            if (t.exit?.profitLoss) {
                symbolPerformance[t.symbol].pnl += t.exit.profitLoss;
            }
        });

        // Calculate win rates per symbol
        Object.keys(symbolPerformance).forEach(symbol => {
            const s = symbolPerformance[symbol];
            const closed = s.wins + s.losses;
            s.winRate = closed > 0 ? ((s.wins / closed) * 100).toFixed(1) + '%' : 'N/A';
        });

        // Analyze by signal direction
        const bullishTrades = this.trades.filter(t => t.signal === 'BULLISH' && t.exit);
        const bearishTrades = this.trades.filter(t => t.signal === 'BEARISH' && t.exit);

        const directionAnalysis = {
            bullish: {
                total: bullishTrades.length,
                wins: bullishTrades.filter(t => t.exit.isWinner).length,
                winRate: bullishTrades.length > 0 
                    ? ((bullishTrades.filter(t => t.exit.isWinner).length / bullishTrades.length) * 100).toFixed(1) + '%'
                    : 'N/A'
            },
            bearish: {
                total: bearishTrades.length,
                wins: bearishTrades.filter(t => t.exit.isWinner).length,
                winRate: bearishTrades.length > 0 
                    ? ((bearishTrades.filter(t => t.exit.isWinner).length / bearishTrades.length) * 100).toFixed(1) + '%'
                    : 'N/A'
            }
        };

        // Analyze by confidence buckets
        const confidenceBuckets = [
            { label: '40-50%', min: 40, max: 50, trades: [], wins: 0 },
            { label: '50-60%', min: 50, max: 60, trades: [], wins: 0 },
            { label: '60-70%', min: 60, max: 70, trades: [], wins: 0 },
            { label: '70-80%', min: 70, max: 80, trades: [], wins: 0 },
            { label: '80%+', min: 80, max: 100, trades: [], wins: 0 }
        ];

        this.trades.forEach(t => {
            if (!t.exit) return;
            const bucket = confidenceBuckets.find(b => t.confidence >= b.min && t.confidence < b.max);
            if (bucket) {
                bucket.trades.push(t);
                if (t.exit.isWinner) bucket.wins++;
            }
        });

        const confidenceAnalysis = confidenceBuckets.map(b => ({
            range: b.label,
            trades: b.trades.length,
            wins: b.wins,
            winRate: b.trades.length > 0 ? ((b.wins / b.trades.length) * 100).toFixed(1) + '%' : 'N/A'
        })).filter(b => b.trades > 0);

        return {
            summary: {
                totalTrades: this.stats.totalTrades,
                winners: this.stats.winners,
                losers: this.stats.losers,
                winRate: this.stats.totalTrades > 0 
                    ? ((this.stats.winners / this.stats.totalTrades) * 100).toFixed(2) + '%' 
                    : 'N/A',
                avgWinPercent: avgWinPercent.toFixed(2) + '%',
                avgLossPercent: avgLossPercent.toFixed(2) + '%',
                profitFactor: avgLossPercent > 0 
                    ? (avgWinPercent / avgLossPercent).toFixed(2) 
                    : 'N/A'
            },
            failureAnalysis: {
                topFailureReasons: sortedFailures.slice(0, 5),
                allFailures: sortedFailures
            },
            symbolPerformance,
            directionAnalysis,
            confidenceAnalysis,
            actionableInsights: this.getActionableInsights(sortedFailures, directionAnalysis, confidenceAnalysis)
        };
    }

    /**
     * Get actionable insights from the analysis
     */
    getActionableInsights(failures, directions, confidence) {
        const insights = [];

        // Top failure reason insight
        if (failures.length > 0) {
            const top = failures[0];
            insights.push({
                priority: 'HIGH',
                insight: `${top.issue} caused ${top.percentage} of failures`,
                action: top.recommendation
            });
        }

        // Direction bias insight
        if (directions.bullish.total > 0 && directions.bearish.total > 0) {
            const bullWR = parseFloat(directions.bullish.winRate);
            const bearWR = parseFloat(directions.bearish.winRate);
            if (Math.abs(bullWR - bearWR) > 10) {
                const better = bullWR > bearWR ? 'BULLISH' : 'BEARISH';
                const worse = bullWR > bearWR ? 'BEARISH' : 'BULLISH';
                insights.push({
                    priority: 'MEDIUM',
                    insight: `${better} trades have ${Math.abs(bullWR - bearWR).toFixed(1)}% higher win rate than ${worse}`,
                    action: `Consider bias toward ${better} signals or improve ${worse} entry criteria`
                });
            }
        }

        // Confidence insight
        const highConfidence = confidence.find(c => c.range === '70-80%' || c.range === '80%+');
        if (highConfidence && highConfidence.trades > 5) {
            const highWR = parseFloat(highConfidence.winRate);
            if (highWR > 60) {
                insights.push({
                    priority: 'HIGH',
                    insight: `High confidence (${highConfidence.range}) trades have ${highConfidence.winRate} win rate`,
                    action: 'Increase minimum confidence threshold to focus on high-quality signals'
                });
            }
        }

        return insights;
    }

    /**
     * Save analysis to file
     */
    saveToFile() {
        const report = this.generateReport();
        const data = {
            generatedAt: new Date(),
            report,
            trades: this.trades
        };
        fs.writeFileSync(TRADE_LOG_FILE, JSON.stringify(data, null, 2));
        return TRADE_LOG_FILE;
    }

    /**
     * Print a summary of the failure analysis
     */
    printFailureReport() {
        const report = this.generateReport();
        
        console.log('\n' + '═'.repeat(60));
        console.log('📊 TRADE FAILURE ANALYSIS REPORT');
        console.log('═'.repeat(60));
        
        console.log('\n📈 SUMMARY:');
        console.log(`   Total Trades: ${report.summary.totalTrades}`);
        console.log(`   Winners: ${report.summary.winners} | Losers: ${report.summary.losers}`);
        console.log(`   Win Rate: ${report.summary.winRate}`);
        console.log(`   Avg Win: +${report.summary.avgWinPercent} | Avg Loss: -${report.summary.avgLossPercent}`);
        console.log(`   Profit Factor: ${report.summary.profitFactor}`);
        
        console.log('\n❌ TOP FAILURE REASONS:');
        report.failureAnalysis.topFailureReasons.forEach((f, i) => {
            console.log(`   ${i + 1}. ${f.issue} (${f.percentage} of losses)`);
            console.log(`      → ${f.recommendation}`);
        });
        
        console.log('\n📊 BY DIRECTION:');
        console.log(`   BULLISH: ${report.directionAnalysis.bullish.total} trades, ${report.directionAnalysis.bullish.winRate} win rate`);
        console.log(`   BEARISH: ${report.directionAnalysis.bearish.total} trades, ${report.directionAnalysis.bearish.winRate} win rate`);
        
        console.log('\n🎯 BY CONFIDENCE:');
        report.confidenceAnalysis.forEach(c => {
            console.log(`   ${c.range}: ${c.trades} trades, ${c.winRate} win rate`);
        });
        
        console.log('\n💡 ACTIONABLE INSIGHTS:');
        report.actionableInsights.forEach((insight, i) => {
            console.log(`   ${i + 1}. [${insight.priority}] ${insight.insight}`);
            console.log(`      → ${insight.action}`);
        });
        
        console.log('\n' + '═'.repeat(60));
        
        return report;
    }
}

// Export singleton
module.exports = new TradeAnalyzer();
