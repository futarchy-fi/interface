/**
 * Database Connection and Helpers
 * Uses better-sqlite3 for synchronous, fast SQLite operations
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// Database file path
const DB_PATH = path.join(__dirname, 'data.sqlite');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

let db = null;

/**
 * Initialize the database connection and apply schema
 */
function initDatabase() {
    if (db) return db;

    // Create database (creates file if not exists)
    db = new Database(DB_PATH);

    // Enable WAL mode for better concurrent performance
    db.pragma('journal_mode = WAL');

    // Apply schema
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
    db.exec(schema);

    console.log('[DB] Database initialized at', DB_PATH);

    return db;
}

/**
 * Get database instance
 */
function getDb() {
    if (!db) {
        return initDatabase();
    }
    return db;
}

// ============================================================
// CANDLES OPERATIONS
// ============================================================

/**
 * Insert or update candles (upsert)
 */
function upsertCandles(poolAddress, candles) {
    const db = getDb();

    const stmt = db.prepare(`
        INSERT INTO candles (pool_address, timestamp, open, high, low, close, volume_usd)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(pool_address, timestamp) 
        DO UPDATE SET
            high = MAX(candles.high, excluded.high),
            low = MIN(candles.low, excluded.low),
            close = excluded.close,
            volume_usd = excluded.volume_usd
    `);

    const insertMany = db.transaction((candles) => {
        for (const c of candles) {
            stmt.run(
                poolAddress,
                c.time,
                c.open || c.value,
                c.high || c.value,
                c.low || c.value,
                c.close || c.value,
                c.volumeUSD || 0
            );
        }
    });

    insertMany(candles);
    return candles.length;
}

/**
 * Get candles for a pool
 */
function getCandles(poolAddress, limit = 500) {
    const db = getDb();

    const stmt = db.prepare(`
        SELECT timestamp as time, open, high, low, close, volume_usd as volumeUSD
        FROM candles
        WHERE pool_address = ?
        ORDER BY timestamp ASC
        LIMIT ?
    `);

    return stmt.all(poolAddress, limit);
}

/**
 * Get latest candle timestamp for a pool
 */
function getLatestCandleTimestamp(poolAddress) {
    const db = getDb();

    const stmt = db.prepare(`
        SELECT MAX(timestamp) as latest
        FROM candles
        WHERE pool_address = ?
    `);

    const result = stmt.get(poolAddress);
    return result?.latest || 0;
}

/**
 * Get candle count for a pool
 */
function getCandleCount(poolAddress) {
    const db = getDb();

    const stmt = db.prepare(`
        SELECT COUNT(*) as count
        FROM candles
        WHERE pool_address = ?
    `);

    return stmt.get(poolAddress)?.count || 0;
}

// ============================================================
// SYNC STATUS OPERATIONS
// ============================================================

/**
 * Update sync status for a pool
 */
function updateSyncStatus(poolAddress, status, timestamp = null) {
    const db = getDb();

    const stmt = db.prepare(`
        INSERT INTO sync_status (pool_address, last_sync_timestamp, last_sync_at, status)
        VALUES (?, ?, datetime('now'), ?)
        ON CONFLICT(pool_address) 
        DO UPDATE SET
            last_sync_timestamp = COALESCE(excluded.last_sync_timestamp, sync_status.last_sync_timestamp),
            last_sync_at = datetime('now'),
            status = excluded.status
    `);

    stmt.run(poolAddress, timestamp, status);
}

/**
 * Get sync status for a pool
 */
function getSyncStatus(poolAddress) {
    const db = getDb();

    const stmt = db.prepare(`
        SELECT * FROM sync_status WHERE pool_address = ?
    `);

    return stmt.get(poolAddress);
}

/**
 * Get all sync statuses
 */
function getAllSyncStatus() {
    const db = getDb();
    return db.prepare('SELECT * FROM sync_status').all();
}

// ============================================================
// RATES OPERATIONS
// ============================================================

/**
 * Insert a rate
 */
function insertRate(rateType, rate, timestamp) {
    const db = getDb();

    const stmt = db.prepare(`
        INSERT INTO rates (rate_type, rate, timestamp)
        VALUES (?, ?, ?)
    `);

    stmt.run(rateType, rate, timestamp);
}

/**
 * Get latest rate of a type
 */
function getLatestRate(rateType) {
    const db = getDb();

    const stmt = db.prepare(`
        SELECT rate, timestamp
        FROM rates
        WHERE rate_type = ?
        ORDER BY timestamp DESC
        LIMIT 1
    `);

    return stmt.get(rateType);
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
    initDatabase,
    getDb,
    // Candles
    upsertCandles,
    getCandles,
    getLatestCandleTimestamp,
    getCandleCount,
    // Sync status
    updateSyncStatus,
    getSyncStatus,
    getAllSyncStatus,
    // Rates
    insertRate,
    getLatestRate,
};
