# Futarchy Proposal Creation Process

This directory contains scripts for creating and managing Futarchy proposals on the Gnosis Chain. Futarchy is a governance mechanism where predictions markets are used to determine the outcome of proposals.

## Overview

The `FutarchyProposalLiquidity.s.sol` script enables you to:

1. Create Futarchy proposals with customizable parameters
2. Extract conditional tokens for the proposal
3. Calculate and provide liquidity to prediction markets
4. Deploy both SushiSwap V2 and V3 pools for the markets

## How Proposal Creation Works

### 1. Proposal Configuration

Proposals are configured through JSON files with parameters including:

- **name**: The name/title of the proposal
- **question**: The proposal question to be answered (e.g., "Should we implement feature X?")
- **category**: The question category (e.g., "governance")
- **lang**: Language code (e.g., "en")
- **collateralToken1 & collateralToken2**: Token addresses used as collateral
- **minBond**: Minimum bond required for the Reality.eth oracle
- **openingTime**: When the question should open (0 for immediate)
- **liquidity**: Configuration for initial market liquidity

Example configuration (placed in a JSON file):
```json
{
  "name": "Feature X Implementation",
  "question": "Should we implement feature X?",
  "category": "governance",
  "lang": "en",
  "collateralToken1": "0x...",
  "collateralToken2": "0x...",
  "minBond": "1000000000000000000",
  "openingTime": 0,
  "liquidity": {
    "wxdaiAmount": "1000000000000000000",
    "token1Amount": "1000000000000000000",
    "token2Amount": "1000000000000000000"
  }
}
```

### 2. Proposal Creation Process

The script executes the following steps:

1. **Load Configuration**: Parses the JSON configuration and environment variables
2. **Create Proposal**: Calls the FutarchyFactory contract to create the proposal
3. **Extract Conditional Tokens**: Gets the conditional tokens created for the proposal
4. **Calculate Liquidity**: Determines optimal liquidity parameters
5. **Deploy Pools**: Creates SushiSwap V2 and V3 pools for the markets

### 3. Technical Implementation

The proposal creation uses the `FutarchyFactory` contract, which:

- Generates a unique question for Reality.eth oracle
- Creates conditional tokens using the Conditional Tokens Framework
- Wraps conditional tokens as ERC20 tokens for better composability
- Sets up the proposal contract with the configured parameters

## Usage

To create a proposal:

```bash
forge script script/proposal/FutarchyProposalLiquidity.s.sol:FutarchyProposalLiquidity --sig "run(string)" "configs/my-proposal.json" --rpc-url $RPC_URL --broadcast
```

For batch proposal creation:

```bash
forge script script/proposal/FutarchyProposalLiquidity.s.sol:FutarchyProposalLiquidity --sig "runBatch(string)" "configs/batch-proposals.json" --rpc-url $RPC_URL --broadcast
```

## Environment Variables

Required environment variables:

- `FUTARCHY_FACTORY`: Address of the FutarchyFactory contract
- `SUSHI_V2_FACTORY`: SushiSwap V2 factory address
- `SUSHI_V2_ROUTER`: SushiSwap V2 router address
- `SUSHI_V3_FACTORY`: SushiSwap V3 factory address
- `SUSHI_V3_POSITION_MANAGER`: SushiSwap V3 position manager address
- `WXDAI_ADDRESS`: Wrapped XDAI token address
- `PRIVATE_KEY`: Private key for transaction signing
- `RPC_URL`: RPC URL for Gnosis Chain

## Pool Creation and Liquidity

After proposal creation, the script automatically:

1. Creates SushiSwap V2 pools for binary outcome markets
2. Creates SushiSwap V3 concentrated liquidity pools
3. Adds initial liquidity to all pools
4. Sets appropriate price ranges and fee tiers

This ensures that the prediction markets are immediately ready for trading. 