const fs = require('fs');
const path = require('path');

// Load chain configuration
const chainConfigPath = path.join(__dirname, '..', 'config', 'chains.config.json');
const chainConfig = JSON.parse(fs.readFileSync(chainConfigPath, 'utf8'));

// Get chain ID from environment or use default
const CHAIN_ID = process.env.CHAIN_ID || chainConfig.defaultChain;

// Get configuration for selected chain
const selectedChain = chainConfig.chains[CHAIN_ID];
if (!selectedChain) {
  throw new Error(`Chain ID ${CHAIN_ID} not found in chains.config.json`);
}

// Determine AMM (default per chain, override via env)
const SELECTED_AMM = (process.env.AMM || selectedChain.defaultAMM || 'swapr').toLowerCase();

// Resolve active contracts set based on AMM selection
const contractsByAMM = selectedChain.contractsByAMM || {};
const ACTIVE_CONTRACTS = contractsByAMM[SELECTED_AMM] || selectedChain.contracts || {};

// Export configuration dynamically based on chain
module.exports = {
  // Core Infrastructure
  NETWORK: {
    NAME: selectedChain.name,
    CHAIN_ID: selectedChain.chainId,
    // RPC_URL keeps backward-compat (env can override when not selecting a chain explicitly)
    RPC_URL: process.env.RPC_URL || selectedChain.rpcUrl,
    // CHAIN_RPC_URL always reflects the configured chain RPC (ignores env)
    CHAIN_RPC_URL: selectedChain.rpcUrl
  },

  // DEX Contracts (Uniswap V3 on Ethereum, Swapr V3 on Gnosis)
  POSITION_MANAGER: ACTIVE_CONTRACTS.POSITION_MANAGER,
  SWAP_ROUTER: ACTIVE_CONTRACTS.SWAP_ROUTER,
  POOL_FACTORY: ACTIVE_CONTRACTS.POOL_FACTORY,

  // Futarchy Contracts
  FUTARCHY_FACTORY: selectedChain.contracts.FUTARCHY_FACTORY,
  DEFAULT_ADAPTER: selectedChain.contracts.DEFAULT_ADAPTER,

  // Default Tokens
  DEFAULT_COMPANY_TOKEN: selectedChain.tokens.DEFAULT_COMPANY_TOKEN.address,
  DEFAULT_CURRENCY_TOKEN: selectedChain.tokens.DEFAULT_CURRENCY_TOKEN.address,

  // Token Symbols (for display)
  DEFAULT_COMPANY_SYMBOL: selectedChain.tokens.DEFAULT_COMPANY_TOKEN.symbol,
  DEFAULT_CURRENCY_SYMBOL: selectedChain.tokens.DEFAULT_CURRENCY_TOKEN.symbol,

  // Proposal Defaults
  DEFAULT_MIN_BOND: chainConfig.proposalDefaults.MIN_BOND,
  DEFAULT_CATEGORY: chainConfig.proposalDefaults.CATEGORY,
  DEFAULT_LANGUAGE: chainConfig.proposalDefaults.LANGUAGE,
  DEFAULT_OPENING_TIME_OFFSET: chainConfig.proposalDefaults.OPENING_TIME_OFFSET,

  // Pool Configuration
  TICK_SPACING: chainConfig.proposalDefaults.TICK_SPACING,
  TICK_LOWER_FULL: chainConfig.proposalDefaults.TICK_LOWER_FULL,
  TICK_UPPER_FULL: chainConfig.proposalDefaults.TICK_UPPER_FULL,
  SLIPPAGE_TOLERANCE: chainConfig.proposalDefaults.SLIPPAGE_TOLERANCE,
  DEADLINE_MINUTES: chainConfig.proposalDefaults.DEADLINE_MINUTES,

  // Gas Settings
  GAS_SETTINGS: selectedChain.gasSettings,
  
  // Gas price configuration
  GAS_PRICE_GWEI: process.env.GAS_PRICE_GWEI || selectedChain.gasPriceGwei,

  // Block Explorer
  EXPLORER: selectedChain.explorer,

  // Metadata
  SELECTED_AMM,

  // Helper function to get explorer link
  getExplorerTxLink: (txHash) => `${selectedChain.explorer}/tx/${txHash}`,
  getExplorerAddressLink: (address) => `${selectedChain.explorer}/address/${address}`,

  // Function to reload with different chain
  reloadForChain: (chainId) => {
    delete require.cache[require.resolve('./constants')];
    process.env.CHAIN_ID = chainId;
    return require('./constants');
  }
};
