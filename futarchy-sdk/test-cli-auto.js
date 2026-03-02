#!/usr/bin/env node

// Automated test for the futarchy CLI
// Tests the MarketEventsFetcher integration

import { spawn } from 'child_process';
import chalk from 'chalk';

const cli = spawn('node', ['examples/futarchy-complete.js'], {
    stdio: ['pipe', 'pipe', 'pipe']
});

let output = '';
let step = 0;

cli.stdout.on('data', (data) => {
    output += data.toString();
    console.log(data.toString());
    
    // Auto-select based on step
    if (output.includes('Select a proposal:') && step === 0) {
        step = 1;
        // Select second option (Circle USDC)
        setTimeout(() => {
            cli.stdin.write('\x1B[B'); // Down arrow
            setTimeout(() => {
                cli.stdin.write('\n'); // Enter
            }, 100);
        }, 500);
    }
    
    if (output.includes('What would you like to do?') && step === 1) {
        step = 2;
        // Select option 2 (View Pools)
        setTimeout(() => {
            cli.stdin.write('2\n');
        }, 500);
    }
});

cli.stderr.on('data', (data) => {
    console.error(chalk.red(data.toString()));
});

cli.on('close', (code) => {
    if (code === 0) {
        console.log(chalk.green('\n✅ CLI test completed successfully'));
    } else {
        console.log(chalk.red(`\n❌ CLI test failed with code ${code}`));
    }
    process.exit(code);
});

// Timeout after 30 seconds
setTimeout(() => {
    console.log(chalk.yellow('\n⏱️ Test timed out'));
    cli.kill();
    process.exit(1);
}, 30000);