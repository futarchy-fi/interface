# Futarchy Market System

A decentralized prediction market system implementing futarchy governance mechanisms using token pairs and automated market makers.

## Overview

This system implements a futarchy market where participants can trade on outcomes using two types of tokens:
- Currency Tokens (SDAI)
- Company Tokens (GNO)

Each token type is split into YES and NO positions, allowing users to take positions on market outcomes.

## Key Concepts

### Token Structure
- **Currency Tokens (SDAI)**
  - YES_SDAI: Represents a positive position on the currency outcome
  - NO_SDAI: Represents a negative position on the currency outcome
  
- **Company Tokens (GNO)**
  - YES_GNO: Represents a positive position on the company outcome
  - NO_GNO: Represents a negative position on the company outcome

### Position Management
- **Opening Positions**: Users can split base tokens into YES/NO pairs
- **Closing Positions**: Users can merge YES/NO pairs back into base tokens
- **Surplus**: When a user has an imbalance between YES and NO tokens
- **Swaps**: Trading between different token types while maintaining position balance

## Core Features

### Position Operations
- Split base tokens into YES/NO pairs
- Merge YES/NO pairs back into base tokens
- Calculate and track position surpluses
- Close surplus positions through balanced swaps

### Automated Market Making
- Integration with SushiSwap for token swaps
- Optimal route finding for trades
- Slippage protection
- Fee handling

### Balance Management
- Real-time balance tracking
- Auto-refresh capabilities
- Surplus calculations
- Total available balance tracking

### Token Approvals
- Automatic handling of ERC20 token approvals
- Smart allowance management for contracts
- Support for separate YES/NO token approvals
- Cached approval state to minimize transactions
- Security measures like allowance resetting when needed

## Technical Implementation

### Smart Contract Integration
The system interacts with several smart contracts:
- Futarchy Router: Handles position splitting and merging
- SushiSwap Router: Executes token swaps
- Token Contracts: Manages ERC20 token operations

### Key Functions

#### `smartSwap`
Executes token swaps with features:
- Automatic collateral management
- Optimal route finding
- Transaction status tracking
- Error handling

#### `closePositions`
Closes surplus positions by:
1. Calculating available surplus
2. Determining optimal swap pairs
3. Executing balanced swaps
4. Updating position states

#### `getPosition`
Provides detailed position information:
- YES/NO token balances
- Surplus calculations
- Position totals

## Usage Examples

### Opening a Position
```javascript
await smartSwap({
  tokenType: 'currency',
  amount: '1.0',
  eventHappens: true,
  action: 'buy'
});
```

### Closing a Surplus Position
```javascript
await closePositions('currency');
```

### Checking Position Status
```javascript
const position = getPosition('currency');
console.log('Surplus:', position.surplus);
```

## Best Practices

1. **Position Management**
   - Always check for sufficient balance before operations
   - Monitor surplus amounts for optimal trading
   - Use appropriate slippage tolerance for swaps

2. **Error Handling**
   - Handle transaction failures gracefully
   - Verify token approvals before swaps
   - Monitor gas costs for operations

3. **Balance Tracking**
   - Use auto-refresh for real-time updates
   - Verify balance changes after operations
   - Monitor position surpluses regularly

4. **Token Approvals**
   - Use approval callbacks to track approval progress in the UI
   - Consider infinite approvals (MaxUint256) for frequently used contracts to save gas
   - Implement allowance checking before initiating transactions
   - Include proper error handling for approval rejections

## UI Implementation Best Practices

### Token Approval UI

To create a user-friendly token approval experience, implement the following UI patterns:

1. **Clear Status Indicators**
   - Use prefix emojis to visually differentiate message types (e.g., 🔑 for approval needed, ✅ for success)
   - Display prominent "TOKEN APPROVAL NEEDED" messages when approvals are required
   - Show confirmation messages when approvals are completed
   - Use color-coding to differentiate between waiting states, approvals, and confirmations

