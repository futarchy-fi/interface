import { useState, useEffect, useCallback } from 'react';
import { DataLayer } from '../DataLayer.js';
import { createViemExecutor } from '../executors/ViemExecutor.js';
import { FutarchyCartridge } from '../executors/FutarchyCartridge.js';
import { CoWSwapCartridge } from '../executors/CoWSwapCartridge.js';
import { SwaprAlgebraCartridge } from '../executors/SwaprAlgebraCartridge.js';

// 🪝 Custom Hook for DataLayer
export const useDataLayer = () => {
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
      executor.registerCartridge(new SwaprAlgebraCartridge());
      
      dl.registerExecutor(executor);
      setDataLayer(dl);
      setIsInitialized(true);
    };

    initDataLayer();
  }, []);

  return { dataLayer, isInitialized };
};

// 🪝 Custom Hook for Operation Execution
export const useOperation = () => {
  const [steps, setSteps] = useState([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentStep, setCurrentStep] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const updateStep = useCallback((stepId, status, data = null) => {
    setSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, status, data } : step
    ));
  }, []);

  const initializeSteps = useCallback((stepConfig) => {
    setSteps(stepConfig.map(step => ({ ...step, status: 'pending' })));
    setResult(null);
    setError(null);
    setCurrentStep(null);
  }, []);

  const executeOperation = useCallback(async (dataLayer, operation, params, stepMapping) => {
    if (!dataLayer || isExecuting) return;

    setIsExecuting(true);
    setError(null);

    try {
      for await (const status of dataLayer.execute(operation, params)) {
        setCurrentStep(status.step || null);

        // Apply step mapping if provided
        if (stepMapping[status.step]) {
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
      setCurrentStep(null);
    }
  }, [isExecuting, updateStep]);

  return {
    steps,
    isExecuting,
    currentStep,
    result,
    error,
    initializeSteps,
    executeOperation,
    updateStep
  };
};

// 📋 Step Configurations
export const STEP_CONFIGS = {
  futarchyMerge: [
    { id: 'approve_yes', label: 'Approve YES Tokens' },
    { id: 'approve_no', label: 'Approve NO Tokens' },
    { id: 'merge', label: 'Merge Positions' }
  ],
  futarchySplit: [
    { id: 'approve_collateral', label: 'Approve Collateral' },
    { id: 'split', label: 'Split Position' }
  ],
  cowSwap: [
    { id: 'approve_token', label: 'Approve Token for CoW' },
    { id: 'create_order', label: 'Create CoW Order' }
  ],
  swaprSwap: [
    { id: 'approve_token', label: 'Approve Token for Swapr' },
    { id: 'execute_swap', label: 'Execute Swap' }
  ]
};

// 🗺️ Step Mappings
export const STEP_MAPPINGS = {
  futarchyMerge: {
    'check_yes_approval': { stepId: 'approve_yes', status: 'running' },
    'approving_yes': { stepId: 'approve_yes', status: 'running' },
    'yes_approved': { stepId: 'approve_yes', status: 'completed' },
    'check_no_approval': { stepId: 'approve_no', status: 'running' },
    'approving_no': { stepId: 'approve_no', status: 'running' },
    'no_approved': { stepId: 'approve_no', status: 'completed' },
    'merging': { stepId: 'merge', status: 'running' },
    'complete': { stepId: 'merge', status: 'completed' }
  },
  cowSwap: {
    'check_approval': { stepId: 'approve_token', status: 'running' },
    'approving': { stepId: 'approve_token', status: 'running' },
    'approved': { stepId: 'approve_token', status: 'completed' },
    'swapping': { stepId: 'create_order', status: 'running' },
    'complete': { stepId: 'create_order', status: 'completed' }
  }
};

// ✨ Simple Step Component
export const StepItem = ({ step, index }) => {
  const getIcon = () => {
    switch (step.status) {
      case 'completed': return '✅';
      case 'running': return '⏳';
      case 'error': return '❌';
      default: return '⭕';
    }
  };

  const getColor = () => {
    switch (step.status) {
      case 'completed': return '#4CAF50';
      case 'running': return '#2196F3';
      case 'error': return '#f44336';
      default: return '#9E9E9E';
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      padding: '12px',
      margin: '8px 0',
      backgroundColor: '#f9f9f9',
      borderRadius: '8px',
      borderLeft: `4px solid ${getColor()}`
    }}>
      <span style={{ fontSize: '20px', marginRight: '12px' }}>
        {getIcon()}
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
      <span style={{ color: '#666', fontSize: '14px' }}>
        {index + 1}
      </span>
    </div>
  );
};

