/**
 * Dashboard Server - Serves live trading data and web interface
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const dataLogger = require('./shared/data-logger');
const livereload = require('livereload');
const net = require('net');

const app = express();
let PORT = process.env.DASHBOARD_PORT || 3000;

// Path to bot mode state file
const BOT_MODE_STATE_FILE = path.join(__dirname, 'shared', 'bot-mode-state.json');
const BOT_EXECUTION_STATE_FILE = path.join(__dirname, 'shared', 'bot-execution-state.json');

// Command handler registry for immediate processing
let closeTradeHandler = null;
let exchange = null; // Will be set by bot when it initializes

function registerCloseTradeHandler(handler) {
    closeTradeHandler = handler;
}

function registerExchange(exchangeInstance) {
    exchange = exchangeInstance;
}

// Function to find an available port
const findAvailablePort = (startPort = 3000) => {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.listen(startPort, () => {
            server.close();
            resolve(startPort);
        });
        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                resolve(findAvailablePort(startPort + 1));
            } else {
                resolve(startPort);
            }
        });
    });
};

// Function to find an available port for livereload
const findAvailableLiveReloadPort = (startPort = 35729) => {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.listen(startPort, () => {
            server.close();
            resolve(startPort);
        });
        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                resolve(findAvailableLiveReloadPort(startPort + 1));
            } else {
                resolve(startPort);
            }
        });
    });
};

// Create livereload server with dynamic port
let liveReloadPort = 35729;
const liveReloadServer = livereload.createServer({
    port: liveReloadPort,
    exts: ['js', 'css', 'html'],
    delay: 100
});

liveReloadServer.on('error', async (err) => {
    if (err.code === 'EADDRINUSE') {
        console.log(`⚠️  Port ${liveReloadPort} in use for livereload, trying next port...`);
        liveReloadPort = await findAvailableLiveReloadPort(liveReloadPort + 1);
        // Restart livereload with new port
        try {
            liveReloadServer.close();
            const newLiveReloadServer = livereload.createServer({
                port: liveReloadPort,
                exts: ['js', 'css', 'html'],
                delay: 100
            });
            newLiveReloadServer.watch([
                path.join(__dirname, 'config.js'),
                path.join(__dirname, 'bot.js'),
                path.join(__dirname, '../public')
            ]);
        } catch (e) {
            console.log('⚠️  Could not start livereload server');
        }
    }
});

// Watch config and bot files for changes
liveReloadServer.watch([
    path.join(__dirname, 'config.js'),
    path.join(__dirname, 'bot.js'),
    path.join(__dirname, '../public')
]);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Initialize data file
dataLogger.initializeDataFile();

/**
 * API Endpoints
 */

