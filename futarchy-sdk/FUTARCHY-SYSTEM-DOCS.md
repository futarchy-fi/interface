# Futarchy Proposal System Documentation

## Overview
The createProposals.js system manages futarchy proposals, creates conditional token pools, and handles liquidity provision with automatic price setting and verification.

## 1. Core Addresses & ABIs

### Contract Addresses (Base Network)
```javascript
// Core Infrastructure
ALGEBRA_FACTORY = '0xb860200BD68dc39cEaDff6ff0a6a0286b10B2b66'  // Pool factory
POSITION_MGR = '0xd931FbAfda012c440b6F3c03f5aDa27DE93fEDE0'     // NFT position manager
ROUTER = '0x4622CD2fDC1e8f2F6cCa8cCD887a4fe9eCD02250'          // Swap router

// Default Tokens
DEFAULT_COMPANY_TOKEN = '0xf4fC5c5807393a9e17EB122208178366D736d388'  // PNK
DEFAULT_CURRENCY_TOKEN = '0xFb0Fb887719237b097B4bFa09e937be0c1a96FC9'  // sDAI
DEFAULT_FACTORY_ADDRESS = '0x42aF9a25359d7Ed44f6EB0CF080eA0b0b59c6685'  // Futarchy factory
```

### ABI Components
- **Futarchy Factory**: Creates proposals with `createProposal()` method
- **Futarchy Adapter**: Handles token splitting/merging (YES/NO conditionals)
- **Algebra Position Manager**: Creates pools and mints liquidity positions
- **ERC20 ABIs**: Standard token operations

## 2. Proposal Creation Flow

### Step 1: Create Proposal
```javascript
createNewProposal() ->
  factory.createProposal({
    marketName,        // e.g., "Futarchy Proposal 1234567890"
    companyToken,      // PNK address
    currencyToken,     // sDAI address
    category,          // "general"
    language,          // "en_US"
    minBond,          // 200000000 (200 sDAI)
    openingTime       // Unix timestamp (3 months future)
  })
```

### Step 2: Setup Pools
After proposal creation, the system sets up 6 pools:
1. YES-PNK / sDAI (conditional)
2. NO-PNK / sDAI (conditional)
3. YES-sDAI / sDAI (conditional)
4. NO-sDAI / sDAI (conditional)
5. YES-PNK / NO-PNK (prediction)
6. YES-sDAI / NO-sDAI (prediction)

## 3. Key Parameters

### Initial Configuration
```javascript
// User inputs for pool setup
spotPrice = 0.0054               // Current PNK/sDAI price
eventProbability = 0.20          // 20% chance of YES
expectedImpact = 10%             // Expected price impact if YES wins
liquidityAmount = 100            // Default liquidity per pool
```

### Price Calculations
```javascript
// Conditional token prices
yesPrice = spotPrice * (1 + impact) * eventProbability
noPrice = spotPrice * (1 - eventProbability)

// Example with above values:
// YES-PNK price = 0.0054 * 1.10 * 0.20 = 0.001188 sDAI
// NO-PNK price = 0.0054 * 0.80 = 0.00432 sDAI
```

## 4. Token Ordering & AMM Mechanics

### AMM Internal Ordering
The AMM (Algebra) always orders tokens by address (alphabetically):
```javascript
// Determine AMM ordering
addr0 = ethers.getAddress(token0);
addr1 = ethers.getAddress(token1);
isLogicalOrderSameAsAMM = addr0.toLowerCase() < addr1.toLowerCase();

// If reordering needed:
if (!isLogicalOrderSameAsAMM) {
  ammToken0 = logicalToken1;  // Swap positions
  ammToken1 = logicalToken0;
  ammAmt0 = logicalAmt1;
  ammAmt1 = logicalAmt0;
}
```

### Price Setting for New Pools
```javascript
// Calculate sqrt price for pool initialization
if (isLogicalOrderSameAsAMM) {
  sqrtPriceX96 = sqrtEncode(amt1, amt0);  // Normal order
} else {
  sqrtPriceX96 = sqrtEncode(amt0, amt1);  // Inverted order
}

// Create and initialize pool
pm.createAndInitializePoolIfNecessary(
  ammToken0, 
  ammToken1, 
  sqrtPriceX96
);
```

## 5. Balance Verification System

### Multi-Stage Verification
```javascript
// Stage 1: Initial balance check
await refreshMultipleTokenBalances([token0, token1]);

// Stage 2: Fresh blockchain query
const freshBalance = await getFreshBalance(tokenAddr);

// Stage 3: Pre-mint verification
verifyLiquidityAmounts(
  token0, token1, 
  amount0, amount1,
  intendedPrice
);

// Stage 4: Final check before transaction
if (balance < amountNeeded) {
  console.error("Insufficient balance");
  return null;
}
```