2. **Transaction Log Component**
   - Implement a dedicated log display that shows all transaction steps in sequence
   - Include timestamps with each log entry
   - Use different styling for different types of messages (info, warning, success, error)
   - Keep logs visible throughout the entire transaction process
   - Clear logs at the start of new operations to avoid confusion

3. **Wallet Integration Guidance**
   - Provide clear instructions about when to check the wallet for pending approvals
   - Explain what the approval is for and why it's needed
   - Show which token and what amount is being approved
   - Indicate when multiple approvals might be needed (e.g., for both YES and NO tokens)

4. **State Management for UI**
   - Implement a `resetUIState` function to clear logs and status before new operations
   - Use consistent naming for transaction states across your UI
   - Cache approval states to avoid showing unnecessary approval prompts
   - Display token symbols and amounts in approval messages for clarity

5. **Error Handling in UI**
   - Show clear error messages for approval failures
   - Differentiate between user rejections and network failures
   - Provide recovery options after failed approvals
   - Log detailed error information for debugging purposes

### Example Implementation: Transaction Log Component

```javascript
// Simple transaction log component
const LogDisplay = ({ logs }) => (
  <div className="log-container">
    <h4>Transaction Log</h4>
    <div className="logs">
      {logs.map((log, index) => (
        <div key={index} className={`log-entry log-${log.type}`}>
          <span className="log-time">{log.time}</span>
          <span className="log-message">{log.message}</span>
        </div>
      ))}
    </div>
  </div>
);

// Adding logs with timestamp
const addLog = (message, type = 'info') => {
  const now = new Date();
  const time = now.toLocaleTimeString();
  setLogs(prevLogs => [...prevLogs, { message, type, time }]);
};

// Example of usage during approval
const handleSmartSwap = async () => {
  resetUIState(); // Clear previous logs and status
  
  try {
    addLog("Starting transaction process", "info");
    await smartSwap({
      // ... other parameters
      onCollateralApprovalNeeded: (tokenSymbol, amount) => {
        setStatus(`🔑 TOKEN APPROVAL NEEDED: ${tokenSymbol}`);
        addLog(`Approval needed for ${amount} ${tokenSymbol}`, "warning");
      },
      onCollateralApprovalComplete: () => {
        setStatus("✅ Token successfully approved!");
        addLog("Token approval confirmed", "success");
      }
    });
  } catch (error) {
    addLog(`Error: ${error.message}`, "error");
  }
};
```

### CSS for Transaction Logs

```css
.log-container {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid #ccc;
  border-radius: 4px;
  margin-top: 10px;
}

.log-entry {
  padding: 4px 8px;
  border-bottom: 1px solid #eee;
  font-size: 13px;
}

.log-time {
  color: #888;
  margin-right: 8px;
  font-size: 11px;
}

.log-info { background-color: #f8f9fa; }
.log-warning { background-color: #fff3cd; color: #856404; }
.log-success { background-color: #d4edda; color: #155724; }
.log-error { background-color: #f8d7da; color: #721c24; }
```

### Visual Guidance For Wallet Approvals

For optimal user experience, your application should clearly indicate when a wallet approval is needed. Here's an example of how the UI should look during different approval states:

**1. Approval Needed State:**
```
Status: 🔑 TOKEN APPROVAL NEEDED: Please approve SDAI
Transaction Log:
[10:25:14] Starting transaction process
[10:25:15] Checking token balances...
[10:25:16] Need to add 0.01 SDAI as collateral
[10:25:16] Approval needed for 0.01 SDAI
```

**2. Approval Pending State:**
```
Status: Approval transaction submitted - waiting for confirmation...
Transaction Log:
[10:25:14] Starting transaction process
[10:25:15] Checking token balances...
[10:25:16] Need to add 0.01 SDAI as collateral
[10:25:16] Approval needed for 0.01 SDAI
[10:25:20] Approval transaction submitted to network
```

**3. Approval Complete State:**
```
Status: ✅ SDAI successfully approved! Now adding collateral...
Transaction Log:
[10:25:14] Starting transaction process
[10:25:15] Checking token balances...
[10:25:16] Need to add 0.01 SDAI as collateral
[10:25:16] Approval needed for 0.01 SDAI
[10:25:20] Approval transaction submitted to network
[10:25:26] Token approval confirmed
```

