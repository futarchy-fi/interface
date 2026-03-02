/**
 * Express Balancer Candle Server
 * API for serving pre-indexed hourly candles
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const { getCandles, getLatestCandle, getAllIndexerStates, getCandleCounts } = require('./db');
const { indexPreset, indexAll } = require('./indexer');
const { PRESETS } = require('../config/presets');

const app = express();
const PORT = process.env.PORT || 3456;
const INDEX_INTERVAL = parseInt(process.env.INDEX_INTERVAL_MINUTES || '5') * 60 * 1000;

// Middleware
app.use(cors()); // Allow all origins
app.use(express.json());

// ============================================================
// ROUTES
// ============================================================

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
    try {
        const states = getAllIndexerStates();
        const candleCounts = getCandleCounts();

        const presets = {};
        for (const [preset, state] of Object.entries(states)) {
            presets[preset] = {
                status: state.status || 'unknown',
                lastIndexed: state.lastIndexedTimestamp
                    ? new Date(state.lastIndexedTimestamp * 1000).toISOString()
                    : null,
                lastRun: state.lastRunAt
                    ? new Date(state.lastRunAt).toISOString()
                    : null,
                totalSwaps: state.totalSwaps || 0
            };

            if (candleCounts[preset]) {
                presets[preset].candleCount = candleCounts[preset].count;
                presets[preset].earliest = new Date(candleCounts[preset].earliest * 1000).toISOString();
                presets[preset].latest = new Date(candleCounts[preset].latest * 1000).toISOString();
            }
        }

        res.json({
            status: 'ok',
            server: 'express-server-balancer',
            port: PORT,
            uptime: process.uptime(),
            indexIntervalMs: INDEX_INTERVAL,
            presets
        });
    } catch (err) {
        res.status(500).json({ status: 'error', error: err.message });
    }
});

/**
 * List available presets
 */
app.get('/presets', (req, res) => {
    const list = Object.entries(PRESETS).map(([key, preset]) => ({
        key,
        name: preset.name,
        description: preset.description,
        hops: preset.hops.length
    }));

    res.json({ presets: list });
});

/**
 * Get candles for a preset
 */
app.get('/candles/:preset', (req, res) => {
    try {
        const { preset } = req.params;

        if (!PRESETS[preset]) {
            return res.status(404).json({ error: `Unknown preset: ${preset}` });
        }

        const now = Math.floor(Date.now() / 1000);
        const from = parseInt(req.query.from) || (now - 7 * 24 * 60 * 60);
        const to = parseInt(req.query.to) || now;
        const fill = req.query.fill !== 'false';

        let candles = getCandles(preset, from, to);

        // Optional: fill gaps
        if (fill && candles.length > 0) {
            const filled = [];
            let lastCandle = candles[0];
            filled.push(lastCandle);

            for (let i = 1; i < candles.length; i++) {
                const current = candles[i];
                let expected = lastCandle.time + 3600;

                while (expected < current.time) {
                    filled.push({
                        time: expected,
                        open: lastCandle.close,
                        high: lastCandle.close,
                        low: lastCandle.close,
                        close: lastCandle.close,
                        swapCount: 0
                    });
                    expected += 3600;
                }

                filled.push(current);
                lastCandle = current;
            }

            candles = filled;
        }

        const latestPrice = candles.length > 0 ? candles[candles.length - 1].close : null;

        res.json({
            preset,
            name: PRESETS[preset].name,
            from: new Date(from * 1000).toISOString(),
            to: new Date(to * 1000).toISOString(),
            count: candles.length,
            latestPrice,
            candles
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * Get latest price for a preset
 */
app.get('/price/:preset', (req, res) => {
    try {
        const { preset } = req.params;

        if (!PRESETS[preset]) {
            return res.status(404).json({ error: `Unknown preset: ${preset}` });
        }

        const latest = getLatestCandle(preset);

        if (!latest) {
            return res.status(404).json({ error: 'No candle data available' });
        }

        res.json({
            preset,
            name: PRESETS[preset].name,
            price: latest.close,
            timestamp: new Date(latest.time * 1000).toISOString()
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * Trigger re-index
 */
app.post('/index/:preset', async (req, res) => {
    try {
        const { preset } = req.params;

        if (preset === 'all') {
            res.json({ status: 'started', message: 'Indexing all presets...' });
            indexAll().catch(console.error);
        } else if (PRESETS[preset]) {
            res.json({ status: 'started', message: `Indexing ${preset}...` });
            indexPreset(preset).catch(console.error);
        } else {
            res.status(404).json({ error: `Unknown preset: ${preset}` });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// STARTUP
// ============================================================

console.log('🚀 Balancer Candle Server starting...');
console.log(`   Port: ${PORT}`);
console.log(`   Index interval: ${INDEX_INTERVAL / 1000}s`);

// Start server FIRST, then index in background
const server = app.listen(PORT, () => {
    console.log(`\n🌐 Server listening on http://localhost:${PORT}`);
    console.log(`\n📚 Endpoints:`);
    console.log(`   GET  /health              - Server status`);
    console.log(`   GET  /presets             - List presets`);
    console.log(`   GET  /candles/:preset     - Get hourly candles`);
    console.log(`   GET  /price/:preset       - Get latest price`);
    console.log(`   POST /index/:preset       - Trigger re-index`);

    // Run initial index AFTER server is listening
    console.log('\n⏳ Starting initial indexing...');
    indexAll().then(() => {
        console.log('✅ Initial indexing complete');
    }).catch(err => {
        console.log('⚠️ Initial indexing error:', err.message);
    });
});

// Schedule periodic re-indexing
setInterval(() => {
    console.log(`\n⏰ Scheduled re-index starting...`);
    indexAll().catch(err => {
        console.log('⚠️ Scheduled indexing error:', err.message);
    });
}, INDEX_INTERVAL);
