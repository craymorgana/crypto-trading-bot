#!/usr/bin/env node
/**
 * Setup Script - Interactive setup wizard for new users
 * Run: node setup.js
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const ENV_FILE = path.join(__dirname, '.env');

function question(prompt) {
    return new Promise(resolve => rl.question(prompt, resolve));
}

async function runSetup() {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║         🤖 CryptoAI Trading Bot - Setup Wizard              ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    // Check if .env already exists
    if (fs.existsSync(ENV_FILE)) {
        const overwrite = await question('⚠️  .env file already exists. Overwrite? (y/n): ');
        if (overwrite.toLowerCase() !== 'y') {
            console.log('\n❌ Setup cancelled. Keeping existing .env\n');
            rl.close();
            return;
        }
    }

    console.log('\n📋 KRAKEN API SETUP');
    console.log('═'.repeat(60));
    console.log('To get your API keys:');
    console.log('1. Go to https://www.kraken.com/sign-up');
    console.log('2. Create account (or log in)');
    console.log('3. Settings → API → Generate New Key');
    console.log('4. Name: "CryptoAI Trading Bot"');
    console.log('5. Permissions required:');
    console.log('   ✓ Query Funds');
    console.log('   ✓ Query Open Orders & Trades');
    console.log('   ✓ Query Closed Orders & Trades');
    console.log('   ✓ Create & Modify Orders');
    console.log('   ✓ Cancel Orders');
    console.log('\n⚠️  KEEP YOUR API KEYS SECRET! Never share them.\n');

    const apiKey = await question('📝 Enter Kraken API Key: ');
    if (!apiKey || apiKey.trim().length === 0) {
        console.log('\n❌ API Key is required!\n');
        rl.close();
        return;
    }

    const apiSecret = await question('🔐 Enter Kraken API Secret: ');
    if (!apiSecret || apiSecret.trim().length === 0) {
        console.log('\n❌ API Secret is required!\n');
        rl.close();
        return;
    }

    console.log('\n⚙️  OPTIONAL SETTINGS');
    console.log('═'.repeat(60));
    const port = await question('Dashboard port (default 3000): ');
    const dashboardPort = port.trim() || '3000';

    const mode = await question('\nStarting mode - S for SIMULATED (safe), L for LIVE (real trades)? [S/l]: ');
    const startingMode = mode.toLowerCase() === 'l' ? 'LIVE' : 'SIMULATED';

    console.log('\n💾 Creating .env file...');
    
    const envContent = `# Kraken API Credentials
KRAKEN_US_KEY=${apiKey.trim()}
KRAKEN_US_SECRET=${apiSecret.trim()}

# Dashboard Settings
DASHBOARD_PORT=${dashboardPort}

# Initial Execution Mode (SIMULATED or LIVE)
INITIAL_MODE=${startingMode}

# ⚠️  IMPORTANT:
# - Keep this file SECRET
# - Never commit to Git
# - Rotate API keys periodically
# - Use minimal permissions
`;

    fs.writeFileSync(ENV_FILE, envContent);
    console.log('✅ .env file created successfully\n');

    // Create bot-mode-state.json
    const modeStateFile = path.join(__dirname, 'server', 'shared', 'bot-mode-state.json');
    const modeState = {
        mode: 'SWING',
        lastUpdated: new Date().toISOString(),
        configuration: 'production'
    };
    
    if (!fs.existsSync(path.dirname(modeStateFile))) {
        fs.mkdirSync(path.dirname(modeStateFile), { recursive: true });
    }
    fs.writeFileSync(modeStateFile, JSON.stringify(modeState, null, 2));
    console.log('✅ Created bot-mode-state.json\n');

    // Create bot-execution-state.json
    const execStateFile = path.join(__dirname, 'server', 'shared', 'bot-execution-state.json');
    const execState = {
        mode: startingMode,
        lastUpdated: new Date().toISOString()
    };
    fs.writeFileSync(execStateFile, JSON.stringify(execState, null, 2));
    console.log(`✅ Created bot-execution-state.json (mode: ${startingMode})\n`);

    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║              ✅ Setup Complete!                            ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    console.log('📊 NEXT STEPS:\n');
    console.log('1. Install dependencies:');
    console.log('   npm install\n');

    console.log('2. Start the bot:');
    console.log('   npm start\n');

    console.log('3. Open dashboard:');
    console.log('   http://localhost:' + dashboardPort + '\n');

    console.log('⚠️  IMPORTANT:\n');
    if (startingMode === 'SIMULATED') {
        console.log('   ✓ Starting in SIMULATED mode (paper trading)');
        console.log('   ✓ No real money at risk');
        console.log('   ✓ Test for 1-2 weeks before switching to LIVE\n');
    } else {
        console.log('   ⚠️  Starting in LIVE mode (real trading)');
        console.log('   ⚠️  ONLY if you have funded your Kraken account');
        console.log('   ⚠️  Start with small amounts first\n');
    }

    console.log('📖 READ THESE:\n');
    console.log('   • README.md - Full documentation');
    console.log('   • QUICK_START.md - Quick reference');
    console.log('   • BOT_STARTUP_CHECKLIST.md - Detailed setup\n');

    console.log('💡 TIPS:\n');
    console.log('   • Always start with SIMULATED mode');
    console.log('   • Fund account gradually ($100 first)');
    console.log('   • Monitor dashboard regularly');
    console.log('   • Review trades daily\n');

    console.log('🚀 Ready to trade!\n');

    rl.close();
}

runSetup().catch(err => {
    console.error('❌ Setup error:', err.message);
    rl.close();
    process.exit(1);
});