When implementing these UI patterns, make sure that:
- The status message is prominently displayed at the top of the transaction area
- The transaction log remains visible throughout the entire process
- Colors and icons clearly indicate the current state (warning, pending, success)
- Messages are concise but informative

By following these visual guidelines, users will have a clear understanding of when they need to check their wallet for approval requests, and can easily track the progress of their transactions from start to finish.

### Common UI Mistakes to Avoid

When implementing token approval flows, avoid these common UI mistakes:

| ❌ Incorrect Implementation | ✅ Correct Implementation |
|----------------------------|---------------------------|
| Generic "Processing transaction..." message that doesn't specify the need for approval | Clear "TOKEN APPROVAL NEEDED" message with token symbol and amount |
| Single status message that gets overwritten with each step | Persistent transaction log that shows the complete sequence of events |
| No indication of which wallet action is needed | Explicit instruction to check wallet for approval request |
| Same styling for all transaction states | Visual differentiation between waiting, approval, and confirmation states |
| Resetting UI state between approval and main transaction | Maintaining context throughout the entire process |
| No feedback after approval completes | Clear success message before proceeding to the next step |
| Technical error messages directly from blockchain | User-friendly error messages with suggestions for resolution |

**Example of Poor Implementation:**
```javascript
// Don't do this
const handleTransaction = async () => {
  setStatus("Processing transaction...");
  
  try {
    await smartSwap({
      // No proper approval callbacks
      tokenType: 'currency',
      amount: '1.0',
      eventHappens: true,
      action: 'buy'
    });
    setStatus("Transaction complete!");
  } catch (error) {
    setStatus(`Error: ${error}`);
  }
};
```

**Example of Good Implementation:**
```javascript
// Do this instead
const handleTransaction = async () => {
  resetUIState();
  addLog("Starting transaction process", "info");
  
  try {
    await smartSwap({
      tokenType: 'currency',
      amount: '1.0',
      eventHappens: true,
      action: 'buy',
      onCollateralApprovalNeeded: (tokenSymbol, amount) => {
        setStatus(`🔑 TOKEN APPROVAL NEEDED: ${tokenSymbol}`);
        addLog(`Please check your wallet to approve ${amount} ${tokenSymbol}`, "warning");
      },
      onCollateralApprovalComplete: () => {
        setStatus("✅ Token successfully approved!");
        addLog("Token approval confirmed", "success");
      },
      onSwapComplete: (tx) => {
        setStatus("Swap completed successfully!");
        addLog(`Transaction confirmed: ${tx.hash.substring(0, 10)}...`, "success");
      }
    });
  } catch (error) {
    setStatus("Transaction failed");
    addLog(`Error: ${error.message}`, "error");
    
    if (error.code === 4001) {
      addLog("Transaction was rejected in wallet. Please try again.", "warning");
    }
  }
};
```

By avoiding these common mistakes, you'll create a significantly better user experience for blockchain transactions that require token approvals.

## Development

### Prerequisites
- Node.js v14+
- Ethers.js
- Web3 provider

### Setup
1. Install dependencies
```bash
npm install
```

2. Configure environment
```bash
cp .env.example .env
# Add your configuration
```

3. Run tests
```bash
npm test
```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

MIT

# useFutarchy Hook Documentation

## Overview

The `useFutarchy` hook provides a comprehensive interface for managing positions in a Futarchy market system. It handles token swaps, position management, and balance tracking for both currency (SDAI) and company (GNO) tokens.

## Basic Usage

```javascript
import { useFutarchy } from '../hooks/useFutarchy';

function MyComponent() {
  const { 
    balances, 
    loading, 
    error, 
    status,
    addCollateral,
    removeCollateral,
    // other functions...
  } = useFutarchy();
  
  // Use the functions and state in your component
}
```

## Available Functions & State

### State Values

