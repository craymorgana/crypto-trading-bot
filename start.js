#!/usr/bin/env node
/**
 * Startup script - Launches dashboard, browser, and bot concurrently
 */

const { spawn } = require('child_process');
const { exec } = require('child_process');
const path = require('path');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function startBot() {
    console.log('\n🤖 Crypto Scalping Bot - Full Startup\n');
    console.log('='.repeat(50));

    // 1. Start Dashboard Server
    console.log('📊 Starting Dashboard Server...');
    const dashboard = spawn('node', [path.join(__dirname, 'dashboard.js')], {
        stdio: 'inherit'
    });

    dashboard.on('error', (err) => {
        console.error('❌ Dashboard error:', err);
    });

    // Wait for dashboard to start
    await sleep(2000);

    // 2. Open Browser
    console.log('🌐 Opening Browser to http://localhost:3000...');
    const isWindows = process.platform === 'win32';
    const isMac = process.platform === 'darwin';
    const isLinux = process.platform === 'linux';

    try {
        if (isWindows) {
            exec('start http://localhost:3000');
        } else if (isMac) {
            exec('open http://localhost:3000');
        } else if (isLinux) {
            exec('xdg-open http://localhost:3000');
        }
    } catch (err) {
        console.log('⚠️  Could not open browser automatically. Please visit: http://localhost:3000');
    }

    await sleep(1000);

    // 3. Start Bot
    console.log('🚀 Starting Trading Bot...');
    console.log('='.repeat(50) + '\n');
    
    const bot = spawn('node', [path.join(__dirname, 'bot.js')], {
        stdio: 'inherit'
    });

    bot.on('error', (err) => {
        console.error('❌ Bot error:', err);
    });

    bot.on('exit', (code) => {
        console.log(`\n⚠️  Bot exited with code ${code}`);
        process.exit(code);
    });

    // Handle process termination
    process.on('SIGINT', () => {
        console.log('\n\n🛑 Shutting down...');
        dashboard.kill();
        bot.kill();
        process.exit(0);
    });
}

startBot().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
