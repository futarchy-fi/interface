# Trade History API Documentation

## Overview

The Trade History API provides a flexible system for fetching and formatting trade data using the DataLayer architecture. It consists of two main components:

- **TradeHistoryFetcher**: Fetches raw trade data from Supabase with token enrichment
- **TradeHistoryCartridge**: Formats trade data into a standardized structure

## Architecture

```
DataLayer
├── TradeHistoryFetcher (Fetcher)
│   ├── Fetches raw trade data from Supabase
│   └── Enriches with ERC20 token metadata
└── TradeHistoryCartridge (Executor)
    ├── Formats trades into standardized structure
    └── Generates trade summaries
```

## Setup

```javascript
import { DataLayer } from './DataLayer.js';
import { TradeHistoryFetcher } from './fetchers/TradeHistoryFetcher.js';
import { ERC20Fetcher } from './fetchers/ERC20Fetcher.js';
import TradeHistoryCartridge from './cartridges/TradeHistoryCartridge.js';

// Initialize DataLayer
const dataLayer = new DataLayer();

// Initialize ERC20Fetcher for token metadata
const erc20Fetcher = new ERC20Fetcher({
    chainId: 100,  // Gnosis Chain
    rpcUrl: 'https://rpc.gnosischain.com'
});

// Initialize TradeHistoryFetcher
const tradeHistoryFetcher = new TradeHistoryFetcher({
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_KEY,
    erc20Fetcher: erc20Fetcher
});

// Register fetcher and cartridge
dataLayer.registerFetcher(tradeHistoryFetcher);
const tradeHistoryCartridge = new TradeHistoryCartridge(dataLayer);
dataLayer.registerExecutor(tradeHistoryCartridge);
```

## API Operations

### TradeHistoryFetcher Operations

The fetcher provides 5 operations for flexible trade data retrieval:

#### 1. `trades.history` - Flexible Query

Fetch trade history with flexible filtering options.

**Parameters:**
- `userAddress` (string, optional): Filter by user wallet address
- `proposalId` (string, optional): Filter by proposal ID/address
- `limit` (number, optional): Number of records to return (default: 100)
- `orderBy` (string, optional): Field to sort by (default: 'timestamp')
- `ascending` (boolean, optional): Sort order (default: false)

**Example - Get all trades for a proposal:**
```javascript
const result = await dataLayer.fetch('trades.history', {
    proposalId: '0x9590dAF4d5cd4009c3F9767C5E7668175cFd37CF',
    limit: 50
});
```

**Example - Get all trades for a user:**
```javascript
const result = await dataLayer.fetch('trades.history', {
    userAddress: '0xea820f6fea20a06af94b291c393c68956199cbe9',
    limit: 50
});
```

**Example - Get trades for a specific user on a specific proposal:**
```javascript
const result = await dataLayer.fetch('trades.history', {
    userAddress: '0xea820f6fea20a06af94b291c393c68956199cbe9',
    proposalId: '0x9590dAF4d5cd4009c3F9767C5E7668175cFd37CF',
    limit: 20
});
```

**Example - Get all recent trades (no filters):**
```javascript
const result = await dataLayer.fetch('trades.history', {
    limit: 100,
    orderBy: 'timestamp',
    ascending: false
});
```

