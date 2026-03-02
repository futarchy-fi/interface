# SubgraphChart External Spot Price Integration

## Overview

`spotClient.js` is a browser-compatible utility that fetches spot price data from GeckoTerminal API and applies optional rate conversions. It works directly in React/Next.js without requiring any Express server.

---

## spotClient.js Location

```
src/spotPriceUtils/spotClient.js
```

---

## Config String Format

```
[TOKENS_OR_POOL]-[INTERVAL]-[LIMIT]-[NETWORK]
```

### Format 1: Direct Pool Address
```
0xPOOLADDRESS-interval-limit-network
```

**Example:**
```
0xd1d7fa8871d84d0e77020fc28b7cd5718c446522-hour-500-xdai
```

| Part | Value | Description |
|------|-------|-------------|
| Pool | `0xd1d7fa...446522` | Direct pool address on GeckoTerminal |
| Interval | `hour` | Candle timeframe: `minute`, `hour`, `day` |
| Limit | `500` | Number of candles (max 1000) |
| Network | `xdai` | Chain: `xdai`, `eth`, `base` |

### Format 2: Multi-Hop (Balancer)
```
multihop::PRESET-interval-limit-network
```

**Example:**
```
multihop::GNO_SDAI-hour-500-xdai
```

| Part | Value | Description |
|------|-------|-------------|
| Prefix | `multihop::` | Routes to multi-hop client |
| Preset | `GNO_SDAI` | Predefined hop configuration |
| Interval | `hour` | Candle timeframe |
| Limit | `500` | Number of hours to fetch |
| Network | `xdai` | Chain |

**Available Presets:**
- `GNO_SDAI` - GNO → WXDAI → USDC → sDAI (3-hop)

**How it works:**
1. Queries Balancer V2 subgraph for swap data across all hops
2. Calculates hourly OHLC prices per hop
3. Multiplies hop prices into composite GNO/sDAI price
4. Returns same format as GeckoTerminal for seamless integration

### Format 3: Token Pair (GeckoTerminal)
```
BASE/QUOTE-interval-limit-network
```

**Example:**
```
waGnoGNO/sDAI-hour-500-xdai
```

Searches GeckoTerminal for the best pool matching the token pair.

### Format 4: Token Pair with Rate Provider (GeckoTerminal)
```
BASE::0xRATE_PROVIDER/QUOTE-interval-limit-network
```

**Example:**
```
waGnoGNO::0xbbb4966335677ea24f7b86dc19a423412390e1fb/sDAI-hour-500-xdai
```

| Part | Value | Description |
|------|-------|-------------|
| Base | `waGnoGNO` | Base token symbol |
| `::` | separator | Indicates rate provider follows |
| Rate Provider | `0xbbb4...` | ERC-4626 contract with `getRate()` |
| Quote | `sDAI` | Quote token symbol |

**What Rate Provider Does:**
- Calls `getRate()` on the contract via RPC
- Returns rate (e.g., 1.0048 for waGnoGNO → GNO)
- Multiplies all candle values by rate

---

## Invert Option (for Opposite Pool Order)

When a pool has tokens in opposite order (e.g., GHO/AAVE instead of AAVE/GHO), add `-invert` at the end:

```
TOKEN/QUOTE-interval-limit-network-invert
```

**Example:**
```
GHO/AAVE-hour-500-eth-invert
```

This applies `1/price` to all candle values.

| With Invert | Without |
|-------------|---------|
| `0.0062` (1/161) | `161` |

**Use case:** Pool shows GHO/AAVE = 0.0062, but you want AAVE/GHO = 161

**Encoded URL example:**
```
?useSpotPrice=GHO%2FAAVE-hour-500-eth-invert&useSubgraph=only
```

---

## Important: GeckoTerminal `currency=token`

> [!IMPORTANT]
> GeckoTerminal OHLCV API returns prices in **USD by default**, not in the quote token!

**Without `currency=token`:**
```
waGnoGNO/sDAI price = ~145 (USD price)
```

**With `currency=token`:**
```
waGnoGNO/sDAI price = ~119 (price in sDAI)
```

`spotClient.js` automatically adds `currency=token` to get the correct quote token prices.

---

## URL Encoding Support

> [!TIP]
> The config string is automatically URL-decoded, so both formats work!

