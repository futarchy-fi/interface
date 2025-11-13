# 🧩 Modular Architecture Guide - Dependency Injection

You're absolutely right! The new architecture is **much cleaner** - operation configurations are separated into their own files, and the modal uses dependency injection to load them dynamically. This makes everything modular, testable, and easy to extend.

## 🏗️ **Architecture Overview**

```
┌─────────────────────────────────────────────────────────────┐
│                   MODULAR ARCHITECTURE                     │
│                                                             │
│  ┌─────────────────┐    ┌─────────────────────────────────┐ │
│  │  Generic Modal  │    │     Operation Registry         │ │
│  │  (UI Logic)     │◄──►│   (Dependency Injection)       │ │
│  └─────────────────┘    └─────────────────────────────────┘ │
│                                        ▲                   │
│                                        │                   │
│  ┌─────────────────────────────────────┼─────────────────┐ │
│  │           Operation Configurations  │                 │ │
│  │                                     │                 │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌──▼──────────┐     │ │
│  │  │ Futarchy    │ │   CoW Swap  │ │   Swapr     │     │ │
│  │  │ Merge.js    │ │ Operation.js│ │ Swap.js     │     │ │
│  │  │             │ │             │ │             │     │ │
│  │  │ - Steps     │ │ - Steps     │ │ - Steps     │     │ │
│  │  │ - Mapping   │ │ - Mapping   │ │ - Mapping   │     │ │
│  │  │ - Validation│ │ - Validation│ │ - Validation│     │ │
│  │  └─────────────┘ └─────────────┘ └─────────────┘     │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 🎯 **Key Benefits**

### ✅ **Separation of Concerns**
- **UI logic** (modal) separated from **operation logic** (configs)
- **Each operation** in its own file with all related logic
- **Registry system** manages dependencies cleanly

### ✅ **Easy Extension**
- Add new operations by creating one file
- No need to modify existing modal or components
- Automatic registration and discovery

### ✅ **Type Safety & Validation**
- Each operation defines its own parameter schema
- Built-in validation with custom error messages
- Form generation from schema

### ✅ **Reusable Components**
- Same modal works for any operation
- Same step visualization pattern
- Same error handling and success flows

---

## 🗂️ **File Structure**

```
examples/
├── operations/                    # Operation configurations
│   ├── FutarchyMergeOperation.js  # Futarchy merge config
│   ├── CoWSwapOperation.js        # CoW Protocol swap config
│   ├── SwaprSwapOperation.js      # Swapr V3 swap config
│   └── OperationRegistry.js       # Registry & dependency injection
│
├── React-GenericOperationModal.jsx  # Generic modal (UI only)
└── Modular-Architecture-Guide.md    # This guide
```

---

## 🚀 **How to Use**

### **Simple Usage - Generic Modal**

```jsx
import { GenericOperationModal } from './React-GenericOperationModal.jsx';

const MyApp = () => {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div>
      <button onClick={() => setModalOpen(true)}>
        Open CoW Swap
      </button>
      
      <GenericOperationModal 
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        operationId="cow-swap"           // Dynamic operation loading!
        initialParams={{                 // Optional parameter override
          amount: "5.0"
        }}
        onSuccess={(result) => {         // Success callback
          console.log('Swap succeeded:', result.orderId);
        }}
        onError={(error) => {            // Error callback  
          console.error('Swap failed:', error);
        }}
      />
    </div>
  );
};
```

### **Advanced Usage - Operation Selection**

```jsx
import { useOperationRegistry } from './operations/OperationRegistry.js';