**Response Structure:**
```javascript
{
    status: 'success',
    data: [
        {
            id: "...",
            userAddress: "0xea820f6fea20a06af94b291c393c68956199cbe9",
            proposalId: "0x9590dAF4d5cd4009c3F9767C5E7668175cFd37CF",
            poolId: "...",

            // Token 0 details with metadata
            token0: "0x...",
            token0Symbol: "YES_PROP",
            token0Name: "Yes Proposal Token",
            token0Decimals: 18,
            amount0: "1500000000000000000",
            amount0Formatted: "1.50",

            // Token 1 details with metadata
            token1: "0x...",
            token1Symbol: "WXDAI",
            token1Name: "Wrapped XDAI",
            token1Decimals: 18,
            amount1: "-1200000000000000000",
            amount1Formatted: "1.20",

            // Trade metadata
            tradeType: "buy",
            side: "buy",
            price: 0.8,
            priceFormatted: "$0.8000",
            tradeSummary: "Bought 1.50 YES_PROP with 1.20 WXDAI",

            // Outcome determination
            outcome: "YES",
            token0Outcome: "YES",
            token1Outcome: null,

            // Transaction info
            transactionHash: "0x...",
            blockNumber: 12345678,
            blockTime: "2024-01-15T10:30:00.000Z",
            timestampFormatted: "2024-01-15T10:30:00.000Z",
            createdAt: "2024-01-15T10:30:00.000Z"
        }
        // ... more trades
    ],
    source: "TradeHistoryFetcher",
    count: 50,
    filters: {
        userAddress: "0xea820f6fea20a06af94b291c393c68956199cbe9",
        proposalId: "0x9590dAF4d5cd4009c3F9767C5E7668175cFd37CF",
        limit: 50,
        orderBy: "timestamp",
        ascending: false
    },
    timestamp: 1705318200000
}
```

#### 2. `trades.user` - User-Specific Trades

Convenience method for fetching all trades for a specific user.

**Parameters:**
- `userAddress` (string, required): User wallet address
- `limit` (number, optional): Number of records (default: 50)

**Example:**
```javascript
const result = await dataLayer.fetch('trades.user', {
    userAddress: '0xea820f6fea20a06af94b291c393c68956199cbe9',
    limit: 25
});
```

#### 3. `trades.proposal` - Proposal-Specific Trades

Convenience method for fetching all trades for a specific proposal.

**Parameters:**
- `proposalId` (string, required): Proposal ID/address
- `limit` (number, optional): Number of records (default: 100)

**Example:**
```javascript
const result = await dataLayer.fetch('trades.proposal', {
    proposalId: '0x9590dAF4d5cd4009c3F9767C5E7668175cFd37CF',
    limit: 100
});
```

#### 4. `trades.recent` - Recent Trades

Fetch recent trades across all proposals and users.

**Parameters:**
- `limit` (number, optional): Number of records (default: 20)

**Example:**
```javascript
const result = await dataLayer.fetch('trades.recent', {
    limit: 10
});
```

#### 5. `trades.summary` - Trade Statistics

Get aggregated statistics for trades.

**Parameters:**
- `userAddress` (string, optional): Filter by user
- `proposalId` (string, optional): Filter by proposal

**Note:** At least one of `userAddress` or `proposalId` must be provided.

**Example:**
```javascript
const result = await dataLayer.fetch('trades.summary', {
    proposalId: '0x9590dAF4d5cd4009c3F9767C5E7668175cFd37CF'
});
```

**Response Structure:**
```javascript
{
    status: 'success',
    data: {
        totalTrades: 150,
        uniqueTokens: 4,
        totalVolume: 45000.50,
        averagePrice: 0.85,
        firstTrade: { /* first trade object */ },
        lastTrade: { /* most recent trade object */ },
        tradesByType: {
            buy: { count: 80, volume: 25000, trades: [...] },
            sell: { count: 70, volume: 20000.50, trades: [...] }
        },
        tradesByToken: {
            "0x...": {
                count: 100,
                volume: 30000,
                averagePrice: 0.82,
                trades: [...]
            }
        }
    },
    source: "TradeHistoryFetcher",
    filters: { proposalId: "0x9590dAF4d5cd4009c3F9767C5E7668175cFd37CF" },
    timestamp: 1705318200000
}
```

### TradeHistoryCartridge Operations

The cartridge provides formatted output optimized for display.

#### 1. `trades.formatted` - Formatted Trade Display

Format trades into a standardized structure for UI display.

**Parameters:**
- `userAddress` (string, optional): Filter by user
- `proposalId` (string, optional): Filter by proposal
- `limit` (number, optional): Number of records

