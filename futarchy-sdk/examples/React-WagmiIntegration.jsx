import React, { useState, useEffect, createContext, useContext } from 'react';
import { 
    WagmiConfig, 
    createConfig, 
    useAccount, 
    useConnect, 
    useDisconnect,
    useNetwork,
    useSwitchNetwork
} from 'wagmi';
import { 
    getDefaultWallets,
    RainbowKitProvider,
    connectorsForWallets
} from '@rainbow-me/rainbowkit';
import { configureChains, createClient } from 'wagmi';
import { gnosis, mainnet } from 'wagmi/chains';
import { publicProvider } from 'wagmi/providers/public';

import { DataLayer } from '../DataLayer.js';
import { createWagmiExecutor } from '../executors/WagmiExecutor.js';
import { FutarchyCartridge } from '../executors/FutarchyCartridge.js';
import { CoWSwapCartridge } from '../executors/CoWSwapCartridge.js';
import { SwaprAlgebraCartridge } from '../executors/SwaprAlgebraCartridge.js';

// =============================================================================
// WAGMI CONFIGURATION (Your existing setup)
// =============================================================================

const { chains, publicClient, webSocketPublicClient } = configureChains(
  [gnosis, mainnet],
  [publicProvider()]
);

const { connectors } = getDefaultWallets({
  appName: 'Futarchy SDK Demo',
  projectId: 'your-project-id', // Replace with your WalletConnect project ID
  chains,
});

const wagmiConfig = createConfig({
  autoConnect: true,
  connectors,
  publicClient,
  webSocketPublicClient,
});

// =============================================================================
// SIMPLE WAGMI DATA LAYER HOOK
// =============================================================================

export const useWagmiDataLayer = () => {
  const [dataLayer, setDataLayer] = useState(null);
  const { isConnected } = useAccount();

  useEffect(() => {
    // Initialize once
    if (!dataLayer) {
      const dl = new DataLayer();
      const executor = createWagmiExecutor();
      
      // Register all cartridges - they'll use wagmi's clients
      executor.registerCartridge(new FutarchyCartridge('0x7495a583ba85875d59407781b4958ED6e0E1228f'));
      executor.registerCartridge(new CoWSwapCartridge());
      executor.registerCartridge(new SwaprAlgebraCartridge());
      
      dl.registerExecutor(executor);
      setDataLayer(dl);
      
      console.log('🔗 DataLayer initialized with WagmiExecutor');
    }
  }, [dataLayer]);

  return { dataLayer, isConnected };
};

// =============================================================================
// SIMPLE OPERATION HOOK
// =============================================================================

export const useOperation = () => {
  const [steps, setSteps] = useState([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const { isConnected } = useAccount();

  const updateStep = (stepId, status, data = null) => {
    setSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, status, data } : step
    ));
  };

  const initializeSteps = (stepConfig) => {
    setSteps(stepConfig.map(step => ({ ...step, status: 'pending' })));
    setResult(null);
    setError(null);
  };

  const executeOperation = async (dataLayer, operation, params, stepMapping) => {
    if (!dataLayer || isExecuting) return;

    if (!isConnected) {
      setError('Please connect your wallet first');
      return;
    }

    setIsExecuting(true);
    setError(null);

    try {
      for await (const status of dataLayer.execute(operation, params)) {
        // Apply step mapping if provided
        if (stepMapping && stepMapping[status.step]) {
          const { stepId, status: stepStatus } = stepMapping[status.step];
          updateStep(stepId, stepStatus, status.data);
        }

        if (status.status === 'success') {
          setResult(status.data);
          break;
        }

        if (status.status === 'error') {
          setError(status.message || 'Operation failed');
          break;
        }
      }
    } catch (err) {
      setError(err.message || 'Operation failed');
    } finally {
      setIsExecuting(false);
    }
  };

  return {
    steps,
    isExecuting,
    result,
    error,
    initializeSteps,
    executeOperation,
    updateStep
  };
};

// =============================================================================
// WALLET CONNECTION COMPONENT
// =============================================================================

