import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';

const LoadingSpinner = ({ className = "" }) => (
  <svg className={`animate-spin h-4 w-4 ${className}`} viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.15" />
    <path fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" d="M4 12a8 8 0 018-8" />
  </svg>
);

const CheckMark = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const AlertTriangle = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
  </svg>
);

// Step component with substeps (similar to ConfirmSwapModal)
const StepWithSubsteps = ({
  stepNumber,
  title,
  substeps,
  expanded,
  onToggle,
  isActive,
  isCompleted,
  currentSubstep,
  completedSubsteps,
  currentAction
}) => {
  const isStepActive = isActive && currentSubstep.step === stepNumber;
  const isAnySubstepProcessing = isStepActive && substeps.some(sub => 
    currentSubstep.substep === sub.id
  );

  const getStepColors = () => {
    if (isCompleted) return 'text-green-800 bg-green-100';
    if (isStepActive) return 'text-blue-800 bg-blue-100';
    return 'text-gray-600 bg-gray-100';
  };

  const getSubstepColor = (substep) => {
    const isSubstepCompleted = isCompleted || completedSubsteps[stepNumber]?.substeps[substep.id];
    const isSubstepActive = isStepActive && currentSubstep.substep === substep.id;
    
    if (isSubstepCompleted) return 'text-green-800';
    if (isSubstepActive) return 'text-blue-800';
    return 'text-gray-600';
  };

  return (
    <div className="border border-gray-200 rounded-lg p-3 mb-3">
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${getStepColors()}`}>
          {isCompleted ? (
            <CheckMark />
          ) : isStepActive && isAnySubstepProcessing ? (
            <LoadingSpinner className="h-4 w-4" />
          ) : (
            <span className="text-sm font-medium">{stepNumber}</span>
          )}
        </div>
        <span className="flex-1 font-medium">{title}</span>
        <button
          onClick={onToggle}
          className="text-blue-600 hover:text-blue-800 text-sm"
        >
          {expanded ? 'Hide details' : 'Show details'}
        </button>
      </div>

      {expanded && (
        <div className="ml-9 space-y-2">
          {substeps.map((substep) => {
            const isSubstepCompleted = isCompleted || completedSubsteps[stepNumber]?.substeps[substep.id];
            const isSubstepActive = isStepActive && currentSubstep.substep === substep.id;

            return (
              <div key={substep.id} className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded-full flex items-center justify-center ${getSubstepColor(substep)}`}>
                  {isSubstepCompleted ? (
                    <CheckMark />
                  ) : isSubstepActive ? (
                    <LoadingSpinner className="h-3 w-3" />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-current" />
                  )}
                </div>
                <span className={`text-sm ${getSubstepColor(substep)}`}>
                  {substep.text}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Approval status display component
const ApprovalStatusDisplay = ({ 
  approvalStatus, 
  approvalLoading, 
  selectedStrategy, 
  tokenIn,
  manualRefreshApproval 
}) => {
  if (!tokenIn || approvalLoading) {
    return (
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center gap-2">
          <LoadingSpinner />
          <span className="text-blue-800 font-medium">Checking Approval Status...</span>
        </div>
      </div>
    );
  }

  if (Object.keys(approvalStatus).length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-gray-900">Approval Status</h4>
        {manualRefreshApproval && (
          <button
            onClick={manualRefreshApproval}
            className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
          >
            🔄 Refresh
          </button>
        )}
      </div>
      {Object.entries(approvalStatus).map(([strategy, isApproved]) => (
        <div
          key={strategy}
          className={`p-3 border rounded-lg ${
            strategy === selectedStrategy 
              ? isApproved ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'
              : 'bg-gray-50 border-gray-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{strategy}</span>
              {strategy === selectedStrategy && (
                <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded">
                  Selected
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isApproved ? (
                <>
                  <CheckMark />
                  <span className="text-green-800 text-sm font-medium">Approved</span>
                </>
              ) : (
                <>
                  <AlertTriangle />
                  <span className="text-yellow-800 text-sm font-medium">Approval Needed</span>
                </>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const SmartSwapAnalysis = ({ 
  tokenIn, 
  amount, 
  tokenAnalysis, 
  analysisLoading, 
  autoSplitEnabled, 
  setAutoSplitEnabled,
  executionPlan,
  currentAction,
  executeAction,
  getSuggestions,
  isConditionalToken,
  onAnalyzeToken,
  // New step tracking props
  processingStep,
  currentSubstep,
  completedSubsteps,
  expandedSteps,
  toggleStepExpansion,
  stepError,
  stepsData,
  approvalStatus,
  approvalLoading,
  selectedStrategy,
  manualRefreshApproval
}) => {
  const [manualActionLoading, setManualActionLoading] = useState(false);

  // Debounced auto-analyze when tokenIn or amount changes
  useEffect(() => {
    // Only proceed if we have the required data
    if (!tokenIn || !amount || parseFloat(amount) <= 0 || !onAnalyzeToken) {
      return;
    }

    // Add debouncing - wait 500ms after user stops typing
    const timeoutId = setTimeout(() => {
      console.log('Triggering debounced token analysis for:', { tokenIn, amount });
      onAnalyzeToken(tokenIn, amount);
    }, 500);

    // Cleanup timeout if user types again before delay
    return () => {
      clearTimeout(timeoutId);
    };
  }, [tokenIn, amount, onAnalyzeToken]);

  const handleManualAction = async (action) => {
    if (!executeAction) return;

    setManualActionLoading(true);
    try {
      await executeAction(action, { tokenIn, amount });
    } finally {
      setManualActionLoading(false);
    }
  };

  const getTokenSymbol = (tokenAddress) => {
    // This should be replaced with actual token metadata lookup
    if (tokenAddress?.toLowerCase().includes('yes')) return 'YES_SDAI';
    if (tokenAddress?.toLowerCase().includes('no')) return 'NO_SDAI';
    return 'TOKEN';
  };

  if (!tokenIn || !amount || parseFloat(amount) <= 0) {
    return null;
  }

  if (analysisLoading) {
    return (
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center gap-2">
          <LoadingSpinner />
          <span className="text-blue-800 font-medium">Analyzing token requirements...</span>
        </div>
      </div>
    );
  }

  if (!tokenAnalysis) {
    return null;
  }

  if (tokenAnalysis.error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center gap-2">
          <AlertTriangle />
          <span className="text-red-800 font-medium">Analysis Error</span>
        </div>
        <p className="text-red-700 text-sm mt-1">{tokenAnalysis.error}</p>
      </div>
    );
  }

  const suggestions = getSuggestions ? getSuggestions(tokenIn, amount) : [];
  const isConditional = isConditionalToken ? isConditionalToken(tokenIn) : false;

  return (
    <div className="space-y-4">
      {/* Error Display */}
      {stepError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertTriangle />
            <span className="text-red-800 font-medium">Execution Error</span>
          </div>
          <p className="text-red-700 text-sm mt-1">{stepError}</p>
        </div>
      )}

      {/* Token Analysis Summary */}
      <div className={`p-4 border rounded-lg ${
        tokenAnalysis.sufficient 
          ? 'bg-green-50 border-green-200' 
          : 'bg-yellow-50 border-yellow-200'
      }`}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium flex items-center gap-2">
            {tokenAnalysis.sufficient ? (
              <>
                <CheckMark />
                <span className="text-green-800">Token Requirements Satisfied</span>
              </>
            ) : (
              <>
                <AlertTriangle />
                <span className="text-yellow-800">Token Analysis</span>
              </>
            )}
          </h3>
          
          {isConditional && (
            <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
              Conditional Token
            </span>
          )}
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Token:</span>
            <span className="font-mono">{tokenAnalysis.tokenType?.symbol || getTokenSymbol(tokenIn)}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-600">Required:</span>
            <span className="font-mono">{amount}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-600">Current Balance:</span>
            <span className="font-mono">{tokenAnalysis.currentBalance}</span>
          </div>

          {!tokenAnalysis.sufficient && (
            <div className="flex justify-between">
              <span className="text-gray-600">Shortage:</span>
              <span className="font-mono text-red-600">-{tokenAnalysis.shortage}</span>
            </div>
          )}

          {tokenAnalysis.canAutoSplit && (
            <div className="flex justify-between">
              <span className="text-gray-600">Collateral Available:</span>
              <span className="font-mono text-green-600">{tokenAnalysis.collateralAvailable}</span>
            </div>
          )}
        </div>

        {/* Recommendations */}
        {tokenAnalysis.recommendations && tokenAnalysis.recommendations.length > 0 && (
          <div className="mt-3 p-2 bg-white/50 rounded text-xs space-y-1">
            {tokenAnalysis.recommendations.map((rec, index) => (
              <div key={index} className="text-gray-700">{rec}</div>
            ))}
          </div>
        )}
      </div>

      {/* Auto-Split Toggle for Conditional Tokens */}
      {isConditional && tokenAnalysis.canAutoSplit && (
        <div className="p-3 bg-white border border-gray-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">Auto-Split Collateral</h4>
              <p className="text-xs text-gray-600">
                Automatically split collateral to create missing conditional tokens
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoSplitEnabled}
                onChange={(e) => setAutoSplitEnabled?.(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      )}

      {/* Approval Status Display - Only show during/after execution */}
      {processingStep && approvalStatus && Object.keys(approvalStatus).length > 0 && (
        <ApprovalStatusDisplay
          approvalStatus={approvalStatus}
          approvalLoading={approvalLoading}
          selectedStrategy={selectedStrategy}
          tokenIn={tokenIn}
          manualRefreshApproval={manualRefreshApproval}
        />
      )}

      {/* Processing Steps Display (similar to ConfirmSwapModal) */}
      {processingStep && stepsData && (
        <div className="space-y-2">
          <h4 className="font-medium text-gray-900">Execution Progress</h4>
          <div className="max-h-64 overflow-y-auto">
            {Object.entries(stepsData).map(([stepNum, stepData]) => {
              const stepNumber = parseInt(stepNum);
              const isStepActive = processingStep === stepNumber;
              const isStepCompleted = processingStep === 'completed' || 
                (typeof processingStep === 'number' && processingStep > stepNumber);
              
              return (
                <StepWithSubsteps
                  key={stepNumber}
                  stepNumber={stepNumber}
                  title={stepData.title}
                  substeps={stepData.substeps}
                  expanded={expandedSteps[stepNumber]}
                  onToggle={() => toggleStepExpansion?.(stepNumber)}
                  isActive={isStepActive}
                  isCompleted={isStepCompleted}
                  currentSubstep={currentSubstep}
                  completedSubsteps={completedSubsteps}
                  currentAction={currentAction}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Manual Actions */}
      {suggestions.length > 0 && !processingStep && (
        <div className="space-y-2">
          <h4 className="font-medium text-gray-900">Suggested Actions</h4>
          {suggestions.map((suggestion, index) => (
            <div
              key={index}
              className={`p-3 border rounded-lg ${
                suggestion.type === 'AUTO_SPLIT' 
                  ? 'bg-blue-50 border-blue-200'
                  : suggestion.type === 'MANUAL_SPLIT'
                  ? 'bg-green-50 border-green-200'
                  : 'bg-red-50 border-red-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h5 className="font-medium text-sm">{suggestion.title}</h5>
                  <p className="text-sm text-gray-600 mt-1">{suggestion.description}</p>
                  <p className="text-xs text-gray-500 mt-1">{suggestion.action}</p>
                </div>
                
                {suggestion.executable && suggestion.type === 'MANUAL_SPLIT' && (
                  <button
                    onClick={() => handleManualAction(tokenAnalysis.actions[0])}
                    disabled={manualActionLoading}
                    className="ml-3 px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50"
                  >
                    {manualActionLoading ? (
                      <LoadingSpinner className="w-3 h-3" />
                    ) : (
                      'Split Now'
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Execution Plan Summary */}
      {executionPlan && executionPlan.steps.length > 0 && !processingStep && (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-3">Execution Plan</h4>
          
          <div className="space-y-2">
            {executionPlan.steps.map((step, index) => (
              <div key={index} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-xs font-medium">
                  {step.stepNumber}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">{step.title}</div>
                  <div className="text-sm text-gray-600">{step.description}</div>
                  {!step.required && (
                    <div className="text-xs text-blue-600">Will be skipped</div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-600">
            <div>Estimated Time: {executionPlan.estimatedTime}</div>
            <div>Gas Estimate: {executionPlan.gasEstimate?.estimated}</div>
            <div className="text-blue-600 mt-1">
              💡 Token approvals will be checked when you start the swap
            </div>
          </div>
        </div>
      )}

      {/* Current Action Status */}
      {currentAction && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2">
            <LoadingSpinner />
            <span className="font-medium text-blue-800">
              {currentAction.progress || currentAction.description}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default SmartSwapAnalysis; 