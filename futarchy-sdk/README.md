# Modular DataLayer POC - Pluggable Fetcher Architecture

**Truly extensible DataLayer with plugin/cartridge system** - The DataLayer is completely decoupled from any specific data source and supports registering multiple fetchers for different operations.

## 🏗️ Architecture Overview

### Core Principles
- **🔌 Pluggable**: DataLayer is just a registry/router 
- **🎯 Operation-based**: Each fetcher declares what operations it supports
- **🔀 Flexible**: Mix and match different data sources
- **📦 Modular**: Add new fetchers without changing core code

### Simple Interface, Powerful Flexibility
```javascript
// 1. Create empty DataLayer
const dataLayer = new DataLayer();

// 2. Register fetchers (cartridges) for different operations
dataLayer.registerFetcher(new SupabasePoolFetcher(supabaseClient));
dataLayer.registerFetcher(new MockFetcher());
dataLayer.registerFetcher(new Web3Fetcher(provider));
dataLayer.registerFetcher(new CacheFetcher());

// 3. Use the same interface - DataLayer routes to appropriate fetcher
const result = await dataLayer.fetch('pools.candle', { id: '0x...', limit: 10 });
```

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd supabase-poc
npm install
```

### 2. Configure Environment (Optional for Supabase)
```bash
# Copy the environment template
cp env.example .env

# Edit .env with your Supabase credentials
# Get them from: https://app.supabase.com > Your Project > Settings > API
```

### 3. Test the Modular System
```bash
npm test
```

### 4. Browser demo: fetch hero from Supabase market_event

1) Start a static server or use Vite:
```bash
npm run dev
```
This opens `futarchy-importmap.html`.

2) Paste your Supabase URL and anon key, enter a `market_event.id` (proposal address) and click "Load Hero" to render `display_title_0`, `display_title_1`, `trackProgressLink`, and `questionLink` directly from Supabase.

### 5. React usage: fetch hero for a proposal

Below is a minimal example showing how to use the modules in a React app to fetch hero details from a `market_event` by `id` (proposal address).

#### a) Install dependency

```bash
npm i @supabase/supabase-js
```

#### b) Create a DataLayer instance and register the Supabase fetcher

```ts
// src/lib/dataLayer.ts
import { DataLayer } from '../../DataLayer.js';
import { createSupabasePoolFetcher } from '../../fetchers/SupabasePoolFetcher.js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

const dataLayer = new DataLayer();
dataLayer.registerFetcher(createSupabasePoolFetcher(SUPABASE_URL, SUPABASE_ANON_KEY));

export { dataLayer };
```

#### c) Hook to get the hero

```ts
// src/hooks/useMarketEventHero.ts
import { useEffect, useState } from 'react';
import { dataLayer } from '../lib/dataLayer';

export type Hero = {
  id: string;
  endDate?: string;
  displayTitle0?: string;
  displayTitle1?: string;
  trackProgressLink?: string | null;
  questionLink?: string | null;
  chainId?: number;
  tokens?: {
    company: { base?: string|null; yes?: string|null; no?: string|null };
    currency: { base?: string|null; yes?: string|null; no?: string|null };
  };
};

export function useMarketEventHero(id?: string) {
  const [data, setData] = useState<Hero | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    dataLayer
      .fetch('markets.event.hero', { id })
      .then((res: any) => {
        if (!active) return;
        if (res.status === 'success') setData(res.data as Hero);
        else setError(res.reason || 'Failed to fetch');
      })
      .catch((e: any) => setError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id]);

  return { data, error, loading };
}
```

#### d) Component example

```tsx
// src/components/ProposalHero.tsx
import React from 'react';
import { useMarketEventHero } from '../hooks/useMarketEventHero';

function gnosisscan(addr?: string|null, chainId = 100) {
  if (!addr) return null;
  const base = chainId === 100 ? 'https://gnosisscan.io' : 'https://etherscan.io';
  const url = `${base}/address/${addr}`;
  return (
    <a href={url} target="_blank" rel="noreferrer">
      {addr.slice(0, 6)}...{addr.slice(-4)}
    </a>
  );
}

