// Supabase Configuration
export const SUPABASE_CONFIG = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://nvhqdqtlsdboctqjcelq.supabase.co',
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52aHFkcXRsc2Rib2N0cWpjZWxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIxNDU3ODEsImV4cCI6MjA1NzcyMTc4MX0.6kjpxGVqSQNMz3DqycuNPv_ug8sdBNKeJsN0Z3X7oLg',
};

// Edge Function Endpoints
export const SUPABASE_FUNCTIONS = {
  companyInfo: '/functions/v1/company-info',
};

// Default Values
export const DEFAULT_COMPANY_ID = 9;

// Company Info Status
export const COMPANY_INFO_STATUS = {
  IDLE: 'idle',
  LOADING: 'loading', 
  SUCCESS: 'success',
  ERROR: 'error'
};

// Realtime Configuration
export const REALTIME_CONFIG = {
  // Connection status constants
  CONNECTION_STATUS: {
    DISCONNECTED: 'disconnected',
    CONNECTING: 'connecting',
    CONNECTED: 'connected',
    LIVE: 'live',
    ERROR: 'error',
    NO_ADDRESS: 'no_address'
  },
  
  // Event types
  EVENT_TYPES: {
    INSERT: 'INSERT',
    UPDATE: 'UPDATE',
    DELETE: 'DELETE',
    ALL: '*'
  },
  
  // Default options
  DEFAULT_OPTIONS: {
    maxRecords: 10,
    retryAttempts: 3,
    reconnectDelay: 1000
  }
};

// Table Configurations for Realtime
export const REALTIME_TABLES = {
  TRADE_HISTORY: {
    name: 'trade_history',
    keyField: 'id',
    timestampField: 'evt_block_time',
    sortField: 'evt_block_time',
    allowedFilters: ['user_address', 'proposal_id']
  },
  
  POOL_CANDLES: {
    name: 'pool_candles',
    keyField: 'id',
    timestampField: 'timestamp',
    sortField: 'timestamp',
    allowedFilters: ['interval', 'address', 'pool_interval_id']
  },
  
  MARKET_EVENTS: {
    name: 'market_event',
    keyField: 'id',
    timestampField: 'created_at',
    sortField: 'created_at',
    allowedFilters: ['company_id']
  },
  
  USERS: {
    name: 'users',
    keyField: 'id',
    timestampField: 'created_at',
    sortField: 'created_at',
    allowedFilters: []
  }
};

// Pool Addresses for Pool Candles
export const ALLOWED_POOL_ADDRESSES = [
  '0xF336F812Db1ad142F22A9A4dd43D40e64B478361', // YES pool
  '0xfbf1BE5CE2f9056dAaB1C368EC241ad7Be3507A8'  // NO pool
]; 