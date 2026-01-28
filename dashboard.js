/**
 * Dashboard Server - Serves live trading data and web interface
 */

const express = require('express');
const path = require('path');
const dataLogger = require('./data-logger');

const app = express();
const PORT = process.env.DASHBOARD_PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`\n📊 Dashboard running at http://localhost:${PORT}`);
    console.log(`📈 View live trading data and statistics\n`);
});

module.exports = { app, dataLogger };
