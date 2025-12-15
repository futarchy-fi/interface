# Snapshot Integration Documentation

## Overview

The Snapshot Results widget displays real-time voting data from Snapshot governance proposals. It supports both live API data and mock data for development/testing.

## Features

- **Real-time Data**: Fetches live proposal data from Snapshot GraphQL API
- **Auto-refresh**: Updates every 60 seconds
- **Mock Data Support**: Switch between real and mock data via environment variables
- **Quorum Tracking**: Displays quorum percentage and whether it's met (including quorumType)
- **Smart Precision**: Automatically adjusts decimal places to avoid showing 0.00%
- **Responsive Design**: Works on mobile and desktop
- **Visual Indicators**: Shows data source (purple dot for live API)
- **Direct Link**: External link icon to view proposal on Snapshot.box
- **Snapshot Description**: Educational description with "Learn more" link

## Configuration

### Environment Variables

Add these to your `.env` file:

```bash
# Snapshot Configuration
NEXT_PUBLIC_SNAPSHOT_PROPOSAL_ID=0x40dbf611da3cb0dc1a5fd48140330e03f90214a9410ab2a25b782c1f3160eb0b
NEXT_PUBLIC_USE_MOCK_SNAPSHOT=false
```

**Variables:**
- `NEXT_PUBLIC_SNAPSHOT_PROPOSAL_ID`: The Snapshot proposal ID (hex string)
- `NEXT_PUBLIC_USE_MOCK_SNAPSHOT`: Set to `true` for mock data, `false` for real API data

### Finding Proposal IDs

