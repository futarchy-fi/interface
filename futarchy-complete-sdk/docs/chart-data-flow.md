# Chart Data Flow Documentation

This document explains how chart data (candles, spot prices, trades) flows through the Futarchy frontend and SDK.

## Data Sources

| Source | Data Type | Endpoint | Notes |
|--------|-----------|----------|-------|
| **Subgraph** | YES/NO Candles | `algebra-proposal-candles-v1` | OHLCV per pool, 1-hour periods |
| **Subgraph** | Swaps/Trades | Same subgraph, `swaps` entity | Rich data with pool type, tokens |
| **GeckoTerminal** | SPOT Prices | GeckoTerminal OHLCV API | External spot for underlying asset |
| **Supabase** | Trades (legacy) | `trade_history_view` | User-specific trade history |

## Subgraph Endpoints

```javascript
// Candle/Swap subgraph
'https://d3ugkaojqkfud0.cloudfront.net/subgraphs/name/algebra-proposal-candles-v1'

// Aggregator/Organization subgraph
'https://d3ugkaojqkfud0.cloudfront.net/subgraphs/name/futarchy-complete-new-v1'
```

## Key Files in futarchy-web

| File | Purpose |
|------|---------|
| `src/hooks/useSubgraphData.js` | Fetches YES/NO candles via GraphQL |
| `src/components/chart/SubgraphChart.jsx` | Renders chart with gap-fill & alignment |
| `src/spotPriceUtils/spotClient.js` | Fetches SPOT from GeckoTerminal |
| `src/utils/subgraphTradesClient.js` | Fetches swaps for Recent Activity |
| `src/components/futarchyFi/marketPage/SubgraphTradesDataLayer.jsx` | Subgraph-based trades UI |

## Candle Data Structure

From subgraph (`Pool.candles`):
```json
{
  "periodStartUnix": 1769385600,
  "period": "3600",
  "open": "109.05",
  "high": "109.44",
  "low": "109.05",
  "close": "109.44",
  "volumeToken0": "1.05",
  "volumeToken1": "115.6"
}
```

Transformed to chart format:
```json
{
  "time": 1769385600,
  "value": 109.44,
  "open": 109.05,
  "high": 109.44,
  "low": 109.05,
  "close": 109.44
}
```

## Forward-Fill Logic

The `SubgraphChart.jsx` implements several processing steps:

### 1. startCandleUnix Filter
Filters data to only show candles after market start:
```javascript
const startCandleUnix = config?.startCandleUnix || config?.metadata?.startCandleUnix;
filteredYes = filteredYes.filter(d => d.time >= startCandleUnix);
```

### 2. Gap-Fill (`ENABLE_GAP_FILL = true`)
Fills missing hourly candles by carrying forward the last known value:
```javascript
if (gap > hourInSeconds) {
    const numMissing = Math.floor(gap / hourInSeconds) - 1;
    for (let j = 1; j <= numMissing; j++) {
        filled.push({
            time: currentTime + (j * hourInSeconds),
            value: sorted[i].value // carry forward
        });
    }
}
```

### 3. Extend Forward
Extends YES/NO to the max time across all series:
```javascript
const maxTime = Math.max(...allTimes);
if (lastYes.time < maxTime) {
    // Add candles to reach maxTime
}
```

### 4. Time Alignment (`ENABLE_TIME_ALIGNMENT = true`)
When SPOT is present, aligns all series to start from where ALL THREE have data:
```javascript
let rangeStart = Math.max(yesMin, noMin, spotMin);
// Then forward-fill YES/NO to SPOT's end
```

## Swap/Trade Data Structure

From subgraph (`swaps` query):
```json
{
  "id": "0x01e10d...-2350",
  "transactionHash": "0x01e10d...",
  "timestamp": "1769731955",
  "amountIn": "0.00455",
  "amountOut": "0.5",
  "price": "109.68",
  "pool": {
    "name": "NO_GNO / NO_sDAI",
    "outcomeSide": "NO",
    "type": "CONDITIONAL"
  },
  "tokenIn": { "symbol": "NO_sDAI" },
  "tokenOut": { "symbol": "NO_GNO" }
}
```

## SPOT Config Format

SPOT prices are fetched using a config string:

```
POOL_ADDRESS::RATE_PROVIDER-interval-limit-network

Example:
0x8189c4c96826d016a99986394103dfa9ae41e7ee::0x89c80a4540a00b5270347e02e2e144c71da2eced-hour-500-xdai
```

For composite pools (multi-hop):
```
composite::0xPOOL1[-invert]+0xPOOL2[-invert]-interval-limit-network
```

## URL Parameters

| Param | Values | Effect |
|-------|--------|--------|
| `useSubgraph` | `true`, `only` | Enable SubgraphChart |
| `tradeSource` | `subgraph`, `supabase` | Trade data source |
| `useSpotPrice` | config string | Enable external SPOT line |

## Test Script

A test script is available at `/futarchy-web/test-candles-export.js`:

```bash
node test-candles-export.js
```

This exports YES/NO/SPOT candles with gap-fill to `export_candles_test.json`.
