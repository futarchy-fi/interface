# 🏛️ Futarchy SDK - Setup Guide

## 📖 Project Overview

The **Futarchy SDK** is a modular, pluggable toolkit for building prediction market (futarchy) applications. It provides a clean separation between **data fetching** and **transaction execution**, allowing developers to build flexible, testable, and maintainable futarchy applications.

### 🎯 Core Concept: Futarchy
Futarchy is a governance mechanism where decisions are made based on prediction market outcomes. Instead of traditional voting, token holders bet on the future success of different proposals, and the market's wisdom guides governance decisions.

## 🏗️ Architecture Overview

The SDK follows a **unified DataLayer architecture** where the DataLayer contains and orchestrates both fetchers and executors:

### **Central DataLayer** (Unified Operations Router)
- **Purpose**: Single point of control for ALL operations (read + write)
- **Contains Fetchers**: For read operations like pool data, market stats, user balances
- **Contains Executors**: For write operations like approvals, swaps, governance votes
- **Operation-based**: Routes operations to appropriate handlers based on operation path
- **Examples**: `pools.candle`, `web3.approve`, `user.profile`, `web3.swap`

```
┌─────────────────────────────────────────────────────────────┐
│                        DataLayer                            │
│                  (Unified Operations Router)                │
│                                                             │
│  ┌─────────────────────────┐    ┌─────────────────────────┐ │
│  │       FETCHERS          │    │       EXECUTORS         │ │
│  │    (Read Operations)    │    │    (Write Operations)   │ │
│  │                         │    │                         │ │
│  │ ┌─────────────────────┐ │    │ ┌─────────────────────┐ │ │
│  │ │  Supabase Fetcher   │ │    │ │   Viem Executor     │ │ │
│  │ │  pools.candle       │ │    │ │   web3.approve      │ │ │
│  │ │  pools.info         │ │    │ │   web3.swap         │ │ │
│  │ └─────────────────────┘ │    │ └─────────────────────┘ │ │
│  │ ┌─────────────────────┐ │    │ ┌─────────────────────┐ │ │
│  │ │    Mock Fetcher     │ │    │ │   Base Executor     │ │ │
│  │ │  user.profile       │ │    │ │   web3.connect      │ │ │
│  │ │  market.stats       │ │    │ │   web3.transfer     │ │ │
│  │ └─────────────────────┘ │    │ └─────────────────────┘ │ │
│  │ ┌─────────────────────┐ │    │                         │ │
│  │ │   Web3 Fetcher      │ │    │                         │ │
│  │ │  balances.token     │ │    │                         │ │
│  │ └─────────────────────┘ │    │                         │ │
│  └─────────────────────────┘    └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              ↓
              ┌─────────────────────────────────────────┐
              │          Futarchy dApp                  │
              │   (Prediction Markets & Governance)     │
              └─────────────────────────────────────────┘
```

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Choose Your Setup Path

#### Option A: Full Setup (Supabase + Web3)
```bash
# Copy environment template
cp env.example .env

# Edit .env with your Supabase credentials
# Get them from: https://app.supabase.com > Your Project > Settings > API
```

#### Option B: Development Setup (Mock Data Only)
No setup required! The SDK includes comprehensive mock data for development.

### 3. Test the System
```bash
# Test all components with mock data
npm test

# Test CLI with mock data (no setup required)
npm run getCandlesFromPool -- --pool 0x123... --mock

# Test with real Supabase data (requires .env setup)
npm run getCandlesFromPool -- --pool 0xF336F812Db1ad142F22A9A4dd43D40e64B478361
```

### 4. Try the Web Interfaces
```bash
# Basic SDAI approval interface
# Open index.html in browser

# Complete futarchy operations interface  
# Open futarchy.html in browser

# Or serve them:
python -m http.server 8000
# OR
npx serve .
```

## 📁 Project Structure

