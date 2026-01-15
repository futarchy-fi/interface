/**
 * @fileoverview Example usage of the Futarchy system with environment variables
 * 
 * This file demonstrates how to use the futarchy system with the new 
 * environment variable-based configuration. It shows:
 * 
 * 1. How to create a futarchy instance using the values from .env
 * 2. How to override specific settings
 * 3. How to access the current configuration
 * 4. How to handle environment variable errors
 */

import { createFutarchy, environmentConfig, getEnvironmentConfig } from './futarchy.js';
import { ethers } from 'ethers';

// Example 1: Create a futarchy instance with configuration from .env
async function runWithDefaultConfig() {
  console.log('Creating futarchy instance with configuration from .env');
  
  // Create instance with values from .env
  const futarchy = createFutarchy();
  
  // Initialize and check for errors
  const initializationSuccessful = await futarchy.initialize();
  if (!initializationSuccessful) {
    console.error("❌ Initialization failed - missing required .env variables");
    return;
  }
  
  console.log('✅ Initialization successful!');
  
  // Show current configuration
  console.log('Current configuration loaded from .env:');
  console.log('Base tokens:');
  console.log(`- Currency Token (${environmentConfig.baseTokens.currency.name}): ${environmentConfig.baseTokens.currency.address}`);
  console.log(`- Company Token (${environmentConfig.baseTokens.company.name}): ${environmentConfig.baseTokens.company.address}`);
  
  // Fetch prices
  console.log('Fetching pool prices...');
  await futarchy.fetchPoolPrices();
  const prices = futarchy.getPoolPrices();
  console.log('Current prices:', prices);
  
  // Check balances
  await futarchy.updateBalances();
  const balances = futarchy.getBalances();
  console.log('Current balances:', balances);
  
  // Cleanup
  futarchy.cleanup();
}

// Example 2: Create a futarchy instance with custom overrides
async function runWithCustomConfig() {
  console.log('Creating futarchy instance with custom overrides');
  
  // Custom RPC provider - NOTE: env variables must still be provided
  const provider = new ethers.providers.JsonRpcProvider('https://rpc-gnosis.ankr.com');
  const wallet = new ethers.Wallet('0x0000000000000000000000000000000000000000000000000000000000000000', provider);
  
  // Create instance with overrides
  const futarchy = createFutarchy({
    customProvider: provider,
    customSigner: wallet,
    testMode: true, // Enable test mode
    useSushiV3: false // Use Sushi V2 instead of V3
  });
  
  // Initialize and check for validation errors
  const initialized = await futarchy.initialize();
  if (!initialized) {
    console.error("Failed to initialize with custom config - missing required .env variables");
    return;
  }
  
  // Show current configuration
  console.log('Custom configuration with overrides:');
  console.log('- Test Mode: enabled');
  console.log('- Sushi V3: disabled');
  
  // Add test collateral in test mode
  const result = await futarchy.addCollateral('currency', '0.1', {
    onStart: () => console.log('Starting collateral addition...'),
    onApprove: (tx) => console.log('Approval sent:', tx.hash),
    onComplete: (receipt) => console.log('Completed:', receipt.blockNumber)
  });
  
  console.log('Add collateral result:', result);
  
  // Cleanup
  futarchy.cleanup();
}

