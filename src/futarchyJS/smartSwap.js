import { ethers } from 'ethers';

/**
 * Smart Swap module for executing token swaps with automatic collateral management
 * @module smartSwap
 */

/**
 * Creates a smart swap manager
 * @param {Object} futarchyManager - Futarchy manager instance
 * @returns {Object} Smart swap methods and state
 */
export const createSmartSwap = (futarchyManager) => {
  // Internal state
  let status = '';
  let error = null;
  let loading = false;
  let txHash = '';
  let callbacks = {
    onStatusChange: null,
    onError: null,
    onLoadingChange: null,
    onTxHashChange: null
  };

  /**
   * Updates status and notifies listeners
   * @param {string} newStatus - New status message
   */
  const setStatus = (newStatus) => {
    status = newStatus;
    if (callbacks.onStatusChange) {
      callbacks.onStatusChange(status);
    }
  };

  /**
   * Updates error and notifies listeners
   * @param {Error} newError - New error object
   */
  const setError = (newError) => {
    error = newError;
    if (callbacks.onError) {
      callbacks.onError(error);
    }
  };

  /**
   * Updates loading state and notifies listeners
   * @param {boolean} isLoading - New loading state
   */
  const setLoading = (isLoading) => {
    loading = isLoading;
    if (callbacks.onLoadingChange) {
      callbacks.onLoadingChange(loading);
    }
  };

  /**
   * Updates transaction hash and notifies listeners
   * @param {string} hash - New transaction hash
   */
  const setTxHash = (hash) => {
    txHash = hash;
    if (callbacks.onTxHashChange) {
      callbacks.onTxHashChange(txHash);
    }
  };

  /**
   * Calculates required collateral for a swap
   * @param {string} amount - Amount to swap
   * @param {string} tokenType - Token type (currency or company)
   * @param {boolean} eventHappens - Whether the event happens (YES or NO)
   * @returns {string} Required collateral amount
   */
  const getRequiredCollateral = (amount, tokenType, eventHappens) => {
    // Get current position
    const position = futarchyManager.getPosition(tokenType);
    const currentBalance = eventHappens ? position.yes : position.no;
    
    // Get token decimals from config
    const tokenConfig = futarchyManager.getTokenConfig ? 
      futarchyManager.getTokenConfig(tokenType) : 
      { decimals: 18 }; // Fallback only if getTokenConfig doesn't exist
    const tokenDecimals = tokenConfig.decimals;
    
    // Convert to numbers for comparison (using ethers to maintain precision)
    const amountBN = ethers.utils.parseUnits(amount, tokenDecimals);
    const currentBalanceBN = ethers.utils.parseUnits(currentBalance, tokenDecimals);
    
    // If we have enough balance, return 0
    if (currentBalanceBN.gte(amountBN)) {
      return '0';
    }
    
    // Otherwise, return the difference
    const diffBN = amountBN.sub(currentBalanceBN);
    return ethers.utils.formatUnits(diffBN, tokenDecimals);
  };

  /**
   * Executes a smart swap with automatic collateral management
   * @param {Object} params - Swap parameters
   * @param {string} params.amount - Amount to swap
   * @param {boolean} params.eventHappens - Whether the event happens (YES or NO)
   * @param {string} params.action - Action type (buy or sell)
   * @param {Function} params.onStart - Callback when swap starts
   * @param {Function} params.onCollateralNeeded - Callback when collateral is needed
   * @param {Function} params.onCollateralAdded - Callback when collateral is added
   * @param {Function} params.onSwapStart - Callback when swap starts
   * @param {Function} params.onSwapComplete - Callback when swap completes
   * @param {Function} params.onError - Callback when error occurs
   * @returns {Promise<boolean>} Success status
   */
  const smartSwap = async (params) => {
    const {
      amount,
      eventHappens,
      action,
      onStart,
      onCollateralNeeded,
      onCollateralAdded,
      onSwapStart,
      onSwapComplete,
      onError
    } = params;

    try {
      setLoading(true);
      setError(null);
      onStart?.();

      // Validate input
      if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
        throw new Error('Invalid amount');
      }

      // For buy actions, we need to check/add collateral
      if (action === 'buy') {
        const tokenType = 'currency';
        const requiredCollateral = getRequiredCollateral(amount, tokenType, eventHappens);

        console.log('Collateral check:', {
          amount,
          eventHappens,
          currentBalance: futarchyManager.getPosition(tokenType)[eventHappens ? 'yes' : 'no'],
          requiredCollateral
        });

        // If we need more collateral
        if (parseFloat(requiredCollateral) > 0) {
          onCollateralNeeded?.(requiredCollateral);
          setStatus('Adding required collateral...');

          // Add the required collateral
          await futarchyManager.addCollateral(tokenType, requiredCollateral, {
            onStart: () => setStatus('Starting collateral addition...'),
            onApprove: () => setStatus('Approving token...'),
            onSplit: (tx) => {
              setStatus('Splitting position...');
              setTxHash(tx.hash);
            },
            onComplete: () => {
              setStatus('Collateral added successfully');
              onCollateralAdded?.();
            }
          });
        }
      }

      // Execute the swap
      const swaps = futarchyManager.marketSwaps();
      const outcome = eventHappens ? swaps.yes : swaps.no;
      const swapMethod = action === 'buy' 
        ? outcome.swapCurrencyToCompany 
        : outcome.swapCompanyToCurrency;

      onSwapStart?.();
      setStatus('Starting swap...');

      await swapMethod(amount, {
        onStart: () => setStatus('Initializing swap...'),
        onApprove: () => setStatus('Approving token for swap...'),
        onFetchRoute: () => setStatus('Finding best swap route...'),
        onSwap: () => setStatus('Executing swap...'),
        onSwapSent: (tx) => {
          setStatus('Swap transaction sent...');
          setTxHash(tx.hash);
        },
        onComplete: (tx) => {
          setStatus('Swap completed successfully!');
          setTxHash(tx.hash);
          onSwapComplete?.(tx);
        }
      });

      setLoading(false);
      return true;

    } catch (err) {
      console.error('Smart swap failed:', err);
      setError(err);
      setLoading(false);
      setStatus(`Error: ${err.message}`);
      onError?.(err);
      return false;
    }
  };

  /**
   * Sets a callback for status changes
   * @param {Function} callback - Callback function
   */
  const onStatusChange = (callback) => {
    callbacks.onStatusChange = callback;
  };

  /**
   * Sets a callback for errors
   * @param {Function} callback - Callback function
   */
  const onError = (callback) => {
    callbacks.onError = callback;
  };

  /**
   * Sets a callback for loading state changes
   * @param {Function} callback - Callback function
   */
  const onLoadingChange = (callback) => {
    callbacks.onLoadingChange = callback;
  };

  /**
   * Sets a callback for transaction hash changes
   * @param {Function} callback - Callback function
   */
  const onTxHashChange = (callback) => {
    callbacks.onTxHashChange = callback;
  };

  /**
   * Gets current status
   * @returns {string} Current status
   */
  const getStatus = () => status;

  /**
   * Gets current error
   * @returns {Error} Current error
   */
  const getError = () => error;

  /**
   * Gets current loading state
   * @returns {boolean} Current loading state
   */
  const isLoading = () => loading;

  /**
   * Gets current transaction hash
   * @returns {string} Current transaction hash
   */
  const getTxHash = () => txHash;

  /**
   * Cleans up resources
   */
  const cleanup = () => {
    callbacks.onStatusChange = null;
    callbacks.onError = null;
    callbacks.onLoadingChange = null;
    callbacks.onTxHashChange = null;
  };

  // Return public API
  return {
    smartSwap,
    getStatus,
    getError,
    isLoading,
    getTxHash,
    getRequiredCollateral,
    onStatusChange,
    onError,
    onLoadingChange,
    onTxHashChange,
    cleanup
  };
}; 