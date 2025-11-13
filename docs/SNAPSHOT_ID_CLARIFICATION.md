# Snapshot ID Clarification

This document clarifies the distinction between the different IDs used in the Snapshot integration.

## Two Different IDs

### 1. Market Event ID (from useConfig)
- **Variable name**: `marketEventId` or `MARKET_ADDRESS`
- **Example**: `0x7D96A3f714782710917f6045441B39483c5Dc60a`
- **Source**: Comes from the market configuration (`useConfig` hook)
- **Purpose**: Identifies the futarchy market/contract
- **Used in**:
  - Component props (`MARKET_ADDRESS`)
  - Supabase lookup queries
  - Market page routing

### 2. Snapshot Proposal ID (from Snapshot API)
- **Variable name**: `snapshotProposalId` or `proposal_id`
- **Example**: `0x40dbf611da3cb0dc1a5fd48140330e03f90214a9410ab2a25b782c1f3160eb0b`
- **Source**: Stored in Supabase `market_event_proposal_links` table
- **Purpose**: Identifies the Snapshot governance proposal
- **Used in**:
  - Snapshot GraphQL API queries
  - Snapshot.box URLs
  - Displaying voting results

## Data Flow

```
Market Page
    ↓
  MARKET_ADDRESS (0x7D96A3f7...)
    ↓
  useSnapshotData(MARKET_ADDRESS, { useSupabase: true })
    ↓
  Supabase Query:
    SELECT proposal_id
    FROM market_event_proposal_links
    WHERE market_event_id = '0x7D96A3f7...'
    ↓
  snapshotProposalId (0x40dbf611...)
    ↓
  Snapshot GraphQL API Query
    ↓
  Voting Results Data
```

## Code Examples

### In MarketPageShowcase.jsx
```javascript
// Market Event ID comes from useConfig
const { MARKET_ADDRESS } = config || {};

// Pass Market Event ID to hook
const { snapshotProposalId } = useSnapshotData(MARKET_ADDRESS, {
  useSupabase: true,  // This triggers the Supabase lookup
});

// snapshotProposalId is returned after Supabase lookup
console.log('Market Address:', MARKET_ADDRESS);
// → "0x7D96A3f714782710917f6045441B39483c5Dc60a"

console.log('Snapshot Proposal ID:', snapshotProposalId);
// → "0x40dbf611da3cb0dc1a5fd48140330e03f90214a9410ab2a25b782c1f3160eb0b"
```

### In useSnapshotData.js
```javascript
export function useSnapshotData(marketEventIdOrProposalId, options = {}) {
  const { useSupabase = true } = options;

  const fetchData = async () => {
    // Start with the input (Market Event ID)
    let snapshotProposalId = marketEventIdOrProposalId;

    // If Supabase lookup is enabled, fetch the Snapshot Proposal ID
    if (useSupabase && marketEventIdOrProposalId) {
      const fetchedId = await fetchSnapshotProposalId(marketEventIdOrProposalId);
      if (fetchedId) {
        snapshotProposalId = fetchedId; // Now we have the Snapshot Proposal ID
      }
    }

    // Use the Snapshot Proposal ID to fetch voting data
    const result = await getSnapshotWidgetData(snapshotProposalId, useMock);

    setState({
      ...state,
      snapshotProposalId, // Return the Snapshot Proposal ID
    });
  };
}
```

## Database Schema

### market_event_proposal_links table
```sql
CREATE TABLE market_event_proposal_links (
  id SERIAL PRIMARY KEY,
  market_event_id TEXT NOT NULL,      -- Market Address (0x7D96A3f7...)
  proposal_id TEXT NOT NULL,          -- Snapshot Proposal ID (0x40dbf611...)
  created_at TIMESTAMP DEFAULT NOW()
);

-- Example row:
INSERT INTO market_event_proposal_links (market_event_id, proposal_id)
VALUES (
  '0x7D96A3f714782710917f6045441B39483c5Dc60a',  -- Futarchy market address
  '0x40dbf611da3cb0dc1a5fd48140330e03f90214a9410ab2a25b782c1f3160eb0b'  -- Snapshot proposal
);
```

## Hook Parameter Naming

The hook parameter is intentionally named `marketEventIdOrProposalId` to indicate it can accept either:

1. **Market Event ID** (when `useSupabase: true`) - The hook will look up the Snapshot Proposal ID
2. **Snapshot Proposal ID** (when `useSupabase: false`) - The hook will use it directly

### Why this design?

This flexible design allows:
- **Dynamic lookup**: Pass market address, get Snapshot data automatically
- **Direct usage**: Pass Snapshot proposal ID directly if you already have it
- **Testing**: Easily test with mock proposal IDs without Supabase

## Common Mistakes to Avoid

❌ **Wrong**: Using `proposalId` in dependency arrays
```javascript
useEffect(() => {
  // ...
}, [proposalId]); // proposalId is not defined!
```

✅ **Correct**: Using `marketEventIdOrProposalId` in dependency arrays
```javascript
useEffect(() => {
  // ...
}, [marketEventIdOrProposalId]);
```

❌ **Wrong**: Confusing the two IDs
```javascript
// Don't pass Snapshot Proposal ID to useConfig
const config = useConfig(snapshotProposalId); // Wrong!

// Don't query Snapshot API with Market Event ID
const query = `proposal(id: "${marketAddress}")` // Wrong!
```

✅ **Correct**: Use each ID for its purpose
```javascript
// Use Market Address with useConfig
const config = useConfig(marketAddress);

// Let the hook handle the ID lookup
const { snapshotProposalId } = useSnapshotData(marketAddress, { useSupabase: true });

// Use Snapshot Proposal ID with Snapshot API
const query = `proposal(id: "${snapshotProposalId}")` // Correct!
```

## Summary

| ID Type | Example | Source | Used For |
|---------|---------|--------|----------|
| Market Event ID | `0x7D96A3f7...` | useConfig, market routing | Supabase lookup, identifying market |
| Snapshot Proposal ID | `0x40dbf611...` | Supabase database | Snapshot API, voting results |

**Key Point**: The Market Event ID is used to *find* the Snapshot Proposal ID, which is then used to fetch voting data from Snapshot.
