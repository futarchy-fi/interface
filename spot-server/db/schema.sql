-- Candles table for hourly price data
CREATE TABLE IF NOT EXISTS candles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pool_address TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    open REAL,
    high REAL,
    low REAL,
    close REAL,
    volume_usd REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(pool_address, timestamp)
);

-- Index for fast queries by pool and time
CREATE INDEX IF NOT EXISTS idx_candles_pool_timestamp 
ON candles(pool_address, timestamp DESC);

-- Sync status tracking
CREATE TABLE IF NOT EXISTS sync_status (
    pool_address TEXT PRIMARY KEY,
    last_sync_timestamp INTEGER,
    last_sync_at DATETIME,
    status TEXT DEFAULT 'pending'  -- 'synced', 'syncing', 'error', 'pending'
);

-- Rates history (aGNO, sDAI conversion rates)
CREATE TABLE IF NOT EXISTS rates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rate_type TEXT NOT NULL,  -- 'agno', 'sdai'
    rate REAL NOT NULL,
    timestamp INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for rate lookups
CREATE INDEX IF NOT EXISTS idx_rates_type_timestamp 
ON rates(rate_type, timestamp DESC);
