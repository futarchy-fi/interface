/**
 * Collateral Addition Test for futarchyJS
 * 
 * This script tests the addCollateral function in futarchy.js:
 * - Loads private key from .env
 * - Checks balances before and after
 * - Tests adding tiny amounts of collateral (0.000001)
 * - Logs the entire process including approvals
 * 
 * IMPORTANT: All environment variables must be set in .env file.
 * This test will not run with missing variables.
 */

import 'dotenv/config'; 
import { ethers } from 'ethers';
import { createFutarchy, environmentConfig, getEnvironmentConfig } from './futarchy.js';
import {
  BASE_TOKENS_CONFIG,
  MERGE_CONFIG,
  FUTARCHY_ROUTER_ADDRESS,
  ERC20_ABI
} from './contractWrapper.js';

// First validate environment variables
function validateEnvironment() {
  const config = getEnvironmentConfig();
  
  if (!config.environment.isValid) {
    console.error('\n❌ ERROR: Missing required environment variables:');
    config.environment.missingVars.forEach(v => {
      console.error(`   - ${v}`);
    });
    console.error('\nAll variables must be defined in your .env file.');
    console.error('This test will not work without all required variables.');
    console.error('Please copy .env.example to .env and fill in all values.');
    process.exit(1);
  }
  
  console.log('✅ Environment validation successful - all required variables are present');
}

// Run validation immediately
validateEnvironment();

// Get token configurations from environment
const BASE_CURRENCY_TOKEN = environmentConfig.baseTokens.currency.address;
const BASE_COMPANY_TOKEN = environmentConfig.baseTokens.company.address;

// Get token positions from environment
const CURRENCY_YES_TOKEN = environmentConfig.positionTokens.currency.yes;
const CURRENCY_NO_TOKEN = environmentConfig.positionTokens.currency.no;
const COMPANY_YES_TOKEN = environmentConfig.positionTokens.company.yes;
const COMPANY_NO_TOKEN = environmentConfig.positionTokens.company.no;

/**
 * Test token balances for a specific wallet address
 * @param {string} walletAddress - Wallet address to check balances for 
 * @param {ethers.providers.Provider} provider - Ethereum provider
 */
async function testBalances(walletAddress, provider) {
  console.log("\n💰 Checking Token Balances for:", walletAddress);
  console.log("=================================================");
  
  try {
    // Helper function to get token balance and format it
    async function getTokenBalance(tokenAddress, tokenName) {
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
      let symbol;
      try {
        symbol = await tokenContract.symbol();
      } catch (error) {
        symbol = tokenName; // Use provided name if symbol() fails
      }
      
      let decimals;
      try {
        decimals = await tokenContract.decimals();
      } catch (error) {
        console.error(`Error getting decimals for token ${tokenAddress}:`, error);
        throw new Error(`Could not determine decimals for token ${tokenAddress}. Test cannot continue.`);
      }
      
      const balance = await tokenContract.balanceOf(walletAddress);
      const formattedBalance = ethers.utils.formatUnits(balance, decimals);
      
      return {
        symbol,
        balance: formattedBalance,
        raw: balance.toString(),
        tokenAddress
      };
    }
    
    // Create an array of token info we want to check
    const tokens = [
      { address: BASE_CURRENCY_TOKEN, name: 'SDAI (Base Currency)' },
      { address: BASE_COMPANY_TOKEN, name: 'GNO (Base Company)' },
      { address: CURRENCY_YES_TOKEN, name: 'YES_SDAI' },
      { address: CURRENCY_NO_TOKEN, name: 'NO_SDAI' },
      { address: COMPANY_YES_TOKEN, name: 'YES_GNO' },
      { address: COMPANY_NO_TOKEN, name: 'NO_GNO' }
    ];
    
    // Get all token balances in parallel
    const balances = await Promise.all(
      tokens.map(token => getTokenBalance(token.address, token.name))
    );
    
    // Format and display results
    console.log("\n📋 Token Balances:");
    console.log("------------------");
    
    const baseTokens = balances.slice(0, 2);
    const positionTokens = balances.slice(2);
    
    console.log("Base Tokens:");
    baseTokens.forEach(token => {
      console.log(`  ${token.symbol}: ${token.balance}`);
    });
    
    console.log("\nPosition Tokens:");
    positionTokens.forEach(token => {
      console.log(`  ${token.symbol}: ${token.balance}`);
    });
    
    // Calculate net positions
    const yesSDaiBalance = parseFloat(balances[2].balance);
    const noSDaiBalance = parseFloat(balances[3].balance);
    const yesGnoBalance = parseFloat(balances[4].balance);
    const noGnoBalance = parseFloat(balances[5].balance);
    
    console.log("\nNet Positions:");
    
    // Currency position
    const currencyNetPosition = yesSDaiBalance - noSDaiBalance;
    const currencySurplusType = currencyNetPosition > 0 ? 'YES' : 'NO';
    const currencySurplusAmount = Math.abs(currencyNetPosition);
    
    console.log(`  Currency: ${currencyNetPosition > 0 ? '+' : ''}${currencyNetPosition.toFixed(6)} SDAI (${currencySurplusType} surplus: ${currencySurplusAmount.toFixed(6)})`);
    
    // Company position
    const companyNetPosition = yesGnoBalance - noGnoBalance;
    const companySurplusType = companyNetPosition > 0 ? 'YES' : 'NO';
    const companySurplusAmount = Math.abs(companyNetPosition);
    
    console.log(`  Company: ${companyNetPosition > 0 ? '+' : ''}${companyNetPosition.toFixed(6)} GNO (${companySurplusType} surplus: ${companySurplusAmount.toFixed(6)})`);
    
    // Return the balances
    return balances;
    
  } catch (error) {
    console.error("❌ Balance check failed with error:", error);
    return null;
  }
}