| Property | Type | Description |
|----------|------|-------------|
| `balances` | Object | Current token balances for all positions |
| `loading` | boolean | Indicates if an operation is in progress |
| `error` | string\|null | Error message if an operation failed, null otherwise |
| `status` | string | Current operation status message |

### Functions

## 1. `addCollateral`

Adds collateral by splitting tokens into position pairs.

```javascript
const { addCollateral } = useFutarchy();

// Usage example
const handleAddCollateral = async () => {
  try {
    setStatus('Starting add collateral process...');
    await addCollateral('currency', '1.5', {
      onStart: () => setStatus('Process started...'),
      onApprove: () => setStatus('Token approval completed...'),
      onSplit: (tx) => {
        setStatus('Adding collateral...');
        setTxHash(tx.hash);
      },
      onComplete: (receipt) => {
        setStatus('Collateral added successfully!');
        console.log('Transaction hash:', receipt.transactionHash);
      },
      onError: (error) => {
        setStatus(`Error: ${error}`);
      }
    });
  } catch (error) {
    setStatus(`Failed: ${error.message}`);
  }
};
```

**Parameters:**
- `tokenType` (string): Type of token ('currency' or 'company')
- `amount` (string): Amount of tokens to add as collateral
- `callbacks` (object): Optional callback functions
  - `onStart`: Called when the operation starts
  - `onApprove`: Called when token approval is completed
  - `onSplit`: Called when split transaction is submitted
  - `onComplete`: Called when the operation completes successfully
  - `onError`: Called if an error occurs

**Note**: This function automatically handles token approvals if needed. It follows best practices for ERC20 token approvals:
- Resets existing allowances before setting new ones (security measure for certain tokens)
- Uses infinite approval (MaxUint256) to save gas on future transactions
- Provides detailed error handling with specific callbacks
- Verifies token balances before attempting approvals

## 2. `removeCollateral`

Removes collateral by merging position tokens back to base tokens.

```javascript
const { removeCollateral } = useFutarchy();

// Usage example
const handleRemoveCollateral = async () => {
  try {
    await removeCollateral('currency', '1.0', {
      onStart: () => setStatus('Starting collateral removal...'),
      onYesApprove: () => setStatus('YES token approval...'),
      onNoApprove: () => setStatus('NO token approval...'),
      onMerge: (tx) => {
        setStatus('Merging positions...');
        setTxHash(tx.hash);
      },
      onComplete: (receipt) => {
        setStatus('Collateral removed successfully!');
      }
    });
  } catch (error) {
    setStatus(`Failed: ${error.message}`);
  }
};
```

**Parameters:**
- `tokenType` (string): Type of token ('currency' or 'company')
- `amount` (string): Amount of collateral to remove
- `callbacks` (object): Optional callback functions
  - `onStart`: Called when the operation starts
  - `onYesApprove`: Called when YES token approval is completed
  - `onNoApprove`: Called when NO token approval is completed
  - `onMerge`: Called when merge transaction is submitted
  - `onComplete`: Called when the operation completes successfully
  - `onError`: Called if an error occurs

**Note**: This function requires approval for both YES and NO tokens. It includes safety measures like resetting existing allowances when necessary.

## 3. `smartSwap`

Executes a swap between tokens with automatic collateral management.

```javascript
// Initialize the hook with SushiSwap V3 enabled (default)
const { smartSwap } = useFutarchy();

// Or to use SushiSwap V2 instead:
// const { smartSwap } = useFutarchy({ useSushiV3: false });

// Example: Buy YES company tokens using YES currency tokens
const handleBuyYesCompany = async () => {
  try {
    const result = await smartSwap({
      tokenType: 'currency',
      amount: '1.0',
      eventHappens: true, // YES position
      action: 'buy',
      onStart: () => setStatus('Starting swap...'),
      onCollateralNeeded: (amount) => setStatus(`Need to add ${amount} collateral`),
      onCollateralApprovalNeeded: (tokenSymbol, amount) => 
        setStatus(`APPROVAL NEEDED: Please approve ${tokenSymbol} before adding ${amount} collateral`),
      onCollateralApprovalComplete: () => setStatus('✅ Collateral token approved successfully'),
      onCollateralAdded: () => setStatus('Collateral added successfully'),
      onSwapStart: () => setStatus('Starting token swap...'),
      onSwapApprovalNeeded: () => setStatus('Token approval needed for swap...'),
      onSwapApprovalComplete: () => setStatus('Token approved for swap'),
      onSwapComplete: (tx) => setStatus(`Swap completed: ${tx.hash}`),
      onError: (error) => setStatus(`Error: ${error}`)
    });
    
    if (result.success) {
      console.log('Swap successful:', result.receipt);
    } else {
      console.error('Swap failed:', result.error);
    }
  } catch (error) {
    setStatus(`Failed: ${error.message}`);
  }
};
```

