# Spot Price Utils

CLI tools for fetching spot prices - **SUPER GENERIC**!

## Quick Start

```bash
# From project root
node src/spotPriceUtils/spot.js VLR/USDC-hour-50-eth
```

---

## `spot.js` - The One Tool You Need

### Format
```
<tokens>-<interval>-<limit>-<network>
```

### With Rate Provider
```
BASE::0xRATEPROVIDER/QUOTE-interval-limit-network
```

### Examples

```bash
# Ethereum
node spot.js VLR/USDC-hour-50-eth
node spot.js sUSDS/USDT-day-100-eth

# Gnosis with auto rate
node spot.js waGnoGNO/sDAI-4hour-100-xdai

# With manual rate provider
node spot.js waGnoGNO::0xbbb4966335677ea24f7b86dc19a423412390e1fb/sDAI-4hour-100-xdai

# Pool address
node spot.js 0xd1d7fa8871d84d0e77020fc28b7cd5718c446522-hour-100-xdai

# Shortcuts
node spot.js VLR/USDC-eth           # defaults: hour, 100
node spot.js VLR/USDC-50-eth        # defaults: hour
node spot.js VLR/USDC-4hour-eth     # defaults: 100
```

### Intervals
- `minute`, `5min`, `15min`
- `hour`, `4hour`, `12hour`
- `day`

### Networks
- `eth`, `xdai`, `base`, `arbitrum`, `polygon`, `bsc`

---

## Output (JSON)

```json
{
  "candles": [{ "time": 1704067200, "value": 0.00249 }],
  "pool": {
    "address": "0x...",
    "name": "VLR / USDC 0.3%",
    "baseToken": "VLR",
    "quoteToken": "USDC"
  },
  "price": 0.00249,
  "rate": {
    "provider": "0x...",
    "rate": 1.0048,
    "token": "waGnoGNO",
    "source": "manual"
  },
  "params": {
    "network": "eth",
    "chainId": 1,
    "timeframe": "hour",
    "aggregate": 1,
    "limit": 5
  },
  "count": 5
}
```

---

## Other Tools

| Tool | Purpose |
|------|---------|
| `geckoFetcher.js` | Search pools, fetch candles |
| `rateProvider.js` | Get rate from contract |
| `getCandles.js` | Full-featured candle fetcher |
| `rpcProvider.js` | RPC management |
