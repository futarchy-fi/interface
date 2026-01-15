# useFutarchy Hook Documentation

The `useFutarchy` hook provides a comprehensive interface for interacting with Futarchy markets, managing positions, and executing swaps. This hook is designed to handle all the complexities of token approvals, position management, and market interactions.

## Important: Contract Configuration

⚠️ **Critical Note**: The `useFutarchy` hook MUST be initialized with a contract configuration object. Do not import contract addresses and configurations directly from `contracts.js`. Instead, pass them through the `contractConfig` object. This allows for:
- Dynamic contract address management
- Environment-specific configurations
- Easier testing and development
- Runtime configuration updates

Example of correct usage:
```javascript
// ✅ CORRECT: Pass configuration through contractConfig
const contractConfig = {
  marketAddress: YOUR_MARKET_ADDRESS,
  futarchyRouterAddress: YOUR_ROUTER_ADDRESS,
  // ... rest of config
};
const { smartSwap, balances } = useFutarchy(contractConfig);

// ❌ INCORRECT: Don't use direct imports
// import { MARKET_ADDRESS } from './contracts.js' // Don't do this
```

### Configuration Validation

The hook performs validation on the provided configuration. Missing or invalid values will result in errors. Ensure all required fields are provided:

```javascript
const requiredConfig = {
  marketAddress: "Required for market interactions",
  futarchyRouterAddress: "Required for router operations",
  sushiswapRouterAddress: "Required for swaps",
  baseTokens: {
    currency: {
      address: "Required for currency token",
      // ... other fields
    },
    company: {
      address: "Required for company token",
      // ... other fields
    }
  },
  positions: {
    // ... position configurations
  }
};
```

## Installation

```javascript
import { useFutarchy } from '../../hooks/useFutarchy';
```

## Basic Usage

```javascript
const {
  balances,
  loading,
  error,
  status,
  smartSwap,
  closePositions,
  updateBalances,
  getTotalAvailableBalance,
  startAutoRefresh,
  stopAutoRefresh,
  getPosition,
  canCloseCurrency,
  removeCollateral,
  useMaxToRemove
} = useFutarchy(contractConfig);
```

## Configuration

The hook accepts a contract configuration object with the following structure:

```javascript
const contractConfig = {
  marketAddress: string,
  futarchyRouterAddress: string,
  sushiswapRouterAddress: string,
  baseTokens: {
    currency: {
      address: string,
      name: string,
      symbol: string,
      decimals: number
    },
    company: {
      address: string,
      name: string,
      symbol: string,
      decimals: number
    }
  },
  positions: {
    currency: {
      yes: { wrap: { tokenName: string, tokenSymbol: string, wrappedCollateralTokenAddress: string } },
      no: { wrap: { tokenName: string, tokenSymbol: string, wrappedCollateralTokenAddress: string } }
    },
    company: {
      yes: { wrap: { tokenName: string, tokenSymbol: string, wrappedCollateralTokenAddress: string } },
      no: { wrap: { tokenName: string, tokenSymbol: string, wrappedCollateralTokenAddress: string } }
    }
  }
};
```

## State Values

### `balances`
Object containing current token balances for all positions:
```javascript
{
  currency: {
    wallet: { formatted: string, amount: BigNumber },
    collateral: { yes: string, no: string, formatted: string }
  },
  company: {
    wallet: { formatted: string, amount: BigNumber },
    collateral: { yes: string, no: string, formatted: string }
  }
}
```

### `loading`
Boolean indicating if any operation is in progress.

### `error`
String containing any error message.

### `status`
String indicating the current operation status.

## Core Functions

### `smartSwap`
Execute a smart swap between tokens with automatic collateral management.

```javascript
const result = await smartSwap({
  tokenType: 'currency' | 'company',
  amount: string,
  eventHappens: boolean,
  action: 'buy' | 'sell',
  callbacks: {
    onStart: () => void,
    onStatus: (message: string) => void,
    onCollateralNeeded: (amount: string) => void,
    onCollateralAdded: () => void,
    onSwapStart: () => void,
    onSwapComplete: (tx: Transaction) => void,
    onError: (error: Error) => void
  }
});
```