**Special Characters:**
| Character | Encoded | Example |
|-----------|---------|---------|
| `/` | `%2F` | `waGnoGNO%2FsDAI` |
| `:` | `%3A` | `waGnoGNO%3A%3A0xbbb4...` |

**Encoded URL (safe for query params):**
```
?useSpotPrice=waGnoGNO%3A%3A0xbbb4966335677ea24f7b86dc19a423412390e1fb%2FsDAI-hour-500-xdai&useSubgraph=only
```

**Decoded equivalent:**
```
waGnoGNO::0xbbb4966335677ea24f7b86dc19a423412390e1fb/sDAI-hour-500-xdai
```

Both work identically. Use encoded format when copying URLs to avoid browser issues with special characters.

---

## Data Flow

```
URL: ?useSpotPrice=0xd1d7...522-hour-500-xdai
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│ MarketPageShowcase                              │
│   └─ useExternalSpotPrice(config)               │
└─────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│ useExternalSpotPrice Hook                       │
│   └─ fetchSpotCandles(config)                   │
└─────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│ spotClient.js                                   │
│   1. Parse config string                        │
│   2. Fetch OHLCV from GeckoTerminal API         │
│   3. Apply rate if ::0xPROVIDER specified       │
│   4. Return { candles, price, rate }            │
└─────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│ SubgraphChart                                   │
│   spotData → Dashed SPOT line                   │
│   spotPrice → Impact formula: (Y-N)/spot*100    │
└─────────────────────────────────────────────────┘
```

---

## Usage Examples

### 1. Basic Pool Address
```
?useSpotPrice=0xd1d7fa8871d84d0e77020fc28b7cd5718c446522-hour-500-xdai&useSubgraph=only
```

### 2. Token Pair (Auto-Search)
```
?useSpotPrice=waGnoGNO/sDAI-hour-500-xdai&useSubgraph=only
```

### 3. With Rate Provider
```
?useSpotPrice=waGnoGNO::0xbbb4966335677ea24f7b86dc19a423412390e1fb/sDAI-hour-500-xdai&useSubgraph=only
```

---

## Return Format

```javascript
{
  candles: [{ time: 1768600, value: 119.5 }, ...],  // Chart-ready
  price: 119.5,           // Latest price
  rate: { provider: '0x...', rate: 1.0048 },  // If rate applied
  pool: { address: '0x...', name: 'waGnoGNO / sDAI' },
  error: null
}
```

---

## SubgraphChart Time Alignment & Forward-Fill

When SPOT data is present or proposal bounds are set, the chart aligns all series to a common time range:

### Step 1: Find Common Start and End (Filter the Bounds)
```
YES:  [-----|=========|------]
NO:   [---------|=====|------]
SPOT: [---|===========|------]
               ↑          ↑
      MAX(mins, start)    MIN(maxs, close)
```

**Boundaries Applied:**
1. **`startCandleUnix`**: Filters out any candles before the proposal open timestamp.
2. **`closeTimestamp`**: Filters out any candles after the proposal close timestamp, ensuring the chart does not forward-fill empty lines into the infinite future.
3. All three series are cropped to start where they ALL have data, bounded within the proposal window.

### Step 2: Forward-Fill (Extend to End)
```
YES data:  [====|     ]  → Last price carried forward
SPOT data: [==========]
                     ↑
                SPOT max
```

If YES/NO data ends before SPOT, the last price is repeated to match SPOT's timestamps.

### Console Output
```
[SubgraphChart] Forward-filled YES with 50 points
[SubgraphChart] Forward-filled NO with 80 points
[SubgraphChart] Aligned to SPOT range (1/15/2026 - 1/17/2026)
[SubgraphChart] Points: YES=70, NO=91, SPOT=95
```

### Why Forward-Fill?
- When there are no swaps, the price stays the same
- Forward-fill shows this assumption visually
- Allows comparing YES/NO to current SPOT price

---

## Files

| File | Purpose |
|------|---------|
| `src/spotPriceUtils/spotClient.js` | Browser-compatible fetcher |
| `src/hooks/useExternalSpotPrice.js` | React hook wrapper |
| `src/components/chart/SubgraphChart.jsx` | Chart with spot line |

---

## Networks Supported

| Network | Chain ID | GeckoTerminal ID |
|---------|----------|------------------|
| Gnosis | 100 | `xdai` |
| Ethereum | 1 | `eth` |
| Base | 8453 | `base` |