```
futarchy-sdk/
├── 📋 Core System
│   ├── DataLayer.js              # Main data orchestration layer
│   ├── config.js                 # Configuration with env support
│   └── package.json              # Dependencies & scripts
│
├── 🔌 Pluggable Fetchers (Data Sources)
│   ├── fetchers/
│   │   ├── SupabasePoolFetcher.js # Real database integration
│   │   └── MockFetcher.js         # Development/testing data
│
├── ⚡ Modular Executors (Blockchain)
│   ├── executors/
│   │   ├── BaseExecutor.js        # Abstract executor interface
│   │   ├── ViemExecutor.js        # Viem-based Web3 executor
│   │   ├── FutarchyCartridge.js   # Futarchy operations cartridge
│   │   ├── CoWSwapCartridge.js    # CoW Protocol swap cartridge
│   │   └── SwaprAlgebraCartridge.js # Swapr V3 Algebra swap cartridge
│
├── 🎯 Examples & Demos
│   ├── examples/
│   │   ├── README.md              # Example documentation
│   │   └── sdai-approval.js       # Complete SDAI approval flow
│   ├── index.html                 # Beautiful Web3 interface
│   └── getCandlesFromPool.js      # CLI data fetching tool
│
├── 🔧 Utilities & Testing
│   ├── test.js                    # Comprehensive test suite
│   ├── env.example                # Environment template
│   └── basefetch.js / baseexec.js # Basic usage examples
```

## 🛠️ Environment Configuration

### Supabase Setup (Optional)
Create `.env` from template:
```bash
cp env.example .env
```

Required for production data:
```bash
# Your Supabase project credentials
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your_actual_anon_key

# Optional: Override default pool addresses
DEFAULT_YES_POOL=0xF336F812Db1ad142F22A9A4dd43D40e64B478361
DEFAULT_NO_POOL=0xfbf1BE5CE2f9056dAaB1C368EC241ad7Be3507A8
DEFAULT_BASE_POOL=0x88A8ABD96A2e7ceF3B15cB42c11BE862312BA5Da
```

### Database Schema (For Supabase Users)
Your Supabase database should have:

```sql
-- Pool candles data
CREATE TABLE pool_candles (
    id SERIAL PRIMARY KEY,
    timestamp BIGINT NOT NULL,
    price DECIMAL NOT NULL,
    volume DECIMAL,
    address TEXT NOT NULL,
    interval TEXT NOT NULL
);

-- Indexes for performance
CREATE INDEX idx_pool_candles_address_interval ON pool_candles(address, interval);
CREATE INDEX idx_pool_candles_timestamp ON pool_candles(timestamp);
```

## 🎯 Usage Examples

### 1. Unified DataLayer (Both Read & Write Operations)

```javascript
import { DataLayer } from './DataLayer.js';
import { createSupabasePoolFetcher } from './fetchers/SupabasePoolFetcher.js';
import { MockFetcher } from './fetchers/MockFetcher.js';
import { createViemExecutor } from './executors/ViemExecutor.js';

// Create DataLayer and register both fetchers and executors
const dataLayer = new DataLayer();

// Register fetchers for read operations
dataLayer.registerFetcher(createSupabasePoolFetcher(supabaseUrl, supabaseKey));
dataLayer.registerFetcher(new MockFetcher());

// Register executors for write operations  
dataLayer.registerExecutor(createViemExecutor({ rpcUrl: 'https://rpc.gnosischain.com' }));

// Now use unified interface for BOTH read and write operations:

// READ: Fetch pool candles (routes to appropriate fetcher)
const candles = await dataLayer.fetch('pools.candle', {
    id: '0xF336F812Db1ad142F22A9A4dd43D40e64B478361',
    limit: 10,
    interval: '3600000'
});

// WRITE: Execute blockchain transaction (routes to appropriate executor)
for await (const status of dataLayer.execute('web3.approve', {
    tokenAddress: '0xaf204776c7245bF4147c2612BF6e5972Ee483701',
    spenderAddress: '0x7495a583ba85875d59407781b4958ED6e0E1228f',
    amount: parseEther('1000')
})) {
    console.log(`${status.status}: ${status.message}`);
    if (status.data?.transactionHash) {
        console.log(`TX: ${status.data.transactionHash}`);
    }
}

// Check all available operations (both read and write)
console.log(dataLayer.getAvailableOperations());
// ['pools.candle', 'pools.info', 'user.profile', 'web3.approve', 'web3.connect', 'web3.swap']
```

### 2. Simplified Usage Pattern

```javascript
// One DataLayer handles everything!
const dataLayer = new DataLayer()
    .registerFetcher(supabaseFetcher)    // Read operations
    .registerFetcher(mockFetcher)        // Additional read operations  
    .registerExecutor(viemExecutor);     // Write operations

// Read data
const poolData = await dataLayer.fetch('pools.info', { id: poolAddress });

// Write transaction  
const result = await dataLayer.execute('web3.approve', approvalParams);
```

