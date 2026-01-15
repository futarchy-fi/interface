const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function execPromise(command, options = {}) {
  return new Promise((resolve, reject) => {
    log(`\n${colors.blue}🔧 Executing: ${command}${colors.reset}`);
    
    const child = exec(command, options, (error, stdout, stderr) => {
      if (error) {
        log(`❌ Command failed: ${error.message}`, colors.red);
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });

    // Pipe output to console in real-time
    child.stdout.on('data', (data) => {
      process.stdout.write(data);
    });

    child.stderr.on('data', (data) => {
      process.stderr.write(data);
    });
  });
}



async function findLatestProposalAddress() {
  try {
    const files = fs.readdirSync('./')
      .filter(file => file.startsWith('futarchy-pool-setup-') && file.endsWith('.json'))
      .sort()
      .reverse(); // Get latest first
    
    if (files.length === 0) {
      throw new Error('No futarchy-pool-setup files found');
    }
    
    const latestFile = files[0];
    log(`📄 Found latest setup file: ${latestFile}`, colors.cyan);
    
    const data = JSON.parse(fs.readFileSync(latestFile, 'utf8'));
    const proposalAddress = data.proposalAddress;
    
    if (!proposalAddress) {
      throw new Error('No proposalAddress found in setup file');
    }
    
    log(`🎯 Found proposal address: ${proposalAddress}`, colors.cyan);
    return proposalAddress;
    
  } catch (error) {
    log(`❌ Error finding proposal address: ${error.message}`, colors.red);
    throw error;
  }
}

async function checkPoolFiles(proposalAddress) {
  const outputDir = './output';
  if (!fs.existsSync(outputDir)) {
    return [];
  }
  
  const addressWithout0x = proposalAddress.startsWith('0x') ? proposalAddress.substring(2) : proposalAddress;
  
  const files = fs.readdirSync(outputDir)
    .filter(file => file.startsWith(`futarchy-0x${addressWithout0x}`) && file.includes('-pool-') && file.endsWith('.json'));
  
  return files;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  
  // Read token configuration from futarchy-config.json
  let tokenInfo = { company: 'GNO', currency: 'sDAI' };
  try {
    const configPath = './futarchy-config.json';
    if (fs.existsSync(configPath)) {
      const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      tokenInfo = {
        company: configData.companyToken?.symbol || 'GNO',
        currency: configData.currencyToken?.symbol || 'sDAI'
      };
    }
  } catch (error) {
    log('Warning: Could not read token config, using defaults', colors.yellow);
  }
  
  log(`
${colors.bright}🏛️  FUTARCHY AUTOMATION WORKFLOW${colors.reset}
${colors.bright}=================================${colors.reset}
`, colors.magenta);

  log(`📊 Token Configuration: ${tokenInfo.company}/${tokenInfo.currency}`, colors.cyan);
  
  if (dryRun) {
    log('🔍 DRY RUN MODE - API calls will be previewed only', colors.yellow);
  }

  try {
    // Step 1: Run futarchy auto config
    log(`\n${colors.bright}📋 STEP 1: Running Futarchy Auto Config${colors.reset}`, colors.green);
    log('This will create the futarchy pools based on your config...', colors.cyan);
    
    // Set NODE_ENV to ensure the algebra-cli exits properly
    process.env.NODE_ENV = 'automation';
    
    await execPromise('npm run futarchy:auto:config');
    
    log('✅ Futarchy auto config completed successfully!', colors.green);
    
    // Step 2: Generate pool files
    log(`\n${colors.bright}🏗️  STEP 2: Generating Pool Files${colors.reset}`, colors.green);
    log('Extracting the 3 target pools and generating API-ready files...', colors.cyan);
    log('Including companyId from futarchy-config.json in first pool metadata...', colors.cyan);
    
    await execPromise('npm run generate-pools');
    
    log('✅ Pool files generated successfully!', colors.green);
    
    // Step 3: Find proposal address
    log(`\n${colors.bright}🔍 STEP 3: Finding Proposal Address${colors.reset}`, colors.green);
    
    const proposalAddress = await findLatestProposalAddress();
    
    // Step 4: Verify pool files exist
    const poolFiles = await checkPoolFiles(proposalAddress);
    if (poolFiles.length === 0) {
      throw new Error(`No pool files found for proposal ${proposalAddress}`);
    }
    
    log(`📊 Found ${poolFiles.length} pool files ready for API calls:`, colors.cyan);
    poolFiles.forEach((file, index) => {
      log(`  ${index + 1}. ${file}`, colors.cyan);
    });
    
    // Step 5: Call pool APIs
    log(`\n${colors.bright}📡 STEP 4: Calling Pool APIs${colors.reset}`, colors.green);
    
    if (dryRun) {
      log('Running dry run to preview API calls...', colors.yellow);
      await execPromise(`npm run call-proposal-pools-dry ${proposalAddress}`);
    } else {
      log('Making actual API calls to create pools...', colors.cyan);
      await execPromise(`npm run call-proposal-pools ${proposalAddress}`);
    }
    
    // Step 6: Success summary
    log(`\n${colors.bright}🎉 WORKFLOW COMPLETED SUCCESSFULLY!${colors.reset}`, colors.green);
    log('═'.repeat(50), colors.green);
    
    log(`\n📊 Summary:`, colors.cyan);
    log(`  🎯 Proposal: ${proposalAddress}`, colors.cyan);
    log(`  💱 Tokens: ${tokenInfo.company}/${tokenInfo.currency}`, colors.cyan);
    log(`  🏊 Pools: ${poolFiles.length} files generated and processed`, colors.cyan);
    log(`  📡 API Calls: ${dryRun ? 'Previewed (dry run)' : 'Executed successfully'}`, colors.cyan);
    
    if (!dryRun) {
      log(`\n🚀 Your futarchy prediction market is now live!`, colors.green);
    } else {
      log(`\n🔍 Run without --dry-run to make actual API calls`, colors.yellow);
    }
    
  } catch (error) {
    log(`\n💥 WORKFLOW FAILED`, colors.red);
    log('═'.repeat(30), colors.red);
    log(`Error: ${error.message}`, colors.red);
    
    if (error.stdout) {
      log('\nStdout:', colors.yellow);
      log(error.stdout, colors.reset);
    }
    
    if (error.stderr) {
      log('\nStderr:', colors.yellow);
      log(error.stderr, colors.reset);
    }
    
    log(`\n💡 Troubleshooting tips:`, colors.cyan);
    log(`  1. Make sure futarchy-config.json exists and is valid`, colors.cyan);
    log(`  2. Check that your .env file has correct API settings`, colors.cyan);
    log(`  3. Verify the API server is running if not using dry-run`, colors.cyan);
    log(`  4. Run individual steps manually to isolate the issue`, colors.cyan);
    
    process.exit(1);
  }
}

// Handle script interruption
process.on('SIGINT', () => {
  log('\n\n🛑 Workflow interrupted by user', colors.yellow);
  process.exit(0);
});

// Show usage if help requested
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
${colors.bright}🏛️  Futarchy Automation Workflow${colors.reset}

${colors.cyan}Usage:${colors.reset}
  node automate-futarchy.js [options]

${colors.cyan}Options:${colors.reset}
  --dry-run    Preview API calls without making actual requests
  --help, -h   Show this help message

${colors.cyan}What this script does:${colors.reset}
  1. 📋 Runs futarchy auto config (creates pools)
  2. 🏗️  Generates 3 API-ready pool files
  3. 🔍 Finds the latest proposal address
  4. 📡 Calls pool creation APIs

${colors.cyan}Examples:${colors.reset}
  node automate-futarchy.js           # Full workflow with real API calls
  node automate-futarchy.js --dry-run # Preview mode (safe)

${colors.cyan}Requirements:${colors.reset}
  • futarchy-config.json file must exist
  • .env file with API settings (for real calls)
  • API server running (for real calls)
`);
  process.exit(0);
}

// Run the main function
main().catch(error => {
  log(`💥 Unexpected error: ${error.message}`, colors.red);
  process.exit(1);
}); 