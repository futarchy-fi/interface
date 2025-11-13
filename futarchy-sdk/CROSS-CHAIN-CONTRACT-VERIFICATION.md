# Cross-Chain Contract Verification

## Objective
Verify that the futarchy and DeFi contracts deployed on Ethereum and Polygon have compatible ABIs to ensure cross-chain functionality works correctly.

## Contracts to Verify

### 1. Futarchy Adapter
- **Purpose**: Handles splitting/merging of conditional tokens for futarchy markets
- **Ethereum**: `0xAc9Bf8EbA6Bd31f8E8c76f8E8B2AAd0BD93f98Dc`
- **Polygon**: `0x11a1EA07a47519d9900242e1b30a529ECD65588a`
- **Expected**: Should have same core functions (splitPosition, mergePositions)

### 2. Uniswap V3 Position Manager (NFPM)
- **Purpose**: Manages liquidity positions as NFTs
- **Ethereum**: `0xC36442b4a4522E871399CD717aBDD847Ab11FE88`
- **Polygon**: `0xC36442b4a4522E871399CD717aBDD847Ab11FE88`
- **Expected**: Same contract, identical ABI

### 3. Universal Router
- **Purpose**: Unified router for swaps and other operations
- **Ethereum**: `0x66a9893cc07d91d95644aedd05d03f95e1dba8af`
- **Polygon**: `0x1095692a6237d83c6a72f3f5efedb9a670c49223`
- **Expected**: Same interface, may have minor version differences

### 4. Permit2
- **Purpose**: Token approval and transfer management
- **Ethereum**: `0x000000000022D473030F116dDEE9F6B43aC78BA3`
- **Polygon**: `0x000000000022D473030F116dDEE9F6B43aC78BA3`
- **Expected**: Same contract, identical ABI

### 5. Uniswap V3 Factory
- **Purpose**: Creates and manages Uniswap V3 pools
- **Ethereum**: `0x1F98431c8aD98523631AE4a59F267346ea31F984`
- **Polygon**: `0x1F98431c8aD98523631AE4a59F267346ea31F984`
- **Expected**: Same contract, identical ABI

### 6. Futarchy Factory
- **Purpose**: Creates futarchy proposals and markets
- **Ethereum**: `0xf9369c0F7a84CAC3b7Ef78c837cF7313309D3678`
- **Polygon**: `0xF869237A00937eC7c497620d64e7cbEBdFdB3804`
- **Expected**: Same interface for createProposal function

### 7. Conditional Tokens
- **Purpose**: Creates conditional tokens for prediction markets
- **Ethereum**: `0xC0c1dFf0fE24108586e11EC9e20a7cBb405CB321`
- **Polygon**: Not deployed (uses different mechanism)
- **Gnosis**: `0xCeAfDD6bc0bEF976fdCd1112955828E00543c0Ce`

## Verification Steps

### Step 1: Check Contract Deployment
For each contract address:
1. Visit Etherscan/Polygonscan
2. Verify contract exists and is verified
3. Note if it's a proxy contract

### Step 2: Compare ABIs
For each contract pair:
1. Get ABI from Etherscan for Ethereum version
2. Get ABI from Polygonscan for Polygon version
3. Compare function signatures

### Step 3: Key Functions to Verify

#### Futarchy Adapter
```solidity
- splitPosition(address proposal, address collateralToken, uint256 amount)
- mergePositions(address proposal, address collateralToken, uint256 amount)
```

#### NFPM (Position Manager)
```solidity
- mint((address,address,uint24,int24,int24,uint256,uint256,uint256,uint256,address,uint256))
- positions(uint256) returns (uint96,address,address,address,uint24,int24,int24,uint128,uint256,uint256,uint128,uint128)
- increaseLiquidity((uint256,uint256,uint256,uint256,uint256,uint256))
- decreaseLiquidity((uint256,uint128,uint256,uint256,uint256))
- collect((uint256,address,uint128,uint128))
- burn(uint256)
```

#### Universal Router
```solidity
- execute(bytes commands, bytes[] inputs, uint256 deadline)
```

#### Permit2
```solidity
- permit(address owner, PermitSingle memory permitSingle, bytes calldata signature)
- permitTransferFrom(PermitTransferFrom memory permit, SignatureTransferDetails calldata transferDetails, address owner, bytes calldata signature)
```

#### Uniswap V3 Factory
```solidity
- createPool(address tokenA, address tokenB, uint24 fee)
- getPool(address tokenA, address tokenB, uint24 fee)
```

## Quick Verification URLs

### Ethereum Mainnet
- [Futarchy Adapter](https://etherscan.io/address/0xAc9Bf8EbA6Bd31f8E8c76f8E8B2AAd0BD93f98Dc#code)
- [NFPM](https://etherscan.io/address/0xC36442b4a4522E871399CD717aBDD847Ab11FE88#code)
- [Universal Router](https://etherscan.io/address/0x66a9893cc07d91d95644aedd05d03f95e1dba8af#code)
- [Permit2](https://etherscan.io/address/0x000000000022D473030F116dDEE9F6B43aC78BA3#code)
- [Uniswap V3 Factory](https://etherscan.io/address/0x1F98431c8aD98523631AE4a59F267346ea31F984#code)
- [Futarchy Factory](https://etherscan.io/address/0xf9369c0F7a84CAC3b7Ef78c837cF7313309D3678#code)

### Polygon
- [Futarchy Adapter](https://polygonscan.com/address/0x11a1EA07a47519d9900242e1b30a529ECD65588a#code)
- [NFPM](https://polygonscan.com/address/0xC36442b4a4522E871399CD717aBDD847Ab11FE88#code)
- [Universal Router](https://polygonscan.com/address/0x1095692a6237d83c6a72f3f5efedb9a670c49223#code)
- [Permit2](https://polygonscan.com/address/0x000000000022D473030F116dDEE9F6B43aC78BA3#code)
- [Uniswap V3 Factory](https://polygonscan.com/address/0x1F98431c8aD98523631AE4a59F267346ea31F984#code)
- [Futarchy Factory](https://polygonscan.com/address/0xF869237A00937eC7c497620d64e7cbEBdFdB3804#code)

## Expected Results

### ✅ Identical Contracts (Same Address)
- NFPM (0xC36442b4a4522E871399CD717aBDD847Ab11FE88)
- Permit2 (0x000000000022D473030F116dDEE9F6B43aC78BA3)
- Uniswap V3 Factory (0x1F98431c8aD98523631AE4a59F267346ea31F984)

### ⚠️ Different Addresses, Same Interface
- Universal Router (different deployments but same interface)
- Futarchy Adapter (custom per chain but same core functions)
- Futarchy Factory (different deployments but same createProposal)

### ❌ Chain-Specific
- Conditional Tokens (only on Ethereum and Gnosis, not Polygon)

## Manual Verification Process

1. **Open both explorers** in separate tabs
2. **Navigate to contract** addresses
3. **Click "Contract" tab** then "Read Contract" or "Write Contract"
4. **Compare available functions**
5. **Check function parameters** match

## Notes

- Contracts at the same address (like NFPM) are guaranteed to have the same bytecode
- Different addresses may still have compatible interfaces
- Proxy contracts may show different implementation addresses
- Some contracts may have additional chain-specific functions

## Conclusion

Most critical contracts (NFPM, Permit2, Factory) share the same addresses and ABIs across chains. The Futarchy Adapter and Universal Router have different addresses but should maintain compatible interfaces for the core functions used by the SDK.