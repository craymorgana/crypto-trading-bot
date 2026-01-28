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
            takeProfitRatio: config.takeProfitRatio || 1.5, // 1.5:1 risk/reward
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
    calculatePositionSize(entryPrice, stopPrice, signal) {
        const riskAmount = this.accountBalance * this.config.riskPerTrade;
        const priceRisk = Math.abs(entryPrice - stopPrice);

        if (priceRisk === 0) {
            return { error: 'Invalid stop loss price' };
        }

        const positionSize = riskAmount / priceRisk;
        const targetPrice = signal === 'BULLISH' 
            ? entryPrice + (priceRisk * this.config.takeProfitRatio)
            : entryPrice - (priceRisk * this.config.takeProfitRatio);

        return {
            positionSize,
            riskAmount,
            priceRisk,
            targetPrice,
            riskRewardRatio: this.config.takeProfitRatio,
            profitPotential: positionSize * priceRisk * this.config.takeProfitRatio
        };
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
            tradeData.signal
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
     * @returns {Array} - Positions that should be closed
     */
    checkExitSignals(currentPrice) {
        const exitCandidates = [];

        this.positions.forEach(trade => {
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
            openPositions: this.positions.length
        };
    }
}

module.exports = PositionManager;