**Parameters:**
- `params` (object):
  - `tokenType` (string): Type of token ('currency' or 'company')
  - `amount` (string): Amount to swap
  - `eventHappens` (boolean): Whether to swap YES (true) or NO (false) tokens
  - `action` (string): Swap action ('buy' or 'sell')
  - Callback functions:
    - `onStart`: Called when the operation starts
    - `onCollateralNeeded`: Called when collateral is needed, receives amount parameter
    - `onCollateralApprovalNeeded`: Called when approval is needed for collateral, receives tokenSymbol and amount parameters
    - `onCollateralApprovalComplete`: Called when collateral approval completes
    - `onCollateralAdded`: Called when collateral has been added
    - `onSwapStart`: Called when swap begins
    - `onSwapApprovalNeeded`: Called when token approval is needed for swap
    - `onSwapApprovalComplete`: Called when token approval completes
    - `onSwapComplete`: Called when swap completes
    - `onError`: Called if an error occurs

**Returns:**
- Object with `success` (boolean) and either `receipt` (transaction receipt) or `error` (error message)

**Note**: This function automatically handles token approvals for both swaps and collateral additions:
- Checks approval status before any token transfer operation
- Uses maximum approval (MaxUint256) to save gas on future transactions 
- Provides separate callbacks for collateral approval and swap approval processes
- Includes safety measures like resetting existing allowances when necessary

## 4. `closePositions`

Closes surplus positions by swapping them for matching tokens.

```javascript
const { closePositions } = useFutarchy();

// Usage example
const handleClosePosition = async () => {
  try {
    const result = await closePositions('currency');
    if (result.success) {
      setStatus('Position closed successfully!');
    } else {
      setStatus(`Failed to close position: ${result.error}`);
    }
  } catch (error) {
    setStatus(`Error: ${error.message}`);
  }
};
```

**Parameters:**
- `tokenType` (string): Type of token ('currency' or 'company')

**Returns:**
- Object with `success` (boolean) and optionally `error` (string)

## 5. `getPosition`

Gets detailed position information including surplus calculations.

```javascript
const { getPosition } = useFutarchy();

// Usage example
const currencyPosition = getPosition('currency');
console.log('YES tokens:', currencyPosition.yes);
console.log('NO tokens:', currencyPosition.no);
console.log('Surplus amount:', currencyPosition.surplus.amount);
console.log('Surplus type:', currencyPosition.surplus.type);
console.log('Has YES surplus:', currencyPosition.surplus.hasYesSurplus);
console.log('Total matched position:', currencyPosition.total);
```

**Parameters:**
- `tokenType` (string): Type of token ('currency' or 'company')

**Returns:**
- Object with position details:
  - `yes` (string): Amount of YES tokens
  - `no` (string): Amount of NO tokens
  - `surplus`: Object containing surplus details
    - `amount` (string): Amount of surplus
    - `type` (string): 'YES' or 'NO'
    - `hasYesSurplus` (boolean): Whether there's a YES surplus
    - `hasNoSurplus` (boolean): Whether there's a NO surplus
  - `total` (string): Total matched position amount

## 6. `canCloseCurrency`

Checks if currency position can be closed (currency can only be closed if company has surplus in the opposite direction).

```javascript
const { canCloseCurrency } = useFutarchy();

// Usage example
if (canCloseCurrency()) {
  console.log('Currency position can be closed');
} else {
  console.log('Currency position cannot be closed');
}
```

