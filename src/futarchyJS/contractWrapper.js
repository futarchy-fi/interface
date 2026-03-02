/**
 * ContractWrapper - A wrapper for contracts.js
 * 
 * This file creates a bridge between the React component-based contract definitions
 * and the vanilla JS module system we're using for futarchyJS.
 * 
 * It now uses environment variables via dotEnvConfig.js for better configurability.
 * Token information can be loaded directly from the market contract.
 */

import { ethers } from "ethers";
import { config, initializeFromMarketContract } from "./dotEnvConfig.js";
import { MARKET_INFO } from "./futarchyConfig.js";

// Flag to track initialization status
let isInitialized = false;
let initializationPromise = null;

/**
 * Initialize the contract wrapper by loading token information from the market contract
 * @returns {Promise<boolean>} - True if initialization is successful
 */
export async function initialize() {
  if (isInitialized) return true;
  
  if (initializationPromise) {
    return initializationPromise;
  }
  
  initializationPromise = (async () => {
    try {
      // Initialize token information from the market contract
      const success = await initializeFromMarketContract();
      if (!success) {
        console.error("Failed to initialize contract wrapper - could not get token information from market contract");
        return false;
      }
      
      isInitialized = true;
      return true;
    } catch (error) {
      console.error("Error initializing contract wrapper:", error);
      return false;
    }
  })();
  
  return initializationPromise;
}

// Export contract addresses from environment variables
export const CONDITIONAL_TOKENS_ADDRESS = config.contracts.conditionalTokens;
export const MARKET_ADDRESS = config.contracts.market;
export const FUTARCHY_ROUTER_ADDRESS = config.contracts.futarchyRouter;
export const SUSHISWAP_V2_ROUTER = config.dex.sushiswapV2.router;
export const SUSHISWAP_V3_ROUTER = config.dex.sushiswapV3.router;

// Export token configurations from environment variables
// These will be populated after initialization
export let BASE_TOKENS_CONFIG = {
  currency: {
    name: config.baseTokens.currency.name,
    address: config.baseTokens.currency.address,
    decimals: config.baseTokens.currency.decimals
  },
  company: {
    name: config.baseTokens.company.name,
    address: config.baseTokens.company.address,
    decimals: config.baseTokens.company.decimals
  }
};

// Export position tokens configuration based on environment variables
export const MERGE_CONFIG = {
  currencyPositions: {
    yes: {
      wrap: {
        wrappedCollateralTokenAddress: config.positionTokens.currency.yes
      }
    },
    no: {
      wrap: {
        wrappedCollateralTokenAddress: config.positionTokens.currency.no
      }
    }
  },
  companyPositions: {
    yes: {
      wrap: {
        wrappedCollateralTokenAddress: config.positionTokens.company.yes
      }
    },
    no: {
      wrap: {
        wrappedCollateralTokenAddress: config.positionTokens.company.no
      }
    }
  }
};

// Common ABIs
export const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
  'function transfer(address recipient, uint256 amount) external returns (bool)',
  'function transferFrom(address sender, address recipient, uint256 amount) external returns (bool)',
  // Keep these additional methods for our testing convenience
  'function decimals() external view returns (uint8)',
  'function symbol() external view returns (string)'
];

export const FUTARCHY_ROUTER_ABI = [
  {
    "inputs": [
      {
        "internalType": "contract FutarchyProposal",
        "name": "proposal",
        "type": "address"
      },
      {
        "internalType": "contract IERC20",
        "name": "collateralToken",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "splitPosition",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "contract FutarchyProposal",
        "name": "proposal", 
        "type": "address"
      },
      {
        "internalType": "contract IERC20",
        "name": "collateralToken",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "mergePositions",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

export const UNISWAP_V3_POOL_ABI = [
  "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)"
];

export const SDAI_CONTRACT_RATE = config.contracts.currencyRateProvider;

// Pool configurations from environment variables
// These need to be exported synchronously since they're used before initialization
export const POOL_CONFIG_YES = {
  address: config.pools.yes.address,
  tokenCompanySlot: config.pools.yes.tokenCompanySlot,
};

export const POOL_CONFIG_NO = {
  address: config.pools.no.address,
  tokenCompanySlot: config.pools.no.tokenCompanySlot,
};

// Add SDAI rate provider ABI
export const SDAI_RATE_PROVIDER_ABI = [
  {
    "inputs": [],
    "name": "getRate",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

/**
 * Helper function to refresh token configuration - used after initialization
 */
export function refreshTokenConfig() {
  BASE_TOKENS_CONFIG = {
    currency: {
      name: config.baseTokens.currency.name,
      address: config.baseTokens.currency.address,
      decimals: config.baseTokens.currency.decimals
    },
    company: {
      name: config.baseTokens.company.name,
      address: config.baseTokens.company.address,
      decimals: config.baseTokens.company.decimals
    }
  };
  
  // Update position token addresses in MERGE_CONFIG
  MERGE_CONFIG.currencyPositions.yes.wrap.wrappedCollateralTokenAddress = 
    config.positionTokens.currency.yes;
  MERGE_CONFIG.currencyPositions.no.wrap.wrappedCollateralTokenAddress = 
    config.positionTokens.currency.no;
  MERGE_CONFIG.companyPositions.yes.wrap.wrappedCollateralTokenAddress = 
    config.positionTokens.company.yes;
  MERGE_CONFIG.companyPositions.no.wrap.wrappedCollateralTokenAddress = 
    config.positionTokens.company.no;
    
  // Update market information
  if (config.market && config.market.name) {
    MARKET_INFO.name = config.market.name;
  }
}

// Run initialization if auto-initialization is enabled
if (config.settings.autoInitialize) {
  initialize().then(success => {
    if (success) {
      refreshTokenConfig();
    }
  });
}

// Export as default for compatibility with both import styles
export default {
  initialize,
  CONDITIONAL_TOKENS_ADDRESS,
  MARKET_ADDRESS,
  FUTARCHY_ROUTER_ADDRESS,
  SUSHISWAP_V2_ROUTER,
  SUSHISWAP_V3_ROUTER,
  BASE_TOKENS_CONFIG,
  MERGE_CONFIG,
  ERC20_ABI,
  FUTARCHY_ROUTER_ABI,
  UNISWAP_V3_POOL_ABI,
  SDAI_CONTRACT_RATE,
  SDAI_RATE_PROVIDER_ABI,
  POOL_CONFIG_YES,
  POOL_CONFIG_NO
}; 