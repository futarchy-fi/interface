# Futarchy Refactor Module - Swap Strategy System

## 🎯 **Overview**

This refactor module implements a **Strategy Pattern** based swap system that allows for extensible, reusable swap implementations. The system supports multiple swap protocols (Algebra/Swapr, CoW Swap, future SushiSwap V3) through a unified interface.

## 🏗️ **Architecture**

### **Design Patterns Used**

1. **Strategy Pattern**: Different swap implementations with common interface
2. **Factory Pattern**: Creates appropriate strategy instances
3. **Template Method Pattern**: Common approval → swap execution flow
4. **Observer Pattern**: Callback system for UI updates

### **Directory Structure**

```
src/components/refactor/
├── strategies/              # 🎯 Core swap strategy system
│   ├── BaseSwapStrategy.js     # Abstract base class
│   ├── AlgebraSwapStrategy.js  # Algebra (Swapr) implementation  
│   ├── CowSwapStrategy.js      # CoW Protocol implementation
│   ├── SwapStrategyFactory.js  # Factory for creating strategies
│   ├── SwapExecutor.js         # Main orchestrator
│   └── index.js                # Clean exports
├── hooks/
│   └── useSwap.js              # React hook for swap execution
├── components/
│   └── SwapManager.jsx         # Demo UI component
├── abis/                       # Self-contained ABIs
├── constants/                  # Contract addresses
└── utils/                      # Utility functions
```

## 🔄 **How It Works**

### **1. Strategy Interface**

Every swap strategy implements these methods:

```javascript
class BaseSwapStrategy {
  async executeSwap(params)      // Main entry point
  async validateParams(params)   // Parameter validation
  async checkApproval(params)    // Check if approval needed
  async handleApproval(params)   // Handle token approval
  async performSwap(params)      // Strategy-specific swap logic
  async estimateOutput(params)   // Get quote/estimate
  getRequiredApprovalAddress()   // Get approval target
}
```

### **2. Strategy Factory**

Creates the appropriate strategy based on selection:

```javascript
import { SwapStrategyFactory } from './strategies';

// Create strategy
const strategy = SwapStrategyFactory.createStrategy(
  'algebra',  // or 'cowswap'
  signer,
  { slippageBps: 50 }
);
```

### **3. Swap Executor**

Orchestrates the entire swap process:

```javascript
import { SwapExecutor } from './strategies';

const executor = new SwapExecutor(signer);

// Execute swap
const result = await executor.executeSwap({
  strategyType: 'algebra',
  tokenIn: '0x...',
  tokenOut: '0x...',
  amount: ethers.utils.parseUnits('1', 18),
  userAddress: '0x...'
});
```

### **4. React Hook**

Provides a clean interface for components:

```javascript
import { useSwap } from './hooks/useSwap';

function MyComponent() {
  const {
    executeSwap,
    setSelectedStrategy,
    loading,
    error,
    result
  } = useSwap();

  const handleSwap = async () => {
    await executeSwap({
      tokenIn: '0x...',
      tokenOut: '0x...',
      amount: ethers.utils.parseUnits('1', 18)
    });
  };
}
```

## 📋 **Available Strategies**

### **1. Algebra (Swapr) Strategy**
- **Type**: Direct V3 pool swap
- **Method**: `exactInputSingle`
- **Features**: Slippage protection, immediate settlement
- **Gas**: Required
- **Chains**: Gnosis

### **2. CoW Swap Strategy**
- **Type**: Order-based batch auction
- **Method**: SDK order signing + submission
- **Features**: Gasless, MEV protection, batch execution
- **Gas**: Not required (gasless)
- **Chains**: Gnosis, Ethereum

### **3. SushiSwap V3 (Future)**
- **Type**: Direct V3 router swap
- **Status**: Planned implementation
- **Features**: Concentrated liquidity

## 🚀 **Usage Examples**

### **Basic Swap**