const MultiOperationApp = () => {
  const { getAllGrouped } = useOperationRegistry();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedOperation, setSelectedOperation] = useState('futarchy-merge');

  const operationGroups = getAllGrouped();

  return (
    <div>
      {/* Dynamic operation selection */}
      <select value={selectedOperation} onChange={(e) => setSelectedOperation(e.target.value)}>
        {Object.entries(operationGroups).map(([cartridge, operations]) => (
          <optgroup key={cartridge} label={cartridge.toUpperCase()}>
            {operations.map(op => (
              <option key={op.id} value={op.id}>{op.name}</option>
            ))}
          </optgroup>
        ))}
      </select>
      
      <button onClick={() => setModalOpen(true)}>
        Execute Operation
      </button>

      <GenericOperationModal 
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        operationId={selectedOperation}
      />
    </div>
  );
};
```

---

## 🔧 **Adding New Operations**

### **Step 1: Create Operation Configuration**

```javascript
// operations/MyCustomOperation.js

export const MyCustomOperation = {
  id: 'my-custom-operation',
  name: 'My Custom Operation',
  description: 'Description of what this operation does',
  cartridge: 'my-cartridge',
  operation: 'my-cartridge.myOperation',
  
  // Define UI steps
  steps: [
    { 
      id: 'step1', 
      label: 'First Step',
      description: 'What happens in the first step'
    },
    { 
      id: 'step2', 
      label: 'Second Step',
      description: 'What happens in the second step'
    }
  ],

  // Map cartridge yield steps to UI steps
  stepMapping: {
    'cartridge_step_1': { stepId: 'step1', status: 'running' },
    'cartridge_step_1_complete': { stepId: 'step1', status: 'completed' },
    'cartridge_step_2': { stepId: 'step2', status: 'running' },
    'complete': { stepId: 'step2', status: 'completed' }
  },

  // Default form parameters
  defaultParams: {
    amount: '100',
    token: '0x...'
  },

  // Parameter schema for form generation
  parameterSchema: {
    amount: {
      type: 'string',
      required: true,
      label: 'Amount',
      placeholder: 'Enter amount'
    },
    token: {
      type: 'address',
      required: true,
      label: 'Token Address',
      placeholder: '0x...'
    }
  },

  // Transform form data before sending to cartridge
  transformParams: (formParams) => {
    return {
      amount: formParams.amount,
      tokenAddress: formParams.token
    };
  },

  // Validate parameters
  validateParams: (params) => {
    const errors = {};
    
    if (!params.amount || isNaN(Number(params.amount))) {
      errors.amount = 'Amount must be a number';
    }
    
    if (!params.token || !/^0x[a-fA-F0-9]{40}$/.test(params.token)) {
      errors.token = 'Invalid token address';
    }
    
    return Object.keys(errors).length > 0 ? errors : null;
  },

  // Custom success message
  getSuccessMessage: (result) => {
    return `Custom operation completed! TX: ${result.transactionHash}`;
  },

  // Custom link generation
  getTransactionLink: (hash) => {
    return `https://gnosisscan.io/tx/${hash}`;
  }
};
```

### **Step 2: Register the Operation**

```javascript
// operations/OperationRegistry.js

import { MyCustomOperation } from './MyCustomOperation.js';

class OperationRegistry {
  registerDefaults() {
    this.register(FutarchyMergeOperation);
    this.register(CoWSwapOperation); 
    this.register(SwaprSwapOperation);
    this.register(MyCustomOperation);  // Add your operation!
  }
}
```

### **Step 3: Use Immediately**

```jsx
// The operation is now available everywhere!
<GenericOperationModal 
  operationId="my-custom-operation"
  isOpen={true}
  onClose={handleClose}
/>
```

---

## 🎯 **Operation Configuration Reference**

### **Required Fields**

```javascript
{
  id: 'unique-operation-id',           // Unique identifier
  name: 'Display Name',                // Human-readable name
  cartridge: 'cartridge-name',         // Which cartridge handles this
  operation: 'cartridge.operationName', // DataLayer operation to call
  steps: [...],                       // UI step definitions
  stepMapping: {...}                  // Map cartridge steps to UI steps
}
```

### **Optional Fields**

```javascript
{
  description: 'What this operation does',
  defaultParams: {...},               // Default form values
  parameterSchema: {...},             // Form field definitions
  transformParams: (params) => {...}, // Transform before sending to cartridge
  validateParams: (params) => {...},  // Custom validation logic
  getSuccessMessage: (result) => {...}, // Custom success message
  getTransactionLink: (hash) => {...}, // Custom link generation
  handleResult: (result) => {...}     // Custom result processing
}
```

### **Step Mapping Examples**

```javascript
// Simple mapping
stepMapping: {
  'checking': { stepId: 'approve', status: 'running' },
  'approved': { stepId: 'approve', status: 'completed' },
  'executing': { stepId: 'execute', status: 'running' },
  'complete': { stepId: 'execute', status: 'completed' }
}

