# How to Test the Futarchy Proposal System

## Prerequisites
1. Make sure you have Node.js installed
2. You need some xDAI on Gnosis chain for gas fees

## Setup

1. **Navigate to the refactored folder:**
```bash
cd refactorCreateProposal
```

2. **Install dependencies:**
```bash
npm install
```

3. **Set up your private key:**
Create a `.env` file with your private key:
```
PRIVATE_KEY=your_private_key_here
RPC_URL=https://rpc.gnosischain.com
NETWORK=gnosis
CHAIN_ID=100
```

## Testing Options

### Option 1: Create New Proposal + All 6 Pools (Full Test)

Use the test config that creates minimal liquidity (0.000000000001 tokens):

```bash
node cli.js setup-auto config/test-proposal.config.json
```

This will:
1. Create a new futarchy proposal
2. Set up all 6 pools with minimal liquidity
3. Log all transactions

### Option 2: Use Existing Proposal (Faster)

If you already have a proposal address, edit `config/test-existing.json`:
```json
{
  "proposalAddress": "YOUR_PROPOSAL_ADDRESS_HERE",
  // ... rest of config
}
```

Then run:
```bash
node cli.js setup-auto config/test-existing.json
```

### Option 3: Interactive Mode (Step by Step)

For manual control with prompts:
```bash
node cli.js setup-pools config/test-proposal.config.json manual
```

### Option 4: Semi-Automatic (Confirm Each Pool)

To confirm before creating each pool:
```bash
node cli.js setup-semi config/test-proposal.config.json
```

## What to Expect

The system will:

1. **Create/Load Proposal**
   - Transaction: Creates futarchy proposal on-chain
   - Returns: Proposal address

2. **For Each of the 6 Pools:**
   
   **Pool 1: YES-PNK/sDAI** (Conditional)
   - Price: 0.011952 sDAI per YES-PNK
   - Checks YES-PNK balance
   - Splits PNK if needed
   
   **Pool 2: NO-PNK/sDAI** (Conditional)
   - Price: 0.020643 sDAI per NO-PNK
   - Checks NO-PNK balance
   - Splits PNK if needed
   
   **Pool 3: YES-sDAI/sDAI** (Conditional)
   - Price: 0.50 (50% probability)
   - Checks YES-sDAI balance
   - Splits sDAI if needed
   
   **Pool 4: NO-sDAI/sDAI** (Conditional)
   - Price: 0.50 (50% probability)
   - Checks NO-sDAI balance
   - Splits sDAI if needed
   
   **Pool 5: YES-PNK/NO-PNK** (Prediction)
   - Ratio: 1.0 (50%/50%)
   - Uses conditional tokens from above
   
   **Pool 6: YES-sDAI/NO-sDAI** (Prediction)
   - Ratio: 1.0 (50%/50%)
   - Uses conditional tokens from above

3. **For Each Pool Creation:**
   - Creates pool with initial price
   - Mints liquidity position
   - Logs transaction hash

## Monitoring Progress

Watch the console output for:
- `📝 Creating Futarchy Proposal` - Proposal creation
- `POOL X: [Name]` - Starting each pool
- `✅ Sufficient [TOKEN] balance` - Has tokens
- `🔄 Splitting [TOKEN]` - Creating conditional tokens
- `🏗️ Creating new pool` - Pool creation
- `💧 Minting liquidity position` - Adding liquidity
- `Transaction: 0x...` - Transaction hashes

## Check Transactions

View your transactions on Gnosisscan:
```
https://gnosisscan.io/address/YOUR_WALLET_ADDRESS
```

## Transaction Logs

After completion, check the `logs/` folder for:
- `transactions_[timestamp].log` - All transactions
- `export_[timestamp].json` - JSON export

## Common Issues

1. **"Out of gas"**: The system uses high gas limits (5M for proposals, 15M for pools)
2. **"Insufficient balance"**: You need PNK and sDAI tokens
3. **"Transaction pending"**: Gnosis can be slow, wait a few minutes

## Quick Test with Minimal Amounts

The test configs use `0.000000000001` tokens to minimize costs. This is enough to:
- Test all functionality
- Set correct prices
- Create real pools on-chain

## Custom Configuration

Edit the config files to change:
- `spotPrice`: Current PNK price in sDAI
- `eventProbability`: Chance of YES (0-1)
- `impact`: Price impact percentage if YES
- `liquidityAmounts`: Array of 6 amounts for each pool

## Price Verification

Run the price verification test:
```bash
node test-price-verification.js
```

This shows how prices are calculated for all 6 pools.

## Help

For help with commands:
```bash
node cli.js help
```

## Example Output

```
🔑 Wallet: 0x645A3D9208523bbFEE980f7269ac72C61Dd3b552
🌐 Network: gnosis (Chain ID: 100)

📝 Creating Futarchy Proposal:
  Market: TEST: Will AI improve governance...
  Transaction: 0x7a3331afa8ed3b9bd4d7990ed3e2d68a52dd75fcbc69469ac745363e6102375f
  ✅ Proposal created: 0xF96C82cA680b99e3212FA22F51029B72091e1E5E

POOL 1: YES-Company/Currency (Conditional)
  ✅ Sufficient YES-PNK balance
  🏗️ Creating new pool
  💧 Minting liquidity position
  ✅ Pool 1 Complete

[... continues for all 6 pools ...]

SETUP COMPLETE
Summary: 6 success, 0 skipped, 0 failed
```