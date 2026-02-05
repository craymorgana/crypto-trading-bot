# 📚 Complete Documentation Index

Welcome to CryptoAI Trading Bot! Here's where to find everything you need.

---

## 🚀 **NEW USER? START HERE**

### First Time Setup

1. **[GETTING_STARTED.md](GETTING_STARTED.md)** ← **Start here!**
   - Step-by-step setup (15 minutes)
   - Kraken API key creation
   - First test in SIMULATED mode
   - How to switch to LIVE mode

2. **[README.md](README.md)**
   - Full feature documentation
   - Strategy details
   - Safety & risk management
   - Troubleshooting guide

3. **[QUICK_START.md](QUICK_START.md)**
   - Quick reference guide
   - Commands & controls
   - Expected behavior

---

## 🔧 **TECHNICAL SETUP**

### Installation

```bash
# Interactive setup wizard (recommended for new users)
npm run setup

# Or manual setup:
npm install
# Edit .env with your Kraken API keys
npm start
```

**Setup Files:**

- `.env.example` - Template for environment variables
- `setup.js` - Interactive setup script
- `package.json` - Dependencies and scripts

---

## 🎮 **USAGE GUIDES**

| Guide                                                | Purpose                            | Time   |
| ---------------------------------------------------- | ---------------------------------- | ------ |
| [GETTING_STARTED.md](GETTING_STARTED.md)             | Complete beginner setup            | 15 min |
| [QUICK_START.md](QUICK_START.md)                     | Command reference & quick overview | 5 min  |
| [README.md](README.md)                               | Full documentation & strategies    | 20 min |
| [BOT_STARTUP_CHECKLIST.md](BOT_STARTUP_CHECKLIST.md) | Detailed component review          | 10 min |
| [FINAL_VERIFICATION.md](FINAL_VERIFICATION.md)       | System status & ready to launch    | 10 min |

---

## 📊 **STRATEGY INFORMATION**

### SWING Trading (Recommended - ULTRA 17%)

**Default mode - High confidence, high reward**

- **Timeframe:** 4-hour candles
- **Risk per Trade:** 17%
- **Confidence Threshold:** 23%+
- **Max Positions:** 7 concurrent
- **Backtest Performance:** +10.72% return, 67.44% win rate

**When to use:**

- ✅ Long-term traders
- ✅ Can monitor 2x daily
- ✅ Want higher profit targets
- ✅ Patient trading style

### SCALPING Mode

**Alternative - Quick trades, lower risk**

- **Timeframe:** 5-minute candles
- **Risk per Trade:** 2%
- **Confidence Threshold:** 60%+
- **Max Positions:** 3 concurrent
- **Best for:** Volatile days

**When to use:**

- ✅ Active day traders
- ✅ Monitor frequently
- ✅ Want quick profits
- ✅ More trading opportunities

---

## 🛠️ **CONFIGURATION & CUSTOMIZATION**

### Default Settings

All configured in: `server/shared/strategy-configs.js`

**To adjust risk:**

```javascript
riskPerTrade: 0.05; // Change from 0.17 to 0.05 (5% instead of 17%)
```

**To add/remove symbols:**

```javascript
tradingSymbols: [
  "BTC/USD",
  "ETH/USD",
  // Add or remove pairs here
];
```

**To change confidence requirement:**

```javascript
minConfidenceThreshold: 30; // Require 30% instead of 23%
```

---

## 💻 **COMMAND REFERENCE**

### npm Scripts

```bash
# Setup & Installation
npm run setup              # Interactive setup wizard
npm install              # Install dependencies

# Running the Bot
npm start                # Start everything (dashboard + bot)
npm run dashboard        # Start just dashboard
npm run bot              # Start just bot

# Testing & Analysis
npm test                 # Run analysis tests
npm run quick-backtest   # Test strategy on recent data
npm run backtest:all     # Full historical backtest
```

---

## 📈 **SIMULATED vs LIVE MODE**

### SIMULATED Mode (Paper Trading)

**✅ Safe for testing**

- No real money at risk
- Exact same signal generation
- Exact same position sizing
- Perfect for learning

**Recommended:** Test 1-2 weeks minimum

### LIVE Mode (Real Trading)

**⚠️ Real money at risk**

- Real Kraken orders
- Real profit/loss
- Requires funded account
- Full attention recommended

**Prerequisites:**

- ✅ Tested in SIMULATED 1+ week
- ✅ Win rate > 50%
- ✅ Funded Kraken account ($50+)
- ✅ Understand risks

---

## 🔐 **SECURITY & API KEYS**

### Getting Started Safely

1. **Create API Key in Kraken**
   - Kraken → Settings → API → Generate New Key
   - Name: "CryptoAI Trading Bot"

2. **Set Correct Permissions**

   ```
   ✓ Query Funds
   ✓ Query Open Orders & Trades
   ✓ Query Closed Orders & Trades
   ✓ Create & Modify Orders
   ✓ Cancel Orders
   ```

3. **Add to .env**

   ```env
   KRAKEN_US_KEY=your_key
   KRAKEN_US_SECRET=your_secret
   ```

4. **Keep Safe**
   - Never commit .env to Git
   - Never share keys
   - Rotate every 30-90 days

See: `.env.example` for template

---

## 📊 **DASHBOARD**

### Access

```
http://localhost:3000
```

### Main Panels

- **Statistics** - Balance, P&L, win rate
- **Open Positions** - Active trades with details
- **Closed Trades** - Historical performance
- **Signal History** - Detection timeline
- **Controls** - Mode selection and emergency stop

