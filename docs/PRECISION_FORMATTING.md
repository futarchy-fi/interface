# Precision Formatting System

This document describes the centralized precision formatting system implemented across the futarchy web application.

## Overview

The application uses a configuration-driven precision formatting system that allows easy control of decimal places displayed throughout the UI. Instead of hardcoded `.toFixed()` calls, all number formatting now uses the `formatWith()` utility function that reads from `PRECISION_CONFIG`.

## Core Files

### 1. Precision Formatter Utility
**File:** `src/utils/precisionFormatter.js`

Main functions:
- `formatWith(value, type, config)` - Format numbers using config types
- `formatWithClean(value, type, config)` - Same as above, removes trailing zeros
- `formatPercentage(value, config)` - Format percentages
- `getPrecision(type, config)` - Get precision value for a type

### 2. Precision Configuration
**File:** `src/components/futarchyFi/marketPage/constants/contracts.js`

Configuration object:
```javascript
export const PRECISION_CONFIG = {
    display: {
        main: 4,          // Used in ChartParameters and main UI displays
        default: 2,       // General purpose, K/M/Bil suffixes, percentages
        price: 4,         // Price displays, trade outcomes
        amount: 6,        // Amount displays
        balance: 1,       // Balance panel wallet displays
        percentage: 2,    // Percentage values
        smallNumbers: 20  // Very small numbers (< 0.0001)
    },
    // ... other config
}
```

## Components Updated

### Chart Parameters (Triple Chart Header)
**File:** `src/components/futarchyFi/marketPage/tripleChart/chartParameters/ChartParameters.jsx`

**Changes:**
- Imported `formatWith` from precisionFormatter
- Replaced all `.toFixed(precision)` calls with `formatWith(value, 'price')`
- Event Probability uses `formatWith(value, 'default')`
- Impact percentage uses `formatWith(value, 'default')`

**Precision Types Used:**
- Spot Price: `'price'` (4 decimals)
- Yes Price: `'price'` (4 decimals)
- No Price: `'price'` (4 decimals)
- Event Probability: `'default'` (2 decimals)
- Impact: `'default'` (2 decimals)

**Example:**
```javascript
// Before
value={spotPrice === null ? <LoadingSpinner /> : `${spotPrice.toFixed(precision)} ${currency}`}

// After
value={spotPrice === null ? <LoadingSpinner /> : `${formatWith(spotPrice, 'price')} ${currency}`}
```

### Positions Table
**File:** `src/components/futarchyFi/marketPage/PositionsTable.jsx`

**Changes:**
- Imported `formatWith` from precisionFormatter
- Updated `formatSmallAmount()` helper function to use `formatWith()`

**Precision Types Used:**
- Small amounts (< 0.1): `'amount'` (6 decimals)
- Regular amounts: `'balance'` (1 decimal)

**Example:**
```javascript
// Before
if (num < 0.1) return `${num.toFixed(6)} ${symbol}`;
return `${num.toFixed(4)} ${symbol}`;

// After
if (num < 0.1) return `${formatWith(num, 'amount')} ${symbol}`;
return `${formatWith(num, 'balance')} ${symbol}`;
```

### Market Balance Panel
**File:** `src/components/futarchyFi/marketPage/MarketBalancePanel.jsx`

**Changes:**
- Imported `formatWith` from precisionFormatter
- Replaced `formatBalance()` wrapper calls with direct `formatWith()` usage
- Updated both `WalletBalanceItem` and `BalanceItem` components

**Precision Types Used:**
- Wallet balances: `'balance'` (1 decimal)
- Position balances: `'balance'` (1 decimal)

**Example:**
```javascript
// Before
{isLoading ? <LoadingSpinner /> : formatBalance(parseFloat(walletBalance || '0').toFixed(6), tokenName, 4)}

// After
{isLoading ? <LoadingSpinner /> : `${formatWith(parseFloat(walletBalance || '0'), 'balance')} ${tokenName}`}
```

### Showcase Swap Component (Trade Panel)
**File:** `src/components/futarchyFi/marketPage/ShowcaseSwapComponent.jsx`

**Changes:**
- Imported `formatWith` from precisionFormatter
- Updated expected receive amount calculations to use `formatWith()`
- Updated all "Outcomes" section amounts (Receive/Recover)

**Precision Types Used:**
- Expected receive amounts: `'balance'` (8 decimals) → Changed to `'price'` (4 decimals)
- Outcomes "Receive" amounts: `'price'` (4 decimals)
- Outcomes "Recover" amounts: `'price'` (4 decimals)

**Example:**
```javascript
// Before
expectedReceiveAmount = rawExpected.toFixed(18);

// After
expectedReceiveAmount = formatWith(rawExpected, 'balance');

// Outcomes section - Before
{formatBalance((inputAmount / yesPrice).toString(), getCompanySymbol())}

// Outcomes section - After
{`${formatWith(inputAmount / yesPrice, 'price')} ${getCompanySymbol()}`}
```

### Confirm Swap Modal
**File:** `src/components/futarchyFi/marketPage/ConfirmSwapModal.jsx`

**Changes:**
- Imported `formatWith` from precisionFormatter
- Updated expected receive display
- Updated minimum receive display (with slippage)

**Precision Types Used:**
- Expected receive: `'amount'` (6 decimals)
- Minimum receive: `'amount'` (6 decimals)

**Example:**
```javascript
// Before
{parseFloat(transactionData.expectedReceiveAmount).toFixed(6)} {transactionData.receiveToken}

// After
{formatWith(parseFloat(transactionData.expectedReceiveAmount), 'amount')} {transactionData.receiveToken}
```

### Hero Section Formatters
**File:** `src/components/futarchyFi/marketPage/page/Formatter.jsx`

