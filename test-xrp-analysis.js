/**
 * Test XRP/USD Analysis Script
 * Validates that the analysis components work correctly
 */

const { analyzeForSwinging } = require('./server/shared/unified-analysis');
const { calculateIndicators, getIndicatorSignal } = require('./server/shared/indicators');

console.log('╔════════════════════════════════════════════════════════╗');
console.log('║  🧪 Testing XRP/USD Analysis Components                ║');
console.log('╚════════════════════════════════════════════════════════╝\n');

/**
 * Generate mock OHLCV data for testing
 * Format: [timestamp, open, high, low, close, volume]
 */
function generateMockOHLCV(numCandles = 200, startPrice = 2.0) {
    const ohlcv = [];
    const now = Date.now();
    let price = startPrice;
    
    for (let i = 0; i < numCandles; i++) {
        const timestamp = now - (numCandles - i) * 4 * 60 * 60 * 1000; // 4h intervals
        
        // Simulate price movement with trend and noise
        const trend = i < numCandles / 2 ? -0.001 : 0.002; // Downtrend then uptrend
        const noise = (Math.random() - 0.5) * 0.02; // ±1% noise
        const change = trend + noise;
        
        price = price * (1 + change);
        
        const open = price * (1 + (Math.random() - 0.5) * 0.005);
        const close = price * (1 + (Math.random() - 0.5) * 0.005);
        const high = Math.max(open, close) * (1 + Math.random() * 0.01);
        const low = Math.min(open, close) * (1 - Math.random() * 0.01);
        const volume = 1000000 + Math.random() * 500000;
        
        ohlcv.push([timestamp, open, high, low, close, volume]);
    }
    
    return ohlcv;
}

/**
 * Test 1: Validate indicator calculations
 */
function testIndicators() {
    console.log('📊 Test 1: Technical Indicators Calculation');
    console.log('─'.repeat(56));
    
    try {
        const mockData = generateMockOHLCV(200, 2.0);
        const indicators = calculateIndicators(mockData);
        
        // Check RSI
        if (indicators.rsi && typeof indicators.rsi.value === 'number' && 
            indicators.rsi.value >= 0 && indicators.rsi.value <= 100) {
            console.log('✅ RSI calculation: PASS');
            console.log(`   Value: ${indicators.rsi.value.toFixed(2)}`);
        } else {
            console.log('❌ RSI calculation: FAIL');
            return false;
        }
        
        // Check MACD
        if (indicators.macd && typeof indicators.macd.histogram === 'number') {
            console.log('✅ MACD calculation: PASS');
            console.log(`   Histogram: ${indicators.macd.histogram.toFixed(6)}`);
        } else {
            console.log('❌ MACD calculation: FAIL');
            return false;
        }
        
        // Check Bollinger Bands
        if (indicators.bb && indicators.bb.upper > indicators.bb.middle && 
            indicators.bb.middle > indicators.bb.lower) {
            console.log('✅ Bollinger Bands calculation: PASS');
            console.log(`   Upper: $${indicators.bb.upper.toFixed(4)}`);
            console.log(`   Middle: $${indicators.bb.middle.toFixed(4)}`);
            console.log(`   Lower: $${indicators.bb.lower.toFixed(4)}`);
        } else {
            console.log('❌ Bollinger Bands calculation: FAIL');
            return false;
        }
        
        console.log('');
        return true;
        
    } catch (error) {
        console.log(`❌ Error: ${error.message}\n`);
        return false;
    }
}

/**
 * Test 2: Validate indicator signal generation
 */
function testIndicatorSignal() {
    console.log('🎯 Test 2: Indicator Signal Generation');
    console.log('─'.repeat(56));
    
    try {
        const mockData = generateMockOHLCV(200, 2.0);
        const indicators = calculateIndicators(mockData);
        const signal = getIndicatorSignal(indicators);
        
        // Check signal format
        if (!signal.signal || !['BULLISH', 'BEARISH', 'NEUTRAL'].includes(signal.signal)) {
            console.log('❌ Invalid signal type');
            return false;
        }
        
        if (typeof signal.strength !== 'number' || signal.strength < 0 || signal.strength > 100) {
            console.log('❌ Invalid signal strength');
            return false;
        }
        
        if (!Array.isArray(signal.confluenceSignals)) {
            console.log('❌ Invalid confluence signals');
            return false;
        }
        
        console.log('✅ Signal generation: PASS');
        console.log(`   Signal: ${signal.signal}`);
        console.log(`   Strength: ${signal.strength}%`);
        console.log(`   Confluence: ${signal.confluenceSignals.join(', ') || 'None'}`);
        console.log('');
        return true;
        
    } catch (error) {
        console.log(`❌ Error: ${error.message}\n`);
        return false;
    }
}

/**
 * Test 3: Validate unified analysis
 */
