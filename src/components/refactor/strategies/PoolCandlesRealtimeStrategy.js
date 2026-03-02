import { BaseRealtimeStrategy } from './BaseRealtimeStrategy';
import { REALTIME_TABLES, REALTIME_CONFIG } from '../constants/supabase';

/**
 * Pool Candles Realtime Strategy
 * Handles realtime subscriptions for the pool_candles table
 * Filters by pool addresses (dynamic from proposal) and interval
 */
export class PoolCandlesRealtimeStrategy extends BaseRealtimeStrategy {
  constructor(options = {}) {
    super(REALTIME_TABLES.POOL_CANDLES, options);
    
    // Pool candles specific state
    this.candlesByPool = {}; // Store candles grouped by pool_interval_id
    this.allowedPools = []; // Dynamic pool addresses from proposal
    this.intervalFilter = null; // Store interval for client-side filtering
    this.stats = {
      totalCandles: 0,
      newCandlesCount: 0,
      lastCandleTime: null,
      updatesReceived: 0,
      totalPools: 0
    };
    
    console.log('📊 PoolCandlesRealtimeStrategy initialized');
    console.log('📊 Will use dynamic pool addresses from proposal');
  }

  /**
   * Set allowed pool addresses dynamically
   */
  setAllowedPools(poolAddresses = []) {
    this.allowedPools = poolAddresses.filter(Boolean); // Remove any null/undefined
    console.log('📊 Updated allowed pools:', this.allowedPools);
  }

  /**
   * Generate channel name specific to pool candles
   * Include interval in channel name for uniqueness
   */
  generateChannelName(filters = {}) {
    const { interval } = filters;
    const intervalSuffix = interval ? `${interval}` : 'unknown';
    return `pool-candles-${intervalSuffix}-${Date.now()}`;
  }

  /**
   * Validate pool candles specific filters
   */
  validateFilters(filters = {}) {
    super.validateFilters(filters);
    
    // Interval is required for pool candles
    if (!filters.interval) {
      throw new Error('interval filter is required for pool candles subscriptions');
    }
    
    // Validate interval is a number
    if (isNaN(Number(filters.interval))) {
      throw new Error('interval must be a valid number');
    }

    // Note: poolAddresses are not validated here since they're handled separately
    // and not used as postgres filters. They're set via setAllowedPools() method.
    
    return true;
  }

  /**
   * Fetch initial pool candles data before subscribing to realtime
   */
  async fetchInitialData(interval = 60000) {
    try {
      console.log(`🔍 Fetching initial pool candles for interval: ${interval}`);
      console.log(`🔍 Allowed pools:`, this.allowedPools);
      
      if (this.allowedPools.length === 0) {
        throw new Error('No pool addresses configured. Cannot fetch initial data.');
      }
      
      const { data, error, count } = await this.supabase
        .from('pool_candles')
        .select('*', { count: 'exact' })
        .eq('interval', interval)
        .in('address', this.allowedPools)
        .order('timestamp', { ascending: false });
      
      if (error) {
        console.error('❌ Supabase query error:', error);
        throw error;
      }
      
      console.log(`✅ Initial pool candles fetched: ${data.length} candles`);
      console.log(`📊 Total count from database: ${count}`);
      console.log(`📋 Sample data:`, data[0]);
      
      // Group by pool_interval_id like the original
      const grouped = {};
      (data || []).forEach(candle => {
        const key = candle.pool_interval_id || 'unknown';
        if (!grouped[key]) grouped[key] = { candles: [], count: 0 };
        if (grouped[key].candles.length < 10) grouped[key].candles.push(candle);
        grouped[key].count += 1;
      });
      
      console.log(`🔄 Before storing candles - current pools: ${Object.keys(this.candlesByPool).length}`);
      this.candlesByPool = grouped;
      console.log(`🔄 After storing candles - new pools: ${Object.keys(this.candlesByPool).length}`);
      console.log(`🔄 Pool keys:`, Object.keys(this.candlesByPool));
      
      this.stats = {
        totalCandles: count || data.length,
        newCandlesCount: 0,
        lastCandleTime: data.length > 0 ? data[0].timestamp : null,
        updatesReceived: 0,
        totalPools: Object.keys(grouped).length
      };
      
      console.log(`📊 Updated stats:`, this.stats);
      
      // Notify callbacks with initial data
      if (this.callbacks.onDataUpdate) {
        console.log(`📞 Calling onDataUpdate callback`);
        this.callbacks.onDataUpdate({
          action: 'INITIAL_FETCH',
          candlesByPool: this.candlesByPool,
          stats: this.stats
        }, null);
      } else {
        console.log(`⚠️ No onDataUpdate callback set`);
      }
      
      return data;
      
    } catch (error) {
      console.error('❌ Failed to fetch initial pool candles:', error);
      this.updateConnectionStatus(REALTIME_CONFIG.CONNECTION_STATUS.ERROR, error);
      throw error;
    }
  }

