# 🚀 React Integration Guide - Futarchy SDK

This guide shows you **exactly** how to integrate the Futarchy SDK DataLayer and cartridge system into React applications with clean, simple patterns.

## 📋 Quick Overview

The React integration follows this simple pattern:

```
React App → useDataLayer hook → DataLayer → Cartridges → Blockchain
```

## 🎯 Three Integration Approaches

### 1. **Hook-Based (Recommended)** 🪝
- Clean separation of concerns
- Reusable logic
- React best practices

### 2. **Modal-Based** 📱
- Full-featured UI components
- Step-by-step visualization
- Production-ready styling

### 3. **Context-Based** 🌍
- App-wide DataLayer sharing
- Global state management
- Enterprise patterns

---

## 🪝 1. Hook-Based Integration (Simple & Clean)

### Basic Setup

```jsx
import { useDataLayer, useOperation } from './React-Hook-Usage.jsx';

const MyFutarchyComponent = () => {
  const { dataLayer, isInitialized } = useDataLayer();
  const { 
    steps, 
    isExecuting, 
    result, 
    error, 
    executeOperation,
    initializeSteps 
  } = useOperation();

  const handleMerge = async () => {
    // 1. Initialize steps
    initializeSteps([
      { id: 'approve_yes', label: 'Approve YES Tokens' },
      { id: 'approve_no', label: 'Approve NO Tokens' },
      { id: 'merge', label: 'Merge Positions' }
    ]);

    // 2. Execute operation
    await executeOperation(
      dataLayer,
      'futarchy.completeMerge',
      {
        proposal: '0xDA36a35CA4Fe6214C37a452159C0C9EAd45D5919',
        collateralToken: '0xaf204776c7245bF4147c2612BF6e5972Ee483701',
        amount: '100'
      },
      {
        // Map cartridge steps to UI steps
        'check_yes_approval': { stepId: 'approve_yes', status: 'running' },
        'yes_approved': { stepId: 'approve_yes', status: 'completed' },
        'check_no_approval': { stepId: 'approve_no', status: 'running' },
        'no_approved': { stepId: 'approve_no', status: 'completed' },
        'merging': { stepId: 'merge', status: 'running' },
        'complete': { stepId: 'merge', status: 'completed' }
      }
    );
  };

  return (
    <div>
      {/* Real-time step updates */}
      {steps.map(step => (
        <div key={step.id}>
          {step.status === 'completed' ? '✅' : '⭕'} {step.label}
        </div>
      ))}
      
      <button onClick={handleMerge} disabled={isExecuting}>
        {isExecuting ? 'Executing...' : 'Start Merge'}
      </button>
      
      {result && <div>✅ Success: {result.transactionHash}</div>}
      {error && <div>❌ Error: {error}</div>}
    </div>
  );
};
```

### Hook Benefits
- ✅ **Simple** - Just import and use
- ✅ **Reusable** - Works across components
- ✅ **Real-time** - Automatic step updates from cartridge yields
- ✅ **Type-safe** - Clear operation mapping

---

## 📱 2. Modal-Based Integration (Full UI)

Use the complete modal component for production-ready interfaces:

```jsx
import { FutarchyModal } from './React-FutarchyModal.jsx';

const MyApp = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [operation, setOperation] = useState('completeMerge');

  return (
    <div>
      <button onClick={() => setModalOpen(true)}>
        Open Futarchy Operation
      </button>
      
      <FutarchyModal 
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        operation={operation} // 'completeMerge', 'completeSplit', etc.
      />
    </div>
  );
};
```

### Modal Features
- ✅ **Complete UI** - Professional styling and UX
- ✅ **Step visualization** - Real-time progress with checkboxes
- ✅ **Error handling** - User-friendly error messages
- ✅ **Transaction links** - Direct links to Gnosis Scan
- ✅ **Auto-approval** - Handles all approval steps automatically

---

## 🌍 3. Context-Based Integration (App-Wide)

For apps that need DataLayer access across multiple components:

