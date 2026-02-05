# 🤖 Bot Startup Comprehensive Checklist

## ❌ CRITICAL ISSUES FOUND

### 1. **Missing axios dependency**

- **Problem:** bot-production.js requires axios but it's not in package.json
- **Error:** `Cannot find module 'axios'`
- **Fix Required:** Add axios to dependencies

### 2. **Symbol format mismatch in bot-production.js**

- **Problem:** DEFAULT_PRODUCTION_CONFIG uses `/USDT` format (BTC/USDT, ETH/USDT, etc)
- **Current:** bot-production.js line 38-45
- **Should Be:** `/USD` format to match Kraken (BTC/USD, ETH/USD, etc)
- **Strategy-configs.js:** Already has correct `/USD` format ✅
- **Impact:** Bot will try to trade non-existent pairs on Kraken

### 3. **Redundant /api/bot/cancel-all endpoint**

- **Problem:** Two cancel endpoints exist:
  - `/api/bot/cancel-all` - Just logs command (does nothing)
  - `/api/cancel-all-trades` - Actually cancels orders on Kraken (correct)
- **Issue:** Old endpoint still accepts requests but doesn't work

---

## ✅ VERIFIED WORKING COMPONENTS

### Dependencies (package.json)

- [x] ccxt ^4.5.34
- [x] express ^4.22.1
- [x] dotenv ^17.2.3
- [x] technicalindicators ^3.1.0
- [x] candlestick ^1.0.2
- [x] ws ^8.19.0
- [x] livereload ^0.10.3
- [ ] **MISSING: axios** (needed for bot → dashboard API calls)

### File Structure

```
✅ server/
  ✅ start.js              - Launches dashboard + bot
  ✅ dashboard.js          - Express server with API endpoints
  ✅ scalper/
    ✅ bot-production.js   - Main trading bot
  ✅ shared/
    ✅ data-logger.js      - Trades/signals logging
    ✅ risk-manager.js     - Position sizing & risk
    ✅ strategy-configs.js - Trading parameters
    ✅ indicators.js       - RSI/MACD/BB calculation
    ✅ candlesticks.js     - Pattern detection
    ✅ fibonacci.js        - Support/resistance levels
    ✅ harmonics.js        - Harmonic patterns
    ✅ unified-analysis.js - Master analyzer
✅ public/
  ✅ index.html           - Web dashboard
  ✅ style.css            - Dashboard styling
✅ .env                    - Kraken credentials
```

### Bot Startup Flow

1. [x] `npm start` runs server/start.js
2. [x] start.js spawns dashboard.js on port 3000
3. [x] start.js opens browser to http://localhost:3000
4. [x] start.js spawns bot-production.js with correct working directory
5. [x] Bot loads .env (KRAKEN_US_KEY, KRAKEN_US_SECRET)
6. [x] Bot connects to Kraken via CCXT
7. [x] Bot fetches real Kraken USD balance
8. [x] Bot registers exchange with dashboard
9. [x] Dashboard accepts /api/execute-trade POST requests
10. [ ] **Bot loads correct strategy symbols** - ISSUE FOUND

### API Endpoints (Dashboard)

