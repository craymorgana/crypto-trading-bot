# 🎯 Getting Started Guide

**Complete step-by-step setup for first-time users.**

---

## ⏱️ Total Time: 15 minutes

---

## Step 1: Prerequisites (2 minutes)

### What You Need

- ✅ Computer (Windows/Mac/Linux)
- ✅ Node.js 16+ ([Download here](https://nodejs.org))
- ✅ Kraken account ([Sign up free](https://www.kraken.com/sign-up))
- ✅ Text editor (VS Code, Notepad, etc)

### Verify Node.js is installed

```bash
node --version
npm --version
```

Should show version numbers like `v16.x.x` and `8.x.x`

---

## Step 2: Download Project (2 minutes)

### Option A: Clone with Git

```bash
git clone <repository-url>
cd crypto-bot
```

### Option B: Download ZIP

1. Click "Code" → "Download ZIP"
2. Extract to a folder
3. Open terminal in that folder

---

## Step 3: Kraken API Setup (5 minutes)

### Get Your API Keys

1. **Log in to Kraken** → https://www.kraken.com

2. **Navigate to Settings**
   - Settings (gear icon)
   - API

3. **Create New Key**
   - Click "Generate New Key"
   - Name it: `CryptoAI Trading Bot`
   - Category: `Trading`

4. **Set Permissions** (check these boxes)

   ```
   ☑️ Query Funds
   ☑️ Query Open Orders & Trades
   ☑️ Query Closed Orders & Trades
   ☑️ Create & Modify Orders
   ☑️ Cancel Orders
   ```

5. **Copy Your Keys**
   - Keep them open for next step

### Create .env File

1. **Open text editor** (Notepad, VS Code, etc)

2. **Paste this template:**

   ```env
   KRAKEN_US_KEY=YOUR_API_KEY_HERE
   KRAKEN_US_SECRET=YOUR_API_SECRET_HERE
   DASHBOARD_PORT=3000
   ```

3. **Replace the placeholders:**
   - `YOUR_API_KEY_HERE` ← paste your API key
   - `YOUR_API_SECRET_HERE` ← paste your API secret

4. **Save as `.env`** in project root
   - **NOT** `.env.txt`
   - **NOT** `.env.md`
   - Must be named exactly: `.env`

5. **⚠️ Important:**
   - Never share this file
   - Don't upload to Git
   - Keep it safe

---

## Step 4: Install Dependencies (3 minutes)

```bash
# Open terminal in project folder
# On Windows: shift + right-click → "Open PowerShell here"

npm install
```

Wait for it to complete (should see "added X packages")

---

## Step 5: Launch Bot (1 minute)

```bash
npm start
```

You should see:

```
🤖 Crypto Scalping Bot - Full Startup

📊 Starting Dashboard Server...
🌐 Opening Browser to http://localhost:3000...
🚀 Starting Trading Bot (Production Mode)...
```

Browser will open automatically to http://localhost:3000

---

## Step 6: First Time Configuration (2 minutes)

### Dashboard Appears ✅

You should see:

- **Kraken Balance** showing your USD balance
- **Trading Mode** selector
- **Execution Mode** selector
- **Open Positions** table (empty at first)

### Set Your Preferences

1. **Choose Trading Mode**
   - Default: `SWING (4h)` ← Recommended
   - Alternative: `SCALPING (5m)` for faster trading

2. **Choose Execution Mode**
   - Default: `SIMULATED` ← Start here!
   - `LIVE` only after testing

3. **Leave running**
   - Dashboard auto-updates every 2 seconds
   - Bot analyzes candles in background
   - Signals appear when detected

---

## 📊 What to Expect

### First Hour

```
✅ Bot connects to Kraken
✅ Fetches real balance
✅ Begins analyzing candles
✅ Dashboard shows "Waiting for signal"
```

### First Signal (4-8 hours)

```
✅ Console shows: "📈 SIGNAL DETECTED"
✅ Dashboard shows: New open position
✅ Entry price, stop-loss, take-profit displayed
✅ Wait for exit (stop or profit)
```

### First Exit (4-24 hours)

```
✅ Position closes (hit stop or target)
✅ Shows P&L in dashboard
✅ Moves to "Closed Trades" table
✅ Stats updated (win rate, total return)
```

---

## 🧪 Test with Simulated Mode

### Safe to Leave Running!

In SIMULATED mode:

- ✅ No real money involved
- ✅ No actual Kraken orders
- ✅ Perfect for testing
- ✅ Exact same signals as LIVE
- ✅ Exact same position sizing

### Run for 1-2 Weeks

1. Let bot run 24/7
2. Watch signals accumulate
3. Check if win rate > 60%
4. See if P&L is positive
5. Once confident → Switch to LIVE

### Signs It's Working

```
Good signs:
✅ Signals detected regularly (every 4-24 hours)
✅ Win rate > 50% (more winning trades)
✅ Total return positive (even if small)
✅ Stops trigger correctly
✅ No errors in console

Bad signs:
❌ No signals ever detected
❌ Win rate < 30%
❌ Large drawdowns
❌ Stops not triggering
❌ Errors in console
```

---

## 💰 When Ready: Switch to LIVE

### Prerequisites

- ✅ Tested SIMULATED for 1+ week
- ✅ Win rate > 50%
- ✅ Funded Kraken account (minimum $50)
- ✅ Understand the risks

### How to Switch

1. **Fund Kraken**
   - Go to Funding → Deposit
   - Add USD to your account
   - Minimum: $50-$100

2. **Wait for confirmation**
   - Balance appears in Kraken account
   - Dashboard updates with new balance

3. **Switch Mode**
   - Dashboard → Execution Mode dropdown
   - Select: `LIVE`
   - Click confirmation dialog (red warning!)

4. **Next signal executes live**
   - Real order placed on Kraken
   - Real money at risk
   - Real profit/loss

---

## 🚨 Emergency Stop

### If Something Goes Wrong

**Click "⛔ Cancel All Trades"**

```
This will:
✅ Cancel ALL open orders immediately
✅ Close ALL open positions at market price
✅ Stop the bleeding fast
```

**To Stop Bot**

```bash
# Press CTRL+C in terminal
# This kills the process
# Run "npm start" to restart
```

---

## 📈 Monitor Your Trades

### Check Dashboard Daily

**Morning Check:**

- Any overnight signals?
- Open positions still open?
- Any stops hit?

**Before Bed:**

- Any positions close to exit?
- Set mental alert for tomorrow

**Weekly Review:**

- Total P&L positive?
- Win rate > 50%?
- Any anomalies?

### View Detailed Data

All trades logged in: `server/shared/trading-data.json`

- Contains every trade ever made
- Entry/exit prices
- P&L
- Timestamp

---

## ⚙️ Customization

### After Getting Comfortable

You can modify settings in:
`server/shared/strategy-configs.js`

**Reduce Risk:**

```javascript
riskPerTrade: 0.05; // 5% instead of 17%
```

**More Trades:**

```javascript
minConfidenceThreshold: 18; // 18% instead of 23%
```

**Different Symbols:**

```javascript
tradingSymbols: [
  "BTC/USD",
  "ETH/USD",
  // Add/remove as desired
];
```

**After changes:**

- Restart bot: `npm start`
- Settings take effect immediately

---

## 🐛 Troubleshooting

### "Dashboard won't load"

```
Solution:
1. Check: http://localhost:3000 in browser
2. If error, restart: npm start
3. Wait 3 seconds, refresh page
```

### "Shows $0 balance"

```
Solution:
1. Add funds to Kraken USD wallet
2. Restart bot: npm start
3. Dashboard will update
```

### "No signals appearing"

```
Solution:
1. Check trading mode: SWING (4h candles)
2. Signals only on candle close
3. May take 4-24 hours first signal
4. Check console for debug output
```

### "Can't switch to LIVE"

```
Solution:
1. Fund Kraken account ($50+)
2. Dashboard shows new balance
3. Click execution mode dropdown
4. Select LIVE and confirm
```

### "Errors in console"

```
Solution:
1. Restart: npm start
2. Check .env file exists
3. Verify API keys are correct
4. Check Kraken API status
```

---

## 💡 Best Practices

### Daily Habits

- ✅ Check dashboard 2x per day
- ✅ Review new trades
- ✅ Monitor for anomalies
- ✅ Keep bot running 24/7

### Weekly Habits

- ✅ Review total P&L
- ✅ Check win rate
- ✅ Verify stops are working
- ✅ Withdraw profits

### Monthly Habits

- ✅ Analyze performance
- ✅ Adjust settings if needed
- ✅ Rotate API keys
- ✅ Update bot software

### Safety Habits

- ✅ Never disable stops
- ✅ Always use SIMULATED first
- ✅ Start with small amounts
- ✅ Keep API key secret

---

## 📞 Help & Support

### Check These Files

- **README.md** - Full documentation
- **QUICK_START.md** - Quick reference
- **BOT_STARTUP_CHECKLIST.md** - Detailed review

### Still Stuck?

1. Check console for error messages
2. Verify .env file syntax
3. Restart bot completely
4. Review API key permissions
5. Check Kraken API status

### Common Issues & Fixes

| Issue             | Fix                                     |
| ----------------- | --------------------------------------- |
| API key invalid   | Regenerate new key in Kraken settings   |
| Permission denied | Add "Create & Modify Orders" permission |
| Can't login       | Verify email/password on Kraken         |
| No signals        | Wait for 4h candle close, be patient    |
| Bot crashes       | Restart: npm start, check logs          |

---

## ✅ Checklist: Ready to Trade?

Before going LIVE, verify:

```
□ Node.js installed (node --version works)
□ npm installed (npm --version works)
□ .env file created with API keys
□ npm install completed
□ npm start runs without errors
□ Dashboard loads at http://localhost:3000
□ Kraken balance displays correctly
□ Tested SIMULATED mode for 1+ week
□ Win rate > 50% in simulated trades
□ Understand the risks
□ Funded Kraken account ($50+)
□ Ready to switch to LIVE mode
```

---

## 🎉 You're Ready!

```bash
npm start
```

Visit: http://localhost:3000

**Let the bot do the work! 🚀**

---

## 📚 Next Reading

1. **README.md** - Understand how it works
2. **QUICK_START.md** - Command reference
3. **Strategy details** - How signals are generated
4. **API permissions** - Kraken security best practices

---

**Happy Trading! 📈**

_Remember: Start with SIMULATED mode, test thoroughly, then go LIVE with confidence._
