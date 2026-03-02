# Data Layer Fetcher Executor Pattern

## Overview

The Data Layer Fetcher Executor pattern is a modular architecture for building blockchain applications that cleanly separates data fetching operations from transaction execution operations. This pattern provides a unified interface for both reading blockchain/database data and executing blockchain transactions.

## Architecture Components

### 1. DataLayer (Core Orchestrator)

The `DataLayer` class serves as the central orchestrator that:
- Maintains registries of fetchers and executors
- Routes operations to appropriate handlers
- Provides a unified API for both read and write operations
- Supports plugin-based extensibility

**Location**: `DataLayer.js:7-91`

**Key Methods**:
- `registerFetcher(fetcher)` - Register a data fetcher
- `registerExecutor(executor)` - Register a transaction executor  
- `fetch(dataPath, args)` - Route data fetching operations
- `execute(dataPath, args)` - Route transaction execution operations
- `getAvailableOperations()` - List all supported operations

### 2. BaseFetcher (Data Reading Interface)

Abstract base class for all data fetchers. Fetchers handle read-only operations like:
- Querying blockchain state
- Fetching from databases (e.g., Supabase)
- Retrieving market data
- Mock data for testing

**Location**: `DataLayer.js:97-115`

**Core Structure**:
```javascript
class BaseFetcher {
    supportedOperations = []  // List of operations this fetcher handles
    operations = {}           // Map of operation handlers
    
    async fetch(dataPath, args) {
        // Implementation specific to each fetcher
    }
    
    registerOperation(operationPath, handlerFunction) {
        // Helper to register operations
    }
}
```

### 3. BaseExecutor (Transaction Execution Interface)

Abstract base class for all transaction executors. Executors handle write operations like:
- Token approvals
- Swaps and transfers
- Contract interactions
- Wallet connections

**Location**: `executors/BaseExecutor.js:7-61`

**Core Structure**:
```javascript
class BaseExecutor {
    supportedOperations = []  // List of operations this executor handles
    operations = {}           // Map of operation handlers
    
    async* execute(dataPath, args) {
        // Yields status updates during execution
    }
    
    registerOperation(operationPath, handlerFunction) {
        // Helper to register operations
    }
}
```

## Implementation Examples

### Fetcher Implementation (MockFetcher)

**Location**: `fetchers/MockFetcher.js:9-133`

```javascript
class MockFetcher extends BaseFetcher {
    constructor() {
        super();
        // Register supported operations
        this.registerOperation('pools.candle', this.mockPoolCandles.bind(this));
        this.registerOperation('pools.info', this.mockPoolInfo.bind(this));
        this.registerOperation('user.profile', this.mockUserProfile.bind(this));
    }
    
    async fetch(dataPath, args = {}) {
        if (dataPath in this.operations) {
            return await this.operations[dataPath](args);
        }
        // Handle unsupported operations
    }
}
```

### Executor Implementation (ViemExecutor)

**Location**: `executors/ViemExecutor.js:19-372`

```javascript
class ViemExecutor extends BaseExecutor {
    constructor(options = {}) {
        super();
        // Initialize Web3 clients
        this.initializeClients();
        // Register operations
        this.registerOperation('web3.approve', this.handleApprove.bind(this));
        this.registerOperation('web3.connect', this.handleConnect.bind(this));
    }
    
    async* execute(dataPath, args = {}) {
        // Yields status updates during transaction
        yield { status: 'pending', message: 'Preparing...' };
        // Execute operation
        yield { status: 'success', data: result };
    }
}
```

## Cartridge System (Extended Functionality)

The pattern supports a "cartridge" system for adding domain-specific functionality to executors without modifying core code.

**Example**: FutarchyCartridge adds futarchy-specific operations to ViemExecutor
- Split positions
- Redeem positions  
- Market operations

**Integration**:
```javascript
const executor = new ViemExecutor();
const cartridge = new FutarchyCartridge(routerAddress);
executor.registerCartridge(cartridge);
```

## Data Flow

