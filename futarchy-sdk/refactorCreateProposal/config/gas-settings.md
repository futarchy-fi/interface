# Gas Settings Configuration

## Default Gas Prices by Chain

After the update, gas prices are automatically adjusted based on chain:

- **Ethereum (Chain 1)**: 1 Gwei minimum priority fee
- **Polygon (Chain 137)**: 25 Gwei minimum priority fee
- **Other chains**: 2 Gwei minimum priority fee

## Override via Environment Variables

You can override gas settings by adding these to your `.env` file:

```env
# Force specific gas settings (in Gwei)
MAX_PRIORITY_FEE_GWEI=0.5
MAX_FEE_GWEI=10

# Or use legacy gas price
GAS_PRICE_GWEI=2
```

## Current Ethereum Mainnet Recommendations

For Ethereum mainnet with current low gas prices (Base: 0.26 Gwei):

```env
# Recommended settings for Ethereum
MAX_PRIORITY_FEE_GWEI=0.5
MAX_FEE_GWEI=5
```

## Estimated Costs

With the new settings on Ethereum:
- Approval: ~0.001 ETH (instead of 0.75 ETH)
- Split transaction: ~0.015 ETH
- Pool creation: ~0.02 ETH
- Add liquidity: ~0.015 ETH

Total for full setup: ~0.05-0.1 ETH (vs 3-5 ETH with the old 25 Gwei minimum)