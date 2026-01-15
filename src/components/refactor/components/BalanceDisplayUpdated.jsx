import { useState } from 'react';
import { useBalances } from '../hooks/useBalances';
import { useProposalContext, useProposalReady } from '../context/ProposalContext';
import { formatBalance } from '../utils/balanceUtils';

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

const RefreshIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const TokenBalanceRow = ({ tokenKey, balance, metadata, highlight = false, proposal }) => {
  const balanceNum = parseFloat(balance);
  const hasBalance = balanceNum > 0;
  
  // Enhanced metadata with proposal info
  const displayMetadata = {
    ...metadata,
    // Show if this token is from the current proposal
    isProposalToken: proposal && metadata.address && 
      Object.values(proposal.getTokens()).includes(metadata.address?.toLowerCase())
  };
  
  return (
    <div className={`flex justify-between items-center p-3 rounded-lg transition-colors ${
      highlight ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50 hover:bg-gray-100'
    }`}>
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <span className={`font-medium ${hasBalance ? 'text-gray-900' : 'text-gray-600'}`}>
            {displayMetadata.symbol}
          </span>
          {displayMetadata.isProposalToken && (
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
              Current Proposal
            </span>
          )}
        </div>
        <span className="text-xs text-gray-500">{displayMetadata.name}</span>
      </div>
      
      <div className="flex flex-col items-end">
        <span className={`font-mono ${hasBalance ? 'text-gray-900 font-semibold' : 'text-gray-500'}`}>
          {formatBalance(balance)}
        </span>
        {displayMetadata.address && displayMetadata.address !== 'native' && (
          <span className="text-xs text-gray-400 font-mono">
            {displayMetadata.address.slice(0, 6)}...{displayMetadata.address.slice(-4)}
          </span>
        )}
      </div>
    </div>
  );
};

const TokenSection = ({ title, tokens, balances, metadata, highlight = false, proposal }) => (
  <div className="space-y-3">
    <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
    <div className="space-y-2">
      {tokens.map(tokenKey => (
        <TokenBalanceRow
          key={tokenKey}
          tokenKey={tokenKey}
          balance={balances[tokenKey]}
          metadata={metadata[tokenKey]}
          highlight={highlight && parseFloat(balances[tokenKey]) > 0}
          proposal={proposal}
        />
      ))}
    </div>
  </div>
);

