# Balancer Candle Server

Express server that indexes Balancer V2 swaps and serves pre-built hourly OHLC candles.

## Quick Start

```bash
# Install dependencies
npm install

# Run the server (starts on port 3456)
npm start

# Or with auto-reload
npm run dev
```

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Server status and indexer state |
| `/presets` | GET | List available presets |
| `/candles/:preset` | GET | Get hourly candles |
| `/price/:preset` | GET | Get latest price only |
| `/index/:preset` | POST | Trigger manual re-index |

## Query Parameters for `/candles/:preset`

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `from` | Unix timestamp | 7 days ago | Start of time range |
| `to` | Unix timestamp | now | End of time range |
| `fill` | boolean | true | Fill gaps with previous close |

## Example Usage

```bash
# Get candles for GNO/sDAI
curl http://localhost:3456/candles/GNO_SDAI

# Get candles for last 24 hours
curl "http://localhost:3456/candles/GNO_SDAI?from=$(date -d '24 hours ago' +%s)"

# Get latest price only
curl http://localhost:3456/price/GNO_SDAI

# Check server health
curl http://localhost:3456/health
```

## Frontend Integration

Use `balancerClient.js` in the frontend:

```javascript
import { fetchBalancerCandles, checkBalancerHealth } from '@/lib/clients/balancerClient';

// Check if server is running
const health = await checkBalancerHealth();
if (!health.ok) {
  console.warn('Balancer server not available');
}

// Fetch candles
const { candles, price, error } = await fetchBalancerCandles('GNO_SDAI', {
  from: Math.floor(Date.now() / 1000) - 86400 * 7 // 7 days
});
```

## MarketPageShowcase Configuration

```javascript
// In PROPOSAL_DEFAULTS or proposalConfigs
'0x45e1064348fD8A407D6D1F59Fc64B05F633cEfc1': {
  useSpotPrice: 'balancer::GNO_SDAI',
  // ...
}
```

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│  Balancer V2    │────▶│  Express Server  │────▶│  Frontend   │
│  Subgraph       │     │  (indexer.js)    │     │  (client)   │
└─────────────────┘     └──────────────────┘     └─────────────┘
                               │
                               ▼
                        ┌─────────────┐
                        │   SQLite    │
                        │  candles.db │
                        └─────────────┘
```

## Presets

Presets define multihop paths for composite prices:

- `GNO_SDAI`: GNO → WXDAI → USDC → sDAI (3 hops)

Add new presets in `config/presets.js`.
