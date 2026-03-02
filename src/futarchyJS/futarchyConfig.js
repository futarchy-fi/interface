// Import from our local wrapper instead of the original contracts file
import {
  BASE_TOKENS_CONFIG,
  MERGE_CONFIG,
  FUTARCHY_ROUTER_ADDRESS,
  SUSHISWAP_V2_ROUTER,
  MARKET_ADDRESS
} from "./contractWrapper.js";
import { ethers } from "ethers";

export const TOKEN_CONFIG = {
  currency: {
    ...BASE_TOKENS_CONFIG.currency,
    getTokenAddresses: (eventHappens) => {
      try {
        return {
          yes: MERGE_CONFIG?.currencyPositions?.yes?.wrap?.wrappedCollateralTokenAddress,
          no: MERGE_CONFIG?.currencyPositions?.no?.wrap?.wrappedCollateralTokenAddress
        };
      } catch (err) {
        console.warn('Warning: Error getting currency token addresses:', err);
        return { yes: null, no: null };
      }
    }
  },
  company: {
    ...BASE_TOKENS_CONFIG.company,
    getTokenAddresses: (eventHappens) => {
      try {
        return {
          yes: MERGE_CONFIG?.companyPositions?.yes?.wrap?.wrappedCollateralTokenAddress,
          no: MERGE_CONFIG?.companyPositions?.no?.wrap?.wrappedCollateralTokenAddress
        };
      } catch (err) {
        console.warn('Warning: Error getting company token addresses:', err);
        return { yes: null, no: null };
      }
    }
  },
  SUSHI_ROUTER: SUSHISWAP_V2_ROUTER
};

export const CONTRACT_ADDRESSES = {
  futarchyRouter: FUTARCHY_ROUTER_ADDRESS,
  sushiswap: SUSHISWAP_V2_ROUTER,
  market: MARKET_ADDRESS
};

// Market information (will be populated with data from the contract)
export const MARKET_INFO = {
  name: "Loading market question...",
  getFormattedName: () => MARKET_INFO.name,
  getYesOutcomeName: () => `${MARKET_INFO.name} - IF YES`,
  getNoOutcomeName: () => `${MARKET_INFO.name} - IF NO`
};

export const INITIAL_BALANCES = {
  currency: {
    wallet: { amount: "0", formatted: "0" },
    collateral: { yes: "0", no: "0", total: 0, netPosition: 0 }
  },
  company: {
    wallet: { amount: "0", formatted: "0" },
    collateral: { yes: "0", no: "0", total: 0, netPosition: 0 }
  }
};

export const TRANSACTION_SETTINGS = {
  DEFAULT_GAS_LIMIT: ethers.BigNumber.from("300000"),
  GAS_PRICE_BUFFER: 1.2, // 20% buffer
  CONFIRMATION_BLOCKS: 1,
  MAX_APPROVAL_AMOUNT: ethers.constants.MaxUint256,
  REFRESH_INTERVAL_MS: 5000
};

export const SWAP_CONFIG = {
  currency: {
    buy: {
      method: "swapExactTokensForTokens",
      description: "Buying YES SDAI tokens"
    },
    sell: {
      method: "swapTokensForExactTokens",
      description: "Selling YES SDAI tokens"
    }
  },
  company: {
    buy: {
      method: "swapExactTokensForTokens",
      description: "Buying YES GNO tokens"
    },
    sell: {
      method: "swapTokensForExactTokens",
      description: "Selling YES GNO tokens"
    }
  }
};

export const ERROR_MESSAGES = {
  NO_PROVIDER: "No ethereum provider found",
  INSUFFICIENT_BALANCE: "Insufficient balance",
  INVALID_AMOUNT: "Invalid amount",
  USER_REJECTED: "Transaction rejected by user",
  INSUFFICIENT_GAS: "Insufficient funds for gas",
  GENERIC_ERROR: "Transaction failed"
};

export const STATUS_MESSAGES = {
  PREPARING_TRANSACTION: "Preparing transaction...",
  CHECKING_ALLOWANCE: "Checking token allowance...",
  APPROVING_TOKEN: "Approving token...",
  ESTIMATING_GAS: "Estimating gas...",
  EXECUTING_SWAP: "Executing swap...",
  WAITING_CONFIRMATION: "Waiting for confirmation...",
  TRANSACTION_CONFIRMED: "Transaction confirmed",
  TRANSACTION_FAILED: "Transaction failed"
}; 