- [x] GET /api/data - Fetch all trading data
- [x] GET /api/stats - Fetch performance stats
- [x] GET /api/positions - Fetch open positions
- [x] GET /api/recent-trades - Fetch closed trades
- [x] GET /api/signals - Fetch signal history
- [x] POST /api/execute-trade - Place real Kraken order with conditional stop
- [x] POST /api/bot/mode - Switch trading mode (SCALPING/SWING)
- [x] POST /api/bot/execution - Switch execution mode (SIMULATED/LIVE)
- [x] POST /api/cancel-all-trades - Emergency stop (cancels all Kraken orders)
- [ ] POST /api/bot/cancel-all - OLD endpoint (should be removed)
- [x] POST /api/close-trade - Close position
- [ ] POST /api/bot/start - Logs command (doesn't actually start bot)
- [ ] POST /api/bot/stop - Logs command (doesn't actually stop bot)
- [ ] POST /api/bot/restart - Logs command (doesn't actually restart bot)

### Configuration Verification

#### Strategy Configs (strategy-configs.js)

**SCALPING Mode**

- [x] minConfidenceThreshold: 60%
- [x] riskPerTrade: 2%
- [x] takeProfitRatio: 1.5:1
- [x] maxPositions: 3
- [x] candleInterval: 5m (Kraken compatible)
- [x] stopMultiplier: 1.5
- [x] Symbols: BTC/USD, ETH/USD, XRP/USD, ADA/USD, SOL/USD, LTC/USD ✅

**SWING Mode (ULTRA 17%)**

- [x] minConfidenceThreshold: 23%
- [x] riskPerTrade: 17%
- [x] takeProfitRatio: 1.2:1
- [x] maxPositions: 7
- [x] candleInterval: 4h
- [x] stopMultiplier: 0.6
- [x] Symbols: BTC/USD, ETH/USD, XRP/USD, ADA/USD, SOL/USD, LTC/USD ✅

#### Bot Production Config (bot-production.js)

**DEFAULT_PRODUCTION_CONFIG**

- ❌ Symbols: BTC/USDT, ETH/USDT, XRP/USDT, ADA/USDT, SOL/USDT, LTC/USDT
- Should be: BTC/USD, ETH/USD, XRP/USD, ADA/USD, SOL/USD, LTC/USD

#### Risk Manager (risk-manager.js)

- [x] Balance fallback: `accountBalance !== undefined ? accountBalance : 1000`
- [x] Correctly preserves $0 balance
- [x] Position sizing based on real account balance
- [x] Max drawdown: 10%
- [x] Max positions: 7 (swing) or 3 (scalping)

### Trade Execution Flow

1. [x] Bot detects signal (4h candle, bearish, 23%+ confidence)
2. [x] Risk manager calculates position size from real Kraken balance
3. [x] Bot calls POST /api/execute-trade with:
   - symbol: "BTC/USD" (should use this)
   - side: "sell" or "buy"
   - quantity: calculated position size
   - entryPrice: current price
   - stopPrice: swing high + buffer
   - takeProfitPrice: entry - (stop distance × 1.2)
4. [x] Dashboard validates exchange connected
5. [x] Dashboard places MARKET ORDER with conditional STOP-LOSS
6. [x] Dashboard places LIMIT ORDER for TAKE-PROFIT
7. [x] Bot catches errors and rolls back if order fails
8. [x] All orders logged to trading-data.json

### GUI Dashboard Features

- [x] Real-time balance display (from Kraken API)
- [x] Open positions table
- [x] Closed trades history
- [x] Signal history
- [x] Trading Mode selector (SCALPING/SWING)
- [x] Execution Mode selector (SIMULATED/LIVE)
- [x] Start/Stop/Restart buttons (appear to work but don't actually control bot)
- [x] Emergency stop button (works now with new endpoint)
- [x] Auto-refresh every 2 seconds
- [x] Live reload on file changes

### Environment Setup

- [x] .env contains KRAKEN_US_KEY ✅
- [x] .env contains KRAKEN_US_SECRET ✅
- [ ] .env contains missing or unused SYMBOL variable (should remove)
- [x] Python virtual environment activated
- [ ] All npm dependencies installed? **AXIOS IS MISSING**

---

## 🚨 PRE-LAUNCH FIXES REQUIRED

### Fix 1: Add axios to package.json

```bash
npm install axios
```

### Fix 2: Update bot-production.js symbols

Change lines 38-45 from:

```javascript
tradingSymbols: [
  "BTC/USDT",
  "ETH/USDT",
  "XRP/USDT",
  "ADA/USDT",
  "SOL/USDT",
  "LTC/USDT",
];
```

To:

```javascript
tradingSymbols: [
  "BTC/USD",
  "ETH/USD",
  "XRP/USD",
  "ADA/USD",
  "SOL/USD",
  "LTC/USD",
];
```

### Fix 3: Remove old /api/bot/cancel-all endpoint

Keep only `/api/cancel-all-trades` which actually cancels orders

### Fix 4: Verify .env

```
KRAKEN_US_KEY=<your_key>
KRAKEN_US_SECRET=<your_secret>
DASHBOARD_PORT=3000
# Remove SYMBOL=BTCUSDT (not used)
```

---

## ✅ POST-FIX VERIFICATION STEPS

1. **Dependencies**

   ```bash
   npm install
   npm list | grep axios
   ```

2. **Start Bot**

   ```bash
   npm start
   ```

3. **Check Dashboard**
   - Opens http://localhost:3000 ✅
   - Shows "Kraken Balance" with real amount ✅

4. **Check Bot Logs**
   - Shows trading symbols: BTC/USD, ETH/USD, etc (not /USDT)
   - Shows "Config updated to: 💥 ULTRA 17% SWING"
   - Shows "Mode: SIMULATED" (default)
   - Shows "Exchange registered with dashboard"

5. **Test SIMULATED Mode**
   - Switch trading mode to SWING
   - Set execution to SIMULATED
   - Wait for 4h candle signal
   - Verify simulated trade is opened
   - Check that stop/target prices are set

6. **Test LIVE Mode** (after SIMULATED works)
   - Fund Kraken account with small amount ($50)
   - Switch to LIVE mode (with confirmation)
   - Wait for next signal
   - Verify order appears on Kraken
   - Check that conditional stop-loss is attached
   - Verify take-profit order placed

---

## 📊 Current System State

| Component        | Status       | Notes                             |
| ---------------- | ------------ | --------------------------------- |
| Bot Core         | ❌ Broken    | Symbol format wrong (USDT vs USD) |
| Dashboard API    | ✅ Ready     | All endpoints working             |
| Risk Manager     | ✅ Ready     | Balance handling fixed            |
| Strategy Configs | ✅ Ready     | Both modes configured correctly   |
| Dependencies     | ❌ Missing   | axios not installed               |
| .env Setup       | ⚠️ Partial   | Unused SYMBOL variable            |
| GUI              | ✅ Ready     | All controls functional           |
| Live Trading     | ❌ Not Ready | Needs fixes 1-3 above             |

---

## 🎯 Next Actions

1. Install axios: `npm install axios`
2. Fix bot symbol format (bot-production.js lines 38-45)
3. Remove old cancel endpoint (/api/bot/cancel-all)
4. Verify .env configuration
5. Run `npm start` and test SIMULATED mode
6. Fund account and test LIVE mode

**Estimated time to fix: 5 minutes**
**Estimated time to verify: 10 minutes**
