/**
 * Dashboard Server - Serves live trading data and web interface
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const dataLogger = require('./shared/data-logger');
const net = require('net');
const ccxt = require('ccxt');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const app = express();
let PORT = parseInt(process.env.DASHBOARD_PORT || 3000, 10);

// Path to bot mode state file
const BOT_MODE_STATE_FILE = path.join(__dirname, 'shared', 'bot-mode-state.json');
const BOT_EXECUTION_STATE_FILE = path.join(__dirname, 'shared', 'bot-execution-state.json');

// Command handler registry for immediate processing
let closeTradeHandler = null;

// Initialize exchange connection for live trading
let exchange = null;
if (process.env.KRAKEN_US_KEY && process.env.KRAKEN_US_SECRET) {
    exchange = new ccxt.kraken({
        'enableRateLimit': true,
        'apiKey': process.env.KRAKEN_US_KEY,
        'secret': process.env.KRAKEN_US_SECRET
    });
    console.log('✅ Kraken exchange initialized for live trading');
} else {
    console.log('⚠️  Kraken API credentials not found - live trading disabled');
}

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

// Execute trade on Kraken with stop-loss + take-profit
app.post('/api/execute-trade', async (req, res) => {
    try {
        if (!exchange) {
            return res.status(503).json({ error: 'Exchange not connected' });
        }

        const { symbol, side, quantity, entryPrice, stopPrice, takeProfitPrice } = req.body;

        if (!symbol || !side || !quantity) {
            return res.status(400).json({ error: 'Missing required fields: symbol, side, quantity' });
        }

        console.log(`\n📊 EXECUTING TRADE: ${side.toUpperCase()} ${quantity} ${symbol}`);
        console.log(`   Entry: ~$${entryPrice?.toFixed(2) || 'market'}`);
        console.log(`   Stop: $${stopPrice?.toFixed(2) || 'N/A'}`);
        console.log(`   Target: $${takeProfitPrice?.toFixed(2) || 'N/A'}`);

        // Load market info (required for price/amount precision)
        let market;
        try {
            await exchange.loadMarkets();
            market = exchange.market(symbol);
        } catch (err) {
            console.error(`   ❌ Failed to load market info: ${err.message}`);
            return res.status(500).json({ error: `Failed to load market info for ${symbol}: ${err.message}` });
        }

        const minAmount = market.limits?.amount?.min || 0;
        if (quantity < minAmount) {
            console.log(`   ❌ Order size ${quantity} below minimum ${minAmount} for ${symbol}`);
            return res.status(400).json({ 
                error: `Order size ${quantity.toFixed(6)} is below minimum ${minAmount} for ${symbol}`,
                minAmount
            });
        }

        // Apply exchange precision to quantity and prices
        const preciseQty = parseFloat(exchange.amountToPrecision(symbol, quantity));
        const preciseStop = stopPrice ? parseFloat(exchange.priceToPrecision(symbol, stopPrice)) : null;
        const preciseTP = takeProfitPrice ? parseFloat(exchange.priceToPrecision(symbol, takeProfitPrice)) : null;
        console.log(`   🔢 Precision-adjusted: qty=${preciseQty}, stop=${preciseStop}, tp=${preciseTP}`);

        // Build conditional close params for the entry order
        // Kraken supports ONE conditional close per order (attached atomically)
        // ccxt expects a nested 'close' object that it serializes to:
        //   close[ordertype] = order type for the close
        //   close[price]     = trigger price (stop trigger)
        //   close[price2]    = limit price (worst fill price allowed)
        // See: https://docs.kraken.com/api/docs/rest-api/add-order
        // See: https://github.com/ccxt/ccxt/blob/main/examples/py/kraken-conditional-close-order.py
        const orderParams = {};

        if (preciseStop) {
            // Attach stop-loss-limit as conditional close on the entry order
            // This ensures the stop is created atomically when the entry fills
            // Limit price set 0.5% beyond trigger to allow fill in volatile conditions
            const stopLimitRaw = side === 'buy'
                ? preciseStop * 0.995   // Selling to close long: limit slightly below trigger
                : preciseStop * 1.005;  // Buying to close short: limit slightly above trigger
            const preciseStopLimit = parseFloat(exchange.priceToPrecision(symbol, stopLimitRaw));

            // ccxt nested format — gets serialized to close[ordertype], close[price], close[price2]
            // Use numbers (not strings) matching ccxt's official Kraken example
            orderParams.close = {
                ordertype: 'stop-loss-limit',
                price: preciseStop,
                price2: preciseStopLimit
            };
            console.log(`   📎 Conditional close: stop-loss-limit trigger=$${preciseStop}, limit=$${preciseStopLimit}`);
        }

        // Place market order WITH conditional close (stop-loss attached atomically)
        let order;
        try {
            order = await exchange.createMarketOrder(
                symbol,
                side,
                preciseQty,
                undefined,  // price (not used for market orders)
                orderParams // includes close.ordertype, close.price, close.price2
            );
            console.log(`   ✅ Market order executed. ID: ${order.id}`);
            console.log(`   📊 Fill: ${order.filled} @ $${order.average?.toFixed(2) || 'pending'}`);
            if (preciseStop) {
                console.log(`   🛑 Conditional stop-loss-limit attached to entry order`);
            }
        } catch (err) {
            console.error(`   ❌ Order failed: ${err.message}`);
            return res.status(400).json({ 
                error: `Order execution failed: ${err.message}`,
                recovery: 'Position was not opened. No changes to account.'
            });
        }

        // Place take-profit as a SEPARATE order (Kraken only allows 1 conditional close per order)
        // This fires independently once the entry fills
        let tpOrder = null;
        if (preciseTP) {
            try {
                const tpSide = side === 'buy' ? 'sell' : 'buy';
                // Use take-profit-limit for controlled exit at target
                // Limit price set 0.3% beyond trigger to ensure fill
                const tpLimitRaw = side === 'buy'
                    ? preciseTP * 0.997  // Selling to close long: limit slightly below TP trigger
                    : preciseTP * 1.003; // Buying to close short: limit slightly above TP trigger
                const preciseTpLimit = parseFloat(exchange.priceToPrecision(symbol, tpLimitRaw));
                const tpQty = parseFloat(exchange.amountToPrecision(symbol, order.filled || preciseQty));

                // ccxt createOrder 5th arg = Kraken 'price' field = trigger price
                // params.price2 = Kraken 'price2' field = limit price
                tpOrder = await exchange.createOrder(
                    symbol,
                    'take-profit-limit',
                    tpSide,
                    tpQty,
                    preciseTP,            // trigger price (Kraken 'price')
                    { price2: preciseTpLimit }  // limit price (Kraken 'price2')
                );
                console.log(`   🎯 Take-profit-limit order placed: trigger=$${preciseTP}, limit=$${preciseTpLimit} (ID: ${tpOrder.id})`);
            } catch (err) {
                console.warn(`   ⚠️  Take-profit order failed: ${err.message}`);
                console.warn(`   ⚠️  Position is still protected by conditional stop-loss`);
            }
        }

        // Return success with order details
        res.json({
            success: true,
            order: {
                id: order.id,
                symbol: order.symbol,
                side: order.side,
                amount: order.amount,
                filled: order.filled,
                average: order.average,
                status: order.status,
                conditionalClose: preciseStop ? {
                    type: 'stop-loss-limit',
                    triggerPrice: preciseStop,
                    limitPrice: parseFloat(exchange.priceToPrecision(symbol, side === 'buy' ? preciseStop * 0.995 : preciseStop * 1.005))
                } : null
            },
            takeProfit: tpOrder ? {
                id: tpOrder.id,
                type: 'take-profit-limit',
                triggerPrice: preciseTP,
                limitPrice: parseFloat(exchange.priceToPrecision(symbol, side === 'buy' ? preciseTP * 0.997 : preciseTP * 1.003))
            } : null
        });

    } catch (err) {
        console.error('Execute trade error:', err);
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

// Get wallet balance from Kraken
app.get('/api/wallet-balance', async (req, res) => {
    try {
        if (!exchange) {
            return res.status(503).json({ error: 'Exchange not connected' });
        }

        const balance = await exchange.fetchBalance();
        const usdBalance = balance?.USD?.free ?? 0;
        const totalUsd = balance?.USD?.total ?? 0;

        res.json({
            success: true,
            balance: {
                available: usdBalance,
                total: totalUsd,
                currency: 'USD'
            }
        });
    } catch (err) {
        console.error('Failed to fetch wallet balance:', err);
        res.status(500).json({ error: `Failed to fetch balance: ${err.message}` });
    }
});

app.post('/api/bot/execution', async (req, res) => {
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
        
        let message = normalized === 'LIVE' 
            ? '⚠️ LIVE TRADING ENABLED - Real trades will be executed' 
            : 'Simulated trading enabled - No real trades';
        
        let balance = null;

        // Fetch wallet balance when switching to LIVE mode
        if (normalized === 'LIVE' && exchange) {
            try {
                const walletBalance = await exchange.fetchBalance();
                const usdBalance = walletBalance?.USD?.free ?? 0;
                balance = usdBalance;
                message += ` | Wallet Balance: $${usdBalance.toFixed(2)}`;
                
                // Update data logger with live balance
                dataLogger.updateStats({ currentBalance: usdBalance, availableBalance: usdBalance });
            } catch (err) {
                console.warn('Could not fetch wallet balance:', err.message);
            }
        } else if (normalized === 'SIMULATED') {
            // Reset to simulated starting balance
            const simulatedBalance = 10000;
            dataLogger.resetData(simulatedBalance);  // Full reset with correct initialBalance
            balance = simulatedBalance;
        }
        
        res.json({ success: true, message, balance });
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
        console.log(`📈 View live trading data and statistics\n`);
    });
})();

module.exports = { app, dataLogger, registerCloseTradeHandler, registerExchange };
