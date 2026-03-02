# Chart Price Inversion Logic Documentation

## Overview

This document explains how the futarchy prediction market charts handle price inversions to ensure YES pool, NO pool, and base (spot) price data are displayed consistently in relation to each other.

## Key Concepts

### Pool Configurations

Each pool in the system has a configuration that determines how prices should be interpreted:

- **YES Pool** (`POOL_CONFIG_YES`) - Conditional token pool for YES outcome
- **NO Pool** (`POOL_CONFIG_NO`) - Conditional token pool for NO outcome
- **Base Pool** (`BASE_POOL_CONFIG`) - Spot price pool (e.g., GNO/sDAI)

### Token Slot Parameters

The critical parameters that determine price inversion are:

#### For Conditional Pools (YES/NO)
- **`tokenCompanySlot`** - Indicates which slot (0 or 1) contains the company token in the pool pair
  - `tokenCompanySlot = 0` → Company token is token0, NO inversion needed
  - `tokenCompanySlot = 1` → Company token is token1, price MUST be inverted

#### For Base Pool
- **`currencySlot`** - Indicates which slot (0 or 1) contains the currency token
  - `currencySlot = 0` → Currency is token0, NO inversion needed
  - `currencySlot = 1` → Currency is token1, price MUST be inverted

## Price Calculation from Uniswap V3 Pools

All pools use the Uniswap V3 / Algebra pool format, which stores price as `sqrtPriceX96`:

```javascript
// From useFutarchy.js:1109-1122
const calculatePriceFromSqrtPriceX96 = (sqrtPriceX96, tokenCompanySlot) => {
  const sqrtPriceX96BN = ethers.BigNumber.from(sqrtPriceX96);
  const sqrtPriceStr = ethers.utils.formatUnits(sqrtPriceX96BN, 0);
  const sqrtPrice = parseFloat(sqrtPriceStr);
  const price = (sqrtPrice * sqrtPrice) / 2**192;

  // If tokenCompanySlot is 1, we need to invert the price
  return tokenCompanySlot === 1 ? 1 / price : price;
};
```

**Key insight**: The pool returns `token1/token0` ratio. If company token is in slot 1, we need `1/price` to get `company/currency`.

## Chart Inversion Logic (TripleChart Component)

Location: [src/components/chart/TripleChart.jsx](../src/components/chart/TripleChart.jsx)

### Primary Inversion Rule

The chart applies a **spot price-based alignment** to ensure YES and NO prices appear in the same magnitude range as the spot price:

```javascript
// From TripleChart.jsx:170-198
const processTokenData = (data, tokenType = 'TOKEN') => {
  const processedData = data.map(d => {
    if (!d.value || !effectiveSpotPrice) return d;

    // If spot price < 1: invert values > 1 to make them < 1 (like spot price)
    // If spot price > 1: invert values < 1 to make them > 1 (like spot price)
    const shouldInvert = (effectiveSpotPrice < 1 && d.value > 1) ||
                         (effectiveSpotPrice >= 1 && d.value < 1);

    if (shouldInvert) {
      const invertedValue = 1 / d.value;
      return { ...d, value: invertedValue };
    }
    return d;
  });

  return processedData;
};
```

### When Inversion Occurs

| Spot Price | YES/NO Price | Action | Reason |
|------------|--------------|--------|---------|
| < 1.0 | > 1.0 | **Invert** (1/price) | Align to spot's sub-1 range |
| < 1.0 | < 1.0 | Keep as-is | Already aligned |
| ≥ 1.0 | < 1.0 | **Invert** (1/price) | Align to spot's above-1 range |
| ≥ 1.0 | ≥ 1.0 | Keep as-is | Already aligned |

### Example Scenarios

#### Scenario 1: Spot Price = 0.15 (< 1)
- Raw YES price from pool: 150 (> 1)
- **Chart inverts**: 1/150 = 0.0067
- Result: YES price now aligns with spot's sub-1 range

#### Scenario 2: Spot Price = 150 (> 1)
- Raw NO price from pool: 0.0067 (< 1)
- **Chart inverts**: 1/0.0067 = 149.25
- Result: NO price now aligns with spot's above-1 range

## Implementation Locations

