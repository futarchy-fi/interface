import { useState } from 'react';
import { useTokenManagement } from '../hooks/useTokenManagement';

/**
 * Small token display component with Gnosis Scan link and MetaMask integration
 * Reuses existing enhanced token functionality
 */
const SmallTokenDisplay = ({ address, symbol, tokenType, showActions = true }) => {
  const tokenManager = useTokenManagement();
  const [isAddingToMetaMask, setIsAddingToMetaMask] = useState(false);

  const handleAddToMetaMask = async () => {
    if (!address || !symbol) return;
    
    setIsAddingToMetaMask(true);
    try {
      await tokenManager.addToMetaMask(address, symbol);
    } catch (error) {
      console.error('Failed to add token to MetaMask:', error);
    } finally {
      setIsAddingToMetaMask(false);
    }
  };

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(address);
  };

  const getTokenTypeColor = (type) => {
    switch (type) {
      case 'yes': return 'text-green-600 bg-green-50 border-green-200';
      case 'no': return 'text-red-600 bg-red-50 border-red-200';
      case 'company': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'currency': return 'text-purple-600 bg-purple-50 border-purple-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const gnosiscanUrl = `https://gnosisscan.io/token/${address}`;

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg border text-xs ${getTokenTypeColor(tokenType)}`}>
      {/* Token Symbol */}
      <span className="font-medium">{symbol}</span>
      
      {showActions && (
        <div className="flex items-center gap-1">
          {/* Gnosis Scan Link */}
          <a
            href={gnosiscanUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:opacity-70 transition-opacity"
            title="View on Gnosis Scan"
          >
            🔗
          </a>
          
          {/* Copy Address */}
          <button
            onClick={handleCopyAddress}
            className="hover:opacity-70 transition-opacity"
            title="Copy Address"
          >
            📋
          </button>
          
          {/* Add to MetaMask */}
          <button
            onClick={handleAddToMetaMask}
            disabled={isAddingToMetaMask}
            className="hover:opacity-70 transition-opacity disabled:opacity-50"
            title="Add to MetaMask"
          >
            {isAddingToMetaMask ? '⏳' : '🦊'}
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * Grid of small token displays for a proposal
 */
export const SmallTokenGrid = ({ tokens, tokenMetadata, className = "" }) => {
  if (!tokens || !tokenMetadata) {
    return (
      <div className={`text-xs text-gray-500 ${className}`}>
        No token data available
      </div>
    );
  }

  console.log('🏷️ SmallTokenGrid received:', { tokens, tokenMetadata });

  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {/* Base Tokens */}
      <SmallTokenDisplay
        address={tokens.companyToken}
        symbol={tokenMetadata.companyToken?.symbol || tokenMetadata.baseCompany?.symbol || 'COMPANY'}
        tokenType="company"
      />
      <SmallTokenDisplay
        address={tokens.currencyToken}
        symbol={tokenMetadata.currencyToken?.symbol || tokenMetadata.baseCurrency?.symbol || 'CURRENCY'}
        tokenType="currency"
      />
      
      {/* YES Tokens */}
      <SmallTokenDisplay
        address={tokens.yesCompanyToken}
        symbol={tokenMetadata.yesCompanyToken?.symbol || tokenMetadata.companyYes?.symbol || 'YES_COMPANY'}
        tokenType="yes"
      />
      <SmallTokenDisplay
        address={tokens.yesCurrencyToken}
        symbol={tokenMetadata.yesCurrencyToken?.symbol || tokenMetadata.currencyYes?.symbol || 'YES_CURRENCY'}
        tokenType="yes"
      />
      
      {/* NO Tokens */}
      <SmallTokenDisplay
        address={tokens.noCompanyToken}
        symbol={tokenMetadata.noCompanyToken?.symbol || tokenMetadata.companyNo?.symbol || 'NO_COMPANY'}
        tokenType="no"
      />
      <SmallTokenDisplay
        address={tokens.noCurrencyToken}
        symbol={tokenMetadata.noCurrencyToken?.symbol || tokenMetadata.currencyNo?.symbol || 'NO_CURRENCY'}
        tokenType="no"
      />
    </div>
  );
};

export default SmallTokenDisplay; 