**Returns:**
- Boolean indicating whether currency position can be closed

## 7. `updateBalances`

Forces an update of all balances.

```javascript
const { updateBalances } = useFutarchy();

// Usage example
const refreshBalances = async () => {
  await updateBalances();
  console.log('Balances updated');
};
```

## 8. `getTotalAvailableBalance`

Calculates total available balance including wallet and position.

```javascript
const { getTotalAvailableBalance } = useFutarchy();

// Usage example
const yesBalanceTotal = getTotalAvailableBalance('currency', true);
console.log('Total YES currency balance:', yesBalanceTotal.formatted);

const noBalanceTotal = getTotalAvailableBalance('company', false);
console.log('Total NO company balance:', noBalanceTotal.formatted);
```

**Parameters:**
- `tokenType` (string): Type of token ('currency' or 'company')
- `eventHappens` (boolean): Whether to check YES (true) or NO (false) position

**Returns:**
- Object with:
  - `raw` (BigNumber): Raw balance in wei
  - `formatted` (string): Formatted balance with decimals

## 9. `startAutoRefresh` and `stopAutoRefresh`

Start and stop automatic balance refreshing.

```javascript
const { startAutoRefresh, stopAutoRefresh } = useFutarchy();

// Usage example
const beginMonitoring = () => {
  startAutoRefresh();
  // Will automatically update balances periodically
  setTimeout(() => {
    stopAutoRefresh();
    console.log('Stopped auto-refreshing balances');
  }, 60000); // Stop after 1 minute
};
```

## Common Patterns

### Adding Collateral and Swapping

```javascript
const { addCollateral, smartSwap } = useFutarchy();

const addCollateralAndSwap = async () => {
  // First add collateral
  await addCollateral('currency', '2.0', {
    onComplete: async () => {
      // Then execute a swap once collateral is added
      await smartSwap({
        tokenType: 'currency',
        amount: '1.5',
        eventHappens: true,
        action: 'buy'
      });
    }
  });
};
```

### Managing Position Balances

```javascript
const { getPosition, balances } = useFutarchy();

const checkPositionStatus = () => {
  const currencyPosition = getPosition('currency');
  const companyPosition = getPosition('company');
  
  console.log('Currency YES/NO ratio:', 
    parseFloat(currencyPosition.yes) / parseFloat(currencyPosition.no));
  console.log('Company YES/NO ratio:', 
    parseFloat(companyPosition.yes) / parseFloat(companyPosition.no));
    
  // Check if positions have surplus
  if (currencyPosition.surplus.amount !== '0') {
    console.log(`Currency has ${currencyPosition.surplus.type} surplus of ${currencyPosition.surplus.amount}`);
  }
  
  if (companyPosition.surplus.amount !== '0') {
    console.log(`Company has ${companyPosition.surplus.type} surplus of ${companyPosition.surplus.amount}`);
  }
};
```

## Error Handling Best Practices

Always wrap function calls in try/catch blocks to handle errors gracefully:

```javascript
try {
  await addCollateral('currency', amount);
} catch (error) {
  if (error.code === 4001) {
    console.log('User rejected the transaction');
  } else if (error.message.includes('insufficient funds')) {
    console.log('Not enough balance to complete the operation');
  } else {
    console.error('Operation failed:', error);
  }
}
```

## SushiSwap V3 Integration

Starting from version 1.1.0, the Futarchy Market System supports SushiSwap V3 for token swaps, providing better liquidity and efficiency. By default, the system uses SushiSwap V3 for all swaps, but you can still use the legacy V2 implementation if needed.

### Configuration

You can configure whether to use SushiSwap V3 when initializing the `useFutarchy` hook:

```javascript
// Use SushiSwap V3 (default)
const { smartSwap, closePositions } = useFutarchy();

// Or, use SushiSwap V2 instead
const { smartSwap, closePositions } = useFutarchy({ useSushiV3: false });
```

### Key Benefits of V3

