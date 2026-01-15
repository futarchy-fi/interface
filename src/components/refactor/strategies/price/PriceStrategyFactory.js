import { BalancerPriceStrategy } from './BalancerPriceStrategy';
import { BasePriceStrategy } from './BasePriceStrategy';

/**
 * Price Strategy Factory
 * 
 * Manages different price strategies and provides a unified interface
 * for fetching spot prices from various sources.
 */
export class PriceStrategyFactory {
  constructor() {
    this.strategies = new Map();
    this.defaultStrategy = null;
    this.fallbackOrder = [];
    
    // Register built-in strategies
    this.registerStrategy('balancer', BalancerPriceStrategy);
  }

  /**
   * Register a new price strategy
   * @param {string} name - Strategy name
   * @param {Class} StrategyClass - Strategy class that extends BasePriceStrategy
   * @param {Object} config - Default configuration for this strategy
   */
  registerStrategy(name, StrategyClass, config = {}) {
    if (!StrategyClass.prototype instanceof BasePriceStrategy && StrategyClass !== BasePriceStrategy) {
      throw new Error(`Strategy ${name} must extend BasePriceStrategy`);
    }

    this.strategies.set(name, {
      StrategyClass,
      config,
      instance: null
    });

    // Set first registered strategy as default
    if (!this.defaultStrategy) {
      this.defaultStrategy = name;
    }
  }

  /**
   * Get or create strategy instance
   * @param {string} name - Strategy name
   * @param {Object} config - Optional config override
   * @returns {BasePriceStrategy} Strategy instance
   */
  getStrategy(name = null, config = {}) {
    const strategyName = name || this.defaultStrategy;
    
    if (!this.strategies.has(strategyName)) {
      throw new Error(`Unknown price strategy: ${strategyName}`);
    }

    const strategy = this.strategies.get(strategyName);
    
    // Create instance if it doesn't exist
    if (!strategy.instance) {
      const mergedConfig = { ...strategy.config, ...config };
      strategy.instance = new strategy.StrategyClass(mergedConfig);
    }

    return strategy.instance;
  }

  /**
   * Set default strategy
   * @param {string} name - Strategy name to set as default
   */
  setDefaultStrategy(name) {
    if (!this.strategies.has(name)) {
      throw new Error(`Cannot set unknown strategy as default: ${name}`);
    }
    this.defaultStrategy = name;
  }

  /**
   * Set fallback order for strategies
   * @param {Array<string>} order - Array of strategy names in preference order
   */
  setFallbackOrder(order) {
    // Validate all strategies exist
    for (const name of order) {
      if (!this.strategies.has(name)) {
        throw new Error(`Unknown strategy in fallback order: ${name}`);
      }
    }
    this.fallbackOrder = order;
  }

  /**
   * Get spot price with automatic fallback
   * @param {string} tokenA - Address of token A
   * @param {string} tokenB - Address of token B
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Price data with strategy info
   */
  async getSpotPrice(tokenA, tokenB, options = {}) {
    const { preferredStrategy, ...otherOptions } = options;
    
    // Determine strategy order to try
    const tryOrder = [];
    
    if (preferredStrategy && this.strategies.has(preferredStrategy)) {
      tryOrder.push(preferredStrategy);
    }
    
    if (this.fallbackOrder.length > 0) {
      tryOrder.push(...this.fallbackOrder);
    } else if (this.defaultStrategy) {
      tryOrder.push(this.defaultStrategy);
    }
    
    // Add all other strategies as final fallback
    for (const [name] of this.strategies) {
      if (!tryOrder.includes(name)) {
        tryOrder.push(name);
      }
    }

    let lastError;
    
    for (const strategyName of tryOrder) {
      try {
        const strategy = this.getStrategy(strategyName);
        
        // Check if strategy supports this pair
        const isSupported = await strategy.isSupported(tokenA, tokenB);
        if (!isSupported) {
          console.log(`Strategy ${strategyName} doesn't support ${tokenA}/${tokenB}`);
          continue;
        }

        console.log(`Trying strategy ${strategyName} for ${tokenA}/${tokenB}`);
        const result = await strategy.getSpotPrice(tokenA, tokenB, otherOptions);
        
        return {
          ...result,
          strategyUsed: strategyName,
          fallbacksAttempted: tryOrder.indexOf(strategyName)
        };

      } catch (error) {
        console.warn(`Strategy ${strategyName} failed for ${tokenA}/${tokenB}:`, error.message);
        lastError = error;
        continue;
      }
    }

    throw new Error(`All price strategies failed. Last error: ${lastError?.message || 'Unknown error'}`);
  }

  /**
   * Get multiple spot prices with fallback
   * @param {Array} pairs - Array of {tokenA, tokenB, options} objects
   * @returns {Promise<Object>} Object with pair keys and price data
   */
  async getBatchSpotPrices(pairs) {
    const results = {};
    
    for (const pair of pairs) {
      const { tokenA, tokenB, options = {} } = pair;
      const pairKey = `${tokenA.toLowerCase()}_${tokenB.toLowerCase()}`;
      
      try {
        results[pairKey] = await this.getSpotPrice(tokenA, tokenB, options);
      } catch (error) {
        console.error(`Error fetching price for ${pairKey}:`, error);
        results[pairKey] = {
          error: error.message,
          tokenA,
          tokenB,
          allStrategiesFailed: true
        };
      }
    }
    
    return results;
  }

  /**
   * Get list of available strategies
   * @returns {Array<Object>} Array of strategy info
   */
  getAvailableStrategies() {
    const strategies = [];
    
    for (const [name, strategy] of this.strategies) {
      const instance = strategy.instance || new strategy.StrategyClass(strategy.config);
      strategies.push({
        name,
        ...instance.getInfo(),
        isDefault: name === this.defaultStrategy
      });
    }
    
    return strategies;
  }

  /**
   * Initialize all strategies
   * @returns {Promise<void>}
   */
  async initializeAll() {
    for (const [name] of this.strategies) {
      try {
        const strategy = this.getStrategy(name);
        await strategy.initialize();
        console.log(`Initialized strategy: ${name}`);
      } catch (error) {
        console.error(`Failed to initialize strategy ${name}:`, error);
      }
    }
  }

  /**
   * Cleanup all strategies
   * @returns {Promise<void>}
   */
  async cleanupAll() {
    for (const [, strategy] of this.strategies) {
      if (strategy.instance) {
        try {
          await strategy.instance.cleanup();
        } catch (error) {
          console.error('Error cleaning up strategy:', error);
        }
      }
    }
  }
}

// Create and export singleton instance
export const priceStrategyFactory = new PriceStrategyFactory();

// Set up default configuration
priceStrategyFactory.setDefaultStrategy('balancer');
priceStrategyFactory.setFallbackOrder(['balancer']); 