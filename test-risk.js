const PositionManager = require('./server/risk-manager');
const config = require('./server/config');

const pm = new PositionManager(config.riskParams);
console.log('Config:', pm.config);

// Test Bullish
const entryPrice = 50000;
const stopPrice = 49000;
const sizing = pm.calculatePositionSize(entryPrice, stopPrice, 'BULLISH');
console.log('Sizing Result:', sizing);

if (sizing.investmentAmount && Math.abs(sizing.investmentAmount - 500) < 0.1) {
    console.log(`✅ Success: Investment Amount is $${sizing.investmentAmount} (5% of $10,000)`);
    console.log(`Position Size: ${sizing.positionSize} units`);
} else {
    console.error('❌ Failure: Investment amount incorrectly calculated');
}
