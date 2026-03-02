# Spot Price Utils - Complete Documentation

## Overview

`spot.js` is a **super generic** CLI tool for fetching spot prices from any DEX pool on any EVM chain.

```
┌─────────────────────────────────────────────────────────────────────┐
│                          spot.js                                    │
│                                                                     │
│   Input: "waGnoGNO::0xbbb4.../sDAI-4hour-100-xdai"                  │
│          ─────────────────────────────────────────                  │
│          │       │           │    │    │   │                        │
│          │       │           │    │    │   └─ Network (gecko api)   │
│          │       │           │    │    └───── Limit (candles)       │
│          │       │           │    └────────── Interval              │
│          │       │           └─────────────── Quote token           │
│          │       └─────────────────────────── Rate provider (opt)   │
│          └─────────────────────────────────── Base token            │
│                                                                     │
│   Output: JSON { candles, pool, price, rate, params }               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Input Formats

### 1. Token Pair (Most Common)
```
BASE/QUOTE-interval-limit-network
```

**Examples:**
```bash
node spot.js VLR/USDC-hour-50-eth
node spot.js GNO/WXDAI-day-100-xdai
node spot.js sUSDS/USDT-4hour-200-eth
```

### 2. Token Pair with Rate Provider
```
BASE::0xRATEPROVIDER/QUOTE-interval-limit-network
```

**Examples:**
```bash
node spot.js waGnoGNO::0xbbb4966335677ea24f7b86dc19a423412390e1fb/sDAI-4hour-100-xdai
```

### 3. Pool Address
```
0xPOOLADDRESS-interval-limit-network
```

**Examples:**
```bash
node spot.js 0xd1d7fa8871d84d0e77020fc28b7cd5718c446522-hour-100-xdai
```

### 4. URL Encoded (for web)
```bash
node spot.js "waGnoGNO%3A%3A0xbbb4...%2FsDAI-4hour-5-xdai"
```

### 5. Shortcuts
```bash
node spot.js VLR/USDC-eth           # defaults: hour, 100
node spot.js VLR/USDC-50-eth        # defaults: hour
node spot.js VLR/USDC-4hour-eth     # defaults: 100
```

---

## Parameters

### Intervals
| Interval | Timeframe | Aggregate |
|----------|-----------|-----------|
| `minute` | minute | 1 |
| `5min` | minute | 5 |
| `15min` | minute | 15 |
| `hour` | hour | 1 |
| `4hour` | hour | 4 |
| `12hour` | hour | 12 |
| `day` | day | 1 |

### Networks
| Network | Chain ID | RPC Used |
|---------|----------|----------|
| `xdai` / `gnosis` | 100 | rpc.gnosischain.com |
| `eth` / `ethereum` | 1 | ethereum-rpc.publicnode.com |
| `base` | 8453 | - |
| `arbitrum` | 42161 | - |
| `polygon` | 137 | - |

### Limit
- Range: 1-1000
- Default: 100

---

## How It Works

```
┌─────────────────────────────────────────────────────────────────────┐
│                        EXECUTION FLOW                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. PARSE INPUT                                                     │
│     ├─ URL decode if encoded (%3A → :)                              │
│     ├─ Extract tokens/pool, interval, limit, network                │
│     └─ Extract rate provider if :: syntax used                      │
│                                                                     │
│  2. FIND POOL (if tokens provided)                                  │
│     ├─ Search GeckoTerminal API                                     │
│     ├─ Filter by token symbols in pool name                         │
│     └─ Sort by TVL, return highest liquidity pool                   │
│     ⚠️ NO FALLBACK - exact token symbols required                   │
│                                                                     │
│  3. FETCH POOL INFO                                                 │
│     └─ GET /networks/{net}/pools/{addr}?include=base_token,quote    │
│                                                                     │
│  4. FETCH CANDLES                                                   │
│     └─ GET /networks/{net}/pools/{addr}/ohlcv/{timeframe}           │
│         └─ ?limit={n}&aggregate={n}&currency=token                  │
│                                                                     │
│  5. GET RATE (if needed)                                            │
│     ├─ IF rate provider specified → call getRate() on RPC           │
│     ├─ ELSE IF base token in KNOWN_PROVIDERS → auto-detect          │
│     └─ ELSE → rate = 1 (no conversion)                              │
│                                                                     │
│  6. APPLY RATE                                                      │
│     └─ candles.value = candles.value × rate                         │
│                                                                     │
│  7. OUTPUT JSON                                                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Rate Provider Logic

