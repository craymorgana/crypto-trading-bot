/**
 * Dashboard Server - Serves live trading data and web interface
 */

const express = require('express');
const path = require('path');
const dataLogger = require('./data-logger');
const livereload = require('livereload');
const net = require('net');

const app = express();
let PORT = process.env.DASHBOARD_PORT || 3000;

// Command handler registry for immediate processing
let closeTradeHandler = null;

function registerCloseTradeHandler(handler) {
    closeTradeHandler = handler;
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

module.exports = { app, dataLogger, registerCloseTradeHandler };