export function ProposalHero({ id }: { id: string }) {
  const { data: hero, loading, error } = useMarketEventHero(id);
  if (loading) return <div>Loading…</div>;
  if (error) return <div>Error: {error}</div>;
  if (!hero) return null;

  return (
    <div>
      <div>{hero.displayTitle0}</div>
      <div style={{ color: '#6b21a8' }}>{hero.displayTitle1}</div>
      {hero.endDate && <div>End: {new Date(hero.endDate).toLocaleString()}</div>}
      {hero.trackProgressLink && (
        <div>
          <a href={hero.trackProgressLink} target="_blank" rel="noreferrer">
            Track progress
          </a>
        </div>
      )}
      {hero.questionLink && (
        <div>
          <a href={hero.questionLink} target="_blank" rel="noreferrer">
            Reality question
          </a>
        </div>
      )}

      <div style={{ marginTop: 8 }}>
        <div>Company tokens:</div>
        <div>Base: {gnosisscan(hero.tokens?.company.base, hero.chainId)}</div>
        <div>Yes: {gnosisscan(hero.tokens?.company.yes, hero.chainId)}</div>
        <div>No: {gnosisscan(hero.tokens?.company.no, hero.chainId)}</div>
      </div>
      <div style={{ marginTop: 8 }}>
        <div>Currency tokens:</div>
        <div>Base: {gnosisscan(hero.tokens?.currency.base, hero.chainId)}</div>
        <div>Yes: {gnosisscan(hero.tokens?.currency.yes, hero.chainId)}</div>
        <div>No: {gnosisscan(hero.tokens?.currency.no, hero.chainId)}</div>
      </div>
    </div>
  );
}
```

Usage:

```tsx
// Somewhere in your app
<ProposalHero id="0xA94aB35282118f38b0b4FF89dDA7A5c04aD49371" />
```

### 3. CLI Usage - Real Supabase Data
```bash
# Basic usage
npm run getCandlesFromPool -- --pool 0xF336F812Db1ad142F22A9A4dd43D40e64B478361

# With custom interval and limit
npm run getCandlesFromPool -- --pool 0xF336F812Db1ad142F22A9A4dd43D40e64B478361 --interval 60000 --limit 5
```

### 4. CLI Usage - Mock Data (for testing)
```bash
# Use mock fetcher instead of Supabase
npm run getCandlesFromPool -- --pool 0x123... --mock

# Mock data shows additional operations (user.profile, market.stats)
npm run getCandlesFromPool -- --pool 0x123... --mock --limit 3
```

## 📋 Available Commands

| Command | Description |
|---------|-------------|
| `npm test` | Run comprehensive tests showing all fetcher combinations |
| `npm run getCandlesFromPool` | CLI tool with real Supabase or mock data |

## 🔧 Modular Architecture

### 1. Core DataLayer (Completely Agnostic)
```javascript
class DataLayer {
    registerFetcher(fetcher)     // Register a fetcher for its operations
    fetch(dataPath, args)        // Route to appropriate fetcher
    getAvailableOperations()     // List all registered operations
    supports(dataPath)           // Check if operation is supported
}
```

### 2. Base Fetcher Interface
```javascript
class BaseFetcher {
    supportedOperations          // Array of operations this fetcher handles
    operations                   // Map of operation -> handler function
    registerOperation(path, fn)  // Helper to register an operation
    fetch(dataPath, args)        // Handle the actual fetch
}
```

### 3. Available Fetchers (Pluggable Modules)

#### SupabasePoolFetcher
- **Operations**: `pools.candle`, `pools.info`, `pools.volume`
- **Purpose**: Real Supabase database integration
- **Usage**: Production pool data fetching

#### MockFetcher  
- **Operations**: `pools.candle`, `pools.info`, `user.profile`, `market.stats`
- **Purpose**: Testing and development
- **Usage**: Generates realistic mock data with simulated delays

## 🎯 Usage Examples

### Basic Setup
```javascript
import { DataLayer } from './DataLayer.js';
import { createSupabasePoolFetcher } from './fetchers/SupabasePoolFetcher.js';

