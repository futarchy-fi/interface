# Multi-Chain Configuration Guide

## Quick Start

### Switch Between Chains

You can easily switch between Ethereum (chain 1) and Gnosis (chain 100):

```bash
# Use Ethereum Mainnet
node cli.js --chain=1 create-proposal config.json

# Use Gnosis Chain (default)
node cli.js --chain=100 setup-pools config.json automatic
```

### Configuration Location

All chain configurations are stored in: `config/chains.config.json`

## Chain Details

### Gnosis Chain (100) - Default
- **RPC**: https://rpc.gnosischain.com
- **Position Manager**: 0x91fd594c46d8b01e62dbdebed2401dde01817834
- **Futarchy Factory**: 0xa6cB18FCDC17a2B44E5cAd2d80a6D5942d30a345
- **Default Adapter**: 0x7495a583ba85875d59407781b4958ED6e0E1228f
- **Default Company Token**: PNK (0x37b60f4e9a31a64ccc0024dce7d0fd07eaa0f7b3)
- **Default Currency Token**: sDAI (0xaf204776c7245bF4147c2612BF6e5972Ee483701)
- **Explorer**: https://gnosisscan.io

### Ethereum Mainnet (1)
- **RPC**: https://eth.llamarpc.com
- **Position Manager**: 0xC36442b4a4522E871399CD717aBDD847Ab11FE88
- **Futarchy Factory**: 0x0000000000000000000000000000000000000000 (needs to be deployed)
- **Default Adapter**: 0x0000000000000000000000000000000000000000 (needs to be deployed)
- **Default Company Token**: WETH (0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2)
- **Default Currency Token**: USDC (0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48)
- **Explorer**: https://etherscan.io

## How to Add/Modify Chain Configuration

1. Edit `config/chains.config.json`
2. Add your chain under the `"chains"` object:

```json
"YOUR_CHAIN_ID": {
  "name": "Your Chain Name",
  "chainId": YOUR_CHAIN_ID,
  "rpcUrl": "https://your-rpc-url.com",
  "contracts": {
    "POSITION_MANAGER": "0x...",
    "SWAP_ROUTER": "0x...",
    "FUTARCHY_FACTORY": "0x...",
    "DEFAULT_ADAPTER": "0x..."
  },
  "tokens": {
    "DEFAULT_COMPANY_TOKEN": {
      "symbol": "TOKEN",
      "address": "0x..."
    },
    "DEFAULT_CURRENCY_TOKEN": {
      "symbol": "CURRENCY",
      "address": "0x..."
    }
  },
  "gasSettings": {
    "CREATE_PROPOSAL": 5000000,
    "CREATE_POOL": 16000000,
    // ... other gas settings
  },
  "gasPriceGwei": "10.0",
  "explorer": "https://explorer.com"
}
```

## Environment Variables

You can also set the chain via environment variable:

```bash
# Windows
set CHAIN_ID=1
node cli.js create-proposal config.json

# Linux/Mac
export CHAIN_ID=1
node cli.js create-proposal config.json
```

## Examples

### Create Proposal on Ethereum
```bash
node cli.js --chain=1 create-proposal my-proposal.json
```

### Setup Pools on Gnosis
```bash
node cli.js --chain=100 setup-pools my-config.json automatic
```

### Add Liquidity on Ethereum
```bash
node cli.js --chain=1 add-liquidity 0xTokenA 0xTokenB 100 100
```

## Notes

- Default chain is Gnosis (100) if not specified
- Command-line `--chain` flag overrides environment variable
- All contract addresses must be valid for the selected chain
- Gas settings are chain-specific and optimized for each network