### `removeCollateral`
Remove collateral by merging YES/NO positions back into base tokens.

```javascript
await removeCollateral(
  tokenType: 'currency' | 'company',
  amount: string,
  callbacks: {
    onStart: () => void,
    onYesApprove: () => void,
    onNoApprove: () => void,
    onMerge: (tx: Transaction) => void,
    onComplete: (receipt: TransactionReceipt) => void,
    onError: (error: Error) => void
  }
);
```

### `closePositions`
Close surplus positions by swapping them for matching tokens.

```javascript
await closePositions(
  tokenType: 'currency' | 'company',
  callbacks: {
    onStart: () => void,
    onApprove: () => void,
    onFetchRoute: () => void,
    onSwap: () => void,
    onSwapSent: (tx: Transaction) => void,
    onComplete: (receipt: TransactionReceipt) => void,
    onError: (error: Error) => void
  }
);
```

### `getPosition`
Get detailed position information including surplus calculations.

```javascript
const position = getPosition(tokenType: 'currency' | 'company');
// Returns:
{
  yes: string,
  no: string,
  surplus: {
    amount: string,
    type: 'YES' | 'NO',
    hasYesSurplus: boolean,
    hasNoSurplus: boolean
  },
  total: string
}
```

### `useMaxToRemove`
Get maximum amount of collateral that can be removed.

```javascript
const maxAmount = useMaxToRemove(tokenType: 'currency' | 'company');
// Returns string representing maximum removable amount
```

### `getTotalAvailableBalance`
Calculate total available balance including wallet and position.

```javascript
const balance = getTotalAvailableBalance(
  tokenType: 'currency' | 'company',
  eventHappens: boolean
);
// Returns: { raw: BigNumber, formatted: string }
```

### `canCloseCurrency`
Check if currency position can be closed (requires opposite company position).

```javascript
const canClose = canCloseCurrency();
// Returns: boolean
```

## Balance Management Functions

### `updateBalances`
Force update of all balances.

```javascript
await updateBalances();
```

### `startAutoRefresh`
Start automatic balance refresh at specified interval.

```javascript
startAutoRefresh(intervalMs: number = 5000);
```

### `stopAutoRefresh`
Stop automatic balance refresh.

```javascript
stopAutoRefresh();
```

## Example Usage

### Executing a Swap
```javascript
// Buy YES company tokens with currency
await smartSwap({
  tokenType: 'currency',
  amount: '1.0',
  eventHappens: true,
  action: 'buy',
  onStart: () => setStatus('Starting swap...'),
  onComplete: (tx) => setStatus(`Swap complete: ${tx.hash}`)
});
```

### Removing Collateral
```javascript
// Remove currency collateral
await removeCollateral('currency', '0.5', {
  onStart: () => setStatus('Starting collateral removal...'),
  onComplete: (receipt) => setStatus('Collateral removed successfully')
});
```

### Closing Positions
```javascript
// Close currency positions
await closePositions('currency', {
  onStart: () => setStatus('Starting position closure...'),
  onComplete: (receipt) => setStatus('Position closed successfully')
});
```

### Checking Balances
```javascript
// Get position details
const position = getPosition('currency');
console.log('YES balance:', position.yes);
console.log('NO balance:', position.no);
console.log('Surplus:', position.surplus.amount, position.surplus.type);

// Get maximum removable amount
const maxRemovable = useMaxToRemove('currency');
console.log('Max removable:', maxRemovable);

// Get total available balance
const totalBalance = getTotalAvailableBalance('currency', true);
console.log('Total available:', totalBalance.formatted);
```

## Error Handling

The hook includes comprehensive error handling. All functions that can fail will:
1. Set the `error` state with a descriptive message
2. Call the appropriate error callback if provided
3. Throw the error for catch blocks

```javascript
try {
  await smartSwap({
    // ... swap parameters
    onError: (err) => console.error('Swap failed:', err)
  });
} catch (err) {
  console.error('Error caught:', err);
}
```

## Best Practices

1. Always check `loading` state before starting new operations
2. Use the provided callbacks for better UX during long operations
3. Implement proper error handling using try/catch blocks
4. Use `updateBalances()` after operations to ensure current state
5. Consider using `startAutoRefresh()` during active trading periods 