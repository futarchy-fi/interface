# SubgraphChart - Complete Documentation

## Overview

The **SubgraphChart** component fetches proposal market data from The Graph subgraphs and displays it using `lightweight-charts`, styled identically to the existing `TripleChart` component.

---

## Part 1: Subgraph Schema & Pure JavaScript Modules

### Subgraph Endpoints

| Chain | Network | Endpoint |
|-------|---------|----------|
| 1 | Ethereum (Uniswap) | `https://api.studio.thegraph.com/query/1718249/uniswap-proposal-candles/version/latest` |
| 100 | Gnosis (Algebra/Swapr) | `https://api.studio.thegraph.com/query/1718249/algebra-proposals-candles/version/latest` |

### GraphQL Schema

Both subgraphs use the same schema:

```graphql
type Pool {
  id: ID!                    # Pool address (lowercase)
  name: String!              # e.g. "YES_GNO / YES_sDAI"
  type: String!              # "CONDITIONAL" | "PREDICTION" | "EXPECTED_VALUE"
  outcomeSide: String        # "YES" | "NO" | null
  price: BigDecimal!         # Current pool price
  isInverted: Boolean!       # Informational only (prices are already correct)
  proposal: Proposal!        # Parent proposal
}

type Candle {
  periodStartUnix: Int!      # Unix timestamp (use for ordering)
  open: BigDecimal!
  high: BigDecimal!
  low: BigDecimal!
  close: BigDecimal!         # We use this for chart line value
  volumeUSD: BigDecimal!
}
```

> **Important**: `isInverted` is informational only. The `price` field is already in the correct format.

### GraphQL Queries Used

**Get CONDITIONAL Pools:**
```graphql
query GetConditionalPools($proposalId: String!) {
  pools(where: { proposal: $proposalId, type: "CONDITIONAL" }) {
    id, name, type, outcomeSide, price, isInverted
    proposal { id, marketName }
  }
}
```

**Get Candles:**
```graphql
query GetCandles($poolId: String!, $limit: Int!) {
  candles(
    where: { pool: $poolId }
    first: $limit
    orderBy: periodStartUnix
    orderDirection: desc
  ) {
    periodStartUnix, open, high, low, close, volumeUSD
  }
}
```

> **Tip**: Proposal and pool IDs must be **lowercase** for queries to work.

---

## Part 2: Files Created

### File Structure

```
src/
├── config/
│   └── subgraphEndpoints.js      # Endpoint configuration
├── adapters/
│   └── subgraphDataAdapter.js    # Pure data transformation
├── services/
│   └── subgraphClient.js         # GraphQL client
├── hooks/
│   └── useSubgraphData.js        # React data hook
└── components/
    └── chart/
        └── SubgraphChart.jsx     # Main component

scripts/
└── test_subgraph_modules.js      # Node.js test script
```

---

### subgraphEndpoints.js

**Path:** `src/config/subgraphEndpoints.js`

Configuration constants:
```javascript
export const SUBGRAPH_ENDPOINTS = {
  1: 'https://api.studio.thegraph.com/query/1718249/uniswap-proposal-candles/...',
  100: 'https://api.studio.thegraph.com/query/1718249/algebra-proposals-candles/...'
};

export const POOL_TYPES = { PREDICTION: 'PREDICTION', CONDITIONAL: 'CONDITIONAL', ... };
export const OUTCOME_SIDES = { YES: 'YES', NO: 'NO' };
```

---

### subgraphDataAdapter.js

**Path:** `src/adapters/subgraphDataAdapter.js`

Pure functions (no React dependencies):

| Function | Purpose |
|----------|---------|
| `adaptCandlesToChartFormat(candles)` | Converts to `{time, value}[]` |
| `adaptPoolToSimpleFormat(pool)` | Simplifies pool object |
| `filterConditionalPools(pools)` | Returns `{yesPools, noPools}` |
| `createChartDataStructure(data)` | Creates full chart data object |
| `calculateImpact(yesPrice, noPrice)` | Returns impact percentage |

