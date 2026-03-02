# Spot Price Server (with SQLite Cache)

GNO/sDAI prices with **SQLite caching** and **cron sync**.

## Architecture

```
┌──────────────────┐     ┌──────────────────┐     ┌────────────────┐
│  The Graph       │ ──▶ │  SQLite Cache    │ ──▶ │  API Response  │
│  (every 1 min)   │     │  (candles table) │     │  (~5ms)        │
└──────────────────┘     └──────────────────┘     └────────────────┘
```

## Quick Start

```bash
cd spot-server
npm install
npm start
```

Server runs at `http://localhost:3456`

## How It Works

1. **Startup**: Initializes database, backfills any missing data
2. **Cron Job**: Every 1 minute, fetches new swaps from subgraph
3. **API**: Reads from cache for fast response (~5ms)
4. **Gap Recovery**: Automatically detects and backfills gaps

## Key Endpoints

| Endpoint | Response Time | Description |
|----------|---------------|-------------|
| `GET /candles?pool=GNO_SDAI` | ~5ms | Candles from cache |
| `GET /sync-status` | instant | Database sync status |
| `GET /gno-sdai-price` | ~500ms | Live price (direct) |
| `GET /agno-rate` | ~100ms | aGNO→GNO rate |

## Why Caching?

| Aspect | Direct Query | Cached |
|--------|-------------|--------|
| Response | ~500-1000ms | ~5ms |
| Subgraph hits | Every request | Every 1 min |
| Offline | ❌ Fails | ✅ Serves cache |

## Database Files

- `db/schema.sql` - Table definitions
- `db/database.js` - Connection helpers
- `db/data.sqlite` - Database file (auto-created, gitignored)
- `sync/syncCandles.js` - Cron job logic

## CLI Commands

```bash
# Run server with cron
npm start

# Manual sync once
node sync/syncCandles.js once

# Backfill all history
node sync/syncCandles.js backfill
```