// Create DataLayer and register Supabase fetcher
const dataLayer = new DataLayer();
const supabaseFetcher = createSupabasePoolFetcher(supabaseUrl, supabaseKey);
dataLayer.registerFetcher(supabaseFetcher);

// Use it
const candles = await dataLayer.fetch('pools.candle', {
    id: '0xF336F812Db1ad142F22A9A4dd43D40e64B478361',
    limit: 10
});
```

### Multiple Fetchers (Mix and Match)
```javascript
import { MockFetcher } from './fetchers/MockFetcher.js';

const dataLayer = new DataLayer();

// Register multiple fetchers
dataLayer.registerFetcher(supabaseFetcher);  // pools.candle, pools.info, pools.volume
dataLayer.registerFetcher(mockFetcher);      // user.profile, market.stats
                                             // Note: overwrites pools.candle, pools.info

// Now you have:
// - pools.candle -> MockFetcher (last registered wins)
// - pools.volume -> SupabasePoolFetcher (only available there)
// - user.profile -> MockFetcher (only available there)
```

### Testing with Mock Data
```javascript
import { MockFetcher } from './fetchers/MockFetcher.js';

const dataLayer = new DataLayer();
dataLayer.registerFetcher(new MockFetcher());

// Same interface, mock data
const mockCandles = await dataLayer.fetch('pools.candle', {
    id: '0x123...',
    limit: 5
});
// Returns realistic mock candle data with simulated network delay
```

## 🔌 Adding New Fetchers

### Example: CacheFetcher
```javascript
import { BaseFetcher } from '../DataLayer.js';

class CacheFetcher extends BaseFetcher {
    constructor(backingFetcher, ttlSeconds = 300) {
        super();
        this.backingFetcher = backingFetcher;
        this.cache = new Map();
        
        // Register the same operations as backing fetcher
        this.supportedOperations = [...backingFetcher.supportedOperations];
        backingFetcher.supportedOperations.forEach(op => {
            this.operations[op] = this.cachedFetch.bind(this, op);
        });
    }
    
    async cachedFetch(operation, args) {
        const cacheKey = `${operation}-${JSON.stringify(args)}`;
        
        if (this.cache.has(cacheKey)) {
            return { ...this.cache.get(cacheKey), fromCache: true };
        }
        
        const result = await this.backingFetcher.fetch(operation, args);
        this.cache.set(cacheKey, result);
        return result;
    }
}

// Usage
const cacheFetcher = new CacheFetcher(supabaseFetcher, 30);
dataLayer.registerFetcher(cacheFetcher);
```

### Example: Web3Fetcher
```javascript
class Web3Fetcher extends BaseFetcher {
    constructor(web3Provider) {
        super();
        this.provider = web3Provider;
        
        this.registerOperation('pools.reserves', this.getPoolReserves.bind(this));
        this.registerOperation('user.balance', this.getUserBalance.bind(this));
    }
    
    async getPoolReserves(args) {
        // Web3 contract calls
        return { status: 'success', data: reserves, source: 'Web3Fetcher' };
    }
}
```

## 🧪 Testing Results

The `npm test` command demonstrates:

1. **Empty DataLayer** - Properly rejects unknown operations
2. **MockFetcher** - Generates realistic mock data with delay
3. **SupabaseFetcher** - Connects to real Supabase 
4. **Multiple Fetchers** - Shows override behavior and operation routing
5. **Error Handling** - Graceful failure with helpful messages

## 📊 CLI Examples

### Real Supabase Data
```bash
# Get last 10 candles from YES pool
npm run getCandlesFromPool -- 0xF336F812Db1ad142F22A9A4dd43D40e64B478361

