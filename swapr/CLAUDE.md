# CLAUDE.md - Swapr Pool Automation

This file provides guidance to Claude Code (claude.ai/code) when working with the pool automation tools in the swapr directory.

## Overview

The swapr directory contains automated tools for creating and managing futarchy prediction market pools on Gnosis Chain. These tools orchestrate the complete workflow from proposal creation through pool setup to API integration.

## Key Files

### Core Automation Scripts

1. **automate-futarchy.js**
   - Main orchestration script that runs the complete workflow
   - Executes: config → pool creation → file generation → API calls
   - Usage: `npm run automate` (production) or `npm run automate-dry` (test)

2. **algebra-cli.js**
   - Core pool management engine with blockchain interactions
   - Handles token splitting, pool creation, liquidity management
   - Interactive mode: `npm run interactive`
   - Auto mode: `npm run futarchy:auto futarchy-config.json`

3. **generate-pool-files.js**
   - Converts futarchy setup data to API-ready JSON files
   - Filters for target pools: YES_GNO/YES_sDAI, NO_GNO/NO_sDAI, YES_sDAI/sDAI
   - Usage: `npm run generate-pools`

4. **call-pool-apis.js**
   - Makes HTTP POST requests to create pools via API
   - Supports authentication and dry-run mode
   - Usage: `npm run call-pool-apis` or `npm run call-pool-apis-dry`

## Configuration

### futarchy-config.json Structure
```json
{
  "marketName": "Proposal title",
  "openingTime": unix_timestamp,
  "display_text_1": "First line",
  "display_text_2": "Second line",
  "companyToken": {              // Company token configuration
    "symbol": "GNO",
    "address": "0x9C58BAcC331c9aa871AFD802DB6379a98e80CEdb"
  },
  "currencyToken": {             // Currency token configuration
    "symbol": "sDAI",
    "address": "0xaf204776c7245bF4147c2612BF6e5972Ee483701"
  },
  "spotPrice": 100,              // Current market price
  "eventProbability": 0.5,       // Initial YES probability (0-1)
  "impact": 6.38,                // Expected price impact %
  "liquidityAmounts": [],        // 6 values for initial liquidity
  "forceAddLiquidity": [],       // Override liquidity for specific pools
  "adapterAddress": "0x...",     // ConditionalTokensAdapter
  "companyId": "10"              // Optional company identifier
}
```

**Token Configuration:**
- `companyToken`: The governance/company token (e.g., GNO, PNK)
- `currencyToken`: The base currency token (e.g., sDAI, USDC)
- Both support nested object format (shown above) or flat format for backward compatibility:
  - `companyTokenAddress`: "0x..."
  - `currencyTokenAddress`: "0x..."

### Pool Creation Parameters

The system creates 6 pools based on configuration:

1. **Conditional Token Pools** (correlated prices):
   - YES_COMPANY/YES_CURRENCY
   - NO_COMPANY/NO_CURRENCY

2. **Expected Value Pools** (company token markets):
   - YES_COMPANY/BASE_CURRENCY
   - NO_COMPANY/BASE_CURRENCY

3. **Prediction Market Pools** (probability markets):
   - YES_CURRENCY/BASE_CURRENCY
   - NO_CURRENCY/BASE_CURRENCY

### Price Calculation
- YES Price = spotPrice × (1 + impact × (1 - probability))
- NO Price = spotPrice × (1 - impact × probability))

## Common Workflows

### 1. Complete Automated Setup
```bash
# Full automation with futarchy-config.json
npm run automate

# Dry run to preview without executing
npm run automate-dry
```

The automation workflow will:
- Read token configuration from futarchy-config.json
- Display configured tokens (e.g., GNO/sDAI or PNK/USDC)
- Create pools with the specified tokens
- Generate API files for the correct pool pairs

### 2. Manual Pool Creation
```bash
# Interactive wizard
npm run interactive

# Automated with config
npm run futarchy:auto futarchy-config.json
```

### 3. Liquidity Management
```bash
# Add liquidity interactively
npm run interactive
# Select option 8

# Remove liquidity
npm run remove
```

### 4. API Integration Only
```bash
# Generate pool files from latest setup
npm run generate-pools

# Call APIs with generated files
npm run call-pool-apis
```

## Important Functions

### algebra-cli.js

**setupFutarchyPoolsAuto(configPath)**
- Main entry point for automated setup
- Creates proposal, splits tokens, creates pools, adds liquidity
- Handles all 6 pool types automatically

**splitTokensViaAdapter(collateralToken, amount)**
- Splits collateral into conditional tokens
- Returns YES/NO token addresses
- Handles allowances automatically

**addLiquidity(poolInfo)**
- Adds liquidity with price verification
- Supports inverted token pairs
- Includes slippage protection

**createNewProposal(marketName, openingTime)**
- Creates new futarchy proposal
- Returns proposal address
- Sets up conditional tokens

### automate-futarchy.js

**runAutomation(isDryRun)**
- Orchestrates complete workflow
- Handles errors gracefully
- Provides color-coded output

### generate-pool-files.js

**processPoolsForCompany(setupData, targetDir)**
- Filters pools for API requirements
- Includes metadata in first pool
- Generates curl commands

## Error Handling

Common issues and solutions:

1. **Insufficient Balance**
   - Check token balances before operations
   - Ensure collateral tokens are available

2. **Pool Already Exists**
   - System detects existing pools
   - Can reuse or create new proposal

3. **Price Calculation Errors**
   - Verify Balancer pool has liquidity
   - Check RPC endpoints are responsive

4. **API Failures**
   - Check bearer token in .env
   - Verify API endpoint is correct
   - Use dry-run mode for testing

## Security Notes

1. **Private Keys**
   - Store in .env file only
   - Never commit to repository
   - Use separate keys for testing

2. **Gas Management**
   - Default gas limits prevent excessive spending
   - Can override in config if needed
   - Monitor transaction costs

3. **Allowances**
   - System manages token allowances
   - Resets before setting new ones
   - Verify approval addresses

## Testing Approach

1. **Dry Run Mode**
   - Use `npm run automate-dry`
   - Preview all operations
   - No blockchain transactions

2. **Manual Verification**
   - Check pool creation on explorer
   - Verify prices match calculations
   - Test swaps manually

3. **API Testing**
   - Use `npm run call-pool-apis-dry`
   - Verify request formatting
   - Check authentication

## Development Commands

```bash
# Main automation
npm run automate           # Full workflow
npm run automate-dry       # Preview mode

# Pool operations
npm run futarchy:create    # Create proposal
npm run futarchy:auto      # Auto setup with config
npm run interactive        # Interactive wizard

# API operations
npm run generate-pools     # Generate API files
npm run call-pool-apis     # Execute API calls
npm run call-pool-apis-dry # Preview API calls

# Utilities
npm run view              # View positions
npm run remove            # Remove liquidity
npm run merge <addr>      # Merge conditional tokens
```

## Integration with Main App

The pools created by these tools are consumed by:
- `src/hooks/useFutarchy.js` - For trading operations
- `src/futarchyJS/futarchyConfig.js` - For pool addresses
- `src/components/refactor/strategies/` - For swap execution

## Important Constants

Key addresses and values are in:
- `constants.js` - Token addresses, pool factories
- `futarchy-config.json` - Market parameters
- `.env` - Private keys, API tokens