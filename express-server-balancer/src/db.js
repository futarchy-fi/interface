/**
 * Simple JSON File Storage
 * Replaces SQLite for easier Windows compatibility
 */

const fs = require('fs');
const path = require('path');

const DB_DIR = path.join(__dirname, '..', 'db');
const CANDLES_FILE = path.join(DB_DIR, 'candles.json');
const STATE_FILE = path.join(DB_DIR, 'state.json');

// Ensure db directory exists
if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
}

function loadJSON(filepath, defaultVal = {}) {
    try {
        if (fs.existsSync(filepath)) {
            return JSON.parse(fs.readFileSync(filepath, 'utf8'));
        }
    } catch (err) {
        console.log(`⚠️ Error loading ${filepath}: ${err.message}`);
    }
    return defaultVal;
}

function saveJSON(filepath, data) {
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
}

// ============================================================
// CANDLES STORAGE
// ============================================================

/**
 * Get all candles for a preset
 */
function getCandles(preset, from, to) {
    const data = loadJSON(CANDLES_FILE, {});
    const presetCandles = data[preset] || [];

    return presetCandles.filter(c =>
        c.time >= from && c.time <= to
    ).sort((a, b) => a.time - b.time);
}

/**
 * Save candles for a preset
 */
function saveCandles(preset, candles) {
    const data = loadJSON(CANDLES_FILE, {});

    // Merge with existing candles (update by time)
    const existing = data[preset] || [];
    const existingMap = new Map(existing.map(c => [c.time, c]));

    for (const candle of candles) {
        existingMap.set(candle.time, candle);
    }

    data[preset] = Array.from(existingMap.values()).sort((a, b) => a.time - b.time);
    saveJSON(CANDLES_FILE, data);

    return data[preset].length;
}

/**
 * Get latest candle for a preset
 */
function getLatestCandle(preset) {
    const data = loadJSON(CANDLES_FILE, {});
    const presetCandles = data[preset] || [];

    if (presetCandles.length === 0) return null;
    return presetCandles[presetCandles.length - 1];
}

// ============================================================
// INDEXER STATE
// ============================================================

/**
 * Get indexer state for a preset
 */
function getIndexerState(preset) {
    const data = loadJSON(STATE_FILE, {});
    return data[preset] || null;
}

/**
 * Update indexer state
 */
function updateIndexerState(preset, state) {
    const data = loadJSON(STATE_FILE, {});
    data[preset] = {
        ...data[preset],
        ...state,
        lastRunAt: Date.now()
    };
    saveJSON(STATE_FILE, data);
}

/**
 * Get all indexer states
 */
function getAllIndexerStates() {
    return loadJSON(STATE_FILE, {});
}

/**
 * Get candle counts per preset
 */
function getCandleCounts() {
    const data = loadJSON(CANDLES_FILE, {});
    const counts = {};

    for (const [preset, candles] of Object.entries(data)) {
        if (candles.length > 0) {
            counts[preset] = {
                count: candles.length,
                earliest: candles[0].time,
                latest: candles[candles.length - 1].time
            };
        }
    }

    return counts;
}

module.exports = {
    getCandles,
    saveCandles,
    getLatestCandle,
    getIndexerState,
    updateIndexerState,
    getAllIndexerStates,
    getCandleCounts
};
