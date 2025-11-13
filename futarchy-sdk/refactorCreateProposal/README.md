# Futarchy Proposal CLI

A refactored, modular CLI tool for creating and managing futarchy proposals on Gnosis Chain with automated pool setup and liquidity provision.

## Features

- ✅ **Modular Architecture**: Clean separation of concerns with dedicated modules
- ✅ **Multiple Modes**: Automatic, semi-automatic, and manual operation modes
- ✅ **Token Reordering**: Automatic handling of AMM token ordering
- ✅ **Price Calculation**: Precise price calculations for conditional and prediction markets
- ✅ **Balance Verification**: Multi-stage balance verification before operations
- ✅ **Transaction Logging**: Complete transaction history with export capabilities
- ✅ **Gas Optimization**: Configured gas limits for different operations

## Installation

```bash
# Install dependencies
npm install

# Copy and configure environment variables
cp .env.example .env
# Edit .env with your private key and RPC URL
```

## Configuration

### Environment Variables (.env)

```env
PRIVATE_KEY=your_private_key_here
RPC_URL=https://rpc.gnosischain.com
NETWORK=gnosis
CHAIN_ID=100
```

### Proposal Configuration (config.json)

```json
{
  "proposalAddress": "0x757fAF022abf920E110d6C4DbC2477A99788F447",
  "marketName": "Will KIP-78 be approved?",
  "openingTime": 1755278452,
  "display_text_1": "What will the impact on PNK price be",
  "display_text_2": "if KIP-78 is approved?",
  "companyToken": {
    "symbol": "PNK",
    "address": "0x37b60f4e9a31a64ccc0024dce7d0fd07eaa0f7b3"
  },
  "currencyToken": {
    "symbol": "sDAI",
    "address": "0xaf204776c7245bF4147c2612BF6e5972Ee483701"
  },
  "spotPrice": 0.02173,
  "eventProbability": 0.80,
  "impact": 4,
  "liquidityAmounts": [100, 250, 100, 100, 100, 100],
  "forceAddLiquidity": [2],
  "adapterAddress": "0x7495a583ba85875d59407781b4958ED6e0E1228f",
  "companyId": "10"
}
```

## Usage

### Create a New Proposal

```bash
# Interactive mode
node cli.js create-proposal

# With config file
node cli.js create-proposal proposal-config.json
```

### Setup Pools

```bash
# Manual mode (interactive, asks for confirmations)
node cli.js setup-pools config.json

# Automatic mode (no confirmations, skips existing pools)
node cli.js setup-auto config.json

# Semi-automatic mode (confirms each pool)
node cli.js setup-semi config.json
```

### Add Liquidity to Specific Pool

```bash
node cli.js add-liquidity <token0_address> <token1_address> <amount0> <amount1>

# Example
node cli.js add-liquidity 0x37b60... 0xaf2047... 100 1000
```

## Operating Modes

### 1. **Automatic Mode** (`setup-auto`)
- No user interaction required
- Skips existing pools by default
- Uses `forceAddLiquidity` array to force liquidity on specific pools
- Best for production deployments

### 2. **Semi-Automatic Mode** (`setup-semi`)
- Asks for confirmation before each pool
- Shows pool details before proceeding
- Good for testing and verification

### 3. **Manual Mode** (default)
- Full interactive mode
- Prompts for all values if not provided
- Best for first-time setup

## Pool Structure

The system creates 6 pools for each futarchy proposal:

1. **YES-Company/Currency** (Conditional): YES-PNK / sDAI
2. **NO-Company/Currency** (Conditional): NO-PNK / sDAI
3. **YES-Currency/Currency** (Conditional): YES-sDAI / sDAI
4. **NO-Currency/Currency** (Conditional): NO-sDAI / sDAI
5. **YES-Company/NO-Company** (Prediction): YES-PNK / NO-PNK
6. **YES-Currency/NO-Currency** (Prediction): YES-sDAI / NO-sDAI

## Price Calculations

### Conditional Token Prices
```
YES Price = Spot Price × (1 + Impact) × Probability
NO Price = Spot Price × (1 - Probability × Impact)
```

### Prediction Market Ratios
```
YES/NO Ratio = Probability / (1 - Probability)
```

## Module Structure

```
refactorCreateProposal/
├── contracts/
│   └── constants.js        # Contract addresses and network config
├── modules/
│   ├── poolManager.js      # Pool creation and liquidity management
│   ├── futarchyAdapter.js  # Token splitting/merging
│   ├── proposalCreator.js  # Proposal creation
│   └── liquidityOrchestrator.js # Main orchestration logic
├── utils/
│   ├── tokens.js           # Token management utilities
│   ├── priceCalculations.js # Price calculation functions
│   └── transactionLogger.js # Transaction logging and export
├── config/
│   └── futarchy-proposal.config.json # Config template
├── logs/                   # Transaction logs (auto-created)
├── cli.js                  # Main CLI entry point
├── package.json
├── .env.example
└── README.md
```

## Transaction Logging

All transactions are automatically logged and can be exported:

- **JSON Export**: Complete transaction details
- **CSV Export**: Spreadsheet-compatible format
- **Session Summary**: Overview of all operations

Logs are saved in the `logs/` directory with timestamps.

## Error Handling

The system handles common issues:

- **Insufficient Balance**: Automatically splits underlying tokens if needed
- **Pool Already Exists**: Uses existing pool or skips based on mode
- **Token Ordering**: Automatically handles AMM token ordering
- **Gas Estimation**: Uses configured gas limits for reliability

## Advanced Features

### Balance Verification
- Multi-stage verification before operations
- Fresh blockchain queries for critical operations
- Automatic token splitting when needed

### Price Verification
- Compares actual pool price with target
- Reports deviation percentage
- Warns if price is off by more than 1%

### Token Reordering
- Automatically detects AMM token ordering
- Adjusts amounts and prices accordingly
- Transparent reporting of conversions

## Development

### Running Tests
```bash
# Test configuration loading
node cli.js help

# Test with example config
node cli.js setup-pools config/futarchy-proposal.config.json manual
```

### Debugging
Set environment variable for verbose logging:
```bash
DEBUG=* node cli.js setup-auto config.json
```

## Contract Addresses (Gnosis Chain)

- **Futarchy Factory**: `0xa6cB18FCDC17a2B44E5cAd2d80a6D5942d30a345`
- **Position Manager**: `0x91fd594c46d8b01e62dbdebed2401dde01817834`
- **Swap Router**: `0xffb643e73f280b97809a8b41f7232ab401a04ee1`
- **Default Adapter**: `0x7495a583ba85875d59407781b4958ED6e0E1228f`

## License

MIT