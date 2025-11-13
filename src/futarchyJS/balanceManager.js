import { ethers } from "ethers";
import { TOKEN_CONFIG, INITIAL_BALANCES } from "./futarchyConfig.js";
import { getProviderAndSigner as defaultGetProviderAndSigner, calculatePositionInfo } from "./futarchyUtils.js";

/**
 * Balance Manager module for tracking token balances
 * @module balanceManager
 */

/**
 * Creates a balance manager instance
 * @param {Object} config - Configuration options
 * @param {Function} config.getProviderAndSigner - Custom function to get provider and signer
 * @returns {Object} Balance manager methods and state
 */
export const createBalanceManager = (config = {}) => {
  // Use custom getProviderAndSigner if provided, otherwise use default
  const getProviderAndSigner = config.getProviderAndSigner || defaultGetProviderAndSigner;
  
  // Internal state
  let balances = { ...INITIAL_BALANCES };
  let refreshInterval = null;
  let isAutoRefreshing = false;
  let callbacks = {
    onBalancesUpdated: null
  };

  /**
   * Gets token balance for a specific token
   * @param {string} tokenAddress - Token contract address
   * @param {string} userAddress - User's wallet address
   * @param {Provider} provider - Ethereum provider
   * @returns {Promise<BigNumber>} Token balance
   */
  const getTokenBalance = async (tokenAddress, userAddress, provider) => {
    try {
      // Check if tokenAddress is null or undefined and return 0 instead of failing
      if (!tokenAddress) {
        console.warn('Warning: Attempted to get balance for null token address');
        return ethers.BigNumber.from(0);
      }
      
      const contract = new ethers.Contract(tokenAddress, ["function balanceOf(address) view returns (uint256)"], provider);
      const balance = await contract.balanceOf(userAddress);
      return balance;
    } catch (err) {
      console.error('Error fetching token balance:', err);
      return ethers.BigNumber.from(0);
    }
  };

  /**
   * Updates all token balances
   * @returns {Promise<Object>} Updated balances
   */
  const updateBalances = async () => {
    try {
      const { provider, signer } = getProviderAndSigner();
      const userAddress = await signer.getAddress();

      // Safely get token addresses, handling null/undefined cases
      const currencyAddress = TOKEN_CONFIG.currency.address;
      const companyAddress = TOKEN_CONFIG.company.address;
      
      // Safely get yes/no token addresses
      let currencyYesAddress, currencyNoAddress, companyYesAddress, companyNoAddress;
      try {
        const currencyTokens = TOKEN_CONFIG.currency.getTokenAddresses();
        currencyYesAddress = currencyTokens?.yes;
        currencyNoAddress = currencyTokens?.no;
      } catch (err) {
        console.warn('Warning: Could not get currency position token addresses:', err);
        currencyYesAddress = null;
        currencyNoAddress = null;
      }
      
      try {
        const companyTokens = TOKEN_CONFIG.company.getTokenAddresses();
        companyYesAddress = companyTokens?.yes;
        companyNoAddress = companyTokens?.no;
      } catch (err) {
        console.warn('Warning: Could not get company position token addresses:', err);
        companyYesAddress = null;
        companyNoAddress = null;
      }

      // Get all balances in parallel
      const [
        currencyWallet,
        companyWallet,
        currencyYes,
        currencyNo,
        companyYes,
        companyNo
      ] = await Promise.all([
        getTokenBalance(currencyAddress, userAddress, provider),
        getTokenBalance(companyAddress, userAddress, provider),
        getTokenBalance(currencyYesAddress, userAddress, provider),
        getTokenBalance(currencyNoAddress, userAddress, provider),
        getTokenBalance(companyYesAddress, userAddress, provider),
        getTokenBalance(companyNoAddress, userAddress, provider)
      ]);

      // Format all balances
      const formatBalance = (balance, decimals) => ({
        amount: balance.toString(),
        formatted: ethers.utils.formatUnits(balance, decimals)
      });

      const currencyYesFormatted = ethers.utils.formatUnits(currencyYes, TOKEN_CONFIG.currency.decimals);
      const currencyNoFormatted = ethers.utils.formatUnits(currencyNo, TOKEN_CONFIG.currency.decimals);
      const companyYesFormatted = ethers.utils.formatUnits(companyYes, TOKEN_CONFIG.company.decimals);
      const companyNoFormatted = ethers.utils.formatUnits(companyNo, TOKEN_CONFIG.company.decimals);

      balances = {
        currency: {
          wallet: formatBalance(currencyWallet, TOKEN_CONFIG.currency.decimals),
          collateral: {
            yes: currencyYesFormatted,
            no: currencyNoFormatted,
            ...calculatePositionInfo(currencyYesFormatted, currencyNoFormatted)
          }
        },
        company: {
          wallet: formatBalance(companyWallet, TOKEN_CONFIG.company.decimals),
          collateral: {
            yes: companyYesFormatted,
            no: companyNoFormatted,
            ...calculatePositionInfo(companyYesFormatted, companyNoFormatted)
          }
        }
      };

      // Notify listeners
      if (callbacks.onBalancesUpdated) {
        callbacks.onBalancesUpdated(balances);
      }

      return balances;
    } catch (err) {
      console.error('Error updating balances:', err);
      return balances;
    }
  };

  /**
   * Starts auto-refreshing balances
   * @param {number} intervalMs - Refresh interval in milliseconds
   * @returns {boolean} Success status
   */
  const startAutoRefresh = (intervalMs = 5000) => {
    const safeInterval = Math.max(1000, intervalMs);
    
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }

    try {
      refreshInterval = setInterval(updateBalances, safeInterval);
      isAutoRefreshing = true;
      return true;
    } catch (err) {
      console.error('Error starting auto-refresh:', err);
      return false;
    }
  };

  /**
   * Stops auto-refreshing balances
   */
  const stopAutoRefresh = () => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
    isAutoRefreshing = false;
  };

  /**
   * Gets current balances
   * @returns {Object} Current balances
   */
  const getBalances = () => {
    return balances;
  };

  /**
   * Sets a callback for balance updates
   * @param {Function} callback - Callback function
   */
  const onBalancesUpdated = (callback) => {
    callbacks.onBalancesUpdated = callback;
  };

  /**
   * Cleans up resources
   */
  const cleanup = () => {
    stopAutoRefresh();
    callbacks.onBalancesUpdated = null;
  };

  // Initialize by updating balances once
  updateBalances();

  // Check if we're in a browser environment
  const isBrowser = typeof window !== 'undefined';
  
  // Setup account change listener (browser only)
  if (isBrowser && window.ethereum) {
    const handleAccountsChanged = () => {
      updateBalances();
    };
    
    window.ethereum.on('accountsChanged', handleAccountsChanged);
    
    // Return cleanup function
    const removeAccountListener = () => {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
    };
    
    // Add to cleanup
    const originalCleanup = cleanup;
    cleanup = () => {
      originalCleanup();
      removeAccountListener();
    };
  }

  // Return public API
  return {
    getBalances,
    updateBalances,
    isAutoRefreshing: () => isAutoRefreshing,
    startAutoRefresh,
    stopAutoRefresh,
    onBalancesUpdated,
    cleanup
  };
}; 