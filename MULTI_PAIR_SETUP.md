# Multi-Pair Trading Setup Guide

## Overview
The bot has been updated to trade multiple cryptocurrency pairs simultaneously on Binance US (XRP, ETH, HYPE, IOTX).

## Configuration

### 1. Trading Pairs Configuration
Edit [config.js](config.js) to add/remove trading pairs:

```javascript
tradingSymbols: [
    'XRPUSDT',      // Ripple
    'ETHUSDT',      // Ethereum
    'HYPEUSDT',      // Hyperliquid (HYPE)
    'IOTXUSDT'      // IoTeX
]
```

**Format:** Use `SYMBOLUSDT` format (e.g., `BTCUSDT`, `SOLusdt`)

### 2. Risk Parameters
Configure risk management in [config.js](config.js):

```javascript
riskParams: {
    maxPositions: 3,           // Max concurrent positions (across ALL symbols)
    riskPerTrade: 0.02,        // 2% risk per trade
    takeProfitRatio: 1.5,      // 1.5:1 risk/reward ratio
    maxDrawdown: 0.05,         // 5% max drawdown threshold
    accountBalance: 1000       // Starting balance
}
```

### 3. Analysis Parameters
Fine-tune analysis settings in [config.js](config.js):

```javascript
analysisParams: {
    minConfidenceThreshold: 60,     // Minimum confidence % to enter (0-100)
    candleInterval: '3m',            // 3-minute candles
    ohlcvHistory: 100,              // Fetch 100 candles for indicators
    checkInterval: 10000            // Check every 10 seconds (ms)
}
```

## How It Works

### Main Loop (`bot.js`)
- **Fetches data** for all symbols in sequence (every 10 seconds)
- **Analyzes each symbol** independently using the same technical analysis engine
- **Manages positions** across all symbols with shared risk budget
- **Position limit:** `maxPositions` applies to total open trades across all pairs, not per pair

### Position Management
- Each trade is tagged with its symbol (`symbol` field in trade object)
- `checkExitSignals()` can filter by symbol to check only relevant positions
- Account balance is shared across all symbol trades (e.g., if you lose 2% on XRP, that reduces capital available for ETH)

### Console Output
- Logs show symbol prefix: `[XRPUSDT]`, `[ETHUSDT]`, etc.
- Trade entries/exits show full details with symbol
- Performance stats aggregate across all pairs

## Running the Bot

```bash
# Start dashboard (separate terminal)
npm run dashboard

# Start bot with multiple pairs
npm run bot
```

or

```bash
# Start everything together
npm start
```

## Monitoring

### Web Dashboard (`http://localhost:3000`)
- **Real-time Metrics:** Balance, total P&L, win rate
- **Open Positions:** Shows all open trades with symbol, entry, stop, target
- **Closed Trades:** History with P&L breakdown
- **Signals:** Recent analysis signals for each symbol
- **Auto-refresh:** Every 2 seconds

### Console Logs
Look for symbol prefixes like:
- `[XRPUSDT] 🟢 NEW TRADE OPENED` - New trade entry
- `[ETHUSDT] ✅ TRADE CLOSED` - Trade exit
- `📈 PERFORMANCE:` - Overall stats

## Adding New Pairs

1. Edit [config.js](config.js) `tradingSymbols` array
2. Use format: `SYMBOLUSDT` (must exist on Binance US)
3. No code changes needed - bot will automatically fetch and analyze the new pair
4. Restart the bot: `npm run bot`

**Tip:** Verify the pair exists on Binance US before adding:
```bash
# Check available pairs
curl https://api.binance.us/api/v3/exchangeInfo | grep -i "SYMBOL"
```

## Troubleshooting

### Bot won't start
- Check `.env` file has valid `BINANCE_US_KEY` and `BINANCE_US_SECRET`
- Verify Binance US API keys have "Spot Trading" enabled

### No trades opening
- Check console for analysis confidence scores
- Verify symbol exists on Binance US (case-sensitive: `XRPUSDT`)
- Lower `minConfidenceThreshold` in config to test

### Positions stuck
- Check if stop loss or take profit prices are unrealistic
- Verify current market price vs. stop/target levels in console

### Too many losses
- Increase `minConfidenceThreshold` to be more selective
- Review which patterns/indicators are generating false signals
- Check `candleInterval` (3-minute is default)

## Performance Tips

1. **Fewer pairs = faster loops** - Removing unused pairs speeds up analysis
2. **Increase check interval** - Change `checkInterval: 10000` to `20000` (20s) to reduce API calls
3. **Adjust position limit** - Reduce `maxPositions` to limit concurrent trades
4. **Monitor account balance** - Very low balance = very small position sizes

## Key Files Modified

- **[bot.js](bot.js)** - Main loop now processes all symbols
- **[config.js](config.js)** - NEW: Central configuration for all pairs and parameters
- **[risk-manager.js](risk-manager.js)** - `checkExitSignals()` now supports symbol filtering

All analysis engines ([unified-analysis.js](unified-analysis.js), [indicators.js](indicators.js), [candlesticks.js](candlesticks.js), etc.) remain unchanged and work per-symbol.
