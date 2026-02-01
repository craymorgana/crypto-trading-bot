/**
 * WebSocket Handler for Kraken API
 * Handles real-time market data streaming
 */

const WebSocket = require('ws');
const EventEmitter = require('events');

class KrakenWebSocket extends EventEmitter {
    constructor(config) {
        super();
        this.config = config;
        this.ws = null;
        this.subscriptions = [];
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 3000;
    }

    connect() {
        return new Promise((resolve, reject) => {
            try {
                // Kraken WebSocket URL (public feeds don't require auth)
                const wsUrl = 'wss://ws.kraken.com/';
                
                this.ws = new WebSocket(wsUrl);

                this.ws.on('open', () => {
                    console.log('📡 WebSocket connected to Kraken');
                    this.reconnectAttempts = 0;
                    this.subscribe();
                    resolve();
                });

                this.ws.on('message', (data) => {
                    this.handleMessage(JSON.parse(data));
                });

                this.ws.on('error', (error) => {
                    console.error('❌ WebSocket error:', error.message);
                    reject(error);
                });

                this.ws.on('close', () => {
                    console.log('⚠️  WebSocket disconnected');
                    this.attemptReconnect();
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    subscribe() {
        // Kraken subscription format
        // Converts symbols from CCXT format (BTC/USD) to Kraken format (XBT/USD, etc.)
        const krakenPairs = this.config.tradingSymbols.map(symbol => {
            // Kraken uses XBT instead of BTC
            return symbol.replace('BTC/', 'XBT/');
        });

        const subscribeMessage = {
            event: 'subscribe',
            pair: krakenPairs,
            subscription: {
                name: 'ticker'
            }
        };

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(subscribeMessage));
            console.log(`✅ Subscribed to ${krakenPairs.length} trading pairs on Kraken`);
        }
    }

    handleMessage(message) {
        // Ignore status/event messages
        if (message.event) {
            return;
        }

        // Kraken sends array format: [channelID, data, channelName, pair]
        if (Array.isArray(message) && message.length >= 4) {
            const data = message[1];
            const channelName = message[2];
            let pair = message[3];

            // Handle ticker channel
            if (channelName === 'ticker' && data) {
                // Kraken ticker format: [bid, bidVolume, ask, askVolume, spread, spreadPercentage, 
                // lastTrade, lastTradeVolume, volumeToday, volumeAverage, priceHigh, priceLow, 
                // priceOpen, vwap]
                const price = parseFloat(data[2]); // ask price
                const high24h = parseFloat(data[10]);
                const low24h = parseFloat(data[11]);
                
                // Convert Kraken format (XBT) back to standard BTC for consistency
                const symbol = pair.replace('XBT/', 'BTC/');
                
                this.emit('price_update', {
                    symbol: symbol,
                    price: price,
                    timestamp: new Date().toISOString(),
                    high24h: high24h,
                    low24h: low24h,
                    volume30d: parseFloat(data[8]) // volume today
                });
            }
        }
    }

    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`🔄 Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            
            setTimeout(() => {
                this.connect().catch(err => {
                    console.error('Reconnection failed:', err.message);
                });
            }, this.reconnectDelay * this.reconnectAttempts);
        } else {
            console.error('❌ Max reconnection attempts reached');
            process.exit(1);
        }
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}

module.exports = KrakenWebSocket;