### 3. Futarchy Cartridge System (Advanced Operations)

```javascript
import { createViemExecutor } from './executors/ViemExecutor.js';
import { FutarchyCartridge } from './executors/FutarchyCartridge.js';

// Create executor and register futarchy cartridge
const executor = createViemExecutor({ rpcUrl: 'https://rpc.gnosischain.com' });
const futarchyCartridge = new FutarchyCartridge('0x7495a583ba85875d59407781b4958ED6e0E1228f');
executor.registerCartridge(futarchyCartridge);

// Now you have access to all futarchy operations:

// Connect wallet
for await (const status of executor.execute('web3.connect')) {
    if (status.status === 'success') account = status.data.account;
}

// Check if collateral is approved for futarchy router
for await (const status of executor.execute('futarchy.checkApproval', {
    collateralToken: '0xaf204776c7245bF4147c2612BF6e5972Ee483701'
})) {
    if (status.status === 'success') {
        console.log('Approved:', status.data.isApproved);
        console.log('Allowance:', status.data.allowanceFormatted);
    }
}

// Approve collateral for futarchy router
for await (const status of executor.execute('futarchy.approveCollateral', {
    collateralToken: '0xaf204776c7245bF4147c2612BF6e5972Ee483701',
    amount: 'max' // or specific amount like '1000'
})) {
    console.log(status.status + ':', status.message);
}

// Split collateral into YES/NO outcome tokens
for await (const status of executor.execute('futarchy.splitPosition', {
    proposal: '0x1234567890123456789012345678901234567890',
    collateralToken: '0xaf204776c7245bF4147c2612BF6e5972Ee483701',
    amount: '100'
})) {
    console.log(status.status + ':', status.message);
    if (status.data?.transactionHash) console.log('TX:', status.data.transactionHash);
}

// Merge YES/NO tokens back to collateral
for await (const status of executor.execute('futarchy.mergePositions', {
    proposal: '0x1234567890123456789012345678901234567890',
    collateralToken: '0xaf204776c7245bF4147c2612BF6e5972Ee483701', 
    amount: '100'
})) {
    console.log(status.status + ':', status.message);
}

// Redeem winning positions (after proposal resolution)
for await (const status of executor.execute('futarchy.redeemPositions', {
    proposal: '0x1234567890123456789012345678901234567890',
    collateralToken: '0xaf204776c7245bF4147c2612BF6e5972Ee483701',
    amount: '100'
})) {
    console.log(status.status + ':', status.message);
}

// Get winning outcomes for a condition
for await (const status of executor.execute('futarchy.getWinningOutcomes', {
    conditionId: '0xabcdef...'
})) {
    if (status.status === 'success') {
        console.log('Winning outcomes:', status.data.outcomes);
        console.log('Winning indexes:', status.data.winningIndexes);
    }
}
```

### 4. Complete Application Example

```javascript
import { CompleteFutarchyDemo } from './examples/futarchy-demo.js';

const demo = new CompleteFutarchyDemo();

// Run complete futarchy workflow
const result = await demo.runCompleteDemo({
    proposal: '0x1234567890123456789012345678901234567890',
    collateralToken: '0xaf204776c7245bF4147c2612BF6e5972Ee483701',
    amount: '100'
});

console.log('Futarchy operations completed:', result);
```

## 🔄 Cartridge System Architecture

The **ViemExecutor** uses a **cartridge system** where specialized modules handle different types of operations. This provides clean separation of concerns and makes the system highly extensible.

### 🏗️ How Cartridges Work