### Token Splitting for Conditionals
When insufficient conditional tokens, the system automatically:
1. Checks underlying token balance (PNK or sDAI)
2. Calculates split amount needed
3. Approves adapter contract
4. Calls `splitPosition()` to create YES/NO tokens

```javascript
// Example: Need 100 YES-PNK
if (yesPnkBalance < 100) {
  // Split 100 PNK -> 100 YES-PNK + 100 NO-PNK
  await splitTokensViaAdapter(
    "YES-PNK", 
    yesPnkAddr,
    100,
    "PNK",
    pnkAddr,
    futarchyAdapter
  );
}
```

## 6. Liquidity Provision Process

### Pool Creation & Liquidity Addition
```javascript
addLiquidity(token0, token1, poolAddr) ->
  1. Check if pool exists (poolAddr === ZeroAddress?)
  2. If no pool:
     - Calculate initial price from token amounts
     - Create pool with sqrtPriceX96
  3. Ensure token allowances
  4. Mint liquidity position:
     {
       token0: ammToken0,
       token1: ammToken1,
       tickLower: -887272,  // Full range
       tickUpper: 887272,
       amount0Desired: ammAmt0,
       amount1Desired: ammAmt1,
       amount0Min: 0,
       amount1Min: 0,
       recipient: wallet,
       deadline: now + 1200
     }
```

## 7. Gas Optimization

### Gas Settings by Operation
```javascript
getGasOptions(operation) {
  switch(operation) {
    case 'CREATE_POOL':
      return { gasLimit: 5000000 };  // High for pool creation
    case 'MINT_POSITION':
      return { gasLimit: 1000000 };  // Medium for minting
    case 'SWAP':
      return { gasLimit: 300000 };   // Lower for swaps
    default:
      return {};  // Use default estimation
  }
}
```

## 8. Complete Flow Example

### Automated Setup
```javascript
// 1. Create proposal
proposalAddr = await createNewProposal({
  marketName: "Upgrade Protocol v2",
  openingTime: now + 3_months
});

// 2. Setup pools with parameters
await setupPoolsFromFutarchyProposal(proposalAddr, {
  spotPrice: 0.0054,
  eventProbability: 0.20,
  expectedImpact: 0.10,
  liquidityDefault: 100
});

// This will:
// - Calculate all 6 pool prices
// - Check/split tokens as needed
// - Create pools if they don't exist
// - Add liquidity with correct ratios
// - Verify final prices match targets
```

### Price Verification
After each pool creation:
```javascript
// Verify pool price matches intended
actualPrice = await poolPrice(poolAddress);
expectedPrice = calculateExpectedPrice(params);

if (Math.abs(actualPrice - expectedPrice) > 0.01) {
  console.warn("Price mismatch detected!");
}
```

## 9. Key Formulas

### Conditional Token Pricing
```
YES Price = Spot Price × (1 + Impact) × Probability
NO Price = Spot Price × (1 - Probability × Impact)
```

### Prediction Market Ratios
```
YES/NO Ratio = Probability / (1 - Probability)
Example: 20% probability = 0.20/0.80 = 0.25 (1 YES = 4 NO)
```

### Liquidity Requirements
For each pool, the system calculates:
```
Token0 Amount = Liquidity / sqrt(Price)
Token1 Amount = Liquidity × sqrt(Price)
```

## 10. Error Handling

Common issues handled:
- **Insufficient Balance**: Automatically splits underlying tokens
- **Pool Already Exists**: Uses existing pool instead of creating
- **Wrong Token Order**: Automatically reorders for AMM
- **Slippage**: Uses 0 minimum amounts (full range positions)
- **Gas Estimation**: Uses fixed limits for critical operations

## Usage Commands

### CLI Commands
```bash
# Create proposal only
node createProposals.js createProposal

# Create proposal and setup pools
node createProposals.js createProposal setupPools

# Setup pools for existing proposal
node createProposals.js setupFutarchyPools <proposalAddress>

# Automated setup with config
node createProposals.js setupFutarchyPoolsAuto config.txt

# Add liquidity to specific pool
node createProposals.js addLiquidity <token0> <token1> [poolAddr]
```

### Config File Format
```
PROPOSAL_ADDRESS=0x...  # Optional, creates new if empty
SPOT_PRICE=0.0054
EVENT_PROBABILITY=0.20
IMPACT=0.10
LIQUIDITY_DEFAULT=100
SKIP_EXISTING_WHEN_AUTO=true
FORCE_ADD_LIQUIDITY=1,2,3,4,5,6
```