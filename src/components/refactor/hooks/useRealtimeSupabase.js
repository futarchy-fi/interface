import { useState, useCallback, useEffect, useRef } from 'react';
import { TradeHistoryRealtimeStrategy } from '../strategies/TradeHistoryRealtimeStrategy';
import { PoolCandlesRealtimeStrategy } from '../strategies/PoolCandlesRealtimeStrategy';
import { REALTIME_CONFIG } from '../constants/supabase';

/**
 * Generic Realtime Supabase Hook
 * Uses strategy pattern to handle different types of realtime subscriptions
 * Provides a unified interface for trade history, pool candles, etc.
 */
export function useRealtimeSupabase(strategyType, options = {}) {
  // State
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState(REALTIME_CONFIG.CONNECTION_STATUS.DISCONNECTED);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [updateCount, setUpdateCount] = useState(0);

  // Strategy reference
  const strategyRef = useRef(null);
  const currentFiltersRef = useRef({});

  // Initialize strategy
  useEffect(() => {
    try {
      console.log(`🚀 Initializing realtime strategy: ${strategyType}`);
      
      // Create strategy instance based on type
      switch (strategyType) {
        case 'trade_history':
          strategyRef.current = new TradeHistoryRealtimeStrategy(options);
          break;
        case 'pool_candles':
          strategyRef.current = new PoolCandlesRealtimeStrategy(options);
          break;
        default:
          throw new Error(`Unknown strategy type: ${strategyType}`);
      }

      // Set up callbacks
      strategyRef.current.setCallbacks({
        onConnect: () => {
          console.log(`✅ ${strategyType} connected`);
          setConnectionStatus(REALTIME_CONFIG.CONNECTION_STATUS.CONNECTED);
          setIsSubscribed(true);
        },
        
        onDisconnect: () => {
          console.log(`🛑 ${strategyType} disconnected`);
          setConnectionStatus(REALTIME_CONFIG.CONNECTION_STATUS.DISCONNECTED);
          setIsSubscribed(false);
        },
        
        onError: (error) => {
          console.error(`❌ ${strategyType} error:`, error);
          setError(error.message || 'Unknown realtime error');
          setConnectionStatus(REALTIME_CONFIG.CONNECTION_STATUS.ERROR);
        },
        
        onDataUpdate: (processedData, rawPayload) => {
          console.log(`🔥 ${strategyType} data update:`, processedData?.action);
          console.log(`📋 Processed data:`, processedData);
          
          // IMPORTANT: Use the same strategy instance that triggered the callback
          // Update state based on strategy type
          if (strategyType === 'trade_history') {
            const fullData = strategyRef.current.getFullData();
            console.log(`📊 Trade history full data:`, fullData);
            console.log(`📊 Trades array length:`, fullData?.trades?.length);
            console.log(`📊 Sample trade:`, fullData?.trades?.[0]);
            setData(fullData);
          } else if (strategyType === 'pool_candles') {
            const poolData = strategyRef.current.getAllPoolData();
            console.log(`📊 Pool candles data:`, poolData);
            setData(poolData);
          }
          
          setLastUpdate(new Date());
          setUpdateCount(prev => prev + 1);
          setConnectionStatus(REALTIME_CONFIG.CONNECTION_STATUS.LIVE);
        },
        
        onStatusChange: (newStatus, oldStatus, error) => {
          console.log(`📡 ${strategyType} status change: ${oldStatus} → ${newStatus}`);
          setConnectionStatus(newStatus);
          if (error) {
            setError(error.message || 'Status change error');
          }
        }
      });

    } catch (err) {
      console.error(`❌ Failed to initialize ${strategyType} strategy:`, err);
      setError(`Failed to initialize strategy: ${err.message}`);
    }

    // Cleanup on unmount
    return () => {
      if (strategyRef.current) {
        console.log(`🧹 Cleaning up ${strategyType} strategy`);
        strategyRef.current.unsubscribe();
      }
    };
  }, [strategyType]);

  // Subscribe to realtime updates
  const subscribe = useCallback(async (filters = {}) => {
    if (!strategyRef.current) {
      throw new Error('Strategy not initialized');
    }

    try {
      setLoading(true);
      setError(null);
      currentFiltersRef.current = filters;

      console.log(`📡 Subscribing to ${strategyType} with filters:`, filters);
      console.log(`📡 Strategy instance exists:`, !!strategyRef.current);

      // Call strategy-specific subscribe method
      let channel;
      if (strategyType === 'trade_history') {
        const { user_address, proposal_id } = filters;
        if (!user_address) {
          throw new Error('user_address is required for trade history subscription');
        }
        console.log(`📡 Calling subscribeToUserTrades with:`, { user_address, proposal_id });
        channel = await strategyRef.current.subscribeToUserTrades(user_address, proposal_id);
        console.log(`📡 subscribeToUserTrades completed`);
        
        // CRITICAL: Wait a bit to ensure the callback has processed
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Update data immediately after subscription (includes initial fetch)
        const fullData = strategyRef.current.getFullData();
        console.log(`📡 Post-subscription trade data (after delay):`, fullData);
        console.log(`📡 Post-subscription trades count (after delay):`, fullData?.trades?.length);
        setData(fullData);
      } else if (strategyType === 'pool_candles') {
        const { interval, poolAddresses } = filters;
        console.log(`📡 Subscribing to pool candles with interval: ${interval}, pools:`, poolAddresses);
        
        // Pass pool addresses to the strategy method
        // Note: poolAddresses is not passed as a filter to avoid validation error
        // It's handled by the strategy internally for client-side filtering
        channel = await strategyRef.current.subscribeToPoolCandles(interval, poolAddresses);
        
        // CRITICAL: Wait a bit to ensure the callback has processed
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Update data immediately after subscription (includes initial fetch)
        const poolData = strategyRef.current.getAllPoolData();
        console.log(`📡 Post-subscription pool data (after delay):`, poolData);
        setData(poolData);
      } else {
        // Generic subscribe
        channel = await strategyRef.current.subscribe(filters);
      }

      return channel;

    } catch (err) {
      console.error(`❌ Failed to subscribe to ${strategyType}:`, err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [strategyType]);

  // Unsubscribe from realtime updates
  const unsubscribe = useCallback(() => {
    if (strategyRef.current) {
      console.log(`🛑 Unsubscribing from ${strategyType}`);
      strategyRef.current.unsubscribe();
      setData(null);
      setIsSubscribed(false);
      setConnectionStatus(REALTIME_CONFIG.CONNECTION_STATUS.DISCONNECTED);
    }
  }, [strategyType]);

  // Reconnect with same filters
  const reconnect = useCallback(async () => {
    if (currentFiltersRef.current && Object.keys(currentFiltersRef.current).length > 0) {
      console.log(`🔄 Reconnecting ${strategyType} with filters:`, currentFiltersRef.current);
      await subscribe(currentFiltersRef.current);
    }
  }, [subscribe]);

  // Get current strategy data
  const getStrategyData = useCallback(() => {
    if (!strategyRef.current) return null;

    if (strategyType === 'trade_history') {
      return {
        stats: strategyRef.current.getStats(),
        status: strategyRef.current.getStatus()
      };
    } else if (strategyType === 'pool_candles') {
      return {
        poolData: strategyRef.current.getAllPoolData(),
        stats: strategyRef.current.getStats(),
        status: strategyRef.current.getStatus()
      };
    }

    return strategyRef.current.getStatus();
  }, [strategyType]);

  // Get strategy-specific methods
  const getStrategyMethods = useCallback(() => {
    if (!strategyRef.current) return {};

    const commonMethods = {
      getStatus: () => strategyRef.current.getStatus(),
      retry: () => strategyRef.current.retry()
    };

    if (strategyType === 'trade_history') {
      return {
        ...commonMethods,
        getStats: () => strategyRef.current.getStats(),
        resetStats: () => strategyRef.current.resetStats(),
        resetNewTradesCount: () => strategyRef.current.resetNewTradesCount()
      };
    } else if (strategyType === 'pool_candles') {
      return {
        ...commonMethods,
        getAllPoolData: () => strategyRef.current.getAllPoolData(),
        getPoolData: (poolKey) => strategyRef.current.getPoolData(poolKey),
        clearAllPools: () => strategyRef.current.clearAllPools(),
        clearPool: (poolKey) => strategyRef.current.clearPool(poolKey),
        getStats: () => strategyRef.current.getStats()
      };
    }

    return commonMethods;
  }, [strategyType]);

  // Reset all state
  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLastUpdate(null);
    setUpdateCount(0);
    setConnectionStatus(REALTIME_CONFIG.CONNECTION_STATUS.DISCONNECTED);
    setIsSubscribed(false);
    currentFiltersRef.current = {};
  }, []);

  return {
    // Data
    data,
    lastUpdate,
    updateCount,

    // Status
    loading,
    error,
    connectionStatus,
    isSubscribed,
    
    // Actions
    subscribe,
    unsubscribe,
    reconnect,
    reset,

    // Strategy specific
    getStrategyData,
    getStrategyMethods,
    
    // Strategy reference (for advanced usage)
    strategy: strategyRef.current,

    // Computed values
    isConnected: connectionStatus === REALTIME_CONFIG.CONNECTION_STATUS.CONNECTED,
    isLive: connectionStatus === REALTIME_CONFIG.CONNECTION_STATUS.LIVE,
    isError: connectionStatus === REALTIME_CONFIG.CONNECTION_STATUS.ERROR,
    hasData: !!data
  };
}

/**
 * Convenience hooks for specific strategy types
 */

// Trade History Hook
export function useTradeHistoryRealtime(options = {}) {
  return useRealtimeSupabase('trade_history', options);
}

// Pool Candles Hook
export function usePoolCandlesRealtime(options = {}) {
  return useRealtimeSupabase('pool_candles', options);
}

export default useRealtimeSupabase; 