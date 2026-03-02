# Proposal Defaults Configuration

## Overview

Specific proposals can have default settings for `useSubgraph` and `useSpotPrice` without requiring URL query parameters.

---

## Configuration Location

```
src/components/futarchyFi/marketPage/MarketPageShowcase.jsx
```

```javascript
const PROPOSAL_DEFAULTS = {
  '0x45e1064348fD8A407D6D1F59Fc64B05F633b28FC': {
    useSubgraph: 'only',
    useSpotPrice: 'waGnoGNO::0xbbb4966335677ea24f7b86dc19a423412390e1fb/sDAI-hour-500-xdai'
  }
};
```

---

## Adding a New Proposal

```javascript
PROPOSAL_DEFAULTS['0xYOUR_PROPOSAL_ADDRESS'] = {
  useSubgraph: 'only',           // 'only' | 'true' | undefined
  useSpotPrice: 'TOKEN/QUOTE-interval-limit-network'
};
```

### useSubgraph Values
| Value | Effect |
|-------|--------|
| `'only'` | SubgraphChart only (no TripleChart) |
| `'true'` | Both TripleChart AND SubgraphChart |
| `undefined` | TripleChart only (default) |

### useSpotPrice Format
See [SUBGRAPH_SPOT.md](./SUBGRAPH_SPOT.md) for full config format.

---

## Test URLs

**With defaults (no params):**
```
/markets/0x45e1064348fD8A407D6D1F59Fc64B05F633b28FC
```

**Override defaults:**
```
/markets/0x45e1064348fD8A407D6D1F59Fc64B05F633b28FC?useSubgraph=true
```

URL params always override proposal defaults.

---

## Example: AAVE/GHO on Ethereum

```javascript
PROPOSAL_DEFAULTS['0xFb45aE9d8e5874e85b8e23D735EB9718EfEF47Fa'] = {
  useSubgraph: 'only',
  useSpotPrice: 'AAVE/GHO-hour-500-eth'
};
```

With inverted pool:
```javascript
useSpotPrice: 'GHO/AAVE-hour-500-eth-invert'
```