/**
 * Create a provider that can connect to Gnosis Chain
 */
function createProvider() {
  // Use RPC URL from .env if available, otherwise use default
  const rpcUrl = process.env.RPC_URL || "https://rpc.ankr.com/gnosis";
  console.log(`Using RPC URL: ${rpcUrl}`);
  return new ethers.providers.JsonRpcProvider(rpcUrl);
}

/**
 * Create a wallet from private key
 * @param {ethers.providers.Provider} provider - Ethereum provider
 * @returns {ethers.Wallet} - Wallet instance
 */
function createWallet(provider) {
  // Check if we have a private key in .env
  if (!process.env.PRIVATE_KEY) {
    throw new Error("PRIVATE_KEY is not defined in .env file");
  }
  
  // Create and return wallet
  return new ethers.Wallet(process.env.PRIVATE_KEY, provider);
}

/**
 * Test adding collateral
 * @param {string} testType - Test type ('currency' or 'company')
 * @param {string} amount - Amount to add as collateral
 * @param {Object} futarchy - Futarchy instance
 * @returns {Promise<Object>} - Test result
 */
async function testCollateralAddition(testType, amount, futarchy) {
  console.log(`\n🧪 TESTING ${testType.toUpperCase()} COLLATERAL ADDITION (${amount})`);
  console.log("=================================================");
  
  try {
    // Test with callbacks to log the process
    const result = await futarchy.addCollateral(testType, amount, {
      onStart: () => console.log(`▶️ Starting ${testType} collateral addition process`),
      
      onApprove: (tx) => {
        console.log(`📝 APPROVAL TRANSACTION SENT: ${tx.hash}`);
        console.log(`⏳ Waiting for approval confirmation...`);
      },
      
      onSplit: (tx) => {
        console.log(`📝 SPLIT TRANSACTION SENT: ${tx.hash}`);
        console.log(`⏳ Waiting for confirmation...`);
      },
      
      onComplete: (receipt) => {
        console.log(`✅ TRANSACTION CONFIRMED: Block #${receipt.blockNumber}`);
        console.log(`⛽ Gas used: ${receipt.gasUsed.toString()}`);
        console.log(`🔗 Transaction hash: ${receipt.transactionHash}`);
      },
      
      onError: (error) => {
        console.error(`❌ ERROR: ${error.message}`);
        console.error(error);
      }
    });
    
    if (result.success) {
      console.log(`\n✅ ${testType} collateral addition SUCCEEDED!`);
    } else {
      console.error(`\n❌ ${testType} collateral addition FAILED:`, result.error);
    }
    
    return result;
  } catch (error) {
    console.error(`\n💥 Unexpected error in ${testType} test:`, error);
    return { success: false, error };
  }
}

/**
 * Test removing collateral
 * @param {string} testType - Test type ('currency' or 'company')
 * @param {string} amount - Amount to remove as collateral
 * @param {Object} futarchy - Futarchy instance
 * @returns {Promise<Object>} - Test result
 */
