# AI Coding Agent Instructions

## Project Overview
This is a cryptocurrency scalping bot that combines Japanese candlestick patterns, harmonic patterns, Fibonacci levels, and technical indicators (RSI, MACD) on Binance US using CCXT. The bot runs on 3-minute candles, detecting confluence signals for quick entries/exits with tight risk management.

## Architecture & Data Flow

### Core Components
1. **bot.js** - Main event loop that:
   - Connects to Binance US via CCXT
   - Fetches OHLCV data on 3-minute intervals (100 candles for indicator history)
   - Detects when a new candle has *closed* (via timestamp comparison)
   - Calls unified analysis on each new closed candle
   - Manages trade entry/exit logic with PositionManager
   - Logs all signals with formatted analysis output

2. **unified-analysis.js** - Master analysis engine:
   - `analyzeForScalping(ohlcv, options)` - Runs all analyses simultaneously
   - Combines: candlesticks + indicators + Fibonacci + harmonics
   - Scores each signal (0-100) and calculates final confidence
   - Only signals trades when confidence exceeds threshold (default: 60%)
   - Returns: `{finalSignal, confidence, meetsThreshold, signals, scores}`
   - `formatAnalysis()` - Pretty-prints analysis for console logging

3. **risk-manager.js** - PositionManager class:
   - `calculatePositionSize(entryPrice, stopPrice, signal)` - 2% risk per trade, 1.5:1 R/R
   - `openPosition(tradeData)` - Validates max positions, drawdown, then opens trade
   - `closePosition(tradeId, exitPrice)` - Calculates P&L, updates balance
   - `checkExitSignals(currentPrice)` - Returns positions hitting stops or targets
   - `getPerformanceStats()` - Win rate, total return, open positions

4. **candlesticks.js** - Pattern recognition engine:
   - Uses `candlestick` library's `patternChain()` to detect all available patterns
   - Filters results to find patterns on the *last completed candle*
   - Maps patterns to signal strength using `patternWeights` tiers
   - Returns: `{signal, confidence, pattern}`

5. **indicators.js** - Technical analysis engine:
   - `calculateIndicators(ohlcv)` - Computes RSI (14), MACD (12/26/9), Bollinger Bands (20/2)
   - Returns: `{rsi: {value, overbought, oversold}, macd: {value, signal, histogram, bullish/bearish}, bb: {upper, middle, lower}}`
   - `getIndicatorSignal(indicators)` - Confluence detector combining all three indicators
   - Returns: `{signal, strength, confluenceSignals}` - Grades signal strength 0-100%

6. **fibonacci.js** - Support/resistance level calculation:
   - `calculateFibonacciLevels(swingHigh, swingLow)` - Generates retracement levels (23.6%, 38.2%, 50%, 61.8%, 78.6%, 100%, 127.2%, 161.8%, 200%)
   - `getNearestFibLevel(price, fibLevels)` - Identifies closest level to current price
   - `getFibLevelsNear(price, fibLevels, tolerance)` - Returns levels within tolerance band (default: 0.5%)

7. **harmonics.js** - Pattern projection for scalping:
   - `calculateHarmonicLevels([X, A, B, C])` - Measures AB/XA, BC/AB ratios from 4 price points
   - `projectHarmonicD(prices, patternType)` - Projects D completion point for Gartley/Butterfly/Bat patterns
   - `validateHarmonicPattern(currentPrice, prices, patternType, tolerance)` - Checks if price is in pattern D zone (default: 2% tolerance)

8. **test-analysis.js** - Unit test suite:
   - Tests candlestick pattern detection with synthetic OHLCV data
   - Helper: `createCandle(o, h, l, c)` formats as `[time, open, high, low, close, volume]`

9. **data-logger.js** - Trade and signal data persistence:
   - `logSignal()` - Records all analysis signals with confidence and indicator breakdown
   - `logTrade()` - Records new trade entries with all parameters
   - `closeTrade()` - Updates trade status, P&L, and stats
   - `updateStats()` - Persists performance metrics for dashboard
   - Stores all data in `trading-data.json` for dashboard consumption

10. **dashboard.js** - Web interface server:
    - Express server on port 3000 (configurable via DASHBOARD_PORT env)
    - API endpoints: `/api/data`, `/api/stats`, `/api/positions`, `/api/recent-trades`, `/api/signals`
    - Serves static HTML dashboard with real-time data refresh

