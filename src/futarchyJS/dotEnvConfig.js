/**
 * @fileoverview Environment Variable Configuration Manager
 * 
 * This module loads and provides access to all environment variables needed
 * by the futarchy system. It uses the role-based naming convention where
 * tokens are identified by their role (currency, company, native) rather than
 * specific implementations (SDAI, GNO, WXDAI).
 * 
 * IMPORTANT: Most environment variables are REQUIRED, except for token addresses
 * which can now be loaded dynamically from the market contract.
 * 
 * @module dotEnvConfig
 */

import 'dotenv/config';
import { ethers } from 'ethers';

// Arrays to track missing variables
const missingVars = [];
let isInitialized = false;
let initializationPromise = null;

/**
 * Loads an environment variable with strict validation
 * @param {string} key - The environment variable name
 * @returns {string|undefined} - The value from .env or undefined if missing
 */
function requireEnv(key) {
  const value = process.env[key];
  if (!value) {
    missingVars.push(key);
    return undefined;
  }
  return value;
}

/**
 * Loads an optional environment variable
 * @param {string} key - The environment variable name
 * @param {string} defaultValue - Default value if not present
 * @returns {string} - The value from .env or the default
 */
function optionalEnv(key, defaultValue = '') {
  return process.env[key] || defaultValue;
}

/**
 * Loads an Ethereum address with checksum validation
 * @param {string} key - The environment variable name for an Ethereum address
 * @returns {string|undefined} - The checksummed address or undefined if missing
 */
function requireAddress(key) {
  const value = requireEnv(key);
  if (!value) return undefined;
  
  try {
    // Convert to proper checksum format
    return ethers.utils.getAddress(value);
  } catch (err) {
    console.warn(`Warning: Address ${key}=${value} failed checksum validation. Will attempt to fix.`);
    // If there's an error, we'll still return the original value 
    // so the system can continue but will show an error later
    return value;
  }
}

/**
 * Loads an optional Ethereum address without validation errors
 * @param {string} key - The environment variable name for an Ethereum address
 * @returns {string|null} - The checksummed address or null if missing
 */
function optionalAddress(key) {
  const value = process.env[key];
  if (!value) return null;
  
  try {
    // Convert to proper checksum format
    return ethers.utils.getAddress(value);
  } catch (err) {
    return value;
  }
}

// Load configuration from environment variables
// Token addresses are now optional, as they can be loaded from the market contract
export const config = {
  // Authentication
  privateKey: requireEnv('PRIVATE_KEY'),
  rpcUrl: requireEnv('RPC_URL'),
  
  // Base Tokens (Role-Based Configuration) - now optional
  baseTokens: {
    currency: {
      address: optionalAddress('CURRENCY_ADDRESS'),
      name: optionalEnv('CURRENCY_NAME'),
      decimals: null
    },
    company: {
      address: optionalAddress('COMPANY_ADDRESS'),
      name: optionalEnv('COMPANY_NAME'),
      decimals: null
    },
    native: {
      address: requireAddress('NATIVE_ADDRESS'),
      name: requireEnv('NATIVE_NAME'),
      decimals: null
    }
  },
  
  // Position Tokens
  positionTokens: {
    currency: {
      yes: optionalAddress('YES_CURRENCY_ADDRESS'),
      no: optionalAddress('NO_CURRENCY_ADDRESS')
    },
    company: {
      yes: optionalAddress('YES_COMPANY_ADDRESS'),
      no: optionalAddress('NO_COMPANY_ADDRESS')
    }
  },
  
  // Core Contracts
  contracts: {
    currencyRateProvider: requireAddress('CURRENCY_RATE_PROVIDER'),
    futarchyRouter: requireAddress('FUTARCHY_ROUTER'),
    market: requireAddress('MARKET_ADDRESS'),
    conditionalTokens: requireAddress('CONDITIONAL_TOKENS')
  },
  
  // Uniswap V3 Pools
  pools: {
    market: {
      companyTokenSlot: parseInt(requireEnv('MARKET_ADDRESS_COMPANY_SLOT')),
      yesOutcomeSlot: parseInt(requireEnv('MARKET_OUTCOME_YES_SLOT'))
    },
    yes: {
      address: requireAddress('YES_POOL_ADDRESS'),
      tokenCompanySlot: parseInt(requireEnv('YES_POOL_TOKEN_COMPANY_SLOT'))
    },
    no: {
      address: requireAddress('NO_POOL_ADDRESS'),
      tokenCompanySlot: parseInt(requireEnv('NO_POOL_TOKEN_COMPANY_SLOT'))
    },
    prediction: {
      yes: {
        address: requireAddress('YES_PREDICTION_POOL_ADDRESS'),
        baseTokenSlot: parseInt(optionalEnv('YES_BASE_TOKEN_SLOT', '0'))
      },
      no: {
        address: requireAddress('NO_PREDICTION_POOL_ADDRESS'),
        baseTokenSlot: parseInt(optionalEnv('NO_BASE_TOKEN_SLOT', '1'))
      }
    }
  },
  
  // DEX Addresses
  dex: {
    sushiswapV2: {
      factory: requireAddress('SUSHISWAP_V2_FACTORY'),
      router: requireAddress('SUSHISWAP_V2_ROUTER')
    },
    sushiswapV3: {
      router: requireAddress('SUSHISWAP_V3_ROUTER')
    }
  },
  
  // Optional Settings - these are the only ones that can have defaults
  settings: {
    testMode: process.env.TEST_MODE === 'true',
    useSushiV3: process.env.USE_SUSHI_V3 !== 'false',
    autoInitialize: process.env.AUTO_INITIALIZE !== 'false',
    testAmount: requireEnv('TEST_AMOUNT')
  },
  
  // Constants for V3 swaps
  constants: {
    minSqrtRatio: "4295128740",
    maxSqrtRatio: "1461446703485210103287273052203988822378723970341"
  }
};