// Complex futarchy mapping  
stepMapping: {
  'check_yes_approval': { stepId: 'approve_yes', status: 'running' },
  'approving_yes': { stepId: 'approve_yes', status: 'running' },
  'yes_approved': { stepId: 'approve_yes', status: 'completed' },
  'check_no_approval': { stepId: 'approve_no', status: 'running' },
  'approving_no': { stepId: 'approve_no', status: 'running' },
  'no_approved': { stepId: 'approve_no', status: 'completed' },
  'merging': { stepId: 'merge', status: 'running' },
  'complete': { stepId: 'merge', status: 'completed' }
}
```

---

## 🔧 **Runtime Operation Registration**

You can also register operations dynamically:

```javascript
import { registerOperation, createOperationConfig } from './operations/OperationRegistry.js';

// Create operation configuration at runtime
const dynamicOperation = createOperationConfig({
  id: 'dynamic-operation',
  name: 'Dynamic Operation',
  cartridge: 'my-cartridge',
  operation: 'my-cartridge.dynamicOp',
  steps: [
    { id: 'process', label: 'Processing', description: 'Processing data' }
  ],
  stepMapping: {
    'processing': { stepId: 'process', status: 'running' },
    'complete': { stepId: 'process', status: 'completed' }
  },
  defaultParams: { data: 'test' },
  validateParams: (params) => params.data ? null : { data: 'Data is required' }
});

// Register it
registerOperation(dynamicOperation);

