import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useSwap } from '../hooks/useSwap';
import { ALL_TOKENS } from '../constants/addresses';
import { ethers } from 'ethers';

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

const ExternalLink = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
    />
  </svg>
);

const TransactionStatus = ({ result, onCheckStatus }) => {
  const [checking, setChecking] = useState(false);
  
  if (!result) return null;

  const handleCheckStatus = async () => {
    if (onCheckStatus) {
      setChecking(true);
      await onCheckStatus();
      setChecking(false);
    }
  };

  const getStatusColor = (success) => {
    if (success === true) return 'text-green-600 bg-green-50 border-green-200';
    if (success === false) return 'text-red-600 bg-red-50 border-red-200';
    return 'text-blue-600 bg-blue-50 border-blue-200';
  };

  const getStatusIcon = (success) => {
    if (success === true) return <CheckMark />;
    if (success === false) return '✗';
    return <LoadingSpinner />;
  };

  return (
    <div className={`p-4 border rounded-lg ${getStatusColor(result.success)}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium flex items-center gap-2">
          {getStatusIcon(result.success)}
          {result.success === true ? 'Transaction Successful' : 
           result.success === false ? 'Transaction Failed' : 'Transaction Processing'}
        </h3>
        {result.trackingInfo?.canTrack && (
          <button
            onClick={handleCheckStatus}
            disabled={checking}
            className="text-sm px-2 py-1 rounded bg-white border hover:bg-gray-50 disabled:opacity-50"
          >
            {checking ? <LoadingSpinner className="mx-2" /> : 'Check Status'}
          </button>
        )}
      </div>
      
      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span>Strategy:</span>
          <span className="font-mono">{result.strategy}</span>
        </div>
        
        <div className="flex items-center justify-between">
          <span>{result.trackingInfo?.trackingMethod === 'order_based' ? 'Order ID:' : 'Transaction Hash:'}</span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs">
              {result.hash?.substring(0, 10)}...{result.hash?.substring(result.hash.length - 8)}
            </span>
            {result.explorerUrl && (
              <a
                href={result.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800"
              >
                <ExternalLink />
              </a>
            )}
          </div>
        </div>

        {result.trackingInfo?.blockNumber && (
          <div className="flex items-center justify-between">
            <span>Block Number:</span>
            <span className="font-mono">{result.trackingInfo.blockNumber}</span>
          </div>
        )}

        {result.trackingInfo?.gasUsed && (
          <div className="flex items-center justify-between">
            <span>Gas Used:</span>
            <span className="font-mono">{Number(result.trackingInfo.gasUsed).toLocaleString()}</span>
          </div>
        )}

        {result.trackingInfo?.orderStatus && (
          <div className="flex items-center justify-between">
            <span>Order Status:</span>
            <span className="font-mono capitalize">{result.trackingInfo.orderStatus.status}</span>
          </div>
        )}

        {result.timestamp && (
          <div className="flex items-center justify-between">
            <span>Time:</span>
            <span className="text-xs">{new Date(result.timestamp).toLocaleTimeString()}</span>
          </div>
        )}
      </div>

      {result.trackingInfo?.trackingMethod === 'order_based' && (
        <div className="mt-3 p-2 bg-blue-100 rounded text-xs">
          ℹ️ CoW orders are processed in batches and may take a few minutes to complete.
        </div>
      )}
    </div>
  );
};

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
                {info?.features && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {info.features.map((feature) => (
                      <span
                        key={feature}
                        className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded"
                      >
                        {feature.replace('_', ' ')}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
};

const QuoteDisplay = ({ quotes, quotesLoading, selectedStrategy }) => {
  if (quotesLoading) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-2">
          <LoadingSpinner />
          <span className="text-sm text-gray-600">Getting quotes...</span>
        </div>
      </div>
    );
  }

  if (Object.keys(quotes).length === 0) {
    return null;
  }

  return (
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
                {quote.slippageBps !== undefined && (
                  <div>Slippage: {quote.slippageBps / 100}%</div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const ApprovalStatus = ({ 
  tokenIn, 
  amount, 
  selectedStrategy, 
  getAvailableStrategies, 
  getStrategyInfo, 
  checkApprovalNeeded,
  userAddress,
  disabled 
}) => {
  const [approvalStatuses, setApprovalStatuses] = useState({});
  const [checking, setChecking] = useState(false);

  const checkApprovals = async () => {
    if (!tokenIn || !amount || !userAddress) {
      setApprovalStatuses({});
      return;
    }

    setChecking(true);
    const strategies = getAvailableStrategies();
    const statuses = {};

    await Promise.allSettled(
      strategies.map(async (strategy) => {
        try {
          const needsApproval = await checkApprovalNeeded({
            tokenIn,
            amount: ethers.utils.parseUnits(amount, 18),
            strategyType: strategy,
            userAddress
          });
          
          const strategyInfo = getStrategyInfo(strategy);
          statuses[strategy] = {
            needsApproval,
            approvalAddress: strategyInfo?.approvalAddress || 'Unknown',
            approvalAddressName: strategyInfo?.approvalAddressName || 'Unknown Contract',
            strategyName: strategyInfo?.name || strategy
          };
        } catch (error) {
          console.error(`Approval check failed for ${strategy}:`, error);
          statuses[strategy] = {
            needsApproval: true,
            error: error.message,
            strategyName: getStrategyInfo(strategy)?.name || strategy
          };
        }
      })
    );

    setApprovalStatuses(statuses);
    setChecking(false);
  };

  // Auto-check when tokenIn, amount, or userAddress changes
  useEffect(() => {
    const timer = setTimeout(() => {
      checkApprovals();
    }, 500); // Debounce

    return () => clearTimeout(timer);
  }, [tokenIn, amount, userAddress]);

  if (!tokenIn || !amount || !userAddress || Object.keys(approvalStatuses).length === 0) {
    return null;
  }

  const getTokenSymbol = (tokenAddress) => {
    const entry = Object.entries(ALL_TOKENS).find(([symbol, address]) => 
      address.toLowerCase() === tokenAddress.toLowerCase()
    );
    return entry ? entry[0] : tokenAddress.substring(0, 6) + '...';
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700">
          Approval Status for {getTokenSymbol(tokenIn)}
        </h4>
        <button
          onClick={checkApprovals}
          disabled={checking || disabled}
          className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50"
        >
          {checking ? <LoadingSpinner className="w-3 h-3" /> : 'Refresh'}
        </button>
      </div>
      
      <div className="space-y-2">
        {Object.entries(approvalStatuses).map(([strategy, status]) => (
          <div
            key={strategy}
            className={`p-3 border rounded-lg ${
              strategy === selectedStrategy 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-200 bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{status.strategyName}</span>
                {strategy === selectedStrategy && (
                  <span className="text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded">
                    Selected
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                {status.error ? (
                  <span className="text-xs text-red-600">Error</span>
                ) : status.needsApproval ? (
                  <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                    Approval Needed
                  </span>
                ) : (
                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                    ✓ Approved
                  </span>
                )}
              </div>
            </div>
            
            <div className="text-xs text-gray-600 mt-2 space-y-1">
              {status.error ? (
                <div className="text-red-600">Error: {status.error}</div>
              ) : (
                <>
                  <div>
                    <span className="text-gray-500">Token:</span> <span className="font-mono">{getTokenSymbol(tokenIn)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Spender:</span> <span className="font-mono text-xs">{status.approvalAddressName}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Address:</span> <span className="font-mono text-xs">{status.approvalAddress?.substring(0, 10)}...{status.approvalAddress?.substring(status.approvalAddress.length - 8)}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
      
      <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
        💡 Each strategy requires approval to spend your {getTokenSymbol(tokenIn)} tokens from different contracts:
        <br />• <strong>Algebra:</strong> Swapr V3 Router for direct swaps
        <br />• <strong>CoW Swap:</strong> Vault Relayer for batch auctions
      </div>
    </div>
  );
};

const SwapManager = () => {
  const { address: userAddress, isConnected } = useAccount();
  const [tokenIn, setTokenIn] = useState('');
  const [tokenOut, setTokenOut] = useState('');
  const [amount, setAmount] = useState('');
  const [showQuotes, setShowQuotes] = useState(false);

  const {
    loading,
    error,
    result,
    currentStep,
    selectedStrategy,
    quotes,
    quotesLoading,
    executeSwap,
    executeSwapWithFallback,
    getQuote,
    getMultipleQuotes,
    checkApprovalNeeded,
    checkTransactionStatus,
    reset,
    setSelectedStrategy,
    getAvailableStrategies,
    getStrategyInfo,
    strategies
  } = useSwap();

  // Function to check transaction status manually
  const handleCheckTransactionStatus = async () => {
    if (!result?.hash) return;
    
    try {
      const status = await checkTransactionStatus(result.hash);
      console.log('Transaction status:', status);
      // You could update UI state here based on the status
      if (status?.status) {
        // Could show a toast or update result state
        alert(`Transaction status: ${status.status}`);
      }
    } catch (error) {
      console.error('Failed to check transaction status:', error);
      alert('Failed to check transaction status');
    }
  };

  const handleSwap = async () => {
    if (!tokenIn || !tokenOut || !amount) return;

    try {
      await executeSwap({
        tokenIn,
        tokenOut,
        amount: ethers.utils.parseUnits(amount, 18)
      });
    } catch (err) {
      console.error('Swap failed:', err);
    }
  };

  const handleSwapWithFallback = async () => {
    if (!tokenIn || !tokenOut || !amount) return;

    try {
      const fallbackStrategies = getAvailableStrategies().filter(s => s !== selectedStrategy);
      await executeSwapWithFallback(
        {
          tokenIn,
          tokenOut,
          amount: ethers.utils.parseUnits(amount, 18)
        },
        fallbackStrategies
      );
    } catch (err) {
      console.error('Swap with fallback failed:', err);
    }
  };

  const handleGetQuotes = async () => {
    if (!tokenIn || !tokenOut || !amount) return;

    setShowQuotes(true);
    await getMultipleQuotes({
      tokenIn,
      tokenOut,
      amount: ethers.utils.parseUnits(amount, 18)
    });
  };

  const handleReset = () => {
    reset();
    setShowQuotes(false);
  };

  const isFormValid = tokenIn && tokenOut && amount && isConnected;
  const isProcessing = loading;

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Swap Manager</h2>
      
      {/* Wallet Connection Status */}
      {!isConnected && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-yellow-800">Please connect your wallet to continue.</p>
        </div>
      )}

      {/* Strategy Selection */}
      <div className="mb-6">
        <StrategySelector
          selectedStrategy={selectedStrategy}
          onStrategyChange={setSelectedStrategy}
          getAvailableStrategies={getAvailableStrategies}
          getStrategyInfo={getStrategyInfo}
          disabled={isProcessing}
        />
      </div>

      {/* Token Inputs */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Token In</label>
          <select
            value={tokenIn}
            onChange={(e) => setTokenIn(e.target.value)}
            disabled={isProcessing}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select token...</option>
            {Object.entries(ALL_TOKENS).map(([symbol, address]) => (
              <option key={address} value={address}>{symbol}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Token Out</label>
          <select
            value={tokenOut}
            onChange={(e) => setTokenOut(e.target.value)}
            disabled={isProcessing}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select token...</option>
            {Object.entries(ALL_TOKENS).map(([symbol, address]) => (
              <option key={address} value={address}>{symbol}</option>
            ))}
          </select>
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
          disabled={isProcessing}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Quotes Display */}
      {showQuotes && (
        <div className="mb-6">
          <QuoteDisplay
            quotes={quotes}
            quotesLoading={quotesLoading}
            selectedStrategy={selectedStrategy}
          />
        </div>
      )}

      {/* Approval Status */}
      <div className="mb-6">
        <ApprovalStatus
          tokenIn={tokenIn}
          amount={amount}
          selectedStrategy={selectedStrategy}
          getAvailableStrategies={getAvailableStrategies}
          getStrategyInfo={getStrategyInfo}
          checkApprovalNeeded={checkApprovalNeeded}
          userAddress={userAddress}
          disabled={isProcessing}
        />
      </div>

      {/* Current Step Display */}
      {currentStep && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2">
            {loading ? <LoadingSpinner /> : <CheckMark />}
            <span className="text-blue-800 font-medium">{currentStep}</span>
          </div>
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

      {/* Transaction Status Display */}
      {result && (
        <div className="mb-6">
          <TransactionStatus 
            result={result} 
            onCheckStatus={handleCheckTransactionStatus}
          />
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-3">
        {/* Get Quotes Button */}
        <button
          onClick={handleGetQuotes}
          disabled={!isFormValid || isProcessing}
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

        {/* Swap Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            onClick={handleSwap}
            disabled={!isFormValid || isProcessing}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <LoadingSpinner />
                Processing...
              </>
            ) : (
              `Swap via ${getStrategyInfo(selectedStrategy)?.name || selectedStrategy}`
            )}
          </button>

          <button
            onClick={handleSwapWithFallback}
            disabled={!isFormValid || isProcessing}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <LoadingSpinner />
                Processing...
              </>
            ) : (
              'Swap with Auto Fallback'
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

      {/* Debug Info */}
      <div className="mt-6 p-3 bg-gray-100 rounded-lg">
        <h4 className="text-sm font-medium text-gray-700">Debug Info:</h4>
        <div className="text-xs text-gray-600 space-y-1">
          <div>Selected Strategy: {selectedStrategy}</div>
          <div>Available Strategies: {getAvailableStrategies().join(', ')}</div>
          <div>Connected: {isConnected ? 'Yes' : 'No'}</div>
          {userAddress && <div>Address: {userAddress}</div>}
        </div>
      </div>
    </div>
  );
};

export default SwapManager; 