/**
 * Async function to initialize token information from the market contract
 * @returns {Promise<boolean>} True if initialization is successful
 */
export async function initializeFromMarketContract() {
  if (isInitialized) return true;
  
  if (initializationPromise) {
    return initializationPromise;
  }
  
  initializationPromise = (async () => {
    try {
      // Check if we have the market address
      if (!config.contracts.market) {
        console.error("Cannot initialize from market: MARKET_ADDRESS is missing");
        return false;
      }
      
      // Create a provider to interact with the blockchain
      const provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
      
      // Simple ABIs for the calls we need
      const marketAbi = [
        "function collateralToken1() view returns (address)",
        "function collateralToken2() view returns (address)",
        "function marketName() view returns (string)"
      ];
      
      const erc20Abi = [
        "function symbol() view returns (string)",
        "function decimals() view returns (uint8)"
      ];
      
      console.log("📊 Initializing token information from market contract...");
      
      // Create contract instances
      const marketContract = new ethers.Contract(config.contracts.market, marketAbi, provider);
      
      // Get the collateral token addresses from the market contract
      const collateralToken1 = await marketContract.collateralToken1();
      const collateralToken2 = await marketContract.collateralToken2();
      
      // Determine which is company and which is currency based on the configured slot
      const companyTokenAddress = config.pools.market.companyTokenSlot === 0 ? collateralToken1 : collateralToken2;
      const currencyTokenAddress = config.pools.market.companyTokenSlot === 0 ? collateralToken2 : collateralToken1;
      
      // Create token contracts to get symbols and decimals
      const companyContract = new ethers.Contract(companyTokenAddress, erc20Abi, provider);
      const currencyContract = new ethers.Contract(currencyTokenAddress, erc20Abi, provider);
      
      // Get token symbols and decimals
      const [companySymbol, companyDecimals, currencySymbol, currencyDecimals] = await Promise.all([
        companyContract.symbol(),
        companyContract.decimals(),
        currencyContract.symbol(),
        currencyContract.decimals()
      ]);
      
      // Update the configuration with the information from the contract
      config.baseTokens.company.address = companyTokenAddress;
      config.baseTokens.company.name = companySymbol;
      config.baseTokens.company.decimals = companyDecimals;
      
      config.baseTokens.currency.address = currencyTokenAddress;
      config.baseTokens.currency.name = currencySymbol;
      config.baseTokens.currency.decimals = currencyDecimals;
      
      console.log(`✅ Successfully loaded token information from market contract:`);
      console.log(`   Company Token: ${companySymbol} (${companyTokenAddress})`);
      console.log(`   Currency Token: ${currencySymbol} (${currencyTokenAddress})`);
      
      // Check if the retrieved info matches what's in the .env file (if provided)
      const envCompanyAddress = process.env.COMPANY_ADDRESS;
      const envCurrencyAddress = process.env.CURRENCY_ADDRESS;
      
      if (envCompanyAddress && envCompanyAddress.toLowerCase() !== companyTokenAddress.toLowerCase()) {
        console.warn(`⚠️ Warning: COMPANY_ADDRESS in .env (${envCompanyAddress}) doesn't match market contract (${companyTokenAddress})`);
      }
      
      if (envCurrencyAddress && envCurrencyAddress.toLowerCase() !== currencyTokenAddress.toLowerCase()) {
        console.warn(`⚠️ Warning: CURRENCY_ADDRESS in .env (${envCurrencyAddress}) doesn't match market contract (${currencyTokenAddress})`);
      }
      
      // Load position tokens from market contract
      const companySlot = config.pools.market.companyTokenSlot;
      const yesSlot = config.pools.market.yesOutcomeSlot;
      
      const positionTokens = await loadPositionTokensFromMarket(
        provider, 
        config.contracts.market, 
        companySlot, 
        yesSlot
      );
      
      if (positionTokens) {
        // Update position token addresses in config
        if (!config.positionTokens.company.yes) {
          config.positionTokens.company.yes = positionTokens.company.yes;
        }
        if (!config.positionTokens.company.no) {
          config.positionTokens.company.no = positionTokens.company.no;
        }
        if (!config.positionTokens.currency.yes) {
          config.positionTokens.currency.yes = positionTokens.currency.yes;
        }
        if (!config.positionTokens.currency.no) {
          config.positionTokens.currency.no = positionTokens.currency.no;
        }
        
        // Check if position tokens from contract match .env values
        const envYesCompanyAddress = process.env.YES_COMPANY_ADDRESS;
        const envNoCompanyAddress = process.env.NO_COMPANY_ADDRESS;
        const envYesCurrencyAddress = process.env.YES_CURRENCY_ADDRESS;
        const envNoCurrencyAddress = process.env.NO_CURRENCY_ADDRESS;
        
        if (envYesCompanyAddress && envYesCompanyAddress.toLowerCase() !== positionTokens.company.yes.toLowerCase()) {
          console.warn(`⚠️ Warning: YES_COMPANY_ADDRESS in .env doesn't match market contract`);
        }
        if (envNoCompanyAddress && envNoCompanyAddress.toLowerCase() !== positionTokens.company.no.toLowerCase()) {
          console.warn(`⚠️ Warning: NO_COMPANY_ADDRESS in .env doesn't match market contract`);
        }
        if (envYesCurrencyAddress && envYesCurrencyAddress.toLowerCase() !== positionTokens.currency.yes.toLowerCase()) {
          console.warn(`⚠️ Warning: YES_CURRENCY_ADDRESS in .env doesn't match market contract`);
        }
        if (envNoCurrencyAddress && envNoCurrencyAddress.toLowerCase() !== positionTokens.currency.no.toLowerCase()) {
          console.warn(`⚠️ Warning: NO_CURRENCY_ADDRESS in .env doesn't match market contract`);
        }
      } else {
        // If loading position tokens failed, use .env values if available
        console.warn("⚠️ Using position token addresses from .env file as fallback");
      }
      
      // Load market name
      let marketName;
      try {
        marketName = await marketContract.marketName();
        console.log(`Market Question: "${marketName}"`);
        // Store market name in config
        config.market = config.market || {};
        config.market.name = marketName;
      } catch (error) {
        console.warn("Could not load market name from contract:", error.message);
        config.market = config.market || {};
        config.market.name = "Unknown Market Question";
      }
      
      isInitialized = true;
      return true;
    } catch (error) {
      console.error("❌ Failed to initialize from market contract:", error);
      
      // If we have fallback values in the .env, use those
      if (config.baseTokens.company.address && config.baseTokens.currency.address) {
        console.warn("⚠️ Using token addresses from .env file as fallback");
        isInitialized = true;
        return true;
      }
      
      return false;
    }
  })();
  
  return initializationPromise;
}

