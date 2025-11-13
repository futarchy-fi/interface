import React, { useState, useEffect } from 'react';
import { DataLayer } from '../DataLayer.js';
import { createViemExecutor } from '../executors/ViemExecutor.js';
import { FutarchyCartridge } from '../executors/FutarchyCartridge.js';

// Step configuration for different operations
const OPERATION_STEPS = {
  completeMerge: [
    { id: 'approve_yes', label: 'Approve YES Tokens', status: 'pending' },
    { id: 'approve_no', label: 'Approve NO Tokens', status: 'pending' },
    { id: 'merge', label: 'Merge Positions', status: 'pending' }
  ],
  completeSplit: [
    { id: 'approve_collateral', label: 'Approve Collateral', status: 'pending' },
    { id: 'split', label: 'Split Position', status: 'pending' }
  ],
  completeSwap: [
    { id: 'approve_token', label: 'Approve Token', status: 'pending' },
    { id: 'swap', label: 'Execute Swap', status: 'pending' }
  ]
};

const FutarchyModal = ({ isOpen, onClose, operation = 'completeMerge' }) => {
  const [dataLayer, setDataLayer] = useState(null);
  const [steps, setSteps] = useState(OPERATION_STEPS[operation] || []);
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentStep, setCurrentStep] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Initialize DataLayer
  useEffect(() => {
    const initDataLayer = async () => {
      const dl = new DataLayer();
      const executor = createViemExecutor({ 
        rpcUrl: 'https://rpc.gnosischain.com' 
      });
      
      executor.registerCartridge(new FutarchyCartridge(
        '0x7495a583ba85875d59407781b4958ED6e0E1228f'
      ));
      
      dl.registerExecutor(executor);
      setDataLayer(dl);
    };

    if (isOpen && !dataLayer) {
      initDataLayer();
    }
  }, [isOpen, dataLayer]);

  // Reset steps when operation changes
  useEffect(() => {
    setSteps(OPERATION_STEPS[operation]?.map(step => ({ ...step, status: 'pending' })) || []);
    setCurrentStep(null);
    setResult(null);
    setError(null);
  }, [operation]);

  // Update step status
  const updateStepStatus = (stepId, status, data = null) => {
    setSteps(prev => prev.map(step => 
      step.id === stepId 
        ? { ...step, status, data }
        : step
    ));
  };

  // Execute futarchy operation
  const executeOperation = async () => {
    if (!dataLayer || isExecuting) return;

    setIsExecuting(true);
    setError(null);

    try {
      // Example parameters - these would come from props or form inputs
      const operationParams = {
        completeMerge: {
          proposal: '0xDA36a35CA4Fe6214C37a452159C0C9EAd45D5919',
          collateralToken: '0xaf204776c7245bF4147c2612BF6e5972Ee483701',
          amount: '100'
        },
        completeSplit: {
          proposal: '0xDA36a35CA4Fe6214C37a452159C0C9EAd45D5919',
          collateralToken: '0xaf204776c7245bF4147c2612BF6e5972Ee483701',
          amount: '100'
        }
      };

      const params = operationParams[operation];
      if (!params) {
        throw new Error(`Unsupported operation: ${operation}`);
      }

      // Execute the operation and handle yield updates
      for await (const status of dataLayer.execute(`futarchy.${operation}`, params)) {
        console.log('Operation status:', status);
        
        setCurrentStep(status.step || null);

        // Map operation steps to UI steps
        switch (status.step) {
          case 'check_yes_approval':
          case 'approving_yes':
            updateStepStatus('approve_yes', 'running');
            break;
            
          case 'yes_approved':
            updateStepStatus('approve_yes', 'completed', status.data);
            break;
            
          case 'check_no_approval':
          case 'approving_no':
            updateStepStatus('approve_no', 'running');
            break;
            
          case 'no_approved':
            updateStepStatus('approve_no', 'completed', status.data);
            break;
            
          case 'check_collateral_approval':
          case 'approving_collateral':
            updateStepStatus('approve_collateral', 'running');
            break;
            
          case 'collateral_approved':
            updateStepStatus('approve_collateral', 'completed', status.data);
            break;
            
          case 'check_token_approval':
          case 'approving_token':
            updateStepStatus('approve_token', 'running');
            break;
            
          case 'token_approved':
            updateStepStatus('approve_token', 'completed', status.data);
            break;
            
          case 'merging':
            updateStepStatus('merge', 'running');
            break;
            
          case 'splitting':
            updateStepStatus('split', 'running');
            break;
            
          case 'swapping':
            updateStepStatus('swap', 'running');
            break;
            
          case 'complete':
            if (operation === 'completeMerge') {
              updateStepStatus('merge', 'completed', status.data);
            } else if (operation === 'completeSplit') {
              updateStepStatus('split', 'completed', status.data);
            } else if (operation === 'completeSwap') {
              updateStepStatus('swap', 'completed', status.data);
            }
            break;
        }

        // Handle final success
        if (status.status === 'success') {
          setResult(status.data);
          break;
        }

        // Handle errors
        if (status.status === 'error') {
          setError(status.message || 'Operation failed');
          break;
        }
      }

    } catch (err) {
      console.error('Operation failed:', err);
      setError(err.message || 'Operation failed');
    } finally {
      setIsExecuting(false);
      setCurrentStep(null);
    }
  };

  // Get step icon based on status
  const getStepIcon = (step) => {
    switch (step.status) {
      case 'completed':
        return '✅';
      case 'running':
        return '⏳';
      case 'error':
        return '❌';
      default:
        return '⭕';
    }
  };

  // Get step color based on status
  const getStepColor = (step) => {
    switch (step.status) {
      case 'completed':
        return '#4CAF50';
      case 'running':
        return '#2196F3';
      case 'error':
        return '#f44336';
      default:
        return '#9E9E9E';
    }
  };

  if (!isOpen) return null;

  return (
    <div style={modalOverlayStyle}>
      <div style={modalStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <h2>Futarchy Operation: {operation}</h2>
          <button onClick={onClose} style={closeButtonStyle}>×</button>
        </div>

        {/* Steps List */}
        <div style={stepsContainerStyle}>
          {steps.map((step, index) => (
            <div key={step.id} style={stepStyle}>
              <div style={stepIndicatorStyle}>
                <span style={{ 
                  ...stepIconStyle, 
                  color: getStepColor(step),
                  transform: step.status === 'running' ? 'scale(1.2)' : 'scale(1)'
                }}>
                  {getStepIcon(step)}
                </span>
                <span style={stepNumberStyle}>{index + 1}</span>
              </div>
              
              <div style={stepContentStyle}>
                <div style={stepLabelStyle}>{step.label}</div>
                <div style={stepStatusStyle}>
                  {step.status === 'running' && currentStep && (
                    <span style={currentStepStyle}>Processing...</span>
                  )}
                  {step.status === 'completed' && step.data?.transactionHash && (
                    <a 
                      href={`https://gnosisscan.io/tx/${step.data.transactionHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={txLinkStyle}
                    >
                      View Transaction
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Current Operation Status */}
        {currentStep && (
          <div style={currentOperationStyle}>
            <span>Current operation: {currentStep}</span>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div style={errorStyle}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Success Result */}
        {result && (
          <div style={successStyle}>
            <strong>✅ Operation completed successfully!</strong>
            {result.transactionHash && (
              <div>
                <a 
                  href={`https://gnosisscan.io/tx/${result.transactionHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={txLinkStyle}
                >
                  View Final Transaction
                </a>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div style={buttonContainerStyle}>
          {!result && !error && (
            <button 
              onClick={executeOperation}
              disabled={isExecuting || !dataLayer}
              style={{
                ...executeButtonStyle,
                opacity: (isExecuting || !dataLayer) ? 0.6 : 1
              }}
            >
              {isExecuting ? 'Executing...' : `Start ${operation}`}
            </button>
          )}
          
          <button onClick={onClose} style={cancelButtonStyle}>
            {result || error ? 'Close' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Styles
const modalOverlayStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000
};

const modalStyle = {
  backgroundColor: 'white',
  borderRadius: '12px',
  padding: '24px',
  minWidth: '500px',
  maxWidth: '600px',
  maxHeight: '80vh',
  overflowY: 'auto',
  boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)'
};

const headerStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '24px',
  borderBottom: '1px solid #eee',
  paddingBottom: '16px'
};

const closeButtonStyle = {
  background: 'none',
  border: 'none',
  fontSize: '24px',
  cursor: 'pointer',
  color: '#666'
};

const stepsContainerStyle = {
  marginBottom: '24px'
};

const stepStyle = {
  display: 'flex',
  alignItems: 'flex-start',
  marginBottom: '16px',
  padding: '12px',
  borderRadius: '8px',
  backgroundColor: '#f9f9f9'
};

const stepIndicatorStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  marginRight: '16px',
  minWidth: '40px'
};

const stepIconStyle = {
  fontSize: '20px',
  transition: 'transform 0.2s ease'
};

const stepNumberStyle = {
  fontSize: '12px',
  color: '#666',
  marginTop: '4px'
};

const stepContentStyle = {
  flex: 1
};

const stepLabelStyle = {
  fontWeight: '500',
  marginBottom: '4px'
};

const stepStatusStyle = {
  fontSize: '14px',
  color: '#666'
};

const currentStepStyle = {
  color: '#2196F3',
  fontWeight: '500'
};

const txLinkStyle = {
  color: '#2196F3',
  textDecoration: 'none',
  fontSize: '14px'
};

const currentOperationStyle = {
  padding: '12px',
  backgroundColor: '#e3f2fd',
  borderRadius: '8px',
  marginBottom: '16px',
  color: '#1976d2',
  fontWeight: '500'
};

const errorStyle = {
  padding: '12px',
  backgroundColor: '#ffebee',
  borderRadius: '8px',
  marginBottom: '16px',
  color: '#c62828'
};

const successStyle = {
  padding: '12px',
  backgroundColor: '#e8f5e8',
  borderRadius: '8px',
  marginBottom: '16px',
  color: '#2e7d32'
};

const buttonContainerStyle = {
  display: 'flex',
  gap: '12px',
  justifyContent: 'flex-end'
};

const executeButtonStyle = {
  padding: '12px 24px',
  backgroundColor: '#2196F3',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: '500'
};

const cancelButtonStyle = {
  padding: '12px 24px',
  backgroundColor: '#f5f5f5',
  color: '#333',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer'
};

// Usage Example Component
const FutarchyApp = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [operation, setOperation] = useState('completeMerge');

  return (
    <div style={{ padding: '40px' }}>
      <h1>Futarchy Operations</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <select 
          value={operation} 
          onChange={(e) => setOperation(e.target.value)}
          style={{ marginRight: '12px', padding: '8px' }}
        >
          <option value="completeMerge">Complete Merge (YES + NO → Collateral)</option>
          <option value="completeSplit">Complete Split (Collateral → YES + NO)</option>
        </select>
        
        <button 
          onClick={() => setModalOpen(true)}
          style={{
            padding: '12px 24px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          Open Operation Modal
        </button>
      </div>

      <FutarchyModal 
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        operation={operation}
      />
    </div>
  );
};

export default FutarchyApp;
export { FutarchyModal }; 