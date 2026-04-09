# 🚀 Quick Start: XRP/USD Analysis

Get started analyzing XRP/USD price in under 2 minutes!

## Installation

```bash
# 1. Install dependencies (one time)
npm install

# 2. Optional: Add Kraken API keys to .env (for enhanced features)
# You can skip this - the script works without API keys for price data
KRAKEN_US_KEY=your_api_key_here
KRAKEN_US_SECRET=your_api_secret_here
```

## Usage

### Single Analysis Run

```bash
npm run analyze-xrp
```

This will:
- ✅ Fetch current XRP/USD price
- ✅ Calculate technical indicators (RSI, MACD, Bollinger Bands)  
- ✅ Run unified analysis with candlestick patterns
- ✅ Provide clear BUY or WAIT recommendation
- ✅ Show entry price, stop-loss, and take-profit levels
- ✅ Continue monitoring every 4 hours

### Test the Analysis Components

```bash
npm run test:xrp
```

This validates all analysis components work correctly.

## Understanding the Output

### ✅ GOOD ENTRY (Example)

```
════════════════════════════════════════════════════════════
  📊 XRP/USD LONG POSITION ANALYSIS
  02/10/2026, 17:06:19
════════════════════════════════════════════════════════════

📍 CURRENT MARKET STATE:
  Current Price:    $2.1234
  24h Change:       +1.25%

🔍 TECHNICAL INDICATORS:
  RSI(14):          28.45 - OVERSOLD ✓ (Bullish)
  MACD Histogram:   0.000123 - BULLISH ✓
  BB Position:      18.5% - NEAR LOWER BAND ✓ (Bullish)

📊 INDICATOR CONFLUENCE:
  Overall Signal:   BULLISH
  Signal Strength:  70%

🔬 UNIFIED ANALYSIS:
  Final Signal:     BULLISH
  Confidence Score: 90.0%
  Meets Threshold:  ✓ YES (min: 23%)

════════════════════════════════════════════════════════════
  💡 LONG POSITION RECOMMENDATION
════════════════════════════════════════════════════════════

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
  ✓ Price near lower Bollinger Band
```

**Action:** Consider entering a long position at the suggested price with the specified stop-loss and take-profit levels.

---

### ⏳ WAIT FOR BETTER SETUP (Example)

```
════════════════════════════════════════════════════════════
  💡 LONG POSITION RECOMMENDATION
════════════════════════════════════════════════════════════

⏳ NOT A GOOD ENTRY TIME - WAIT FOR BETTER SETUP

❌ REASONS TO WAIT:
  • Confidence 18.2% below 23% threshold
  • No bullish signal detected
    - Unified: NEUTRAL
    - Indicators: BEARISH
  • RSI too high (72.34) - potential overbought
  • MACD histogram negative - bearish momentum

💡 SUGGESTION:
  Wait for:
    - RSI to drop below 40 (oversold)
    - MACD histogram to turn positive
    - Price to approach lower Bollinger Band
    - Confidence score to exceed 23%
```

**Action:** Wait for conditions to improve. The script will continue monitoring and notify you when entry conditions are met.

---

## Key Indicators

| Indicator | Good for Long Entry | Avoid Entry |
|-----------|---------------------|-------------|
| **RSI** | < 40 (oversold) | > 60 (overbought) |
| **MACD Histogram** | > 0 (bullish) | < 0 (bearish) |
| **Bollinger Bands** | < 30% (near lower) | > 70% (near upper) |
| **Confidence** | ≥ 23% | < 23% |
| **Signal** | BULLISH | BEARISH/NEUTRAL |

## Customization

Edit `analyze-xrpusd.js` to change settings:

```javascript
const CONFIG = {
    symbol: 'XRP/USD',
    interval: '4h',              // Change to '1h' for more frequent checks
    minConfidence: 23,           // Lower for more signals (e.g., 20)
    candleCount: 500,
    refreshMinutes: 240          // Change to 60 for hourly checks
};
```

## Common Use Cases

### 1. Check Once and Exit

```bash
# Run analysis, then kill with Ctrl+C after first output
npm run analyze-xrp
# Press Ctrl+C after you see the recommendation
```

### 2. Continuous Monitoring

```bash
# Let it run continuously (checks every 4 hours)
npm run analyze-xrp
# Leave running, press Ctrl+C to stop
```

### 3. Save Results to Log

```bash
# Save all output to a log file
npm run analyze-xrp >> xrp-analysis.log 2>&1
# View log: cat xrp-analysis.log
```

### 4. Background Monitoring (Linux/Mac)

```bash
# Run in background, save to log
nohup npm run analyze-xrp > xrp.log 2>&1 &
# Check log: tail -f xrp.log
# Stop: ps aux | grep analyze-xrpusd | kill <PID>
```

## Tips for Best Results

1. **Wait for 4-hour candle closes** - Most reliable signals appear at candle boundaries
2. **Don't chase** - If you miss an entry, wait for the next signal
3. **Use stop-losses** - Always protect your capital with the suggested stop-loss
4. **Start small** - Test with a small position size first
5. **Combine with fundamentals** - Check XRP news before entering

## Troubleshooting

### "Insufficient data" Error
Wait a few minutes and try again. The exchange needs to return enough historical candles.

### "fetch failed" Error
- Check internet connection
- Kraken API may be temporarily down
- Try again in a few minutes

### Script exits immediately
This is normal if you press Ctrl+C. The script is designed to run continuously.

### No BULLISH signals appearing
This is normal! The market isn't always favorable for long entries. Keep monitoring or lower the `minConfidence` threshold.

## Next Steps

📖 **Detailed Guide:** See [XRP_ANALYSIS_GUIDE.md](XRP_ANALYSIS_GUIDE.md) for comprehensive documentation

🤖 **Full Bot:** See [README.md](README.md) for running the complete trading bot with dashboard

💬 **Questions?** Review the documentation or check the configuration files

---

**Ready to analyze XRP/USD?**

```bash
npm run analyze-xrp
```

Happy trading! 📊🚀
