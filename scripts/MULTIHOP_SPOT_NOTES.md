# Multihop SPOT Price Implementation Notes

## Overview
We're building a composite SPOT price for GNO/sDAI by chaining 3 Balancer V2 hops:
```
GNO → WXDAI → USDC → sDAI
```

## Balancer Subgraph URL (Working)
```
https://gateway-arbitrum.network.thegraph.com/api/YOUR_GRAPH_API_KEY_HERE/subgraphs/id/EJezH1Cp31QkKPaBDerhVPRWsKVZLrDfzjrLqpmv6cGg
```

## Pool IDs
| Hop | Pool ID |
|-----|---------|
| GNO/WXDAI | `0x8189c4c96826d016a99986394103dfa9ae41e7ee0002000000000000000000aa` |
| WXDAI/USDC | `0x2086f52651837600180de173b09470f54ef7491000000000000000000000004f` |
| USDC/sDAI | `0x7644fa5d0ea14fcf3e813fdf93ca9544f8567655000000000000000000000066` |

## Token Addresses
| Token | Address |
|-------|---------|
| GNO | `0x9c58bacc331c9aa871afd802db6379a98e80cedb` |
| WXDAI | `0xe91d153e0b41518a2ce8dd3d7944fa863463a97d` |
| USDC | `0xddafbb505ad214d7b80b1f830fccc89b60fb7a83` |
| sDAI | `0xaf204776c7245bf4147c2612bf6e5972ee483701` |

## Key Findings from Tests

### Test 1: Mock startCandleUnix (3 hours ago)
**Script:** `scripts/test-mock-startcandle.js`
```
startCandleUnix = now - 3 hours
Result: 4 hourly candles, price ~112.82 sDAI
GNO/WXDAI: 586 swaps, WXDAI/USDC: 273 swaps, USDC/sDAI: 210 swaps
```

### Test 2: SubgraphChart's startCandleUnix (Jan 19)
**Script:** `scripts/test-subgraph-aligned.js`
```
startCandleUnix = 2026-01-19T22:00:00Z (from SubgraphChart config)
Result: 38 candles BUT data ends at Jan 21!
Latest candle: 2026-01-21T11:00 = 117.29 sDAI
```

### Test 3: Check Latest Swaps
**Script:** `scripts/check-latest-candles.js`
```
GNO/WXDAI: 0 minutes ago (data is fresh!)
WXDAI/USDC: 4 minutes ago
USDC/sDAI: 0 minutes ago
```

## The Problem

1. **1000 swap limit covers only ~2 days** of Balancer activity
2. If `startCandleUnix` is too old (e.g., Jan 10), the 1000 swaps run out before reaching current time
3. SubgraphChart's `config.startCandleUnix` (Jan 19) was filtering out ALL SPOT candles

## Solution Approach

### Option A: Dynamic startCandleUnix
Use `now - N days` instead of a fixed timestamp:
```javascript
const startCandleUnix = Math.floor(Date.now() / 1000) - (3 * 24 * 60 * 60); // 3 days ago
```

### Option B: Don't filter SPOT by startCandleUnix
Since multihop manages its own time range, skip the SubgraphChart's startCandleUnix filter for SPOT data:
```javascript
// In SubgraphChart.jsx, around line 334
if (startCandleUnix && typeof startCandleUnix === 'number') {
    filteredYes = filteredYes.filter(d => d.time >= startCandleUnix);
    filteredNo = filteredNo.filter(d => d.time >= startCandleUnix);
    // DON'T filter SPOT - multihop handles its own time range
    // filteredSpot = filteredSpot.filter(d => d.time >= startCandleUnix); // REMOVE THIS
}
```

### Option C: Pass startCandleUnix through config string
Format: `multihop::PRESET-interval-limit-network-startCandleUnix`
Example: `multihop::GNO_SDAI-hour-1000-xdai-1769209200`

## Config String Format
```
multihop::PRESET-interval-limit-network-startCandleUnix
         ^^^^^^  ^^^^^^^ ^^^^^ ^^^^^^^ ^^^^^^^^^^^^^^^
         |       |       |     |       Optional: unix timestamp
         |       |       |     Network: xdai, gnosis
         |       |       Candle limit (hours to fetch)
         |       Interval: hour (only supported)
         Preset: GNO_SDAI
```

## GraphQL Query for Time-Range Swaps
```graphql
query getSwaps($poolId: String!, $from: Int!) {
    swaps(
        where: { poolId: $poolId, timestamp_gte: $from }
        orderBy: timestamp
        orderDirection: asc
        first: 1000
    ) {
        timestamp
        tokenIn
        tokenOut
        tokenAmountIn
        tokenAmountOut
    }
}
```

## Integration Points

### 1. balancerHopClient.js
- Parse config string
- Fetch swaps from all 3 pools in parallel
- Build hourly candles per hop
- Multiply hop prices to get composite price
- Return `{ candles, price, pool, error }`

### 2. spotClient.js
- Detect `multihop::` prefix
- Delegate to `fetchBalancerHopCandles`

### 3. useExternalSpotPrice.js
- Calls `spotClient.fetchSpotCandles`
- Returns `{ spotData, spotPrice, refetch, loading }`

### 4. MarketPageShowcase.jsx
- Set `useSpotPrice` in PROPOSAL_DEFAULTS
- Pass to SubgraphChart via `spotData` and `spotPrice` props

### 5. SubgraphChart.jsx
- Receive `spotData`, `spotPrice`, `showSpot` props
- DON'T filter SPOT by startCandleUnix
- Render SPOT line alongside YES/NO

## Test Scripts Location
```
scripts/test-mock-startcandle.js    - Test with 3-hour window
scripts/test-subgraph-aligned.js    - Test with SubgraphChart's startCandleUnix
scripts/check-latest-candles.js     - Check latest swap timestamps
```
