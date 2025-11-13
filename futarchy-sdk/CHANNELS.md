# Futarchy SDK - Real-time Channels

## Overview

The Channels system provides real-time WebSocket subscriptions for pool candle data via Supabase. It enables live streaming of price updates directly from the database as new candles are inserted.

## Architecture

```
DataLayer
    ↓
BaseChannel (abstract)
    ↓
SupabaseCandlesChannel
    ↓
Supabase WebSocket (wss://)
```

## Features

- **Real-time Updates**: Receive candle data immediately as it's inserted into the database
- **Filtered Subscriptions**: Subscribe to specific pools and intervals
- **Async Generator Pattern**: Modern async iteration for consuming updates
- **Automatic Reconnection**: Built-in Supabase client handles connection resilience
- **Queue Management**: Internal queue bridges callback-based events to async generators

## Usage

### Basic Example

```javascript
import { DataLayer } from './DataLayer.js';
import { createSupabaseCandlesChannel, CANDLES_TOPIC } from './channels/SupabaseCandlesChannel.js';

const dl = new DataLayer();
const channel = createSupabaseCandlesChannel();
dl.registerChannel(channel);

// Subscribe to real-time candles
for await (const event of dl.subscribe(CANDLES_TOPIC, { 
    id: '0xE0717A77a871942076E43226c2474FD20062Ad34',  // Pool address
    interval: '60000'  // 1-minute candles
})) {
    console.log('New candle:', event);
}
```

### Test Script

Run the included test script to verify WebSocket connectivity:

```bash
# Basic test (default pool, 1-hour candles, 30 seconds)
node test-realtime-candles.js

# Custom parameters
node test-realtime-candles.js \
    --id=0xE0717A77a871942076E43226c2474FD20062Ad34 \
    --interval=60000 \
    --seconds=120 \
    --limit=10
```

Parameters:
- `--id`: Pool address to subscribe to
- `--interval`: Candle interval in milliseconds (60000=1m, 3600000=1h, 86400000=1d)
- `--seconds`: Maximum duration to run the test
- `--limit`: Maximum number of updates to receive

## Configuration

### Environment Variables

Create a `.env` file with your Supabase credentials:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
```

The SDK automatically converts HTTPS URLs to WSS for WebSocket connections.

### Supported Intervals

- `60000` - 1 minute
- `3600000` - 1 hour  
- `86400000` - 1 day

## Event Structure

Each event from the subscription follows this structure:

```javascript
{
    status: 'pending',
    step: 'update',
    message: 'New candle received',
    data: {
        address: '0xE0717A77a871942076E43226c2474FD20062Ad34',
        interval: '60000',
        timestamp: 1755710160,
        price: 0.029301
    },
    source: 'SupabaseCandlesChannel'
}
```

### Event Types

1. **Subscription Success**
   ```javascript
   {
       status: 'success',
       step: 'subscribed',
       message: 'Subscribed to pool_candles'
   }
   ```

2. **New Candle Update**
   ```javascript
   {
       status: 'pending',
       step: 'update',
       message: 'New candle received',
       data: { address, interval, timestamp, price }
   }
   ```

3. **Error Events**
   ```javascript
   {
       status: 'error',
       step: 'error',
       message: 'Channel error'
   }
   ```

## Implementation Details

### SupabaseCandlesChannel

Located in `channels/SupabaseCandlesChannel.js`, this class:

1. Extends `BaseChannel` from DataLayer
2. Creates Supabase client with provided credentials
3. Subscribes to `postgres_changes` events on `pool_candles` table
4. Filters by pool address and interval
5. Yields standardized events via async generator

### Database Schema

The channel listens to INSERT events on the `pool_candles` table:

```sql
CREATE TABLE pool_candles (
    address TEXT,
    interval TEXT,
    timestamp BIGINT,
    price NUMERIC,
    -- other fields...
);
```

### Real-time Filtering

- **Server-side**: Filters by pool address using Supabase's `filter` parameter
- **Client-side**: Additional filtering by interval to ensure exact matches

## Verified Working Example

Test performed on 2025-08-20:

```bash
node test-realtime-candles.js \
    --id=0xE0717A77a871942076E43226c2474FD20062Ad34 \
    --interval=60000 \
    --seconds=120
```

**Results:**
- Successfully connected to Supabase WebSocket
- Received multiple 1-minute candles in real-time
- Timestamps confirmed 60-second intervals between updates
- Prices updated as expected

## Troubleshooting

### No Updates Received

1. Verify Supabase credentials in `.env`
2. Check if the pool address exists and has active trading
3. Ensure the interval matches available data
4. Verify network connectivity to Supabase

### Connection Issues

- The Supabase client automatically handles WSS protocol conversion
- Check firewall/proxy settings if behind corporate network
- Verify Supabase project is active and not paused

### Testing Connection

Use the test script with short duration to verify connectivity:

```bash
node test-realtime-candles.js --seconds=10 --limit=1
```

## API Reference

### `createSupabaseCandlesChannel(url?, key?)`

Creates a new Supabase candles channel instance.

**Parameters:**
- `url` (optional): Supabase project URL
- `key` (optional): Supabase anon key

**Returns:** `SupabaseCandlesChannel` instance

### `DataLayer.subscribe(topic, args)`

Subscribes to a channel topic.

**Parameters:**
- `topic`: Channel topic (use `CANDLES_TOPIC` constant)
- `args`: Subscription arguments
  - `id` (required): Pool address
  - `interval` (optional): Candle interval in milliseconds

**Returns:** Async generator yielding events

## Integration with DataLayer

The channel system integrates seamlessly with DataLayer's unified data access pattern:

```javascript
// Register multiple data sources
dl.registerChannel(supabaseChannel);
dl.registerFetcher(customFetcher);

// Subscribe to real-time updates
for await (const event of dl.subscribe(CANDLES_TOPIC, args)) {
    // Handle real-time candles
}

// Fetch historical data
const historical = await dl.fetch('candles.historical', args);
```

## Future Enhancements

- [ ] Support for multiple pool subscriptions
- [ ] Configurable reconnection strategies
- [ ] Event aggregation and buffering
- [ ] Support for other event types (UPDATE, DELETE)
- [ ] WebSocket connection health monitoring
- [ ] Automatic fallback to polling if WebSocket fails