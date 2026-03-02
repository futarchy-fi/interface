# Testing Semi-Automatic Mode

## What is Semi-Automatic Mode?

Semi-automatic mode gives you control at each step:
- Shows you what will happen BEFORE doing it
- Asks for confirmation before each pool
- Shows prices and amounts before creating
- Lets you skip pools if needed

## How to Test

### 1. Setup Your Config

Use the existing test config or create your own:

```bash
cd refactorCreateProposal
```

### 2. Run Semi-Automatic Mode

```bash
node cli.js setup-semi config/test-proposal.config.json
```

Or with existing proposal:

```bash
node cli.js setup-semi config/test-existing.json
```

## What You'll See at Each Step

### Step 1: Proposal Creation (if no address)
```
📝 No proposal address found in config.
Create new proposal? (Y/n): Y

📝 Creating Futarchy Proposal:
  Market: TEST: Will AI improve governance...
  Company Token: 0x37b60f4e9a31a64ccc0024dce7d0fd07eaa0f7b3
  Currency Token: 0xaf204776c7245bf4147c2612bf6e5972ee483701
  Opening Time: 09/12/2025, 08:07:32
  
[Waits for transaction confirmation]
  ✅ Proposal created: 0x...
```

### Step 2: For Each Pool (1-6)

You'll see this for EACH pool:

```
────────────────────────────────────────
POOL 1: YES-Company/YES-Currency (Price-Correlated)
────────────────────────────────────────

📋 Pool Details:
  Token0: YES-PNK (0x...)
  Token1: YES-sDAI (0x...)
  Target Price: 0.011952 YES-sDAI per YES-PNK
  Liquidity: 0.000000000001 tokens

📋 Checking token requirements for pool...
  Token0 is conditional: Company type

🔍 PRECISE BALANCE CHECK FOR YES-PNK...
  📊 Refreshing balances before calculations...
  🔍 Balance verification:
    YES-PNK: 0.0
    PNK: 100.0
    
⚠️  Insufficient YES-PNK:
  Required: 0.000000000001
  Current: 0.0
  Need to split: 0.000000000001 PNK

Proceed with Pool 1? (Y/n): _
```

### What Happens When You Type 'Y':

1. **Token Splitting (if needed)**:
```
🔄 SPLITTING PNK TO OBTAIN YES-PNK...
📝 Approving Futarchy Adapter to spend 0.000000000001 PNK
   Approval tx: 0x...
   ✅ Approved

🔄 Splitting PNK into YES/NO tokens:
  Amount: 0.000000000001 PNK
  Transaction: 0x...
  ✅ Split complete - received YES and NO tokens

📊 Verifying balances after split...
  📊 Updated balances after split:
    YES-PNK: 0.000000000001
    PNK: 99.999999999999
  ✅ SUCCESS: Now have sufficient YES-PNK balance for operation
```

2. **Pool Creation**:
```
🏗️  Creating new pool:
  AMM Token0: 0x... (YES-PNK)
  AMM Token1: 0x... (YES-sDAI)
  Initial sqrt price X96: 724716600260662544720805756928
  Transaction: 0x...
  ✅ Pool created: 0x...
```

3. **Adding Liquidity**:
```
💧 Minting liquidity position:
  Pool: 0x...
  Tick range: [-887272, 887272]
  AMM amounts: 0.000000000001 / 0.000000000001
  Transaction: 0x...
  ✅ Position minted (NFT ID: 123)
```

4. **Price Verification**:
```
✅ Pool 1 Complete:
  Address: 0x...
  Price Accuracy: 0.01%
```

### Step 3: Next Pool

```
────────────────────────────────────────
POOL 2: NO-Company/NO-Currency (Price-Correlated)
────────────────────────────────────────

[Same process repeats]

Proceed with Pool 2? (Y/n): _
```

## Verification Steps

### During the Process, Verify:

1. **Token Balances**
   - Check that YES/NO tokens are created when split
   - Verify collateral is deducted correctly

2. **Prices**
   - Pool 1: YES-PNK/YES-sDAI = 0.011952
   - Pool 2: NO-PNK/NO-sDAI = 0.020643
   - Pool 3: YES-PNK/sDAI = 0.010865 (spot * probability)
   - Pool 4: NO-PNK/sDAI = 0.010865 (spot * (1-probability))
   - Pool 5: YES-sDAI/sDAI = 0.50 (probability)
   - Pool 6: NO-sDAI/sDAI = 0.50 (1-probability)

3. **Transaction Hashes**
   - Each operation shows a transaction hash
   - You can check them on Gnosisscan

### After Completion:

1. **Check the Summary**:
```
============================================================
SETUP COMPLETE
============================================================
Pool 1: ✅ SUCCESS (0x...)
Pool 2: ✅ SUCCESS (0x...)
Pool 3: ✅ SUCCESS (0x...)
Pool 4: ✅ SUCCESS (0x...)
Pool 5: ✅ SUCCESS (0x...)
Pool 6: ✅ SUCCESS (0x...)

Summary: 6 success, 0 skipped, 0 failed
```

2. **Check Transaction Log**:
```
📁 Transactions exported to: logs/export_1234567890.json
```

3. **Verify on Gnosisscan**:
   - Go to your wallet address
   - Check all transactions
   - Verify pool creations
   - Check NFT positions

## Options During Semi-Auto

For each pool, you can:
- **Y** - Proceed with this pool
- **n** - Skip this pool
- **Ctrl+C** - Cancel entire process

## Test Different Scenarios

### Test 1: Skip Some Pools
```bash
# Answer 'n' to pools 5 and 6
node cli.js setup-semi config/test-proposal.config.json
```

### Test 2: With Existing Tokens
If you already have YES/NO tokens from a previous run:
```bash
# It should detect existing balances and skip splitting
node cli.js setup-semi config/test-existing.json
```

### Test 3: Verify Price Calculations
Create a config with different parameters:
```json
{
  "spotPrice": 0.03,
  "eventProbability": 0.75,
  "impact": 20
}
```

Then verify prices match formulas:
- YES price = 0.03 × 1.20 × 0.75 = 0.027
- NO price = 0.03 × 0.95 = 0.0285

## Command Summary

```bash
# Semi-automatic with new proposal
node cli.js setup-semi config/test-proposal.config.json

# Semi-automatic with existing proposal
node cli.js setup-semi config/test-existing.json

# Check prices without executing
node test-price-verification.js

# View transaction logs
cat logs/transactions_*.log

# Export to JSON
cat logs/export_*.json
```

## What to Check in Gnosisscan

1. **Proposal Creation TX**: Creates the futarchy proposal
2. **Approval TXs**: Approves adapter for splitting
3. **Split TXs**: Creates YES/NO tokens
4. **Pool Creation TXs**: Creates each pool
5. **Mint Position TXs**: Adds liquidity

Each should show "Success" status.

## Troubleshooting

- **"Insufficient balance"**: You need PNK and sDAI tokens
- **"Transaction pending"**: Wait a few minutes for Gnosis
- **"Pool already exists"**: Normal if rerunning - liquidity will be added to existing pool
- **"Out of gas"**: Should not happen with new gas limits (5M/15M)

## Benefits of Semi-Auto Mode

1. **Learning**: See exactly what happens at each step
2. **Control**: Skip pools you don't want
3. **Verification**: Check balances/prices before proceeding
4. **Safety**: Can cancel if something looks wrong
5. **Debugging**: Easier to identify where issues occur