/**
 * Async function to load position tokens from the market contract
 * @param {Object} provider - Ethers provider instance
 * @param {string} marketAddress - The address of the market contract
 * @param {number} companySlot - The slot (0 or 1) where the company token is stored
 * @param {number} yesSlot - The slot (0 or 1) where the YES outcome is stored
 * @returns {Promise<Object>} Object containing position token addresses
 */
async function loadPositionTokensFromMarket(provider, marketAddress, companySlot, yesSlot) {
  try {
    // Market contract ABI for wrappedOutcome function
    const marketAbi = [
      "function wrappedOutcome(uint256 index) view returns (address wrapped1155, bytes data)"
    ];
    
    // Create contract instance
    const marketContract = new ethers.Contract(marketAddress, marketAbi, provider);
    
    console.log("📊 Loading position tokens from market contract...");
    
    // Get position tokens for indices 0-3
    const positions = [];
    for (let i = 0; i < 4; i++) {
      const result = await marketContract.wrappedOutcome(i);
      positions.push(result.wrapped1155);
    }
    
    // Map positions based on companySlot and yesSlot
    let yesCompanyAddress, noCompanyAddress, yesCurrencyAddress, noCurrencyAddress;
    
    if (companySlot === 0) {
      if (yesSlot === 0) {
        // [YES_COMPANY, NO_COMPANY, YES_CURRENCY, NO_CURRENCY]
        [yesCompanyAddress, noCompanyAddress, yesCurrencyAddress, noCurrencyAddress] = positions;
      } else {
        // [NO_COMPANY, YES_COMPANY, NO_CURRENCY, YES_CURRENCY]
        [noCompanyAddress, yesCompanyAddress, noCurrencyAddress, yesCurrencyAddress] = positions;
      }
    } else {
      if (yesSlot === 0) {
        // [YES_CURRENCY, NO_CURRENCY, YES_COMPANY, NO_COMPANY]
        [yesCurrencyAddress, noCurrencyAddress, yesCompanyAddress, noCompanyAddress] = positions;
      } else {
        // [NO_CURRENCY, YES_CURRENCY, NO_COMPANY, YES_COMPANY]
        [noCurrencyAddress, yesCurrencyAddress, noCompanyAddress, yesCompanyAddress] = positions;
      }
    }
    
    console.log(`✅ Successfully loaded position tokens from market contract:`);
    console.log(`   YES_COMPANY: ${yesCompanyAddress}`);
    console.log(`   NO_COMPANY: ${noCompanyAddress}`);
    console.log(`   YES_CURRENCY: ${yesCurrencyAddress}`);
    console.log(`   NO_CURRENCY: ${noCurrencyAddress}`);
    
    return {
      company: {
        yes: yesCompanyAddress,
        no: noCompanyAddress
      },
      currency: {
        yes: yesCurrencyAddress,
        no: noCurrencyAddress
      }
    };
  } catch (error) {
    console.error("❌ Failed to load position tokens from market contract:", error);
    return null;
  }
}

