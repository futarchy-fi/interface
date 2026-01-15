/**
 * Base Price Strategy Interface
 * 
 * This defines the interface that all price strategies must implement.
 * Price strategies are responsible for fetching spot prices between token pairs.
 */
export class BasePriceStrategy {
  constructor(config = {}) {
    this.config = config;
    this.name = 'BasePriceStrategy';
  }

  /**
   * Get spot price between two tokens
   * @param {string} tokenA - Address of token A
   * @param {string} tokenB - Address of token B
   * @param {Object} options - Additional options (decimals, etc.)
   * @returns {Promise<Object>} Price data with rates and metadata
   */
  async getSpotPrice(tokenA, tokenB, options = {}) {
    throw new Error('getSpotPrice must be implemented by subclass');
  }

  /**
   * Get multiple spot prices in batch
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
          strategy: this.name
        };
      }
    }
    
    return results;
  }

  /**
   * Check if this strategy supports the given token pair
   * @param {string} tokenA - Address of token A
   * @param {string} tokenB - Address of token B
   * @returns {Promise<boolean>} Whether this strategy can handle the pair
   */
  async isSupported(tokenA, tokenB) {
    return true; // Default: assume all pairs are supported
  }

  /**
   * Get strategy metadata
   * @returns {Object} Strategy information
   */
  getInfo() {
    return {
      name: this.name,
      version: '1.0.0',
      description: 'Base price strategy interface',
      supportedNetworks: [],
      features: []
    };
  }

  /**
   * Initialize the strategy (if needed)
   * @returns {Promise<void>}
   */
  async initialize() {
    // Override if initialization is needed
  }

  /**
   * Cleanup resources (if needed)
   * @returns {Promise<void>}
   */
  async cleanup() {
    // Override if cleanup is needed
  }
} 