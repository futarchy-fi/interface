import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useSimpleBalances } from '../hooks/useSimpleBalances';
import { useProposalContext } from '../context/ProposalContext';
import { useProposalTokens } from '../hooks/useProposalTokens';
import { TokenCategorySection } from './TokenDisplay';
import { useTokenManagement } from '../hooks/useTokenManagement';

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
              Enhanced token display with MetaMask integration
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
      <p className="text-gray-700">No proposal loaded - using default token configuration</p>
    </div>
  );
};

const ChainStatusBanner = () => {
  const tokenManager = useTokenManagement();
  const [isOnGnosis, setIsOnGnosis] = useState(null);
  const [checking, setChecking] = useState(false);

  const checkChain = async () => {
    setChecking(true);
    const onGnosis = await tokenManager.checkGnosisChain();
    setIsOnGnosis(onGnosis);
    setChecking(false);
  };

  useEffect(() => {
    checkChain();
  }, []);

  if (checking) {
    return (
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center gap-2">
          <LoadingSpinner className="text-blue-600" />
          <span className="text-blue-800">Checking network...</span>
        </div>
      </div>
    );
  }

  if (isOnGnosis === false) {
    return (
      <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-orange-800 font-medium">⚠️ Wrong Network</p>
            <p className="text-orange-700 text-sm">Switch to Gnosis Chain for MetaMask integration</p>
          </div>
          <button
            onClick={tokenManager.switchToGnosis}
            disabled={tokenManager.loading}
            className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50"
          >
            {tokenManager.loading ? 'Switching...' : 'Switch to Gnosis'}
          </button>
        </div>
      </div>
    );
  }

  if (isOnGnosis === true) {
    return (
      <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
        <p className="text-green-800 font-medium">✅ Connected to Gnosis Chain</p>
        <p className="text-green-700 text-sm">MetaMask integration ready</p>
      </div>
    );
  }

  return null;
};

