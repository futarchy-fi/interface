import React, { useState, useEffect } from 'react';
import { readTokenInfo } from '../utils/erc20Utils';
import { useProposalContext } from '../context/ProposalContext';

const ERC20DebugTest = () => {
  const [tokenData, setTokenData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const proposal = useProposalContext();

  const testTokenReading = async () => {
    if (!proposal.isProposalReady()) {
      setError('No proposal loaded');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const tokens = proposal.getTokens();
      console.log('🧪 Testing ERC20 reading for tokens:', tokens);
      
      const results = {};
      
      // Test each token individually
      for (const [tokenType, address] of Object.entries(tokens)) {
        if (address && address !== 'native') {
          console.log(`🧪 Testing ${tokenType} at ${address}...`);
          
          try {
            const tokenInfo = await readTokenInfo(address);
            results[tokenType] = {
              success: true,
              data: tokenInfo,
              address
            };
            console.log(`✅ ${tokenType} result:`, tokenInfo);
          } catch (err) {
            results[tokenType] = {
              success: false,
              error: err.message,
              address
            };
            console.error(`❌ ${tokenType} failed:`, err);
          }
        }
      }
      
      setTokenData(results);
    } catch (err) {
      setError(err.message);
      console.error('🧪 Test failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        🧪 ERC20 Debug Test
      </h2>
      
      <div className="mb-6">
        <button
          onClick={testTokenReading}
          disabled={loading || !proposal.isProposalReady()}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? 'Testing...' : 'Test ERC20 Reading'}
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">❌ Error: {error}</p>
        </div>
      )}

      {Object.keys(tokenData).length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Test Results:</h3>
          
          {Object.entries(tokenData).map(([tokenType, result]) => (
            <div
              key={tokenType}
              className={`p-4 border rounded-lg ${
                result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-medium">{tokenType}</h4>
                <span className={`text-sm px-2 py-1 rounded ${
                  result.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {result.success ? 'SUCCESS' : 'FAILED'}
                </span>
              </div>
              
              <p className="text-sm text-gray-600 mb-2">
                Address: <code className="bg-gray-100 px-1 rounded">{result.address}</code>
              </p>
              
              {result.success ? (
                <div className="space-y-1 text-sm">
                  <p><strong>Symbol:</strong> <span className="font-mono bg-blue-100 px-1 rounded">{result.data.symbol}</span></p>
                  <p><strong>Name:</strong> <span className="font-mono bg-blue-100 px-1 rounded">{result.data.name}</span></p>
                  <p><strong>Decimals:</strong> <span className="font-mono bg-blue-100 px-1 rounded">{result.data.decimals}</span></p>
                  {result.data.error && (
                    <p className="text-yellow-600"><strong>Warning:</strong> {result.data.error}</p>
                  )}
                </div>
              ) : (
                <p className="text-red-600 text-sm">{result.error}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Current Proposal Info */}
      <div className="mt-8 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <h4 className="font-medium mb-2">Current Proposal Info:</h4>
        <div className="text-sm space-y-1">
          <p><strong>Ready:</strong> {proposal.isProposalReady() ? 'Yes' : 'No'}</p>
          <p><strong>Loading:</strong> {proposal.isLoading() ? 'Yes' : 'No'}</p>
          <p><strong>Error:</strong> {proposal.hasError() ? proposal.getErrorMessage() : 'None'}</p>
          {proposal.isProposalReady() && (
            <>
              <p><strong>Market:</strong> {proposal.getMarketName()}</p>
              <p><strong>Address:</strong> <code>{proposal.proposalAddress}</code></p>
              <p><strong>Tokens:</strong></p>
              <pre className="bg-white p-2 rounded text-xs overflow-auto">
                {JSON.stringify(proposal.getTokens(), null, 2)}
              </pre>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ERC20DebugTest; 