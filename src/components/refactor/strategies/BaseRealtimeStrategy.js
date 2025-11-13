import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG, REALTIME_CONFIG } from '../constants/supabase';

/**
 * Base Realtime Strategy Class
 * Abstract class that defines the interface for all realtime strategies
 * Provides common functionality for Supabase realtime subscriptions
 */
export class BaseRealtimeStrategy {
  constructor(tableConfig, options = {}) {
    if (this.constructor === BaseRealtimeStrategy) {
      throw new Error('BaseRealtimeStrategy cannot be instantiated directly');
    }
    
    this.tableConfig = tableConfig;
    this.options = { ...REALTIME_CONFIG.DEFAULT_OPTIONS, ...options };
    
    // Debug Supabase configuration
    console.log(`🔧 Initializing Supabase client with:`, {
      url: SUPABASE_CONFIG.url,
      anonKeyLength: SUPABASE_CONFIG.anonKey ? SUPABASE_CONFIG.anonKey.length : 0,
      anonKeyPreview: SUPABASE_CONFIG.anonKey ? `${SUPABASE_CONFIG.anonKey.substring(0, 20)}...` : 'MISSING'
    });
    
    this.supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
    
    // Verify client was created
    if (!this.supabase) {
      throw new Error('Failed to create Supabase client');
    }
    
    console.log(`✅ Supabase client created successfully for table: ${tableConfig.name}`);
    
    // State
    this.channel = null;
    this.isSubscribed = false;
    this.connectionStatus = REALTIME_CONFIG.CONNECTION_STATUS.DISCONNECTED;
    this.lastError = null;
    this.retryCount = 0;
    
    // Callbacks
    this.callbacks = {
      onConnect: null,
      onDisconnect: null,
      onError: null,
      onDataUpdate: null,
      onStatusChange: null
    };
    
    console.log(`🏗️ BaseRealtimeStrategy initialized for table: ${tableConfig.name}`);
  }

  /**
   * Abstract methods that must be implemented by subclasses
   */
  
  // Process incoming realtime data - must be implemented by subclasses
  processRealtimeUpdate(payload) {
    throw new Error('processRealtimeUpdate must be implemented by subclass');
  }
  
  // Generate channel name - can be overridden by subclasses
  generateChannelName(filters = {}) {
    const filterKeys = Object.keys(filters).join('-');
    return `${this.tableConfig.name}-${filterKeys}-${Date.now()}`;
  }
  
  // Validate filters - can be overridden by subclasses
  validateFilters(filters = {}) {
    const filterKeys = Object.keys(filters);
    const allowedFilters = this.tableConfig.allowedFilters;
    
    for (const key of filterKeys) {
      if (!allowedFilters.includes(key)) {
        throw new Error(`Filter '${key}' is not allowed for table '${this.tableConfig.name}'. Allowed filters: ${allowedFilters.join(', ')}`);
      }
    }
    
    return true;
  }

  /**
   * Common realtime functionality
   */
  
  // Set up callbacks
  setCallbacks(callbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
    console.log(`📞 Callbacks set for ${this.tableConfig.name} strategy`);
  }
  
  // Update connection status and notify
  updateConnectionStatus(status, error = null) {
    const oldStatus = this.connectionStatus;
    this.connectionStatus = status;
    this.lastError = error;
    
    console.log(`📡 ${this.tableConfig.name} connection status: ${oldStatus} → ${status}`);
    
    if (this.callbacks.onStatusChange) {
      this.callbacks.onStatusChange(status, oldStatus, error);
    }
  }
  
