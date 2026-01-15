import { AlgebraSwapStrategy } from './AlgebraSwapStrategy';
import { CowSwapStrategy } from './CowSwapStrategy';
import { SWAPR_V3_ROUTER_ADDRESS, COW_VAULT_RELAYER_ADDRESS } from '../constants/addresses';

// Strategy constants
export const SWAP_STRATEGIES = {
  ALGEBRA: 'algebra',
  COWSWAP: 'cowswap',
  SUSHI_V3: 'sushi_v3' // Future implementation
};

/**
 * Factory Pattern Implementation
 * Creates different swap strategy instances based on type
 */
export class SwapStrategyFactory {
  static STRATEGIES = SWAP_STRATEGIES;

  /**
   * Create a strategy instance
   * @param {string} strategyType - Type of strategy to create
   * @param {Object} signer - Ethers signer instance
   * @param {Object} config - Strategy configuration
   * @returns {BaseSwapStrategy} Strategy instance
   */
  static createStrategy(strategyType, signer, config = {}) {
    const normalizedType = strategyType.toLowerCase();
    
    switch (normalizedType) {
      case SWAP_STRATEGIES.ALGEBRA:
        return new AlgebraSwapStrategy(signer, config);
      
      case SWAP_STRATEGIES.COWSWAP:
        return new CowSwapStrategy(signer, config);
      
      default:
        throw new Error(`Unknown strategy type: ${strategyType}`);
    }
  }

  /**
   * Get available strategy types
   * @returns {string[]} Array of available strategy types
   */
  static getAvailableStrategies() {
    return Object.values(SWAP_STRATEGIES).filter(strategy => strategy !== SWAP_STRATEGIES.SUSHI_V3);
  }

  /**
   * Validate if a strategy type is supported
   * @param {string} strategyType - Strategy type to validate
   * @returns {boolean} Whether the strategy is supported
   */
  static isValidStrategy(strategyType) {
    return Object.values(SWAP_STRATEGIES).includes(strategyType.toLowerCase());
  }

  /**
   * Get information about a strategy
   * @param {string} strategyType - Strategy type
   * @returns {Object|null} Strategy information
   */
  static getStrategyInfo(strategyType) {
    const strategies = {
      [SWAP_STRATEGIES.ALGEBRA]: {
        name: 'Algebra (Swapr)',
        description: 'Direct V3 pool swaps with immediate settlement',
        gasRequired: true,
        slippageProtection: true,
        features: ['immediate_settlement', 'slippage_protection', 'gas_required'],
        approvalAddress: SWAPR_V3_ROUTER_ADDRESS,
        approvalAddressName: 'Swapr V3 Router',
        settlement: 'immediate',
        mevProtection: false
      },
      [SWAP_STRATEGIES.COWSWAP]: {
        name: 'CoW Swap',
        description: 'Gasless batch auctions with MEV protection',
        gasRequired: false,
        slippageProtection: false,
        features: ['gasless', 'mev_protection', 'batch_auction', 'requires_polling'],
        approvalAddress: COW_VAULT_RELAYER_ADDRESS,
        approvalAddressName: 'CoW Vault Relayer',
        settlement: 'batch_auction',
        mevProtection: true
      }
    };

    return strategies[strategyType] || null;
  }

  /**
   * Create strategy with fallback
   * @param {string} primaryStrategy - Primary strategy to try
   * @param {string[]} fallbackStrategies - Fallback strategies
   * @param {Object} signer - Ethers signer
   * @param {Object} config - Configuration
   * @returns {BaseSwapStrategy} Strategy instance
   */
  static createWithFallback(primaryStrategy, fallbackStrategies, signer, config) {
    try {
      return this.createStrategy(primaryStrategy, signer, config);
    } catch (error) {
      console.warn(`Primary strategy ${primaryStrategy} failed:`, error.message);
      
      for (const fallback of fallbackStrategies) {
        try {
          console.log(`Trying fallback strategy: ${fallback}`);
          return this.createStrategy(fallback, signer, config);
        } catch (fallbackError) {
          console.warn(`Fallback strategy ${fallback} failed:`, fallbackError.message);
        }
      }
      
      throw new Error(`All strategies failed. Primary: ${primaryStrategy}, Fallbacks: ${fallbackStrategies.join(', ')}`);
    }
  }
} 