11. **public/index.html** - Trading dashboard UI:
    - Real-time account metrics (balance, P&L, win rate)
    - Open positions table with entry/stop/target prices
    - Closed trades history with P&L and exit reasons
    - Signal history with confidence breakdown and indicators used
    - Auto-refreshes every 2 seconds from API endpoints

## Key Design Patterns & Critical Details

### Signal Confidence Scoring
- Each analysis source (candlesticks, indicators, Fibonacci, harmonics) generates a score (0-100)
- **Candlesticks**: 40pts (TIER 1), 20-30pts (TIER 2), 5-15pts (TIER 3)
- **Indicators**: 0-100pts based on confluence (RSI + MACD + BB alignment)
- **Fibonacci**: 20pts if price within 0.5% of a Fib level
- **Harmonics**: 25pts if price validates a Gartley pattern D-zone
- Final confidence = sum of all scores, capped at 100%
- **Entry requires: 60%+ confidence AND signal agreement**

### Position & Risk Management
- **Max concurrent positions**: 3 (configurable in risk-manager.js)
- **Risk per trade**: 2% of account balance
- **Risk/reward ratio**: 1.5:1 (stop loss to target)
- **Stop loss**: 1.5x candle range below swing low (bullish) or above swing high (bearish)
- **Take profit**: Calculated from entry + (stop distance × R/R ratio)
- **Max drawdown**: 5% - bot pauses new trades if exceeded
- **Account balance tracking**: Updates on every closed trade

### Candle Timing Logic
- **Live vs. Closed Candle**: The bot intentionally analyzes `ohlcv.slice(0, -1)` to exclude the currently-forming candle
- **Timestamp Detection**: Uses `currentCandleTime !== lastCandleTime` to avoid re-analyzing the same completed candle
- **3-Minute Interval**: Hardcoded in `fetchOHLCV(symbol, '3m', ...)` - changing requires updating all candle references

### Pattern Confidence Tiers (Tier System)
- **TIER 1 (40 pts)**: Triple-candle patterns (morningStar, threeWhiteSoldiers, eveningStar, threeBlackCrows)
- **TIER 2 (20-30 pts)**: Double-candle patterns (bullishEngulfing, piercingLine, bullishKicker)
- **TIER 3 (5-15 pts)**: Single-candle patterns (hammer, shootingStar, doji)
- Confidence values are stored in `patternWeights` object - do NOT hardcode elsewhere

### OHLCV Data Format
All functions use CCXT's standard format: `[timestamp, open, high, low, close, volume]`
- Conversions to objects happen in `analyzeCandlesticks()` only
- Keep numeric precision: use `Number()` when formatting

## Dependencies & External Integrations
- **ccxt** (v4.5.34): Exchange API - single instance in bot.js, reuse for all API calls
- **candlestick** (v1.0.2): Pattern detection via `patternChain(formattedArray, allPatterns)`
- **technicalindicators** (v3.1.0): RSI, MACD, BollingerBands - always use 100-candle history
- **dotenv**: Loads BINANCE_US_KEY, BINANCE_US_SECRET, SYMBOL from .env

## Development Workflows

### Running the Bot (Paper Trading)
```bash
npm install
node bot.js
```
Logs include formatted timestamps, price snapshots, pattern names, and confidence %.

### Running the Dashboard
```bash
node dashboard.js
```
Serves live trading data at `http://localhost:3000`. Includes:
- Real-time account stats (balance, P&L, win rate)
- Open positions with entry/stop/target prices
- Recent closed trades with P&L details
- Signal history with indicator breakdown

### Testing
```bash
node test-analysis.js
```
Validates pattern detection without exchange connection. Useful for debugging pattern matching logic.

### Common Issues
- **No API connection**: Check .env credentials are in production Binance format, not demo
- **Pattern not detected**: Verify candle data is being sliced correctly (excluding current candle)
- **Stale signals**: Review timestamp comparison logic - old candles may be re-analyzed if time check fails
- **Dashboard not loading**: Ensure `npm install express` was run and dashboard.js is running on separate terminal

## Code Quality Standards
- Use consistent `const` for module imports and constants
- OHLCV arrays must be validated: `if (!ohlcv || ohlcv.length < 5) return ...`
- Always `await` exchange API calls - all are async
- Log human-readable output: timestamps, prices with symbols ($), pattern names in uppercase
- Comments explain *why* decisions were made (e.g., why we slice to exclude live candle)
