import { BaseRealtimeStrategy } from './BaseRealtimeStrategy';
import { REALTIME_TABLES, REALTIME_CONFIG } from '../constants/supabase';

/**
 * Trade History Realtime Strategy
 * Handles realtime subscriptions for the trade_history table
 * Filters by user address and proposal ID
 */
export class TradeHistoryRealtimeStrategy extends BaseRealtimeStrategy {
  constructor(options = {}) {
    super(REALTIME_TABLES.TRADE_HISTORY, options);
    
    // Trade history specific state
    this.trades = []; // Store actual trade data
    this.proposalIdFilter = null; // Store proposal ID for client-side filtering
    this.stats = {
      totalTrades: 0,
      newTradesCount: 0,
      lastTradeTime: null,
      updatesReceived: 0
    };
    
    console.log('📈 TradeHistoryRealtimeStrategy initialized');
  }

  /**
   * Generate channel name specific to trade history
   * Include wallet address in channel name for uniqueness
   */
  generateChannelName(filters = {}) {
    const { user_address } = filters;
    const addressSuffix = user_address ? user_address.slice(-6) : 'unknown';
    return `trades-${addressSuffix}-${Date.now()}`;
  }

  /**
   * Validate trade history specific filters
   */
  validateFilters(filters = {}) {
    super.validateFilters(filters);
    
    // Require user_address for trade history
    if (!filters.user_address) {
      throw new Error('user_address filter is required for trade history subscriptions');
    }
    
    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(filters.user_address)) {
      throw new Error('user_address must be a valid Ethereum address');
    }
    
