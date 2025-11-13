const fs = require('fs');
const path = require('path');
// Resolve chain + explorer dynamically at export time so logs reflect the active chain
// (constants may change during a single CLI session)

class TransactionLogger {
  constructor(logPath = './logs') {
    this.logPath = logPath;
    this.transactions = [];
    this.sessionId = Date.now().toString();
    
    // Ensure log directory exists
    if (!fs.existsSync(logPath)) {
      fs.mkdirSync(logPath, { recursive: true });
    }
  }

  // Log a transaction
  log(description, txHash, details = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      description,
      transactionHash: txHash,
      ...details
    };
    
    this.transactions.push(entry);
    console.log(`\n📝 Transaction logged: ${description}`);
    console.log(`   Hash: ${txHash}`);
    
    // Append to log file immediately
    this.appendToFile(entry);
    
    return entry;
  }

  // Append entry to log file
  appendToFile(entry) {
    const logFile = path.join(this.logPath, `transactions_${this.sessionId}.log`);
    const line = JSON.stringify(entry) + '\n';
    fs.appendFileSync(logFile, line);
  }

  // Export transactions to JSON with comprehensive data
  exportToJSON(filename = null, additionalData = {}) {
    const exportPath = filename || path.join(this.logPath, `futarchy_setup_${this.sessionId}.json`);
    // Load current chain constants dynamically
    let constants;
    try {
      // Clear cached module to reflect any chain/AMM change
      delete require.cache[require.resolve('../contracts/constants')];
      constants = require('../contracts/constants');
    } catch (_) {
      constants = {
        NETWORK: { NAME: 'unknown', CHAIN_ID: 0 },
        EXPLORER: '',
        getExplorerTxLink: (h) => h
      };
    }
    
    // Group transactions by type
    const groupedTransactions = {};
    this.transactions.forEach(tx => {
      const type = tx.description.split(' ')[0];
      if (!groupedTransactions[type]) {
        groupedTransactions[type] = [];
      }
      groupedTransactions[type].push(tx);
    });
    
    // Extract pool information
    const pools = [];
    this.transactions.forEach(tx => {
      if (tx.poolAddress && tx.poolNumber) {
        pools.push({
          poolNumber: tx.poolNumber,
          address: tx.poolAddress,
          token0: tx.token0,
          token1: tx.token1,
          description: tx.description,
          transactionHash: tx.transactionHash,
          timestamp: tx.timestamp
        });
      }
    });
    
    const exportData = {
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      network: constants.NETWORK.NAME,
      chainId: constants.NETWORK.CHAIN_ID,
      wallet: additionalData.wallet || 'unknown',
      proposal: additionalData.proposal || {},
      market: additionalData.marketName || 'unknown',
      configuration: {
        spotPrice: additionalData.spotPrice,
        eventProbability: additionalData.eventProbability,
        impact: additionalData.impact,
        liquidityAmounts: additionalData.liquidityAmounts
      },
      pools: pools.sort((a, b) => a.poolNumber - b.poolNumber),
      transactionSummary: {
        total: this.transactions.length,
        byType: Object.keys(groupedTransactions).reduce((acc, key) => {
          acc[key] = groupedTransactions[key].length;
          return acc;
        }, {}),
        explorerLinks: this.transactions.map(tx => ({
          description: tx.description,
          link: constants.getExplorerTxLink(tx.transactionHash)
        }))
      },
      detailedTransactions: this.transactions,
      groupedTransactions
    };
    
    fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2));
    console.log(`\n📁 Comprehensive data exported to: ${exportPath}`);
    return exportPath;
  }

  // Export transactions to CSV
  exportToCSV(filename = null) {
    const exportPath = filename || path.join(this.logPath, `export_${this.sessionId}.csv`);
    
    if (this.transactions.length === 0) {
      console.log('No transactions to export');
      return null;
    }
    
    // Create CSV header
    const headers = ['Timestamp', 'Description', 'Transaction Hash', 'Pool Address', 'Token0', 'Token1', 'Amount0', 'Amount1'];
    let csv = headers.join(',') + '\n';
    
    // Add transaction rows
    this.transactions.forEach(tx => {
      const row = [
        tx.timestamp,
        `"${tx.description}"`,
        tx.transactionHash,
        tx.poolAddress || '',
        tx.token0 || '',
        tx.token1 || '',
        tx.amount0 || '',
        tx.amount1 || ''
      ];
      csv += row.join(',') + '\n';
    });
    
    fs.writeFileSync(exportPath, csv);
    console.log(`\n✅ Transactions exported to CSV: ${exportPath}`);
    return exportPath;
  }

  // Generate summary report
  generateReport() {
    const report = {
      sessionId: this.sessionId,
      totalTransactions: this.transactions.length,
      startTime: this.transactions[0]?.timestamp,
      endTime: this.transactions[this.transactions.length - 1]?.timestamp,
      transactionTypes: {},
      pools: new Set(),
      totalGasUsed: 0
    };
    
    this.transactions.forEach(tx => {
      // Count transaction types
      const type = tx.description.split(' ')[0];
      report.transactionTypes[type] = (report.transactionTypes[type] || 0) + 1;
      
      // Track unique pools
      if (tx.poolAddress) {
        report.pools.add(tx.poolAddress);
      }
      
      // Sum gas used
      if (tx.gasUsed) {
        report.totalGasUsed += Number(tx.gasUsed);
      }
    });
    
    report.uniquePools = Array.from(report.pools);
    delete report.pools;
    
    return report;
  }

  // Print summary to console
  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('TRANSACTION SUMMARY');
    console.log('='.repeat(60));
    
    const report = this.generateReport();
    console.log(`Session ID: ${report.sessionId}`);
    console.log(`Total Transactions: ${report.totalTransactions}`);
    console.log(`Duration: ${report.startTime} to ${report.endTime}`);
    
    console.log('\nTransaction Types:');
    Object.entries(report.transactionTypes).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
    
    if (report.uniquePools.length > 0) {
      console.log('\nPools Created/Used:');
      report.uniquePools.forEach(pool => {
        console.log(`  ${pool}`);
      });
    }
    
    console.log('='.repeat(60));
  }

  // Clear transaction log
  clear() {
    this.transactions = [];
    this.sessionId = Date.now().toString();
  }
}

module.exports = TransactionLogger;