// Get all trading data
app.get('/api/data', (req, res) => {
    try {
        const data = dataLogger.getAllData();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get stats only
app.get('/api/stats', (req, res) => {
    try {
        const data = dataLogger.getAllData();
        res.json(data.stats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get open positions
app.get('/api/positions', (req, res) => {
    try {
        const data = dataLogger.getAllData();
        const openPositions = data.trades.filter(t => t.status === 'OPEN');
        res.json(openPositions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get recent trades (closed)
app.get('/api/recent-trades', (req, res) => {
    try {
        const data = dataLogger.getAllData();
        const closedTrades = data.trades
            .filter(t => t.status === 'CLOSED')
            .sort((a, b) => new Date(b.exitTime) - new Date(a.exitTime))
            .slice(0, 20);
        res.json(closedTrades);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get recent signals
app.get('/api/signals', (req, res) => {
    try {
        const data = dataLogger.getAllData();
        const recentSignals = data.signals
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, 30);
        res.json(recentSignals);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Execute trade on Kraken with conditional close order (stop-loss) + take-profit
app.post('/api/execute-trade', async (req, res) => {
    try {
        if (!exchange) {
            return res.status(503).json({ error: 'Exchange not connected' });
        }

        const { symbol, side, quantity, entryPrice, stopPrice, takeProfitPrice } = req.body;

        if (!symbol || !side || !quantity || !entryPrice) {
            return res.status(400).json({ error: 'Missing required fields: symbol, side, quantity, entryPrice' });
        }

        console.log(`\n📊 EXECUTING TRADE: ${side.toUpperCase()} ${quantity} ${symbol}`);
        console.log(`   Entry: $${entryPrice.toFixed(2)}`);
        console.log(`   Stop: $${stopPrice?.toFixed(2) || 'N/A'}`);
        console.log(`   Target: $${takeProfitPrice?.toFixed(2) || 'N/A'}`);

        // Build close order (conditional stop-loss) parameters for Kraken
        // When primary market order fills, this stop-loss order will be automatically placed
        let params = {
            'trading_agreement': 'agree'  // Required for margin orders
        };

        if (stopPrice) {
            // Add conditional close order (stop-loss-limit)
            // Opposite side from primary order
            const stopSide = side === 'buy' ? 'sell' : 'buy';
            
            params.close = {
                'ordertype': 'stop-loss-limit',
                'price': stopPrice.toString(),      // Stop trigger price
                'price2': stopPrice.toString()      // Limit price (same as stop for market exit)
            };
            
            console.log(`   🛑 Will attach stop-loss-limit at $${stopPrice.toFixed(2)}`);
        }

        // Add client order ID for tracking
        params['userref'] = Math.floor(Date.now() / 1000);

        // Place market order with conditional close order attached
        let order;
        try {
            order = await exchange.createOrder(
                symbol,
                'market',
                side,
                quantity,
                undefined,  // price (not needed for market orders)
                params
            );
            console.log(`   ✅ Order executed. ID: ${order.id}`);
            console.log(`   📌 Conditional close order (stop-loss) attached`);
        } catch (err) {
            console.error(`   ❌ Order failed: ${err.message}`);
            // Return error but DON'T modify position manager state
            // Caller must verify order before updating internal state
            return res.status(400).json({ 
                error: `Order execution failed: ${err.message}`,
                recovery: 'Position was not opened. No changes to account.'
            });
        }

        // Place take-profit order AFTER entry is confirmed
        let tpOrder = null;
        if (takeProfitPrice) {
            try {
                const tpSide = side === 'buy' ? 'sell' : 'buy';
                tpOrder = await exchange.createOrder(
                    symbol,
                    'limit',
                    tpSide,
                    quantity,
                    takeProfitPrice,
                    {
                        'postonly': true  // Post-only to avoid immediate execution
                    }
                );
                console.log(`   🎯 Take-profit order placed at $${takeProfitPrice.toFixed(2)} (ID: ${tpOrder.id})`);
            } catch (err) {
                // Take-profit failure is non-fatal (entry + stop are more important)
                console.warn(`   ⚠️  Take-profit order failed: ${err.message}`);
            }
        }

        // Log the complete trade to data logger
        dataLogger.logTrade({
            symbol,
            side,
            entryPrice: order.average || entryPrice,
            quantity,
            timestamp: new Date(),
            orderId: order.id,
            stopPrice,
            takeProfitPrice,
            tpOrderId: tpOrder?.id || null,
            status: 'OPEN',
            closeOrderInfo: params.close || null
        });

        res.json({
            success: true,
            message: `Trade executed: ${side.toUpperCase()} ${quantity} ${symbol}`,
            order: {
                id: order.id,
                symbol,
                side,
                quantity,
                price: order.average || entryPrice,
                timestamp: order.datetime
            },
            closeOrder: params.close ? { 
                type: 'stop-loss-limit',
                triggerPrice: stopPrice,
                limitPrice: stopPrice
            } : null,
            takeProfit: tpOrder ? {
                id: tpOrder.id,
                type: 'limit',
                price: takeProfitPrice
            } : null
        });
    } catch (err) {
        console.error('Trade execution error:', err);
        res.status(500).json({ 
            error: `Trade execution error: ${err.message}`,
            recovery: 'Check bot logs for details'
        });
    }
});

// Close trade command
app.post('/api/close-trade', async (req, res) => {
    try {
        const { tradeId } = req.body;
        if (!tradeId) {
            return res.status(400).json({ error: 'Trade ID is required' });
        }

        // If we have a handler registered, process immediately
        if (closeTradeHandler) {
            const result = await closeTradeHandler(tradeId);
            if (result.success) {
                return res.json({ success: true, message: 'Trade closed successfully' });
            } else {
                return res.status(500).json({ error: result.error || 'Failed to close trade' });
            }
        }

        // Fallback to queueing if no handler is registered
        const result = dataLogger.logCommand({
            type: 'CLOSE_POSITION',
            tradeId
        });

        if (result.error) {
            return res.status(500).json({ error: result.error });
        }

        res.json({ success: true, message: 'Close command queued' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Bot control commands
app.post('/api/bot/start', (req, res) => {
    const result = dataLogger.logCommand({ type: 'START_BOT' });
    if (result.error) return res.status(500).json({ error: result.error });
    res.json({ success: true, message: 'Start command queued' });
});

app.post('/api/bot/stop', (req, res) => {
    const result = dataLogger.logCommand({ type: 'STOP_BOT' });
    if (result.error) return res.status(500).json({ error: result.error });
    res.json({ success: true, message: 'Stop command queued' });
});

app.post('/api/bot/restart', (req, res) => {
    const result = dataLogger.logCommand({ type: 'RESTART_BOT' });
    if (result.error) return res.status(500).json({ error: result.error });
    res.json({ success: true, message: 'Restart command queued' });
});

app.post('/api/bot/mode', (req, res) => {
    const { mode } = req.body || {};
    const normalized = typeof mode === 'string' ? mode.toUpperCase() : '';
    if (!['SCALPING', 'SWING'].includes(normalized)) {
        return res.status(400).json({ error: 'Mode must be SCALPING or SWING' });
    }

    try {
        // Write mode to state file so bot can read it
        const modeState = {
            mode: normalized,
            lastUpdated: new Date().toISOString(),
            configuration: 'production'
        };
        fs.writeFileSync(BOT_MODE_STATE_FILE, JSON.stringify(modeState, null, 2));
        
        // Log the command
        dataLogger.logCommand({ type: 'SET_MODE', mode: normalized });
        
        res.json({ success: true, message: `Mode set to ${normalized}` });
    } catch (error) {
        console.error('Failed to set bot mode:', error);
        res.status(500).json({ error: 'Failed to set bot mode' });
    }
});

// Cancel all open trades (Emergency Stop)
app.post('/api/cancel-all-trades', async (req, res) => {
    try {
        if (!exchange) {
            return res.status(503).json({ error: 'Exchange not connected' });
        }

        console.log('\n🚨 EMERGENCY: Canceling all open orders on Kraken...');

        try {
            // Cancel all open orders on Kraken
            await exchange.cancelAllOrders();
            console.log('   ✅ All orders cancelled on Kraken');
        } catch (err) {
            console.error(`   ⚠️  Error canceling orders: ${err.message}`);
            // Continue anyway - some orders may have been cancelled
        }

        // Log the emergency action
        dataLogger.logCommand({ type: 'CANCEL_ALL_TRADES', timestamp: new Date() });

        res.json({ 
            success: true, 
            message: '🚨 Emergency stop executed - All open orders cancelled',
            timestamp: new Date()
        });
    } catch (err) {
        console.error('Cancel all trades error:', err);
        res.status(500).json({ error: `Error canceling trades: ${err.message}` });
    }
});

app.post('/api/bot/execution', (req, res) => {
    const { mode } = req.body || {};
    const normalized = typeof mode === 'string' ? mode.toUpperCase() : '';
    if (!['SIMULATED', 'LIVE'].includes(normalized)) {
        return res.status(400).json({ error: 'Mode must be SIMULATED or LIVE' });
    }

    try {
        // Write execution mode to state file
        const executionState = {
            mode: normalized,
            lastUpdated: new Date().toISOString()
        };
        fs.writeFileSync(BOT_EXECUTION_STATE_FILE, JSON.stringify(executionState, null, 2));
        
        // Log the command
        dataLogger.logCommand({ type: 'SET_EXECUTION_MODE', mode: normalized });
        
        const message = normalized === 'LIVE' 
            ? '⚠️ LIVE TRADING ENABLED - Real trades will be executed' 
            : 'Simulated trading enabled - No real trades';
        
        res.json({ success: true, message });
    } catch (error) {
        console.error('Failed to set execution mode:', error);
        res.status(500).json({ error: 'Failed to set execution mode' });
    }
});

// Serve dashboard HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

// Start server on available port
(async () => {
    PORT = await findAvailablePort(PORT);
    app.listen(PORT, () => {
        console.log(`\n📊 Dashboard running at http://localhost:${PORT}`);
        console.log(`📈 View live trading data and statistics`);
        console.log(`🔄 Live reload enabled - changes to config.js and bot.js detected automatically\n`);
    });
})();

module.exports = { app, dataLogger, registerCloseTradeHandler, registerExchange };