    return true;
  }

  /**
   * Fetch initial trade history data before subscribing to realtime
   */
  async fetchInitialData(userAddress, proposalId = '0xDA36a35CA4Fe6214C37a452159C0C9EAd45D5919') {
    try {
      console.log(`🔍 Fetching initial trade history for: ${userAddress}`);
      console.log(`🔍 Proposal ID: ${proposalId}`);
      console.log(`🔍 Supabase URL: ${this.supabase.supabaseUrl}`);
      console.log(`🔍 Using lowercase address: ${userAddress.toLowerCase()}`);
      
      const { data, error, count } = await this.supabase
        .from('trade_history')
        .select('*', { count: 'exact' })
        .eq('user_address', userAddress.toLowerCase())
        .eq('proposal_id', proposalId)
        .order('evt_block_time', { ascending: false });
      
      if (error) {
        console.error('❌ Supabase query error:', error);
        console.error('❌ Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }
      
      console.log(`✅ Initial trade history fetched: ${data.length} trades`);
      console.log(`📊 Total count from database: ${count}`);
      console.log(`📋 Sample data:`, data[0]);
      
      // Store the trades and update stats
      console.log(`🔄 Before storing trades - current trades length: ${this.trades.length}`);
      this.trades = data || [];
      console.log(`🔄 After storing trades - new trades length: ${this.trades.length}`);
      console.log(`🔄 First trade stored:`, this.trades[0]);
      
      this.stats = {
        totalTrades: count || data.length,
        newTradesCount: 0,
        lastTradeTime: data.length > 0 ? data[0].evt_block_time : null,
        updatesReceived: 0
      };
      
      console.log(`📊 Updated stats:`, this.stats);
      
      // Notify callbacks with initial data
      if (this.callbacks.onDataUpdate) {
        console.log(`📞 Calling onDataUpdate callback`);
        this.callbacks.onDataUpdate({
          action: 'INITIAL_FETCH',
          trades: this.trades,
          stats: this.stats
        }, null);
      } else {
        console.log(`⚠️ No onDataUpdate callback set`);
      }
      
      return data;
      
    } catch (error) {
      console.error('❌ Failed to fetch initial trade history:', error);
      console.error('❌ Full error object:', JSON.stringify(error, null, 2));
      this.updateConnectionStatus(REALTIME_CONFIG.CONNECTION_STATUS.ERROR, error);
      throw error;
    }
  }

  /**
   * Process trade history realtime updates
   * Handles INSERT, UPDATE, DELETE events and updates the local trades array
   */
  processRealtimeUpdate(payload) {
    const { eventType, new: newData, old: oldData } = payload;
    
    console.log(`📈 Processing trade history ${eventType}:`, {
      eventType,
      newTradeId: newData?.id,
      oldTradeId: oldData?.id,
      userAddress: newData?.user_address || oldData?.user_address,
      proposalId: newData?.proposal_id || oldData?.proposal_id
    });

    // Client-side proposal ID filtering (like original SupabaseComponent)
    const proposalMatches = (data) => {
      if (!this.proposalIdFilter || !data) return true;
      return data.proposal_id === this.proposalIdFilter;
    };

    // Check if this update should be processed based on proposal ID
    if (eventType === 'INSERT' && newData && !proposalMatches(newData)) {
      console.log(`⏭️ Skipping INSERT - proposal ID ${newData.proposal_id} doesn't match filter ${this.proposalIdFilter}`);
      return null;
    }
    
    if (eventType === 'UPDATE' && newData && !proposalMatches(newData)) {
      console.log(`⏭️ Skipping UPDATE - proposal ID ${newData.proposal_id} doesn't match filter ${this.proposalIdFilter}`);
      return null;
    }

    if (eventType === 'DELETE' && oldData && !proposalMatches(oldData)) {
      console.log(`⏭️ Skipping DELETE - proposal ID ${oldData.proposal_id} doesn't match filter ${this.proposalIdFilter}`);
      return null;
    }

    this.stats.updatesReceived++;

    const processedUpdate = {
      eventType,
      newData,
      oldData,
      timestamp: new Date().toISOString(),
      processingInfo: {
        strategy: 'TradeHistoryRealtime',
        updateCount: this.stats.updatesReceived,
        proposalFilter: this.proposalIdFilter
      }
    };

    // Update trades array and stats based on event type
    switch (eventType) {
      case REALTIME_CONFIG.EVENT_TYPES.INSERT:
        if (newData) {
          // Add new trade to the beginning of the array
          this.trades = [newData, ...this.trades];
          this.stats.totalTrades++;
          this.stats.newTradesCount++;
          this.stats.lastTradeTime = newData.evt_block_time;
          
          processedUpdate.action = 'ADD_TRADE';
          processedUpdate.tradeData = this.formatTradeData(newData);
          processedUpdate.trades = this.trades;
          processedUpdate.stats = this.stats;
          
          console.log(`➕ New trade added: ID ${newData.id}, Total: ${this.stats.totalTrades}`);
        }
        break;

      case REALTIME_CONFIG.EVENT_TYPES.UPDATE:
        if (newData) {
          // Update existing trade in the array
          this.trades = this.trades.map(trade => 
            trade.id === newData.id ? newData : trade
          );
          this.stats.lastTradeTime = newData.evt_block_time;
          
          processedUpdate.action = 'UPDATE_TRADE';
          processedUpdate.tradeData = this.formatTradeData(newData);
          processedUpdate.changes = this.getTradeChanges(oldData, newData);
          processedUpdate.trades = this.trades;
          processedUpdate.stats = this.stats;
          
          console.log(`✏️ Trade updated: ID ${newData.id}`);
        }
        break;

      case REALTIME_CONFIG.EVENT_TYPES.DELETE:
        if (oldData) {
          // Remove trade from the array
          this.trades = this.trades.filter(trade => trade.id !== oldData.id);
          this.stats.totalTrades = Math.max(0, this.stats.totalTrades - 1);
          
          processedUpdate.action = 'REMOVE_TRADE';
          processedUpdate.tradeData = this.formatTradeData(oldData);
          processedUpdate.trades = this.trades;
          processedUpdate.stats = this.stats;
          
          console.log(`🗑️ Trade deleted: ID ${oldData.id}, Total: ${this.stats.totalTrades}`);
        }
        break;

      default:
        console.warn(`⚠️ Unknown event type: ${eventType}`);
        processedUpdate.action = 'UNKNOWN';
    }

    return processedUpdate;
  }

  /**
   * Format trade data for consistency
   */
  formatTradeData(tradeData) {
    if (!tradeData) return null;

    return {
      id: tradeData.id,
      userAddress: tradeData.user_address,
      proposalId: tradeData.proposal_id,
      amount0: tradeData.amount0,
      amount1: tradeData.amount1,
      poolId: tradeData.pool_id,
      blockNumber: tradeData.evt_block_number,
      blockTime: tradeData.evt_block_time,
      txHash: tradeData.evt_tx_hash,
      token0: tradeData.token0,
      token1: tradeData.token1,
      formattedTime: new Date(tradeData.evt_block_time).toLocaleString(),
      // Add derived fields
      tradeValue: this.calculateTradeValue(tradeData),
      tradeDirection: this.getTradeDirection(tradeData)
    };
  }

  /**
   * Calculate trade value (simplified)
   */
  calculateTradeValue(tradeData) {
    try {
      const amount0 = Math.abs(parseFloat(tradeData.amount0) || 0);
      const amount1 = Math.abs(parseFloat(tradeData.amount1) || 0);
      return Math.max(amount0, amount1);
    } catch (error) {
      console.warn('Failed to calculate trade value:', error);
      return 0;
    }
  }

  /**
   * Determine trade direction (buy/sell)
   */
  getTradeDirection(tradeData) {
    try {
      const amount0 = parseFloat(tradeData.amount0) || 0;
      const amount1 = parseFloat(tradeData.amount1) || 0;
      
      if (amount0 > 0 && amount1 < 0) return 'BUY';
      if (amount0 < 0 && amount1 > 0) return 'SELL';
      return 'UNKNOWN';
    } catch (error) {
      console.warn('Failed to determine trade direction:', error);
      return 'UNKNOWN';
    }
  }

  /**
   * Get changes between old and new trade data
   */
  getTradeChanges(oldData, newData) {
    if (!oldData || !newData) return {};

    const changes = {};
    const fieldsToCheck = ['amount0', 'amount1', 'evt_block_time', 'evt_tx_hash'];

    fieldsToCheck.forEach(field => {
      if (oldData[field] !== newData[field]) {
        changes[field] = {
          from: oldData[field],
          to: newData[field]
        };
      }
    });

    return changes;
  }

  /**
   * Subscribe to trade history with user address filter (includes initial fetch)
   */
  async subscribeToUserTrades(userAddress, proposalId = '0xDA36a35CA4Fe6214C37a452159C0C9EAd45D5919') {
    console.log(`📈 Starting full subscription for user: ${userAddress}`);
    console.log(`📈 Current trades array length before fetch: ${this.trades.length}`);
    
    try {
      // First, fetch initial data
      console.log(`📈 About to call fetchInitialData...`);
      await this.fetchInitialData(userAddress, proposalId);
      console.log(`📈 fetchInitialData completed. Trades length now: ${this.trades.length}`);
    } catch (error) {
      console.error(`❌ fetchInitialData failed:`, error);
      throw error;
    }
    
    // Store proposal ID for client-side filtering
    this.proposalIdFilter = proposalId;
    
    // Then subscribe to realtime updates
    // IMPORTANT: Only filter by user_address in realtime subscription (like original SupabaseComponent)
    // Proposal ID filtering will be done client-side in processRealtimeUpdate
    const filters = {
      user_address: userAddress.toLowerCase()
    };

    console.log(`📡 Setting up realtime subscription for: ${userAddress}`);
    console.log(`📋 Realtime filter: user_address only (like original)`);
    console.log(`📋 Client-side proposal filter: ${proposalId}`);

    return this.subscribe(filters);
  }

  /**
   * Get current trades and statistics
   */
  getFullData() {
    const result = {
      trades: this.trades,
      stats: this.stats,
      connectionStatus: this.connectionStatus,
      isSubscribed: this.isSubscribed,
      formattedTrades: this.trades.map(trade => this.formatTradeData(trade))
    };
    
    console.log(`📦 getFullData called - returning:`, {
      tradesLength: result.trades.length,
      statsData: result.stats,
      connectionStatus: result.connectionStatus,
      isSubscribed: result.isSubscribed,
      sampleTrade: result.trades[0]
    });
    
    return result;
  }

  /**
   * Get current statistics (compatible with existing interface)
   */
  getStats() {
    return {
      ...this.stats,
      tradesCount: this.trades.length,
      connectionStatus: this.connectionStatus,
      isSubscribed: this.isSubscribed
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalTrades: 0,
      newTradesCount: 0,
      lastTradeTime: null,
      updatesReceived: 0
    };
    console.log('📊 Trade history stats reset');
  }

  /**
   * Reset new trades counter only
   */
  resetNewTradesCount() {
    this.stats.newTradesCount = 0;
    console.log('🔄 New trades count reset');
  }
}

export default TradeHistoryRealtimeStrategy; 