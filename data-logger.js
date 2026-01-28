/**
 * Data Logger for Paper Trading
 * Logs all trades, signals, and statistics to JSON for the dashboard
 */

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'trading-data.json');

// Initialize data file if it doesn't exist
function initializeDataFile() {
    if (!fs.existsSync(DATA_FILE)) {
        const initialData = {
            startTime: new Date(),
            trades: [],
            signals: [],
            stats: {
                totalTrades: 0,
                totalWins: 0,
                totalLosses: 0,
                winRate: 0,
                totalProfitLoss: 0,
                currentBalance: 0,
                initialBalance: 0,
                totalReturn: 0,
                openPositions: 0,
                maxDrawdown: 0,
                consecutiveWins: 0,
                consecutiveLosses: 0
            }
        };
        fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
        return initialData;
    }
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

/**
 * Log a new signal for display on dashboard
 */
function logSignal(signalData) {
    try {
        const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        
        data.signals.push({
            timestamp: new Date(),
            symbol: signalData.symbol,
            signal: signalData.signal,
            confidence: signalData.confidence,
            pattern: signalData.pattern,
            indicators: signalData.indicators,
            fibonacci: signalData.fibonacci,
            harmonics: signalData.harmonics,
            meetsThreshold: signalData.meetsThreshold
        });

        // Keep only last 50 signals
        if (data.signals.length > 50) {
            data.signals = data.signals.slice(-50);
        }

        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Error logging signal:', err.message);
    }
}

/**
 * Log a new trade
 */
function logTrade(tradeData) {
    try {
        const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        
        data.trades.push({
            id: tradeData.id,
            symbol: tradeData.symbol,
            signal: tradeData.signal,
            entryTime: tradeData.entryTime,
            entryPrice: tradeData.entryPrice,
            stopPrice: tradeData.stopPrice,
            targetPrice: tradeData.targetPrice,
            confidence: tradeData.confidence,
            pattern: tradeData.pattern,
            indicators: tradeData.indicators,
            status: 'OPEN',
            exitTime: null,
            exitPrice: null,
            profitLoss: null,
            profitLossPercent: null,
            reason: null
        });

        data.stats.openPositions = data.trades.filter(t => t.status === 'OPEN').length;

        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Error logging trade:', err.message);
    }
}

/**
 * Close a trade and update stats
 */
function closeTrade(tradeId, exitPrice, exitReason, profitLoss, profitLossPercent) {
    try {
        const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        
        const trade = data.trades.find(t => t.id === tradeId);
        if (trade) {
            trade.status = 'CLOSED';
            trade.exitTime = new Date();
            trade.exitPrice = exitPrice;
            trade.profitLoss = profitLoss;
            trade.profitLossPercent = profitLossPercent;
            trade.reason = exitReason;

            // Update stats
            data.stats.totalTrades++;
            data.stats.totalProfitLoss += profitLoss;
            
            if (profitLoss > 0) {
                data.stats.totalWins++;
                data.stats.consecutiveWins++;
                data.stats.consecutiveLosses = 0;
            } else if (profitLoss < 0) {
                data.stats.totalLosses++;
                data.stats.consecutiveLosses++;
                data.stats.consecutiveWins = 0;
            }

            data.stats.winRate = data.stats.totalTrades > 0 
                ? ((data.stats.totalWins / data.stats.totalTrades) * 100).toFixed(2)
                : 0;

            data.stats.openPositions = data.trades.filter(t => t.status === 'OPEN').length;
        }

        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Error closing trade:', err.message);
    }
}

/**
 * Update account stats
 */
function updateStats(statsData) {
    try {
        const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        
        data.stats = {
            ...data.stats,
            ...statsData,
            lastUpdate: new Date()
        };

        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Error updating stats:', err.message);
    }
}

/**
 * Get all data for dashboard
 */
function getAllData() {
    try {
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (err) {
        console.error('Error reading data:', err.message);
        return initializeDataFile();
    }
}

/**
 * Reset all data (for new trading session)
 */
function resetData(initialBalance) {
    const initialData = {
        startTime: new Date(),
        trades: [],
        signals: [],
        stats: {
            totalTrades: 0,
            totalWins: 0,
            totalLosses: 0,
            winRate: 0,
            totalProfitLoss: 0,
            currentBalance: initialBalance,
            initialBalance: initialBalance,
            totalReturn: 0,
            openPositions: 0,
            maxDrawdown: 0,
            consecutiveWins: 0,
            consecutiveLosses: 0
        }
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
    return initialData;
}

module.exports = {
    initializeDataFile,
    logSignal,
    logTrade,
    closeTrade,
    updateStats,
    getAllData,
    resetData
};