// 🚀 Example: Simple Futarchy Merge Component
export const SimpleFutarchyMerge = () => {
  const { dataLayer, isInitialized } = useDataLayer();
  const { 
    steps, 
    isExecuting, 
    result, 
    error, 
    initializeSteps, 
    executeOperation 
  } = useOperation();

  const handleMerge = async () => {
    if (!dataLayer) return;

    // Initialize steps
    initializeSteps(STEP_CONFIGS.futarchyMerge);

    // Execute operation
    await executeOperation(
      dataLayer,
      'futarchy.completeMerge',
      {
        proposal: '0xDA36a35CA4Fe6214C37a452159C0C9EAd45D5919',
        collateralToken: '0xaf204776c7245bF4147c2612BF6e5972Ee483701',
        amount: '100'
      },
      STEP_MAPPINGS.futarchyMerge
    );
  };

  if (!isInitialized) {
    return <div>Initializing DataLayer...</div>;
  }

  return (
    <div style={{ maxWidth: '500px', margin: '20px auto', padding: '20px' }}>
      <h2>Futarchy Merge Operation</h2>
      
      {/* Steps Display */}
      {steps.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          {steps.map((step, index) => (
            <StepItem key={step.id} step={step} index={index} />
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
        disabled={isExecuting}
        style={{
          width: '100%',
          padding: '16px',
          backgroundColor: isExecuting ? '#ccc' : '#4CAF50',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '16px',
          fontWeight: '500',
          cursor: isExecuting ? 'not-allowed' : 'pointer'
        }}
      >
        {isExecuting ? 'Executing Merge...' : 'Start Merge Operation'}
      </button>
    </div>
  );
};

// 🔄 Example: Multi-Operation Component
export const MultiOperationDemo = () => {
  const { dataLayer, isInitialized } = useDataLayer();
  const { 
    steps, 
    isExecuting, 
    result, 
    error, 
    initializeSteps, 
    executeOperation 
  } = useOperation();
  
  const [selectedOperation, setSelectedOperation] = useState('futarchyMerge');

  const operations = {
    futarchyMerge: {
      label: 'Futarchy Merge',
      operation: 'futarchy.completeMerge',
      params: {
        proposal: '0xDA36a35CA4Fe6214C37a452159C0C9EAd45D5919',
        collateralToken: '0xaf204776c7245bF4147c2612BF6e5972Ee483701',
        amount: '100'
      },
      steps: STEP_CONFIGS.futarchyMerge,
      mapping: STEP_MAPPINGS.futarchyMerge
    },
    cowSwap: {
      label: 'CoW Swap',
      operation: 'cowswap.completeSwap',
      params: {
        sellToken: '0xaf204776c7245bF4147c2612BF6e5972Ee483701',
        buyToken: '0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d',
        amount: '1'
      },
      steps: STEP_CONFIGS.cowSwap,
      mapping: STEP_MAPPINGS.cowSwap
    }
  };

  const handleExecute = async () => {
    if (!dataLayer) return;

    const op = operations[selectedOperation];
    initializeSteps(op.steps);
    await executeOperation(dataLayer, op.operation, op.params, op.mapping);
  };

  if (!isInitialized) {
    return <div>Initializing DataLayer...</div>;
  }

  return (
    <div style={{ maxWidth: '600px', margin: '20px auto', padding: '20px' }}>
      <h2>Multi-Operation Demo</h2>
      
      {/* Operation Selector */}
      <div style={{ marginBottom: '20px' }}>
        <select 
          value={selectedOperation}
          onChange={(e) => setSelectedOperation(e.target.value)}
          style={{ 
            width: '100%', 
            padding: '12px', 
            borderRadius: '8px', 
            border: '1px solid #ddd' 
          }}
        >
          {Object.entries(operations).map(([key, op]) => (
            <option key={key} value={key}>{op.label}</option>
          ))}
        </select>
      </div>

      {/* Steps Display */}
      {steps.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <h3>Operation Steps:</h3>
          {steps.map((step, index) => (
            <StepItem key={step.id} step={step} index={index} />
          ))}
        </div>
      )}

      {/* Error/Success Display */}
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

      {result && (
        <div style={{ 
          padding: '12px', 
          backgroundColor: '#e8f5e8', 
          color: '#2e7d32', 
          borderRadius: '8px',
          marginBottom: '16px'
        }}>
          ✅ Operation completed successfully!
          {result.orderId && <div>Order ID: {result.orderId}</div>}
          {result.transactionHash && (
            <div>
              <a 
                href={`https://gnosisscan.io/tx/${result.transactionHash}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#2e7d32' }}
              >
                View Transaction →
              </a>
            </div>
          )}
        </div>
      )}

      {/* Execute Button */}
      <button
        onClick={handleExecute}
        disabled={isExecuting}
        style={{
          width: '100%',
          padding: '16px',
          backgroundColor: isExecuting ? '#ccc' : '#2196F3',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '16px',
          fontWeight: '500',
          cursor: isExecuting ? 'not-allowed' : 'pointer'
        }}
      >
        {isExecuting ? `Executing ${operations[selectedOperation].label}...` : `Execute ${operations[selectedOperation].label}`}
      </button>
    </div>
  );
}; 