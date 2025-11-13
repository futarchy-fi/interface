import { useState } from 'react';
import { useBalances } from '../hooks/useBalances';
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

const TokenBalanceRow = ({ tokenKey, balance, metadata, highlight = false }) => {
  const balanceNum = parseFloat(balance);
  const hasBalance = balanceNum > 0;
  
  return (
    <div className={`flex justify-between items-center p-3 rounded-lg transition-colors ${
      highlight ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50 hover:bg-gray-100'
    }`}>
      <div className="flex flex-col">
        <span className={`font-medium ${hasBalance ? 'text-gray-900' : 'text-gray-600'}`}>
          {metadata.symbol}
        </span>
        <span className="text-xs text-gray-500">{metadata.name}</span>
      </div>
      
      <div className="flex flex-col items-end">
        <span className={`font-mono ${hasBalance ? 'text-gray-900 font-semibold' : 'text-gray-500'}`}>
          {formatBalance(balance)}
        </span>
        {metadata.address && metadata.address !== 'native' && (
          <span className="text-xs text-gray-400 font-mono">
            {metadata.address.slice(0, 6)}...{metadata.address.slice(-4)}
          </span>
        )}
      </div>
    </div>
  );
};

const TokenSection = ({ title, tokens, balances, metadata, highlight = false }) => (
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
        />
      ))}
    </div>
  </div>
);

const BalanceDisplay = () => {
  const [showOnlyNonZero, setShowOnlyNonZero] = useState(false);
  
  const {
    balances,
    metadata,
    loading,
    error,
    lastUpdated,
    refreshBalances,
    isConnected,
    userAddress,
    hasAnyBalance,
    getNonZeroBalances
  } = useBalances();

  const displayBalances = showOnlyNonZero ? getNonZeroBalances() : balances;
  const displayTokens = Object.keys(displayBalances);

  // Group tokens by category
  const nativeTokens = ['native'];
  const baseTokens = ['baseCurrency', 'baseCompany'];
  const currencyPositionTokens = ['currencyYes', 'currencyNo'];
  const companyPositionTokens = ['companyYes', 'companyNo'];

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Token Balances</h2>
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

      {/* Wallet Connection Status */}
      {!isConnected && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-yellow-800">Please connect your wallet to view balances.</p>
        </div>
      )}

      {/* Connected Wallet Info */}
      {isConnected && userAddress && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-blue-800 font-medium">Connected Wallet:</p>
              <p className="text-blue-600 font-mono text-sm">
                {userAddress.slice(0, 6)}...{userAddress.slice(-4)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm text-blue-700">
                <input
                  type="checkbox"
                  checked={showOnlyNonZero}
                  onChange={(e) => setShowOnlyNonZero(e.target.checked)}
                  className="rounded"
                />
                Show only non-zero balances
              </label>
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

          {/* Native Token */}
          {(!showOnlyNonZero || displayTokens.includes('native')) && (
            <TokenSection
              title="Native Token"
              tokens={nativeTokens.filter(token => !showOnlyNonZero || displayTokens.includes(token))}
              balances={balances}
              metadata={metadata}
              highlight={false}
            />
          )}

          {/* Base Tokens */}
          {(!showOnlyNonZero || baseTokens.some(token => displayTokens.includes(token))) && (
            <TokenSection
              title="Base Tokens"
              tokens={baseTokens.filter(token => !showOnlyNonZero || displayTokens.includes(token))}
              balances={balances}
              metadata={metadata}
              highlight={false}
            />
          )}

          {/* Currency Position Tokens */}
          {(!showOnlyNonZero || currencyPositionTokens.some(token => displayTokens.includes(token))) && (
            <TokenSection
              title="Currency Position Tokens"
              tokens={currencyPositionTokens.filter(token => !showOnlyNonZero || displayTokens.includes(token))}
              balances={balances}
              metadata={metadata}
              highlight={true}
            />
          )}

          {/* Company Position Tokens */}
          {(!showOnlyNonZero || companyPositionTokens.some(token => displayTokens.includes(token))) && (
            <TokenSection
              title="Company Position Tokens"
              tokens={companyPositionTokens.filter(token => !showOnlyNonZero || displayTokens.includes(token))}
              balances={balances}
              metadata={metadata}
              highlight={true}
            />
          )}
        </div>
      )}

      {/* Debug Info */}
      {isConnected && (
        <details className="mt-8">
          <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
            Debug Information
          </summary>
          <div className="mt-2 p-3 bg-gray-100 rounded-lg">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Raw Balances:</h4>
            <pre className="text-xs text-gray-600 overflow-auto">
              {JSON.stringify(balances, null, 2)}
            </pre>
            <h4 className="text-sm font-medium text-gray-700 mb-2 mt-4">Token Metadata:</h4>
            <pre className="text-xs text-gray-600 overflow-auto">
              {JSON.stringify(metadata, null, 2)}
            </pre>
          </div>
        </details>
      )}
    </div>
  );
};

export default BalanceDisplay; 