### 1. Configuration Setup
**File**: [src/hooks/useContractConfig.js:152-160](../src/hooks/useContractConfig.js#L152-L160)

```javascript
POOL_CONFIG_YES: {
  address: metadata.conditional_pools?.yes?.address || '0xF336F812Db1ad142F22A9A4dd43D40e64B478361',
  tokenCompanySlot: metadata.conditional_pools?.yes?.tokenCompanySlot ?? 1,
},

POOL_CONFIG_NO: {
  address: metadata.conditional_pools?.no?.address || '0xfbf1BE5CE2f9056dAaB1C368EC241ad7Be3507A8',
  tokenCompanySlot: metadata.conditional_pools?.no?.tokenCompanySlot ?? 0,
}
```

**Default values**:
- YES pool: `tokenCompanySlot = 1` (invert by default)
- NO pool: `tokenCompanySlot = 0` (no inversion by default)

### 2. Price Calculation
**File**: [src/hooks/useFutarchy.js:1268-1276](../src/hooks/useFutarchy.js#L1268-L1276)

```javascript
// Calculate prices from pool data
const yesCompanyPrice = calculatePriceFromSqrtPriceX96(
  yesSlot0.sqrtPriceX96,
  POOL_CONFIG_YES.tokenCompanySlot
);

const noCompanyPrice = calculatePriceFromSqrtPriceX96(
  noSlot0.sqrtPriceX96,
  POOL_CONFIG_NO.tokenCompanySlot
);
```

### 3. Chart Display Logic
**File**: [src/components/chart/TripleChart.jsx:286-299](../src/components/chart/TripleChart.jsx#L286-L299)

```javascript
// Process YES data to match spot price relationship to 1
const yesDataInverted = yesData.map(d => {
  if (!d.price || !effectiveSpotPrice) return { ...d, value: d.price };

  // If spot price < 1: invert values > 1 to make them < 1 (like spot price)
  // If spot price > 1: invert values < 1 to make them > 1 (like spot price)
  const shouldInvert = (effectiveSpotPrice < 1 && d.price > 1) ||
                       (effectiveSpotPrice >= 1 && d.price < 1);

  if (shouldInvert) {
    return { ...d, price: 1 / d.price, value: 1 / d.price };
  }
  return { ...d, value: d.price };
});
```

Similar logic applies to NO pool data (lines 315-328).

### 4. MarketPageShowcase Alignment
**File**: [src/components/futarchyFi/marketPage/MarketPageShowcase.jsx:2352-2374](../src/components/futarchyFi/marketPage/MarketPageShowcase.jsx#L2352-L2374)

```javascript
// Apply spot price-based inversion logic (like TripleChart does)
// This ensures YES/NO prices are in the same range as the spot price
// NOTE: Event probability (third price) should NOT be inverted based on spot price
if (basePrice !== null && yesPrice !== null && noPrice !== null) {
  // If spot price < 1: invert YES/NO values > 1 to make them < 1
  // If spot price >= 1: invert YES/NO values < 1 to make them > 1
  const spotLessThanOne = basePrice < 1;

  // Process YES price
  if ((spotLessThanOne && yesPrice > 1) || (!spotLessThanOne && yesPrice < 1)) {
    const invertedYes = 1 / yesPrice;
    yesPrice = invertedYes;
  }

  // Process NO price
  if ((spotLessThanOne && noPrice > 1) || (!spotLessThanOne && noPrice < 1)) {
    const invertedNo = 1 / noPrice;
    noPrice = invertedNo;
  }
  // Do NOT invert third price - it's a probability and should remain as-is
}
```

## Important Notes

### Event Probability Exception
The **third price** (event probability from prediction pools) is **NEVER inverted** using spot price logic because it represents a probability value (0-1 range), not a price ratio.

### Real-time Updates
Real-time price updates (from websockets or polling) also apply the same spot-based inversion:

**File**: [src/components/futarchyFi/marketPage/MarketPageShowcase.jsx:2462-2466](../src/components/futarchyFi/marketPage/MarketPageShowcase.jsx#L2462-L2466)

```javascript
// Apply spot-based inversion to realtime YES price
if (newBasePrice !== null && newBasePrice > 0) {
  const spotLessThanOne = newBasePrice < 1;
  if ((spotLessThanOne && adjustedPrice > 1) || (!spotLessThanOne && adjustedPrice < 1)) {
    adjustedPrice = 1 / adjustedPrice;
  }
}
```

### Debug Information
The `MarketStatsDebugToast` component shows inversion status for all pools:

**File**: [src/components/futarchyFi/marketPage/MarketStatsDebugToast.jsx:59-79](../src/components/futarchyFi/marketPage/MarketStatsDebugToast.jsx#L59-L79)

```javascript
pools: {
  yesPool: {
    address: contractConfig?.POOL_CONFIG_YES?.address,
    tokenCompanySlot: contractConfig?.POOL_CONFIG_YES?.tokenCompanySlot,
    inverted: contractConfig?.POOL_CONFIG_YES?.tokenCompanySlot === 1
  },
  noPool: {
    address: contractConfig?.POOL_CONFIG_NO?.address,
    tokenCompanySlot: contractConfig?.POOL_CONFIG_NO?.tokenCompanySlot,
    inverted: contractConfig?.POOL_CONFIG_NO?.tokenCompanySlot === 1
  },
  predictionPools: {
    yes: {
      tokenBaseSlot: contractConfig?.PREDICTION_POOLS?.yes?.tokenBaseSlot,
      inverted: contractConfig?.PREDICTION_POOLS?.yes?.tokenBaseSlot === 0
    },
    no: {
      tokenBaseSlot: contractConfig?.PREDICTION_POOLS?.no?.tokenBaseSlot,
      inverted: contractConfig?.PREDICTION_POOLS?.no?.tokenBaseSlot === 0
    }
  }
}
```

## Summary Flow

```
1. Pool Address & Config
   ↓
2. Fetch sqrtPriceX96 from Pool
   ↓
3. Calculate Raw Price: (sqrtPrice)² / 2^192
   ↓
4. Apply tokenCompanySlot Inversion (if slot = 1)
   ↓
5. Compare to Spot Price
   ↓
6. Apply Spot-Based Alignment Inversion (if needed)
   ↓
7. Display on Chart
```

## Testing

To verify inversion logic is working correctly:

1. Check console logs for `[Supabase] Inverting YES/NO price:` messages
2. Verify YES/NO prices are in similar magnitude range as spot price
3. Use debug toast to confirm `tokenCompanySlot` values
4. Compare chart display with raw pool data from block explorer

## ChartParameters Component

**Location**: [src/components/futarchyFi/marketPage/tripleChart/chartParameters/ChartParameters.jsx](../src/components/futarchyFi/marketPage/tripleChart/chartParameters/ChartParameters.jsx)

The `ChartParameters` component displays the price parameters at the top of the chart. It receives prices that have already been processed through the inversion logic described above.

### Props

```javascript
ChartParameters({
  tradingPair = 'GNO/SDAI',
  spotPrice = 0,        // Already inverted/adjusted spot price
  yesPrice = 0,         // Already inverted/adjusted YES price
  noPrice = 0,          // Already inverted/adjusted NO price
  eventProbability = 0, // Event probability (NOT inverted)
  currency = 'SDAI',
  precision = 4,
  resolutionDetails,
  chartFilters = { spot: true, yes: true, no: true, impact: false },
  onFilterClick,
  predictionMarketLink = null,
  config = null
})
```

### Price Data Flow to ChartParameters

**In MarketPageShowcase** (lines 4783-4810):

The prices passed to `ChartParameters` come from state variables that have already undergone both inversion stages:

1. **Spot Price**: `newBasePrice` (from `latestPrices.spotPriceSDAI`)
   - Fetched from Supabase `pool_candles` table
   - Already inverted based on `BASE_POOL_CONFIG.currencySlot`

2. **YES Price**: `newYesPrice` (from `latestPrices.yes`)
   - Fetched from Supabase `pool_candles` table
   - Already inverted based on `POOL_CONFIG_YES.tokenCompanySlot`
   - **Then** spot-based alignment applied (lines 2360-2365)

3. **NO Price**: `newNoPrice` (from `latestPrices.no`)
   - Fetched from Supabase `pool_candles` table
   - Already inverted based on `POOL_CONFIG_NO.tokenCompanySlot`
   - **Then** spot-based alignment applied (lines 2367-2372)

### Impact Calculation

ChartParameters calculates **Impact** from the already-inverted prices:

```javascript
// Line 90
const impact = spotPrice > 0 && yesPrice !== null && noPrice !== null
  ? ((yesPrice - noPrice) / spotPrice) * 100
  : 0;
```

**Formula**: `Impact = ((YES - NO) / SPOT) × 100`

This shows the percentage price difference between YES and NO outcomes relative to the spot price.

### Important Note: Backend Price Adjustments

**As of the latest updates, the backend (Supabase) now handles price inversions based on `tokenCompanySlot` and `currencySlot` metadata.**

This means:
- The `pool_candles` table stores **already-adjusted** prices
- Frontend still applies **spot-based alignment** to ensure YES/NO are in same magnitude range as spot
- The `tokenCompanySlot`-based inversion happens at **data storage time**, not display time

### Disabling Frontend Spot-Based Inversion

**Flag Location**: [MarketPageShowcase.jsx:28](../src/components/futarchyFi/marketPage/MarketPageShowcase.jsx#L28)

```javascript
// Set this flag to false to disable spot-based price inversion (backend now handles price adjustments)
const ENABLE_SPOT_BASED_INVERSION = true;
```

**To disable frontend spot-based inversion** (when backend handles all price adjustments):
1. Set `ENABLE_SPOT_BASED_INVERSION = false` in MarketPageShowcase.jsx
2. This disables:
   - Initial price fetch inversion (lines 2359-2378)
   - Realtime YES price inversion (line 2465)
   - Realtime NO price inversion (line 2481)

**Important**: The `tokenCompanySlot`-based inversion in realtime updates (lines 2460-2462, 2476-2478) remains active regardless of this flag, as it's essential for correct pool price interpretation.

## Swap Outcomes Calculation

**Location**: [ShowcaseSwapComponent.jsx:1415-1419](../src/components/futarchyFi/marketPage/ShowcaseSwapComponent.jsx#L1415-L1419)

The swap component displays outcomes for both "If Yes" and "If No" scenarios. The calculation uses prices that have already been processed through the inversion logic:

### Outcome Formula

```javascript
// Line 1415-1419
const value = selectedAction === 'Buy'
  ? inputAmount / yesPrice  // Buy: divide input by price to get output tokens
  : inputAmount * yesPrice; // Sell: multiply input by price to get output currency
```

### Example from Screenshot

**Buying 1 sDAI**:
- **If Yes**: Receive `1.0 sDAI / 0.0172 sDAI per PNK = 58.14 PNK`
- **If No**: Recover `1.0 sDAI` (your input)

The prices (`yesPrice`, `noPrice`) used here are **already inverted** based on:
1. `tokenCompanySlot` setting from pool configuration
2. Spot-based alignment (if `ENABLE_SPOT_BASED_INVERSION = true`)

**Important Note**: If the backend now handles all price inversions correctly in the `pool_candles` table, and you've set `ENABLE_SPOT_BASED_INVERSION = false`, the outcomes will use the backend-adjusted prices directly. The swap outcome calculation itself doesn't need modification because it operates on already-adjusted price values.

## Related Files

- [src/components/chart/TripleChart.jsx](../src/components/chart/TripleChart.jsx) - Main chart component
- [src/hooks/useFutarchy.js](../src/hooks/useFutarchy.js) - Price calculation utilities
- [src/hooks/useContractConfig.js](../src/hooks/useContractConfig.js) - Configuration setup
- [src/components/futarchyFi/marketPage/MarketPageShowcase.jsx](../src/components/futarchyFi/marketPage/MarketPageShowcase.jsx) - Market page implementation
- [src/components/futarchyFi/marketPage/tripleChart/chartParameters/ChartParameters.jsx](../src/components/futarchyFi/marketPage/tripleChart/chartParameters/ChartParameters.jsx) - Chart parameters display
- [src/components/futarchyFi/marketPage/MarketStatsDebugToast.jsx](../src/components/futarchyFi/marketPage/MarketStatsDebugToast.jsx) - Debug information display
