# Snapshot + Supabase Integration

## Overview

The Snapshot widget now automatically fetches Snapshot proposal IDs from Supabase based on the market event ID. This eliminates the need to hardcode Snapshot proposal IDs in environment variables.

## Architecture

```
Market Event ID (0xBFE2b1B...)
    ↓
Supabase Table: market_event_proposal_links
    ↓
Snapshot Proposal ID (0x40dbf611...)
    ↓
Snapshot GraphQL API
    ↓
Widget displays voting results
```

## Database Schema

### Table: `market_event_proposal_links`

Maps market events to their corresponding Snapshot proposals.

**Columns:**
- `market_event_id` (text) - The futarchy market event address (e.g., `0xBFE2b1B3746e401081C2abb56913c2d7042FA94d`)
- `proposal_id` (text) - The Snapshot proposal ID (e.g., `0x40dbf611da3cb0dc1a5fd48140330e03f90214a9410ab2a25b782c1f3160eb0b`)
- `created_at` (timestamp) - When the link was created
- `updated_at` (timestamp) - When the link was last updated

**Example Row:**
```json
{
  "market_event_id": "0xBFE2b1B3746e401081C2abb56913c2d7042FA94d",
  "proposal_id": "0x40dbf611da3cb0dc1a5fd48140330e03f90214a9410ab2a25b782c1f3160eb0b",
  "created_at": "2025-10-20T12:00:00Z",
  "updated_at": "2025-10-20T12:00:00Z"
}
```

## How It Works

### 1. Component receives market_event_id

```javascript
// In MarketPage.jsx
const MarketPage = ({ marketId }) => {
  // marketId is the market_event_id (e.g., "0xBFE2b1B...")
}
```

### 2. Hook fetches Snapshot proposal ID from Supabase

```javascript
const {
  loading,
  data,
  snapshotProposalId, // The actual Snapshot proposal ID
  source,
} = useSnapshotData(marketId, {
  useSupabase: true,  // Enable Supabase lookup (default: true)
  useMock: false,
  autoFetch: true,
  refreshInterval: 60000,
});
```

### 3. Supabase query executes

```sql
SELECT proposal_id
FROM market_event_proposal_links
WHERE market_event_id = '0xBFE2b1B3746e401081C2abb56913c2d7042FA94d'
LIMIT 1;
```

### 4. Snapshot data fetched using proposal_id

Once the Snapshot proposal ID is retrieved from Supabase, the hook automatically fetches the voting data from Snapshot's GraphQL API.

## Usage Examples

### Basic Usage (with Supabase)

```javascript
import { useSnapshotData } from '@/hooks/useSnapshotData';

function MyComponent({ marketEventId }) {
  const {
    loading,
    data,
    error,
    snapshotProposalId,
    source
  } = useSnapshotData(marketEventId);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!data) return <div>No Snapshot data available</div>;

  return (
    <div>
      <h2>{data.title}</h2>
      <p>Snapshot Proposal: {snapshotProposalId}</p>
      <p>Data Source: {source}</p>
      {/* Display voting results */}
    </div>
  );
}
```

### Direct Snapshot ID (skip Supabase)

```javascript
const {
  data
} = useSnapshotData('0x40dbf611...', {
  useSupabase: false  // Skip Supabase, use ID directly
});
```

### Mock Data (for development)

```javascript
const {
  data
} = useSnapshotData(marketEventId, {
  useMock: true,  // Use mock data instead of API
  useSupabase: false
});
```

## Environment Variables

### New Variable

```bash
# Enable/disable Supabase lookup
NEXT_PUBLIC_USE_SUPABASE_SNAPSHOT=true
```

### Deprecated Variable

```bash
# DEPRECATED: No longer needed with Supabase integration
# NEXT_PUBLIC_SNAPSHOT_PROPOSAL_ID=0x40dbf611...
```

Instead of hardcoding a single Snapshot proposal ID, the system now looks it up dynamically based on the market event.

## Files

### New Files

1. **`src/utils/supabaseSnapshot.js`**
   - `fetchSnapshotProposalId(marketEventId)` - Fetches Snapshot proposal ID from Supabase
   - `fetchAllProposalLinks()` - Fetches all market→proposal mappings

### Modified Files

1. **`src/hooks/useSnapshotData.js`**
   - Added `useSupabase` option (default: `true`)
   - Automatically fetches Snapshot proposal ID from Supabase before fetching data
   - Returns `snapshotProposalId` in the hook result

2. **`.env`**
   - Added `NEXT_PUBLIC_USE_SUPABASE_SNAPSHOT=true`
   - Commented out `NEXT_PUBLIC_SNAPSHOT_PROPOSAL_ID` (deprecated)

## Data Flow

### Full Flow Diagram

```
┌─────────────────────┐
│  MarketPage         │
│  marketId passed    │
│  (market_event_id)  │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  useSnapshotData    │
│  hook called        │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────────────────────┐
│  fetchSnapshotProposalId()          │
│  ↓                                  │
│  Supabase Query:                    │
│  SELECT proposal_id                 │
│  FROM market_event_proposal_links   │
│  WHERE market_event_id = ?          │
└──────────┬──────────────────────────┘
           │
           ↓
┌─────────────────────┐
│  Got proposal_id    │
│  0x40dbf611...      │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────────────┐
│  getSnapshotWidgetData()    │
│  ↓                          │
│  Snapshot GraphQL Query:    │
│  query {                    │
│    proposal(id: "...")      │
│  }                          │
└──────────┬──────────────────┘
           │
           ↓
┌─────────────────────┐
│  Widget displays    │
│  voting results     │
└─────────────────────┘
```

