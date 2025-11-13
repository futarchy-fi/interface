# 🔗 Using Futarchy SDK with Existing Wagmi Setup

This guide shows how to integrate the Futarchy SDK with your **existing** React + wagmi project without reinventing the wheel.

> 📖 **Need more details?** Check out the [Complete WagmiExecutor Guide](./WagmiExecutor-Guide.md) for comprehensive documentation, architecture details, and advanced examples.

## ✨ What You Get

- ✅ **Zero Duplication** - Uses your existing wagmi providers
- ✅ **Minimal Code** - Lightweight executor that delegates to wagmi  
- ✅ **Same Cartridges** - Works with all existing cartridges
- ✅ **Fresh Clients** - Gets wagmi clients on each operation
- ✅ **Simple Integration** - Just add hooks to existing components

## 🚀 Quick Integration

### Step 1: Add the Hook to Your Existing Component

```jsx
// Your existing React component  
import { useWagmiDataLayer, useOperation } from '../hooks/useWagmiDataLayer'; // or your path

function YourExistingComponent() {
  const { dataLayer } = useWagmiDataLayer(); // Uses your wagmi setup
  const { executeOperation, initializeSteps } = useOperation();
  
  const handleFutarchyMerge = async () => {
    // Define the steps you want to show
    initializeSteps([
      { id: 'approve_yes', label: 'Approve YES Tokens' },
      { id: 'approve_no', label: 'Approve NO Tokens' },
      { id: 'merge', label: 'Merge Positions' }
    ]);
    
    // Execute the operation
    await executeOperation(
      dataLayer, 
      'futarchy.completeMerge',
      {
        proposal: '0xDA36a35CA4Fe6214C37a452159C0C9EAd45D5919',
        collateralToken: '0xaf204776c7245bF4147c2612BF6e5972Ee483701',
        amount: '100'
      },
      {
        // Map cartridge steps to your UI steps
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
    <button onClick={handleFutarchyMerge}>
      Merge Futarchy Positions
    </button>
  );
}
```

### Step 2: That's It!

No changes to your wagmi config, no new providers, no duplicate connections. The `WagmiExecutor` will:

1. Use `getAccount()`, `getPublicClient()`, `getWalletClient()` from your existing wagmi
2. Pass those clients to the cartridges  
3. Return real-time status updates

## 🎯 Available Operations

### Futarchy Operations
```jsx
await executeOperation(dataLayer, 'futarchy.completeMerge', {...});
await executeOperation(dataLayer, 'futarchy.completeSplit', {...});
await executeOperation(dataLayer, 'futarchy.checkApproval', {...});
```

### CoW Protocol Operations  
```jsx
await executeOperation(dataLayer, 'cowswap.completeSwap', {
  sellToken: '0xaf204776c7245bF4147c2612BF6e5972Ee483701', // sDAI
  buyToken: '0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d',  // wxDAI
  amount: '1.5'
});
```

### Swapr Operations
```jsx
await executeOperation(dataLayer, 'swapr.completeSwap', {
  tokenIn: '0xaf204776c7245bF4147c2612BF6e5972Ee483701',
  tokenOut: '0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d', 
  amount: '1.0'
});
```

## 📋 Step Mapping Examples

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

## 🛠️ How It Works

```
Your React App (already has wagmi)
       ↓
useWagmiDataLayer() hook
       ↓  
WagmiExecutor (just gets wagmi clients)
       ↓
Existing Cartridges (FutarchyCartridge, CoWSwapCartridge, etc.)
       ↓
Your wagmi provider's viem clients
       ↓
Blockchain
```

The `WagmiExecutor` is just a thin layer that:
1. Gets `publicClient` and `walletClient` from your existing wagmi setup
2. Passes them to cartridges using the same interface as `ViemExecutor`
3. Routes operations to the right cartridge
4. Returns status updates in real-time

## 🎨 Adding UI Feedback

```jsx
function YourComponentWithUI() {
  const { dataLayer } = useWagmiDataLayer();
  const { 
    steps, 
    isExecuting, 
    result, 
    error, 
    executeOperation, 
    initializeSteps 
  } = useOperation();

  const handleOperation = async () => {
    initializeSteps([
      { id: 'step1', label: 'First Step' },
      { id: 'step2', label: 'Second Step' }
    ]);
    
    await executeOperation(dataLayer, 'futarchy.completeMerge', params, mapping);
  };

  return (
    <div>
      {/* Show steps */}
      {steps.map(step => (
        <div key={step.id}>
          {step.status === 'completed' ? '✅' : '⭕'} {step.label}
        </div>
      ))}
      
      {/* Show errors */}
      {error && <div style={{ color: 'red' }}>Error: {error}</div>}
      
      {/* Show success */}
      {result && <div style={{ color: 'green' }}>Success!</div>}
      
      {/* Action button */}
      <button onClick={handleOperation} disabled={isExecuting}>
        {isExecuting ? 'Processing...' : 'Start Operation'}
      </button>
    </div>
  );
}
```

## 🔧 Installation

Just copy these files to your project:

```bash
# Core executor
cp executors/WagmiExecutor.js src/lib/

# React integration  
cp examples/React-WagmiIntegration.jsx src/hooks/

# Cartridges (if you don't have them)
cp executors/FutarchyCartridge.js src/lib/
cp executors/CoWSwapCartridge.js src/lib/
cp executors/SwaprAlgebraCartridge.js src/lib/
```

Then import and use in your existing components!

## 🚨 Next.js Important Note

For **Next.js applications**, make sure to load components that use WagmiExecutor **client-side only** to prevent hydration errors:

```tsx
// Use dynamic import with ssr: false
import dynamic from 'next/dynamic';

const MyFutarchyComponent = dynamic(
  () => import('../components/MyFutarchyComponent'),
  { ssr: false, loading: () => <div>Loading...</div> }
);
```

This prevents wallet state mismatches between server and client rendering.

## 💡 Tips

1. **Chain Switching**: Use wagmi's `useSwitchNetwork` hook - the executor will automatically use the new network
2. **Account Changes**: The executor gets fresh account info on each operation
3. **Error Handling**: All cartridge errors bubble up through the `error` state
4. **Real-time Updates**: Status updates happen in real-time as cartridges yield progress

That's it! Your existing wagmi setup now has futarchy superpowers! 🏛️✨

## 🎮 Live Example

Check out the complete working example in `wagmi-futarchy-test/` directory - a Next.js app that demonstrates:
- ✅ WagmiExecutor integration with existing wagmi setup
- ✅ Real-time futarchy split operations with live logs
- ✅ Step-by-step UI updates during transactions
- ✅ Proper SSR handling for Web3 components

Run it with:
```bash
cd wagmi-futarchy-test
npm run dev
``` 