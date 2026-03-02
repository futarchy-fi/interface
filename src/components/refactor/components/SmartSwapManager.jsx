import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useSmartSwap } from '../hooks/useSmartSwap';
import { useBalances } from '../hooks/useBalances';
import { useProposalContext } from '../context/ProposalContext';
import { useProposalTokens } from '../hooks/useProposalTokens';
import { ethers } from 'ethers';
import SmartSwapAnalysis from './SmartSwapAnalysis';

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

const StrategySelector = ({ 
  selectedStrategy, 
  onStrategyChange, 
  getAvailableStrategies, 
  getStrategyInfo,
  disabled 
}) => {
  const strategies = getAvailableStrategies();

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">Swap Strategy</label>
      <div className="space-y-2">
        {strategies.map((strategy) => {
          const info = getStrategyInfo(strategy);
          return (
            <label key={strategy} className="flex items-start space-x-3 cursor-pointer">
              <input
                type="radio"
                name="strategy"
                value={strategy}
                checked={selectedStrategy === strategy}
                onChange={(e) => onStrategyChange(e.target.value)}
                disabled={disabled}
                className="mt-1 form-radio text-blue-600 focus:ring-blue-500"
              />
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <span className="font-medium text-gray-900">{info?.name || strategy}</span>
                  {!info?.gasRequired && (
                    <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                      Gasless
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600">{info?.description}</p>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
};

const TokenBalance = ({ tokenAddress, metadata, balancesHook }) => {
  if (!tokenAddress || !metadata) return null;

  // Find the balance key for this token
  const tokenEntry = Object.entries(metadata).find(([key, data]) => 
    data.address?.toLowerCase() === tokenAddress.toLowerCase()
  );

  if (!tokenEntry) return null;

  const [balanceKey, tokenData] = tokenEntry;
  const balance = balancesHook.getBalance(balanceKey);

  return (
    <div className="text-xs text-gray-600 mt-1">
      Balance: <span className="font-mono">{balance} {tokenData.symbol}</span>
    </div>
  );
};

const SmartSwapManager = () => {
  const { address: userAddress, isConnected } = useAccount();
  const [tokenIn, setTokenIn] = useState('');
  const [tokenOut, setTokenOut] = useState('');
  const [amount, setAmount] = useState('');

  // Use global proposal context and enhanced token hook
  const proposal = useProposalContext();
  const proposalTokens = useProposalTokens();
  const balancesHook = useBalances();

  const {
    // Smart swap functionality
    tokenAnalysis,
    analysisLoading,
    autoSplitEnabled,
    setAutoSplitEnabled,
    executionPlan,
    currentAction,
    executeSmartSwap,
    executeAction,
    analyzeToken,
    getSuggestions,
    resetSmartSwap,
    canExecuteSmartSwap,
    requiresManualAction,
    isConditionalToken,

    // Step tracking functionality
    processingStep,
    currentSubstep,
    completedSubsteps,
    expandedSteps,
    toggleStepExpansion,
    stepError,
    stepsData,

    // Approval tracking functionality
    approvalStatus,
    approvalLoading,
    checkApprovalStatus,

    // Regular swap functionality
    loading,
    error,
    result,
    currentStep,
    selectedStrategy,
    setSelectedStrategy,
    getAvailableStrategies,
    getStrategyInfo,
    executeSwap,
    quotes,
    quotesLoading,
    getMultipleQuotes,
    
    // Manual refresh for debugging
    manualRefreshApproval
  } = useSmartSwap();

  const handleSmartSwap = async () => {
    if (!tokenIn || !tokenOut || !amount) return;

    try {
      await executeSmartSwap({
        tokenIn,
        tokenOut,
        amount
      });
    } catch (err) {
      console.error('Smart swap failed:', err);
    }
  };

  const handleRegularSwap = async () => {
    if (!tokenIn || !tokenOut || !amount) return;

    try {
      await executeSwap({
        tokenIn,
        tokenOut,
        amount: ethers.utils.parseUnits(amount, 18)
      });
    } catch (err) {
      console.error('Regular swap failed:', err);
    }
  };

  const handleGetQuotes = async () => {
    if (!tokenIn || !tokenOut || !amount) return;

    await getMultipleQuotes({
      tokenIn,
      tokenOut,
      amount: ethers.utils.parseUnits(amount, 18)
    });
  };

  const handleReset = () => {
    resetSmartSwap();
    setTokenIn('');
    setTokenOut('');
    setAmount('');
  };

  const isFormValid = tokenIn && tokenOut && amount && isConnected;
  const isProcessing = loading || processingStep;
  
  // Use the enhanced hook's conditional token detection
  const isConditionalTokenIn = tokenIn ? proposalTokens.isConditionalToken(tokenIn) : false;

  // Helper to get current step description for button
  const getSmartSwapButtonText = () => {
    if (!isProcessing) {
      return (
        <>
          🧠 Smart Swap
          {isConditionalTokenIn && (
            <span className="text-xs">(Auto-Split)</span>
          )}
        </>
      );
    }

    if (processingStep === 1) {
      return (
        <>
          <LoadingSpinner />
          Step 1: Adding Collateral...
        </>
      );
    }

    if (processingStep === 2) {
      return (
        <>
          <LoadingSpinner />
          Step 2: Processing Swap...
        </>
      );
    }

    if (processingStep === 'completed') {
      return '✅ Swap Completed';
    }

    return (
      <>
        <LoadingSpinner />
        Processing...
      </>
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        {proposal.isProposalReady() ? `${proposal.getMarketName()} - Smart Swap Manager` : 'Smart Swap Manager'}
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

      {/* Token Loading Status */}
      {proposal.isProposalReady() && proposalTokens.loading && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2">
            <LoadingSpinner className="w-4 h-4 text-blue-600" />
            <p className="text-blue-800">📡 Reading token data from contracts...</p>
          </div>
        </div>
      )}

      {/* Token Error Status */}
      {proposalTokens.error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center justify-between">
            <p className="text-red-800">❌ Token Loading Error: {proposalTokens.error}</p>
            <button
              onClick={proposalTokens.refreshTokens}
              className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      )}
      
      {/* Wallet Connection Status */}
      {!isConnected && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-yellow-800">Please connect your wallet to continue.</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Swap Interface */}
        <div className="space-y-6">
          {/* Strategy Selection */}
          <div>
            <StrategySelector
              selectedStrategy={selectedStrategy}
              onStrategyChange={setSelectedStrategy}
              getAvailableStrategies={getAvailableStrategies}
              getStrategyInfo={getStrategyInfo}
              disabled={isProcessing || !proposalTokens.isReady}
            />
          </div>

          {/* Token Inputs */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Token In
                {isConditionalTokenIn && (
                  <span className="ml-2 text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                    Conditional
                  </span>
                )}
                {proposalTokens.loading && (
                  <span className="ml-2 text-xs text-blue-600 flex items-center gap-1">
                    <LoadingSpinner className="w-3 h-3" />
                    Loading...
                  </span>
                )}
              </label>
              <select
                value={tokenIn}
                onChange={(e) => setTokenIn(e.target.value)}
                disabled={isProcessing || !proposalTokens.isReady}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              >
                <option value="">
                  {proposalTokens.isReady ? 'Select token...' : 
                   proposalTokens.loading ? 'Loading tokens...' : 
                   !proposal.isProposalReady() ? 'Load proposal first...' : 
                   'Token loading failed'}
                </option>
                {proposalTokens.getTokenOptions().map((token) => {
                  const key = token.address || token.symbol;
                  return (
                    <option key={key} value={token.address} disabled={token.disabled}>
                      {token.symbol} {token.isConditional ? '(Conditional)' : ''} - {token.category}
                  </option>
                  );
                })}
              </select>
              <TokenBalance 
                tokenAddress={tokenIn} 
                metadata={balancesHook.metadata} 
                balancesHook={balancesHook} 
              />
              
              {/* Show enhanced token info */}
              {proposalTokens.isReady && tokenIn && (
                <div className="mt-1 text-xs space-y-1">
                  {(() => {
                    const tokenInfo = proposalTokens.getTokenInfoByAddress(tokenIn);
                    return tokenInfo ? (
                      <>
                        <div className="text-purple-600">
                          From: {proposal.getMarketName()}
                        </div>
                        <div className="text-gray-600">
                          {tokenInfo.name} • Decimals: {tokenInfo.decimals}
                        </div>
                        {tokenInfo.error && (
                          <div className="text-red-500">
                            ⚠️ {tokenInfo.error}
                          </div>
                        )}
                      </>
                    ) : null;
                  })()}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Token Out
                {proposalTokens.loading && (
                  <span className="ml-2 text-xs text-blue-600 flex items-center gap-1">
                    <LoadingSpinner className="w-3 h-3" />
                    Loading...
                  </span>
                )}
              </label>
              <select
                value={tokenOut}
                onChange={(e) => setTokenOut(e.target.value)}
                disabled={isProcessing || !proposalTokens.isReady}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              >
                <option value="">
                  {proposalTokens.isReady ? 'Select token...' : 
                   proposalTokens.loading ? 'Loading tokens...' : 
                   !proposal.isProposalReady() ? 'Load proposal first...' : 
                   'Token loading failed'}
                </option>
                {proposalTokens.getTokenOptions().map((token) => {
                  const key = token.address || token.symbol;
                  return (
                    <option key={key} value={token.address} disabled={token.disabled}>
                      {token.symbol} {token.isConditional ? '(Conditional)' : ''} - {token.category}
                  </option>
                  );
                })}
              </select>
              <TokenBalance 
                tokenAddress={tokenOut} 
                metadata={balancesHook.metadata} 
                balancesHook={balancesHook} 
              />
              
              {/* Show enhanced token info */}
              {proposalTokens.isReady && tokenOut && (
                <div className="mt-1 text-xs space-y-1">
                  {(() => {
                    const tokenInfo = proposalTokens.getTokenInfoByAddress(tokenOut);
                    return tokenInfo ? (
                      <>
                        <div className="text-purple-600">
                          From: {proposal.getMarketName()}
                        </div>
                        <div className="text-gray-600">
                          {tokenInfo.name} • Decimals: {tokenInfo.decimals}
                        </div>
                        {tokenInfo.error && (
                          <div className="text-red-500">
                            ⚠️ {tokenInfo.error}
                          </div>
                        )}
                      </>
                    ) : null;
                  })()}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Amount
                {analysisLoading && (
                  <span className="ml-2 text-xs text-blue-600 flex items-center gap-1">
                    <LoadingSpinner className="w-3 h-3" />
                    Analyzing...
                  </span>
                )}
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.0"
                disabled={isProcessing || !proposalTokens.isReady}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            {/* Get Quotes Button */}
            <button
              onClick={handleGetQuotes}
              disabled={!isFormValid || isProcessing || !proposalTokens.isReady}
              className="w-full px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {quotesLoading ? (
                <>
                  <LoadingSpinner />
                  Getting Quotes...
                </>
              ) : (
                'Get Quotes from All Strategies'
              )}
            </button>

            {/* Smart Swap vs Regular Swap */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                onClick={handleSmartSwap}
                disabled={!isFormValid || isProcessing || (!canExecuteSmartSwap && requiresManualAction) || !proposalTokens.isReady}
                className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {getSmartSwapButtonText()}
              </button>

              <button
                onClick={handleRegularSwap}
                disabled={!isFormValid || isProcessing || !proposalTokens.isReady}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <LoadingSpinner />
                    Processing...
                  </>
                ) : (
                  'Regular Swap'
                )}
              </button>
            </div>

            {/* Reset Button */}
            {(result || error) && (
              <button
                onClick={handleReset}
                className="w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Start New Swap
              </button>
            )}
          </div>

          {/* Enhanced Proposal Token Summary */}
          {proposalTokens.isReady && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">📋 Current Proposal Tokens</h4>
              <div className="text-sm text-blue-800 space-y-1">
                <div><strong>Market:</strong> {proposal.getMarketName()}</div>
                <div><strong>Total Tokens:</strong> {proposalTokens.stats.totalTokens}</div>
                <div><strong>Base Tokens:</strong> {proposalTokens.stats.baseTokens}</div>
                <div><strong>Conditional Tokens:</strong> {proposalTokens.stats.conditionalTokens}</div>
                
                {proposalTokens.lastUpdated && (
                  <div className="text-xs text-blue-600 mt-2">
                    Last updated: {proposalTokens.lastUpdated.toLocaleTimeString()}
                  </div>
                )}
                
                <div className="grid grid-cols-1 gap-1 mt-2 text-xs">
                  {proposalTokens.getTokenOptions().filter(t => !t.disabled).map(token => (
                    <div key={token.address} className="flex items-center justify-between">
                      <span className={`px-1 py-0.5 rounded text-xs ${
                        token.isConditional ? 'bg-purple-100 text-purple-700' : 
                        token.isNative ? 'bg-blue-100 text-blue-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {token.symbol}
                      </span>
                      <span className="text-blue-600">{token.category}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Smart Analysis & Status */}
        <div className="space-y-6">
          {/* Smart Swap Analysis */}
          <SmartSwapAnalysis
            tokenIn={tokenIn}
            amount={amount}
            tokenAnalysis={tokenAnalysis}
            analysisLoading={analysisLoading}
            autoSplitEnabled={autoSplitEnabled}
            setAutoSplitEnabled={setAutoSplitEnabled}
            executionPlan={executionPlan}
            currentAction={currentAction}
            executeAction={executeAction}
            getSuggestions={getSuggestions}
            isConditionalToken={proposalTokens.isConditionalToken}
            onAnalyzeToken={analyzeToken}
            // Step tracking props
            processingStep={processingStep}
            currentSubstep={currentSubstep}
            completedSubsteps={completedSubsteps}
            expandedSteps={expandedSteps}
            toggleStepExpansion={toggleStepExpansion}
            stepError={stepError}
            stepsData={stepsData}
            // Approval tracking props
            approvalStatus={approvalStatus}
            approvalLoading={approvalLoading}
            checkApprovalStatus={checkApprovalStatus}
            manualRefreshApproval={manualRefreshApproval}
            // Quote data
            quotes={quotes}
            // Error handling
            error={error}
            result={result}
            currentStep={currentStep}
          />

          {/* Current Step Display */}
          {currentStep && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2">
                {loading ? <LoadingSpinner /> : <CheckMark />}
                <span className="text-blue-800 font-medium">{currentStep}</span>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="text-red-700">
                <h3 className="text-sm font-medium">Error</h3>
                <p className="text-sm mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Success Display */}
          {result && !error && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="text-green-700">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <CheckMark />
                  Swap Completed Successfully
                </h3>
                <div className="text-sm mt-2 space-y-1">
                  <div>Strategy: {result.strategy}</div>
                  <div>Hash: {result.hash}</div>
                  {result.trackingInfo?.explorerUrl && (
                    <div>
                      <a 
                        href={result.trackingInfo.explorerUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        View on Explorer →
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Quotes Display */}
          {Object.keys(quotes).length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-700">Available Quotes</h4>
              <div className="space-y-2">
                {Object.entries(quotes).map(([strategy, quote]) => (
                  <div
                    key={strategy}
                    className={`p-3 border rounded-lg ${
                      strategy === selectedStrategy ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-medium text-sm">{strategy}</span>
                      {strategy === selectedStrategy && (
                        <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded">
                          Selected
                        </span>
                      )}
                    </div>
                    {quote.error ? (
                      <p className="text-xs text-red-600 mt-1">{quote.error}</p>
                    ) : (
                      <div className="text-xs text-gray-600 mt-1">
                        {quote.estimatedOutput && (
                          <div>Output: {ethers.utils.formatUnits(quote.estimatedOutput, 18)} tokens</div>
                        )}
                        {quote.price && (
                          <div>Price: {quote.price}</div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Enhanced Debug Info */}
      <div className="mt-6 p-3 bg-gray-100 rounded-lg">
        <h4 className="text-sm font-medium text-gray-700">Enhanced Debug Info:</h4>
        <div className="text-xs text-gray-600 space-y-1">
          <div>Selected Strategy: {selectedStrategy}</div>
          <div>Connected: {isConnected ? 'Yes' : 'No'}</div>
          <div>Proposal Ready: {proposal.isProposalReady() ? 'Yes' : 'No'}</div>
          <div>Tokens Ready: {proposalTokens.isReady ? 'Yes' : 'No'}</div>
          <div>Tokens Loading: {proposalTokens.loading ? 'Yes' : 'No'}</div>
          <div>Conditional Token In: {isConditionalTokenIn ? 'Yes' : 'No'}</div>
          <div>Can Execute Smart Swap: {canExecuteSmartSwap ? 'Yes' : 'No'}</div>
          <div>Requires Manual Action: {requiresManualAction ? 'Yes' : 'No'}</div>
          {userAddress && <div>Address: {userAddress}</div>}
          {tokenIn && (
            <div>Token In Info: {proposalTokens.getTokenInfoByAddress(tokenIn)?.symbol || 'Not found'}</div>
          )}
          {tokenOut && (
            <div>Token Out Info: {proposalTokens.getTokenInfoByAddress(tokenOut)?.symbol || 'Not found'}</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SmartSwapManager; 