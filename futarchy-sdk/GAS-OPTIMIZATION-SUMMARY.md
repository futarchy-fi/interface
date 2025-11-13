# Gas Optimization Summary for Ethereum Mainnet

## ✅ All Gas Settings Fixed

### Files Updated:
1. **`utils/tokens.js`**
   - Token approvals now use chain-appropriate gas
   - Fixed both reset approval and main approval

2. **`modules/futarchyAdapter.js`**
   - Split position transactions fixed
   - Merge position transactions fixed

3. **`modules/poolManager.js`**
   - Create pool transactions fixed
   - Mint position (add liquidity) transactions fixed

4. **`modules/proposalCreator.js`**
   - Already correct at 5M gas limit (increased from 1.5M)

## Gas Pricing by Chain

### Ethereum (Chain 1)
- **Minimum Priority Fee**: 1 Gwei
- **Typical Total**: 2-5 Gwei (depending on base fee)

### Polygon (Chain 137)
- **Minimum Priority Fee**: 25 Gwei
- **Typical Total**: 50+ Gwei

### Other Chains
- **Minimum Priority Fee**: 2 Gwei
- **Typical Total**: 4-10 Gwei

## Estimated Transaction Costs on Ethereum

With current base fee ~0.26 Gwei and 1 Gwei priority:

| Transaction | Gas Limit | Old Cost (25 Gwei) | New Cost (1.26 Gwei) | Savings |
|------------|-----------|-------------------|---------------------|---------|
| Approve Token | 100k | 0.0025 ETH | 0.000126 ETH | 95% |
| Split Tokens | 15M | 0.375 ETH | 0.0189 ETH | 95% |
| Merge Tokens | 15M | 0.375 ETH | 0.0189 ETH | 95% |
| Create Pool | 16M | 0.4 ETH | 0.0202 ETH | 95% |
| Add Liquidity | 15M | 0.375 ETH | 0.0189 ETH | 95% |
| Create Proposal | 5M | 0.125 ETH | 0.0063 ETH | 95% |

## Total Setup Cost Estimate

### Old (25 Gwei minimum):
- Full setup: **2-3 ETH**
- Per pool: **~0.4 ETH**

### New (1 Gwei for Ethereum):
- Full setup: **0.1-0.15 ETH**
- Per pool: **~0.02 ETH**

## How It Works

The code now automatically detects the chain ID and applies appropriate minimums:

```javascript
const chainId = (await this.provider.getNetwork()).chainId;
const minTipGwei = chainId === 1n ? '1' : (chainId === 137n ? '25' : '2');
const minTip = ethers.parseUnits(minTipGwei, 'gwei');
```

## No Action Required

Just run your commands as normal. The system will automatically use appropriate gas prices for each chain.