  // Create the realtime subscription
  subscribe(filters = {}, events = [REALTIME_CONFIG.EVENT_TYPES.ALL]) {
    try {
      // Validate inputs
      this.validateFilters(filters);
      
      if (this.channel) {
        console.log(`⚠️ Already subscribed to ${this.tableConfig.name}, cleaning up first`);
        this.unsubscribe();
      }
      
      this.updateConnectionStatus(REALTIME_CONFIG.CONNECTION_STATUS.CONNECTING);
      
      // Generate filter string for Supabase
      const filterString = this.buildFilterString(filters);
      const channelName = this.generateChannelName(filters);
      
      console.log(`🚀 Setting up realtime subscription for ${this.tableConfig.name}`);
      console.log(`📋 Channel: ${channelName}`);
      console.log(`📋 Filters: ${filterString || 'none'}`);
      console.log(`📋 Events: ${events.join(', ')}`);
      
      // Create channel
      this.channel = this.supabase.channel(channelName);
      
      // Add postgres changes listener
      this.channel.on(
        'postgres_changes',
        {
          event: events.length === 1 ? events[0] : '*',
          schema: 'public',
          table: this.tableConfig.name,
          ...(filterString && { filter: filterString })
        },
        (payload) => {
          console.log(`🔥 ${this.tableConfig.name} realtime update:`, payload.eventType);
          this.handleRealtimePayload(payload);
        }
      );
      
      // Add connection event listeners
      this.channel
        .on('presence', { event: 'sync' }, () => {
          console.log(`✅ ${this.tableConfig.name} presence synced`);
          this.updateConnectionStatus(REALTIME_CONFIG.CONNECTION_STATUS.CONNECTED);
          if (this.callbacks.onConnect) {
            this.callbacks.onConnect();
          }
        })
        .on('error', (error) => {
          console.error(`❌ ${this.tableConfig.name} realtime error:`, error);
          this.updateConnectionStatus(REALTIME_CONFIG.CONNECTION_STATUS.ERROR, error);
          if (this.callbacks.onError) {
            this.callbacks.onError(error);
          }
        });
      
      // Subscribe to the channel
      this.channel.subscribe((status, error) => {
        console.log(`📡 ${this.tableConfig.name} subscription status:`, status);
        
        if (error) {
          console.error(`❌ ${this.tableConfig.name} subscription error:`, error);
          this.updateConnectionStatus(REALTIME_CONFIG.CONNECTION_STATUS.ERROR, error);
          return;
        }
        
        if (status === 'SUBSCRIBED') {
          this.isSubscribed = true;
          this.retryCount = 0;
          this.updateConnectionStatus(REALTIME_CONFIG.CONNECTION_STATUS.CONNECTED);
          console.log(`🎉 ${this.tableConfig.name} successfully subscribed!`);
        }
      });
      
      return this.channel;
      
    } catch (error) {
      console.error(`❌ Failed to subscribe to ${this.tableConfig.name}:`, error);
      this.updateConnectionStatus(REALTIME_CONFIG.CONNECTION_STATUS.ERROR, error);
      throw error;
    }
  }
  
  // Unsubscribe from realtime updates
  unsubscribe() {
    if (this.channel) {
      console.log(`🛑 Unsubscribing from ${this.tableConfig.name}`);
      this.supabase.removeChannel(this.channel);
      this.channel = null;
      this.isSubscribed = false;
      this.updateConnectionStatus(REALTIME_CONFIG.CONNECTION_STATUS.DISCONNECTED);
      
      if (this.callbacks.onDisconnect) {
        this.callbacks.onDisconnect();
      }
    }
  }
  
  // Build filter string for Supabase
  buildFilterString(filters) {
    if (!filters || Object.keys(filters).length === 0) {
      return null;
    }
    
    const filterParts = Object.entries(filters).map(([key, value]) => {
      if (Array.isArray(value)) {
        return `${key}=in.(${value.join(',')})`;
      } else {
        return `${key}=eq.${value}`;
      }
    });
    
    return filterParts.join('.');
  }
  
  // Handle incoming realtime payload
  handleRealtimePayload(payload) {
    try {
      // Update status to live when we receive data
      if (this.connectionStatus !== REALTIME_CONFIG.CONNECTION_STATUS.LIVE) {
        this.updateConnectionStatus(REALTIME_CONFIG.CONNECTION_STATUS.LIVE);
      }
      
      // Let the specific strategy process the update
      const processedData = this.processRealtimeUpdate(payload);
      
      // Notify callbacks
      if (this.callbacks.onDataUpdate) {
        this.callbacks.onDataUpdate(processedData, payload);
      }
      
      return processedData;
      
    } catch (error) {
      console.error(`❌ Error processing ${this.tableConfig.name} realtime update:`, error);
      this.updateConnectionStatus(REALTIME_CONFIG.CONNECTION_STATUS.ERROR, error);
      
      if (this.callbacks.onError) {
        this.callbacks.onError(error);
      }
    }
  }
  
  // Get current status
  getStatus() {
    return {
      isSubscribed: this.isSubscribed,
      connectionStatus: this.connectionStatus,
      lastError: this.lastError,
      retryCount: this.retryCount,
      channelExists: !!this.channel,
      tableName: this.tableConfig.name
    };
  }
  
  // Retry connection
  async retry() {
    if (this.retryCount >= this.options.retryAttempts) {
      console.error(`❌ Max retry attempts reached for ${this.tableConfig.name}`);
      return false;
    }
    
    this.retryCount++;
    console.log(`🔄 Retry attempt ${this.retryCount}/${this.options.retryAttempts} for ${this.tableConfig.name}`);
    
    // Wait before retrying
    await new Promise(resolve => setTimeout(resolve, this.options.reconnectDelay));
    
    try {
      // This would need to be called with the original filters
      // Implementation depends on how the specific strategy wants to handle retries
      return true;
    } catch (error) {
      console.error(`❌ Retry failed for ${this.tableConfig.name}:`, error);
      return false;
    }
  }
}

export default BaseRealtimeStrategy; 