### Read Operations (Fetching)
```
User Request → DataLayer.fetch() → Route to Fetcher → Return Data
```

### Write Operations (Executing)
```
User Request → DataLayer.execute() → Route to Executor → Yield Status Updates → Complete
```

## Testing Infrastructure

### basefetch CLI Tool

**Location**: `basefetch.js`

Command-line tool for testing fetchers in isolation:
```bash
basefetch --list                    # List all fetchers
basefetch --info mockfetcher        # Show fetcher details
basefetch mockfetcher pools.candle  # Test specific operation
```

### baseexec CLI Tool  

**Location**: `baseexec.js`

Command-line tool for testing executors in isolation:
```bash
baseexec --list                     # List all executors
baseexec --info viemexecutor        # Show executor details
baseexec --test viemexecutor        # Test connection
baseexec viemexecutor web3.connect  # Execute operation
```

## Key Benefits

1. **Separation of Concerns**: Clear distinction between data reading and transaction execution
2. **Modularity**: Fetchers and executors can be developed/tested independently
3. **Extensibility**: Easy to add new fetchers, executors, or cartridges
4. **Testing**: Each component can be tested in isolation
5. **Type Safety**: Well-defined interfaces for operations
6. **Real-time Updates**: Executors use generators to yield status updates
7. **Plugin Architecture**: Cartridge system allows domain-specific extensions

## Usage Example

```javascript
// Setup
const dataLayer = new DataLayer();

// Register fetchers
const mockFetcher = new MockFetcher();
dataLayer.registerFetcher(mockFetcher);

// Register executor with cartridge
const viemExecutor = new ViemExecutor();
const futarchyCartridge = new FutarchyCartridge(routerAddress);
viemExecutor.registerCartridge(futarchyCartridge);
dataLayer.registerExecutor(viemExecutor);

// Use unified API
// Fetch data
const poolData = await dataLayer.fetch('pools.candle', { id: '0x...' });

// Execute transaction (with status updates)
for await (const status of dataLayer.execute('web3.approve', { 
    tokenAddress: '0x...', 
    spenderAddress: '0x...', 
    amount: '1000000' 
})) {
    console.log(status.message);
}
```

## File Structure

```
futarchy-sdk/
├── DataLayer.js              # Core orchestrator & base fetcher
├── basefetch.js             # Fetcher testing CLI
├── baseexec.js              # Executor testing CLI
├── fetchers/
│   ├── MockFetcher.js       # Mock data fetcher
│   ├── SupabasePoolFetcher.js # Supabase database fetcher
│   └── FutarchyFetcher.js   # Futarchy-specific fetcher
└── executors/
    ├── BaseExecutor.js      # Base executor interface
    ├── ViemExecutor.js      # Viem-based Web3 executor
    ├── WagmiExecutor.js     # Wagmi-based Web3 executor
    └── FutarchyCartridge.js # Futarchy operations cartridge
```

## Operation Naming Convention

Operations follow a dot-notation naming pattern:
- `pools.candle` - Fetch pool candle data
- `pools.info` - Fetch pool information
- `user.profile` - Fetch user profile
- `web3.connect` - Connect wallet
- `web3.approve` - Approve token spending
- `futarchy.splitPosition` - Split futarchy position

## Error Handling

Both fetchers and executors return standardized error responses:
```javascript
{
    status: "error",
    reason: "Error description",
    availableOperations: [...] // Help user understand what's available
}
```

## Generator Pattern for Executors

Executors use async generators to provide real-time status updates:
```javascript
async* execute(dataPath, args) {
    yield { status: 'pending', message: 'Preparing transaction...' };
    yield { status: 'pending', message: 'Waiting for confirmation...' };
    yield { status: 'success', data: result };
}
```

This allows UI components to show progress indicators and transaction states.

## Conclusion

The Data Layer Fetcher Executor pattern provides a clean, extensible architecture for blockchain applications. By separating concerns and providing clear interfaces, it enables rapid development while maintaining code quality and testability.