### Auto-Detection (Known Providers)
```javascript
const KNOWN_PROVIDERS = {
    100: { // Gnosis Chain
        waGnoGNO: '0xbbb4966335677ea24f7b86dc19a423412390e1fb',
        sDAI: '0xaf204776c7245bf4147c2612bf6e5972ee483701',
    }
};
```

If the pool's base token matches a known symbol, the rate is auto-fetched.

### Manual Rate Provider
Use `::` syntax to specify any rate provider:
```
TOKEN::0xRATEPROVIDER/QUOTE
```

### Rate Fetching
```
┌─────────────────────────────────────────────────────────────────────┐
│  RATE PROVIDER CONTRACT CALL                                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. Select RPC based on chain:                                      │
│     ├─ xdai (100) → https://rpc.gnosischain.com                     │
│     └─ eth (1) → https://ethereum-rpc.publicnode.com                │
│                                                                     │
│  2. Call getRate() on contract using ethers.js v5.7.2               │
│     └─ eth_call { to: providerAddress, data: '0x679aefce' }         │
│                                                                     │
│  3. Parse result (1e18 format → float)                              │
│     └─ rate = BigInt(result) / 1e18                                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Output Format

```json
{
  "candles": [
    { "time": 1768640000, "value": 120.49 },
    { "time": 1768654400, "value": 120.51 }
  ],
  "pool": {
    "address": "0xd1d7fa8871d84d0e77020fc28b7cd5718c446522",
    "name": "waGnoGNO / sDAI 0.25%",
    "baseToken": "waGnoGNO",
    "quoteToken": "sDAI"
  },
  "price": 120.51,
  "rate": {
    "provider": "0xbbb4966335677ea24f7b86dc19a423412390e1fb",
    "rate": 1.004841,
    "token": "waGnoGNO",
    "source": "manual"
  },
  "params": {
    "network": "xdai",
    "chainId": 100,
    "timeframe": "hour",
    "aggregate": 4,
    "limit": 100
  },
  "count": 100
}
```

### Output Fields

| Field | Description |
|-------|-------------|
| `candles` | Array of `{ time, value }` - SubgraphChart compatible |
| `pool.address` | Pool contract address |
| `pool.name` | Pool name from GeckoTerminal |
| `pool.baseToken` | Base token symbol |
| `pool.quoteToken` | Quote token symbol |
| `price` | Latest price (with rate applied) |
| `rate.provider` | Rate provider contract address |
| `rate.rate` | Conversion multiplier |
| `rate.source` | `"manual"` or `"auto"` |
| `params` | Input parameters used |
| `count` | Number of candles returned |

---

## Important Behaviors

### NO FALLBACK
- Tool does **not** guess or fallback to similar tokens
- You must provide exact token symbols as they appear on GeckoTerminal
- Use `--search` to find correct symbols first

### Rate Application
- Rate is applied as: `finalPrice = rawPrice × rate`
- For wrapped tokens like `waGnoGNO`, rate > 1 (e.g., 1.0048)

### Aggregation
- `4hour` means candles are aggregated into 4-hour buckets
- This reduces API calls and data volume

---

## Usage in Code

```javascript
const { main } = require('./spot');

const result = await main('VLR/USDC-hour-50-eth');

console.log(result.price);     // Latest price
console.log(result.candles);   // [{ time, value }, ...]
console.log(result.rate);      // Rate info or null
```

---

## Files

| File | Purpose |
|------|---------|
| `spot.js` | Main CLI tool |
| `geckoFetcher.js` | GeckoTerminal API calls |
| `rateProvider.js` | Rate provider contract calls |
| `rpcProvider.js` | RPC management (ethers.js) |
| `getCandles.js` | Legacy full-featured tool |

---

## Dependencies

Uses from root `package.json`:
- `ethers@5.7.2` - For RPC calls to rate providers
- `node-fetch` - For API calls

No Express server required - pure CLI tool.
