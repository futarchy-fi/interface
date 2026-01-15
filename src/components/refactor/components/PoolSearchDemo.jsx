import React, { useState } from 'react';
import PoolSearchAndCreate from './PoolSearchAndCreate';
import { useProposalContext } from '../context/ProposalContext';

const PoolSearchDemo = () => {
  const [showTokenList, setShowTokenList] = useState(false);
  const { getTokenMetadata, getTokenAddresses, isProposalReady, getDisplayInfo } = useProposalContext();

  // Dynamic token addresses from current proposal
  const getCommonTokens = () => {
    if (!isProposalReady()) {
      return [
        { symbol: 'No Proposal', address: '0x0000000000000000000000000000000000000000', description: 'Load a proposal to see available tokens' }
      ];
    }

    const tokenMetadata = getTokenMetadata();
    const displayInfo = getDisplayInfo();
    
    return [
      { 
        symbol: tokenMetadata.baseCurrency?.symbol || 'CURRENCY', 
        address: tokenMetadata.baseCurrency?.address, 
        description: `Base Currency Token (${displayInfo.marketName})` 
      },
      { 
        symbol: tokenMetadata.baseCompany?.symbol || 'COMPANY', 
        address: tokenMetadata.baseCompany?.address, 
        description: `Base Company Token (${displayInfo.marketName})` 
      },
      { 
        symbol: tokenMetadata.currencyYes?.symbol || 'YES_CURRENCY', 
        address: tokenMetadata.currencyYes?.address, 
        description: `YES Currency Conditional Token` 
      },
      { 
        symbol: tokenMetadata.currencyNo?.symbol || 'NO_CURRENCY', 
        address: tokenMetadata.currencyNo?.address, 
        description: `NO Currency Conditional Token` 
      },
      { 
        symbol: tokenMetadata.companyYes?.symbol || 'YES_COMPANY', 
        address: tokenMetadata.companyYes?.address, 
        description: `YES Company Conditional Token` 
      },
      { 
        symbol: tokenMetadata.companyNo?.symbol || 'NO_COMPANY', 
        address: tokenMetadata.companyNo?.address, 
        description: `NO Company Conditional Token` 
      },
    ].filter(token => token.address && token.address !== '0x0000000000000000000000000000000000000000');
  };

  const commonTokens = getCommonTokens();
  const displayInfo = getDisplayInfo();

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-xl">
        <h1 className="text-3xl font-bold mb-2">Pool Search & Creation Tool</h1>
        <p className="text-blue-100">
          Search for existing Algebra/Swapr pools or create new ones with automatic approval handling
        </p>
        {isProposalReady() && (
          <p className="text-blue-200 text-sm mt-2">
            📋 Using tokens from: <strong>{displayInfo.marketName}</strong> 
            ({displayInfo.shortAddress})
          </p>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-yellow-800 mb-2">📝 How to Use</h3>
        <ol className="list-decimal list-inside text-yellow-700 space-y-1">
          <li>Enter two token addresses in the form below</li>
          <li>Click "Search Pool" to check if a pool exists</li>
          <li>If the pool exists, you'll see current price and pool information</li>
          <li>If the pool doesn't exist, you can click "Create Pool" to start the creation process</li>
          <li>Follow the guided steps for approvals and liquidity provision</li>
        </ol>
      </div>

      {/* Token Reference */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-800">
            🪙 {isProposalReady() ? 
              `Available Tokens (${displayInfo.marketName})` : 
              'Token Addresses (No Proposal Loaded)'
            }
          </h3>
          <button
            onClick={() => setShowTokenList(!showTokenList)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            {showTokenList ? 'Hide' : 'Show'} Token List
          </button>
        </div>
        
        {!isProposalReady() && (
          <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-3">
            <p className="text-yellow-700 text-sm">
              ⚠️ No proposal loaded. Load a proposal above to see the specific tokens available for pool creation.
            </p>
          </div>
        )}
        
        {showTokenList && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {commonTokens.map((token, index) => (
              <div key={`${token.symbol}-${index}`} className={`p-3 rounded border ${
                token.address === '0x0000000000000000000000000000000000000000' 
                  ? 'bg-gray-100 border-gray-300' 
                  : 'bg-white'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900">{token.symbol}</h4>
                    <p className="text-xs text-gray-500">{token.description}</p>
                    {token.address && token.address !== '0x0000000000000000000000000000000000000000' && (
                      <p className="text-xs font-mono text-gray-600 mt-1">
                        {token.address.slice(0, 6)}...{token.address.slice(-4)}
                      </p>
                    )}
                  </div>
                  {token.address && token.address !== '0x0000000000000000000000000000000000000000' && (
                    <button
                      onClick={() => copyToClipboard(token.address)}
                      className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 transition-colors"
                      title="Copy address"
                    >
                      Copy
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pool Creation Examples */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-green-800 mb-2">🎯 Pool Creation Examples</h3>
        <div className="text-green-700 space-y-2">
          {isProposalReady() ? (
            <>
              <p><strong>Regular Pool:</strong> Company Token + Currency Token (Base tokens trading pair)</p>
              <p><strong>Prediction Market:</strong> YES Company + Currency (Conditional token vs base currency)</p>
              <p><strong>Conditional Pool:</strong> YES Company + YES Currency (Same outcome, different assets)</p>
              <p className="text-sm text-green-600 mt-3">
                💡 These examples use the actual tokens from the currently loaded proposal: <strong>{displayInfo.marketName}</strong>
              </p>
            </>
          ) : (
            <>
              <p><strong>Regular Pool:</strong> Company Token + Currency Token (Base tokens trading pair)</p>
              <p><strong>Prediction Market:</strong> YES Token + Base Currency (Conditional token vs base currency)</p>
              <p><strong>Conditional Pool:</strong> YES Company + YES Currency (Same outcome, different assets)</p>
              <p className="text-sm text-green-600 mt-3">
                💡 Load a proposal above to see specific token examples for pool creation.
              </p>
            </>
          )}
        </div>
      </div>

      {/* Main Component */}
      <PoolSearchAndCreate />

      {/* Technical Notes */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-blue-800 mb-2">⚙️ Technical Notes</h3>
        <ul className="list-disc list-inside text-blue-700 space-y-1 text-sm">
          <li>This tool uses Algebra/Swapr Position Manager for pool creation</li>
          <li>Pools are created with full range liquidity positions (-887272 to 887272 ticks)</li>
          <li>Token ordering is automatically handled (token0 address must be less than token1)</li>
          <li>All transactions are sent to Gnosis Chain mainnet</li>
          <li>Gas limits are set to 15M to accommodate complex transactions</li>
          <li>Approvals are set to maximum uint256 for convenience</li>
        </ul>
      </div>

      {/* Links */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">🔗 Useful Links</h3>
        <div className="space-y-2">
          <a 
            href="https://gnosisscan.io" 
            target="_blank" 
            rel="noopener noreferrer"
            className="block text-blue-600 hover:text-blue-800 text-sm"
          >
            → Gnosisscan (Block Explorer)
          </a>
          <a 
            href="https://app.swapr.eth.limo/#/pools" 
            target="_blank" 
            rel="noopener noreferrer"
            className="block text-blue-600 hover:text-blue-800 text-sm"
          >
            → Swapr Pools Interface
          </a>
          <a 
            href="https://docs.swapr.eth.limo/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="block text-blue-600 hover:text-blue-800 text-sm"
          >
            → Swapr Documentation
          </a>
        </div>
      </div>
    </div>
  );
};

export default PoolSearchDemo; 