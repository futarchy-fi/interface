# Refactor Create Proposal Tool Documentation

This directory (`refactorCreateProposal`) contains a robust CLI tool for creating Futarchy proposals and orchestrating liquidity across 6 specific pools. It is designed to handle complex setups with precise price calculations and liquidity distribution.

## Overview

The tool allows you to:
1.  **Create Proposals**: Deploy new Futarchy proposals.
2.  **Setup Pools**: Automatically create and initialize 6 specific liquidity pools required for the proposal.
3.  **Mint Positions**: Add liquidity to these pools based on a configuration file.

## Configuration Files

The tool uses JSON configuration files (located in `config/`) to define the proposal parameters and liquidity settings. Examples include `test-vlr-ethereum.json` (Velora), `test-sbux-ethereum.json` (Starbucks), etc.

### Config Structure

```json
{
  "chainId": 1,                                      // Chain ID (1 for Mainnet, 100 for Gnosis)
  "amm": "uniswap",                                  // AMM type: "uniswap" or "swapr"
  "proposalAddress": "0x...",                        // Optional: Existing proposal address
  "marketName": "Will 'Proposal X' be approved...",  // Proposal Question
  "openingTime": 1758565452,                         // Resolution time (Unix timestamp)
  "companyToken": {
    "symbol": "VLR",
    "address": "0x..."
  },
  "currencyToken": {
    "symbol": "sDAI",
    "address": "0x..."
  },
  "spotPrice": 0.0126,                               // Current market price of Company Token in Currency
  "eventProbability": 0.5,                           // Probability of YES outcome (0.5 = 50%)
  "impact": 0.02,                                    // Expected price impact (0.02 = 2%)
  "liquidityAmounts": [0.0001, 0.0001, ...],         // Array of 6 liquidity amounts for the 6 pools
  "forceAddLiquidity": [1],                          // Pool IDs to force add liquidity to even if they exist
  "feeTier": 500                                     // Uniswap Fee Tier (500 = 0.05%)
}
```

## The 6 Pools Strategy

The tool automatically sets up 6 distinct pools to capture different trading pairs and outcome probabilities. The `liquidityAmounts` array in the config corresponds to these 6 pools in order:

1.  **YES Company / YES Currency**: Trading the "YES" outcome tokens against each other.
2.  **NO Company / NO Currency**: Trading the "NO" outcome tokens against each other.
3.  **YES Company / Currency**: Trading YES Company token against the base Currency (e.g., sDAI).
4.  **NO Company / Currency**: Trading NO Company token against the base Currency.
5.  **YES Currency / Currency**: Trading YES Currency token against the base Currency.
6.  **NO Currency / Currency**: Trading NO Currency token against the base Currency.

### Logic Flow (`LiquidityOrchestrator.js`)

1.  **Price Calculation**: The tool uses `spotPrice`, `eventProbability`, and `impact` to calculate the target prices for YES and NO tokens.
2.  **Pool Configuration**: It generates configurations for all 6 pools, calculating the required token ratios to match the target prices.
3.  **Orchestration**: It iterates through each of the 6 pools:
    *   Checks if the pool already exists.
    *   If not, it creates the pool using the calculated `sqrtPriceX96`.
    *   It ensures the user has enough tokens (splitting collateral if necessary).
    *   It mints the liquidity position.

## Usage

Run the CLI from the `refactorCreateProposal` directory:

```bash
# Setup pools using a specific config
node cli.js setup-pools config/test-vlr-ethereum.json

# Automatic mode (skips confirmations)
node cli.js setup-auto config/test-vlr-ethereum.json

# Create a proposal only
node cli.js create-proposal config/test-vlr-ethereum.json
```

## Key Modules

-   **`cli.js`**: Entry point, handles command parsing and config loading.
-   **`modules/liquidityOrchestrator.js`**: Manages the high-level flow of setting up the 6 pools.
-   **`modules/poolManager.js`**: Handles low-level AMM interactions (Uniswap/Swapr), pool creation, and minting. It handles token ordering logic (inverting prices if tokens are sorted differently by the AMM).
-   **`utils/priceCalculations.js`**: Contains the math for calculating conditional prices and pool ratios.

## Backend Notification

The tool automatically notifies a backend API when the first 3 pools (YES/YES, NO/NO, YES/Currency) are successfully created.

### Configuration
Add the following to your `.env` file:
```env
BACKEND_API_URL=http://127.0.0.1:8000/api/v1/pools/create_pool
BACKEND_API_KEY=your_backend_api_key_here
```

### Payload Structure
The tool sends a POST request with the following JSON payload:
```json
{
  "address": "0x...",             // Pool Address
  "type": "uniswapv3",            // or "algebra"
  "proposal_address": "0x...",    // Proposal Address
  "metadata": null,
  "company_id": 11,               // From config or default 9
  "chain_id": 100                 // From config or env
}
```