const ProposalStatusBanner = ({ proposal }) => {
  if (proposal.isProposalReady()) {
    return (
      <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-green-800 font-medium">✅ Proposal Loaded:</p>
            <p className="text-green-700 text-sm">{proposal.getMarketName()}</p>
            <p className="text-green-600 font-mono text-xs">
              {proposal.proposalAddress?.slice(0, 8)}...{proposal.proposalAddress?.slice(-6)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-green-600">
              Showing balances for current proposal tokens
            </p>
            <p className="text-xs text-green-500">
              {Object.keys(proposal.getTokens()).length} tokens configured
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (proposal.isLoading()) {
    return (
      <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="flex items-center gap-2">
          <LoadingSpinner className="text-yellow-600" />
          <p className="text-yellow-800">Loading proposal data...</p>
        </div>
      </div>
    );
  }

  if (proposal.hasError()) {
    return (
      <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-800 font-medium">❌ Proposal Error:</p>
        <p className="text-red-700 text-sm">{proposal.getErrorMessage()}</p>
      </div>
    );
  }

  return (
    <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
      <p className="text-gray-700">No proposal loaded - token metadata will use default values</p>
    </div>
  );
};

const BalanceDisplayUpdated = () => {
  const [showOnlyNonZero, setShowOnlyNonZero] = useState(false);
  const [showOnlyProposalTokens, setShowOnlyProposalTokens] = useState(false);
  
  // Use global proposal context
  const proposal = useProposalContext();
  
  // Enhanced useBalances hook that could accept dynamic tokens
  const {
    balances,
    metadata: baseMetadata,
    loading,
    error,
    lastUpdated,
    refreshBalances,
    isConnected,
    userAddress,
    hasAnyBalance,
    getNonZeroBalances
  } = useBalances();

  // Enhanced metadata with proposal context
  const enhancedMetadata = { ...baseMetadata };
  
  // If proposal is ready, enhance metadata with proposal-specific info
  if (proposal.isProposalReady()) {
    const proposalTokens = proposal.getTokens();
    const proposalMetadata = proposal.getTokenMetadata();
    
    // Update metadata for proposal tokens
    Object.entries(proposalTokens).forEach(([tokenType, address]) => {
      if (address && enhancedMetadata[tokenType]) {
        enhancedMetadata[tokenType] = {
          ...enhancedMetadata[tokenType],
          ...proposalMetadata[tokenType],
          address: address.toLowerCase(),
          isFromProposal: true,
          proposalMarket: proposal.getMarketName()
        };
      }
    });
  }

  const displayBalances = showOnlyNonZero ? getNonZeroBalances() : balances;
  let displayTokens = Object.keys(displayBalances);
  
  // Filter to only proposal tokens if requested
  if (showOnlyProposalTokens && proposal.isProposalReady()) {
    const proposalTokenTypes = Object.keys(proposal.getTokens()).filter(key => 
      proposal.getTokenAddress(key)
    );
    displayTokens = displayTokens.filter(tokenKey => 
      proposalTokenTypes.includes(tokenKey)
    );
  }

  // Dynamic token categorization based on proposal
  const getDynamicTokenGroups = () => {
    if (!proposal.isProposalReady()) {
      // Fallback to static groups if no proposal
      return {
        native: ['native'],
        base: ['baseCurrency', 'baseCompany'],
        currencyPositions: ['currencyYes', 'currencyNo'],
        companyPositions: ['companyYes', 'companyNo']
      };
    }

    // Dynamic groups based on proposal
    const tokens = proposal.getTokens();
    return {
      native: ['native'],
      base: ['baseCurrency', 'baseCompany'].filter(key => tokens[key]),
      currencyPositions: ['currencyYes', 'currencyNo'].filter(key => tokens[key]),
      companyPositions: ['companyYes', 'companyNo'].filter(key => tokens[key])
    };
  };

  const tokenGroups = getDynamicTokenGroups();

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {proposal.isProposalReady() ? `${proposal.getMarketName()} - Token Balances` : 'Token Balances'}
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            {proposal.isProposalReady() ? 'Dynamic balances from current proposal' : 'Static token balances'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-gray-500">
              Updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={refreshBalances}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
          >
            {loading ? (
              <LoadingSpinner className="text-white" />
            ) : (
              <RefreshIcon />
            )}
            Refresh
          </button>
        </div>
      </div>

      {/* Global Proposal Status */}
      <ProposalStatusBanner proposal={proposal} />

      {/* Wallet Connection Status */}
      {!isConnected && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-yellow-800">Please connect your wallet to view balances.</p>
        </div>
      )}

      {/* Connected Wallet Info with Enhanced Filters */}
      {isConnected && userAddress && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-blue-800 font-medium">Connected Wallet:</p>
              <p className="text-blue-600 font-mono text-sm">
                {userAddress.slice(0, 6)}...{userAddress.slice(-4)}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm text-blue-700">
                <input
                  type="checkbox"
                  checked={showOnlyNonZero}
                  onChange={(e) => setShowOnlyNonZero(e.target.checked)}
                  className="rounded"
                />
                Show only non-zero balances
              </label>
              {proposal.isProposalReady() && (
                <label className="flex items-center gap-2 text-sm text-blue-700">
                  <input
                    type="checkbox"
                    checked={showOnlyProposalTokens}
                    onChange={(e) => setShowOnlyProposalTokens(e.target.checked)}
                    className="rounded"
                  />
                  Show only current proposal tokens
                </label>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-red-700">
            <h3 className="text-sm font-medium">Error</h3>
            <p className="text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-8">
          <LoadingSpinner className="h-8 w-8 mx-auto text-blue-600" />
          <p className="text-gray-600 mt-2">Loading balances...</p>
        </div>
      )}

      {/* Balance Display */}
      {isConnected && !loading && (
        <div className="space-y-8">
          {/* No Balances Message */}
          {!hasAnyBalance() && (
            <div className="text-center py-8">
              <p className="text-gray-600">No token balances found.</p>
              <p className="text-sm text-gray-500 mt-1">
                Get some tokens to see them here!
              </p>
            </div>
          )}

          {/* Dynamic Token Sections */}
          {tokenGroups.native.length > 0 && (!showOnlyNonZero || tokenGroups.native.some(token => displayTokens.includes(token))) && (
            <TokenSection
              title="Native Token"
              tokens={tokenGroups.native.filter(token => !showOnlyNonZero || displayTokens.includes(token))}
              balances={balances}
              metadata={enhancedMetadata}
              highlight={false}
              proposal={proposal}
            />
          )}

          {tokenGroups.base.length > 0 && (!showOnlyNonZero || tokenGroups.base.some(token => displayTokens.includes(token))) && (
            <TokenSection
              title={`Base Tokens ${proposal.isProposalReady() ? `(${proposal.getMarketName()})` : ''}`}
              tokens={tokenGroups.base.filter(token => !showOnlyNonZero || displayTokens.includes(token))}
              balances={balances}
              metadata={enhancedMetadata}
              highlight={false}
              proposal={proposal}
            />
          )}

          {tokenGroups.currencyPositions.length > 0 && (!showOnlyNonZero || tokenGroups.currencyPositions.some(token => displayTokens.includes(token))) && (
            <TokenSection
              title={`Currency Position Tokens ${proposal.isProposalReady() ? `(${proposal.getMarketName()})` : ''}`}
              tokens={tokenGroups.currencyPositions.filter(token => !showOnlyNonZero || displayTokens.includes(token))}
              balances={balances}
              metadata={enhancedMetadata}
              highlight={true}
              proposal={proposal}
            />
          )}

          {tokenGroups.companyPositions.length > 0 && (!showOnlyNonZero || tokenGroups.companyPositions.some(token => displayTokens.includes(token))) && (
            <TokenSection
              title={`Company Position Tokens ${proposal.isProposalReady() ? `(${proposal.getMarketName()})` : ''}`}
              tokens={tokenGroups.companyPositions.filter(token => !showOnlyNonZero || displayTokens.includes(token))}
              balances={balances}
              metadata={enhancedMetadata}
              highlight={true}
              proposal={proposal}
            />
          )}
        </div>
      )}

      {/* Debug Info - Enhanced with Proposal Data */}
      {isConnected && (
        <details className="mt-8">
          <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
            Debug Information (Enhanced with Proposal Context)
          </summary>
          <div className="mt-2 p-3 bg-gray-100 rounded-lg">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Global Proposal Info:</h4>
            <pre className="text-xs text-gray-600 overflow-auto mb-4">
              {JSON.stringify({
                isReady: proposal.isProposalReady(),
                isLoading: proposal.isLoading(),
                hasError: proposal.hasError(),
                error: proposal.getErrorMessage(),
                marketName: proposal.getMarketName(),
                proposalAddress: proposal.proposalAddress,
                tokenAddresses: proposal.getTokens(),
                poolAddresses: proposal.getPoolAddresses()
              }, null, 2)}
            </pre>
            
            <h4 className="text-sm font-medium text-gray-700 mb-2">Raw Balances:</h4>
            <pre className="text-xs text-gray-600 overflow-auto mb-4">
              {JSON.stringify(balances, null, 2)}
            </pre>
            
            <h4 className="text-sm font-medium text-gray-700 mb-2">Enhanced Token Metadata:</h4>
            <pre className="text-xs text-gray-600 overflow-auto">
              {JSON.stringify(enhancedMetadata, null, 2)}
            </pre>
          </div>
        </details>
      )}
    </div>
  );
};

export default BalanceDisplayUpdated; 