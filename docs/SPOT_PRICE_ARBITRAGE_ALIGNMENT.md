# Spot Price Alignment with Arbitrage Route

## Overview

This document describes the spot price calculation approach and how it aligns with the arbitrage bot's pricing route.

## The Problem

Previously, the spot price for GNO/sDAI was fetched from GeckoTerminal using a `waGnoGNO/sDAI` pool search. This gave a different price than the arbitrage bot, which uses a specific Balancer V2 route.

## The Solution

Use the same pricing route as the arbitrage bot:

```
GNO → WXDAI (Balancer V2) → sDAI (via rate provider)
```

### Components

1. **Balancer V2 Pool**: `0x8189c4c96826d016a99986394103dfa9ae41e7ee` (GNO/WXDAI)
2. **sDAI Rate Provider**: `0x89c80a4540a00b5270347e02e2e144c71da2eced`

---

## Ticker Format

The new `spotClient.js` config format supports pool address with rate provider:

```
0xPOOL_ADDRESS::0xRATE_PROVIDER-interval-limit-network
```

### Example

```javascript
// In PROPOSAL_DEFAULTS
useSpotPrice: '0x8189c4c96826d016a99986394103dfa9ae41e7ee::0x89c80a4540a00b5270347e02e2e144c71da2eced-hour-500-xdai'
```

---

## Price Calculation

```
GNO/sDAI = GNO/WXDAI ÷ sDAI_rate

Example:
  GNO/WXDAI = 138 (from GeckoTerminal)
  sDAI_rate = 1.22 (from rate provider)
  GNO/sDAI = 138 / 1.22 = 113.11 sDAI
```

### Why Divide?

The sDAI rate provider returns the **value of 1 sDAI share in DAI terms**. If the rate is 1.22, that means 1 sDAI share is worth 1.22 DAI.

To convert X DAI to sDAI: `X / rate`

---

## Code Changes

### 1. spotClient.js - parseConfig

Added support for pool address with rate provider:

```javascript
// Check if it's a pool address (starts with 0x)
if (tokenPart.toLowerCase().startsWith('0x') && !tokenPart.includes('/')) {
    // Check for rate provider in pool address format: 0xPool::0xRate
    let poolAddress = tokenPart;
    let rateProvider = null;
    
    if (tokenPart.includes('::')) {
        [poolAddress, rateProvider] = tokenPart.split('::');
    }
    // ...
}
```

### 2. spotClient.js - Rate Application

Fixed rate math (divide instead of multiply):

```javascript
// Apply rate to candles (DIVIDE by rate: sDAI rate 1.22 means 1 DAI = 1.22 shares)
candles = candles.map(c => ({ ...c, value: c.value / rate }));
```

### 3. MarketPageShowcase.jsx - PROPOSAL_DEFAULTS

Updated the 0x45e proposal to use the new ticker:

```javascript
const PROPOSAL_DEFAULTS = {
  '0x45e1064348fD8A407D6D1F59Fc64B05F633b28FC': {
    useSubgraph: 'only',
    useSpotPrice: '0x8189c4c96826d016a99986394103dfa9ae41e7ee::0x89c80a4540a00b5270347e02e2e144c71da2eced-hour-500-xdai'
  }
};
```

---

## Alternative Approaches Evaluated

### 1. Balancer V2 Subgraph Multihop (multihop::GNO_SDAI)

**Route**: GNO → WXDAI → USDC → sDAI (3 hops)

**Pros**:
- Uses actual on-chain swap data
- Historically accurate

**Cons**:
- Complex (3 subgraph queries)
- USDC/sDAI pool has low volume, causing price gaps
- Historical sDAI rate changes cause chart fluctuations

### 2. GeckoTerminal Direct Pool (waGnoGNO/sDAI)

**Pros**:
- Simple, single API call

**Cons**:
- Uses wrapped GNO (waGnoGNO), not raw GNO
- Price doesn't match arbitrage route

### 3. GeckoTerminal + Rate Provider (CHOSEN)

**Route**: GNO → WXDAI (GeckoTerminal) → sDAI (rate provider)

**Pros**:
- Simple (1 API call + 1 RPC call)
- Uses same route as arbitrage bot
- Rate provider gives accurate current sDAI rate

**Cons**:
- Uses single fixed sDAI rate for all historical data

---

## Test Scripts Created

### Pool Discovery & Querying

| Script | Purpose |
|--------|---------|
| `scripts/test-balancer-pools.js` | Query Balancer V2 subgraph to discover pools by token pairs |
| `scripts/test-gecko-balancer-pools.js` | Check if GeckoTerminal tracks Balancer V2 pools |

### Price Calculation

| Script | Purpose |
|--------|---------|
| `scripts/test-gno-sdai-simple.js` | **Final approach**: GeckoTerminal + Rate Provider |
| `scripts/test-balancer-multihop.js` | 3-hop Balancer V2 subgraph query (GNO→WXDAI→USDC→sDAI) |
| `scripts/test-balancer-chart-format.js` | SubgraphChart-compatible output format |
| `scripts/test-balancer-fixed-sdai.js` | Uses fixed sDAI rate for historical data |

### Debugging

| Script | Purpose |
|--------|---------|
| `scripts/debug-verify.js` | Quick current price verification |
| `scripts/debug-hops.js` | Check individual hop prices |
| `scripts/debug-raw.js` | Inspect raw swap amounts |

### GeckoTerminal

| Script | Purpose |
|--------|---------|
| `scripts/test-gecko-spot.js` | Direct GeckoTerminal pool search |
| `scripts/test-gecko-hops.js` | Find GeckoTerminal pools for each hop |
| `scripts/test-gecko-composite-compare.js` | Compare composite vs direct pool price |

---

## Balancer V2 Pool Discovery

Query pools by token pairs using the V2 subgraph:

```graphql
query FindPools($tokenA: String!, $tokenB: String!) {
  pools(
    where: { tokensList_contains: [$tokenA, $tokenB] }
    orderBy: totalLiquidity
    orderDirection: desc
  ) {
    id
    address
    name
    poolType
  }
}
```

**Subgraph URL**: 
```
https://gateway-arbitrum.network.thegraph.com/api/{API_KEY}/subgraphs/id/EJezH1Cp31QkKPaBDerhVPRWsKVZLrDfzjrLqpmv6cGg
```

### Pool ID Structure

Balancer V2 Pool ID = `poolAddress` + `poolType` + `nonce`:

```
0x8189c4c96826d016a99986394103dfa9ae41e7ee 0002 000000000000000000aa
|----------- pool address --------------|type|------ nonce --------|
```

---

## Balancer V2 vs V3

| Feature | V2 | V3 |
|---------|----|----|
| Vault | Single vault for all pools | Same pattern |
| Subgraph | Gnosis-specific subgraph | Not widely available on Gnosis |
| Flash Loans | Via Vault | Via BalancerV3Vault |
| Pool Discovery | Subgraph queries | Limited on Gnosis |

> **Note**: The arbitrage bot uses V3 for flash loans but V2 for batch swaps and pricing due to better liquidity and subgraph availability on Gnosis.

| Contract | Address |
|----------|---------|
| Balancer V2 GNO/WXDAI Pool | `0x8189c4c96826d016a99986394103dfa9ae41e7ee` |
| sDAI Rate Provider | `0x89c80a4540a00b5270347e02e2e144c71da2eced` |
| Balancer V2 Vault (Gnosis) | `0xBA12222222228d8Ba445958a75a0704d566BF2C8` |

---

## Result

The spot price on the chart now matches the arbitrage bot's pricing (~112-113 sDAI per GNO), providing consistent reference pricing for traders.
