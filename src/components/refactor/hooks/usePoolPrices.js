import { useState, useCallback, useEffect } from 'react';
import { useConfig } from 'wagmi';
import { usePoolClassification } from './usePoolClassification';
import { fetchPoolPrice, getPoolPrice } from '../utils/poolPriceUtils';
import { useProposalContext } from '../context/ProposalContext';

/**
 * Hook for fetching and managing pool prices with automatic classification
 * NOW PROPOSAL-AWARE: Automatically loads prices for pools related to the current proposal
 * 
 * Usage:
 * const { ... } = usePoolPrices(proposalAddress); // For specific proposal
 * const { ... } = usePoolPrices(); // Uses global context
 */
export function usePoolPrices(proposalAddress = null) {
  const config = useConfig();
  const proposalContext = useProposalContext();
  
  // Use provided address or fall back to context
  const activeProposalAddress = proposalAddress || proposalContext.proposalAddress;
  
  const {
    classifications,
    loading: classificationLoading,
    error: classificationError,
    analyzeKnownPools,
    analyzeProposalPools,
    getPredictionPools,
    getConditionalPools,
    getPoolClassification,
    ALL_KNOWN_POOLS
  } = usePoolClassification();

  const [prices, setPrices] = useState({});
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [priceErrors, setPriceErrors] = useState({});
  const [lastUpdated, setLastUpdated] = useState(null);

  // Fetch price for a single pool
  const fetchSinglePoolPrice = useCallback(async (poolAddress) => {
    if (!poolAddress || !config) return null;

    try {
      const priceData = await fetchPoolPrice(poolAddress, config);
      
      // Update prices state
      setPrices(prev => ({
        ...prev,
        [poolAddress.toLowerCase()]: {
          ...priceData,
          timestamp: Date.now()
        }
      }));

      // Clear any previous error for this pool
      setPriceErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[poolAddress.toLowerCase()];
        return newErrors;
      });

      return priceData;
    } catch (error) {
      console.error(`Error fetching price for pool ${poolAddress}:`, error);
      
      // Store the error
      setPriceErrors(prev => ({
        ...prev,
        [poolAddress.toLowerCase()]: error.message
      }));
      
      return null;
    }
  }, [config]);

  // Fetch prices for multiple pools
  const fetchMultiplePrices = useCallback(async (poolAddresses) => {
    if (!poolAddresses?.length || !config) return {};

    setLoadingPrices(true);
    
    try {
      const results = await Promise.allSettled(
        poolAddresses.map(address => fetchSinglePoolPrice(address))
      );

      const successful = {};
      const errors = {};

      results.forEach((result, index) => {
        const poolAddress = poolAddresses[index].toLowerCase();
        
        if (result.status === 'fulfilled' && result.value) {
          successful[poolAddress] = result.value;
        } else if (result.status === 'rejected') {
          errors[poolAddress] = result.reason?.message || 'Unknown error';
        }
      });

      console.log('Pool price fetch results:', { successful, errors });
      setLastUpdated(Date.now());
      
      return successful;
    } catch (error) {
      console.error('Error fetching multiple pool prices:', error);
      return {};
    } finally {
      setLoadingPrices(false);
    }
  }, [config, fetchSinglePoolPrice]);

  // Fetch prices for all known pools
  const fetchAllKnownPoolPrices = useCallback(async () => {
    const poolAddresses = Object.values(ALL_KNOWN_POOLS).map(pool => pool.address);
    return await fetchMultiplePrices(poolAddresses);
  }, [fetchMultiplePrices, ALL_KNOWN_POOLS]);

  // Refresh prices for all loaded pools
  const refreshPrices = useCallback(async () => {
    const loadedPoolAddresses = Object.keys(prices);
    if (loadedPoolAddresses.length > 0) {
      await fetchMultiplePrices(loadedPoolAddresses);
    } else {
      // If no pools loaded yet, fetch all known pools
      await fetchAllKnownPoolPrices();
    }
  }, [prices, fetchMultiplePrices, fetchAllKnownPoolPrices]);

  // Get price data for a specific pool
  const getPoolPrice = useCallback((poolAddress) => {
    if (!poolAddress) return null;
    return prices[poolAddress.toLowerCase()] || null;
  }, [prices]);

  // Get all prediction pool prices with classification
  const getPredictionPoolPrices = useCallback(() => {
    const predictionPools = getPredictionPools();
    return predictionPools.map(pool => ({
      ...pool,
      priceData: getPoolPrice(pool.poolAddress),
      error: priceErrors[pool.poolAddress.toLowerCase()]
    }));
  }, [getPredictionPools, getPoolPrice, priceErrors]);

  // Get all conditional pool prices with classification
  const getConditionalPoolPrices = useCallback(() => {
    const conditionalPools = getConditionalPools();
    return conditionalPools.map(pool => ({
      ...pool,
      priceData: getPoolPrice(pool.poolAddress),
      error: priceErrors[pool.poolAddress.toLowerCase()]
    }));
  }, [getConditionalPools, getPoolPrice, priceErrors]);

  // Get all unknown pool prices with classification
  const getUnknownPoolPrices = useCallback(() => {
    const unknownPools = Object.values(classifications).filter(
      pool => pool.classification.type === 'UNKNOWN'
    );
    return unknownPools.map(pool => ({
      ...pool,
      priceData: getPoolPrice(pool.poolAddress),
      error: priceErrors[pool.poolAddress.toLowerCase()]
    }));
  }, [classifications, getPoolPrice, priceErrors]);

  // Get all pools regardless of type
  const getAllPoolPrices = useCallback(() => {
    const allPools = Object.values(classifications);
    return allPools.map(pool => ({
      ...pool,
      priceData: getPoolPrice(pool.poolAddress),
      error: priceErrors[pool.poolAddress.toLowerCase()]
    }));
  }, [classifications, getPoolPrice, priceErrors]);

  // 🔄 Auto-load classifications and prices when proposal changes
  useEffect(() => {
    const loadProposalData = async () => {
      try {
        if (activeProposalAddress) {
          console.log('Loading pool data for proposal:', activeProposalAddress);
          // 🎯 Load proposal-specific pools
          await analyzeProposalPools(activeProposalAddress);
          
          // Load prices for proposal pools
          const proposalPoolAddresses = Object.values(classifications)
            .filter(pool => pool.classification.proposalAddress === activeProposalAddress)
            .map(pool => pool.poolAddress);
            
          if (proposalPoolAddresses.length > 0) {
            console.log('Loading prices for proposal pools:', proposalPoolAddresses);
            await fetchMultiplePrices(proposalPoolAddresses);
          }
        } else {
          console.log('Loading initial pool classifications...');
          await analyzeKnownPools();
          
          console.log('Loading initial pool prices...');
          await fetchAllKnownPoolPrices();
        }
      } catch (error) {
        console.error('Error loading pool data:', error);
      }
    };

    loadProposalData();
  }, [activeProposalAddress, analyzeKnownPools, analyzeProposalPools, fetchAllKnownPoolPrices, fetchMultiplePrices, classifications]);

  // Calculate formatted prices for easier display
  const getFormattedPoolData = useCallback(() => {
    const predictionPools = getPredictionPoolPrices();
    const conditionalPools = getConditionalPoolPrices();
    const unknownPools = getUnknownPoolPrices();

    return {
      prediction: predictionPools.map(pool => {
        const { priceData, classification, token0, token1 } = pool;
        
        return {
          address: pool.poolAddress,
          type: 'PREDICTION',
          description: classification.description,
          baseAsset: classification.baseAsset,
          positionSide: classification.positionSide,
          classification,
          token0,
          token1,
          prices: priceData?.prices || null,
          method: priceData?.method || null,
          error: pool.error || null,
          lastUpdated: priceData?.timestamp || null
        };
      }),
      conditional: conditionalPools.map(pool => {
        const { priceData, classification, token0, token1 } = pool;
        
        return {
          address: pool.poolAddress,
          type: 'CONDITIONAL', 
          description: classification.description,
          classification,
          token0,
          token1,
          prices: priceData?.prices || null,
          method: priceData?.method || null,
          error: pool.error || null,
          lastUpdated: priceData?.timestamp || null
        };
      }),
      unknown: unknownPools.map(pool => {
        const { priceData, classification, token0, token1 } = pool;
        
        return {
          address: pool.poolAddress,
          type: 'UNKNOWN',
          description: classification.description,
          classification,
          token0,
          token1,
          prices: priceData?.prices || null,
          method: priceData?.method || null,
          error: pool.error || null,
          lastUpdated: priceData?.timestamp || null
        };
      }),
      all: getAllPoolPrices().map(pool => {
        const { priceData, classification, token0, token1 } = pool;
        
        return {
          address: pool.poolAddress,
          type: classification.type,
          description: classification.description,
          classification,
          token0,
          token1,
          prices: priceData?.prices || null,
          method: priceData?.method || null,
          error: pool.error || null,
          lastUpdated: priceData?.timestamp || null
        };
      })
    };
  }, [getPredictionPoolPrices, getConditionalPoolPrices, getUnknownPoolPrices, getAllPoolPrices]);

  return {
    // State
    classifications,
    prices,
    priceErrors,
    lastUpdated,
    loading: classificationLoading || loadingPrices,
    error: classificationError,

    // Actions
    fetchSinglePoolPrice,
    fetchMultiplePrices,
    fetchAllKnownPoolPrices,
    refreshPrices,
    
    // Getters
    getPoolPrice,
    getPredictionPoolPrices,
    getConditionalPoolPrices,
    getUnknownPoolPrices,
    getAllPoolPrices,
    getFormattedPoolData,
    getPoolClassification,

    // Pool type getters
    predictionPools: getPredictionPools(),
    conditionalPools: getConditionalPools(),

    // Status
    hasData: Object.keys(classifications).length > 0,
    hasPrices: Object.keys(prices).length > 0
  };
} 