  /**
   * Process pool candles realtime updates
   * Handles INSERT, UPDATE, DELETE events and updates the candlesByPool object
   */
  processRealtimeUpdate(payload) {
    const { eventType, new: newData, old: oldData } = payload;
    
    console.log(`📊 Processing pool candles ${eventType}:`, {
      eventType,
      newCandleId: newData?.id,
      oldCandleId: oldData?.id,
      poolIntervalId: newData?.pool_interval_id || oldData?.pool_interval_id,
      address: newData?.address || oldData?.address,
      interval: newData?.interval || oldData?.interval
    });

    // Client-side filtering for allowed addresses (matching original SupabaseComponent)
    const addressMatches = (data) => {
      if (!data) return false;
      const address = data.address?.toLowerCase();
      return this.allowedPools.map(a => a.toLowerCase()).includes(address);
    };

    // Check if this update should be processed
    if (eventType === 'INSERT' && newData && !addressMatches(newData)) {
      console.log(`⏭️ Skipping INSERT - address ${newData.address} not in allowed pools`);
      return null;
    }
    
    if (eventType === 'UPDATE' && newData && !addressMatches(newData)) {
      console.log(`⏭️ Skipping UPDATE - address ${newData.address} not in allowed pools`);
      return null;
    }

    if (eventType === 'DELETE' && oldData && !addressMatches(oldData)) {
      console.log(`⏭️ Skipping DELETE - address ${oldData.address} not in allowed pools`);
      return null;
    }

    console.log(`✅ Processing ${eventType} for allowed address`);
    this.stats.updatesReceived++;

    const processedUpdate = {
      eventType,
      newData,
      oldData,
      timestamp: new Date().toISOString(),
      processingInfo: {
        strategy: 'PoolCandlesRealtime',
        updateCount: this.stats.updatesReceived,
        intervalFilter: this.intervalFilter
      }
    };

    // Update candlesByPool object based on event type
    switch (eventType) {
      case REALTIME_CONFIG.EVENT_TYPES.INSERT:
        if (newData) {
          const poolKey = newData.pool_interval_id || 'unknown';
          const group = this.candlesByPool[poolKey] || { candles: [], count: 0 };
          
          // Add new candle to the beginning and keep only latest 10 for display
          const newGroup = {
            candles: [newData, ...group.candles].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, 10),
            count: group.count + 1
          };
          
          this.candlesByPool[poolKey] = newGroup;
          this.stats.totalCandles++;
          this.stats.newCandlesCount++;
          this.stats.lastCandleTime = newData.timestamp;
          
          processedUpdate.action = 'ADD_CANDLE';
          processedUpdate.candleData = this.formatCandleData(newData);
          processedUpdate.candlesByPool = this.candlesByPool;
          processedUpdate.stats = this.stats;
          
          console.log(`➕ New candle added to pool ${poolKey}: ID ${newData.id}, Total: ${this.stats.totalCandles}`);
        }
        break;

      case REALTIME_CONFIG.EVENT_TYPES.UPDATE:
        if (newData) {
          const poolKey = newData.pool_interval_id || 'unknown';
          const group = this.candlesByPool[poolKey];
          
          if (group) {
            // Update existing candle in the array
            group.candles = group.candles.map(candle => 
              candle.id === newData.id ? newData : candle
            );
            this.stats.lastCandleTime = newData.timestamp;
          }
          
          processedUpdate.action = 'UPDATE_CANDLE';
          processedUpdate.candleData = this.formatCandleData(newData);
          processedUpdate.candlesByPool = this.candlesByPool;
          processedUpdate.stats = this.stats;
          
          console.log(`✏️ Candle updated in pool ${poolKey}: ID ${newData.id}`);
        }
        break;

      case REALTIME_CONFIG.EVENT_TYPES.DELETE:
        if (oldData) {
          const poolKey = oldData.pool_interval_id || 'unknown';
          const group = this.candlesByPool[poolKey];
          
          if (group) {
            // Remove candle from the array
            group.candles = group.candles.filter(candle => candle.id !== oldData.id);
            group.count = Math.max(0, group.count - 1);
            this.stats.totalCandles = Math.max(0, this.stats.totalCandles - 1);
          }
          
          processedUpdate.action = 'REMOVE_CANDLE';
          processedUpdate.candleData = this.formatCandleData(oldData);
          processedUpdate.candlesByPool = this.candlesByPool;
          processedUpdate.stats = this.stats;
          
          console.log(`🗑️ Candle deleted from pool ${poolKey}: ID ${oldData.id}`);
        }
        break;

      default:
        console.warn(`⚠️ Unknown event type: ${eventType}`);
        processedUpdate.action = 'UNKNOWN';
    }