const EnhancedBalanceDisplay = () => {
  const [showOnlyNonZero, setShowOnlyNonZero] = useState(false);
  const [showOnlyProposalTokens, setShowOnlyProposalTokens] = useState(false);
  const [compactView, setCompactView] = useState(false);
  
  // Get user address for display
  const { address: userAddress } = useAccount();
  
  // Use global proposal context and enhanced token hook
  const proposal = useProposalContext();
  const proposalTokens = useProposalTokens();
  const tokenManager = useTokenManagement();
  
  // Use useSimpleBalances for exact precision and proposal-aware functionality
  const {
    currency,
    company,
    native,
    symbols,
    loading,
    error,
    lastUpdated,
    refresh: refreshBalances,
    isConnected,
    hasCurrencyBalances,
    hasCompanyBalances,
    getNonZeroBalances
  } = useSimpleBalances();

  // Convert useSimpleBalances structure to flat balances object for compatibility
  const getFlatBalances = () => {
    return {
      native: native,
      baseCurrency: currency.base,
      baseCompany: company.base,
      currencyYes: currency.yes,
      currencyNo: currency.no,
      companyYes: company.yes,
      companyNo: company.no,
    };
  };

  // Process tokens for display with enhanced ERC20 data
  const processTokensForDisplay = () => {
    const flatBalances = getFlatBalances();
    const displayBalances = showOnlyNonZero ? getNonZeroBalances() : flatBalances;
    let tokenKeys = Object.keys(displayBalances);
    
    console.log('🔍 Processing tokens for display. Available balance keys:', tokenKeys);
    console.log('🔍 Enhanced tokens available:', Object.keys(proposalTokens.tokenInfos));
    console.log('🎯 Raw balances from useSimpleBalances:', flatBalances);
    
    // Filter to only proposal tokens if requested
    if (showOnlyProposalTokens && proposal.isProposalReady()) {
      const proposalTokenTypes = Object.keys(proposal.getTokens()).filter(key => 
        proposal.getTokenAddress(key)
      );
      tokenKeys = tokenKeys.filter(tokenKey => 
        proposalTokenTypes.includes(tokenKey)
      );
    }

    // Create token objects with enhanced ERC20 data
    return tokenKeys.map(tokenKey => {
      const address = proposal.isProposalReady() ? 
        proposal.getTokenAddress(tokenKey) : 
        null;
      
      // Get real ERC20 token info from our enhanced hook (using the original proposal key)
      const enhancedTokenInfo = proposalTokens.getTokenInfoByType(tokenKey);
      
      console.log(`🎨 Processing token ${tokenKey}:`, {
        address,
        balance: displayBalances[tokenKey],
        enhancedInfo: enhancedTokenInfo
      });
      
      return {
        tokenType: tokenKey,
        address: address,
        balance: displayBalances[tokenKey] || '0',
        // Include the real ERC20 metadata
        enhancedInfo: enhancedTokenInfo
      };
    });
  };

  // Group tokens by category
  const getTokenGroups = () => {
    const allTokens = processTokensForDisplay();
    
    console.log('🗂️ Grouping tokens:', allTokens);
    
    return {
      native: allTokens.filter(token => token.tokenType === 'native'),
      base: allTokens.filter(token => 
        ['currencyToken', 'companyToken', 'baseCurrency', 'baseCompany'].includes(token.tokenType)
      ),
      currencyPositions: allTokens.filter(token => 
        ['yesCurrencyToken', 'noCurrencyToken', 'currencyYes', 'currencyNo'].includes(token.tokenType)
      ),
      companyPositions: allTokens.filter(token => 
        ['yesCompanyToken', 'noCompanyToken', 'companyYes', 'companyNo'].includes(token.tokenType)
      )
    };
  };

  const tokenGroups = getTokenGroups();
  const hasTokens = Object.values(tokenGroups).some(group => group.length > 0);

  // Bulk add all proposal tokens to MetaMask using real ERC20 data
  const addAllProposalTokens = async () => {
    if (!proposal.isProposalReady() || !proposalTokens.isReady) return;

    const proposalTokensToAdd = Object.entries(proposal.getTokens())
      .filter(([_, address]) => address && address !== 'native')
      .map(([tokenType, address]) => {
        const enhancedInfo = proposalTokens.getTokenInfoByType(tokenType);
        return {
          address,
          symbol: enhancedInfo?.symbol || 'UNKNOWN',
          decimals: enhancedInfo?.decimals || 18,
          name: enhancedInfo?.name || 'Unknown Token'
        };
      });

    console.log('🦊 Adding proposal tokens to MetaMask:', proposalTokensToAdd);

    if (proposalTokensToAdd.length > 0) {
      await tokenManager.addMultipleTokens(proposalTokensToAdd);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {proposal.isProposalReady() ? `${proposal.getMarketName()} - Enhanced Token Balances` : 'Enhanced Token Balances'}
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            {proposal.isProposalReady() ? 'Dynamic balances with MetaMask integration' : 'Token balances with enhanced features'}
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

      {/* Proposal Status */}
      <ProposalStatusBanner proposal={proposal} />

      {/* Token Loading Status */}
      {proposal.isProposalReady() && proposalTokens.loading && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2">
            <LoadingSpinner className="w-4 h-4 text-blue-600" />
            <p className="text-blue-800">📡 Reading real ERC20 token data from contracts...</p>
            <span className="text-blue-600 text-sm">
              ({proposalTokens.stats.totalTokens} tokens detected)
            </span>
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

      {/* Enhanced Token Success Status */}
      {proposalTokens.isReady && !proposalTokens.loading && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-800 font-medium">✅ Enhanced ERC20 Data Loaded</p>
              <p className="text-green-700 text-sm">
                {proposalTokens.stats.totalTokens} tokens • {proposalTokens.stats.baseTokens} base • {proposalTokens.stats.conditionalTokens} conditional
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

      {/* Chain Status */}
      <ChainStatusBanner />

      {/* Wallet Connection Status */}
      {!isConnected && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-yellow-800">Please connect your wallet to view balances.</p>
        </div>
      )}

      {/* Connected Wallet Info with Enhanced Controls */}
      {isConnected && userAddress && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-blue-800 font-medium">Connected Wallet:</p>
              <p className="text-blue-600 font-mono text-sm">
                {userAddress.slice(0, 6)}...{userAddress.slice(-4)}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-blue-700">
                  <input
                    type="checkbox"
                    checked={showOnlyNonZero}
                    onChange={(e) => setShowOnlyNonZero(e.target.checked)}
                    className="rounded"
                  />
                  Non-zero only
                </label>
                <label className="flex items-center gap-2 text-sm text-blue-700">
                  <input
                    type="checkbox"
                    checked={compactView}
                    onChange={(e) => setCompactView(e.target.checked)}
                    className="rounded"
                  />
                  Compact view
                </label>
              </div>
              {proposal.isProposalReady() && (
                <div className="flex gap-2">
                  <label className="flex items-center gap-2 text-sm text-blue-700">
                    <input
                      type="checkbox"
                      checked={showOnlyProposalTokens}
                      onChange={(e) => setShowOnlyProposalTokens(e.target.checked)}
                      className="rounded"
                    />
                    Proposal tokens only
                  </label>
                  <button
                    onClick={addAllProposalTokens}
                    disabled={tokenManager.loading}
                    className="px-3 py-1 bg-orange-600 text-white rounded text-xs hover:bg-orange-700 disabled:opacity-50"
                  >
                    🦊 Add All to MetaMask
                  </button>
                </div>
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

      {/* Enhanced Token Display */}
      {isConnected && !loading && (
        <div className="space-y-8">
          {/* No Tokens Message */}
          {!hasTokens && (
            <div className="text-center py-8">
              <p className="text-gray-600">No tokens found matching your filters.</p>
              <p className="text-sm text-gray-500 mt-1">
                Try adjusting your filter settings or get some tokens!
              </p>
            </div>
          )}

          {/* Native Token */}
          {tokenGroups.native.length > 0 && (
            <TokenCategorySection
              title="Native Token"
              tokens={tokenGroups.native}
              showBalances={true}
              compact={compactView}
            />
          )}

          {/* Base Tokens */}
          {tokenGroups.base.length > 0 && (
            <TokenCategorySection
              title={`Base Tokens ${proposal.isProposalReady() ? `(${proposal.getMarketName()})` : ''}`}
              tokens={tokenGroups.base}
              showBalances={true}
              compact={compactView}
            />
          )}

          {/* Currency Position Tokens */}
          {tokenGroups.currencyPositions.length > 0 && (
            <TokenCategorySection
              title={`Currency Position Tokens ${proposal.isProposalReady() ? `(${proposal.getMarketName()})` : ''}`}
              tokens={tokenGroups.currencyPositions}
              showBalances={true}
              compact={compactView}
            />
          )}

          {/* Company Position Tokens */}
          {tokenGroups.companyPositions.length > 0 && (
            <TokenCategorySection
              title={`Company Position Tokens ${proposal.isProposalReady() ? `(${proposal.getMarketName()})` : ''}`}
              tokens={tokenGroups.companyPositions}
              showBalances={true}
              compact={compactView}
            />
          )}
        </div>
      )}

      {/* Global Token Manager Messages */}
      {tokenManager.hasSuccess && (
        <div className="mt-6 p-4 bg-green-100 text-green-700 rounded-lg">
          {tokenManager.successMessage}
        </div>
      )}
      
      {tokenManager.hasError && (
        <div className="mt-6 p-4 bg-red-100 text-red-700 rounded-lg">
          {tokenManager.error}
        </div>
      )}

      {/* Debug Info - Enhanced with Token Management */}
      {isConnected && (
        <details className="mt-8">
          <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
            Enhanced Debug Information
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
            
            <h4 className="text-sm font-medium text-gray-700 mb-2">Token Groups:</h4>
            <pre className="text-xs text-gray-600 overflow-auto mb-4">
              {JSON.stringify({
                native: tokenGroups.native.length,
                base: tokenGroups.base.length,
                currencyPositions: tokenGroups.currencyPositions.length,
                companyPositions: tokenGroups.companyPositions.length,
                total: hasTokens
              }, null, 2)}
            </pre>
            
            <h4 className="text-sm font-medium text-gray-700 mb-2">Token Manager State:</h4>
            <pre className="text-xs text-gray-600 overflow-auto">
              {JSON.stringify({
                loading: tokenManager.loading,
                hasError: tokenManager.hasError,
                hasSuccess: tokenManager.hasSuccess,
                error: tokenManager.error,
                successMessage: tokenManager.successMessage
              }, null, 2)}
            </pre>
          </div>
        </details>
      )}
    </div>
  );
};

export default EnhancedBalanceDisplay; 