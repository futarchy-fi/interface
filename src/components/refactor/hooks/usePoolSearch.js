import { useState } from 'react';
import { findPoolByPair } from '../utils/poolUtils';

/**
 * Hook for searching pools by token pairs
 * Reuses existing pool utilities from the refactor architecture
 */
export const usePoolSearch = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const findPoolByTokens = async (token0, token1) => {
    if (!token0 || !token1) {
      throw new Error('Both token addresses are required');
    }

    setLoading(true);
    setError(null);
    
    try {
      // Use existing pool utilities
      const poolAddress = await findPoolByPair(null, token0, token1); // provider will be created in util
      
      if (poolAddress && poolAddress !== '0x0000000000000000000000000000000000000000') {
        return {
          address: poolAddress,
          token0,
          token1,
          exists: true
        };
      } else {
        return {
          address: null,
          token0,
          token1,
          exists: false
        };
      }
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const searchMultiplePools = async (tokenPairs) => {
    setLoading(true);
    setError(null);
    
    try {
      const results = await Promise.allSettled(
        tokenPairs.map(([token0, token1]) => findPoolByTokens(token0, token1))
      );
      
      return results.map((result, index) => ({
        pair: tokenPairs[index],
        result: result.status === 'fulfilled' ? result.value : null,
        error: result.status === 'rejected' ? result.reason : null
      }));
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    findPoolByTokens,
    searchMultiplePools,
    loading,
    error
  };
}; 