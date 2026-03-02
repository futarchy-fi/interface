# Futarchy SDK Improvements Summary

## Overview
Successfully integrated Supabase market event data with the Data Layer pattern and fixed token handling for split operations.

## Key Improvements

### 1. MarketEventsFetcher Integration
- Created `fetchers/MarketEventsFetcher.js` that fetches proposals from Supabase API
- Shows all 11 proposals including private, test, and resolved ones
- Displays proposals with `[0xABCD...xyz]` address format for easy identification
- Integrates with DataLayer pattern by extending BaseFetcher

### 2. Token Extraction from Supabase Structure
The Supabase market event data structure contains tokens in `metadata`:
```javascript
{
  id: "0xBFE2b1B3746e401081C2abb56913c2d7042FA94d",
  metadata: {
    companyTokens: {
      base: { wrappedCollateralTokenAddress: "0x9C58BA..." },
      yes: { wrappedCollateralTokenAddress: "0xCd55A8..." },
      no: { wrappedCollateralTokenAddress: "0x92846C..." }
    },
    currencyTokens: {
      base: { wrappedCollateralTokenAddress: "0xaf2047..." },
      yes: { wrappedCollateralTokenAddress: "0x686B5a..." },
      no: { wrappedCollateralTokenAddress: "0x013729..." }
    }
  }
}
```

### 3. Split Position Fix
Fixed the `splitPosition()` function to handle both data sources:
```javascript
// Handle both data sources: blockchain (wrapped) and Supabase (tokens)
if (this.proposal.wrapped && this.proposal.wrapped.wrappedOutcomes) {
    // Use wrapped data from blockchain
    yesToken = yesOutcome.wrapped1155;
    noToken = noOutcome.wrapped1155;
} else if (this.tokens) {
    // Use token addresses from Supabase data
    yesToken = this.tokens[isCompanyCollateral ? 'yesCompany' : 'yesCurrency'];
    noToken = this.tokens[isCompanyCollateral ? 'noCompany' : 'noCurrency'];
}
```

### 4. Fallback Token Fetching
Added fallback to fetch tokens from proposal contract if not available:
```javascript
if (!this.tokens.companyToken || !this.tokens.currencyToken) {
    const tokensFromContract = await this.dataLayer.fetch('proposal.tokens', { 
        proposalAddress: this.proposal.id 
    });
    this.tokens = { ...this.tokens, ...tokensFromContract.data };
}
```

## Data Layer Architecture

### Pattern Overview
```
DataLayer (Coordinator)
    ├── Fetchers (Read Operations)
    │   ├── MarketEventsFetcher - Supabase API
    │   ├── ProposalFetcher - Blockchain data
    │   └── PoolDiscoveryFetcher - Pool discovery
    └── Executors (Write Operations)
        └── ViemExecutor
            └── FutarchyCartridge - Split/Merge/Redeem
```

### Integration Flow
1. **MarketEventsFetcher** fetches proposals from Supabase
2. User selects proposal with arrow keys
3. Token addresses extracted from `metadata` structure
4. **ProposalFetcher** optionally fetches additional blockchain data
5. **FutarchyCartridge** executes operations using token addresses

## Testing Instructions
1. Run `npm run futarchy`
2. Select any proposal (including test/private/resolved)
3. Choose "🔄 Split Position"
4. Select collateral token (GNO or sDAI)
5. Enter amount to split
6. Verify split executes without errors

## Files Modified
- `fetchers/MarketEventsFetcher.js` - Created
- `examples/futarchy-complete.js` - Updated token extraction and split logic
- Lines 134-142: Extract tokens from Supabase metadata
- Lines 232-266: Fetch wrapped tokens with fallback
- Lines 694-713: Handle both data sources in split

## Result
✅ All proposals now visible (11 total)
✅ Split position works with Supabase data
✅ Automatic fallback to proposal contract if needed
✅ Clean integration with Data Layer pattern