# Subgraph Data Integration

This document covers the subgraph integration for trades and chart data, including the refresh context system.

---

## URL Parameters

| Parameter | Values | Effect |
|-----------|--------|--------|
| `useSubgraph` | `true`, `only` | Use subgraph for chart data |
| `tradeSource` | `subgraph` | Use subgraph for trades data |

### Examples

```bash
# Subgraph trades only
/markets/0x...?tradeSource=subgraph

# Subgraph chart only
/markets/0x...?useSubgraph=true

# Both subgraph
/markets/0x...?useSubgraph=true&tradeSource=subgraph
```

---

## Configuration

Edit `src/contexts/SubgraphRefreshContext.jsx` to adjust timing:

```javascript
// Delay before refreshing after transaction completion
// This gives the subgraph time to index the new transaction
const REFRESH_DELAY_MS = 5000; // 5 seconds - adjust as needed
```

---

## Refresh Intervals

| Component | Interval |
|-----------|----------|
| SubgraphChart | 60 seconds |
| SubgraphTradesDataLayer | 45 seconds |
| **Post-Transaction Delay** | **5 seconds** (configurable) |

---

## SubgraphRefreshContext

A React Context that allows **any component** to trigger refresh of SubgraphChart and/or SubgraphTradesDataLayer.

### File

`src/contexts/SubgraphRefreshContext.jsx`

### Usage

```jsx
import { useSubgraphRefresh } from '@/contexts/SubgraphRefreshContext';

function MyComponent() {
    const { refreshChart, refreshTrades, refreshAll } = useSubgraphRefresh();
    
    const handleSuccess = () => {
        refreshAll();  // Refresh both chart + trades
    };
}
```

### API

| Function | Description |
|----------|-------------|
| `refreshChart()` | Trigger SubgraphChart refresh |
| `refreshTrades()` | Trigger SubgraphTradesDataLayer refresh |
| `refreshAll()` | Trigger both |

### Integration

Already integrated in:
- `ConfirmSwapModal.jsx` - calls `refreshAll()` on SDK transaction success
- `SubgraphChart.jsx` - subscribes to `chartRefreshKey`
- `SubgraphTradesDataLayer.jsx` - subscribes to `tradesRefreshKey`

---

## Key Files

| File | Purpose |
|------|---------|
| `src/contexts/SubgraphRefreshContext.jsx` | Refresh triggers context |
| `src/utils/subgraphTradesClient.js` | Subgraph API client for trades |
| `src/components/chart/SubgraphChart.jsx` | Chart with subgraph data |
| `src/components/futarchyFi/marketPage/SubgraphTradesDataLayer.jsx` | Trades table with subgraph data |

---

## Subgraph Endpoints

| Chain | Endpoint |
|-------|----------|
| Ethereum (1) | `https://api.studio.thegraph.com/query/1718249/uniswap-proposal-candles/version/latest` |
| Gnosis (100) | `https://api.studio.thegraph.com/query/1718249/algebra-proposals-candles/version/latest` |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SubgraphRefreshContext                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │refreshChart │  │refreshTrades│  │     refreshAll      │  │
│  └─────┬───────┘  └──────┬──────┘  └──────────┬──────────┘  │
└────────│─────────────────│─────────────────────│────────────┘
         │                 │                     │
         ▼                 ▼                     │
┌─────────────────┐ ┌──────────────────────┐     │
│ SubgraphChart   │ │SubgraphTradesDataLayer│    │
│ (60s auto-poll) │ │    (45s auto-poll)    │    │
└─────────────────┘ └──────────────────────┘     │
                                                  │
         ┌────────────────────────────────────────┘
         ▼
┌─────────────────────┐
│  ConfirmSwapModal   │ (calls refreshAll on success)
└─────────────────────┘
```