**Changes:**
- Imported `formatWith` from precisionFormatter
- Updated `formatVolume()` to use `formatWith()` instead of hardcoded `.toFixed()`
- Updated `formatLiquidity()` to use `formatWith()` instead of hardcoded `.toFixed()`
- Updated `formatNumber()` to use `formatWith()` for K/M/Bil suffixes

**Precision Types Used:**
- Volume >= 1M: `'default'` (2 decimals) + "M" suffix
- Volume >= 1K: `'default'` (2 decimals) + "K" suffix
- Volume < 1: `'price'` (4 decimals)
- Volume default: `'default'` (2 decimals)
- Liquidity: Same as Volume

**Example:**
```javascript
// Before
if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
if (num < 1) return num.toFixed(4);
return num.toFixed(2);

// After
if (num >= 1000000) return `${formatWith(num / 1000000, 'default')}M`;
if (num >= 1000) return `${formatWith(num / 1000, 'default')}K`;
if (num < 1) return formatWith(num, 'price');
return formatWith(num, 'default');
```

## UI Sections and Their Precision Types

### Hero Section (Top Stats)
- **Impact**: `'default'` (2 decimals) → e.g., "3.23%"
- **Volume (Y/N)**:
  - Large: `'default'` + K/M suffix → e.g., "3.02K"
  - Small: `'price'` → e.g., "0.0017"
- **Liquidity (Y/N)**: Same as Volume

### Chart Parameters (Chart Header)
- **Spot Price**: `'price'` (4 decimals) → e.g., "445.5000 USDS"
- **Yes Price**: `'price'` (4 decimals) → e.g., "446.6000 USDS"
- **No Price**: `'price'` (4 decimals) → e.g., "432.2000 USDS"
- **Event Probability**: `'default'` (2 decimals) → e.g., "50.00%"
- **Impact**: `'default'` (2 decimals) → e.g., "3.20%"

### Positions Table
- **Receive amounts**:
  - Small (< 0.1): `'amount'` (6 decimals) → e.g., "0.000000 TSLAon"
  - Regular: `'balance'` (1 decimal) → e.g., "0.8 USDS"

### Trade Panel / Swap Component
- **Outcomes - Receive**: `'price'` (4 decimals) → e.g., "0.0022 TSLAon"
- **Outcomes - Recover**: `'price'` (4 decimals) → e.g., "1.0000 USDS"
- **Available Balance**: Displays as-is from balance panel

### Balance Panel
- **Wallet Balances**: `'balance'` (1 decimal) → e.g., "1.1 USDS", "0.0 TSLAon"

### Confirm Swap Modal
- **Expected Receive**: `'amount'` (6 decimals) → e.g., "0.002239 TSLAon"
- **Minimum Receive**: `'amount'` (6 decimals) → e.g., "0.002194 TSLAon"

## How to Adjust Precision

Edit the configuration in `src/components/futarchyFi/marketPage/constants/contracts.js`:

```javascript
export const PRECISION_CONFIG = {
    display: {
        main: 4,          // Change to adjust chart header precision
        default: 2,       // Change to adjust percentages, K/M/Bil
        price: 4,         // Change to adjust price and outcome displays
        amount: 6,        // Change to adjust amount displays
        balance: 1,       // Change to adjust balance panel displays
        percentage: 2,    // Change to adjust percentage displays
        smallNumbers: 20  // For very small numbers (< 0.0001)
    }
}
```

**Changes take effect immediately** in development mode when the file is saved.

## Examples of Precision Adjustments

### Increase Balance Panel Precision
To show more decimals in the balance panel (currently showing "1.1 USDS", "0.0 TSLAon"):

```javascript
balance: 3  // Changes to "1.126 USDS", "0.002 TSLAon"
balance: 6  // Changes to "1.125621 USDS", "0.002081 TSLAon"
```

### Decrease Outcome Precision
To show fewer decimals in trade outcomes (currently showing "0.0022 TSLAon"):

```javascript
price: 2  // Changes to "0.00 TSLAon"
price: 6  // Changes to "0.002239 TSLAon"
```

### Adjust Hero Stats
To change volume/liquidity display (currently "3.02K"):

```javascript
default: 1  // Changes to "3.0K"
default: 3  // Changes to "3.020K"
```

## Benefits

1. **Single Source of Truth**: All precision values in one config file
2. **Easy Maintenance**: Change one value to update precision across multiple components
3. **Consistent Display**: Same precision types show the same decimal places everywhere
4. **Type Safety**: Named types ('price', 'balance', etc.) make code self-documenting
5. **Flexible**: Can override config per-call if needed
6. **Clean Code**: No magic numbers scattered throughout components

## Migration Notes

When updating existing code to use this system:

1. Import the formatter:
   ```javascript
   import { formatWith } from '../../../utils/precisionFormatter';
   ```

2. Replace `.toFixed()` calls:
   ```javascript
   // Before
   value.toFixed(4)

   // After
   formatWith(value, 'price')  // or appropriate type
   ```

3. Choose the appropriate precision type based on context:
   - Prices, outcomes → `'price'`
   - Balances, wallets → `'balance'`
   - Amounts, quantities → `'amount'`
   - Percentages → `'percentage'` or `'default'`
   - General displays → `'default'`

4. Remove any wrapper formatters that just add labels:
   ```javascript
   // Before
   formatBalance(value.toFixed(6), tokenName, 4)

   // After
   `${formatWith(value, 'balance')} ${tokenName}`
   ```

## Testing

To verify precision changes:

1. Start dev server: `npm run dev`
2. Navigate to a market page
3. Edit `PRECISION_CONFIG` in `contracts.js`
4. Save file (hot reload will apply changes)
5. Verify displays update with new precision

All changes are reflected immediately in development mode without manual refresh needed.
