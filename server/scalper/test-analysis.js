const { analyzeCandlesticks } = require('../shared/candlesticks');

// Helper to create a candle: [time, open, high, low, close, volume]
const createCandle = (o, h, l, c) => [0, o, h, l, c, 0];

const testCases = [
    {
        name: "Bullish Engulfing Pattern",
        data: [
            createCandle(100, 105, 95, 100), // Filler
            createCandle(100, 105, 95, 100), // Filler
            createCandle(100, 105, 95, 100), // Filler
            createCandle(100, 102, 88, 90),  // Prev: Small Red
            createCandle(89, 105, 88, 103),  // Curr: Big Green (Engulfs)
        ]
    },
    {
        name: "Morning Star Pattern",
        data: [
            createCandle(100, 105, 95, 100), // Filler
            createCandle(100, 105, 95, 100), // Filler
            createCandle(110, 112, 98, 100), // 1: Big Red
            createCandle(99, 100, 94, 95),   // 2: Small "Star" Gap
            createCandle(96, 108, 95, 107),  // 3: Big Green
        ]
    },
    {
        name: "Single Hammer",
        data: [
            createCandle(100, 105, 95, 100),
            createCandle(100, 105, 95, 100),
            createCandle(100, 105, 95, 100),
            createCandle(100, 105, 95, 100),
            createCandle(100, 101, 80, 99),  // Small body, long lower wick
        ]
    }
];

console.log("--- STARTING CANDLESTICK TEST SUITE ---");

testCases.forEach(test => {
    const result = analyzeCandlesticks(test.data);
    console.log(`\nTest: ${test.name}`);
    console.log(`Result: ${result.signal} | Pattern: ${result.pattern} | Confidence: ${result.confidence}%`);
    
    // Simple validation
    if (result.pattern !== 'None') {
        console.log("✅ PASS: Pattern Detected");
    } else {
        console.log("❌ FAIL: No Pattern Found");
    }
});