- **Concentrated Liquidity**: SushiSwap V3 provides better capital efficiency through concentrated liquidity pools
- **Direct Swaps**: Uses direct swap calls instead of route processor, reducing gas costs
- **Reduced Slippage**: More precise pricing for swaps with the configured pools
- **Lower Fees**: Can offer lower fees depending on the pool configuration

### Implementation Details

The V3 integration uses two specific liquidity pools:

1. **YES Pool**: For swaps involving YES_SDAI and YES_GNO tokens
   - Pool Address: `0xB3B388e53ca476e52C8F0c547C8A12d12bd519aB`

2. **NO Pool**: For swaps involving NO_SDAI and NO_GNO tokens
   - Pool Address: `0x6E33153115Ab58dab0e0F1E3a2ccda6e67FA5cD7`

Each swap is executed as a direct call to the SushiSwap V3 Router's `exactInputSingle` function with parameters optimized for the specific pool and token pair being used.

# Futarchy Proposal CLI Tool

A simple command-line tool to fetch Futarchy proposal data from Gnosis Chain using pure JavaScript and ethers.js.

## Installation

1. Make sure you have Node.js installed (v14 or higher)
2. Install dependencies:
   ```bash
   npm install
   ```

## Usage

### Interactive Mode

Run the CLI tool in interactive mode:

```bash
npm start
# or
node proposal-cli.js
```

The tool will prompt you to enter a proposal address and will fetch all relevant data.

### Example

```bash
$ npm start

🏛️ Futarchy Proposal Data Fetcher
================================

Enter a proposal address to fetch its data from Gnosis Chain.
Example: 0xDA36a35CA4Fe6214C37a452159C0C9EAd45D5919

Proposal Address: 0xYourProposalAddressHere
```

## What Data Is Fetched

The CLI tool retrieves the following information:

### 📋 Basic Info
- Market Name
- Proposal Address  
- Condition ID
- Question ID
- Number of Outcomes

### 🪙 Collateral Tokens
- Company Token (name, symbol, address, decimals)
- Currency Token (name, symbol, address, decimals)

### 🎯 Wrapped Outcome Tokens
- YES/NO tokens for both Company and Currency collateral
- Token addresses for each outcome

### ⏰ Voting Schedule
- Opening time (if set in Reality.io)
- Current voting status
- Time until voting opens (if applicable)

## Example Output

```
============================================================
📊 PROPOSAL DATA SUMMARY
============================================================

📋 Basic Info:
   Market Name: Test Market
   Proposal Address: 0xDA36a35CA4Fe6214C37a452159C0C9EAd45D5919
   Condition ID: 0x1234...
   Question ID: 0x5678...
   Number of Outcomes: 4

🪙 Collateral Tokens:
   Company Token: Gnosis (GNO)
      Address: 0x9C58BAcC331c9aa871AFD802DB6379a98e80CEdb
      Decimals: 18
   Currency Token: Savings DAI (SDAI)
      Address: 0xaf204776c7245bF4147c2612BF6e5972Ee483701
      Decimals: 18

🎯 Wrapped Outcome Tokens:
   [0] YES_Company: 0x1234...
   [1] NO_Company: 0x5678...
   [2] YES_Currency: 0x9abc...
   [3] NO_Currency: 0xdef0...

⏰ Voting Schedule:
   Opening Time: 2024-06-15T10:00:00.000Z
   Local Time: 6/15/2024, 6:00:00 AM
   Status: 🟢 OPEN FOR VOTING

============================================================
✅ Data fetch completed successfully!
```

## Configuration

The tool is pre-configured for Gnosis Chain:
- RPC URL: `https://rpc.gnosischain.com`
- Chain ID: 100
- Reality.io Address: `0xE78996A233895bE74a66F451f1019cA9734205cc`

## Error Handling

The tool includes comprehensive error handling:
- Validates Ethereum address format
- Checks if the address is a valid proposal contract
- Gracefully handles network issues
- Provides helpful error messages and tips

## Requirements

- Node.js v14 or higher
- Internet connection to access Gnosis Chain RPC
- Valid Futarchy proposal contract address

## License

MIT