/**
 * Test script to verify available balance calculations
 * Simulates opening and closing trades with profit/loss
 */

const PositionManager = require('./server/risk-manager');

console.log('\n========================================');
console.log('   Balance Tracking Test Suite');
console.log('========================================\n');

// Create position manager with $1000 starting balance
const pm = new PositionManager({
    accountBalance: 1000,
    riskPerTrade: 0.02, // 2% risk = $20 per trade
    takeProfitRatio: 1.5
});

console.log(`Initial Account Balance: $${pm.accountBalance}`);
console.log(`Initial Available Balance: $${pm.getAvailableBalance()}\n`);

// Test 1: Open a BULLISH position
console.log('--- Test 1: Open BULLISH Position ---');
const entry1 = pm.openPosition({
    symbol: 'BTC/USD',
    signal: 'BULLISH',
    entryPrice: 100,
    stopPrice: 95,
    confidence: 75
});

if (entry1.success) {
    const trade1 = entry1.trade;
    console.log(`Trade opened: ${trade1.id}`);
    console.log(`Entry Price: $${trade1.entryPrice}`);
    console.log(`Position Size: ${trade1.positionSize.toFixed(4)} BTC`);
    console.log(`Investment Amount: $${(trade1.positionSize * trade1.entryPrice).toFixed(2)}`);
    console.log(`Account Balance: $${pm.accountBalance}`);
    console.log(`Available Balance: $${pm.getAvailableBalance().toFixed(2)}`);
    console.log(`Capital Invested: $${(trade1.positionSize * trade1.entryPrice).toFixed(2)}\n`);
} else {
    console.log('Error opening trade:', entry1.error);
}

// Test 2: Open another BULLISH position
console.log('--- Test 2: Open Second BULLISH Position ---');
const entry2 = pm.openPosition({
    symbol: 'ETH/USD',
    signal: 'BULLISH',
    entryPrice: 50,
    stopPrice: 47.5,
    confidence: 65
});

if (entry2.success) {
    const trade2 = entry2.trade;
    console.log(`Trade opened: ${trade2.id}`);
    console.log(`Entry Price: $${trade2.entryPrice}`);
    console.log(`Position Size: ${trade2.positionSize.toFixed(4)} ETH`);
    console.log(`Investment Amount: $${(trade2.positionSize * trade2.entryPrice).toFixed(2)}`);
    console.log(`Account Balance: $${pm.accountBalance}`);
    console.log(`Available Balance: $${pm.getAvailableBalance().toFixed(2)}`);
    console.log(`Total Capital Invested: $${(pm.positions.reduce((sum, t) => sum + t.positionSize * t.entryPrice, 0)).toFixed(2)}`);
    console.log(`Open Positions: ${pm.positions.length}\n`);
}

// Test 3: Close first trade with PROFIT
console.log('--- Test 3: Close First Trade with PROFIT ---');
const trade1 = entry1.trade;
const close1 = pm.closePosition(trade1.id, 110); // 10% profit

if (close1.success) {
    const closedTrade = close1.trade;
    console.log(`Trade closed: ${closedTrade.id}`);
    console.log(`Exit Price: $${closedTrade.exitPrice}`);
    console.log(`Profit/Loss: $${closedTrade.profitLoss.toFixed(2)} (${closedTrade.profitLossPercent.toFixed(2)}%)`);
    console.log(`Account Balance: $${pm.accountBalance.toFixed(2)}`);
    console.log(`Available Balance: $${pm.getAvailableBalance().toFixed(2)}`);
    console.log(`Total Capital Invested: $${(pm.positions.reduce((sum, t) => sum + t.positionSize * t.entryPrice, 0)).toFixed(2)}`);
    console.log(`Open Positions: ${pm.positions.length}\n`);
} else {
    console.log('Error closing trade:', close1.error);
}

// Test 4: Close second trade with LOSS
console.log('--- Test 4: Close Second Trade with LOSS ---');
const trade2 = entry2.trade;
const close2 = pm.closePosition(trade2.id, 48); // 4% loss

if (close2.success) {
    const closedTrade = close2.trade;
    console.log(`Trade closed: ${closedTrade.id}`);
    console.log(`Exit Price: $${closedTrade.exitPrice}`);
    console.log(`Profit/Loss: $${closedTrade.profitLoss.toFixed(2)} (${closedTrade.profitLossPercent.toFixed(2)}%)`);
    console.log(`Account Balance: $${pm.accountBalance.toFixed(2)}`);
    console.log(`Available Balance: $${pm.getAvailableBalance().toFixed(2)}`);
    console.log(`Total Capital Invested: $${(pm.positions.reduce((sum, t) => sum + t.positionSize * t.entryPrice, 0)).toFixed(2)}`);
    console.log(`Open Positions: ${pm.positions.length}\n`);
} else {
    console.log('Error closing trade:', close2.error);
}

// Summary
console.log('========================================');
console.log('   FINAL SUMMARY');
console.log('========================================');
console.log(`Initial Balance: $1000.00`);
console.log(`Final Balance: $${pm.accountBalance.toFixed(2)}`);
console.log(`Total P&L: $${(pm.accountBalance - 1000).toFixed(2)}`);
console.log(`Available Balance: $${pm.getAvailableBalance().toFixed(2)}`);
console.log(`Open Positions: ${pm.positions.length}`);
console.log(`Closed Trades: ${pm.closedTrades.length}`);

const stats = pm.getPerformanceStats();
console.log(`\nPerformance Stats:`);
console.log(`  Win Rate: ${stats.winRate}`);
console.log(`  Total Wins: ${stats.wins}`);
console.log(`  Total Losses: ${stats.losses}`);
console.log(`  Total Return: ${stats.totalReturn}%`);
console.log('\n========================================\n');