```jsx
// DataLayerContext.jsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { DataLayer } from '../DataLayer.js';
import { createViemExecutor } from '../executors/ViemExecutor.js';
import { FutarchyCartridge } from '../executors/FutarchyCartridge.js';
import { CoWSwapCartridge } from '../executors/CoWSwapCartridge.js';

const DataLayerContext = createContext();

export const DataLayerProvider = ({ children }) => {
  const [dataLayer, setDataLayer] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initDataLayer = async () => {
      const dl = new DataLayer();
      const executor = createViemExecutor({ 
        rpcUrl: 'https://rpc.gnosischain.com' 
      });
      
      // Register all cartridges
      executor.registerCartridge(new FutarchyCartridge('0x7495a583ba85875d59407781b4958ED6e0E1228f'));
      executor.registerCartridge(new CoWSwapCartridge());
      
      dl.registerExecutor(executor);
      setDataLayer(dl);
      setIsInitialized(true);
    };

    initDataLayer();
  }, []);

  return (
    <DataLayerContext.Provider value={{ dataLayer, isInitialized }}>
      {children}
    </DataLayerContext.Provider>
  );
};

export const useDataLayerContext = () => {
  const context = useContext(DataLayerContext);
  if (!context) {
    throw new Error('useDataLayerContext must be used within DataLayerProvider');
  }
  return context;
};

// Usage in App.jsx
function App() {
  return (
    <DataLayerProvider>
      <YourFutarchyComponents />
    </DataLayerProvider>
  );
}

// Usage in any component
const SomeComponent = () => {
  const { dataLayer } = useDataLayerContext();
  
  const handleSwap = async () => {
    for await (const status of dataLayer.execute('cowswap.completeSwap', params)) {
      console.log(status.message);
    }
  };
  
  return <button onClick={handleSwap}>CoW Swap</button>;
};
```

---

## 🎯 Real-World Examples

### Example 1: Simple Approval Check

```jsx
const ApprovalChecker = ({ tokenAddress, spenderAddress }) => {
  const { dataLayer } = useDataLayer();
  const [isApproved, setIsApproved] = useState(false);
  const [loading, setLoading] = useState(false);

  const checkApproval = async () => {
    setLoading(true);
    try {
      for await (const status of dataLayer.execute('futarchy.checkApproval', {
        collateralToken: tokenAddress
      })) {
        if (status.status === 'success') {
          setIsApproved(status.data.isApproved);
          break;
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (dataLayer) checkApproval();
  }, [dataLayer, tokenAddress]);

  return (
    <div>
      {loading ? '⏳' : isApproved ? '✅ Approved' : '❌ Not Approved'}
    </div>
  );
};
```

### Example 2: CoW Swap with Order Tracking

```jsx
const CowSwapComponent = () => {
  const { dataLayer } = useDataLayer();
  const [orderId, setOrderId] = useState(null);
  const [orderStatus, setOrderStatus] = useState('idle');

  const handleSwap = async () => {
    setOrderStatus('executing');
    
    try {
      for await (const status of dataLayer.execute('cowswap.completeSwap', {
        sellToken: '0xaf204776c7245bF4147c2612BF6e5972Ee483701', // sDAI
        buyToken: '0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d',  // wxDAI
        amount: '1'
      })) {
        if (status.status === 'success') {
          setOrderId(status.data.orderId);
          setOrderStatus('completed');
          break;
        }
      }
    } catch (error) {
      setOrderStatus('error');
    }
  };

  return (
    <div>
      <button 
        onClick={handleSwap} 
        disabled={orderStatus === 'executing'}
      >
        {orderStatus === 'executing' ? 'Creating Order...' : 'CoW Swap'}
      </button>
      
      {orderId && (
        <div>
          ✅ Order created: 
          <a 
            href={`https://explorer.cow.fi/orders/${orderId}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Track on CoW Explorer →
          </a>
        </div>
      )}
    </div>
  );
};
```

### Example 3: Multi-Step Futarchy Operation

```jsx
const FutarchyMergeForm = () => {
  const { dataLayer } = useDataLayer();
  const { steps, isExecuting, executeOperation, initializeSteps } = useOperation();
  
  const [formData, setFormData] = useState({
    proposal: '0xDA36a35CA4Fe6214C37a452159C0C9EAd45D5919',
    collateralToken: '0xaf204776c7245bF4147c2612BF6e5972Ee483701',
    amount: '100'
  });

  const stepConfig = [
    { id: 'approve_yes', label: 'Approve YES Tokens' },
    { id: 'approve_no', label: 'Approve NO Tokens' },
    { id: 'merge', label: 'Merge Positions' }
  ];

  const stepMapping = {
    'check_yes_approval': { stepId: 'approve_yes', status: 'running' },
    'yes_approved': { stepId: 'approve_yes', status: 'completed' },
    'check_no_approval': { stepId: 'approve_no', status: 'running' },
    'no_approved': { stepId: 'approve_no', status: 'completed' },
    'merging': { stepId: 'merge', status: 'running' },
    'complete': { stepId: 'merge', status: 'completed' }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    initializeSteps(stepConfig);
    await executeOperation(
      dataLayer, 
      'futarchy.completeMerge', 
      formData, 
      stepMapping
    );
  };

  return (
    <form onSubmit={handleSubmit}>
      <input 
        value={formData.amount}
        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
        placeholder="Amount to merge"
      />
      
      {/* Real-time step display */}
      {steps.map(step => (
        <div key={step.id} style={{
          display: 'flex',
          alignItems: 'center',
          margin: '8px 0',
          padding: '8px',
          backgroundColor: step.status === 'completed' ? '#e8f5e8' : '#f9f9f9'
        }}>
          <span style={{ marginRight: '8px' }}>
            {step.status === 'completed' ? '✅' : 
             step.status === 'running' ? '⏳' : '⭕'}
          </span>
          {step.label}
          {step.status === 'running' && (
            <span style={{ marginLeft: '8px', color: '#2196F3' }}>
              Processing...
            </span>
          )}
        </div>
      ))}
      
      <button type="submit" disabled={isExecuting}>
        {isExecuting ? 'Executing Merge...' : 'Start Merge'}
      </button>
    </form>
  );
};
```

---

## 🔧 Installation & Setup

### 1. Install Dependencies

```bash
npm install react react-dom
# SDK dependencies already included in package.json
```

### 2. Copy React Files

```bash
# Copy the React integration files to your project
cp examples/React-Hook-Usage.jsx src/hooks/
cp examples/React-FutarchyModal.jsx src/components/
```

### 3. Import in Your App

```jsx
// App.jsx
import { SimpleFutarchyMerge, MultiOperationDemo } from './hooks/React-Hook-Usage.jsx';
import { FutarchyModal } from './components/React-FutarchyModal.jsx';

