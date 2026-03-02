import { useState } from 'react';
import { useAccount } from 'wagmi';
import { useCollateral } from '../hooks/useCollateral';
import { useProposalContext } from '../context/ProposalContext';
import { useProposalTokens } from '../hooks/useProposalTokens';

const LoadingSpinner = ({ className = "" }) => (
  <svg className={`animate-spin h-4 w-4 ${className}`} viewBox="0 0 24 24">
    <circle
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
      fill="none"
      opacity="0.15"
    />
    <path
      fill="none"
      stroke="currentColor"
      strokeWidth="4"
      strokeLinecap="round"
      d="M4 12a8 8 0 018-8"
    />
  </svg>
);

const CheckMark = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5 13l4 4L19 7"
    />
  </svg>
);

const TokenToggle = ({ selectedToken, onToggle, collateralInfo, metadataLoading, proposalTokens }) => {
  // Get real ERC20 symbols from enhanced token system
  const getCurrencySymbol = () => {
    if (metadataLoading) return '...';
    
    // Try enhanced token info first
    const enhancedCurrency = proposalTokens.getTokenInfoByType('currencyToken') || 
                            proposalTokens.getTokenInfoByType('baseCurrency');
    if (enhancedCurrency?.symbol) {
      return enhancedCurrency.symbol;
    }
    
    // Fallback to collateralInfo
    return collateralInfo?.currency?.symbol || 'CURRENCY';
  };
  
  const getCompanySymbol = () => {
    if (metadataLoading) return '...';
    
    // Try enhanced token info first  
    const enhancedCompany = proposalTokens.getTokenInfoByType('companyToken') ||
                           proposalTokens.getTokenInfoByType('baseCompany');
    if (enhancedCompany?.symbol) {
      return enhancedCompany.symbol;
    }
    
    // Fallback to collateralInfo
    return collateralInfo?.company?.symbol || 'COMPANY';
  };

  return (
  <div className="flex items-center gap-4 p-4 bg-white border border-gray-300 rounded-lg">
    <button
      onClick={() => onToggle("currency")}
      disabled={metadataLoading}
      className={`px-4 py-2 rounded-md font-medium transition-colors ${
        selectedToken === "currency"
          ? "bg-gray-900"
          : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-300"
      } disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {metadataLoading ? (
        <div className="flex items-center gap-1">
          <LoadingSpinner className="h-3 w-3" />
          <span>...</span>
        </div>
      ) : (
          getCurrencySymbol()
      )}
    </button>
    <button
      onClick={() => onToggle("company")}
      disabled={metadataLoading}
      className={`px-4 py-2 rounded-md font-medium transition-colors ${
        selectedToken === "company"
          ? "bg-gray-900"
          : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-300"
      } disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {metadataLoading ? (
        <div className="flex items-center gap-1">
          <LoadingSpinner className="h-3 w-3" />
          <span>...</span>
        </div>
      ) : (
          getCompanySymbol()
      )}
    </button>
  </div>
);
};

const StepIndicator = ({ 
  stepName,
  description, 
  isActive, 
  isCompleted, 
  tokenType 
}) => {
  const getColors = () => {
    if (isCompleted) {
      return tokenType === "currency" 
        ? "text-blue-600 bg-blue-100" 
        : "text-green-600 bg-green-100";
    }
    if (isActive) {
      return tokenType === "currency" 
        ? "text-blue-600 bg-blue-100" 
        : "text-green-600 bg-green-100";
    }
    return "text-gray-500 bg-gray-100";
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-gray-50">
      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${getColors()}`}>
        {isCompleted ? (
          <CheckMark />
        ) : isActive ? (
          <LoadingSpinner />
        ) : (
          <span className="w-2 h-2 bg-current rounded-full" />
        )}
      </div>
      <span className={`text-sm font-medium ${
        isCompleted || isActive ? "text-gray-900" : "text-gray-600"
      }`}>
        {description}
      </span>
    </div>
  );
};

const CollateralManager = () => {
  const { address: userAddress, isConnected } = useAccount();
  const [action, setAction] = useState('add'); // 'add' or 'remove'
  const [selectedToken, setSelectedToken] = useState('currency');
  const [amount, setAmount] = useState('');

  // Use global proposal context and enhanced token system
  const proposal = useProposalContext();
  const proposalTokens = useProposalTokens();

  const {
    currentStep,
    loading,
    error,
    success,
    txHash,
    handleAddCollateral,
    handleRemoveCollateral,
    resetState,
    collateralInfo,
    metadataLoading,
    steps
  } = useCollateral();

  const handleAction = async () => {
    if (!amount || !selectedToken) return;

    try {
      if (action === 'add') {
        await handleAddCollateral(selectedToken, amount);
      } else {
        await handleRemoveCollateral(selectedToken, amount);
      }
    } catch (err) {
      console.error('Collateral action failed:', err);
    }
  };

  const handleReset = () => {
    resetState();
    setAmount('');
  };

  const isProcessing = loading;
  const isCompleted = currentStep === steps.COMPLETED;
  
  // Define the steps for the current operation
  const operationSteps = [
    { key: 'CHECKING_BALANCE', name: 'Check Balance', description: 'Checking token balance...' },
    { key: 'CHECKING_APPROVAL', name: 'Check Approval', description: 'Checking token approval...' },
    { key: 'APPROVING', name: 'Approve', description: 'Approving tokens...' },
    { key: 'CONFIRMING_APPROVAL', name: 'Confirm Approval', description: 'Confirming approval...' },
    { key: 'EXECUTING', name: 'Execute', description: `${action === 'add' ? 'Adding' : 'Removing'} collateral...` },
    { key: 'CONFIRMING', name: 'Confirm', description: 'Confirming transaction...' },
  ];

  // Get step status
  const getStepStatus = (stepKey) => {
    const stepValues = Object.values(steps);
    const currentStepIndex = stepValues.indexOf(currentStep);
    const thisStepIndex = stepValues.indexOf(steps[stepKey]);
    
    if (thisStepIndex < currentStepIndex || (currentStep === steps.COMPLETED && thisStepIndex < stepValues.length - 1)) {
      return 'completed';
    } else if (currentStep === steps[stepKey]) {
      return 'active';
    } else {
      return 'pending';
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        {proposal.isProposalReady() ? `${proposal.getMarketName()} - Collateral Manager` : 'Collateral Manager'}
        <span className="text-sm font-normal text-gray-600 ml-2">
          with Real ERC20 Token Data
        </span>
      </h2>
      
      {/* Proposal Status */}
      {!proposal.isProposalReady() && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center gap-2">
            {proposal.isLoading() ? (
              <>
                <LoadingSpinner className="w-4 h-4 text-yellow-600" />
                <p className="text-yellow-800">Loading proposal data...</p>
              </>
            ) : proposal.hasError() ? (
              <p className="text-yellow-800">❌ Proposal Error: {proposal.getErrorMessage()}</p>
            ) : (
              <p className="text-yellow-800">⚠️ No proposal loaded - Please load a proposal to use dynamic tokens</p>
            )}
          </div>
        </div>
      )}

      {/* Enhanced Token Status */}
      {proposal.isProposalReady() && proposalTokens.isReady && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-800 font-medium">✅ Real ERC20 Collateral Tokens</p>
              <p className="text-green-700 text-sm">
                Currency: {proposalTokens.getTokenInfoByType('currencyToken')?.symbol || 'Loading...'} • 
                Company: {proposalTokens.getTokenInfoByType('companyToken')?.symbol || 'Loading...'}
              </p>
            </div>
            {proposalTokens.lastUpdated && (
              <span className="text-green-600 text-xs">
                {proposalTokens.lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      )}
      
      {/* Wallet Connection Status */}
      {!isConnected && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-yellow-800">Please connect your wallet to continue.</p>
        </div>
      )}

      {/* Action Toggle */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Action</label>
        <div className="flex gap-2">
          <button
            onClick={() => setAction('add')}
            disabled={isProcessing}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              action === 'add'
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-300"
            }`}
          >
            Add Collateral
          </button>
          <button
            onClick={() => setAction('remove')}
            disabled={isProcessing}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              action === 'remove'
                ? "bg-red-600 text-white"
                : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-300"
            }`}
          >
            Remove Collateral
          </button>
        </div>
      </div>

      {/* Token Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Token</label>
        <TokenToggle 
          selectedToken={selectedToken} 
          onToggle={(token) => setSelectedToken(token)}
          collateralInfo={collateralInfo}
          metadataLoading={metadataLoading}
          proposalTokens={proposalTokens}
        />
        
        {/* Token Info */}
        <div className="mt-2 text-sm text-gray-600">
          {metadataLoading || proposalTokens.loading ? (
            <div className="flex items-center gap-1">
              <LoadingSpinner className="h-3 w-3" />
              <span>Loading token information...</span>
            </div>
          ) : proposalTokens.isReady ? (
            (() => {
              const tokenKey = selectedToken === 'currency' ? 'currencyToken' : 'companyToken';
              const enhancedToken = proposalTokens.getTokenInfoByType(tokenKey);
              
              if (enhancedToken) {
                return (
                  <div className="space-y-1">
                    <div>
                      <strong>Selected:</strong> {enhancedToken.name} ({enhancedToken.symbol})
                    </div>
                    <div className="text-xs text-green-600">
                      ✅ Real ERC20 Data • Decimals: {enhancedToken.decimals}
                    </div>
                  </div>
                );
              }
              
              // Fallback to collateralInfo
              return `Selected: ${collateralInfo[selectedToken]?.name || 'Unknown'} (${collateralInfo[selectedToken]?.symbol || 'Unknown'})`;
            })()
          ) : (
            `Selected: ${collateralInfo[selectedToken]?.name || 'Unknown'} (${collateralInfo[selectedToken]?.symbol || 'Unknown'})`
          )}
        </div>
      </div>

      {/* Amount Input */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Amount</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.0"
          disabled={isProcessing || metadataLoading}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
        />
      </div>

      {/* Steps Display */}
      {(isProcessing || isCompleted) && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {action === 'add' ? 'Adding Collateral' : 'Removing Collateral'}
          </h3>
          <div className="space-y-3">
            {operationSteps.map((step) => {
              const status = getStepStatus(step.key);
              
              return (
                <StepIndicator
                  key={step.key}
                  stepName={step.name}
                  description={step.description}
                  isActive={status === 'active'}
                  isCompleted={status === 'completed'}
                  tokenType={selectedToken}
                />
              );
            })}
          </div>
          
          {/* Transaction Hash */}
          {txHash && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-blue-800 text-sm">
                <span className="font-medium">Transaction Hash:</span>
                <span className="font-mono break-all ml-2">{txHash}</span>
              </div>
            </div>
          )}
          
          {/* Completion Message */}
          {isCompleted && success && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2">
                <CheckMark />
                <span className="text-green-800 font-medium">{success}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-red-700">
            <h3 className="text-sm font-medium">Error</h3>
            <p className="text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        {isCompleted ? (
          <button
            onClick={handleReset}
            className="flex-1 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Start New Transaction
          </button>
        ) : (
          <>
            <button
              onClick={handleAction}
              disabled={!isConnected || !amount || isProcessing || metadataLoading}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <LoadingSpinner />
                  Processing...
                </>
              ) : (
                `${action === 'add' ? 'Add' : 'Remove'} Collateral`
              )}
            </button>
            
            {(isProcessing || error) && (
              <button
                onClick={handleReset}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Reset
              </button>
            )}
          </>
        )}
      </div>

      {/* Debug Info */}
      {currentStep && (
        <div className="mt-6 p-3 bg-gray-100 rounded-lg">
          <h4 className="text-sm font-medium text-gray-700">Debug Info:</h4>
          <p className="text-xs text-gray-600">
            Current Step: {currentStep}
          </p>
          {txHash && (
            <p className="text-xs text-gray-600">
              TX Hash: {txHash}
            </p>
          )}
          <p className="text-xs text-gray-600">
            Token Metadata: {JSON.stringify(collateralInfo, null, 2)}
          </p>
        </div>
      )}
    </div>
  );
};

export default CollateralManager; 