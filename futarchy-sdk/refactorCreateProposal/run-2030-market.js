#!/usr/bin/env node

/**
 * Script to create and setup the 2030 governance market proposal
 * 
 * This will:
 * 1. Create a new futarchy proposal for 2030 governance adoption
 * 2. Create 6 pools with appropriate liquidity
 * 3. Log all transactions
 * 4. Export comprehensive JSON report
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up 2030 Governance Market Proposal');
console.log('=' .repeat(60));
console.log('Market: Will decentralized governance systems achieve >50% adoption in major DAOs by 2030?');
console.log('Event Probability: 65%');
console.log('Impact: 15%');
console.log('=' .repeat(60));

// Run the setup in automatic mode
const child = spawn('node', ['cli.js', 'setup-auto', 'config/market-2030.config.json'], {
  stdio: 'inherit',
  shell: true
});

child.on('exit', (code) => {
  if (code === 0) {
    console.log('\n✅ Market proposal setup completed successfully!');
    
    // Find and display the exported JSON file
    const logsDir = path.join(__dirname, 'logs');
    if (fs.existsSync(logsDir)) {
      const files = fs.readdirSync(logsDir);
      const jsonFiles = files.filter(f => f.startsWith('futarchy_setup_') && f.endsWith('.json'));
      
      if (jsonFiles.length > 0) {
        // Get the most recent file
        const latestFile = jsonFiles.sort().pop();
        const filePath = path.join(logsDir, latestFile);
        
        console.log(`\n📊 Report generated: ${filePath}`);
        
        // Read and display summary
        try {
          const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          
          console.log('\n' + '=' .repeat(60));
          console.log('MARKET SETUP SUMMARY');
          console.log('=' .repeat(60));
          console.log(`Proposal Address: ${data.proposal.address || 'N/A'}`);
          console.log(`Market: ${data.market}`);
          console.log(`Total Transactions: ${data.transactionSummary.total}`);
          
          if (data.pools && data.pools.length > 0) {
            console.log('\nPools Created:');
            data.pools.forEach(pool => {
              console.log(`  Pool ${pool.poolNumber}: ${pool.address}`);
            });
          }
          
          console.log('\nGnosisScan Links:');
          if (data.transactionSummary.gnosisScanLinks) {
            data.transactionSummary.gnosisScanLinks.slice(0, 5).forEach(link => {
              console.log(`  ${link.description}: ${link.link}`);
            });
            if (data.transactionSummary.gnosisScanLinks.length > 5) {
              console.log(`  ... and ${data.transactionSummary.gnosisScanLinks.length - 5} more`);
            }
          }
          
          console.log('=' .repeat(60));
          console.log(`\nFull report: ${filePath}`);
        } catch (error) {
          console.error('Error reading report:', error.message);
        }
      }
    }
  } else {
    console.error(`\n❌ Setup failed with exit code ${code}`);
  }
});

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Setup interrupted by user');
  child.kill('SIGINT');
  process.exit(1);
});