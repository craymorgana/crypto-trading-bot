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

// Create livereload server to watch for file changes
const liveReloadServer = livereload.createServer({
    exts: ['js', 'css', 'html'],
    delay: 100
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

module.exports = { app, dataLogger };