```
┌─────────────────────────────────────────────────────────────┐
│                       DataLayer                             │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                  ViemExecutor                           │ │
│  │                                                         │ │
│  │  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────┐ │ │
│  │  │ FutarchyCartridge│ │ CoWSwapCartridge│ │SwaprCartridge│ │ │
│  │  │                 │ │                 │ │             │ │ │
│  │  │ futarchy.*      │ │ cowswap.*       │ │ swapr.*     │ │ │
│  │  │ - splitPosition │ │ - swap          │ │ - swap      │ │ │
│  │  │ - mergePositions│ │ - checkApproval │ │ - approve   │ │ │
│  │  │ - checkApproval │ │ - approve       │ │ - complete  │ │ │
│  │  │ - complete*     │ │ - completeSwap  │ │             │ │ │
│  │  └─────────────────┘ └─────────────────┘ └─────────────┘ │ │
│  │                                                         │ │
│  │  ┌─────────────────────────────────────────────────────┐ │ │
│  │  │             Base Web3 Operations                    │ │ │
│  │  │  web3.connect, web3.approve, web3.transfer, etc.   │ │ │
│  │  └─────────────────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 🎯 Available Cartridges

#### **1. FutarchyCartridge** - Prediction Market Operations
```javascript
// Operations: futarchy.*
futarchy.splitPosition      // Split collateral → YES/NO tokens
futarchy.mergePositions     // Merge YES/NO → collateral  
futarchy.redeemPositions    // Redeem winning positions
futarchy.checkApproval      // Check approval for futarchy router
futarchy.approveCollateral  // Approve tokens for futarchy router
futarchy.completeSplit      // Auto: approve + split
futarchy.completeMerge      // Auto: approve YES + approve NO + merge
```

#### **2. CoWSwapCartridge** - MEV-Protected Swaps
```javascript
// Operations: cowswap.*
cowswap.swap               // Create CoW Protocol order
cowswap.checkApproval      // Check approval for CoW Vault Relayer
cowswap.approve            // Approve tokens for CoW Protocol
cowswap.completeSwap       // Auto: approve + swap
```

#### **3. SwaprAlgebraCartridge** - Direct V3 Swaps
```javascript
// Operations: swapr.*
swapr.swap                 // Execute Swapr V3 Algebra swap
swapr.checkApproval        // Check approval for Swapr V3 Router
swapr.approve              // Approve tokens for Swapr
swapr.completeSwap         // Auto: approve + swap
```

### 🚀 Complete Swap Demo Usage

```javascript
import { DataLayer } from './DataLayer.js';
import { createViemExecutor } from './executors/ViemExecutor.js';
import { FutarchyCartridge } from './executors/FutarchyCartridge.js';
import { CoWSwapCartridge } from './executors/CoWSwapCartridge.js';
import { SwaprAlgebraCartridge } from './executors/SwaprAlgebraCartridge.js';

// 1. Setup DataLayer with all cartridges
const dataLayer = new DataLayer();
const executor = createViemExecutor({ rpcUrl: 'https://rpc.gnosischain.com' });

// Register all cartridges
executor.registerCartridge(new FutarchyCartridge('0x7495a583ba85875d59407781b4958ED6e0E1228f'));
executor.registerCartridge(new CoWSwapCartridge());
executor.registerCartridge(new SwaprAlgebraCartridge());

dataLayer.registerExecutor(executor);

// 2. Connect wallet
for await (const status of dataLayer.execute('web3.connect')) {
    if (status.status === 'success') {
        console.log('Connected:', status.data.account);
        break;
    }
}

// 3. CoW Protocol Swap (MEV Protection)
for await (const status of dataLayer.execute('cowswap.completeSwap', {
    sellToken: '0xaf204776c7245bF4147c2612BF6e5972Ee483701', // sDAI
    buyToken: '0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d',  // wxDAI
    amount: '1' // 1 sDAI
})) {
    console.log(`${status.status}: ${status.message}`);
    if (status.status === 'success') {
        console.log('CoW Order ID:', status.data.orderId);
        console.log('Track order:', status.data.cowExplorerLink);
        break;
    }
}

// 4. Swapr V3 Algebra Swap (Direct Execution)
for await (const status of dataLayer.execute('swapr.completeSwap', {
    tokenIn: '0xaf204776c7245bF4147c2612BF6e5972Ee483701',  // sDAI
    tokenOut: '0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d', // wxDAI
    amount: '1', // 1 sDAI
    slippageBps: 0 // No slippage protection
})) {
    console.log(`${status.status}: ${status.message}`);
    if (status.status === 'success') {
        console.log('Swap TX:', status.data.transactionHash);
        console.log('Gas used:', status.data.gasUsed);
        break;
    }
}

