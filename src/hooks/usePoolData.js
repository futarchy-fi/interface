import { useState, useEffect } from 'react';

// API base URL - avoid mixed content (upgrade http->https when page is https)
const RAW_API_BASE_URL = process.env.NEXT_PUBLIC_POOL_API_URL || 'https://stag.api.tickspread.com';
const normalizeBaseUrl = (url) => {
  try {
    if (typeof window !== 'undefined' && window.location?.protocol === 'https:' && url.startsWith('http://')) {
      return url.replace('http://', 'https://');
    }
  } catch (_) {
    // no-op
  }
  return url;
};
const API_BASE_URL = normalizeBaseUrl(RAW_API_BASE_URL);

console.log('Pool API URL configured as:', API_BASE_URL);

/**
 * Hook to fetch pool volume and liquidity data
 * @param {string} poolId - The pool address to fetch data for
 * @returns {Object} - Contains loading state, error state, volume and liquidity data
 */
export const usePoolData = (poolId) => {
  const [data, setData] = useState({
    volume: null,
    liquidity: null
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!poolId) {
      setLoading(false);
      return;
    }

    const fetchPoolData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch volume and liquidity in parallel
        const [volumeResponse, liquidityResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/api/v1/pools/volume?pool_id=${poolId}`),
          fetch(`${API_BASE_URL}/api/v1/pools/liquidity?pool_id=${poolId}`)
        ]);

        if (!volumeResponse.ok || !liquidityResponse.ok) {
          throw new Error('Failed to fetch pool data');
        }

        const volumeData = await volumeResponse.json();
        const liquidityData = await liquidityResponse.json();

        // Normalize liquidity to support both old and new formats
        const normalizedLiquidity = liquidityData
          ? (typeof liquidityData.amount !== 'undefined'
              ? { amount: liquidityData.amount, token: liquidityData.token }
              : {
                  token0: liquidityData.token0,
                  amount0: liquidityData.amount0,
                  token1: liquidityData.token1,
                  amount1: liquidityData.amount1
                })
          : null;

        setData({
          volume: volumeData.volume,
          liquidity: normalizedLiquidity
        });
      } catch (err) {
        console.error('Error fetching pool data:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchPoolData();
  }, [poolId]);

  return { data, loading, error };
};

/**
 * Hook to fetch data for both YES and NO pools
 * @param {Object} config - The contract configuration containing pool addresses
 * @returns {Object} - Contains loading state, error state, and data for both pools
 */
export const useYesNoPoolData = (config) => {
  const [data, setData] = useState({
    yesPool: { volume: null, liquidity: null },
    noPool: { volume: null, liquidity: null }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!config || !config.POOL_CONFIG_YES || !config.POOL_CONFIG_NO) {
      console.log('Pool data hook: Missing config or pool addresses', config);
      setLoading(false);
      return;
    }

    const fetchAllPoolData = async () => {
      try {
        setLoading(true);
        setError(null);

        const yesPoolId = config.POOL_CONFIG_YES.address;
        const noPoolId = config.POOL_CONFIG_NO.address;
        
        console.log('Fetching pool data for:', {
          yesPool: yesPoolId,
          noPool: noPoolId,
          apiUrl: API_BASE_URL
        });

        // Fetch all data in parallel with error handling for each request
        const fetchWithFallback = async (url) => {
          try {
            console.log(`Fetching from: ${url}`);
            const response = await fetch(url, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
              }
            });
            
            const text = await response.text();
            console.log(`Response from ${url}:`, text);
            
            if (!response.ok) {
              console.error(`Failed to fetch from ${url}: ${response.status} ${response.statusText}`);
              console.error(`Response body:`, text);
              return null;
            }
            
            try {
              return JSON.parse(text);
            } catch (parseErr) {
              console.error(`Failed to parse JSON from ${url}:`, parseErr);
              console.error(`Raw response:`, text);
              return null;
            }
          } catch (err) {
            console.error(`Network error fetching from ${url}:`, err);
            return null;
          }
        };

        const [yesVolume, yesLiquidity, noVolume, noLiquidity] = await Promise.all([
          fetchWithFallback(`${API_BASE_URL}/api/v1/pools/volume?pool_id=${yesPoolId}`),
          fetchWithFallback(`${API_BASE_URL}/api/v1/pools/liquidity?pool_id=${yesPoolId}`),
          fetchWithFallback(`${API_BASE_URL}/api/v1/pools/volume?pool_id=${noPoolId}`),
          fetchWithFallback(`${API_BASE_URL}/api/v1/pools/liquidity?pool_id=${noPoolId}`)
        ]);

        console.log('Pool data responses:', {
          yesVolume,
          yesLiquidity,
          noVolume,
          noLiquidity
        });

        // Normalize liquidity for YES/NO pools (support old and new formats)
        const normalize = (liq) => {
          if (!liq) return null;
          if (typeof liq.amount !== 'undefined') {
            return { amount: liq.amount, token: liq.token };
          }
          return {
            token0: liq.token0,
            amount0: liq.amount0,
            token1: liq.token1,
            amount1: liq.amount1
          };
        };

        setData({
          yesPool: {
            volume: yesVolume?.volume || null,
            liquidity: normalize(yesLiquidity)
          },
          noPool: {
            volume: noVolume?.volume || null,
            liquidity: normalize(noLiquidity)
          }
        });
      } catch (err) {
        console.error('Error fetching YES/NO pool data:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchAllPoolData();
  }, [config?.POOL_CONFIG_YES?.address, config?.POOL_CONFIG_NO?.address]);

  return { data, loading, error };
};

export default usePoolData;