// Example 3: Working with environment configuration directly
function inspectEnvironmentConfig() {
  console.log('Inspecting current environment configuration');
  
  // Get full configuration
  const config = getEnvironmentConfig();
  
  console.log('Environment Configuration Summary:');
  console.log('--------------------------------');
  
  // Check for missing variables
  if (config.environment.missingVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    config.environment.missingVars.forEach(v => console.error(`- ${v}`));
    console.error('Operation cannot proceed - all variables must be defined in .env');
    return false;
  } else {
    console.log('✅ All required variables are set correctly');
  }
  
  // Show authentication settings
  console.log('\nAuthentication:');
  console.log(`- RPC URL: ${config.rpcUrl}`);
  console.log(`- Private Key defined: ${config.privateKey ? 'Yes' : 'No'}`);
  
  // Show token roles and implementations
  console.log('\nToken Role Configuration:');
  console.log(`- Currency Role: ${config.baseTokens.currency.name} (${config.baseTokens.currency.address})`);
  console.log(`- Company Role: ${config.baseTokens.company.name} (${config.baseTokens.company.address})`);
  console.log(`- Native Role: ${config.baseTokens.native.name} (${config.baseTokens.native.address})`);
  
  // Show core contract addresses
  console.log('\nCore Contracts:');
  console.log(`- Futarchy Router: ${config.contracts.futarchyRouter}`);
  console.log(`- Market Address: ${config.contracts.market}`);
  console.log(`- Currency Rate Provider: ${config.contracts.currencyRateProvider}`);
  
  // Show pool configuration
  console.log('\nPool Configuration:');
  console.log(`- YES Pool: ${config.pools.yes.address} (Company token slot: ${config.pools.yes.tokenCompanySlot})`);
  console.log(`- NO Pool: ${config.pools.no.address} (Company token slot: ${config.pools.no.tokenCompanySlot})`);
  
  // Show optional settings
  console.log('\nOptional Settings:');
  console.log(`- Test Mode: ${config.settings.testMode ? 'Enabled' : 'Disabled'}`);
  console.log(`- Use Sushi V3: ${config.settings.useSushiV3 ? 'Enabled' : 'Disabled'}`);
  console.log(`- Auto Initialize: ${config.settings.autoInitialize ? 'Enabled' : 'Disabled'}`);
  
  return true;
}

// Example 4: How to verify the environment is properly configured
function verifyEnvironmentCompleteness() {
  console.log('Verifying environment completeness before operations');
  
  // Get environment configuration
  const config = getEnvironmentConfig();
  
  // Check if any variables are missing - strict validation
  if (!config.environment.isValid) {
    console.error('\n🚨 CANNOT PROCEED: Missing required environment variables 🚨');
    console.error('The following variables must be set in your .env file:');
    config.environment.missingVars.forEach(v => console.error(`- ${v}`));
    console.error('\nPlease set these variables and try again.');
    console.error('No default values will be used.');
    return false;
  }
  
  // Now that we've verified all variables exist, check the RPC and private key
  // If we're using a private key, verify that it looks valid
  if (config.privateKey) {
    try {
      // Attempt to create a wallet with the private key to validate it
      const wallet = new ethers.Wallet(config.privateKey);
      console.log(`✅ Private key is valid (address: ${wallet.address})`);
    } catch (error) {
      console.error('❌ Private key is invalid:', error.message);
      return false;
    }
  }
  
  // Verify RPC URL format
  if (!config.rpcUrl.startsWith('http')) {
    console.error('❌ RPC URL is invalid - must start with http:// or https://');
    return false;
  }
  
  console.log('✅ Environment verification passed, all required variables present');
  return true;
}

