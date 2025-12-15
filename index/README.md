# Proportional Liquidity Hook for Balancer v3

A custom Balancer v3 hook contract that enforces strict proportional liquidity operations for index funds. This contract ensures that all liquidity additions and removals maintain the exact proportions of the initial pool weights.

## Overview

This project implements a smart contract hook that can be used with Balancer v3 pools to create index funds with strict proportional requirements. For example, in a 2:1 WBTC:WETH index, users can only add or remove liquidity in the exact 2:1 ratio - adding 1 WETH requires exactly 2 WBTC.

## Features

- ✅ **Strict Proportional Enforcement**: All liquidity operations must maintain exact weight ratios
- ✅ **Flexible Weight Configuration**: Support for any token ratio (2:1, 3:1, 60:40, etc.)
- ✅ **Proportional Calculations**: Helper functions to calculate exact amounts needed
- ✅ **Gnosis Chain Ready**: Configured for deployment on Gnosis Chain
- ✅ **Gas Optimized**: Efficient validation with minimal gas overhead
- ✅ **Comprehensive Testing**: Full test suite for all functionality

## Project Structure

```
index/
├── contracts/
│   ├── ProportionalLiquidityHook.sol  # Main hook contract
│   └── Lock.sol                       # Example contract (can be removed)
├── scripts/
│   └── deploy.js                      # Deployment script
├── test/
│   └── ProportionalLiquidityHook.test.js  # Test suite
├── hardhat.config.js                 # Hardhat configuration
├── package.json                      # Dependencies
└── README.md                         # This file
```

## Setup

1. **Install Dependencies**
   ```bash
   cd index
   npm install
   ```

2. **Configure Environment**
   Create a `.env` file with your configuration:
   ```
   PRIVATE_KEY=your_private_key_here
   GNOSIS_RPC_URL=https://rpc.gnosischain.com
   GNOSISSCAN_API_KEY=your_api_key_here
   ```

## Usage

### Running Tests

```bash
npm test
```

### Deploying to Gnosis Chain

1. **Deploy to Gnosis Testnet (Chiado)**
   ```bash
   npx hardhat run scripts/deploy.js --network gnosisChiado
   ```

2. **Deploy to Gnosis Mainnet**
   ```bash
   npx hardhat run scripts/deploy.js --network gnosis
   ```

### Local Development

```bash
# Start local Hardhat node
npx hardhat node

# Deploy to local network
npx hardhat run scripts/deploy.js --network localhost
```

## Contract Details

### Constructor Parameters

The contract is deployed with:
- `tokens`: Array of token addresses (e.g., [WBTC, WETH])
- `weights`: Array of weights (e.g., [200, 100] for 2:1 ratio)
- `owner`: Address that owns the contract

### Key Functions

#### `calculateProportionalAmounts(baseTokenIndex, baseAmount)`
Calculates the exact amounts needed for all tokens given a base amount.

```solidity
// Example: Calculate amounts needed if providing 1 WETH
uint256[] memory amounts = hook.calculateProportionalAmounts(1, 1e18);
// Returns: [2e8, 1e18] (2 WBTC, 1 WETH)
```

#### `addLiquidity(amounts, minLpTokens)`
Adds liquidity in strict proportion to pool weights.

#### `removeLiquidity(lpTokens, minAmounts)`
Removes liquidity in strict proportion.

## Example: 2:1 WBTC:WETH Index

### Deployment Configuration

```javascript
const poolTokens = [
  "0x8e5bBbb09Ed1ebdE8674Cda39A0c169401db4252", // WBTC on Gnosis
  "0x6A023CCd1ff6F2045C3309768eAd9E68F978f6e1"  // WETH on Gnosis
];
const poolWeights = [200, 100]; // 2:1 ratio
```

### Usage Examples

1. **Adding 1 WETH requires exactly 2 WBTC**
   ```javascript
   const amounts = await hook.calculateProportionalAmounts(1, ethers.utils.parseEther("1"));
   // amounts[0] = 2 WBTC (in wei, 8 decimals)
   // amounts[1] = 1 WETH (in wei, 18 decimals)
   ```

2. **Adding 0.5 WBTC requires exactly 0.25 WETH**
   ```javascript
   const amounts = await hook.calculateProportionalAmounts(0, ethers.utils.parseUnits("0.5", 8));
   // amounts[0] = 0.5 WBTC
   // amounts[1] = 0.25 WETH
   ```

## Token Addresses on Gnosis Chain

| Token | Address | Decimals |
|-------|---------|----------|
| WBTC  | `0x8e5bBbb09Ed1ebdE8674Cda39A0c169401db4252` | 8 |
| WETH  | `0x6A023CCd1ff6F2045C3309768eAd9E68F978f6e1` | 18 |

## Security Features

- **Reentrancy Protection**: Uses OpenZeppelin's ReentrancyGuard
- **Access Control**: Owner-only functions with OpenZeppelin's Ownable
- **Input Validation**: Comprehensive validation of all inputs
- **Precision Handling**: Careful handling of different token decimals
- **Proportion Validation**: Strict checking with small tolerance for rounding

## Gas Optimization

- Efficient calculation algorithms
- Minimal storage usage
- Optimized loops and calculations
- Pre-calculated ratios to reduce computation

## Testing

The test suite covers:
- ✅ Deployment configuration
- ✅ Proportional calculations
- ✅ Input validation
- ✅ Error conditions
- ✅ Edge cases
- ✅ Different weight configurations
- ✅ Event emissions

Run tests with:
```bash
npx hardhat test
```

## Integration with Balancer v3

This hook is designed to integrate with Balancer v3 pools. The hook enforces proportional liquidity operations while Balancer handles:
- Token transfers
- Fee collection
- Pool token minting/burning
- Price discovery
- Swapping functionality

## Future Enhancements

- [ ] Integration with actual Balancer v3 hook interface
- [ ] Dynamic weight adjustment mechanisms
- [ ] Governance features for weight updates
- [ ] Advanced mathematical libraries for precision
- [ ] Gas optimization for large token arrays
- [ ] Emergency pause functionality

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## Support

For questions or issues:
- Create an issue in the repository
- Check the test files for usage examples
- Review the contract comments for detailed explanations