1. Go to [Snapshot](https://snapshot.org/)
2. Navigate to your proposal
3. The proposal ID is in the URL: `snapshot.org/#/{space}/proposal/{PROPOSAL_ID}`
4. Use the full hex ID in your `.env` file

## Usage

### Using the Hook

The `useSnapshotData` hook makes it easy to fetch and manage Snapshot data:

```javascript
import { useSnapshotData } from '../hooks/useSnapshotData';

function MyComponent() {
  const {
    loading,
    data,
    error,
    source,
    highestResult,
    proposalPassed,
    quorumMet,
    refetch,
  } = useSnapshotData(proposalId, {
    useMock: false,
    autoFetch: true,
    refreshInterval: 60000, // 60 seconds
  });

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h2>{data.title}</h2>
      <p>Total Votes: {data.totalCount}</p>
      <p>Quorum: {data.quorumPercent}%</p>
      {data.items.map(item => (
        <div key={item.key}>
          {item.label}: {item.percentage}% ({item.count})
        </div>
      ))}
    </div>
  );
}
```

### Hook Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `useMock` | boolean | `false` | Force use of mock data |
| `autoFetch` | boolean | `true` | Auto-fetch on component mount |
| `refreshInterval` | number | `null` | Auto-refresh interval in milliseconds |

### Hook Return Values

| Value | Type | Description |
|-------|------|-------------|
| `loading` | boolean | Whether data is being fetched |
| `data` | object | Transformed proposal data |
| `error` | string | Error message if fetch failed |
| `source` | string | Data source: 'api', 'mock', 'mock_fallback', 'error' |
| `highestResult` | object | Choice with the highest vote count |
| `proposalPassed` | boolean | Whether the proposal passed (highest is "For"/"Yes") |
| `quorumMet` | boolean | Whether quorum requirement is met |
| `refetch` | function | Manually trigger a data refresh |

## Data Structure

### Snapshot API Response

```json
{
  "data": {
    "proposal": {
      "title": "GIP-139: Should GnosisDAO support ProbeLab...",
      "space": {
        "id": "gnosis.eth",
        "name": "GnosisDAO"
      },
      "choices": ["For", "Against", "Abstain"],
      "scores": [20414.39, 10.46, 5031.64],
      "scores_total": 25456.50,
      "scores_state": "pending",
      "votes": 85,
      "quorum": 10000,
      "state": "active"
    }
  }
}
```

### Transformed Data

The hook transforms the API response into a widget-friendly format:

```javascript
{
  items: [
    {
      key: 'for',
      label: 'For',
      count: 20414.39,
      percentage: 80.2,
      iconType: 'check',
      colorKey: 'success'
    },
    {
      key: 'against',
      label: 'Against',
      count: 10.46,
      percentage: 0.04,
      iconType: 'x',
      colorKey: 'danger'
    },
    {
      key: 'abstain',
      label: 'Abstain',
      count: 5031.64,
      percentage: 19.8,
      iconType: 'line',
      colorKey: 'neutral'
    }
  ],
  totalCount: 25456.50,
  quorumPercent: 39.3,
  quorumMet: true,
  votes: 85,
  title: "GIP-139: Should GnosisDAO support ProbeLab...",
  spaceName: "GnosisDAO",
  state: "active"
}
```

## Testing with Mock Data

To test with mock data:

1. Set `NEXT_PUBLIC_USE_MOCK_SNAPSHOT=true` in `.env`
2. Restart your dev server
3. The widget will display predefined mock data

Mock data example:
- For: 20,414 (80.2%)
- Against: 10 (0.04%)
- Abstain: 5,031 (19.8%)

## Testing with Real Data

To test with real Snapshot data:

1. Set `NEXT_PUBLIC_USE_MOCK_SNAPSHOT=false` in `.env`
2. Set `NEXT_PUBLIC_SNAPSHOT_PROPOSAL_ID` to a valid proposal ID
3. Restart your dev server
4. The widget will fetch live data from Snapshot

### Example Test Query

You can test the Snapshot GraphQL API directly:

```graphql
query {
  proposal (id: "0x40dbf611da3cb0dc1a5fd48140330e03f90214a9410ab2a25b782c1f3160eb0b") {
    title
    space {
      id
      name
    }
    choices
    scores
    scores_total
    scores_state
    votes
    quorum          # Quorum requirement for the proposal
    quorumType      # How quorum is calculated (e.g., "default")
    state           # Proposal state (e.g., "active", "closed")
  }
}
```

Test it at: https://hub.snapshot.org/graphql

**New in this version:**
- Added `quorumType` field to understand quorum calculation method
- All percentages use smart precision formatting

## Quorum Calculation

The quorum is calculated automatically from the Snapshot API:

```javascript
// Quorum percentage shows progress toward meeting quorum
quorumPercent = (scores_total / quorum) * 100

// Check if quorum is met
quorumMet = scores_total >= quorum
```

**Example:**
- Current total votes: 25,456
- Quorum requirement: 75,000
- Quorum percentage: (25,456 / 75,000) × 100 = 33.9%

This means the proposal has reached 33.9% of the required quorum.

If the Snapshot proposal doesn't have a quorum field, these values will be `null`.

The widget also fetches `quorumType` from the API to understand how quorum is calculated for the specific proposal.

## Smart Precision

The widget uses **smart precision** to avoid showing `0.00%` for very small percentages. The system automatically adjusts decimal places based on the value:

### Precision Rules

```javascript
function formatSmartPercentage(percentage) {
  if (percentage === 0) return '0';
  if (percentage >= 10) return percentage.toFixed(2);      // 10%+ → "80.19%"
  if (percentage >= 1) return percentage.toFixed(2);       // 1-10% → "5.67%"
  if (percentage >= 0.01) return percentage.toFixed(2);    // 0.01-1% → "0.04%"
  if (percentage >= 0.001) return percentage.toFixed(3);   // 0.001-0.01% → "0.004%"
  if (percentage >= 0.0001) return percentage.toFixed(4);  // Very small → "0.0004%"
  return percentage.toFixed(5);                            // Tiny → "0.00004%"
}
```

### Examples

| Actual Value | Without Smart Precision | With Smart Precision |
|--------------|-------------------------|----------------------|
| 80.19245% | 80.19% | **80.19%** |
| 19.77234% | 19.77% | **19.77%** |
| 0.04123% | 0.04% | **0.04%** |
| 0.00456% | 0.00% ❌ | **0.005%** ✅ |
| 0.000789% | 0.00% ❌ | **0.0008%** ✅ |
| 0.000012% | 0.00% ❌ | **0.00001%** ✅ |

### Why Smart Precision?

Without smart precision, very small vote percentages (like "Against" with 10 votes out of 25,000) would display as `0.00%`, which is misleading. Smart precision ensures users always see meaningful numbers.

**Applies to:**
- Vote percentages (For, Against, Abstain, etc.)
- Quorum progress percentage
- Both collapsed and expanded widget views

## Widget Features

### Visual Indicators

- **Purple dot (●)**: Appears when using live API data (violet color to avoid confusion with "For" votes)
- **Cycling percentages**: Rotates through all voting options every 3 seconds
- **Border color**: Matches the winning option's color
- **Loading spinner**: Purple spinner while fetching data
- **External link icon**: White/gray icons (not green to avoid confusion with "For" votes)
- **Clickable title**: "Snapshot Results" title is clickable and opens the proposal
- **Learn more link**: Description and link to learn about Snapshot voting platform

### Color Scheme

**Vote Options:**
- **Success (Green)**: For, Yes, Approve
- **Danger (Red)**: Against, No, Reject
- **Neutral (Gray)**: Abstain, other options

**UI Elements:**
- **Purple/Violet**: System indicators (live API dot, loading spinner)
- **White/Gray**: Links and external icons (not green to avoid confusion with "For" votes)
- **Green is ONLY used for "For" votes** to maintain clear visual distinction

## API Utility Functions

### `fetchSnapshotProposal(proposalId)`

Fetches raw proposal data from Snapshot GraphQL API.

```javascript
import { fetchSnapshotProposal } from '../utils/snapshotApi';

const result = await fetchSnapshotProposal('0x40db...');
// Returns: { success: true, data: {...} }
```

### `transformSnapshotData(proposalData)`

Transforms raw Snapshot data into widget format.

```javascript
import { transformSnapshotData } from '../utils/snapshotApi';

const widgetData = transformSnapshotData(rawProposalData);
```

### `getSnapshotWidgetData(proposalId, useMock)`

Combined fetch and transform with automatic fallback to mock.

```javascript
import { getSnapshotWidgetData } from '../utils/snapshotApi';

const result = await getSnapshotWidgetData('0x40db...', false);
// Returns: { success: true, data: {...}, source: 'api' }
```

## Troubleshooting

### Widget shows mock data instead of real data

- Check that `NEXT_PUBLIC_USE_MOCK_SNAPSHOT=false`
- Verify the proposal ID is correct
- Check browser console for API errors
- Ensure you've restarted the dev server

### "Failed to fetch Snapshot data" error

- Verify the proposal ID exists on Snapshot
- Check network connectivity
- Try the GraphQL query directly at https://hub.snapshot.org/graphql
- The widget will automatically fall back to mock data

### Data not refreshing

- Check that `refreshInterval` is set in the hook options
- Verify the component is still mounted
- Check browser console for errors

## Files

- `src/utils/snapshotApi.js`: Core API utility functions
- `src/hooks/useSnapshotData.js`: React hook for Snapshot data
- `src/components/futarchyFi/marketPage/page/MarketPage.jsx`: Widget implementation
- `.env`: Configuration file

## Future Enhancements

Potential improvements:

1. **WebSocket support**: Real-time updates without polling
2. **Multiple proposals**: Support for multiple Snapshot proposals
3. **Historical data**: Show voting trends over time
4. **Vote breakdown**: Show individual voter details
5. **Caching**: Cache Snapshot data to reduce API calls
