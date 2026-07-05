import { useState, useEffect } from 'react';
import useLatestPrices from '../../../hooks/useLatestPrices';

// NOTE: The Supabase pool_candles backend is permanently gone. The legacy
// datafeeds below no longer have a data source; the production chart is
// rendered from subgraph data elsewhere.

export const createCustomDatafeed = (poolId) => {
  let cachedData = null;
  let isFetching = false;

  const generateHistoricalData = async () => {
    // The Supabase candle backend that powered this datafeed is gone.
    // Return no bars rather than fetching from a dead endpoint.
    return [];
  };

  return {
    onReady: (callback) => {
      setTimeout(() => callback({
        supported_resolutions: ['60'],
        supports_marks: false,
        supports_timescale_marks: false,
        supports_time: true
      }), 0);
    },
    
    searchSymbols: () => {},
    
    resolveSymbol: (symbolName, onSymbolResolvedCallback) => {
      setTimeout(() => onSymbolResolvedCallback({
        name: 'GNO/SDAI',
        description: 'GNO/SDAI Custom Feed',
        type: 'crypto',
        session: '24x7',
        timezone: 'Etc/UTC',
        minmov: 1,
        pricescale: 100,
        has_intraday: true,
        supported_resolutions: ['60'],
        volume_precision: 2,
        data_status: 'streaming'
      }), 0);
    },
    
    getBars: async (symbolInfo, resolution, periodParams, onHistoryCallback, onErrorCallback) => {
      try {
        const { from, to } = periodParams;
        
        // If data is already cached, use it
        if (!cachedData && !isFetching) {
          isFetching = true;
          cachedData = await generateHistoricalData();
          isFetching = false;
        }
        
        if (cachedData) {
          const filteredData = cachedData.filter(bar => 
            bar.time >= from && bar.time <= to
          );
          
          console.log('[CustomDatafeed] Filtered bars:', {
            requestedRange: {
              from: new Date(from * 1000).toISOString(),
              to: new Date(to * 1000).toISOString()
            },
            barsReturned: filteredData.length,
            firstBar: filteredData[0],
            lastBar: filteredData[filteredData.length - 1]
          });
          
          onHistoryCallback(filteredData, { noData: filteredData.length === 0 });
        }
      } catch (error) {
        console.error('[CustomDatafeed] Error in getBars:', error);
        onErrorCallback(error);
      }
    },
    
    subscribeBars: () => {},
    unsubscribeBars: () => {}
  };
};

export const createProductionDatafeed = (poolId) => {
  let cachedData = null;
  let isFetching = false;

  return {
    onReady: (callback) => {
      console.log('[ProductionDatafeed] onReady called');
      setTimeout(() => callback({
        supported_resolutions: ['60'],
        supports_marks: false,
        supports_timescale_marks: false,
        supports_time: true
      }), 0);
    },

    searchSymbols: () => {},

    resolveSymbol: (symbolName, onSymbolResolvedCallback) => {
      console.log('[ProductionDatafeed] resolveSymbol called for:', symbolName);
      setTimeout(() => onSymbolResolvedCallback({
        name: 'GNO/SDAI',
        description: 'GNO/SDAI',
        type: 'crypto',
        session: '24x7',
        timezone: 'Etc/UTC',
        minmov: 1,
        pricescale: 100,
        has_intraday: true,
        supported_resolutions: ['60'],
        volume_precision: 2,
        data_status: 'streaming'
      }), 0);
    },

    getBars: async (symbolInfo, resolution, periodParams, onHistoryCallback, onErrorCallback) => {
      try {
        const { from, to } = periodParams;
        console.log('[ProductionDatafeed] getBars called with params:', {
          resolution,
          from: new Date(from * 1000).toISOString(),
          to: new Date(to * 1000).toISOString(),
          fromTimestamp: from,
          toTimestamp: to
        });

        // If data is already cached, use it
        if (cachedData) {
          console.log('[ProductionDatafeed] Using cached data:', {
            totalCachedBars: cachedData.length,
            firstCachedBar: {
              time: cachedData[0].time,
              date: new Date(cachedData[0].time).toISOString()
            },
            lastCachedBar: {
              time: cachedData[cachedData.length - 1].time,
              date: new Date(cachedData[cachedData.length - 1].time).toISOString()
            }
          });

          const bars = cachedData.filter(bar => 
            bar.time >= from * 1000 && bar.time <= to * 1000
          );
          onHistoryCallback(bars, { noData: bars.length === 0 });
          return;
        }

        // If already fetching, wait
        if (isFetching) {
          console.log('[ProductionDatafeed] Already fetching data, skipping request');
          return;
        }

        // The Supabase candle backend that powered this datafeed is gone.
        // Cache an empty dataset and report no data rather than fetching
        // from a dead endpoint.
        isFetching = true;
        cachedData = [];
        isFetching = false;
        onHistoryCallback([], { noData: true });
      } catch (error) {
        isFetching = false;
        console.error('[ProductionDatafeed] Error fetching bars:', error);
        onErrorCallback(error);
      }
    },

    subscribeBars: () => {
      console.log('[ProductionDatafeed] subscribeBars called');
    },
    unsubscribeBars: () => {
      console.log('[ProductionDatafeed] unsubscribeBars called');
    }
  };
};

export const useMarketPageViewModel = (poolId, debugMode = false) => {
  // Use our new hook for latest prices
  const latestPrices = useLatestPrices(60000); // Update every minute

  // Transform the data to match the expected format
  const prices = {
    yesPrice: latestPrices.yes,
    noPrice: latestPrices.no,
    // Optional legacy prices if needed
    yesLegacyPrice: latestPrices.yes ? latestPrices.yes * 1.02 : null,
    noLegacyPrice: latestPrices.no ? latestPrices.no * 0.98 : null,
    isLoading: latestPrices.loading,
    error: latestPrices.error,
    lastUpdate: latestPrices.timestamp ? new Date(latestPrices.timestamp) : null
  };

  // If in debug mode, override with mock data
  useEffect(() => {
    if (debugMode) {
      // Override prices with mock data for debug mode
      prices.yesPrice = 155 + Math.random() * 10;
      prices.noPrice = 145 - Math.random() * 10;
      prices.yesLegacyPrice = 157 + Math.random() * 10;
      prices.noLegacyPrice = 143 - Math.random() * 10;
      prices.isLoading = false;
      prices.error = null;
      prices.lastUpdate = new Date();
    }
  }, [debugMode]);

  const getDatafeed = () => {
    if (debugMode) {
      return createCustomDatafeed(poolId);
    }
    return createProductionDatafeed(poolId);
  };

  return {
    prices,
    datafeed: getDatafeed()
  };
}; 