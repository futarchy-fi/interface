# Pool Search & Create Component

A React component that provides an interface for searching existing Algebra/Swapr pools and creating new ones with guided approval and liquidity provision.

## Features

✨ **Pool Discovery**: Search for existing pools by token pair addresses
📊 **Pool Information**: Display current pool price and metadata
🔗 **Blockchain Links**: Direct links to Gnosisscan for verification
🏗️ **Pool Creation**: Guided pool creation with step-by-step progress
💰 **Automatic Approvals**: Handle ERC20 token approvals automatically
⚡ **Real-time Updates**: Live balance checking and validation
🎯 **Pool Type Detection**: Automatically detect pool types (Prediction Market, Conditional, Regular)

## Usage

### Basic Usage

```jsx
import PoolSearchAndCreate from './components/PoolSearchAndCreate';

function App() {
  return (
    <div>
      <PoolSearchAndCreate />
    </div>
  );
}
```

### With Demo Wrapper

```jsx
import PoolSearchDemo from './components/PoolSearchDemo';

function App() {
  return (
    <div>
      <PoolSearchDemo />
    </div>
  );
}
```

## How It Works

1. **Search Phase**
   - User enters two token addresses
   - Component validates addresses and loads token metadata
   - Searches for existing pools using the Algebra factory
   - Displays pool information if found

2. **Creation Phase** (if pool doesn't exist)
   - User clicks "Create Pool" button
   - Enters desired liquidity amounts for both tokens
   - Component calculates initial price ratio
   - Guided step-by-step execution:
     - Check token balances
     - Handle token approvals (if needed)
     - Create pool and initialize with price
     - Mint liquidity position

## Pool Types Detected

- **Regular Pool**: Two base tokens (e.g., GNO/sDAI)
- **Prediction Market**: One conditional token + one base token (e.g., YES_GNO/sDAI)
- **Conditional Correlated**: Two conditional tokens with same outcome (e.g., YES_GNO/YES_sDAI)

## Technical Details

### Contract Addresses
- **Position Manager**: `0x91fd594c46d8b01e62dbdebed2401dde01817834`
- **Router**: `0xffb643e73f280b97809a8b41f7232ab401a04ee1`

### Pool Creation Parameters
- **Tick Range**: Full range (-887272 to 887272)
- **Gas Limit**: 15,000,000 (optimized for Gnosis Chain)
- **Slippage**: 0% (minimum amounts set to 0)
- **Deadline**: 20 minutes from creation

### Price Calculation
- Uses sqrtPriceX96 format for pool initialization
- Automatically handles token ordering (token0 < token1)
- Calculates price as token1/token0 ratio

## Dependencies

- **ethers.js**: For blockchain interactions
- **React Hooks**: useState, useCallback, useEffect
- **Custom Hooks**: usePoolCreation for pool creation logic
- **Utils**: poolUtils, tokenUtils for helper functions

## Error Handling

- Invalid token addresses
- Insufficient balances
- Network connectivity issues
- Transaction failures
- Approval failures

## State Management

The component manages several state variables:
- `token0Address`, `token1Address`: Token input addresses
- `searchResult`: Pool search results and metadata
- `createFormData`: Pool creation form inputs
- `loading`: Search operation status
- `error`: Error messages for user feedback

## Integration with Existing System

The component integrates with the existing refactor system:
- Uses existing `poolUtils` for pool discovery
- Leverages `tokenUtils` for address formatting
- Utilizes existing ABI definitions
- Follows established error handling patterns

## Example Token Addresses (Gnosis Chain)

```javascript
const COMMON_TOKENS = {
  'sDAI': '0xaf204776c7245bF4147c2612BF6e5972Ee483701',
  'GNO': '0x9C58BAcC331c9aa871AFD802DB6379a98e80CEdb',
  'YES_sDAI': '0x9ea98d3f845c3b3bdb2310aa5c301505b61402c7',
  'NO_sDAI': '0x24334a29a324ed40a08aaf035bbedff374313145',
  'YES_GNO': '0x481c7bfaf541d3c42a841a752c19c4664708ff5d',
  'NO_GNO': '0x5cde0e3d8b69345b7a6143cfb3fdf4d4a6659d5d'
};
```

## Security Considerations

- Always verify token addresses before creating pools
- Test with small amounts first
- Monitor gas costs on Gnosis Chain
- Ensure proper network connection (Gnosis Chain mainnet)
- Validate pool creation before providing large liquidity amounts

## Future Enhancements

- [ ] Add slippage configuration options
- [ ] Support for custom tick ranges
- [ ] Batch pool creation
- [ ] Pool statistics and analytics
- [ ] Integration with price oracles
- [ ] Support for other DEX protocols 