/**
 * Checks if there are any missing environment variables and displays a clear error
 * @returns {boolean} True if all variables are present
 */
export function checkEnvironmentVariables() {
  // Filter out token addresses that are now optional
  const criticalMissing = missingVars.filter(v => 
    v !== 'CURRENCY_ADDRESS' && 
    v !== 'CURRENCY_NAME' && 
    v !== 'COMPANY_ADDRESS' && 
    v !== 'COMPANY_NAME'
  );
  
  if (criticalMissing.length > 0) {
    console.error("\n❌ ERROR: Missing required environment variables in .env file:");
    criticalMissing.forEach(key => console.error(`   - ${key}`));
    console.error("\nAll these variables must be defined in your .env file.");
    console.error("See the .env.example file for required variables.");
    return false;
  }
  
  if (!config.contracts.market) {
    console.error("\n❌ ERROR: MARKET_ADDRESS is required in .env file.");
    console.error("This is needed to initialize token information from the market contract.");
    return false;
  }
  
  console.log("✅ All required environment variables found in .env file.");
  return true;
}

// Add missing variable information to the configuration
config.environment = {
  missingVars,
  isValid: missingVars.filter(v => 
    v !== 'CURRENCY_ADDRESS' && 
    v !== 'CURRENCY_NAME' && 
    v !== 'COMPANY_ADDRESS' && 
    v !== 'COMPANY_NAME'
  ).length === 0,
  isInitialized: () => isInitialized
};

// Export individual sections for easier imports
export const { 
  baseTokens,
  positionTokens,
  contracts,
  pools,
  dex,
  settings,
  constants,
  environment
} = config;

// Run the check immediately
checkEnvironmentVariables();

// For backwards compatibility
export default config; 