## Fallback Behavior

### If Supabase lookup fails:

1. Logs warning to console
2. Uses the provided `marketEventId` directly as Snapshot proposal ID
3. Continues to fetch from Snapshot API
4. If that also fails, falls back to mock data

**Console Output:**
```
[useSnapshotData] Fetching Snapshot proposal ID from Supabase for market_event_id: 0xBFE2b1B...
[SupabaseSnapshot] Error fetching proposal ID: <error>
[useSnapshotData] No Snapshot proposal ID found in Supabase, using provided ID as fallback
```

## Adding New Market→Proposal Links

### Via Supabase Dashboard

1. Go to your Supabase project
2. Navigate to Table Editor → `market_event_proposal_links`
3. Click "Insert row"
4. Fill in:
   - `market_event_id`: Your futarchy market address (e.g., `0xBFE2b1B...`)
   - `proposal_id`: The Snapshot proposal ID (e.g., `0x40dbf611...`)
5. Save

### Via SQL

```sql
INSERT INTO market_event_proposal_links (market_event_id, proposal_id)
VALUES (
  '0xBFE2b1B3746e401081C2abb56913c2d7042FA94d',
  '0x40dbf611da3cb0dc1a5fd48140330e03f90214a9410ab2a25b782c1f3160eb0b'
);
```

### Via API

```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(supabaseUrl, supabaseKey);

await supabase
  .from('market_event_proposal_links')
  .insert({
    market_event_id: '0xBFE2b1B3746e401081C2abb56913c2d7042FA94d',
    proposal_id: '0x40dbf611da3cb0dc1a5fd48140330e03f90214a9410ab2a25b782c1f3160eb0b'
  });
```

## Testing

### Test with Real Data

1. Ensure you have a row in `market_event_proposal_links` table
2. Pass the `market_event_id` to the component
3. Widget should automatically fetch and display Snapshot data

### Test with Mock Data

```javascript
// In your component
const { data } = useSnapshotData(marketEventId, {
  useMock: true,
  useSupabase: false
});
```

### Test Fallback Behavior

1. Use a `market_event_id` that doesn't exist in Supabase
2. Check console for fallback warning
3. Verify it attempts to use the ID directly with Snapshot API

## Troubleshooting

### Widget shows "No Snapshot data available"

**Check:**
1. ✅ Is there a row in `market_event_proposal_links` for your `market_event_id`?
2. ✅ Is the `proposal_id` correct in Supabase?
3. ✅ Does the Snapshot proposal exist and is active?

**Debug:**
```javascript
const { snapshotProposalId, source, error } = useSnapshotData(marketEventId);

console.log('Snapshot Proposal ID:', snapshotProposalId);
console.log('Data Source:', source);
console.log('Error:', error);
```

### Supabase query fails

**Check:**
1. ✅ Are Supabase credentials correct in `.env`?
2. ✅ Does the table `market_event_proposal_links` exist?
3. ✅ Does the table have the correct RLS (Row Level Security) policies?

**Test Supabase connection:**
```javascript
import { fetchSnapshotProposalId } from '@/utils/supabaseSnapshot';

const proposalId = await fetchSnapshotProposalId('0xBFE2b1B...');
console.log('Fetched proposal ID:', proposalId);
```

### Widget shows old/cached data

The widget auto-refreshes every 60 seconds by default. To force refresh:

```javascript
const { refetch } = useSnapshotData(marketEventId);

// Force refresh
refetch();
```

## Performance

### Caching

Supabase queries are not currently cached. Each page load queries Supabase fresh.

**Future Enhancement:** Add caching layer for Supabase lookups:
```javascript
// Cache mapping for 5 minutes
const CACHE_TTL = 5 * 60 * 1000;
const proposalIdCache = new Map();
```

### Query Optimization

Current query:
```sql
SELECT proposal_id FROM market_event_proposal_links
WHERE market_event_id = ? LIMIT 1
```

**Recommended Index:**
```sql
CREATE INDEX idx_market_event_id
ON market_event_proposal_links(market_event_id);
```

## Migration Guide

### Before (Hardcoded)

```javascript
// .env
NEXT_PUBLIC_SNAPSHOT_PROPOSAL_ID=0x40dbf611...

// Component
const snapshotProposalId = process.env.NEXT_PUBLIC_SNAPSHOT_PROPOSAL_ID;
const { data } = useSnapshotData(snapshotProposalId);
```

**Problem:** One hardcoded Snapshot proposal for all markets.

### After (Supabase)

```javascript
// .env
NEXT_PUBLIC_USE_SUPABASE_SNAPSHOT=true

// Component
const { data } = useSnapshotData(marketEventId);
```

**Benefit:** Each market can have its own Snapshot proposal.

## Benefits

✅ **Dynamic Mapping**: Each market event can have its own Snapshot proposal
✅ **No Hardcoding**: No need to update `.env` for each new proposal
✅ **Centralized**: All mappings in one Supabase table
✅ **Flexible**: Easy to add/update mappings via Supabase dashboard
✅ **Fallback**: Graceful degradation if Supabase fails
✅ **Backward Compatible**: Can still use direct Snapshot IDs if needed

## Future Enhancements

1. **Caching**: Cache Supabase lookups to reduce queries
2. **Multiple Proposals**: Support multiple Snapshot proposals per market
3. **Historical Data**: Track proposal→market links over time
4. **Admin UI**: Build UI to manage market→proposal mappings
5. **Validation**: Validate that Snapshot proposal exists before saving to Supabase

---

**Version**: 1.2.0 (Supabase Integration)
**Date**: October 20, 2025
**Status**: ✅ Complete & Production Ready
