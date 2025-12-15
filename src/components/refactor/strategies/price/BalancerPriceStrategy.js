import { BalancerSDK } from '@balancer-labs/sdk';
import { BasePriceStrategy } from './BasePriceStrategy';
import { GNOSIS_CHAIN_ID } from '../../constants/addresses';

/**
 * Balancer Price Strategy
 * 
 * Uses Balancer pools to fetch spot prices between token pairs.
 * Supports weighted pools, stable pools, and other Balancer pool types.
 */
export class BalancerPriceStrategy extends BasePriceStrategy {
  constructor(config = {}) {
    super(config);
    this.name = 'BalancerPriceStrategy';
    this.balancer = null;
    this.defaultConfig = {
      network: GNOSIS_CHAIN_ID,
      rpcUrl: 'https://rpc.gnosischain.com',
      subgraphUrl: config.subgraphUrl, // Optional custom subgraph
      ...config
    };
  }

  /**
   * Initialize the Balancer SDK
   */
  async initialize() {
    if (!this.balancer) {
      try {
        console.log('Initializing Balancer SDK...');
        this.balancer = new BalancerSDK({
          network: this.defaultConfig.network,
          rpcUrl: this.defaultConfig.rpcUrl,
          ...(this.defaultConfig.subgraphUrl && { subgraphUrl: this.defaultConfig.subgraphUrl })
        });
        console.log('Balancer SDK initialized successfully');
      } catch (error) {
        console.error('Error initializing Balancer SDK:', error);
        throw error;
      }
    }
  }

  /**
   * Get spot price between two tokens using Balancer pools
   * @param {string} tokenA - Address of token A 
   * @param {string} tokenB - Address of token B
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Price data
   */
  async getSpotPrice(tokenA, tokenB, options = {}) {
    await this.initialize();

    try {
      // Find pools that contain both tokens
      const pools = await this.balancer.pools.all();
      const relevantPools = pools.filter(pool => 
        pool.tokens.some(token => token.address.toLowerCase() === tokenA.toLowerCase()) &&
        pool.tokens.some(token => token.address.toLowerCase() === tokenB.toLowerCase())
      );

      if (relevantPools.length === 0) {
        throw new Error(`No Balancer pools found containing both ${tokenA} and ${tokenB}`);
      }

      // Use the pool with highest liquidity
      const bestPool = relevantPools.reduce((best, current) => {
        const bestLiquidity = parseFloat(best.totalLiquidity || '0');
        const currentLiquidity = parseFloat(current.totalLiquidity || '0');
        return currentLiquidity > bestLiquidity ? current : best;
      });

      console.log(`Using Balancer pool ${bestPool.id} for ${tokenA}/${tokenB} price`);

      // Calculate spot price
      const spotPrice = await bestPool.calcSpotPrice(tokenA, tokenB);
      const reverseSpotPrice = await bestPool.calcSpotPrice(tokenB, tokenA);

      return {
        tokenA,
        tokenB,
        priceAtoB: spotPrice,
        priceBtoA: reverseSpotPrice,
        pool: {
          id: bestPool.id,
          address: bestPool.address,
          type: bestPool.poolType,
          totalLiquidity: bestPool.totalLiquidity,
          swapFee: bestPool.swapFee
        },
        strategy: this.name,
        timestamp: Date.now(),
        network: this.defaultConfig.network
      };

    } catch (error) {
      console.error(`Balancer price fetch error for ${tokenA}/${tokenB}:`, error);
      throw new Error(`Balancer strategy failed: ${error.message}`);
    }
  }

  /**
   * Check if Balancer supports this token pair
   * @param {string} tokenA - Address of token A
   * @param {string} tokenB - Address of token B  
   * @returns {Promise<boolean>} Whether pair is supported
   */
  async isSupported(tokenA, tokenB) {
    try {
      await this.initialize();
      const pools = await this.balancer.pools.all();
      
      const hasPool = pools.some(pool => 
        pool.tokens.some(token => token.address.toLowerCase() === tokenA.toLowerCase()) &&
        pool.tokens.some(token => token.address.toLowerCase() === tokenB.toLowerCase())
      );

      return hasPool;
    } catch (error) {
      console.error('Error checking Balancer support:', error);
      return false;
    }
  }

  /**
   * Get strategy metadata
   * @returns {Object} Strategy information
   */
  getInfo() {
    return {
      name: this.name,
      version: '1.0.0',
      description: 'Fetches spot prices from Balancer pools',
      supportedNetworks: [100], // Gnosis Chain
      features: [
        'Weighted pools',
        'Stable pools', 
        'Managed pools',
        'Linear pools',
        'High liquidity pools prioritization'
      ],
      config: this.defaultConfig
    };
  }

  /**
   * Get all available pools for debugging
   * @returns {Promise<Array>} Array of pool data
   */
  async getAllPools() {
    await this.initialize();
    return await this.balancer.pools.all();
  }

  /**
   * Find pools containing specific tokens
   * @param {Array} tokenAddresses - Array of token addresses
   * @returns {Promise<Array>} Array of matching pools
   */
  async findPoolsWithTokens(tokenAddresses) {
    await this.initialize();
    const pools = await this.balancer.pools.all();
    
    return pools.filter(pool => 
      tokenAddresses.every(tokenAddr =>
        pool.tokens.some(token => 
          token.address.toLowerCase() === tokenAddr.toLowerCase()
        )
      )
    );
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    // Balancer SDK doesn't need explicit cleanup
    this.balancer = null;
  }
} 