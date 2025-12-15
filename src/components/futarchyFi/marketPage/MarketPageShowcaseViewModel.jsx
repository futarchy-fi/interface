import { useState, useEffect } from 'react';
import useLatestPrices from '../../../hooks/useLatestPrices';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://nvhqdqtlsdboctqjcelq.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export const createCustomDatafeed = (poolId) => {
  let cachedData = null;
  let isFetching = false;

  const generateHistoricalData = async () => {
    try {
      // Fetch hourly candles from Supabase instead of external API
      const { data, error } = await supabase
        .from('pool_candles')
        .select('timestamp, price')
        .eq('address', poolId)
        .eq('interval', '3600000')
        .order('timestamp', { ascending: true })
        .limit(1000);

      if (error) {
        throw new Error(`Failed to fetch candles from Supabase: ${error.message}`);
      }

      const candles = (data || []).map(row => ({
        timestamp: row.timestamp,
        average_price: row.price
      }));
      
      // Sort candles by timestamp to ensure chronological order
      candles.sort((a, b) => a.timestamp - b.timestamp);
      
      const processedData = [];
      
      for (let i = 0; i < candles.length; i++) {
        const currentCandle = candles[i];
        const nextCandle = candles[i + 1];
        
        // Add the current candle
        processedData.push({
          time: currentCandle.timestamp,
          open: currentCandle.average_price,
          high: currentCandle.average_price,
          low: currentCandle.average_price,
          close: currentCandle.average_price,
          volume: 0
        });

        // If there's a next candle, fill the gap with hourly bars
        if (nextCandle) {
          const hourInSeconds = 3600;
          const timeDiff = nextCandle.timestamp - currentCandle.timestamp;
          const hoursToFill = Math.floor(timeDiff / hourInSeconds) - 1;

          // Fill each hour with the current candle's price until we reach the next candle
          for (let hour = 1; hour <= hoursToFill; hour++) {
            processedData.push({
              time: currentCandle.timestamp + (hour * hourInSeconds),
              open: currentCandle.average_price,
              high: currentCandle.average_price,
              low: currentCandle.average_price,
              close: currentCandle.average_price,
              volume: 0
            });
          }
        }
      }

      console.log('[CustomDatafeed] Generated bars:', {
        totalBars: processedData.length,
        firstBar: processedData[0],
        lastBar: processedData[processedData.length - 1],
        timeRange: {
          start: new Date(processedData[0].time * 1000).toISOString(),
          end: new Date(processedData[processedData.length - 1].time * 1000).toISOString()
        }
      });
      
      return processedData;
    } catch (error) {
      console.error('[CustomDatafeed] Error generating historical data:', error);
      throw error;
    }
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

  const convertTimestamp = (timestamp) => {
    // Convert to milliseconds for TradingView
    return timestamp * 1000;
  };

  const filterUniqueTimestamps = (data) => {
    console.log('[filterUniqueTimestamps] Input data:', {
      count: data.length,
      sampleTimestamps: data.slice(0, 3).map(d => ({
        time: d.time,
        date: new Date(d.time).toISOString()
      }))
    });
    
    const seen = new Set();
    const filtered = data.filter(item => {
      if (seen.has(item.time)) {
        return false;
      }
      seen.add(item.time);
      return true;
    });

    console.log('[filterUniqueTimestamps] Output data:', {
      count: filtered.length,
      sampleTimestamps: filtered.slice(0, 3).map(d => ({
        time: d.time,
        date: new Date(d.time).toISOString()
      }))
    });

    return filtered;
  };

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

        isFetching = true;
        console.log('[ProductionDatafeed] Fetching new data from Supabase');
        const { data, error } = await supabase
          .from('pool_candles')
          .select('timestamp, price')
          .eq('address', poolId)
          .eq('interval', '3600000')
          .order('timestamp', { ascending: true })
          .limit(2000);

        if (error) {
          throw new Error(`Failed to fetch candles from Supabase: ${error.message}`);
        }

        const rows = data || [];
        console.log('[ProductionDatafeed] Supabase response:', {
          totalCandles: rows.length,
          sampleCandles: rows.slice(0, 3).map(c => ({
            timestamp: c.timestamp,
            date: new Date(c.timestamp * 1000).toISOString(),
            price: c.price
          }))
        });

        // Transform and cache the data with unique timestamps
        const transformedData = rows.map(candle => ({
          time: convertTimestamp(candle.timestamp), // Convert to milliseconds
          open: candle.price,
          high: candle.price,
          low: candle.price,
          close: candle.price,
          volume: 0
        }));

        // Filter out duplicate timestamps and sort by time
        cachedData = filterUniqueTimestamps(transformedData).sort((a, b) => a.time - b.time);

        // Filter cached data for the requested range
        const bars = cachedData.filter(bar => 
          bar.time >= from * 1000 && bar.time <= to * 1000
        );

        console.log('[ProductionDatafeed] Final filtered bars:', {
          requestedRange: {
            from: new Date(from * 1000).toISOString(),
            to: new Date(to * 1000).toISOString()
          },
          barsReturned: bars.length,
          firstBar: bars[0] ? {
            time: bars[0].time,
            date: new Date(bars[0].time).toISOString(),
            price: bars[0].close
          } : null,
          lastBar: bars[bars.length - 1] ? {
            time: bars[bars.length - 1].time,
            date: new Date(bars[bars.length - 1].time).toISOString(),
            price: bars[bars.length - 1].close
          } : null
        });

        isFetching = false;
        onHistoryCallback(bars, { noData: bars.length === 0 });
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