// Use immediately
<GenericOperationModal operationId="dynamic-operation" ... />
```

---

## 🎨 **Custom Parameter Types**

The parameter schema supports different field types:

```javascript
parameterSchema: {
  // Text input
  amount: {
    type: 'string',
    required: true,
    label: 'Amount',
    placeholder: 'Enter amount'
  },
  
  // Address input with validation
  address: {
    type: 'address',
    required: true,
    label: 'Token Address',
    placeholder: '0x...'
  },
  
  // Optional field with default
  slippage: {
    type: 'string',
    required: false,
    label: 'Slippage (%)',
    placeholder: '0.5',
    default: '0.5'
  },
  
  // Number input
  deadline: {
    type: 'number',
    required: false,
    label: 'Deadline (minutes)',
    placeholder: '20',
    default: '20'
  }
}
```

---

## 🚀 **Real-World Examples**

### **Example 1: Adding Uniswap V2 Swap**

```javascript
// operations/UniswapV2Operation.js
export const UniswapV2Operation = {
  id: 'uniswap-v2-swap',
  name: 'Uniswap V2 Swap',
  description: 'Classic AMM swap via Uniswap V2',
  cartridge: 'uniswap-v2',
  operation: 'uniswap-v2.completeSwap',
  
  steps: [
    { id: 'approve', label: 'Approve Token', description: 'Approve router to spend tokens' },
    { id: 'swap', label: 'Execute Swap', description: 'Execute swap on Uniswap V2' }
  ],

  stepMapping: {
    'checking_approval': { stepId: 'approve', status: 'running' },
    'approving': { stepId: 'approve', status: 'running' },
    'approved': { stepId: 'approve', status: 'completed' },
    'swapping': { stepId: 'swap', status: 'running' },
    'complete': { stepId: 'swap', status: 'completed' }
  },

  defaultParams: {
    tokenIn: '0xA0b86a33E6441de63d1e19E6e299dA3a7b8B9F98f',
    tokenOut: '0xB4c79dAB8f259C7Aee6E5b2Aa729821864227e84',
    amountIn: '1.0',
    slippageTolerance: '0.5'
  },

  parameterSchema: {
    tokenIn: { type: 'address', required: true, label: 'Input Token', placeholder: '0x...' },
    tokenOut: { type: 'address', required: true, label: 'Output Token', placeholder: '0x...' },
    amountIn: { type: 'string', required: true, label: 'Amount In', placeholder: '1.0' },
    slippageTolerance: { type: 'string', required: false, label: 'Slippage (%)', placeholder: '0.5', default: '0.5' }
  },

  validateParams: (params) => {
    const errors = {};
    if (!params.tokenIn?.match(/^0x[a-fA-F0-9]{40}$/)) errors.tokenIn = 'Invalid token address';
    if (!params.tokenOut?.match(/^0x[a-fA-F0-9]{40}$/)) errors.tokenOut = 'Invalid token address';
    if (params.tokenIn === params.tokenOut) errors.tokenOut = 'Tokens must be different';
    if (!params.amountIn || isNaN(Number(params.amountIn))) errors.amountIn = 'Invalid amount';
    return Object.keys(errors).length > 0 ? errors : null;
  }
};
```

### **Example 2: Adding Lending Protocol**

```javascript
// operations/LendingOperation.js
export const LendingOperation = {
  id: 'lending-supply',
  name: 'Supply to Lending Pool',
  description: 'Supply assets to earn interest',
  cartridge: 'lending',
  operation: 'lending.supply',
  
  steps: [
    { id: 'approve', label: 'Approve Asset', description: 'Approve lending pool to spend asset' },
    { id: 'supply', label: 'Supply Asset', description: 'Supply asset to lending pool' }
  ],

  stepMapping: {
    'checking_approval': { stepId: 'approve', status: 'running' },
    'approved': { stepId: 'approve', status: 'completed' },
    'supplying': { stepId: 'supply', status: 'running' },
    'complete': { stepId: 'supply', status: 'completed' }
  },

  defaultParams: {
    asset: '0xA0b86a33E6441de63d1e19E6e299dA3a7b8B9F98f',
    amount: '1000',
    onBehalfOf: '' // Will be set to user address
  },

  transformParams: (formParams, userAddress) => {
    return {
      asset: formParams.asset,
      amount: formParams.amount,
      onBehalfOf: userAddress // Automatically inject user address
    };
  }
};
```

---

## 🎯 **Summary: Why This Architecture Rocks**

### **Before (Monolithic)**
```javascript
// Everything in one big modal file
const FutarchyModal = ({ operation }) => {
  // 500+ lines of hardcoded step mappings
  const stepMapping = {
    completeMerge: { /* complex mapping */ },
    completeSplit: { /* complex mapping */ },
    cowSwap: { /* complex mapping */ },
    // ... more hardcoded mappings
  };
  
  // Hardcoded validation logic
  // Hardcoded form generation
  // Hardcoded success messages
  // ...
};
```

### **After (Modular)**
```javascript
// Clean separation
const GenericOperationModal = ({ operationId }) => {
  const loader = createLoader(operationId);  // Dynamic loading!
  
  // Everything else is generic:
  // - Form generation from schema
  // - Step mapping from config
  // - Validation from config
  // - Success messages from config
};

// Each operation in its own file:
// - FutarchyMergeOperation.js
// - CoWSwapOperation.js  
// - SwaprSwapOperation.js
// - YourCustomOperation.js
```

**Result**: 
- ✅ **One modal** handles all operations
- ✅ **Add operations** by creating one file  
- ✅ **No modal changes** needed for new operations
- ✅ **Clean, testable, maintainable** code
- ✅ **Type-safe** parameter handling
- ✅ **Automatic form generation** from schemas

**Perfect architecture for complex DeFi applications!** 🏛️🧩✨ 