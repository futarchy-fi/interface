# 🔗 WagmiExecutor - Complete Integration Guide

## 📋 Overview

The **WagmiExecutor** is a lightweight adapter that bridges the Futarchy SDK with your existing **wagmi** React application. Instead of creating its own wallet connections, it delegates all Web3 operations to your existing wagmi provider, ensuring no duplication and seamless integration.

## 🎯 What WagmiExecutor Does

### Core Purpose
- **Delegates Web3 operations** to your existing wagmi setup
- **Routes operations** to futarchy cartridges (FutarchyCartridge, CoWSwapCartridge, etc.)
- **Provides real-time status updates** during transaction execution
- **Maintains consistency** with your app's existing wallet state

### Key Architecture
```
Your React App (wagmi provider already set up)
       ↓
WagmiExecutor (thin adapter layer)
       ↓
Gets fresh wagmi clients on each operation:
  - getAccount(config)      ← Current wallet state
  - getPublicClient(config) ← Blockchain read operations  
  - getWalletClient(config) ← Transaction signing
       ↓
Passes to Cartridges (FutarchyCartridge, CoWSwapCartridge, etc.)
       ↓
Blockchain Operations
```

## 🔄 WagmiExecutor vs ViemExecutor

| Aspect | WagmiExecutor | ViemExecutor |
|--------|---------------|--------------|
| **Purpose** | Delegates to existing wagmi | Creates its own viem clients |
| **Wallet Management** | Uses your wagmi provider | Manages wallet connection itself |
| **Client Creation** | `getWalletClient(config)` | `createWalletClient()` |
| **State Sync** | Always fresh from wagmi | Manual connection management |
| **Best For** | React apps with wagmi | Standalone apps or non-React |
| **Dependencies** | Requires wagmi setup | Only needs viem |
| **Connection Flow** | Wagmi handles connection | Executor handles connection |

### Code Comparison

**WagmiExecutor (Delegates)**
```javascript
// Gets fresh clients from your existing wagmi setup
const account = getAccount(config);
const publicClient = getPublicClient(config);  
const walletClient = await getWalletClient(config);

// Passes to cartridge - no wallet management needed
const viemClients = {
  publicClient,
  walletClient, 
  account: account.address
};
```

**ViemExecutor (Creates Own)**
```javascript
// Creates and manages its own clients
this.walletClient = createWalletClient({
  account: this.account,
  chain: this.chain,
  transport: custom(window.ethereum)
});

this.publicClient = createPublicClient({
  chain: this.chain,
  transport: http(this.rpcUrl)
});
```

## 🚀 Integration Guide for Next.js

### Step 1: Setup Wagmi Provider (Your Existing Setup)

```typescript
// lib/wagmi.ts
import { createConfig } from 'wagmi';
import { gnosis, mainnet } from 'wagmi/chains';
import { http } from 'viem';
import { metaMask, walletConnect } from 'wagmi/connectors';

export const config = createConfig({
  chains: [gnosis, mainnet],
  connectors: [
    metaMask(),
    walletConnect({ projectId: 'your-project-id' })
  ],
  transports: {
    [gnosis.id]: http('https://rpc.gnosischain.com'),
    [mainnet.id]: http()
  }
});
```

```tsx
// components/Providers.tsx
'use client';

import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config } from '../lib/wagmi';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

### Step 2: Copy Futarchy SDK Files

```bash
# Copy the core files to your project
cp DataLayer.js src/lib/
cp -r executors/ src/lib/
```

### Step 3: Create DataLayer Hook

```tsx
// hooks/useFutarchyDataLayer.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { DataLayer } from '../lib/DataLayer.js';
import { createWagmiExecutor } from '../lib/executors/WagmiExecutor.js';
import { FutarchyCartridge } from '../lib/executors/FutarchyCartridge.js';
import { CoWSwapCartridge } from '../lib/executors/CoWSwapCartridge.js';