**Example - All trades for a proposal:**
```javascript
for await (const step of dataLayer.execute('trades.formatted', {
    proposalId: '0x9590dAF4d5cd4009c3F9767C5E7668175cFd37CF',
    limit: 10
})) {
    if (step.status === 'success') {
        console.log(step.data);
    }
}
```

**Example - All trades for a user:**
```javascript
for await (const step of dataLayer.execute('trades.formatted', {
    userAddress: '0xea820f6fea20a06af94b291c393c68956199cbe9',
    limit: 10
})) {
    if (step.status === 'success') {
        console.log(step.data);
    }
}
```

**Example - Trades for both user and proposal:**
```javascript
for await (const step of dataLayer.execute('trades.formatted', {
    userAddress: '0xea820f6fea20a06af94b291c393c68956199cbe9',
    proposalId: '0x9590dAF4d5cd4009c3F9767C5E7668175cFd37CF',
    limit: 10
})) {
    if (step.status === 'success') {
        console.log(step.data);
    }
}
```

**Response Structure:**
```javascript
{
    trades: [
        {
            outcome: {
                eventSide: "yes",      // "yes" | "no" | "neutral"
                operationSide: "buy"   // "buy" | "sell"
            },
            amount: {
                tokenIN: {
                    symbol: "WXDAI",
                    value: "1.200000",
                    address: "0x..."
                },
                tokenOUT: {
                    symbol: "YES_PROP",
                    value: "1.500000",
                    address: "0x..."
                }
            },
            price: "1.2500",
            date: 1705318200000,
            transactionLink: "https://gnosisscan.io/tx/0x...",
            poolAddress: "0x...",
            blockNumber: 12345678
        }
        // ... more trades
    ],
    count: 10,
    summary: {
        totalTrades: 10,
        outcomes: {
            yes: 6,
            no: 3,
            neutral: 1
        },
        operations: {
            buy: 7,
            sell: 3
        },
        dateRange: {
            start: 1705318100000,
            end: 1705318500000
        },
        uniqueTokens: ["WXDAI", "YES_PROP", "NO_PROP"],
        uniquePools: ["0x..."]
    }
}
```

#### 2. `trades.summary` - Summary Only

Get just the summary statistics without individual trades.

**Parameters:**
- `userAddress` (string, optional): Filter by user
- `proposalId` (string, optional): Filter by proposal
- `limit` (number, optional): Number of records to analyze

**Example:**
```javascript
for await (const step of dataLayer.execute('trades.summary', {
    proposalId: '0x9590dAF4d5cd4009c3F9767C5E7668175cFd37CF',
    limit: 100
})) {
    if (step.status === 'success') {
        console.log(step.data);
    }
}
```

**Response Structure:**
```javascript
{
    totalTrades: 100,
    outcomes: {
        yes: 60,
        no: 35,
        neutral: 5
    },
    operations: {
        buy: 70,
        sell: 30
    },
    dateRange: {
        start: 1705318100000,
        end: 1705318500000
    },
    uniqueTokens: ["WXDAI", "YES_PROP", "NO_PROP", "SDAI"],
    uniquePools: ["0x...", "0x..."]
}
```

## Filtering Examples

### By Proposal Only
Get all trades for a specific proposal across all users:

```javascript
// Using fetcher directly
const raw = await dataLayer.fetch('trades.proposal', {
    proposalId: '0x9590dAF4d5cd4009c3F9767C5E7668175cFd37CF',
    limit: 100
});

// Using cartridge for formatted output
for await (const step of dataLayer.execute('trades.formatted', {
    proposalId: '0x9590dAF4d5cd4009c3F9767C5E7668175cFd37CF',
    limit: 100
})) {
    if (step.status === 'success') {
        console.log(`Found ${step.data.count} trades for proposal`);
    }
}
```

### By User Only
Get all trades for a specific user across all proposals:

```javascript
// Using fetcher directly
const raw = await dataLayer.fetch('trades.user', {
    userAddress: '0xea820f6fea20a06af94b291c393c68956199cbe9',
    limit: 50
});

// Using cartridge for formatted output
for await (const step of dataLayer.execute('trades.formatted', {
    userAddress: '0xea820f6fea20a06af94b291c393c68956199cbe9',
    limit: 50
})) {
    if (step.status === 'success') {
        console.log(`User has made ${step.data.count} trades`);
    }
}
```

### By Both User and Proposal
Get trades for a specific user on a specific proposal:

```javascript
// Using fetcher directly
const raw = await dataLayer.fetch('trades.history', {
    userAddress: '0xea820f6fea20a06af94b291c393c68956199cbe9',
    proposalId: '0x9590dAF4d5cd4009c3F9767C5E7668175cFd37CF',
    limit: 20
});

// Using cartridge for formatted output
for await (const step of dataLayer.execute('trades.formatted', {
    userAddress: '0xea820f6fea20a06af94b291c393c68956199cbe9',
    proposalId: '0x9590dAF4d5cd4009c3F9767C5E7668175cFd37CF',
    limit: 20
})) {
    if (step.status === 'success') {
        console.log(`User made ${step.data.count} trades on this proposal`);
    }
}
```

### No Filters (All Trades)
Get recent trades across all users and proposals:

```javascript
// Using fetcher directly
const raw = await dataLayer.fetch('trades.recent', {
    limit: 20
});

// Using cartridge for formatted output
for await (const step of dataLayer.execute('trades.formatted', {
    limit: 20
})) {
    if (step.status === 'success') {
        console.log(`Most recent ${step.data.count} trades across platform`);
    }
}
```

## Token Metadata Enrichment

The TradeHistoryFetcher automatically enriches trade data with ERC20 token metadata:

- **Symbol**: Token trading symbol (e.g., "WXDAI", "YES_PROP")
- **Name**: Full token name (e.g., "Wrapped XDAI")
- **Decimals**: Token decimal precision

Token metadata is cached for 1 hour to minimize RPC calls. The fetcher uses batch operations when fetching multiple tokens for efficiency.

## Outcome Detection

Both components automatically detect trade outcomes (YES/NO/NEUTRAL) based on token symbols:

- **YES**: Token symbols matching patterns like `YES_*`, `YES-*`, `YES *`
- **NO**: Token symbols matching patterns like `NO_*`, `NO-*`, `NO *`
- **NEUTRAL**: Tokens that don't match YES or NO patterns

The dominant outcome is determined by analyzing which outcome token was bought/sold in the trade.

## Transaction Links

The cartridge automatically generates block explorer links based on the chain:

- **Gnosis**: https://gnosisscan.io/tx/
- **Ethereum**: https://etherscan.io/tx/
- **Polygon**: https://polygonscan.com/tx/
- **Arbitrum**: https://arbiscan.io/tx/
- **Optimism**: https://optimistic.etherscan.io/tx/

Default chain is Gnosis if not specified.

## Error Handling

All operations return structured responses with error information:

```javascript
{
    status: 'error',
    reason: 'Supabase query failed: connection timeout',
    source: 'TradeHistoryFetcher'
}
```

For cartridge operations (async generators):

```javascript
for await (const step of dataLayer.execute('trades.formatted', args)) {
    if (step.status === 'error') {
        console.error('Error:', step.message);
        return;
    }
}
```

## Performance Considerations

- **Token Caching**: Token metadata is cached for 1 hour to reduce RPC calls
- **Batch Operations**: Multiple token lookups use batch operations
- **Query Limits**: Default limits prevent excessive data transfer
- **Indexing**: Queries are optimized for Supabase indexes on `user_address` and `proposal_id`

## Complete Example

See [test-trade-history-cartridge.mjs](../test-trade-history-cartridge.mjs) for a complete working example demonstrating all operations.
