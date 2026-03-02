import { useState, useCallback, useEffect } from 'react';
import { priceStrategyFactory } from '../strategies/price/PriceStrategyFactory';
import { 
  BASE_CURRENCY_TOKEN_ADDRESS, 
  BASE_COMPANY_TOKEN_ADDRESS 
} from '../constants/addresses';

/**
 * Hook for fetching spot prices using various strategies
 * Provides access to native token prices (sDAI/GNO) and other pairs
 */
export function useSpotPrices() {
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [strategies, setStrategies] = useState([]);
  const [initialized, setInitialized] = useState(false);

  // Initialize price strategies
  useEffect(() => {
    const initStrategies = async () => {
      try {
        await priceStrategyFactory.initializeAll();
        setStrategies(priceStrategyFactory.getAvailableStrategies());
        setInitialized(true);
      } catch (error) {
        console.error('Error initializing price strategies:', error);
      }
    };

    initStrategies();

    // Cleanup on unmount
    return () => {
      priceStrategyFactory.cleanupAll();
    };
  }, []);

  /**
   * Fetch spot price for a token pair
   * @param {string} tokenA - Address of token A
   * @param {string} tokenB - Address of token B
   * @param {Object} options - Options including preferred strategy
   * @returns {Promise<Object>} Price data
   */
  const fetchSpotPrice = useCallback(async (tokenA, tokenB, options = {}) => {
    if (!initialized) {
      throw new Error('Price strategies not initialized yet');
    }

    const pairKey = `${tokenA.toLowerCase()}_${tokenB.toLowerCase()}`;
    
    try {
      setLoading(true);
      
      const priceData = await priceStrategyFactory.getSpotPrice(tokenA, tokenB, options);
      
      // Update state
      setPrices(prev => ({
        ...prev,
        [pairKey]: {
          ...priceData,
          lastUpdated: Date.now()
        }
      }));
      
      // Clear any previous error
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[pairKey];
        return newErrors;
      });
      
      return priceData;
      
    } catch (error) {
      console.error(`Error fetching spot price for ${pairKey}:`, error);
      
      setErrors(prev => ({
        ...prev,
        [pairKey]: error.message
      }));
      
      throw error;
    } finally {
      setLoading(false);
    }
  }, [initialized]);

  /**
   * Fetch multiple spot prices in batch
   * @param {Array} pairs - Array of {tokenA, tokenB, options} objects
   * @returns {Promise<Object>} Object with results
   */
  const fetchBatchSpotPrices = useCallback(async (pairs) => {
    if (!initialized) {
      throw new Error('Price strategies not initialized yet');
    }

    try {
      setLoading(true);
      
      const results = await priceStrategyFactory.getBatchSpotPrices(pairs);
      
      // Update state with all results
      const newPrices = {};
      const newErrors = {};
      
      Object.entries(results).forEach(([pairKey, result]) => {
        if (result.error) {
          newErrors[pairKey] = result.error;
        } else {
          newPrices[pairKey] = {
            ...result,
            lastUpdated: Date.now()
          };
        }
      });
      
      setPrices(prev => ({ ...prev, ...newPrices }));
      setErrors(prev => ({ ...prev, ...newErrors }));
      
      return results;
      
    } catch (error) {
      console.error('Error fetching batch spot prices:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [initialized]);

  /**
   * Get native token prices (sDAI/GNO)
   * @param {Object} options - Options for fetching
   * @returns {Promise<Object>} Native token price data
   */
  const fetchNativeTokenPrices = useCallback(async (options = {}) => {
    const pairs = [
      {
        tokenA: BASE_CURRENCY_TOKEN_ADDRESS,  // sDAI
        tokenB: BASE_COMPANY_TOKEN_ADDRESS,   // GNO
        options
      }
    ];
    
    const results = await fetchBatchSpotPrices(pairs);
    const pairKey = `${BASE_CURRENCY_TOKEN_ADDRESS.toLowerCase()}_${BASE_COMPANY_TOKEN_ADDRESS.toLowerCase()}`;
    
    return results[pairKey];
  }, [fetchBatchSpotPrices]);

  /**
   * Get cached price for a token pair
   * @param {string} tokenA - Address of token A
   * @param {string} tokenB - Address of token B
   * @returns {Object|null} Cached price data or null
   */
  const getCachedPrice = useCallback((tokenA, tokenB) => {
    const pairKey = `${tokenA.toLowerCase()}_${tokenB.toLowerCase()}`;
    return prices[pairKey] || null;
  }, [prices]);

  /**
   * Get error for a token pair
   * @param {string} tokenA - Address of token A
   * @param {string} tokenB - Address of token B
   * @returns {string|null} Error message or null
   */
  const getError = useCallback((tokenA, tokenB) => {
    const pairKey = `${tokenA.toLowerCase()}_${tokenB.toLowerCase()}`;
    return errors[pairKey] || null;
  }, [errors]);

  /**
   * Clear cached data for a specific pair or all pairs
   * @param {string} tokenA - Optional token A address
   * @param {string} tokenB - Optional token B address
   */
  const clearCache = useCallback((tokenA = null, tokenB = null) => {
    if (tokenA && tokenB) {
      const pairKey = `${tokenA.toLowerCase()}_${tokenB.toLowerCase()}`;
      setPrices(prev => {
        const newPrices = { ...prev };
        delete newPrices[pairKey];
        return newPrices;
      });
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[pairKey];
        return newErrors;
      });
    } else {
      setPrices({});
      setErrors({});
    }
  }, []);

  /**
   * Get native token price reference
   * Useful for converting prediction token prices to base currency
   * @returns {Object|null} sDAI/GNO price data
   */
  const getNativeTokenPrice = useCallback(() => {
    return getCachedPrice(BASE_CURRENCY_TOKEN_ADDRESS, BASE_COMPANY_TOKEN_ADDRESS);
  }, [getCachedPrice]);

  /**
   * Convert price using native token reference
   * @param {number} price - Price to convert
   * @param {string} fromToken - Source token address
   * @param {string} toToken - Target token address
   * @returns {number|null} Converted price or null if reference not available
   */
  const convertPrice = useCallback((price, fromToken, toToken) => {
    const nativePrice = getNativeTokenPrice();
    if (!nativePrice) return null;

    // This is a simplified conversion - you might want more sophisticated logic
    // depending on your specific use case
    
    if (fromToken.toLowerCase() === BASE_CURRENCY_TOKEN_ADDRESS.toLowerCase() &&
        toToken.toLowerCase() === BASE_COMPANY_TOKEN_ADDRESS.toLowerCase()) {
      return price * nativePrice.priceAtoB;
    }
    
    if (fromToken.toLowerCase() === BASE_COMPANY_TOKEN_ADDRESS.toLowerCase() &&
        toToken.toLowerCase() === BASE_CURRENCY_TOKEN_ADDRESS.toLowerCase()) {
      return price * nativePrice.priceBtoA;
    }
    
    return null;
  }, [getNativeTokenPrice]);

  return {
    // State
    prices,
    loading,
    errors,
    strategies,
    initialized,
    
    // Actions
    fetchSpotPrice,
    fetchBatchSpotPrices,
    fetchNativeTokenPrices,
    
    // Getters
    getCachedPrice,
    getError,
    getNativeTokenPrice,
    
    // Utilities
    clearCache,
    convertPrice,
    
    // Status
    hasNativePrice: !!getNativeTokenPrice(),
    totalPairs: Object.keys(prices).length,
    totalErrors: Object.keys(errors).length
  };
} 