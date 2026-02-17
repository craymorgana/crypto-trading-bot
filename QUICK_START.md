# ⚡ QUICK START GUIDE

## 🚀 Launch Bot

```bash
npm start
```

That's it! This will:

1. Start dashboard on http://localhost:3000
2. Open browser automatically
3. Start trading bot in background
4. Both run with live reload

---

## 🎮 GUI Controls

| Control            | Location      | Action                                  |
| ------------------ | ------------- | --------------------------------------- |
| **Trading Mode**   | Top dropdown  | Select SCALPING or SWING                |
| **Execution Mode** | Next dropdown | Select SIMULATED or LIVE                |
| **Start Bot**      | Button        | Logs command (bot runs from npm start)  |
| **Stop Bot**       | Button        | Logs command (press CTRL+C to stop)     |
| **Restart Bot**    | Button        | Logs command (kill process + npm start) |
| **Emergency Stop** | Red button    | ⛔ Cancels ALL orders on Kraken NOW     |

---

## 📊 Dashboard Display

- **Kraken Balance**: Real amount from API
- **Open Positions**: Active trades with entry/stop/target
- **Closed Trades**: Historical trades with P&L
- **Signal History**: All signals with confidence scores
- **Auto-refresh**: Every 2 seconds from API

---

## 🛑 Emergency Stop

**What it does:**

- Cancels ALL open orders on Kraken
- Closes ALL open positions immediately
- Does NOT stop the bot itself

**When to use:**

- Market crash/unexpected event
- Glitch causing wrong orders
- Manual override needed

---

## 📋 Trading Modes

### SCALPING (5-minute)

- **Risk:** 2% per trade
- **Confidence:** 60%+
- **Max Positions:** 3 concurrent
- **Symbols:** BTC, ETH, XRP, ADA, SOL, LTC
- **R/R Ratio:** 1.5:1 (1% risk → 1.5% profit target)

### SWING (4-hour) - ULTRA 17%

- **Risk:** 17% per trade ⚠️
- **Confidence:** 23%+
- **Max Positions:** 7 concurrent
- **Symbols:** BTC, ETH, XRP, ADA, SOL, LTC
- **R/R Ratio:** 1.2:1 (17% risk → 20% profit target)
- **Filter:** Bearish signals only
- **Backtest:** +10.72% return, 67.44% win rate

---

## 🔴 LIVE Mode Safety

**Before switching to LIVE:**

1. ✅ Test SIMULATED mode first
2. ✅ Fund Kraken account ($100-$500 minimum)
3. ✅ Verify dashboard shows correct Kraken balance
4. ✅ Check that signals generate (4h candles)
5. ✅ Confirm stops/targets calculate correctly
6. ✅ Switch Execution Mode to LIVE (requires confirmation)

**What happens in LIVE:**

- Real orders placed on Kraken
- Real money at risk
- Stops automatically execute
- Profits/losses tracked in real-time

**If something goes wrong:**

- Hit "Emergency Stop" button (cancels all)
- Press CTRL+C to kill bot process
- Check Kraken dashboard for manual intervention

---

## 📈 Expected Behavior

**SIMULATED Mode:**

- Signals printed to console
- Trades logged to trading-data.json
- Dashboard shows simulated P&L
- No real Kraken orders

**LIVE Mode:**

- Signals printed to console
- API call placed to dashboard
- Kraken order placed immediately
- Real money transferred
- Dashboard shows real P&L
- Can take 1-5 seconds to fill

---

## 🐛 Troubleshooting

| Problem                    | Solution                                               |
| -------------------------- | ------------------------------------------------------ |
| Dashboard won't load       | Wait 3 seconds, refresh page, check port 3000          |
| Bot shows balance $0       | Fund Kraken account, bot needs minimum $1              |
| Can't switch to LIVE       | Confirm dialog (click YES), check credentials in .env  |
| Orders not executing       | Check: LIVE mode ON, exchange registered, error logs   |
| Signals not showing        | Wait for 4h candle close (SWING mode), check timeframe |
| Emergency stop not working | Kraken API error, check exchange connection            |

---

## 📞 Critical Info

**Credentials Location:** `.env`

```
KRAKEN_US_KEY=...
KRAKEN_US_SECRET=...
```

**Log Location:** `server/shared/trading-data.json`

- All trades
- All signals
- Performance stats

**Config Locations:**

- Strategy params: `server/shared/strategy-configs.js`
- Risk settings: `server/shared/risk-manager.js`
- Mode state: `server/shared/bot-mode-state.json`
- Execution state: `server/shared/bot-execution-state.json`

---

## ✅ Ready?

```bash
npm start
```

Then:

1. Open http://localhost:3000
2. Check Kraken Balance appears
3. Wait for signals (4h candles)
4. Start with SIMULATED mode
5. Switch to LIVE when confident

**Happy trading! 🚀**
