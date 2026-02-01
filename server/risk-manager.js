/**
 * Position and Risk Management for scalping
 * Tracks open positions, calculates risk/reward, and manages stops/targets
 */

class PositionManager {
    constructor(config = {}) {
        this.positions = [];
        this.closedTrades = [];

        // Risk configuration
        this.config = {
            maxPositions: config.maxPositions || 3,
            riskPerTrade: config.riskPerTrade || 0.02, // 2% risk per trade
            takeProfitRatio: config.takeProfitRatio || 1.5, // base R/R
            takeProfitRatioHigh: config.takeProfitRatioHigh || 2.5, // higher R/R for high confidence
            takeProfitRatioLow: config.takeProfitRatioLow || 1.4, // lower R/R for low confidence
            confidenceHigh: config.confidenceHigh || 70,
            confidenceLow: config.confidenceLow || 45,
            maxDrawdown: config.maxDrawdown || 0.05, // 5% max drawdown
            ...config
        };

        this.accountBalance = config.accountBalance || 1000;
        this.initialBalance = this.accountBalance;
    }

    /**
     * Calculate position size and stop loss based on entry price and risk
     * @param {number} entryPrice - Entry price
     * @param {number} stopPrice - Stop loss price
     * @param {string} signal - 'BULLISH' or 'BEARISH'
     * @returns {Object} - Position sizing details
     */
    calculatePositionSize(entryPrice, stopPrice, signal, confidence = 0) {
        // Fix: Use "Risk Per Trade" as "Allocation Per Trade" (Spot Trading Mode)
        // Instead of calculating size based on stop loss distance (which implies leverage),
        // we simply invest a fixed percentage of the account balance per trade.
        const investmentAmount = this.accountBalance * this.config.riskPerTrade;

        // Calculate units to buy based on investment amount
        const positionSize = investmentAmount / entryPrice;

        const priceRisk = Math.abs(entryPrice - stopPrice);

        // Calculate the actual dollar risk if the stop is hit
        const riskAmount = positionSize * priceRisk;

        const takeProfitRatio = this.getTakeProfitRatio(confidence);

        const targetPrice = signal === 'BULLISH'
            ? entryPrice + (priceRisk * takeProfitRatio)
            : entryPrice - (priceRisk * takeProfitRatio);

        return {
            positionSize,
            riskAmount,         // Dollar amount lost if stop is hit
            investmentAmount,   // Dollar amount invested (held)
            priceRisk,
            targetPrice,
            riskRewardRatio: takeProfitRatio,
            profitPotential: positionSize * (Math.abs(targetPrice - entryPrice))
        };
    }

    /**
     * Dynamically select take-profit ratio based on confidence
     * @param {number} confidence - 0 to 100
     * @returns {number}
     */
    getTakeProfitRatio(confidence) {
        if (confidence >= this.config.confidenceHigh) {
            return this.config.takeProfitRatioHigh;
        }
        if (confidence <= this.config.confidenceLow) {
            return this.config.takeProfitRatioLow;
        }

        // Interpolate between low and high ratios for mid confidence
        const range = this.config.confidenceHigh - this.config.confidenceLow;
        const t = range === 0 ? 0 : (confidence - this.config.confidenceLow) / range;
        return this.config.takeProfitRatioLow + (this.config.takeProfitRatioHigh - this.config.takeProfitRatioLow) * t;
    }

    /**
     * Open a new position
     * @param {Object} tradeData - {symbol, signal, entryPrice, stopPrice, confidence, analysis}
     * @returns {Object} - Trade details or error
     */
    openPosition(tradeData) {
        // Check max positions
        if (this.positions.length >= this.config.maxPositions) {
            return { error: `Max positions (${this.config.maxPositions}) reached` };
        }

        // Check current drawdown
        const currentDrawdown = (this.initialBalance - this.accountBalance) / this.initialBalance;
        if (currentDrawdown > this.config.maxDrawdown) {
            return { error: `Max drawdown (${this.config.maxDrawdown * 100}%) exceeded` };
        }

        const sizing = this.calculatePositionSize(
            tradeData.entryPrice,
            tradeData.stopPrice,
            tradeData.signal,
            tradeData.confidence || 0
        );

        if (sizing.error) return sizing;

        const trade = {
            id: `trade_${Date.now()}`,
            symbol: tradeData.symbol,
            signal: tradeData.signal,
            entryPrice: tradeData.entryPrice,
            stopPrice: tradeData.stopPrice,
            targetPrice: sizing.targetPrice,
            positionSize: sizing.positionSize,
            riskAmount: sizing.riskAmount,
            confidence: tradeData.confidence || 0,
            timestamp: new Date(),
            analysis: tradeData.analysis || {},
            status: 'OPEN'
        };

        this.positions.push(trade);
        return { success: true, trade };
    }

