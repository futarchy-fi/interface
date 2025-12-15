/**
 * Futarchy JavaScript Library
 * 
 * A decoupled JavaScript library for interacting with Futarchy markets.
 * This library provides the same functionality as the React hooks but without React dependencies.
 */

// Core modules
export { createFutarchy } from './futarchy.js';
export { createBalanceManager } from './balanceManager.js';
export { createSmartSwap } from './smartSwap.js';

// Configuration and utilities
export * from './futarchyConfig.js';
export * from './futarchyUtils.js';

/**
 * Creates a complete Futarchy system with all components
 * @param {Object} config - Configuration options
 * @returns {Object} Complete Futarchy system
 */
export const createFutarchySystem = (config = {}) => {
  const futarchy = createFutarchy(config);
  const smartSwap = createSmartSwap(futarchy);
  
  return {
    futarchy,
    smartSwap,
    
    // Convenience methods
    getPosition: futarchy.getPosition,
    getBalances: futarchy.getBalances,
    updateBalances: futarchy.updateBalances,
    addCollateral: futarchy.addCollateral,
    removeCollateral: futarchy.removeCollateral,
    marketSwaps: futarchy.marketSwaps,
    advancedSmartSwap: futarchy.advancedSmartSwap,
    hasArbitrageOpportunity: futarchy.hasArbitrageOpportunity,
    fetchPoolPrices: futarchy.fetchPoolPrices,
    getPoolPrices: futarchy.getPoolPrices,
    
    // Cleanup method
    cleanup: () => {
      futarchy.cleanup();
      smartSwap.cleanup();
    }
  };
}; 