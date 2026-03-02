import { SwapStrategyFactory } from './SwapStrategyFactory';

/**
 * Swap Executor - Orchestrates swap execution using strategies
 * Provides a unified interface for components while delegating to specific strategies
 */
export class SwapExecutor {
  constructor(signer, defaultConfig = {}) {
    this.signer = signer;
    this.defaultConfig = defaultConfig;
    this.currentStrategy = null;
    this.callbacks = {};
  }

  /**
   * Set callbacks for different stages of the swap
   * @param {Object} callbacks - Callback functions
   * @param {Function} callbacks.onApprovalStart - Called when approval starts
   * @param {Function} callbacks.onApprovalComplete - Called when approval completes
   * @param {Function} callbacks.onSwapStart - Called when swap starts
   * @param {Function} callbacks.onSwapComplete - Called when swap completes
   * @param {Function} callbacks.onError - Called when error occurs
   */
  setCallbacks(callbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Execute a swap using the specified strategy
   * @param {Object} params - Swap parameters
   * @param {string} params.strategyType - Strategy to use (algebra, cowswap, etc.)
   * @param {string} params.tokenIn - Input token address
   * @param {string} params.tokenOut - Output token address
   * @param {string|BigNumber} params.amount - Amount to swap
   * @param {string} params.userAddress - User's wallet address
   * @param {Object} params.strategyConfig - Strategy-specific configuration
   * @returns {Promise<Object>} Swap result
   */
  async executeSwap(params) {
    const {
      strategyType,
      tokenIn,
      tokenOut,
      amount,
      userAddress,
      strategyConfig = {}
    } = params;

    try {
      // Create strategy
      this.currentStrategy = SwapStrategyFactory.createStrategy(
        strategyType,
        this.signer,
        { ...this.defaultConfig, ...strategyConfig }
      );

      console.log(`Executing swap with ${this.currentStrategy.name} strategy`);

      // Set up strategy callbacks if needed
      this.setupStrategyCallbacks();

      // Execute swap through strategy
      const result = await this.currentStrategy.executeSwap({
        tokenIn,
        tokenOut,
        amount,
        userAddress
      });

      this.callbacks.onSwapComplete?.(result);
      return result;

    } catch (error) {
      console.error('Swap execution failed:', error);
      this.callbacks.onError?.(error);
      throw error;
    }
  }

  /**
   * Get quote/estimate for a swap
   * @param {Object} params - Quote parameters
   * @returns {Promise<Object>} Quote result
   */
  async getQuote(params) {
    const { strategyType, tokenIn, tokenOut, amount, userAddress, strategyConfig = {} } = params;

    try {
      const strategy = SwapStrategyFactory.createStrategy(
        strategyType,
        this.signer,
        { ...this.defaultConfig, ...strategyConfig }
      );

      return await strategy.estimateOutput({
        tokenIn,
        tokenOut,
        amount,
        userAddress
      });
    } catch (error) {
      console.error('Quote failed:', error);
      return null;
    }
  }

  /**
   * Get multiple quotes from different strategies
   * @param {Object} params - Quote parameters
   * @param {string[]} strategies - Array of strategy types to try
   * @returns {Promise<Object>} Map of strategy -> quote
   */
  async getMultipleQuotes(params, strategies = ['algebra', 'cowswap']) {
    const quotes = {};

    await Promise.allSettled(
      strategies.map(async (strategyType) => {
        try {
          const quote = await this.getQuote({ ...params, strategyType });
          if (quote) {
            quotes[strategyType] = quote;
          }
        } catch (error) {
          console.warn(`Quote failed for ${strategyType}:`, error.message);
          quotes[strategyType] = { error: error.message };
        }
      })
    );

    return quotes;
  }

  /**
   * Check if approval is needed for a strategy
   * @param {Object} params - Parameters
   * @returns {Promise<boolean>} Whether approval is needed
   */
  async checkApprovalNeeded(params) {
    const strategy = SwapStrategyFactory.createStrategy(params.strategyType, this.signer, this.defaultConfig);
    return await strategy.checkApproval(params);
  }

  /**
   * Check transaction status using strategy-specific method
   */
  async checkTransactionStatus(hashOrOrderId, strategyType) {
    const strategy = SwapStrategyFactory.createStrategy(strategyType, this.signer, this.defaultConfig);
    return await strategy.getTransactionStatus(hashOrOrderId);
  }

  /**
   * Get available strategies
   * @returns {string[]} Available strategy types
   */
  getAvailableStrategies() {
    return SwapStrategyFactory.getAvailableStrategies();
  }

  /**
   * Get strategy information
   * @param {string} strategyType - Strategy type
   * @returns {Object} Strategy info
   */
  getStrategyInfo(strategyType) {
    return SwapStrategyFactory.getStrategyInfo(strategyType);
  }

  /**
   * Execute swap with automatic fallback
   * @param {Object} params - Swap parameters
   * @param {string[]} fallbackStrategies - Fallback strategies in order
   * @returns {Promise<Object>} Swap result
   */
  async executeSwapWithFallback(params, fallbackStrategies = []) {
    const { strategyType, ...otherParams } = params;
    
    const strategies = [strategyType, ...fallbackStrategies];
    let lastError;

    for (const strategy of strategies) {
      try {
        console.log(`Attempting swap with ${strategy} strategy`);
        const result = await this.executeSwap({
          ...otherParams,
          strategyType: strategy
        });
        
        console.log(`Swap successful with ${strategy} strategy`);
        return result;
      } catch (error) {
        console.warn(`Swap failed with ${strategy} strategy:`, error.message);
        lastError = error;
        continue;
      }
    }

    throw new Error(`All swap strategies failed. Last error: ${lastError?.message}`);
  }

  /**
   * Set up callbacks for strategy events
   * @private
   */
  setupStrategyCallbacks() {
    if (!this.currentStrategy) return;

    // Use the new callback system from BaseSwapStrategy
    this.currentStrategy.setCallbacks({
      onApprovalStart: (strategyName, tokenIn) => {
        console.log(`SwapExecutor: Approval started for ${strategyName}, token: ${tokenIn}`);
        this.callbacks.onApprovalStart?.(strategyName, tokenIn);
      },
      onApprovalComplete: (strategyName, tokenIn, txHash) => {
        console.log(`SwapExecutor: Approval completed for ${strategyName}, token: ${tokenIn}, tx: ${txHash}`);
        this.callbacks.onApprovalComplete?.(strategyName, tokenIn, txHash);
      }
    });
  }

  /**
   * Get current strategy name
   * @returns {string|null} Current strategy name
   */
  getCurrentStrategyName() {
    return this.currentStrategy?.name || null;
  }

  /**
   * Reset current strategy
   */
  reset() {
    this.currentStrategy = null;
  }
} 