import { BalancerPriceStrategy } from '../strategies/price/BalancerPriceStrategy';

/**
 * Utility for fetching base token prices from Balancer pools
 * Uses the existing BalancerPriceStrategy for pool discovery and price calculation
 */

let balancerStrategy = null;

/**
 * Get Balancer strategy instance (singleton)
 */
const getBalancerStrategy = () => {
  if (!balancerStrategy) {
    balancerStrategy = new BalancerPriceStrategy();
  }
  return balancerStrategy;
};

/**
 * Get spot price for base tokens from Balancer pools
 * @param {string} tokenA - First token address
 * @param {string} tokenB - Second token address
 * @returns {Promise<Object|null>} Price data or null if not available
 */
export const getBalancerSpotPrice = async (tokenA, tokenB) => {
  try {
    const strategy = getBalancerStrategy();
    
    // Check if Balancer supports this pair
    const isSupported = await strategy.isSupported(tokenA, tokenB);
    if (!isSupported) {
      console.log(`Balancer does not support ${tokenA}/${tokenB} pair`);
      return null;
    }
    
    // Get spot price
    const priceData = await strategy.getSpotPrice(tokenA, tokenB);
    
    return {
      price: priceData.priceAtoB,
      reversePrice: priceData.priceBtoA,
      pool: priceData.pool,
      timestamp: priceData.timestamp,
      source: 'balancer'
    };
    
  } catch (error) {
    console.error(`Error getting Balancer price for ${tokenA}/${tokenB}:`, error);
    return null;
  }
};

/**
 * Get base token pool info for display
 * @param {Object} proposalTokens - Proposal tokens hook
 * @returns {Promise<Object>} Base token pool information
 */
export const getBaseTokenPoolInfo = async (proposalTokens) => {
  if (!proposalTokens.isReady) {
    return {
      exists: false,
      loading: true,
      error: 'Tokens not ready'
    };
  }
  
  try {
    // Get base token addresses
    const currencyToken = proposalTokens.getTokenInfoByType('baseCurrency');
    const companyToken = proposalTokens.getTokenInfoByType('baseCompany');
    
    if (!currencyToken || !companyToken) {
      return {
        exists: false,
        error: 'Base tokens not found'
      };
    }
    
    // Try to get price from Balancer
    const priceData = await getBalancerSpotPrice(companyToken.address, currencyToken.address);
    
    if (!priceData) {
      return {
        exists: false,
        error: 'No Balancer pool found',
        tokenA: companyToken,
        tokenB: currencyToken
      };
    }
    
    return {
      exists: true,
      address: priceData.pool.address,
      stats: {
        price: priceData.price,
        reversePrice: priceData.reversePrice,
        totalLiquidity: priceData.pool.totalLiquidity,
        swapFee: priceData.pool.swapFee
      },
      details: {
        type: {
          type: 'BALANCER_POOL',
          description: `Balancer ${priceData.pool.type} Pool`
        },
        tokenA: companyToken,
        tokenB: currencyToken,
        poolType: priceData.pool.type,
        poolId: priceData.pool.id
      },
      source: 'balancer',
      timestamp: priceData.timestamp
    };
    
  } catch (error) {
    console.error('Error getting base token pool info:', error);
    return {
      exists: false,
      error: error.message
    };
  }
};

/**
 * Find all Balancer pools containing specific tokens
 * @param {Array} tokenAddresses - Array of token addresses to search for
 * @returns {Promise<Array>} Array of pools containing the tokens
 */
export const findBalancerPoolsWithTokens = async (tokenAddresses) => {
  try {
    const strategy = getBalancerStrategy();
    return await strategy.findPoolsWithTokens(tokenAddresses);
  } catch (error) {
    console.error('Error finding Balancer pools:', error);
    return [];
  }
};

/**
 * Get all available Balancer pools for debugging
 * @returns {Promise<Array>} Array of all Balancer pools
 */
export const getAllBalancerPools = async () => {
  try {
    const strategy = getBalancerStrategy();
    return await strategy.getAllPools();
  } catch (error) {
    console.error('Error getting all Balancer pools:', error);
    return [];
  }
}; 