# Get last 5 candles with 1-minute interval  
npm run getCandlesFromPool -- 0xF336F812Db1ad142F22A9A4dd43D40e64B478361 --interval 60000 --limit 5
```

### Mock Data (Testing)
```bash
# Use mock fetcher
npm run getCandlesFromPool -- 0x123... --mock

# Shows bonus mock operations (user.profile, market.stats)
npm run getCandlesFromPool -- 0x123... --mock --limit 3
```

## 📁 File Structure

```
supabase-poc/
├── package.json              # Dependencies and scripts
├── DataLayer.js             # Core DataLayer (agnostic)
├── fetchers/                # Pluggable fetcher modules
│   ├── SupabasePoolFetcher.js # Real Supabase integration
│   └── MockFetcher.js        # Mock data for testing
├── getCandlesFromPool.js    # CLI script with modular setup
├── config.js                # Configuration with env support
├── env.example              # Environment variables template
├── test.js                  # Comprehensive tests
└── README.md                # This file
```

## 🔧 Configuration

### Environment Variables Setup
Create a `.env` file from the template:
```bash
cp env.example .env
```

Then edit `.env` with your actual Supabase credentials:
```bash
# Required for real Supabase integration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your_actual_anon_key

# Optional: Override default pool addresses
DEFAULT_YES_POOL=0xF336F812Db1ad142F22A9A4dd43D40e64B478361
DEFAULT_NO_POOL=0xfbf1BE5CE2f9056dAaB1C368EC241ad7Be3507A8
DEFAULT_BASE_POOL=0x88A8ABD96A2e7ceF3B15cB42c11BE862312BA5Da
```

### Getting Supabase Credentials
1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Create/select your project
3. Navigate to **Settings > API**
4. Copy the **Project URL** and **anon public** key

### No Setup Required for Testing
You can use mock data without any Supabase configuration:
```bash
npm run getCandlesFromPool -- --pool 0x123... --mock
```

### Database Schema (For Supabase Users)
Your Supabase database should have this table structure:

**Table: `pool_candles`**
```sql
CREATE TABLE pool_candles (
    id SERIAL PRIMARY KEY,
    timestamp BIGINT NOT NULL,
    price DECIMAL NOT NULL,
    volume DECIMAL,
    address TEXT NOT NULL,
    interval TEXT NOT NULL
);

-- Add indexes for better performance
CREATE INDEX idx_pool_candles_address_interval ON pool_candles(address, interval);
CREATE INDEX idx_pool_candles_timestamp ON pool_candles(timestamp);
```

## 🎯 Key Benefits

### 🔌 Truly Pluggable
- **Zero coupling** between DataLayer and data sources
- **Easy addition** of new fetchers without touching core code
- **Runtime configuration** - register different fetchers based on environment

### 🔀 Flexible Operation Routing
- **Operation-based** - each fetcher declares what it can do
- **Override behavior** - last registered fetcher wins for conflicts
- **Mix and match** - combine Supabase, Web3, Cache, Mock, etc.

### 🧪 Perfect for Testing
- **Mock fetchers** for development
- **Same interface** in tests and production
- **Realistic mock data** with simulated delays

### 📦 Clean Architecture
- **SOLID principles** - each fetcher has single responsibility
- **Dependency injection** - fetchers injected into DataLayer
- **Interface segregation** - fetchers only implement what they support

## 🚀 Future Extensions

Easy to add:
- **CacheFetcher** - TTL-based caching layer
- **Web3Fetcher** - Direct blockchain reads
- **AggregateFetcher** - Fallback chain (cache -> supabase -> web3)
- **HttpFetcher** - External API integration
- **FileFetcher** - Local file storage
- **RedisFecher** - Redis integration

The architecture supports unlimited extensibility while maintaining a simple, consistent interface! 🎉 