---

### subgraphClient.js

**Path:** `src/services/subgraphClient.js`

GraphQL client for Node.js and browser:

```javascript
const client = createSubgraphClient(chainId);
const pools = await client.getConditionalPools(proposalId);
const chartData = await client.getChartData(proposalId, 500);
```

---

### useSubgraphData.js

**Path:** `src/hooks/useSubgraphData.js`

React hook with key features:

```javascript
const { yesData, noData, yesPrice, noPrice, loading, error, refetch } 
  = useSubgraphData(proposalId, chainId, candleLimit);
```

**Key Features:**
1. **Silent Resync**: `refetch(true)` updates data without showing loading overlay
2. **Live Candle**: Appends current pool price at current timestamp
3. **Deduplication**: Removes duplicate timestamps for `lightweight-charts`

---

### SubgraphChart.jsx

**Path:** `src/components/chart/SubgraphChart.jsx`

Main React component styled identically to TripleChart.

**Props:**
```javascript
<SubgraphChart
  proposalId="0x45e1..."        // Proposal address
  chainId={100}                  // 1 or 100
  height={448}                   // Chart height in pixels
  candleLimit={500}              // Max candles to fetch
  config={config}                // For precision/currency config
  autoResyncInterval={10}        // Seconds between auto-resync
/>
```

---

## Part 3: TripleChart Matching

### Visual Consistency

| Element | TripleChart | SubgraphChart |
|---------|-------------|---------------|
| Container | `rounded-3xl border-2` | ✅ Same |
| Header | `h-16 bg-futarchyGray2` | ✅ Same |
| YES Color | `rgb(0, 144, 255)` | ✅ Same |
| NO Color | `rgb(245, 196, 0)` | ✅ Same |
| Impact + | `!text-futarchyTeal7` | ✅ Same |
| Impact - | `!text-futarchyCrimson7` | ✅ Same |
| Font | `font-oxanium` | ✅ Same |
| Chart Library | `lightweight-charts` | ✅ Same |

### Chart Configuration

Both use identical `createChart()` options:
- Transparent grid lines
- Dark/light mode support
- Same crosshair styling
- Same time scale formatting

---

## Part 4: Key Features

### 🕯️ Live Candle (Pool Price as Last Point)

The pool's current `price` is used as an "unclosed candle":

```javascript
const now = Math.floor(Date.now() / 1000);
if (yesPool) {
  yesData.push({ time: now, value: parseFloat(yesPool.price) });
}
```

This extends the chart line to "now" with the latest price.

---

### ⏱️ Auto-Resync Countdown

Configurable interval (default 10s) with countdown display:

```javascript
// Button shows: "Resync (10s)", "Resync (9s)", etc.
{loading ? 'Syncing...' : `Resync (${countdown}s)`}
```

When countdown reaches 0, auto-resyncs with silent mode.

---

### 🔇 Silent vs Normal Resync

| Mode | Trigger | Loading Overlay | Use Case |
|------|---------|-----------------|----------|
| Normal | Manual click | ✅ Shows | User feedback |
| Silent | Auto-resync | ❌ Hidden | Smooth updates |

```javascript
refetch(false);  // Manual - shows loading
refetch(true);   // Silent - no flicker
```

---

### 📅 Footer Timestamp

Shows precise update time with seconds:

```
Updated: Jan 13 08:26:46
```

---

## Part 5: Usage in MarketPageShowcase

Added below TripleChart for comparison:

```jsx
// In MarketPageShowcase.jsx
import SubgraphChart from "@components/chart/SubgraphChart";

// ... in JSX ...
<SubgraphChart
  proposalId={config?.proposalId || config?.MARKET_ADDRESS}
  chainId={config?.chainId || 100}
  height={448}
  candleLimit={500}
  config={config}
/>
```

---

## Part 6: Testing (Pure JS)

Run the test script to validate modules without React:

```bash
node scripts/test_subgraph_modules.js
```

Output:
```
✅ Config Module: PASSED
✅ Adapter Module: PASSED
✅ Client Chain 100: PASSED
✅ Client Chain 1: PASSED
```

---

## Summary

The SubgraphChart provides a **subgraph-first** alternative to the Supabase-powered TripleChart:

1. **Same visual appearance** - identical styling and colors
2. **Live price feed** - pool price as live candle
3. **Auto-refresh** - configurable countdown with silent updates
4. **Decoupled architecture** - pure JS modules testable without React
5. **Multi-chain support** - works with Chain 1 (Ethereum) and Chain 100 (Gnosis)

---

## Part 7: Query Parameter Control

### useSubgraph Parameter

Control which chart(s) to display via URL query parameter:

| URL | TripleChart | SubgraphChart | Use Case |
|-----|-------------|---------------|----------|
| `/markets/0x...` | ✅ Shown | ❌ Hidden | Default behavior |
| `/markets/0x...?useSubgraph=true` | ✅ Shown | ✅ Shown | Compare both |
| `/markets/0x...?useSubgraph=only` | ❌ Hidden | ✅ Shown | Subgraph only |

### Implementation

```javascript
// In MarketPageShowcase.jsx
const searchParams = useSearchParams();
const useSubgraphParam = searchParams.get('useSubgraph');
const showTripleChart = useSubgraphParam !== 'only';
const showSubgraphChart = useSubgraphParam === 'true' || useSubgraphParam === 'only';
```

**Important**: Components are conditionally **unmounted**, not just hidden. This means:
- No data fetching when chart is not displayed
- No memory usage for hidden charts
- Clean component lifecycle

---

## Part 8: Troubleshooting - GraphQL Call Optimization

### The Problem

During development, the Network tab showed **many duplicate GraphQL calls** instead of one per countdown cycle.

### Root Causes Identified

| Issue | Description | Impact |
|-------|-------------|--------|
| **React Strict Mode** | In development, React mounts components twice to detect side effects | Doubled all useEffect calls |
| **useCallback recreation** | `fetchData` function was recreated when deps changed | Triggered useEffect re-runs |
| **Separate queries** | Original design used 3 queries: 1 for pools + 2 for candles | 3x network requests |
| **No request deduplication** | Concurrent calls created duplicate requests | Wasted bandwidth |

### Solution: Combined Query + Module Cache

**Before (3 requests):**
```
1. GET_CONDITIONAL_POOLS → pools
2. GET_CANDLES (YES pool)
3. GET_CANDLES (NO pool)
```

**After (1 request):**
```graphql
query GetPoolsWithCandles($proposalId: String!, $limit: Int!) {
  pools(where: { proposal: $proposalId, type: "CONDITIONAL" }) {
    id, name, outcomeSide, price
    candles(first: $limit, orderBy: periodStartUnix, orderDirection: desc) {
      periodStartUnix, close
    }
  }
}
```

### Key Optimizations in `useSubgraphData.js`

```javascript
// 1. Module-level cache (outside React lifecycle)
const fetchCache = new Map();

// 2. Promise deduplication
if (cached?.inFlight) {
    await cached.promise;  // Wait for existing request
    return;
}

// 3. Track mounted state
const mountedRef = useRef(true);
useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
}, []);
```

### Results

| Metric | Before | After |
|--------|--------|-------|
| Requests per cycle | 6+ | 1 |
| Query efficiency | 3 separate | 1 combined |
| Strict Mode handling | ❌ Broken | ✅ Fixed |
| Concurrent dedup | ❌ None | ✅ Promise cache |

### Why This Approach Works

1. **Single Query**: GraphQL supports nested relations, so pools→candles is fetched atomically
2. **Module Cache**: Lives outside React, survives Strict Mode unmount/remount
3. **Promise Sharing**: In-flight requests are shared, not duplicated
4. **Mounted Check**: Prevents state updates after unmount (memory leak fix)
