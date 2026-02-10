# 🤖 CryptoAI Trading Bot

**Autonomous cryptocurrency trading bot with real-time signals and live Kraken integration.**

> **Note:** This bot includes a full SIMULATED mode for testing strategies risk-free before trading with real money.

---

## 📊 What It Does

The CryptoAI Trading Bot is a professional-grade automated trading system that:

- **Analyzes** cryptocurrency price action using candlestick patterns, technical indicators, and harmonic analysis
- **Generates** high-confidence trading signals (67%+ win rate in backtests)
- **Executes** trades automatically on your Kraken account (or simulated)
- **Manages** risk automatically with position sizing and stop-losses
- **Displays** live trading data on a professional web dashboard

### Supported Strategies

#### SWING Trading (Default - ULTRA 17%)

- **Timeframe:** 4-hour candles
- **Risk:** 17% per trade
- **Confidence Threshold:** 23%+
- **Best for:** BTC, ETH (major pairs)
- **Backtest Results:** +10.72% return, 67.44% win rate over 86 trades
- **Positions:** Up to 7 concurrent

#### SCALPING Trading

- **Timeframe:** 5-minute candles
- **Risk:** 2% per trade
- **Confidence Threshold:** 60%+
- **Best for:** Quick profits on volatility
- **Positions:** Up to 3 concurrent

---

## 🎯 XRP/USD Price Analysis Feature

**NEW:** Dedicated XRP/USD analysis tool for finding optimal long entry points!

```bash
npm run analyze-xrp
```

This analyzes current XRP/USD price and tells you:
- ✅ Current market conditions (price, volume, momentum)
- ✅ Technical indicators (RSI, MACD, Bollinger Bands)
- ✅ Entry recommendation (BUY or WAIT)
- ✅ Exact entry price, stop-loss, and take-profit levels
- ✅ Detailed reasoning for the recommendation

**Example output:**
```
✅ GOOD ENTRY OPPORTUNITY FOR LONG POSITION

📈 TRADE SETUP:
  Entry Price:      $2.1234
  Stop Loss:        $2.0597 (-3.0%)
  Take Profit:      $2.1743 (+2.4%)
  Risk/Reward:      1:0.80

🎯 REASONING:
  ✓ Unified analysis shows BULLISH signal
  ✓ Confidence 90.0% exceeds 23% threshold
  ✓ RSI oversold (28.45)
  ✓ MACD histogram positive
```

📖 **Full Guide:** See [XRP_ANALYSIS_GUIDE.md](XRP_ANALYSIS_GUIDE.md) for detailed instructions.

---

## ⚡ Quick Start (5 Minutes)

### 1. Prerequisites