    /**
     * Close a position
     * @param {string} tradeId - Trade ID to close
     * @param {number} exitPrice - Exit price
     * @returns {Object} - Trade result with P&L
     */
    closePosition(tradeId, exitPrice) {
        const tradeIndex = this.positions.findIndex(t => t.id === tradeId);
        if (tradeIndex === -1) {
            return { error: 'Trade not found' };
        }

        const trade = this.positions[tradeIndex];
        const priceDifference = exitPrice - trade.entryPrice;
        const profitLoss = trade.positionSize * priceDifference;
        const profitLossPercent = (priceDifference / trade.entryPrice) * 100;

        const closedTrade = {
            ...trade,
            exitPrice,
            profitLoss,
            profitLossPercent,
            status: 'CLOSED',
            exitTimestamp: new Date(),
            holdTime: new Date() - trade.timestamp
        };

        this.closedTrades.push(closedTrade);
        this.positions.splice(tradeIndex, 1);
        this.accountBalance += profitLoss;

        return { success: true, trade: closedTrade };
    }

    /**
     * Check if any positions should be closed based on stops or targets
     * @param {number} currentPrice - Current market price
     * @param {string} symbol - Optional: filter by symbol
     * @returns {Array} - Positions that should be closed
     */
    checkExitSignals(currentPrice, symbol = null) {
        const exitCandidates = [];

        this.positions.forEach(trade => {
            // Filter by symbol if provided
            if (symbol && trade.symbol !== symbol) {
                return;
            }

            let exitReason = null;

            // Check stop loss (tighter for scalping)
            if (trade.signal === 'BULLISH' && currentPrice <= trade.stopPrice) {
                exitReason = 'STOP_HIT';
            } else if (trade.signal === 'BEARISH' && currentPrice >= trade.stopPrice) {
                exitReason = 'STOP_HIT';
            }

            // Check take profit target
            if (trade.signal === 'BULLISH' && currentPrice >= trade.targetPrice) {
                exitReason = 'TARGET_HIT';
            } else if (trade.signal === 'BEARISH' && currentPrice <= trade.targetPrice) {
                exitReason = 'TARGET_HIT';
            }

            if (exitReason) {
                exitCandidates.push({
                    tradeId: trade.id,
                    exitPrice: currentPrice,
                    reason: exitReason,
                    trade
                });
            }
        });

        return exitCandidates;
    }

    /**
     * Calculate available balance (total balance minus capital tied up in open positions)
     * @returns {number} - Available balance for new trades
     */
    getAvailableBalance() {
        const capitalInvested = this.positions.reduce((sum, trade) => {
            return sum + trade.positionSize * trade.entryPrice;
        }, 0);
        
        return Math.max(0, this.accountBalance - capitalInvested);
    }

    /**
     * Get performance statistics
     * @returns {Object} - Performance metrics
     */
    getPerformanceStats() {
        if (this.closedTrades.length === 0) {
            return { trades: 0, message: 'No closed trades yet' };
        }

        const wins = this.closedTrades.filter(t => t.profitLoss > 0);
        const losses = this.closedTrades.filter(t => t.profitLoss < 0);
        const totalProfitLoss = this.closedTrades.reduce((sum, t) => sum + t.profitLoss, 0);
        const winRate = (wins.length / this.closedTrades.length) * 100;

        return {
            totalTrades: this.closedTrades.length,
            wins: wins.length,
            losses: losses.length,
            winRate: winRate.toFixed(2) + '%',
            totalProfitLoss: totalProfitLoss.toFixed(2),
            totalReturn: ((totalProfitLoss / this.initialBalance) * 100).toFixed(2) + '%',
            currentBalance: this.accountBalance.toFixed(2),
            availableBalance: this.getAvailableBalance().toFixed(2),
            openPositions: this.positions.length
        };
    }
}

module.exports = PositionManager;