async function testCollateralRemoval(testType, amount, futarchy) {
  console.log(`\n🧪 TESTING ${testType.toUpperCase()} COLLATERAL REMOVAL (${amount})`);
  console.log("=================================================");
  
  try {
    // Test with callbacks to log the process
    const result = await futarchy.removeCollateral(testType, amount, {
      onStart: () => console.log(`▶️ Starting ${testType} collateral removal process`),
      
      onYesApprove: (tx) => {
        console.log(`📝 YES TOKEN APPROVAL TRANSACTION SENT: ${tx.hash}`);
        console.log(`⏳ Waiting for YES token approval confirmation...`);
      },
      
      onNoApprove: (tx) => {
        console.log(`📝 NO TOKEN APPROVAL TRANSACTION SENT: ${tx.hash}`);
        console.log(`⏳ Waiting for NO token approval confirmation...`);
      },
      
      onMerge: (tx) => {
        console.log(`📝 MERGE TRANSACTION SENT: ${tx.hash}`);
        console.log(`⏳ Waiting for confirmation...`);
      },
      
      onComplete: (receipt) => {
        console.log(`✅ TRANSACTION CONFIRMED: Block #${receipt.blockNumber}`);
        console.log(`⛽ Gas used: ${receipt.gasUsed.toString()}`);
        console.log(`🔗 Transaction hash: ${receipt.transactionHash}`);
      },
      
      onError: (error) => {
        console.error(`❌ ERROR: ${error.message}`);
        console.error(error);
      }
    });
    
    if (result.success) {
      console.log(`\n✅ ${testType} collateral removal SUCCEEDED!`);
    } else {
      console.error(`\n❌ ${testType} collateral removal FAILED:`, result.error);
    }
    
    return result;
  } catch (error) {
    console.error(`\n💥 Unexpected error in ${testType} removal test:`, error);
    return { success: false, error };
  }
}

/**
 * Main test function
 * @param {Object} options - Test options
 * @param {boolean} options.testRemoval - Whether to test collateral removal
 */
async function runCollateralTest(options = {}) {
  const { testRemoval = false } = options;
  console.log("🔍 Starting Collateral Test");
  console.log("===================================");
  
  try {
    // Create provider and wallet
    const provider = createProvider();
    console.log("✅ Connected to Gnosis Chain");
    
    const wallet = createWallet(provider);
    const walletAddress = await wallet.getAddress();
    console.log(`✅ Wallet created: ${walletAddress}`);
    
    // Check balances before testing
    console.log("\n💰 BALANCES BEFORE TESTING:");
    await testBalances(walletAddress, provider);
    
    // Create a futarchy instance with custom provider/signer
    const futarchy = createFutarchy({ 
      customProvider: provider,
      customSigner: wallet,
      autoInitialize: false // Disable auto-initialization
    });
    console.log("✅ Futarchy instance created");
    
    // Manually initialize the futarchy instance
    await futarchy.initialize();
    console.log("✅ Futarchy instance initialized");
    
    // Test with a tiny amount to minimize cost
    const testAmount = "0.000001";
    
    // Test currency collateral addition
    await testCollateralAddition("currency", testAmount, futarchy);
    
    // Test company collateral addition
    await testCollateralAddition("company", testAmount, futarchy);
    
    // Optional: Test collateral removal
    if (testRemoval) {
      console.log("\n🔄 Testing collateral removal...");
      
      // Test currency collateral removal
      await testCollateralRemoval("currency", testAmount, futarchy);
      
      // Test company collateral removal
      await testCollateralRemoval("company", testAmount, futarchy);
    }
    
    // Check balances after testing
    console.log("\n💰 BALANCES AFTER TESTING:");
    await testBalances(walletAddress, provider);
    
    console.log("\n✅ Collateral test completed successfully!");
    
  } catch (error) {
    console.error("\n❌ Test failed with error:", error);
    throw error;
  }
}

// Run the test directly
// Parse command line arguments
const args = process.argv.slice(2);
const testRemoval = args.includes('--test-removal') || args.includes('-r');

console.log(`Test configuration: ${testRemoval ? 'WITH' : 'WITHOUT'} collateral removal`);

// Run the test with options
runCollateralTest({ testRemoval })
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Fatal error:", error);
    process.exit(1);
  }); 