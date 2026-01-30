/**
 * WebSocket Handler for Coinbase Advanced Trade API
 * Handles real-time market data streaming
 */

const WebSocket = require('ws');
const EventEmitter = require('events');

class CoinbaseWebSocket extends EventEmitter {
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
                // Coinbase WebSocket URL
                const wsUrl = 'wss://advanced-trade-ws.coinbase.com';
                
                this.ws = new WebSocket(wsUrl);

                this.ws.on('open', () => {
                    console.log('📡 WebSocket connected to Coinbase');
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
        const subscribeMessage = {
            type: 'subscribe',
            product_ids: this.config.tradingSymbols,
            channels: [
                {
                    name: 'ticker',
                    product_ids: this.config.tradingSymbols
                }
            ]
        };

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(subscribeMessage));
            console.log(`✅ Subscribed to ${this.config.tradingSymbols.length} trading pairs`);
        }
    }

    handleMessage(message) {
        // Ignore subscription confirmations
        if (message.type === 'subscriptions') {
            return;
        }

        // Handle ticker updates (price data)
        if (message.type === 'ticker') {
            this.emit('price_update', {
                symbol: message.product_id,
                price: parseFloat(message.price),
                timestamp: message.time,
                high24h: parseFloat(message.high_24h),
                low24h: parseFloat(message.low_24h),
                volume30d: parseFloat(message.volume_30d)
            });
        }

        // Handle heartbeats
        if (message.type === 'heartbeat') {
            this.emit('heartbeat', {
                timestamp: message.timestamp,
                sequence: message.sequence
            });
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

module.exports = CoinbaseWebSocket;