    return processedUpdate;
  }

  /**
   * Format candle data for consistency
   */
  formatCandleData(candleData) {
    if (!candleData) return null;

    return {
      id: candleData.id,
      poolIntervalId: candleData.pool_interval_id,
      address: candleData.address,
      interval: candleData.interval,
      timestamp: candleData.timestamp,
      price: candleData.price,
      createdAt: candleData.created_at,
      updatedAt: candleData.updated_at,
      insertedAt: candleData.inserted_at,
      formattedTime: new Date(candleData.timestamp * 1000).toLocaleString(),
      formattedPrice: candleData.price ? candleData.price.toFixed(6) : '0.000000',
      poolType: this.getPoolType(candleData.address)
    };
  }

  /**
   * Get pool type (YES/NO/COMPANY/CURRENCY) from address
   * Works with dynamic pool addresses from proposal
   */
  getPoolType(address) {
    if (!address || this.allowedPools.length === 0) return 'UNKNOWN';
    
    const index = this.allowedPools.findIndex(pool => 
      pool?.toLowerCase() === address?.toLowerCase()
    );
    
    if (index === -1) return 'UNKNOWN';
    
    // Standard naming convention for proposal outcomes:
    // Index 0,1 = Company outcomes (YES_COMPANY, NO_COMPANY)  
    // Index 2,3 = Currency outcomes (YES_CURRENCY, NO_CURRENCY)
    const typeMap = ['YES_COMPANY', 'NO_COMPANY', 'YES_CURRENCY', 'NO_CURRENCY'];
    return typeMap[index] || `OUTCOME_${index}`;
  }

  /**
   * Override buildFilterString to match original SupabaseComponent behavior
   * Filter by interval in postgres_changes, do client-side address filtering
   */
  buildFilterString(filters) {
    if (!filters || Object.keys(filters).length === 0) {
      return null;
    }
    
    // Match original SupabaseComponent: filter by interval in postgres_changes
    // Address filtering is done client-side in processRealtimeUpdate
    const intervalFilter = filters.interval;
    if (!intervalFilter) {
      return null;
    }
    
    return `interval=eq.${intervalFilter}`;
  }

  /**
   * Subscribe to pool candles with interval filter (includes initial fetch)
   */
  async subscribeToPoolCandles(interval = 60000, poolAddresses = []) {
    console.log(`📊 Starting full subscription for interval: ${interval}`);
    console.log(`📊 Pool addresses provided:`, poolAddresses);
    console.log(`📊 Current pools count before fetch: ${Object.keys(this.candlesByPool).length}`);
    
    // Update allowed pools if provided
    if (poolAddresses && poolAddresses.length > 0) {
      this.setAllowedPools(poolAddresses);
    }
    
    // Validate we have pools to monitor
    if (this.allowedPools.length === 0) {
      throw new Error('No pool addresses configured. Cannot subscribe to pool candles.');
    }
    
    try {
      // First, fetch initial data
      console.log(`📊 About to call fetchInitialData...`);
      await this.fetchInitialData(interval);
      console.log(`📊 fetchInitialData completed. Pools count now: ${Object.keys(this.candlesByPool).length}`);
    } catch (error) {
      console.error(`❌ fetchInitialData failed:`, error);
      throw error;
    }
    
    // Store interval for client-side filtering (though not needed since postgres filters by interval)
    this.intervalFilter = interval;
    
    // Then subscribe to realtime updates
    // IMPORTANT: Filter by interval in postgres_changes (like original SupabaseComponent)
    // Address filtering will be done client-side in processRealtimeUpdate
    const filters = {
      interval: interval  // Only interval filter for postgres_changes
      // poolAddresses are handled via client-side filtering, not postgres filter
    };

    console.log(`📡 Setting up realtime subscription for pool candles`);
    console.log(`📋 PostgreSQL filter: interval=eq.${interval} (matching original)`);
    console.log(`📋 Client-side address filtering for: ${this.allowedPools.join(', ')}`);

    return this.subscribe(filters);
  }

  /**
   * Get all pool data
   */
  getAllPoolData() {
    const result = {
      candlesByPool: this.candlesByPool,
      poolIds: Object.keys(this.candlesByPool).sort(),
      stats: this.stats,
      connectionStatus: this.connectionStatus,
      isSubscribed: this.isSubscribed,
      currentInterval: this.intervalFilter,
      totalPools: Object.keys(this.candlesByPool).length
    };
    
    console.log(`📦 getAllPoolData called - returning:`, {
      poolCount: result.poolIds.length,
      statsData: result.stats,
      connectionStatus: result.connectionStatus,
      isSubscribed: result.isSubscribed,
      interval: result.currentInterval
    });
    
    return result;
  }

  /**
   * Get data for specific pool
   */
  getPoolData(poolKey) {
    return this.candlesByPool[poolKey] || { candles: [], count: 0 };
  }

  /**
   * Get current statistics
   */
  getStats() {
    return {
      ...this.stats,
      poolCount: Object.keys(this.candlesByPool).length,
      connectionStatus: this.connectionStatus,
      isSubscribed: this.isSubscribed
    };
  }

  /**
   * Clear all pool data
   */
  clearAllPools() {
    this.candlesByPool = {};
    this.stats = {
      totalCandles: 0,
      newCandlesCount: 0,
      lastCandleTime: null,
      updatesReceived: 0,
      totalPools: 0
    };
    console.log('🧹 All pool candles data cleared');
  }

  /**
   * Clear specific pool data
   */
  clearPool(poolKey) {
    if (this.candlesByPool[poolKey]) {
      delete this.candlesByPool[poolKey];
      console.log(`🧹 Pool ${poolKey} data cleared`);
    }
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalCandles: 0,
      newCandlesCount: 0,
      lastCandleTime: null,
      updatesReceived: 0,
      totalPools: Object.keys(this.candlesByPool).length
    };
    console.log('📊 Pool candles stats reset');
  }

  /**
   * Reset new candles counter only
   */
  resetNewCandlesCount() {
    this.stats.newCandlesCount = 0;
    console.log('🔄 New candles count reset');
  }
}

export default PoolCandlesRealtimeStrategy; 