import { useState, useEffect } from 'react';

// Pool API endpoints for YES/NO position data (keep these for chart data)
const YES_POOL_URL = 'https://stag.api.tickspread.com/v4/candles?pool_id=0x9a14d28909f42823Ee29847F87A15Fb3b6E8AEd3&interval=3600000';
const NO_POOL_URL = 'https://stag.api.tickspread.com/v4/candles?pool_id=0x6E33153115Ab58dab0e0F1E3a2ccda6e67FA5cD7&interval=3600000';

// Base token addresses for Balancer SDK
const BASE_COMPANY_TOKEN_ADDRESS = "0x9C58BAcC331c9aa871AFD802DB6379a98e80CEdb"; // GNO
const BASE_CURRENCY_TOKEN_ADDRESS = "0xaf204776c7245bF4147c2612BF6e5972Ee483701"; // sDAI

/**
 * Fetch spot price using custom endpoint if available
 */
const fetchCustomSpotPrice = async (fetchSpotPriceUrl) => {
  try {
    console.log('[SPOT] Starting custom spot price fetch from:', fetchSpotPriceUrl);
    
    const bearerToken = process.env.NEXT_PUBLIC_SPOT_PRICE_TOKEN || 
                        process.env.SPOT_PRICE_TOKEN || 
                        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    console.log('[SPOT] Bearer token check:', {
      hasSpotPriceToken: !!process.env.NEXT_PUBLIC_SPOT_PRICE_TOKEN,
      hasRegularSpotToken: !!process.env.SPOT_PRICE_TOKEN,
      hasSupabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      finalToken: bearerToken ? 'found' : 'not found',
      tokenSource: process.env.NEXT_PUBLIC_SPOT_PRICE_TOKEN ? 'dedicated spot price token' :
                   process.env.SPOT_PRICE_TOKEN ? 'regular spot price token' :
                   process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'supabase anon key fallback' : 'none'
    });
    
    if (!bearerToken) {
      console.warn('[SPOT] No bearer token found in environment variables');
      throw new Error('No bearer token available for custom spot price endpoint');
    }

    const response = await fetch(fetchSpotPriceUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Custom spot price API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[SPOT] Custom spot price response:', data);

    if (!data.price_in_sdai) {
      throw new Error('Custom spot price response missing price_in_sdai field');
    }

    const price = parseFloat(data.price_in_sdai);
    if (isNaN(price) || !isFinite(price)) {
      throw new Error(`Invalid price_in_sdai value: ${data.price_in_sdai}`);
    }

    const result = {
      price: price,
      timestamp: Date.now(),
      source: 'custom',
      rawData: data
    };
    
    console.log('[SPOT] Custom spot price result:', result);
    return result;

  } catch (error) {
    console.error('[SPOT] Failed to fetch custom spot price:', error);
    throw error;
  }
};

/**
 * Fetch spot price using Balancer SDK
 */
const fetchBalancerSpotPrice = async () => {
  try {
    console.log('[SPOT] Starting Balancer spot price fetch...');
    
    // Import Balancer SDK dynamically to avoid bundle issues
    const { BalancerSDK, BalancerNetworkConfig, Network } = await import('@balancer-labs/sdk');
    console.log('[SPOT] Balancer SDK imported successfully');
    
    // Initialize Balancer SDK for Gnosis Chain
    const balancer = new BalancerSDK({
      network: Network.GNOSIS,
      rpcUrl: 'https://rpc.gnosis.gateway.fm'
    });
    console.log('[SPOT] Balancer SDK initialized for Gnosis Chain');

    console.log('[SPOT] Fetching Balancer spot price for GNO/sDAI...');
    console.log('[SPOT] GNO Address:', BASE_COMPANY_TOKEN_ADDRESS);
    console.log('[SPOT] sDAI Address:', BASE_CURRENCY_TOKEN_ADDRESS);

    // Find pools containing both tokens
    console.log('[SPOT] Fetching all pools...');
    const pools = await balancer.pools.all();
    console.log('[SPOT] Total pools found:', pools.length);
    
    const relevantPools = pools.filter(pool => 
      pool.tokens.some(token => token.address.toLowerCase() === BASE_COMPANY_TOKEN_ADDRESS.toLowerCase()) &&
      pool.tokens.some(token => token.address.toLowerCase() === BASE_CURRENCY_TOKEN_ADDRESS.toLowerCase())
    );
    console.log('[SPOT] Relevant pools found:', relevantPools.length);

    if (relevantPools.length === 0) {
      console.log('[SPOT] No pools found - checking individual token presence...');
      const gnoPoolsCount = pools.filter(pool => 
        pool.tokens.some(token => token.address.toLowerCase() === BASE_COMPANY_TOKEN_ADDRESS.toLowerCase())
      ).length;
      const sdaiPoolsCount = pools.filter(pool => 
        pool.tokens.some(token => token.address.toLowerCase() === BASE_CURRENCY_TOKEN_ADDRESS.toLowerCase())
      ).length;
      console.log('[SPOT] Pools with GNO:', gnoPoolsCount);
      console.log('[SPOT] Pools with sDAI:', sdaiPoolsCount);
      
      throw new Error(`No Balancer pools found containing both GNO and sDAI`);
    }

    // Use the pool with highest liquidity
    const bestPool = relevantPools.reduce((best, current) => {
      const bestLiquidity = parseFloat(best.totalLiquidity || '0');
      const currentLiquidity = parseFloat(current.totalLiquidity || '0');
      return currentLiquidity > bestLiquidity ? current : best;
    });

    console.log('[SPOT] Using pool:', {
      id: bestPool.id,
      address: bestPool.address,
      type: bestPool.poolType,
      totalLiquidity: bestPool.totalLiquidity,
      tokens: bestPool.tokens.map(t => ({ address: t.address, symbol: t.symbol }))
    });

    // Calculate spot price (GNO price in sDAI terms)
    console.log('[SPOT] Calculating spot price...');
    const spotPrice = await bestPool.calcSpotPrice(BASE_COMPANY_TOKEN_ADDRESS, BASE_CURRENCY_TOKEN_ADDRESS);
    console.log('[SPOT] Raw spot price from Balancer:', spotPrice);
    
    // Invert the price since Balancer returns sDAI/GNO but we want GNO/sDAI
    const rawPrice = parseFloat(spotPrice);
    if (rawPrice === 0 || !isFinite(rawPrice)) {
      throw new Error(`Invalid spot price from Balancer: ${rawPrice}`);
    }
    const finalPrice = 1 / rawPrice;
    console.log('[SPOT] Inverted price (GNO/sDAI):', finalPrice);
    
    const result = {
      price: finalPrice,
      pool: {
        id: bestPool.id,
        address: bestPool.address,
        type: bestPool.poolType,
        totalLiquidity: bestPool.totalLiquidity
      },
      timestamp: Date.now(),
      source: 'balancer'
    };
    
    console.log('[SPOT] Returning result:', result);
    return result;

  } catch (error) {
    console.error('[SPOT] Failed to fetch Balancer spot price:', error);
    console.error('[SPOT] Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    throw error;
  }
};

/**
 * Hook to fetch the latest price data from candle API endpoints and custom/Balancer spot price
 * @param {number} pollingInterval - Interval in milliseconds to refresh data (default: 30000 - 30 seconds)
 * @param {Object} config - Configuration object containing fetchSpotPrice URL and other metadata
 * @returns {Object} - Object containing latest price data and loading/error states
 */
const useLatestPrices = (pollingInterval = 30000, config = null) => {
  const [prices, setPrices] = useState({
    yes: null,
    no: null, 
    base: null,
    spotPrice: null,
    spotPriceSDAI: null,
    timestamp: null,
    // Store the full candle data for the chart
    yesData: [],
    noData: [],
    baseData: [],
    loading: true,
    error: null
  });

  useEffect(() => {
    // Skip initial fetch if config is expected but not yet loaded
    // Only fetch immediately if no config is needed or config is already available
    if (config === null) {
      console.log('[SPOT] Config is null, skipping price fetch until config loads...');
      setPrices(prev => ({ ...prev, loading: true }));
      return;
    }

    const fetchLatestPrices = async () => {
      try {
        console.log('[SPOT] Starting fetchLatestPrices...');
        
        // Fetch YES/NO position data and Balancer spot price in parallel
        console.log('[SPOT] Fetching data from multiple sources...');
        
        // Fetch each source separately with individual error handling
        let yesResponse, noResponse, balancerSpotPrice;
        
        try {
          console.log('[SPOT] Fetching YES pool data...');
       //   yesResponse = await fetch(YES_POOL_URL);
          console.log('[SPOT] YES pool response status:', yesResponse.status);
        } catch (error) {
          console.error('[SPOT] Failed to fetch YES pool data:', error);
          yesResponse = null;
        }
        
        try {
          console.log('[SPOT] Fetching NO pool data...');
        //noResponse = await fetch(NO_POOL_URL);
          console.log('[SPOT] NO pool response status:', noResponse.status);
        } catch (error) {
          console.error('[SPOT] Failed to fetch NO pool data:', error);
          noResponse = null;
        }
        
        // Try custom spot price first if available, then fall back to Balancer
        try {
          // Debug the config structure
          console.log('[SPOT] Config debug:', {
            hasConfig: !!config,
            hasMetadata: !!config?.metadata,
            fetchSpotPrice: config?.metadata?.fetchSpotPrice,
            marketInfo: config?.marketInfo,
            fullConfig: config
          });
          
          const fetchSpotPriceUrl = config?.metadata?.fetchSpotPrice || config?.marketInfo?.fetchSpotPrice;
          
          if (fetchSpotPriceUrl) {
            console.log('[SPOT] Fetching custom spot price from:', fetchSpotPriceUrl);
            balancerSpotPrice = await fetchCustomSpotPrice(fetchSpotPriceUrl);
            console.log('[SPOT] Custom spot price result:', balancerSpotPrice);
          } else {
            console.log('[SPOT] No custom fetchSpotPrice URL found, using Balancer...');
            console.log('[SPOT] Checked paths:', {
              'config?.metadata?.fetchSpotPrice': config?.metadata?.fetchSpotPrice,
              'config?.marketInfo?.fetchSpotPrice': config?.marketInfo?.fetchSpotPrice,
              'config structure': {
                hasConfig: !!config,
                hasMetadata: !!config?.metadata,
                hasMarketInfo: !!config?.marketInfo,
                metadataKeys: config?.metadata ? Object.keys(config.metadata) : null,
                marketInfoKeys: config?.marketInfo ? Object.keys(config.marketInfo) : null
              }
            });
            balancerSpotPrice = await fetchBalancerSpotPrice();
            console.log('[SPOT] Balancer spot price result:', balancerSpotPrice);
          }
        } catch (error) {
          console.error('[SPOT] Failed to fetch spot price from primary source:', error);
          
          // If custom spot price failed, try Balancer as fallback
          const fallbackFetchSpotPriceUrl = config?.metadata?.fetchSpotPrice || config?.marketInfo?.fetchSpotPrice;
          if (fallbackFetchSpotPriceUrl) {
            try {
              console.log('[SPOT] Custom spot price failed, falling back to Balancer...');
              balancerSpotPrice = await fetchBalancerSpotPrice();
              console.log('[SPOT] Balancer fallback spot price result:', balancerSpotPrice);
            } catch (balancerError) {
              console.error('[SPOT] Balancer fallback also failed:', balancerError);
              balancerSpotPrice = null;
            }
          } else {
            balancerSpotPrice = null;
          }
        }
        
        // Parse API responses if they exist
        let yesData = null, noData = null;
        
        if (yesResponse && yesResponse.ok) {
          try {
            yesData = await yesResponse.json();
            console.log('[SPOT] YES data parsed successfully');
          } catch (error) {
            console.error('[SPOT] Failed to parse YES response:', error);
          }
        }
        
        if (noResponse && noResponse.ok) {
          try {
            noData = await noResponse.json();
            console.log('[SPOT] NO data parsed successfully');
          } catch (error) {
            console.error('[SPOT] Failed to parse NO response:', error);
          }
        }

        // Extract prices with fallbacks
        const latestYesCandle = yesData?.candles?.[yesData.candles.length - 1];
        const latestNoCandle = noData?.candles?.[noData.candles.length - 1];

        const yesPrice = latestYesCandle?.average_price || 0;
        const noPrice = latestNoCandle?.average_price || 0;
        
        // Use Balancer spot price for base price if available
        const basePrice = balancerSpotPrice?.price || null;
        console.log('[SPOT] Extracted prices:', { yesPrice, noPrice, basePrice });
        
        // Calculate the spot price (probability)
        const yesValue = yesPrice;
        const noValue = noPrice;
        const totalValue = yesValue + noValue;
        
        // Calculate spot price as probability (YES / (YES + NO))
        const spotPrice = totalValue > 0 ? yesValue / totalValue : 0.5; // default to 0.5 if no data
        
        // Use the Balancer spot price for GNO/sDAI
        const spotPriceSDAI = basePrice;
        
        console.log('[SPOT] Calculated values:', { spotPrice, spotPriceSDAI, totalValue });

        // Prepare formatted candle data for the chart
        const formattedYesData = yesData?.candles?.map(candle => ({
          time: candle.timestamp,
          value: candle.average_price
        })) || [];

        const formattedNoData = noData?.candles?.map(candle => ({
          time: candle.timestamp,
          value: candle.average_price
        })) || [];

        // Create synthetic base data from Balancer price for chart consistency
        const formattedBaseData = balancerSpotPrice ? [{
          time: balancerSpotPrice.timestamp,
          value: basePrice
        }] : [];

        const finalState = {
          yes: yesPrice,
          no: noPrice,
          base: basePrice,
          spotPrice: spotPrice,
          spotPriceSDAI: spotPriceSDAI,
          timestamp: balancerSpotPrice?.timestamp || Date.now(),
          // Add the formatted candle data for the chart
          yesData: formattedYesData,
          noData: formattedNoData,
          baseData: formattedBaseData,
          loading: false,
          error: null, // Don't set error if at least Balancer price works
          // Add Balancer-specific data
          balancerPool: balancerSpotPrice?.pool || null,
          source: balancerSpotPrice ? 'hybrid' : 'partial' // Stage API for positions, Balancer for spot price
        };
        
        console.log('[SPOT] Setting final state:', finalState);
        setPrices(finalState);

        console.log('[SPOT] Prices fetched successfully:', {
          spotPriceSDAI: spotPriceSDAI,
          balancerPool: balancerSpotPrice?.pool?.id,
          source: finalState.source,
          hasYesData: !!yesData,
          hasNoData: !!noData,
          hasBalancerData: !!balancerSpotPrice
        });

      } catch (error) {
        console.error('[SPOT] Error fetching latest prices:', error);
        console.error('[SPOT] Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
        setPrices(prev => ({
          ...prev,
          loading: false,
          error: error.message
        }));
      }
    };

    // Fetch immediately
    fetchLatestPrices();
    
    // Set up polling
    const interval = setInterval(fetchLatestPrices, pollingInterval);
    
    // Clean up
    return () => clearInterval(interval);
  }, [pollingInterval, config?.metadata?.fetchSpotPrice, config?.marketInfo?.fetchSpotPrice]);

  return prices;
};

export default useLatestPrices; 