### Auto-Refresh

- Updates every 2 seconds
- Live from Kraken API
- No manual refresh needed

---

## 🚨 **EMERGENCY CONTROLS**

### Emergency Stop Button

```
⛔ Cancel All Trades
```

- Cancels ALL open Kraken orders
- Closes ALL positions immediately
- Use if anything goes wrong

### Graceful Shutdown

```bash
# Press CTRL+C in terminal
# Safely stops bot
npm start  # to restart
```

---

## 🐛 **TROUBLESHOOTING**

### Common Issues & Solutions

| Problem              | Solution                       | Reference                                               |
| -------------------- | ------------------------------ | ------------------------------------------------------- |
| Dashboard won't load | Restart bot, wait 3s, refresh  | [QUICK_START.md](QUICK_START.md)                        |
| Shows $0 balance     | Fund Kraken account            | [GETTING_STARTED.md](GETTING_STARTED.md)                |
| No signals appearing | Wait for 4h candle, be patient | [README.md](README.md#troubleshooting)                  |
| Can't switch to LIVE | Confirm dialog, check balance  | [GETTING_STARTED.md](GETTING_STARTED.md#switch-to-live) |
| API key invalid      | Regenerate in Kraken settings  | [Security & API Keys](#security--api-keys)              |
| Bot keeps crashing   | Check .env syntax, verify API  | [BOT_STARTUP_CHECKLIST.md](BOT_STARTUP_CHECKLIST.md)    |

See **Troubleshooting** sections in README.md and GETTING_STARTED.md

---

## 📁 **PROJECT STRUCTURE**

```
crypto-bot/
├── README.md                    ← Full documentation
├── GETTING_STARTED.md          ← Beginner guide (START HERE)
├── QUICK_START.md              ← Quick reference
├── DOCUMENTATION_INDEX.md      ← This file
├── setup.js                    ← Setup wizard
├── .env.example                ← API key template
├── package.json                ← Dependencies
│
├── public/                     ← Web Dashboard
│   ├── index.html
│   └── style.css
│
└── server/                     ← Backend
    ├── start.js               ← Entry point
    ├── dashboard.js           ← API server
    ├── scalper/
    │   └── bot-production.js  ← Trading bot
    └── shared/
        ├── strategy-configs.js ← Parameters
        ├── risk-manager.js    ← Position sizing
        ├── unified-analysis.js ← Signal generation
        └── ... (other modules)
```

---

## 🎯 **QUICK NAVIGATION**

### By User Type

**I'm Brand New**
→ [GETTING_STARTED.md](GETTING_STARTED.md)

**I want quick commands**
→ [QUICK_START.md](QUICK_START.md)

**I want full details**
→ [README.md](README.md)

**I need to troubleshoot**
→ [README.md - Troubleshooting](README.md#troubleshooting)

**I want to customize**
→ `server/shared/strategy-configs.js`

**I want technical details**
→ [BOT_STARTUP_CHECKLIST.md](BOT_STARTUP_CHECKLIST.md)

**I want to verify setup**
→ [FINAL_VERIFICATION.md](FINAL_VERIFICATION.md)

---

## 📞 **SUPPORT RESOURCES**

### Documentation Files

All answers are in these files:

1. GETTING_STARTED.md - Step-by-step guide
2. README.md - Full documentation
3. QUICK_START.md - Quick reference
4. setup.js - Interactive help
5. .env.example - Configuration help

### Kraken API Help

- **API Documentation:** https://docs.kraken.com/api
- **API Status:** https://status.kraken.com
- **Support:** https://support.kraken.com

### Your Computer

- **Node.js Help:** https://nodejs.org
- **npm Help:** https://docs.npmjs.com

---

## ✅ **BEFORE YOU START**

Make sure you have:

```
□ Node.js installed
□ npm installed
□ Kraken account created
□ Read GETTING_STARTED.md
□ Understood simulated vs live mode
□ Know the risks
□ Ready to test first
```

---

## 🎬 **FIRST 5 STEPS**

1. **Read:** [GETTING_STARTED.md](GETTING_STARTED.md)
2. **Run:** `npm run setup`
3. **Start:** `npm start`
4. **Test:** SIMULATED mode for 1-2 weeks
5. **Deploy:** Switch to LIVE when ready

---

## 📊 **SUCCESS METRICS**

### Good Setup Indicators

```
✅ Dashboard loads at http://localhost:3000
✅ Shows your real Kraken balance
✅ Signals detected regularly (every 4-24 hours)
✅ Simulated trades execute
✅ Win rate > 50%
✅ No errors in console
```

### Ready for LIVE?

```
✅ Tested 1-2 weeks in SIMULATED
✅ Win rate > 50%
✅ Funded Kraken account ($50+)
✅ Understand risks
✅ Know how to use emergency stop
```

---

## 🚀 **YOU'RE READY!**

```bash
# First time?
npm run setup

# Then:
npm start

# Visit:
http://localhost:3000
```

**Next step:** Read [GETTING_STARTED.md](GETTING_STARTED.md)

---

## 📝 **Version Information**

- **Version:** 1.0.0
- **Status:** Production Ready ✅
- **Last Updated:** February 2026
- **Tested On:** Windows, Mac, Linux
- **Node.js:** 16+
- **Exchange:** Kraken

---

**Happy Trading! 🎉**

For any questions, check the relevant documentation file above.
