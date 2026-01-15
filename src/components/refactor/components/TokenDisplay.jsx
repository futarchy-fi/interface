import React, { useState } from 'react';
import { useTokenManagement } from '../hooks/useTokenManagement';
import { useProposalContext } from '../context/ProposalContext';
import { getEnhancedTokenMetadata } from '../utils/tokenUtils';

/**
 * Enhanced Token Display Component
 * Shows token info with Gnosis Scan links, MetaMask integration, and categorization
 */
const TokenDisplay = ({ 
  tokenType, 
  address, 
  balance, 
  showBalance = true, 
  compact = false, 
  enhancedInfo = null 
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const proposal = useProposalContext();
  const tokenManager = useTokenManagement();
  
  // Use enhanced ERC20 info if available, otherwise fall back to old method
  const metadata = enhancedInfo || getEnhancedTokenMetadata(
    tokenType, 
    address, 
    proposal.isProposalReady() ? { marketName: proposal.getMarketName() } : null
  );

  console.log(`🎨 TokenDisplay for ${tokenType}:`, { enhancedInfo, metadata });

  const handleAddToMetaMask = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!metadata.address || metadata.address === 'native') return;
    
    await tokenManager.addToMetaMask(
      metadata.address,
      metadata.symbol,
      metadata.decimals || 18
    );
  };

  const handleCopyAddress = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    await tokenManager.copyAddress(metadata.address, metadata.symbol);
  };

  const formatBalance = (balance) => {
    if (!balance || balance === '0') return '0';
    const num = parseFloat(balance);
    
    // 🎯 SHOW EXACT VALUES - No rounding for small numbers!
    if (num === 0) return '0';
    
    // For very large numbers, still use compact format
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
    
    // For normal numbers, show reasonable precision
    if (num >= 1) return num.toFixed(3);
    if (num >= 0.001) return num.toFixed(3);
    
    // For very small numbers, show MORE precision to see exact values
    return num.toFixed(18).replace(/\.?0+$/, ''); // Remove trailing zeros
  };

  const isNativeToken = metadata.tokenType === 'native' || address === 'native';
  const hasBalance = balance && parseFloat(balance) > 0;
  const canAddToMetaMask = !isNativeToken && metadata.address;

  // Generate Gnosis Scan URL
  const gnosisScanUrl = !isNativeToken && metadata.address ? 
    `https://gnosisscan.io/token/${metadata.address}` : null;

  // Format address for display
  const formattedAddress = metadata.address ? 
    `${metadata.address.slice(0, 6)}...${metadata.address.slice(-4)}` : '';

  if (compact) {
    return (
      <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
        <span className="text-lg">{metadata.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="font-medium text-sm truncate">{metadata.symbol}</span>
            <span 
              className="text-xs px-1.5 py-0.5 rounded"
              style={{ 
                backgroundColor: metadata.bgColor, 
                color: metadata.color 
              }}
            >
              {metadata.category}
            </span>
          </div>
          {showBalance && (
            <div className="text-xs text-gray-600">
              {formatBalance(balance)}
            </div>
          )}
        </div>
        
        {/* Quick actions */}
        <div className="flex gap-1">
          {gnosisScanUrl && (
            <a
              href={gnosisScanUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 text-xs"
              title="View on Gnosis Scan"
            >
              🔗
            </a>
          )}
          {canAddToMetaMask && (
            <button
              onClick={handleAddToMetaMask}
              disabled={tokenManager.loading}
              className="text-orange-600 hover:text-orange-800 text-xs disabled:opacity-50"
              title="Add to MetaMask"
            >
              🦊
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div 
      className="p-4 border rounded-lg transition-all hover:shadow-md"
      style={{ 
        borderColor: metadata.color + '40',
        backgroundColor: metadata.bgColor + '20'
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{metadata.icon}</span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-lg" style={{ color: metadata.color }}>
                {metadata.symbol}
              </h3>
              <span 
                className="text-xs px-2 py-1 rounded-full font-medium"
                style={{ 
                  backgroundColor: metadata.color, 
                  color: 'white' 
                }}
              >
                {metadata.category}
              </span>
              {enhancedInfo && (
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                  Current Proposal
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 mt-1">{metadata.name}</p>
            <p className="text-xs text-gray-500">{metadata.description}</p>
            
            {/* Show if this is real ERC20 data */}
            {enhancedInfo && (
              <p className="text-xs text-green-600 mt-1">
                ✅ Real ERC20 Data • Decimals: {metadata.decimals}
              </p>
            )}
          </div>
        </div>

        {/* Balance display */}
        {showBalance && (
          <div className="text-right">
            <div className={`text-xl font-bold ${hasBalance ? 'text-gray-900' : 'text-gray-400'}`}>
              {formatBalance(balance)}
            </div>
            <div className="text-xs text-gray-500">Balance</div>
          </div>
        )}
      </div>

      {/* Token Address */}
      {!isNativeToken && metadata.address && (
        <div className="mb-3 p-2 bg-gray-50 rounded">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-500 mb-1">Contract Address:</div>
              <div className="font-mono text-sm text-gray-700">
                {formattedAddress}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCopyAddress}
                disabled={tokenManager.loading}
                className="text-blue-600 hover:text-blue-800 text-sm transition-colors disabled:opacity-50"
                title="Copy address"
              >
                📋 Copy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 mt-3">
        {gnosisScanUrl && (
          <a
            href={gnosisScanUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
          >
            🔗 View on Gnosis Scan
          </a>
        )}
        
        {canAddToMetaMask && (
          <button
            onClick={handleAddToMetaMask}
            disabled={tokenManager.loading}
            className="flex items-center gap-1 px-3 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {tokenManager.loading ? (
              <>⏳ Adding...</>
            ) : (
              <>🦊 Add to MetaMask</>
            )}
          </button>
        )}
      </div>

      {/* Success/Error messages */}
      {tokenManager.hasSuccess && (
        <div className="mt-2 p-2 bg-green-100 text-green-700 rounded text-sm">
          {tokenManager.successMessage}
        </div>
      )}
      
      {tokenManager.hasError && (
        <div className="mt-2 p-2 bg-red-100 text-red-700 rounded text-sm">
          {tokenManager.error}
        </div>
      )}

      {/* Proposal context info */}
      {enhancedInfo && enhancedInfo.isProposalToken && enhancedInfo.proposalMarket && (
        <div className="mt-3 p-2 bg-purple-50 border border-purple-200 rounded">
          <div className="text-xs text-purple-700">
            <strong>Market:</strong> {enhancedInfo.proposalMarket}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Token Grid Component - displays multiple tokens in a grid
 */
export const TokenGrid = ({ tokens, showBalances = true, compact = false }) => {
  const proposal = useProposalContext();

  if (!tokens || tokens.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No tokens to display
      </div>
    );
  }

  return (
    <div className={`grid gap-4 ${compact ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1 lg:grid-cols-2'}`}>
      {tokens.map((token, index) => (
        <TokenDisplay
          key={token.tokenType || index}
          tokenType={token.tokenType}
          address={token.address}
          balance={token.balance}
          showBalance={showBalances}
          compact={compact}
          enhancedInfo={token}
        />
      ))}
    </div>
  );
};

/**
 * Token List Component - displays tokens in a list format
 */
export const TokenList = ({ tokens, showBalances = true }) => {
  if (!tokens || tokens.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No tokens to display
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tokens.map((token, index) => (
        <TokenDisplay
          key={token.tokenType || index}
          tokenType={token.tokenType}
          address={token.address}
          balance={token.balance}
          showBalance={showBalances}
          compact={true}
          enhancedInfo={token}
        />
      ))}
    </div>
  );
};

/**
 * Token Category Section - groups tokens by category
 */
export const TokenCategorySection = ({ title, tokens, showBalances = true, compact = false }) => {
  const tokenManager = useTokenManagement();

  const handleAddAllToMetaMask = async () => {
    const validTokens = tokens.filter(token => 
      token.enhancedInfo && 
      token.enhancedInfo.address && 
      token.enhancedInfo.address !== 'native'
    ).map(token => ({
      address: token.enhancedInfo.address,
      symbol: token.enhancedInfo.symbol,
      decimals: token.enhancedInfo.decimals || 18,
      name: token.enhancedInfo.name
    }));

    console.log(`🦊 Adding ${title} tokens to MetaMask:`, validTokens);

    if (validTokens.length > 0) {
      await tokenManager.addMultipleTokens(validTokens);
    }
  };

  const hasValidTokensForMetaMask = tokens.some(token => 
    token.enhancedInfo && 
    token.enhancedInfo.address && 
    token.enhancedInfo.address !== 'native'
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
        {hasValidTokensForMetaMask && (
          <button
            onClick={handleAddAllToMetaMask}
            disabled={tokenManager.loading}
            className="px-3 py-1 bg-orange-600 text-white rounded text-sm hover:bg-orange-700 disabled:opacity-50"
          >
            🦊 Add All to MetaMask
          </button>
        )}
      </div>
      
      <div className={compact ? "space-y-2" : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"}>
        {tokens.map((token) => (
          <TokenDisplay
            key={token.address || token.tokenType}
            tokenType={token.tokenType}
            address={token.address}
            balance={token.balance}
            showBalance={showBalances}
            compact={compact}
            enhancedInfo={token.enhancedInfo}
          />
        ))}
      </div>
    </div>
  );
};

export default TokenDisplay; 