# Split Position Fix Verification

## Problem
When using proposals from Supabase API, the `splitPosition()` function was failing with:
```
Cannot read properties of undefined (reading 'wrappedOutcomes')
```

## Root Cause
Line 697 in futarchy-complete.js was trying to access `this.proposal.wrapped.wrappedOutcomes` directly, but when using Supabase data, `this.proposal.wrapped` is undefined.

## Solution
Added conditional logic to handle both data sources:

```javascript
// Get YES/NO token addresses we'll receive (from wrapped outcomes)
const yesLabel = isCompanyCollateral ? 'YES_COMPANY' : 'YES_CURRENCY';
const noLabel = isCompanyCollateral ? 'NO_COMPANY' : 'NO_CURRENCY';

let yesToken, noToken;

// Handle both data sources: blockchain (wrapped) and Supabase (tokens)
if (this.proposal.wrapped && this.proposal.wrapped.wrappedOutcomes) {
    // Use wrapped data from blockchain
    const yesOutcome = this.proposal.wrapped.wrappedOutcomes.find(o => o.label === yesLabel);
    const noOutcome = this.proposal.wrapped.wrappedOutcomes.find(o => o.label === noLabel);
    yesToken = yesOutcome ? yesOutcome.wrapped1155 : this.tokens[isCompanyCollateral ? 'yesCompany' : 'yesCurrency'];
    noToken = noOutcome ? noOutcome.wrapped1155 : this.tokens[isCompanyCollateral ? 'noCompany' : 'noCurrency'];
} else if (this.tokens) {
    // Use token addresses from Supabase data
    yesToken = this.tokens[isCompanyCollateral ? 'yesCompany' : 'yesCurrency'];
    noToken = this.tokens[isCompanyCollateral ? 'noCompany' : 'noCurrency'];
} else {
    throw new Error('No token data available for split operation');
}
```

## What This Fixes
1. **Supabase Data**: When `this.proposal.wrapped` is undefined, the code now uses `this.tokens` for YES/NO addresses
2. **Blockchain Data**: When `this.proposal.wrapped.wrappedOutcomes` exists, it continues to use that data
3. **Error Handling**: If neither data source is available, it throws a clear error message

## Testing
To test the fix:
1. Run `npm run futarchy`
2. Select any proposal (including those from Supabase)
3. Choose "🔄 Split Position"
4. Select a collateral token
5. Enter an amount to split

The split should now work without the "Cannot read properties of undefined" error.

## Data Layer Architecture Context
This fix is part of the Data Layer Fetcher/Executor pattern where:
- **MarketEventsFetcher**: Fetches proposals from Supabase (no wrapped data)
- **ProposalFetcher**: Fetches proposals from blockchain (includes wrapped data)
- **FutarchyCartridge**: Executes split operations using available token data