function App() {
  return (
    <div className="App">
      <h1>Futarchy Operations</h1>
      <SimpleFutarchyMerge />
      <MultiOperationDemo />
    </div>
  );
}

export default App;
```

---

## 🎯 Available Operations

All cartridge operations are available through the React hooks:

### Futarchy Operations
```jsx
dataLayer.execute('futarchy.completeMerge', params)
dataLayer.execute('futarchy.completeSplit', params)
dataLayer.execute('futarchy.checkApproval', params)
dataLayer.execute('futarchy.approveCollateral', params)
```

### CoW Swap Operations
```jsx
dataLayer.execute('cowswap.completeSwap', params)
dataLayer.execute('cowswap.checkApproval', params)
dataLayer.execute('cowswap.approve', params)
```

### Swapr Operations
```jsx
dataLayer.execute('swapr.completeSwap', params)
dataLayer.execute('swapr.checkApproval', params)
dataLayer.execute('swapr.approve', params)
```

---

## 📋 Step Status Mapping

The cartridges emit specific step names that you map to your UI:

### Futarchy Merge Steps
```jsx
const stepMapping = {
  'check_yes_approval': { stepId: 'approve_yes', status: 'running' },
  'approving_yes': { stepId: 'approve_yes', status: 'running' },
  'yes_approved': { stepId: 'approve_yes', status: 'completed' },
  'check_no_approval': { stepId: 'approve_no', status: 'running' },
  'approving_no': { stepId: 'approve_no', status: 'running' },
  'no_approved': { stepId: 'approve_no', status: 'completed' },
  'merging': { stepId: 'merge', status: 'running' },
  'complete': { stepId: 'merge', status: 'completed' }
};
```

### CoW Swap Steps
```jsx
const stepMapping = {
  'check_approval': { stepId: 'approve_token', status: 'running' },
  'approving': { stepId: 'approve_token', status: 'running' },
  'approved': { stepId: 'approve_token', status: 'completed' },
  'swapping': { stepId: 'create_order', status: 'running' },
  'complete': { stepId: 'create_order', status: 'completed' }
};
```

---

## 🎨 Styling Tips

### Status Colors
```jsx
const getStepColor = (status) => {
  switch (status) {
    case 'completed': return '#4CAF50';  // Green
    case 'running': return '#2196F3';    // Blue
    case 'error': return '#f44336';      // Red
    default: return '#9E9E9E';           // Gray
  }
};
```

### Icons
```jsx
const getStepIcon = (status) => {
  switch (status) {
    case 'completed': return '✅';
    case 'running': return '⏳';
    case 'error': return '❌';
    default: return '⭕';
  }
};
```

---

## 🚀 Next Steps

1. **Start Simple**: Use the hook-based approach for basic operations
2. **Add UI**: Implement the modal-based pattern for better UX
3. **Scale Up**: Use context-based pattern for larger apps
4. **Customize**: Create your own cartridges for custom operations

The React integration makes it incredibly easy to build futarchy applications with real-time step updates, automatic approval handling, and clean separation of concerns! 🏛️⚛️✨ 