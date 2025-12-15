import { useState } from 'react';
import { useConfig } from 'wagmi';
import { fetchPoolPrice } from '../utils/poolPriceUtils';

export function usePoolPrice() {
  const [poolData, setPoolData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const config = useConfig();

  const getPoolPrice = async (poolAddress) => {
    if (!poolAddress || !poolAddress.trim()) {
      setError('Please enter a valid pool address');
      return;
    }

    setLoading(true);
    setError(null);
    setPoolData(null);

    try {
      // Basic address validation (should start with 0x and be 42 characters)
      if (!poolAddress.startsWith('0x') || poolAddress.length !== 42) {
        throw new Error('Invalid Ethereum address format');
      }

      const data = await fetchPoolPrice(poolAddress, config);
      setPoolData(data);
    } catch (err) {
      console.error('Error fetching pool price:', err);
      setError(err.message || 'Failed to fetch pool data');
    } finally {
      setLoading(false);
    }
  };

  const clearData = () => {
    setPoolData(null);
    setError(null);
  };

  return {
    poolData,
    loading,
    error,
    getPoolPrice,
    clearData,
  };
} 