# Balancer V2 vs V3 Price Comparison

## Overview

This document compares spot prices and historical candles between Balancer V2 and V3 pools for GNO/WXDAI on Gnosis chain.

---

## Pool Comparison

| Pool | Version | Address | Tokens | Liquidity |
|------|---------|---------|--------|-----------|
| GNO/WXDAI | V2 | `0x8189c4c96826d016a99986394103dfa9ae41e7ee` | GNO, WXDAI | ~$4,300 |
| waGNO/sDAI | V3 | `0xd1d7fa8871d84d0e77020fc28b7cd5718c446522` | waGNO, sDAI | ~$94,000 |

> **Finding**: V3 pool has **22x more liquidity** than V2.

---

## Rate Providers

To normalize prices between pools, rate providers convert wrapped/yield-bearing tokens:

| Token | Rate Provider | Current Rate | Meaning |
|-------|---------------|--------------|---------|
| waGNO → GNO | `0xbbb4966335677ea24f7b86dc19a423412390e1fb` | ~1.005 | 1 waGNO = 1.005 GNO |
| sDAI → WXDAI | `0x89c80a4540a00b5270347e02e2e144c71da2eced` | ~1.223 | 1 sDAI = 1.223 WXDAI (yield) |

---

## Price Normalization

### Normalizing V3 to GNO/WXDAI

```
V3 Raw:        waGNO/sDAI (from pool balance)
× waGNO rate:  × 1.005 (converts waGNO → GNO)
× sDAI rate:   × 1.223 (converts sDAI → WXDAI)
────────────────────────────────────────────────
= GNO/WXDAI (normalized, comparable to V2)
```

**Combined conversion factor**: ~1.229

---

## Historical Comparison Results

Comparing 168 hours (7 days) of candles, **normalized to GNO/WXDAI**:

| Metric | Value |
|--------|-------|
| Average Difference (V3 - V2) | **+1.35%** |
| Min Difference | +0.52% |
| Max Difference | +2.96% |
| Data Points | 168 hours |

> **Finding**: V3 consistently prices **~1.35% higher** than V2 when normalized.

---

## Subgraph Endpoints

### V2 Subgraph (Balancer V2 Gnosis)
```
https://gateway-arbitrum.network.thegraph.com/api/{API_KEY}/subgraphs/id/EJezH1Cp31QkKPaBDerhVPRWsKVZLrDfzjrLqpmv6cGg
```

### V3 Subgraphs (Balancer V3 Gnosis)

| Subgraph | Explorer Link |
|----------|---------------|
| V3 Vault | [thegraph.com/explorer/subgraphs/DDoABVc9xCRQwuXRq2QLZ6YLkjoFet74vnfncQDgJVo2](https://thegraph.com/explorer/subgraphs/DDoABVc9xCRQwuXRq2QLZ6YLkjoFet74vnfncQDgJVo2) |
| V3 Pools | [thegraph.com/explorer/subgraphs/yeZGqiwNf3Lqpeo8XNHih83bk5Tbu4KvFwWVy3Dbus6](https://thegraph.com/explorer/subgraphs/yeZGqiwNf3Lqpeo8XNHih83bk5Tbu4KvFwWVy3Dbus6) |

**Dev endpoints (rate-limited)**:
```
V3 Vault: https://api.studio.thegraph.com/query/75376/balancer-v3-gnosis/version/latest
V3 Pools: https://api.studio.thegraph.com/query/75376/balancer-pools-v3-gnosis/version/latest
```

---

## V3 Swap Schema

The V3 subgraph uses a different schema than V2:

```graphql
query {
  swaps(where: { pool: $pool }, first: 100) {
    id
    blockTimestamp
    tokenInSymbol      # Direct string (not nested)
    tokenOutSymbol     # Direct string (not nested)
    tokenAmountIn
    tokenAmountOut
  }
}
```

> **Note**: `tokenInSymbol`/`tokenOutSymbol` are strings, not nested objects like V2's `tokenIn { symbol }`.

---

## Building Candles from V3 Swaps

V3 subgraph has no native candle entity. Build OHLC from swaps:

```javascript
// Group by hour
const hourBucket = Math.floor(timestamp / 3600) * 3600;

// Calculate price per swap
// waGNO → sDAI: price = amountOut / amountIn
// sDAI → waGNO: price = amountIn / amountOut

// Per hour bucket:
// Open = first trade price
// Close = last trade price
// High = max price
// Low = min price
```

---

## Fees

> **Q: Do swap prices include fees?**
>
> **A: Yes.** The `tokenAmountOut` in both V2 and V3 subgraphs is the **post-fee** amount received. No manual fee calculation needed.

---

## Scripts

Located in `scripts/v2-v3-comparison/`:

| Script | Purpose |
|--------|---------|
| `test-v2-v3.js` | Live spot price comparison |
| `test-v2-v3-candles.js` | Historical candle comparison (normalized to GNO/WXDAI) |
| `test-v3-debug.js` | Debug V3 subgraph schema |
| `check-liquidity.js` | Pool liquidity comparison |
| `test-v2-v3-candles-output.json` | Full comparison data |

### Run Commands

```bash
# Spot price comparison
node scripts/v2-v3-comparison/test-v2-v3.js

# Historical candles (7 days)
node scripts/v2-v3-comparison/test-v2-v3-candles.js

# Check liquidity
node scripts/v2-v3-comparison/check-liquidity.js
```

---

## Implications

1. **Arbitrage Opportunity**: The ~1.35% price gap between V2 and V3 pools suggests potential arbitrage.

2. **V3 for Spot Pricing**: V3 pool has 22x more liquidity, may provide better spot price reference.

3. **Rate Conversion Required**: When comparing V2 and V3, always normalize using rate providers.

4. **Both Routes Valid**: The arb bot currently uses V2 route; V3 route could be added as alternative.