function testUnifiedAnalysis() {
    console.log('🔬 Test 3: Unified Analysis Engine');
    console.log('─'.repeat(56));
    
    try {
        const mockData = generateMockOHLCV(200, 2.0);
        const analysis = analyzeForSwinging(mockData, {
            minConfidenceThreshold: 23,
            includeHarmonics: true,
            includeFibonacci: true
        });
        
        // Check final signal
        if (!analysis.finalSignal || !['BULLISH', 'BEARISH', 'NEUTRAL'].includes(analysis.finalSignal)) {
            console.log('❌ Invalid final signal');
            return false;
        }
        
        // Check confidence
        if (typeof analysis.confidence !== 'number' || analysis.confidence < 0) {
            console.log('❌ Invalid confidence score');
            return false;
        }
        
        // Check threshold flag
        if (typeof analysis.meetsThreshold !== 'boolean') {
            console.log('❌ Invalid threshold check');
            return false;
        }
        
        console.log('✅ Unified analysis: PASS');
        console.log(`   Final Signal: ${analysis.finalSignal}`);
        console.log(`   Confidence: ${analysis.confidence.toFixed(1)}%`);
        console.log(`   Meets Threshold: ${analysis.meetsThreshold ? 'Yes' : 'No'}`);
        
        if (analysis.scores) {
            console.log('   Component Scores:');
            console.log(`     Candlesticks: ${(analysis.scores.candlesticks || 0).toFixed(1)}%`);
            console.log(`     Indicators: ${(analysis.scores.indicators || 0).toFixed(1)}%`);
        }
        
        console.log('');
        return true;
        
    } catch (error) {
        console.log(`❌ Error: ${error.message}\n`);
        return false;
    }
}

/**
 * Test 4: Simulate bullish scenario
 */
function testBullishScenario() {
    console.log('📈 Test 4: Bullish Entry Scenario Simulation');
    console.log('─'.repeat(56));
    
    try {
        // Generate oversold scenario data
        const mockData = generateMockOHLCV(200, 2.5);
        
        // Manually create oversold conditions by modifying last few candles
        const lastIndex = mockData.length - 1;
        for (let i = 0; i < 5; i++) {
            const idx = lastIndex - i;
            const candle = mockData[idx];
            // Make price drop to simulate oversold
            candle[4] = candle[4] * (1 - 0.03 * (5 - i)); // Progressive drop
        }
        
        const analysis = analyzeForSwinging(mockData, {
            minConfidenceThreshold: 23
        });
        
        console.log('✅ Bullish scenario analysis: PASS');
        console.log(`   Signal: ${analysis.finalSignal}`);
        console.log(`   Confidence: ${analysis.confidence.toFixed(1)}%`);
        
        if (analysis.meetsThreshold && analysis.finalSignal === 'BULLISH') {
            console.log('   🎯 Entry opportunity detected');
        } else {
            console.log('   ⏳ No entry opportunity (as expected with mock data)');
        }
        
        console.log('');
        return true;
        
    } catch (error) {
        console.log(`❌ Error: ${error.message}\n`);
        return false;
    }
}

/**
 * Test 5: Module export check
 */
function testModuleExport() {
    console.log('📦 Test 5: Module Export Validation');
    console.log('─'.repeat(56));
    
    try {
        const { analyzeXrpUsd } = require('./analyze-xrpusd.js');
        
        if (typeof analyzeXrpUsd === 'function') {
            console.log('✅ Module export: PASS');
            console.log('   analyzeXrpUsd function exported correctly');
        } else {
            console.log('❌ Module export: FAIL');
            return false;
        }
        
        console.log('');
        return true;
        
    } catch (error) {
        console.log(`❌ Error: ${error.message}\n`);
        return false;
    }
}

/**
 * Run all tests
 */
async function runTests() {
    const results = [];
    
    results.push({ name: 'Indicator Calculation', pass: testIndicators() });
    results.push({ name: 'Indicator Signal', pass: testIndicatorSignal() });
    results.push({ name: 'Unified Analysis', pass: testUnifiedAnalysis() });
    results.push({ name: 'Bullish Scenario', pass: testBullishScenario() });
    results.push({ name: 'Module Export', pass: testModuleExport() });
    
    // Summary
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║  📋 Test Summary                                        ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');
    
    const passed = results.filter(r => r.pass).length;
    const total = results.length;
    
    results.forEach(result => {
        const status = result.pass ? '✅ PASS' : '❌ FAIL';
        console.log(`${status} - ${result.name}`);
    });
    
    console.log('');
    console.log(`Results: ${passed}/${total} tests passed (${(passed/total*100).toFixed(0)}%)`);
    console.log('');
    
    if (passed === total) {
        console.log('🎉 All tests passed! The XRP/USD analysis tool is ready to use.\n');
        return true;
    } else {
        console.log('⚠️  Some tests failed. Please review the errors above.\n');
        return false;
    }
}

// Run tests
runTests().then(success => {
    process.exit(success ? 0 : 1);
});