```javascript
import { useSwap } from './hooks/useSwap';

function SwapComponent() {
  const { executeSwap, setSelectedStrategy } = useSwap();

  const handleSwap = async () => {
    setSelectedStrategy('algebra');
    
    await executeSwap({
      tokenIn: '0xTokenInAddress',
      tokenOut: '0xTokenOutAddress', 
      amount: ethers.utils.parseUnits('1', 18)
    });
  };
}
```

### **Multiple Quotes**

```javascript
const { getMultipleQuotes } = useSwap();

const quotes = await getMultipleQuotes({
  tokenIn: '0x...',
  tokenOut: '0x...',
  amount: ethers.utils.parseUnits('1', 18)
});

// Result: { algebra: {...}, cowswap: {...} }
```

### **Fallback Support**

```javascript
const { executeSwapWithFallback } = useSwap();

// Try Algebra first, fallback to CoW if it fails
await executeSwapWithFallback(
  {
    tokenIn: '0x...',
    tokenOut: '0x...',
    amount: ethers.utils.parseUnits('1', 18)
  },
  ['cowswap']  // fallback strategies
);
```

### **Custom Strategy Configuration**

```javascript
const { executeSwap } = useSwap({
  slippageBps: 100,  // 1% slippage for Algebra
  validityDuration: 1800,  // 30 min for CoW orders
  gasOptions: {
    gasLimit: 300000,
    gasPrice: ethers.utils.parseUnits('1', 'gwei')
  }
});
```

## 🔧 **Adding New Strategies**

To add a new swap strategy:

### **1. Create Strategy Class**

```javascript
import { BaseSwapStrategy } from './BaseSwapStrategy';

export class MyCustomStrategy extends BaseSwapStrategy {
  constructor(signer, config = {}) {
    super(signer, config);
    this.name = 'MyCustom';
  }

  getRequiredApprovalAddress() {
    return '0xMyRouterAddress';
  }

  async performSwap(params) {
    // Your swap implementation
    const { tokenIn, tokenOut, amount, userAddress } = params;
    
    // Execute swap logic
    const tx = await myRouter.swap(tokenIn, tokenOut, amount);
    return tx;
  }

  async estimateOutput(params) {
    // Return quote/estimate
    return {
      estimatedOutput: '...',
      price: '...'
    };
  }
}
```

### **2. Update Factory**

```javascript
// In SwapStrategyFactory.js
import { MyCustomStrategy } from './MyCustomStrategy';

static STRATEGIES = {
  // ... existing
  MY_CUSTOM: 'mycustom'
};

static createStrategy(strategyType, signer, config = {}) {
  switch (normalizedType) {
    // ... existing cases
    case SwapStrategyFactory.STRATEGIES.MY_CUSTOM:
      return new MyCustomStrategy(signer, config);
  }
}
```

### **3. Update Hook Default**

```javascript
// In useSwap.js
const [selectedStrategy, setSelectedStrategy] = useState('mycustom');
```

## 📊 **Benefits**

### **✅ Extensible**
- Easy to add new swap protocols
- Consistent interface across all strategies
- Minimal code changes needed

### **🔄 Reusable**
- Common approval flow
- Shared error handling
- Unified callback system

### **🛡️ Robust**
- Automatic fallback support
- Type-safe parameter validation
- Comprehensive error handling

### **🎯 Testable**
- Each strategy is isolated
- Mockable interfaces
- Clear separation of concerns

## 🔍 **Integration**

To integrate into existing components:

```javascript
// Replace existing swap logic
import { useSwap } from './components/refactor/hooks/useSwap';

function ConfirmSwapModal() {
  const { executeSwap, loading, error } = useSwap();
  
  const handleConfirm = async () => {
    await executeSwap({
      tokenIn: transactionData.tokenIn,
      tokenOut: transactionData.tokenOut,
      amount: transactionData.amount
    });
  };
}
```

## 🎮 **Demo**

Visit `/refactor` page to see the complete system in action with:
- Strategy selection UI
- Multi-strategy quotes
- Swap execution with callbacks
- Fallback demonstrations
- Error handling examples

---

This architecture provides a **clean, extensible foundation** for supporting multiple swap protocols while maintaining **code reusability** and **type safety**. 