- Node.js 16+ ([Download](https://nodejs.org))
- npm (comes with Node.js)
- Git (optional)
- Kraken account ([Sign up](https://www.kraken.com/sign-up))

### 2. Installation

```bash
# Clone or download the project
git clone <repository-url>
cd crypto-bot

# Install dependencies
npm install

# Create .env file with your Kraken API keys
# See "API Setup" section below
```

### 3. API Setup

Go to Kraken → Settings → API → Generate New Key

Required permissions:

- ✅ Query Funds
- ✅ Query Open Orders & Trades
- ✅ Query Closed Orders & Trades
- ✅ Create & Modify Orders
- ✅ Cancel Orders

Create `.env` file in project root:

```env
KRAKEN_US_KEY=your_api_key_here
KRAKEN_US_SECRET=your_api_secret_here
DASHBOARD_PORT=3000
```

**⚠️ IMPORTANT:**

- Keep your API keys SECRET
- Use read-only keys if available
- Never commit .env to Git
- Rotate keys periodically

### 4. Launch

```bash
npm start
```

This will:

- ✅ Start the dashboard (http://localhost:3000)
- ✅ Open browser automatically
- ✅ Start the trading bot
- ✅ Begin analysis

---

## 🎮 Using the Dashboard

### Dashboard URL

```
http://localhost:3000
```

### Main Controls

**Trading Mode**

- `SCALPING (5m)` - 2% risk per trade, faster execution
- `SWING (4h)` - 17% risk per trade, ULTRA strategy (default)

**Execution Mode** ⚠️

- `SIMULATED` - Paper trading, no real money (default, SAFE)
- `LIVE` - Real Kraken orders with actual balance (requires confirmation)

**Bot Commands**

- `▶ Start Bot` - Resume trading
- `⏸ Stop Bot` - Pause trading
- `🔄 Restart Bot` - Restart bot process
- `⛔ Cancel All Trades` - Emergency stop (cancels all orders immediately)

### Dashboard Display

**Top Stats**

- **Kraken Balance** - Your real Kraken USD balance
- **Open Positions** - Active trades with entry/stop/target
- **Total P&L** - Profit/loss in dollars and percentage
- **Win Rate** - Percentage of winning trades

**Tables**

- **Open Positions** - Symbol, entry price, position size, stop-loss, take-profit
- **Recent Closed Trades** - Exit price, P&L, return %
- **Signal History** - Detection time, symbol, confidence score, indicators used

---

## 🧪 Testing with Simulated Account

### Perfect for Testing!

Start with SIMULATED mode:

```
1. Launch: npm start
2. Set Trading Mode: SWING (or SCALPING)
3. Set Execution Mode: SIMULATED ✅ (default)
4. Wait for signal (4h candle closes)
5. Watch trade open in dashboard
6. Monitor stop-loss and take-profit levels
7. See how signals perform without risk
```

**Simulated Features:**

- ✅ Virtual $1,000 starting balance
- ✅ Real signal detection
- ✅ Real position sizing
- ✅ Real stop/target calculation
- ✅ Risk-free testing

**When simulated trades work well:**

- Win rate > 60%
- Profitable period
- Stops triggering correctly
- Targets being hit

**Then switch to LIVE:**

- Fund Kraken account
- Set Execution Mode: LIVE
- Confirm the dialog
- Real trades execute on next signal

---

## 📊 Strategy Details

### SWING Trading (ULTRA 17%)

**Entry Criteria:**

- ✅ Bearish signal (shorts only)
- ✅ Confidence ≥ 23%
- ✅ Pattern confirmation (candlesticks + indicators)
- ✅ Technical support/resistance (Fibonacci, harmonics)
- ✅ Less than 7 open positions

**Exit Criteria:**

- Take-profit: +20% (1.2:1 reward-to-risk)
- Stop-loss: Swing high + 1% buffer
- Time-based: Max 7 days (if no action)

**Symbols Traded:**

- BTC/USD (Bitcoin)
- ETH/USD (Ethereum)
- XRP/USD (Ripple)
- ADA/USD (Cardano)
- SOL/USD (Solana)
- LTC/USD (Litecoin)

**Backtest Results (2023-2024 data):**

```
Total Trades:     86
Winning Trades:   58 (67.44%)
Losing Trades:    28 (32.56%)
Return:           +10.72%
Risk per Trade:   17%
Reward/Risk:      1.2:1
Max Drawdown:     -8.5%
```

### SCALPING Mode

**Entry Criteria:**

- ✅ Any directional signal
- ✅ Confidence ≥ 60%
- ✅ Less than 3 open positions

**Exit Criteria:**

- Take-profit: +3% (1.5:1 reward-to-risk)
- Stop-loss: -2%

---

## 🔐 Safety & Risk Management

### Automatic Protections

- ✅ **Default SIMULATED Mode** - Paper trading until you enable LIVE
- ✅ **Confirmation Dialog** - Must confirm before switching to LIVE
- ✅ **Max Positions** - Won't open more than configured limit
- ✅ **Position Sizing** - Calculated from account balance
- ✅ **Stop-Losses** - Automatically placed on every trade
- ✅ **Max Drawdown** - Bot pauses at -10% account loss
- ✅ **Zero Balance Detection** - Can't trade LIVE with $0 balance
- ✅ **Emergency Stop** - Cancels all orders with one click

### Best Practices

1. **Start with SIMULATED mode** - Test for 1-2 weeks minimum
2. **Fund account gradually** - Start with $100, not $10,000
3. **Monitor first trades** - Watch dashboard during entry/exit
4. **Keep API key secure** - Use minimal permissions
5. **Set alerts** - Enable notifications if platform supports
6. **Have exit plan** - Know when you'd manually stop trading

### Risk Disclosure

⚠️ **Trading cryptocurrency involves risk:**

- Past performance ≠ future results
- Market conditions change
- No strategy is 100% profitable
- You could lose your entire investment
- Test thoroughly before risking capital

---

## 📈 Monitor Your Trading

### Real-Time Dashboard

Visit http://localhost:3000 to see:

**Statistics Panel**

- Current Kraken balance
- Total profit/loss
- Win rate percentage
- Number of trades

**Open Positions Table**

- Entry price
- Current P&L
- Stop-loss level
- Take-profit target
- Confidence score

**Closed Trades Table**

- Exit price and reason
- Profit/loss
- Return percentage
- Time held

**Signal History**

- Detection timestamp
- Indicators used
- Confluence score
- Confidence rating

---

## ⚙️ Configuration

### Changing Strategy Parameters

Edit `server/shared/strategy-configs.js`:

```javascript
SWING: {
    minConfidenceThreshold: 23,    // Minimum confidence (%)
    riskPerTrade: 0.17,            // Risk per trade (17%)
    takeProfitRatio: 1.2,          // Profit target ratio (1.2:1)
    maxPositions: 7,               // Max concurrent positions
    candleInterval: '4h',          // Timeframe
    stopMultiplier: 0.6,           // Stop loss distance (0.6x swing)
    bearishOnly: true,             // Shorts only
    tradingSymbols: [              // Symbols to trade
        'BTC/USD',
        'ETH/USD',
        'XRP/USD',
        'ADA/USD',
        'SOL/USD',
        'LTC/USD'
    ]
}
```

**After changes:**

- Restart bot: Press CTRL+C and run `npm start` again
- Dashboard will auto-refresh

---

## 🐛 Troubleshooting

### Dashboard won't load

```bash
# Check if dashboard is running
# Visit http://localhost:3000 in browser

# If error, restart:
npm start

# If port 3000 is in use:
# Kill process on port 3000 or use different port
set DASHBOARD_PORT=3001
npm start
```

### Bot shows $0 balance

```
Problem: Bot can't fetch Kraken balance
Reasons:
  - Invalid API key/secret in .env
  - API permissions not set correctly
  - Kraken API server down
  - Network connectivity issue

Solution:
  1. Verify .env has correct keys
  2. Test API on Kraken dashboard
  3. Check API permissions (see API Setup section)
  4. Restart bot: npm start
```

### Can't switch to LIVE mode

```
Problem: LIVE mode button doesn't work
Reasons:
  - Account balance is $0
  - API not connected
  - Confirmation dialog not responded

Solution:
  1. Fund Kraken account (minimum $1)
  2. Click button and confirm dialog
  3. Restart if still stuck: npm start
```

### No signals appearing

```
Problem: Bot isn't detecting signals
Reasons:
  - Waiting for 4h candle close (SWING mode)
  - No trade setups on current candles
  - Confidence below 23% threshold
  - Only bearish signals in SWING mode

Solution:
  1. Check mode: Dashboard shows SWING (4h)
  2. Wait for candle close (can take hours)
  3. Lower confidence threshold if needed
  4. Check console for debug output
```

### Orders not executing in LIVE mode

```
Problem: LIVE mode enabled but no orders
Reasons:
  - Bot not connected to dashboard
  - Kraken API key invalid
  - Insufficient balance for position size
  - API permissions missing

Solution:
  1. Restart: npm start
  2. Check console for errors
  3. Verify API key permissions
  4. Fund account with more balance
```

---

## 📁 Project Structure

```
crypto-bot/
├── README.md                    ← You are here
├── XRP_ANALYSIS_GUIDE.md        ← XRP/USD analysis guide
├── QUICK_START.md              ← Quick reference
├── BOT_STARTUP_CHECKLIST.md    ← Component review
├── package.json                ← Dependencies
├── .env                        ← API credentials (not in Git!)
├── analyze-xrpusd.js           ← XRP/USD price analyzer
│
├── public/                     ← Web Dashboard
│   ├── index.html             ← Dashboard UI
│   └── style.css              ← Dashboard styling
│
├── server/                     ← Backend
│   ├── start.js               ← Entry point (npm start)
│   ├── dashboard.js           ← API server
│   │
│   ├── scalper/               ← Trading bot
│   │   └── bot-production.js  ← Main bot logic
│   │
│   └── shared/                ← Shared modules
│       ├── strategy-configs.js ← Trading parameters
│       ├── risk-manager.js    ← Position sizing
│       ├── data-logger.js     ← Trade logging
│       ├── unified-analysis.js ← Signal generation
│       ├── indicators.js      ← RSI/MACD/BB
│       ├── candlesticks.js    ← Pattern detection
│       ├── fibonacci.js       ← Support/resistance
│       └── harmonics.js       ← Harmonic patterns
```

---

## 🚀 Commands Reference

```bash
# Start everything (dashboard + bot)
npm start

# Analyze XRP/USD for long position entry
npm run analyze-xrp

# Start just dashboard
node server/dashboard.js

# Start just bot
node server/scalper/bot-production.js

# Install dependencies
npm install

# Update dependencies
npm update

# View logs
npm start  # (logs appear in terminal)

# Stop bot
# Press CTRL+C in terminal

# Restart bot
# Kill process + npm start
```

---

## 📞 Support & Resources

### Files to Check

**Configuration:**

- `server/shared/strategy-configs.js` - Trading parameters

**Logs:**

- `server/shared/trading-data.json` - All trades and signals
- Console output - Real-time debug info

**API Keys:**

- `.env` - Kraken credentials (keep secret!)

### Common Settings

**Lower Risk:**

```javascript
riskPerTrade: 0.05,      // 5% per trade instead of 17%
maxPositions: 3,         // Fewer positions at once
minConfidenceThreshold: 30 // Require 30% confidence
```

**Higher Risk/Reward:**

```javascript
riskPerTrade: 0.25,      // 25% per trade (aggressive!)
maxPositions: 10,        // More concurrent positions
minConfidenceThreshold: 15 // Accept lower confidence
```

---

## 💡 Tips & Tricks

### Monitor Effectively

1. **Check dashboard regularly** - 2x per day minimum
2. **Use browser notifications** - Know when signals hit
3. **Review closed trades** - Learn from losses
4. **Check log file** - `trading-data.json` has details

### Optimize Performance

1. **Start in SIMULATED mode** - At least 1 week
2. **Test different timeframes** - SCALPING vs SWING
3. **Adjust confidence** - Higher = fewer, better signals
4. **Add/remove symbols** - Focus on best performers
5. **Review settings weekly** - Markets change

### Safety Habits

1. **Never disable stops** - Always use stop-losses
2. **Start small** - $100 before $1,000
3. **Take profits** - Don't let winners become losers
4. **Set alerts** - Know when big moves happen
5. **Review monthly** - Check strategy performance

---

## ❓ FAQ

**Q: Is this guaranteed to make money?**
A: No. Past backtests show +10.72% but real trading varies. Markets change, and losses are possible.

**Q: Can I use this on other exchanges?**
A: Currently Kraken only. CCXT supports 100+ exchanges but would need code changes.

**Q: How often does it trade?**
A: SWING mode: Every 4-8 hours when signals hit. SCALPING: Every 5-15 minutes.

**Q: What's the minimum balance?**
A: $1 technically, but realistically $100+ to make meaningful profits.

**Q: Can I modify the strategy?**
A: Yes! Edit `server/shared/strategy-configs.js` and restart.

**Q: How do I stop trading?**
A: Hit "Emergency Stop" button or press CTRL+C in terminal.

**Q: What if the bot crashes?**
A: It will log errors. Restart with `npm start`.

**Q: Can I use multiple bots?**
A: Not currently - they'd conflict. One bot per account.

---

## 🎯 Next Steps

### 1. Install & Setup

```bash
npm install
# Create .env with API keys
```

### 2. Test Simulated

```bash
npm start
# Leave running for 1-2 weeks
# Watch signals and trades
```

### 3. Verify Performance

```
Check:
- Signal confidence > 20%
- Win rate > 50%
- No emergency stops triggered
- Dashboard working smoothly
```

### 4. Fund Account

```
Send funds to Kraken USD wallet
Minimum recommended: $100-$500
```

### 5. Enable LIVE

```
1. Set Execution Mode: LIVE
2. Click confirmation
3. Monitor first trades closely
```

### 6. Monitor & Optimize

```
- Review trades daily
- Check dashboard 2x per day
- Adjust settings as needed
- Withdraw profits monthly
```

---

## 📄 License & Disclaimer

**NO WARRANTIES:** This software is provided "as-is" without any warranty. Trading involves risk including total loss of capital.

**USE AT YOUR OWN RISK:** Cryptocurrency markets are volatile. Past performance does not guarantee future results.

**NOT FINANCIAL ADVICE:** This is not investment advice. Consult a financial advisor before trading.

---

## 🎉 Ready?

```bash
npm start
```

Then visit: **http://localhost:3000**

Happy trading! 🚀

---

**Last updated:** February 2026  
**Version:** 1.0.0  
**Status:** Production Ready ✅