// 5. Futarchy Operations (Prediction Markets)
for await (const status of dataLayer.execute('futarchy.completeSplit', {
    proposal: '0xDA36a35CA4Fe6214C37a452159C0C9EAd45D5919',
    collateralToken: '0xaf204776c7245bF4147c2612BF6e5972Ee483701',
    amount: '100'
})) {
    console.log(`${status.status}: ${status.message}`);
    if (status.status === 'success') {
        console.log('Split TX:', status.data.transactionHash);
        break;
    }
}
```

### 🎯 Cartridge Operation Flow

Each cartridge follows the **yield-step pattern** for real-time updates:

```javascript
async* completeSwap(args, viemClients) {
    // Step 1: Check approval
    yield { status: 'pending', message: 'Checking approval...', step: 'check_approval' };
    
    // Step 2: Approve if needed  
    if (!approved) {
        yield { status: 'pending', message: 'Approving...', step: 'approving' };
        // ... approval logic
        yield { status: 'pending', message: 'Approved!', step: 'approved' };
    }
    
    // Step 3: Execute main operation
    yield { status: 'pending', message: 'Executing swap...', step: 'swapping' };
    // ... swap logic
    
    // Step 4: Success
    yield { 
        status: 'success', 
        message: 'Swap completed!', 
        step: 'complete',
        data: { transactionHash, gasUsed, ... }
    };
}
```

### 🔧 Contract Addresses by Cartridge

#### **FutarchyCartridge Targets:**
- **Futarchy Router**: `0x7495a583ba85875d59407781b4958ED6e0E1228f`

#### **CoWSwapCartridge Targets:**
- **CoW Vault Relayer**: `0xC92E8bdf79f0507f65a392b0ab4667716BFE0110`
- **CoW Settlement**: `0x9008D19f58AAbD9eD0D60971565AA8510560ab41`

#### **SwaprAlgebraCartridge Targets:**
- **Swapr V3 Router**: `0xffb643e73f280b97809a8b41f7232ab401a04ee1`

### 🎨 Web Interface Integration

The cartridges are fully integrated into **futarchy.html**:

```html
<!-- CoW Protocol Section -->
<div class="cow-swap-section">
    <button onclick="cowCompleteSwap()">⚡ Complete CoW Swap</button>
    <!-- Handles: approve → swap → track order -->
</div>

<!-- Swapr V3 Section -->  
<div class="swapr-section">
    <button onclick="swaprCompleteSwap()">⚡ Complete Swapr Swap</button>
    <!-- Handles: approve → swap → get receipt -->
</div>

<!-- Futarchy Section -->
<div class="futarchy-section">
    <button onclick="completeSplit()">⚡ Complete Split</button>
    <!-- Handles: approve → split position -->
</div>
```

### 🔌 Adding Custom Cartridges

```javascript
class YourCustomCartridge {
    constructor(customConfig) {
        this.name = 'YourCustomCartridge';
        this.operations = {
            'custom.operation': this.customOperation.bind(this),
            'custom.completeFlow': this.completeFlow.bind(this)
        };
    }
    
    supports(operation) {
        return operation in this.operations;
    }
    
    async* execute(operation, args, viemClients) {
        yield* this.operations[operation](args, viemClients);
    }
    
    async* customOperation(args, { publicClient, walletClient, account }) {
        yield { status: 'pending', message: 'Starting custom operation...' };
        
        // Your custom logic here
        const result = await this.performCustomAction(args);
        
        yield { 
            status: 'success', 
            message: 'Custom operation completed!',
            data: result 
        };
    }
}

// Register with ViemExecutor
executor.registerCartridge(new YourCustomCartridge(config));
```

## 🧪 Available Commands

| Command | Description | Setup Required |
|---------|-------------|----------------|
| `npm test` | Comprehensive testing of all components | None (uses mocks) |
| `npm run getCandlesFromPool` | CLI data fetcher with real Supabase | `.env` setup |
| `npm run getCandlesFromPool -- --mock` | CLI with mock data | None |
| `npm run basefetch` | Basic data fetching example | `.env` setup |
| `npm run baseexec` | Basic executor example | None |
| `npm run futarchy` | Complete futarchy operations demo | None |
| `npm run futarchy:complete` | Full futarchy workflow demo | None |
| `npm run futarchy:approval` | Approval-only demo | None |
| `npm run futarchy:status` | Show executor status | None |
| `npm run futarchy:list` | List all available operations | None |
| `npm run dev` | Start Vite dev server with swap cartridges | None |
| `node examples/sdai-approval.js` | Simple SDAI approval flow | None |

### CLI Examples

#### Data Fetching
```bash
# Real Supabase data
npm run getCandlesFromPool -- --pool 0xF336F812Db1ad142F22A9A4dd43D40e64B478361 --limit 5

