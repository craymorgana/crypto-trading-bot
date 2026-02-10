/**
 * XRP/USD Long Position Analyzer
 * 
 * Analyzes current XRP/USD price and provides entry recommendations
 * for long positions based on technical indicators and pattern analysis.
 * 
 * Usage: node analyze-xrpusd.js
 */

require('dotenv').config();
const ccxt = require('ccxt');
const { analyzeForSwinging } = require('./server/shared/unified-analysis');
const { calculateIndicators, getIndicatorSignal } = require('./server/shared/indicators');

// Configuration
const CONFIG = {
    symbol: 'XRP/USD',
    interval: '4h',              // 4-hour candles for swing trading
    minConfidence: 23,           // Minimum confidence threshold (%)
    candleCount: 500,            // Number of candles to fetch
    refreshMinutes: 240          // Check every 4 hours (240 minutes)
};

/**
 * Format timestamp as readable string
 */
function formatTimestamp(date) {
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
}

/**
 * Analyze XRP/USD and provide long position recommendation
 */
async function analyzeXrpUsd() {
    console.log('\n' + '═'.repeat(60));
    console.log('  📊 XRP/USD LONG POSITION ANALYSIS');
    console.log('  ' + formatTimestamp(new Date()));
    console.log('═'.repeat(60) + '\n');

    // Initialize Kraken exchange
    const exchange = new ccxt.kraken({
        enableRateLimit: true,
        apiKey: process.env.KRAKEN_US_KEY || '',
        secret: process.env.KRAKEN_US_SECRET || ''
    });

    try {
        // Fetch historical OHLCV data
        console.log(`📥 Fetching ${CONFIG.candleCount} ${CONFIG.interval} candles...`);
        const ohlcv = await exchange.fetchOHLCV(
            CONFIG.symbol,
            CONFIG.interval,
            undefined,
            CONFIG.candleCount
        );

        if (!ohlcv || ohlcv.length < 100) {
            console.error('❌ Insufficient data received. Need at least 100 candles.');
            return;
        }

        const currentPrice = ohlcv[ohlcv.length - 1][4];
        const currentCandle = ohlcv[ohlcv.length - 1];
        const previousCandle = ohlcv[ohlcv.length - 2];
        
        console.log(`✅ Data loaded: ${ohlcv.length} candles\n`);

        // Display current market state
        console.log('📍 CURRENT MARKET STATE:');
        console.log(`  Current Price:    $${currentPrice.toFixed(4)}`);
        console.log(`  24h Change:       ${((currentPrice / previousCandle[4] - 1) * 100).toFixed(2)}%`);
        console.log(`  Current High:     $${currentCandle[2].toFixed(4)}`);
        console.log(`  Current Low:      $${currentCandle[3].toFixed(4)}`);
        console.log(`  Current Volume:   ${currentCandle[5].toFixed(0)}\n`);

        // Calculate technical indicators
        console.log('🔍 TECHNICAL INDICATORS:');
        const indicators = calculateIndicators(ohlcv);
        const indicatorSignal = getIndicatorSignal(indicators);

        // RSI Analysis
        const rsiValue = indicators.rsi.value;
        let rsiStatus = 'NEUTRAL';
        if (rsiValue < 30) rsiStatus = 'OVERSOLD ✓ (Bullish)';
        else if (rsiValue < 40) rsiStatus = 'NEAR OVERSOLD (Slightly Bullish)';
        else if (rsiValue > 70) rsiStatus = 'OVERBOUGHT ✗ (Bearish)';
        else if (rsiValue > 60) rsiStatus = 'NEAR OVERBOUGHT (Slightly Bearish)';

        console.log(`  RSI(14):          ${rsiValue.toFixed(2)} - ${rsiStatus}`);

        // MACD Analysis
        const macdHistogram = indicators.macd.histogram;
        const macdStatus = macdHistogram > 0 ? 'BULLISH ✓' : 'BEARISH ✗';
        console.log(`  MACD Histogram:   ${macdHistogram.toFixed(6)} - ${macdStatus}`);
        console.log(`  MACD Signal:      ${indicators.macd.signal.toFixed(4)}`);
        console.log(`  MACD Value:       ${indicators.macd.macd.toFixed(4)}`);

        // Bollinger Bands Analysis
        const bbPosition = ((currentPrice - indicators.bb.lower) / (indicators.bb.upper - indicators.bb.lower) * 100);
        let bbStatus = 'NEUTRAL';
        if (bbPosition < 20) bbStatus = 'NEAR LOWER BAND ✓ (Bullish)';
        else if (bbPosition > 80) bbStatus = 'NEAR UPPER BAND ✗ (Bearish)';

        console.log(`  BB Upper:         $${indicators.bb.upper.toFixed(4)}`);
        console.log(`  BB Middle:        $${indicators.bb.middle.toFixed(4)}`);
        console.log(`  BB Lower:         $${indicators.bb.lower.toFixed(4)}`);
        console.log(`  BB Position:      ${bbPosition.toFixed(1)}% - ${bbStatus}\n`);

        // Indicator Confluence
        console.log('📊 INDICATOR CONFLUENCE:');
        console.log(`  Overall Signal:   ${indicatorSignal.signal}`);
        console.log(`  Signal Strength:  ${indicatorSignal.strength}%`);
        console.log(`  Aligned Signals:  ${indicatorSignal.confluenceSignals.join(', ') || 'None'}\n`);

        // Run unified analysis
        console.log('🔬 UNIFIED ANALYSIS (Swing Trading):');
        const analysis = analyzeForSwinging(ohlcv, {
            minConfidenceThreshold: CONFIG.minConfidence,
            includeHarmonics: true,
            includeFibonacci: true
        });

        // Display component scores
        console.log('  Component Scores:');
        if (analysis.scores) {
            console.log(`    Candlestick Patterns: ${(analysis.scores.candlesticks || 0).toFixed(1)}%`);
            console.log(`    Technical Indicators: ${(analysis.scores.indicators || 0).toFixed(1)}%`);
            if (analysis.scores.fibonacci) {
                console.log(`    Fibonacci Levels:     +${(analysis.scores.fibonacci || 0).toFixed(1)}%`);
            }
            if (analysis.scores.harmonics) {
                console.log(`    Harmonic Patterns:    +${(analysis.scores.harmonics || 0).toFixed(1)}%`);
            }
        }

        console.log(`\n  Final Signal:     ${analysis.finalSignal}`);
        console.log(`  Confidence Score: ${analysis.confidence.toFixed(1)}%`);
        console.log(`  Meets Threshold:  ${analysis.meetsThreshold ? '✓ YES' : '✗ NO'} (min: ${CONFIG.minConfidence}%)\n`);

        // Generate entry recommendation
        console.log('═'.repeat(60));
        console.log('  💡 LONG POSITION RECOMMENDATION');
        console.log('═'.repeat(60) + '\n');

        const isGoodEntry = analysis.meetsThreshold && 
                           (analysis.finalSignal === 'BULLISH' || indicatorSignal.signal === 'BULLISH');

        if (isGoodEntry) {
            console.log('✅ GOOD ENTRY OPPORTUNITY FOR LONG POSITION\n');

            // Calculate entry parameters
            const entryPrice = currentPrice;
            const stopLossPrice = entryPrice * 0.97;  // 3% stop loss
            const takeProfitPrice = entryPrice * 1.024; // 2.4% take profit
            const riskRewardRatio = ((takeProfitPrice - entryPrice) / (entryPrice - stopLossPrice)).toFixed(2);

            console.log('📈 TRADE SETUP:');
            console.log(`  Entry Price:      $${entryPrice.toFixed(4)}`);
            console.log(`  Stop Loss:        $${stopLossPrice.toFixed(4)} (-3.0%)`);
            console.log(`  Take Profit:      $${takeProfitPrice.toFixed(4)} (+2.4%)`);
            console.log(`  Risk/Reward:      1:${riskRewardRatio}\n`);

            console.log('🎯 REASONING:');
            if (analysis.finalSignal === 'BULLISH') {
                console.log(`  ✓ Unified analysis shows BULLISH signal`);
                console.log(`  ✓ Confidence ${analysis.confidence.toFixed(1)}% exceeds ${CONFIG.minConfidence}% threshold`);
            }
            if (indicatorSignal.signal === 'BULLISH') {
                console.log(`  ✓ Technical indicators aligned bullish (${indicatorSignal.strength}%)`);
            }
            if (rsiValue < 40) {
                console.log(`  ✓ RSI oversold/near oversold (${rsiValue.toFixed(2)})`);
            }
            if (macdHistogram > 0) {
                console.log(`  ✓ MACD histogram positive (bullish momentum)`);
            }
            if (bbPosition < 30) {
                console.log(`  ✓ Price near lower Bollinger Band (potential bounce)`);
            }
            console.log('');

        } else {
            console.log('⏳ NOT A GOOD ENTRY TIME - WAIT FOR BETTER SETUP\n');

            console.log('❌ REASONS TO WAIT:');
            if (!analysis.meetsThreshold) {
                console.log(`  • Confidence ${analysis.confidence.toFixed(1)}% below ${CONFIG.minConfidence}% threshold`);
            }
            if (analysis.finalSignal !== 'BULLISH' && indicatorSignal.signal !== 'BULLISH') {
                console.log(`  • No bullish signal detected`);
                console.log(`    - Unified: ${analysis.finalSignal}`);
                console.log(`    - Indicators: ${indicatorSignal.signal}`);
            }
            if (rsiValue > 60) {
                console.log(`  • RSI too high (${rsiValue.toFixed(2)}) - potential overbought`);
            }
            if (macdHistogram < 0) {
                console.log(`  • MACD histogram negative - bearish momentum`);
            }
            
            console.log('\n💡 SUGGESTION:');
            console.log('  Wait for:');
            console.log('    - RSI to drop below 40 (oversold)');
            console.log('    - MACD histogram to turn positive');
            console.log('    - Price to approach lower Bollinger Band');
            console.log('    - Confidence score to exceed 23%\n');
        }

        console.log('═'.repeat(60));
        console.log(`  Next check: ${formatTimestamp(new Date(Date.now() + CONFIG.refreshMinutes * 60 * 1000))}`);
        console.log('═'.repeat(60) + '\n');

    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        if (error.message.includes('Invalid API-key')) {
            console.error('\n⚠️  API credentials not configured or invalid.');
            console.error('   The script can still fetch price data without API keys.\n');
        }
    }
}

/**
 * Main execution
 */
async function main() {
    console.log('\n🚀 Starting XRP/USD Long Position Analyzer');
    console.log(`   Interval: ${CONFIG.interval} candles`);
    console.log(`   Min Confidence: ${CONFIG.minConfidence}%`);
    console.log(`   Check Frequency: Every ${CONFIG.refreshMinutes} minutes\n`);

    // Run initial analysis
    await analyzeXrpUsd();

    // Set up recurring analysis
    console.log(`⏰ Monitoring enabled. Press Ctrl+C to stop.\n`);
    setInterval(async () => {
        await analyzeXrpUsd();
    }, CONFIG.refreshMinutes * 60 * 1000);
}

// Execute if run directly
if (require.main === module) {
    main().catch(err => {
        console.error('Fatal error:', err);
        process.exit(1);
    });
}

module.exports = { analyzeXrpUsd };
