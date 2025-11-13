import React, { useState, useEffect } from 'react';
import { DataLayer } from '../DataLayer.js';
import { createViemExecutor } from '../executors/ViemExecutor.js';
import { FutarchyCartridge } from '../executors/FutarchyCartridge.js';
import { CoWSwapCartridge } from '../executors/CoWSwapCartridge.js';
import { SwaprAlgebraCartridge } from '../executors/SwaprAlgebraCartridge.js';
import { useOperationRegistry } from './operations/OperationRegistry.js';

/**
 * Generic Operation Modal with Dependency Injection
 * Loads operation configurations dynamically from the registry
 */
const GenericOperationModal = ({ 
  isOpen, 
  onClose, 
  operationId, 
  initialParams = {},
  onSuccess = null,
  onError = null 
}) => {
  const { createLoader, hasOperation } = useOperationRegistry();
  
  // Core state
  const [dataLayer, setDataLayer] = useState(null);
  const [operationLoader, setOperationLoader] = useState(null);
  const [steps, setSteps] = useState([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentStep, setCurrentStep] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  
  // Form state
  const [formParams, setFormParams] = useState({});
  const [formErrors, setFormErrors] = useState({});

  // Initialize DataLayer
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
    };

    if (isOpen && !dataLayer) {
      initDataLayer();
    }
  }, [isOpen, dataLayer]);

  // Load operation configuration when modal opens or operation changes
  useEffect(() => {
    if (isOpen && operationId) {
      try {
        if (!hasOperation(operationId)) {
          setError(`Unknown operation: ${operationId}`);
          return;
        }

        const loader = createLoader(operationId);
        setOperationLoader(loader);
        
        // Initialize steps
        setSteps(loader.initializeSteps());
        
        // Initialize form with default + initial params
        const initialFormParams = {
          ...loader.defaultParams,
          ...initialParams
        };
        setFormParams(initialFormParams);
        
        // Reset other state
        setResult(null);
        setError(null);
        setFormErrors({});
        setCurrentStep(null);
        
      } catch (err) {
        setError(`Failed to load operation: ${err.message}`);
      }
    }
  }, [isOpen, operationId, hasOperation, createLoader, initialParams]);

  // Update step status
  const updateStepStatus = (stepId, status, data = null) => {
    setSteps(prev => prev.map(step => 
      step.id === stepId 
        ? { ...step, status, data }
        : step
    ));
  };

  // Handle form parameter changes
  const handleFormChange = (paramName, value) => {
    setFormParams(prev => ({
      ...prev,
      [paramName]: value
    }));
    
    // Clear field error when user starts typing
    if (formErrors[paramName]) {
      setFormErrors(prev => ({
        ...prev,
        [paramName]: null
      }));
    }
  };

  // Execute operation
  const executeOperation = async () => {
    if (!dataLayer || !operationLoader || isExecuting) return;

    // Validate and transform parameters
    const { errors, params } = operationLoader.validateAndTransform(formParams);
    
    if (errors) {
      setFormErrors(errors);
      return;
    }

    setIsExecuting(true);
    setError(null);
    setFormErrors({});

    try {
      // Execute the operation with real-time step updates
      for await (const status of dataLayer.execute(operationLoader.operation, params)) {
        console.log('Operation status:', status);
        
        setCurrentStep(status.step || null);

        // Map operation steps to UI steps using the loaded configuration
        if (status.step && operationLoader.stepMapping[status.step]) {
          const { stepId, status: stepStatus } = operationLoader.stepMapping[status.step];
          updateStepStatus(stepId, stepStatus, status.data);
        }

        // Handle final result
        if (status.status === 'success') {
          const processedResult = operationLoader.processResult(status.data);
          setResult(processedResult);
          onSuccess?.(processedResult);
          break;
        }

        // Handle errors
        if (status.status === 'error') {
          const errorMessage = status.message || 'Operation failed';
          setError(errorMessage);
          onError?.(errorMessage);
          break;
        }
      }

    } catch (err) {
      console.error('Operation failed:', err);
      const errorMessage = err.message || 'Operation failed';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsExecuting(false);
      setCurrentStep(null);
    }
  };

  // Generate form fields based on parameter schema
  const renderFormFields = () => {
    if (!operationLoader?.parameterSchema) return null;

    return Object.entries(operationLoader.parameterSchema).map(([paramName, schema]) => (
      <div key={paramName} style={formFieldStyle}>
        <label style={labelStyle}>
          {schema.label}
          {schema.required && <span style={requiredStyle}>*</span>}
        </label>
        <input
          type="text"
          value={formParams[paramName] || ''}
          onChange={(e) => handleFormChange(paramName, e.target.value)}
          placeholder={schema.placeholder}
          style={{
            ...inputStyle,
            borderColor: formErrors[paramName] ? '#f44336' : '#ddd'
          }}
        />
        {formErrors[paramName] && (
          <div style={errorTextStyle}>{formErrors[paramName]}</div>
        )}
      </div>
    ));
  };

  // Get step icon
  const getStepIcon = (step) => {
    switch (step.status) {
      case 'completed': return '✅';
      case 'running': return '⏳';
      case 'error': return '❌';
      default: return '⭕';
    }
  };

  // Get step color
  const getStepColor = (step) => {
    switch (step.status) {
      case 'completed': return '#4CAF50';
      case 'running': return '#2196F3';
      case 'error': return '#f44336';
      default: return '#9E9E9E';
    }
  };

  if (!isOpen) return null;

  return (
    <div style={modalOverlayStyle}>
      <div style={modalStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <div>
            <h2>{operationLoader?.name || 'Loading...'}</h2>
            {operationLoader?.description && (
              <p style={descriptionStyle}>{operationLoader.description}</p>
            )}
          </div>
          <button onClick={onClose} style={closeButtonStyle}>×</button>
        </div>

        {/* Parameter Form */}
        {operationLoader && !result && !error && (
          <div style={formSectionStyle}>
            <h3>Parameters</h3>
            {renderFormFields()}
          </div>
        )}

        {/* Steps List */}
        {steps.length > 0 && (
          <div style={stepsContainerStyle}>
            <h3>Progress</h3>
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
                  <div style={stepDescriptionStyle}>{step.description}</div>
                  <div style={stepStatusStyle}>
                    {step.status === 'running' && currentStep && (
                      <span style={currentStepStyle}>Processing...</span>
                    )}
                    {step.status === 'completed' && step.data?.transactionHash && operationLoader && (
                      <a 
                        href={operationLoader.generateLink(step.data.transactionHash)}
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
        )}

        {/* Current Operation Status */}
        {currentStep && (
          <div style={currentOperationStyle}>
            <span>Current: {currentStep}</span>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div style={errorStyle}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Success Result */}
        {result && operationLoader && (
          <div style={successStyle}>
            <strong>✅ {operationLoader.generateSuccessMessage(result)}</strong>
            
            {/* Dynamic result links */}
            {result.transactionHash && (
              <div style={{ marginTop: '8px' }}>
                <a 
                  href={operationLoader.generateLink(result.transactionHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={txLinkStyle}
                >
                  View Transaction
                </a>
              </div>
            )}
            
            {result.orderId && (
              <div style={{ marginTop: '8px' }}>
                <a 
                  href={operationLoader.generateLink(result.orderId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={txLinkStyle}
                >
                  Track Order
                </a>
              </div>
            )}

            {/* Custom result links */}
            {result.trackingLink && (
              <div style={{ marginTop: '8px' }}>
                <a 
                  href={result.trackingLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={txLinkStyle}
                >
                  {result.trackingLinkLabel || 'View Details'}
                </a>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div style={buttonContainerStyle}>
          {!result && !error && operationLoader && (
            <button 
              onClick={executeOperation}
              disabled={isExecuting || !dataLayer}
              style={{
                ...executeButtonStyle,
                opacity: (isExecuting || !dataLayer) ? 0.6 : 1
              }}
            >
              {isExecuting ? 'Executing...' : `Start ${operationLoader.name}`}
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

// Styles (same as before, but with additions for form fields)
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
  maxWidth: '700px',
  maxHeight: '80vh',
  overflowY: 'auto',
  boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)'
};

const headerStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  marginBottom: '24px',
  borderBottom: '1px solid #eee',
  paddingBottom: '16px'
};

const descriptionStyle = {
  margin: '4px 0 0 0',
  color: '#666',
  fontSize: '14px'
};

const closeButtonStyle = {
  background: 'none',
  border: 'none',
  fontSize: '24px',
  cursor: 'pointer',
  color: '#666'
};

const formSectionStyle = {
  marginBottom: '24px'
};

const formFieldStyle = {
  marginBottom: '16px'
};

const labelStyle = {
  display: 'block',
  marginBottom: '4px',
  fontWeight: '500',
  color: '#333'
};

const requiredStyle = {
  color: '#f44336',
  marginLeft: '2px'
};

const inputStyle = {
  width: '100%',
  padding: '8px 12px',
  border: '1px solid #ddd',
  borderRadius: '4px',
  fontSize: '14px'
};

const errorTextStyle = {
  color: '#f44336',
  fontSize: '12px',
  marginTop: '4px'
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

const stepDescriptionStyle = {
  fontSize: '14px',
  color: '#666',
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

// Simple demo of the generic modal
const OperationDemo = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedOperation, setSelectedOperation] = useState('futarchy-merge');
  const { getAllOperations } = useOperationRegistry();

  const operations = getAllOperations();

  return (
    <div style={{ padding: '40px' }}>
      <h1>Generic Operation Modal Demo</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <select 
          value={selectedOperation} 
          onChange={(e) => setSelectedOperation(e.target.value)}
          style={{ marginRight: '12px', padding: '8px' }}
        >
          {operations.map(op => (
            <option key={op.id} value={op.id}>
              {op.name} ({op.cartridge})
            </option>
          ))}
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

      <GenericOperationModal 
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        operationId={selectedOperation}
        onSuccess={(result) => {
          console.log('Operation succeeded:', result);
        }}
        onError={(error) => {
          console.error('Operation failed:', error);
        }}
      />
    </div>
  );
};

export default OperationDemo;
export { GenericOperationModal }; 