# Mock data (no setup required)
npm run getCandlesFromPool -- --pool 0x123... --mock --limit 3
```

#### Futarchy Operations
```bash
# Complete futarchy workflow (connect, approve, split, merge)
npm run futarchy:complete

# Just approval demo
npm run futarchy:approval

# Show executor status and cartridges
npm run futarchy:status

# List all available operations
npm run futarchy:list

# Custom proposal and amount
npm run futarchy complete 0x1234567890123456789012345678901234567890 500
```

#### Web Interface with Swap Cartridges
```bash
# Start Vite dev server with all cartridges
npm run dev
# Then open: http://localhost:3000/

# Available interfaces:
# - Futarchy operations (split, merge, redeem)
# - CoW Protocol swaps (MEV protection) 
# - Swapr V3 Algebra swaps (direct execution)
# - Complete operations with auto-approval
```

#### Simple Examples
```bash
# Basic SDAI approval example
node examples/sdai-approval.js 500
```

## 🎯 Futarchy Operations

The **FutarchyCartridge** provides comprehensive prediction market operations:

### Core Operations
| Operation | Description | Use Case |
|-----------|-------------|----------|
| `futarchy.checkApproval` | Check token approval status | Verify before transactions |
| `futarchy.approveCollateral` | Approve tokens for futarchy router | Enable futarchy operations |
| `futarchy.splitPosition` | Split collateral into YES/NO tokens | Create prediction market positions |
| `futarchy.mergePositions` | Merge YES/NO tokens back to collateral | Exit prediction market positions |
| `futarchy.redeemPositions` | Redeem winning outcome tokens | Claim winnings after resolution |
| `futarchy.redeemProposal` | Redeem proposal tokens | Claim governance tokens |
| `futarchy.getWinningOutcomes` | Get winning outcomes for condition | Check resolution results |

### Prediction Market Workflow
1. **Setup**: `checkApproval` → `approveCollateral` (if needed)
2. **Participate**: `splitPosition` to create YES/NO tokens
3. **Trade**: Trade YES/NO tokens on markets (external)
4. **Exit**: `mergePositions` (before resolution) or `redeemPositions` (after resolution)
5. **Governance**: `redeemProposal` for governance participation

## 🌐 Contract Addresses (Gnosis Chain)

The SDK is pre-configured for Gnosis Chain:

### Core Tokens
- **sDAI**: `0xaf204776c7245bF4147c2612BF6e5972Ee483701`
- **wxDAI**: `0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d`

### Protocol Routers
- **Futarchy Router**: `0x7495a583ba85875d59407781b4958ED6e0E1228f`
- **CoW Vault Relayer**: `0xC92E8bdf79f0507f65a392b0ab4667716BFE0110`
- **Swapr V3 Router**: `0xffb643e73f280b97809a8b41f7232ab401a04ee1`

### Default Pool Addresses (for testing)
- **YES Pool**: `0xF336F812Db1ad142F22A9A4dd43D40e64B478361`
- **NO Pool**: `0xfbf1BE5CE2f9056dAaB1C368EC241ad7Be3507A8`
- **Base Pool**: `0x88A8ABD96A2e7ceF3B15cB42c11BE862312BA5Da`

## 🔧 Extending the SDK

### Adding New Fetchers (Read Operations)

```javascript
import { BaseFetcher } from './DataLayer.js';

class YourCustomFetcher extends BaseFetcher {
    constructor(customClient) {
        super();
        this.client = customClient;
        
        // Register supported read operations
        this.registerOperation('custom.data', this.fetchCustomData.bind(this));
        this.registerOperation('custom.stats', this.fetchCustomStats.bind(this));
    }
    
    async fetchCustomData(args) {
        // Your implementation
        return { status: 'success', data: customData };
    }
}

// Register with DataLayer
dataLayer.registerFetcher(new YourCustomFetcher(client));
```

### Adding New Executors (Write Operations)

```javascript
import { BaseExecutor } from './executors/BaseExecutor.js';

class YourCustomExecutor extends BaseExecutor {
    constructor() {
        super();
        
        // Register supported write operations
        this.registerOperation('custom.action', this.executeCustomAction.bind(this));
        this.registerOperation('custom.deploy', this.deployContract.bind(this));
    }
    