const WalletConnection = () => {
  const { address, isConnected } = useAccount();
  const { connect, connectors, error, isLoading, pendingConnector } = useConnect();
  const { disconnect } = useDisconnect();
  const { chain } = useNetwork();
  const { switchNetwork, isLoading: isSwitchingNetwork } = useSwitchNetwork();

  if (isConnected) {
    return (
      <div style={{ 
        padding: '16px', 
        backgroundColor: '#e8f5e8', 
        borderRadius: '8px',
        marginBottom: '16px'
      }}>
        <div style={{ fontWeight: '500', marginBottom: '8px' }}>
          ✅ Connected to {address?.slice(0, 6)}...{address?.slice(-4)}
        </div>
        <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
          Network: {chain?.name} (ID: {chain?.id})
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={() => disconnect()}
            style={{ 
              padding: '8px 16px', 
              backgroundColor: '#f44336', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px' 
            }}
          >
            Disconnect
          </button>
          {chain?.id !== 100 && (
            <button 
              onClick={() => switchNetwork?.(100)}
              disabled={isSwitchingNetwork}
              style={{ 
                padding: '8px 16px', 
                backgroundColor: '#2196F3', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px' 
              }}
            >
              {isSwitchingNetwork ? 'Switching...' : 'Switch to Gnosis'}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      padding: '16px', 
      backgroundColor: '#fff3e0', 
      borderRadius: '8px',
      marginBottom: '16px'
    }}>
      <div style={{ fontWeight: '500', marginBottom: '12px' }}>
        Connect your wallet to get started
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {connectors.map((connector) => (
          <button
            disabled={!connector.ready}
            key={connector.id}
            onClick={() => connect({ connector })}
            style={{
              padding: '12px 16px',
              backgroundColor: connector.ready ? '#4CAF50' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: connector.ready ? 'pointer' : 'not-allowed'
            }}
          >
            {connector.name}
            {!connector.ready && ' (unsupported)'}
            {isLoading &&
              connector.id === pendingConnector?.id &&
              ' (connecting)'}
          </button>
        ))}
      </div>
      {error && (
        <div style={{ color: '#f44336', marginTop: '8px' }}>
          {error.message}
        </div>
      )}
    </div>
  );
};

// =============================================================================
// FUTARCHY MERGE COMPONENT
// =============================================================================

const FutarchyMergeWithWagmi = () => {
  const { dataLayer, isConnected } = useWagmiDataLayer();
  const { 
    steps, 
    isExecuting, 
    result, 
    error, 
    initializeSteps, 
    executeOperation 
  } = useOperation();

  const stepConfig = [
    { id: 'approve_yes', label: 'Approve YES Tokens' },
    { id: 'approve_no', label: 'Approve NO Tokens' },
    { id: 'merge', label: 'Merge Positions' }
  ];

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

  const handleMerge = async () => {
    if (!dataLayer) return;

    initializeSteps(stepConfig);
    await executeOperation(
      dataLayer,
      'futarchy.completeMerge',
      {
        proposal: '0xDA36a35CA4Fe6214C37a452159C0C9EAd45D5919',
        collateralToken: '0xaf204776c7245bF4147c2612BF6e5972Ee483701',
        amount: '100'
      },
      stepMapping
    );
  };

  const getStepIcon = (status) => {
    switch (status) {
      case 'completed': return '✅';
      case 'running': return '⏳';
      case 'error': return '❌';
      default: return '⭕';
    }
  };

  return (
    <div style={{ 
      maxWidth: '500px', 
      margin: '20px auto', 
      padding: '20px',
      border: '1px solid #ddd',
      borderRadius: '8px'
    }}>
      <h2>Futarchy Merge with Wagmi</h2>
      
      <WalletConnection />

      {/* Steps Display */}
      {steps.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <h3>Progress:</h3>
          {steps.map((step, index) => (
            <div key={step.id} style={{
              display: 'flex',
              alignItems: 'center',
              padding: '12px',
              margin: '8px 0',
              backgroundColor: '#f9f9f9',
              borderRadius: '8px',
              borderLeft: `4px solid ${
                step.status === 'completed' ? '#4CAF50' :
                step.status === 'running' ? '#2196F3' :
                step.status === 'error' ? '#f44336' : '#9E9E9E'
              }`
            }}>
              <span style={{ fontSize: '20px', marginRight: '12px' }}>
                {getStepIcon(step.status)}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '500' }}>{step.label}</div>
                {step.status === 'running' && (
                  <div style={{ color: '#2196F3', fontSize: '14px' }}>Processing...</div>
                )}
                {step.data?.transactionHash && (
                  <a 
                    href={`https://gnosisscan.io/tx/${step.data.transactionHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#2196F3', fontSize: '14px', textDecoration: 'none' }}
                  >
                    View Transaction →
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div style={{ 
          padding: '12px', 
          backgroundColor: '#ffebee', 
          color: '#c62828', 
          borderRadius: '8px',
          marginBottom: '16px'
        }}>
          Error: {error}
        </div>
      )}

      {/* Success Display */}
      {result && (
        <div style={{ 
          padding: '12px', 
          backgroundColor: '#e8f5e8', 
          color: '#2e7d32', 
          borderRadius: '8px',
          marginBottom: '16px'
        }}>
          ✅ Merge completed successfully!
          {result.transactionHash && (
            <div>
              <a 
                href={`https://gnosisscan.io/tx/${result.transactionHash}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#2e7d32' }}
              >
                View Final Transaction →
              </a>
            </div>
          )}
        </div>
      )}

      {/* Action Button */}
      <button
        onClick={handleMerge}
        disabled={isExecuting || !isConnected}
        style={{
          width: '100%',
          padding: '16px',
          backgroundColor: 
            !isConnected ? '#ffa726' :
            isExecuting ? '#ccc' : '#4CAF50',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '16px',
          fontWeight: '500',
          cursor: (!isConnected || isExecuting) ? 'not-allowed' : 'pointer'
        }}
      >
        {!isConnected ? 'Connect Wallet First' :
         isExecuting ? 'Executing Merge...' : 'Start Merge Operation'}
      </button>
    </div>
  );
};

// =============================================================================
// COW SWAP COMPONENT
// =============================================================================

const CoWSwapWithWagmi = () => {
  const { dataLayer, isConnected } = useWagmiDataLayer();
  const { 
    steps, 
    isExecuting, 
    result, 
    error, 
    initializeSteps, 
    executeOperation 
  } = useOperation();

  const [amount, setAmount] = useState('1');

  const stepConfig = [
    { id: 'approve_token', label: 'Approve Token for CoW' },
    { id: 'create_order', label: 'Create CoW Order' }
  ];

  const stepMapping = {
    'check_approval': { stepId: 'approve_token', status: 'running' },
    'approving': { stepId: 'approve_token', status: 'running' },
    'approved': { stepId: 'approve_token', status: 'completed' },
    'swapping': { stepId: 'create_order', status: 'running' },
    'complete': { stepId: 'create_order', status: 'completed' }
  };

  const handleSwap = async () => {
    if (!dataLayer || !amount) return;

    initializeSteps(stepConfig);
    await executeOperation(
      dataLayer,
      'cowswap.completeSwap',
      {
        sellToken: '0xaf204776c7245bF4147c2612BF6e5972Ee483701', // sDAI
        buyToken: '0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d',  // wxDAI
        amount: amount
      },
      stepMapping
    );
  };

  return (
    <div style={{ 
      maxWidth: '500px', 
      margin: '20px auto', 
      padding: '20px',
      border: '1px solid #ddd',
      borderRadius: '8px'
    }}>
      <h2>CoW Swap with Wagmi</h2>
      
      <WalletConnection />

      {/* Amount Input */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
          Amount to Swap (sDAI → wxDAI)
        </label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Enter amount"
          style={{
            width: '100%',
            padding: '12px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '16px'
          }}
        />
      </div>

      <button
        onClick={handleSwap}
        disabled={isExecuting || !isConnected || !amount}
        style={{
          width: '100%',
          padding: '16px',
          backgroundColor: 
            !isConnected ? '#ffa726' :
            !amount ? '#ffa726' :
            isExecuting ? '#ccc' : '#2196F3',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '16px',
          fontWeight: '500',
          cursor: (!isConnected || isExecuting || !amount) ? 'not-allowed' : 'pointer'
        }}
      >
        {!isConnected ? 'Connect Wallet First' :
         !amount ? 'Enter Amount' :
         isExecuting ? 'Creating CoW Order...' : 'Start CoW Swap'}
      </button>
    </div>
  );
};

// =============================================================================
// MAIN APP COMPONENT
// =============================================================================

const WagmiIntegrationDemo = () => {
  return (
    <WagmiConfig config={wagmiConfig}>
      <RainbowKitProvider chains={chains}>
        <div style={{ 
          maxWidth: '1200px', 
          margin: '0 auto', 
          padding: '20px',
          fontFamily: 'Arial, sans-serif'
        }}>
          <h1 style={{ textAlign: 'center', marginBottom: '40px' }}>
            🏛️ Futarchy SDK + Wagmi Integration
          </h1>
          
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', 
            gap: '20px' 
          }}>
            <FutarchyMergeWithWagmi />
            <CoWSwapWithWagmi />
          </div>

          <div style={{ 
            marginTop: '40px', 
            padding: '20px', 
            backgroundColor: '#f5f5f5', 
            borderRadius: '8px' 
          }}>
            <h3>✨ Benefits of WagmiExecutor:</h3>
            <ul>
              <li>✅ <strong>Zero Duplication</strong> - Uses your existing wagmi providers</li>
              <li>✅ <strong>Minimal Code</strong> - Lightweight executor for wagmi</li>
              <li>✅ <strong>Same Cartridges</strong> - Works with all existing cartridges</li>
              <li>✅ <strong>Fresh Clients</strong> - Gets wagmi clients on each operation</li>
              <li>✅ <strong>Simple Integration</strong> - Just wrap your existing app</li>
            </ul>
          </div>
        </div>
      </RainbowKitProvider>
    </WagmiConfig>
  );
};

export default WagmiIntegrationDemo;

// =============================================================================
// SIMPLE USAGE FOR YOUR EXISTING APP
// =============================================================================

/*
// For your existing React + wagmi app, just add this:

import { useWagmiDataLayer, useOperation } from './React-WagmiIntegration.jsx';

function YourExistingComponent() {
  const { dataLayer } = useWagmiDataLayer();
  const { executeOperation, initializeSteps } = useOperation();
  
  const handleFutarchyOperation = async () => {
    initializeSteps([
      { id: 'approve_yes', label: 'Approve YES Tokens' },
      { id: 'approve_no', label: 'Approve NO Tokens' },
      { id: 'merge', label: 'Merge Positions' }
    ]);
    
    await executeOperation(
      dataLayer, 
      'futarchy.completeMerge', 
      { proposal: '0x...', collateralToken: '0x...', amount: '100' },
      {
        'check_yes_approval': { stepId: 'approve_yes', status: 'running' },
        'yes_approved': { stepId: 'approve_yes', status: 'completed' },
        // ... other mappings
      }
    );
  };
  
  return <button onClick={handleFutarchyOperation}>Merge Positions</button>;
}
*/ 