export const useFutarchyDataLayer = () => {
  const [dataLayer, setDataLayer] = useState<any>(null);
  const { isConnected } = useAccount();

  useEffect(() => {
    if (!dataLayer) {
      // Initialize DataLayer with WagmiExecutor
      const dl = new DataLayer();
      const executor = createWagmiExecutor();
      
      // Register cartridges - they'll use wagmi's clients
      executor.registerCartridge(new FutarchyCartridge('0x7495a583ba85875d59407781b4958ED6e0E1228f'));
      executor.registerCartridge(new CoWSwapCartridge());
      
      dl.registerExecutor(executor);
      setDataLayer(dl);
      
      console.log('🔗 DataLayer initialized with WagmiExecutor');
    }
  }, [dataLayer]);

  return { dataLayer, isConnected };
};
```

### Step 4: Create Your Component (Client-Side Only)

```tsx
// components/FutarchyOperations.tsx
'use client';

import { useState } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { useFutarchyDataLayer } from '../hooks/useFutarchyDataLayer';

export default function FutarchyOperations() {
  const { address, isConnected } = useAccount();
  const { connectors, connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { dataLayer } = useFutarchyDataLayer();
  
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const executeFutarchyOperation = async () => {
    if (!dataLayer || !isConnected) return;
    
    setIsExecuting(true);
    
    try {
      // Execute futarchy operation
      for await (const status of dataLayer.execute('futarchy.completeSplit', {
        proposal: '0xDA36a35CA4Fe6214C37a452159C0C9EAd45D5919',
        collateralToken: '0xaf204776c7245bF4147c2612BF6e5972Ee483701',
        amount: '100'
      })) {
        console.log('Status:', status);
        
        if (status.status === 'success') {
          setResult(status.data);
          break;
        }
      }
    } catch (error) {
      console.error('Operation failed:', error);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Futarchy Operations</h2>
      
      {/* Wallet Connection */}
      {isConnected ? (
        <div className="mb-4">
          <p>Connected: {address}</p>
          <button onClick={() => disconnect()}>Disconnect</button>
        </div>
      ) : (
        <div className="mb-4">
          {connectors.map((connector) => (
            <button
              key={connector.id}
              onClick={() => connect({ connector })}
              className="mr-2 px-4 py-2 bg-blue-500 text-white rounded"
            >
              Connect {connector.name}
            </button>
          ))}
        </div>
      )}

      {/* Execute Operation */}
      <button
        onClick={executeFutarchyOperation}
        disabled={!isConnected || isExecuting}
        className="px-6 py-3 bg-green-500 text-white rounded disabled:bg-gray-400"
      >
        {isExecuting ? 'Executing...' : 'Execute Futarchy Split'}
      </button>

      {/* Result */}
      {result && (
        <div className="mt-4 p-4 bg-green-50 rounded">
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
```

### Step 5: Use in Next.js Page (with SSR disabled)

```tsx
// app/page.tsx
'use client';

import dynamic from 'next/dynamic';

// Load component client-side only to prevent hydration issues
const FutarchyOperations = dynamic(
  () => import('../components/FutarchyOperations'),
  { 
    ssr: false,
    loading: () => <div>Loading Futarchy SDK...</div>
  }
);

export default function Home() {
  return (
    <main>
      <FutarchyOperations />
    </main>
  );
}
```

## 🔧 How WagmiExecutor Works Internally

### 1. Delegation Pattern
```javascript
class WagmiExecutor extends BaseExecutor {
  async* execute(dataPath, args = {}) {
    // Get fresh wagmi state (no caching, always current)
    const account = getAccount(config);
    const publicClient = getPublicClient(config);
    const walletClient = await getWalletClient(config);
    
    // Validate connection
    if (!account.isConnected) {
      yield { status: 'error', message: 'Wallet not connected' };
      return;
    }
    
    // Find and execute cartridge
    const cartridge = this.cartridges.get(dataPath);
    yield* cartridge.execute(dataPath, args, {
      publicClient,
      walletClient,
      account: account.address
    });
  }
}
```

### 2. Real-time State Sync
- **No State Storage**: WagmiExecutor doesn't store wallet state
- **Fresh on Each Call**: Gets current state from wagmi on every operation
- **Automatic Updates**: Reflects wallet changes immediately
- **Consistent Behavior**: Always matches your React app's wagmi state

### 3. Cartridge Interface Compatibility
```javascript
// Same interface as ViemExecutor - cartridges work unchanged
const viemClients = {
  publicClient: getPublicClient(config),    // For reading blockchain
  walletClient: await getWalletClient(config), // For transactions
  account: account.address                   // Current address
};

// Cartridges receive identical interface
yield* cartridge.execute(dataPath, args, viemClients);
```

## 🎯 Available Operations

### Futarchy Operations
```javascript
dataLayer.execute('futarchy.completeSplit', {
  proposal: '0x...',
  collateralToken: '0x...', // sDAI address
  amount: '100'
});

dataLayer.execute('futarchy.completeMerge', {
  proposal: '0x...',
  collateralToken: '0x...',
  amount: '50'
});
```

### CoW Protocol Operations
```javascript
dataLayer.execute('cowswap.completeSwap', {
  sellToken: '0x...', // sDAI
  buyToken: '0x...',  // wxDAI  
  amount: '1.5'
});
```

### Swapr Operations
```javascript
dataLayer.execute('swapr.completeSwap', {
  tokenIn: '0x...',
  tokenOut: '0x...',
  amount: '1.0'
});
```

## 🛠️ Key Benefits

### 1. **Zero Duplication**
- Uses your existing wagmi provider
- No additional wallet connections
- Consistent state across your app

### 2. **Minimal Integration**
- Just import and use hooks
- No changes to existing wagmi setup
- Gradual adoption possible

### 3. **Real-time Updates**
- Always uses current wagmi state
- Reflects network/account changes instantly
- No manual synchronization needed

### 4. **Production Ready**
- Handles errors gracefully
- Provides detailed status updates
- Works with all wagmi connectors

## 🚨 Common Issues & Solutions

### Issue: "Module not found: Can't resolve '../wagmi'"
**Solution**: Ensure correct import path in WagmiExecutor.js
```javascript
// ✅ Correct
import { config } from '../wagmi';

// ❌ Wrong  
import { config } from '../wagmi.ts';
```

### Issue: Hydration errors in Next.js
**Solution**: Use dynamic imports with SSR disabled
```javascript
const Component = dynamic(() => import('./MyComponent'), { ssr: false });
```

### Issue: "getWalletClient is not a function"
**Solution**: Ensure you're using compatible wagmi version and passing config
```javascript
// ✅ Correct
const walletClient = await getWalletClient(config);

// ❌ Wrong
const walletClient = getWalletClient();
```

## 📝 TypeScript Support

```typescript
// types/futarchy.ts
export interface FutarchyResult {
  transactionHash: string;
  blockNumber: bigint;
  gasUsed: bigint;
}

export interface SplitParams {
  proposal: string;
  collateralToken: string;
  amount: string;
}

// Usage with types
const result: FutarchyResult = await dataLayer.execute('futarchy.completeSplit', params);
```

## 🔍 Debugging Tips

### Enable Debug Logs
```javascript
// WagmiExecutor includes debug logs
console.log('🔍 WagmiExecutor - Account state:', { 
  isConnected: account.isConnected, 
  address: account.address,
  chainId: account.chainId 
});
```

### Monitor Operations
```javascript
for await (const status of dataLayer.execute(operation, params)) {
  console.log(`[${new Date().toISOString()}] ${status.step}: ${status.message}`);
  
  if (status.data?.transactionHash) {
    console.log(`Transaction: https://gnosisscan.io/tx/${status.data.transactionHash}`);
  }
}
```

## 🎉 Summary

The **WagmiExecutor** is the perfect bridge between your existing wagmi React application and the Futarchy SDK. It:

- ✅ **Reuses your wagmi setup** - No duplicate connections
- ✅ **Provides real-time updates** - Live transaction status  
- ✅ **Works with all cartridges** - Same interface as ViemExecutor
- ✅ **Handles complex operations** - Multi-step futarchy transactions
- ✅ **Integrates seamlessly** - Minimal code changes required

Start building futarchy applications with your existing wagmi setup today! 🏛️⚛️✨ 