    async* executeCustomAction(args) {
        yield { status: 'pending', message: 'Starting custom action...' };
        
        // Your implementation
        const result = await this.performAction(args);
        
        yield { status: 'success', message: 'Action completed!', data: result };
    }
}

// Register with same DataLayer
dataLayer.registerExecutor(new YourCustomExecutor());
```

### Complete Extension Example

```javascript
// Create unified DataLayer with custom components
const dataLayer = new DataLayer()
    .registerFetcher(new SupabasePoolFetcher(supabaseClient))  // Standard read ops
    .registerFetcher(new YourCustomFetcher(customClient))      // Custom read ops
    .registerExecutor(new ViemExecutor(viemConfig))            // Standard write ops  
    .registerExecutor(new YourCustomExecutor());               // Custom write ops

// Now you can use both standard and custom operations:
const data = await dataLayer.fetch('custom.data', args);        // Your custom fetcher
const result = await dataLayer.execute('custom.action', args);  // Your custom executor
```

## 🎯 Key Benefits

### 🔌 **Unified Architecture**
- **Single DataLayer** orchestrates both read and write operations
- **Zero coupling** between fetchers and executors
- **Mix and match** different data sources and blockchain libraries
- **Consistent interface** for all operations

### 🚀 **Production Ready**
- **Real blockchain integration** with Viem
- **Comprehensive error handling** for both data fetching and transactions
- **Real-time transaction updates** via async generators
- **Reliable data sources** (Supabase, Web3, etc.)

### 🧪 **Developer Friendly**
- **Mock implementations** for both fetchers and executors
- **Start building immediately** without external dependencies
- **Beautiful web interface** for testing
- **Comprehensive examples** and documentation

### 📈 **Futarchy Focused**
- **Pool data structures** optimized for prediction markets
- **Governance-ready** transaction execution
- **Multi-token support** (sDAI, voting tokens, etc.)
- **Market data + blockchain actions** in one unified system

## 🔄 Development Workflow

1. **Start with Mocks**: Use `MockFetcher` and basic executor for rapid development
2. **Add Real Data**: Connect `SupabasePoolFetcher` for production pool data
3. **Integrate Web3**: Use `ViemExecutor` for real blockchain transactions
4. **Extend**: Add custom fetchers/executors for your specific needs

## 🆘 Troubleshooting

### Common Issues

**"Operation not supported"**
- Check `dataLayer.getAvailableOperations()` to see registered operations
- Ensure you've registered the required fetcher

**Supabase connection errors**
- Verify `.env` file has correct `SUPABASE_URL` and `SUPABASE_ANON_KEY`
- Test with mock data first: `--mock` flag

**Web3 connection issues**
- Ensure you're on Gnosis Chain (chain ID 100)
- Check that wallet is connected and has sufficient balance

**Transaction failures**
- Verify contract addresses are correct for your network
- Check token allowances and balances

**Node.js polyfill issues (CoW SDK)**
- Error: `Module "stream" has been externalized`
- Error: `global is not defined`
- Solution: Run `npm install` to get browser polyfills
- The Vite config includes automatic Node.js compatibility

**CoW SDK import errors**
- Error: `CowSdk is not a constructor`
- Solution: CoW SDK v3 uses `OrderBookApi` (automatically handled)
- Check console for import debugging logs

### Getting Help

1. Run `npm test` to verify basic functionality
2. Check the examples in `examples/` directory
3. Use mock data to isolate issues: `--mock` flag
4. Review the comprehensive logging in CLI tools

## 🎉 What's Included

✅ **Complete Data Layer** with pluggable fetchers  
✅ **Web3 Executor System** with real-time updates  
✅ **Futarchy Cartridge System** with full prediction market operations  
✅ **CoW Swap Cartridge** with MEV protection and order tracking  
✅ **Swapr V3 Cartridge** with direct Algebra pool execution  
✅ **Beautiful Web Interfaces** (futarchy + swap operations)  
✅ **Comprehensive Examples** and documentation  
✅ **Mock Data System** for development  
✅ **CLI Tools** for testing and debugging  
✅ **Production Configuration** with environment variables  
✅ **Node.js Browser Compatibility** with automatic polyfills  
✅ **Futarchy-Optimized** data structures and operations  
✅ **Complete Approval Management** with automatic checking  
✅ **Real-time Transaction Updates** via async generators  

**Ready to build the future of prediction market governance with advanced swap capabilities!** 🏛️🔄🐄✨ 