// Run the examples
async function runExamples() {
  try {
    // First verify environment is complete
    if (!verifyEnvironmentCompleteness()) {
      console.error('Environment verification failed - all examples aborted');
      console.error('Please check your .env file and ensure all variables are set');
      return;
    }
    
    // Example 3: Inspect configuration (no blockchain interaction)
    if (!inspectEnvironmentConfig()) {
      console.error('Environment inspection failed - examples aborted');
      return;
    }
    
    // Example 4: Get token information from market contract
    await getTokenInfoFromMarketExample();
    
    // Example 5: Dynamic token loading
    // This demonstrates using futarchy with only the market address
    // Token information is loaded dynamically from the market contract
    // It does not require CURRENCY_ADDRESS, CURRENCY_NAME, COMPANY_ADDRESS, or COMPANY_NAME
    // in the .env file
    await runWithDynamicTokenLoading();
    
    // Uncomment to run examples that interact with the blockchain:
    // await runWithDefaultConfig();
    // await runWithCustomConfig();
    
    console.log('Examples completed successfully');
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// Execute if run directly
if (require.main === module) {
  runExamples().catch(console.error);
}

// Export examples for use in other files
export {
  runWithDefaultConfig,
  runWithCustomConfig,
  inspectEnvironmentConfig,
  verifyEnvironmentCompleteness,
  runExamples
};

/**
 * Example of dynamically getting token information from the market contract
 */
async function getTokenInfoFromMarketExample() {
  console.log('======= Getting Token Info From Market Example =======');
  
  try {
    // Import necessary modules
    const { ethers } = await import('ethers');
    const { getTokenInfoFromMarket } = await import('./futarchyUtils.js');
    const { contracts, pools } = await import('./dotEnvConfig.js');
    
    // Create a provider
    const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
    
    // Get token info using the configured company token slot
    const tokenInfo = await getTokenInfoFromMarket(
      contracts.market,
      provider,
      pools.market.companyTokenSlot
    );
    
    console.log('Token Information from Market Contract:');
    console.log('Company Token:', tokenInfo.company);
    console.log('Currency Token:', tokenInfo.currency);
    
    // Validate that the information matches our environment configuration
    console.log('\nValidating against environment configuration:');
    const { baseTokens } = await import('./dotEnvConfig.js');
    
    const companyMatchesEnv = tokenInfo.company.address.toLowerCase() === 
      baseTokens.company.address.toLowerCase();
    const currencyMatchesEnv = tokenInfo.currency.address.toLowerCase() === 
      baseTokens.currency.address.toLowerCase();
    
    console.log('Company token matches .env:', companyMatchesEnv);
    console.log('Currency token matches .env:', currencyMatchesEnv);
    
    if (!companyMatchesEnv || !currencyMatchesEnv) {
      console.warn('\nWARNING: Market contract tokens do not match your .env configuration!');
      console.warn('This could indicate that your MARKET_ADDRESS_COMPANY_SLOT setting is incorrect.');
      console.log('\nIf this is intentional, update your .env file to use these addresses:');
      console.log(`COMPANY_ADDRESS=${tokenInfo.company.address}`);
      console.log(`COMPANY_NAME=${tokenInfo.company.symbol}`);
      console.log(`CURRENCY_ADDRESS=${tokenInfo.currency.address}`);
      console.log(`CURRENCY_NAME=${tokenInfo.currency.symbol}`);
    }
    
    return tokenInfo;
  } catch (error) {
    console.error('Error in getTokenInfoFromMarketExample:', error);
  }
}

/**
 * Example demonstrating how to use futarchy with only the market address
 * Token information will be loaded dynamically from the market contract
 */
async function runWithDynamicTokenLoading() {
  console.log('======= Dynamic Token Loading Example =======');
  console.log('This example shows how to use futarchy with only the market address');
  console.log('Token information will be loaded directly from the market contract');
  
  try {
    // Import necessary modules
    const { ethers } = await import('ethers');
    const { createFutarchy } = await import('./futarchy.js');
    const { initializeFromMarketContract } = await import('./dotEnvConfig.js');
    
    // First, we'll initialize config from the market contract
    await initializeFromMarketContract();
    
    // Create a futarchy instance without autoInitialization
    // to demonstrate the process step by step
    const futarchy = createFutarchy({
      autoInitialize: false
    });
    
    console.log('Initializing futarchy...');
    await futarchy.initialize();
    
    console.log('Checking token balances...');
    const balances = await futarchy.getBalances();
    
    console.log('Currency Token Balances:');
    console.log(`  Base: ${balances.currency.wallet.formatted} ${futarchy.getTokenName('currency')}`);
    console.log(`  YES: ${balances.currency.collateral.yes}`);
    console.log(`  NO: ${balances.currency.collateral.no}`);
    
    console.log('Company Token Balances:');
    console.log(`  Base: ${balances.company.wallet.formatted} ${futarchy.getTokenName('company')}`);
    console.log(`  YES: ${balances.company.collateral.yes}`);
    console.log(`  NO: ${balances.company.collateral.no}`);
    
    // Clean up
    futarchy.cleanup();
    
    return balances;
  } catch (error) {
    console.error('Error in runWithDynamicTokenLoading:', error);
  }
}

// Add to the export of examples
export const examples = {
  // ... existing examples
  getTokenInfoFromMarket: getTokenInfoFromMarketExample,
  runWithDynamicTokenLoading
}; 