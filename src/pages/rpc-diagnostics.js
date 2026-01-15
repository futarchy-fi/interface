import { useState } from 'react';
import { getBestRpc, diagnoseRpcs, clearRpcCache, getRpcCacheStatus } from '../utils/getBestRpc';

/**
 * RPC Diagnostics Page
 *
 * This page helps diagnose RPC connectivity and CORS issues.
 * Access it at: http://localhost:3000/rpc-diagnostics
 */
export default function RPCDiagnostics() {
  const [diagnosticResults, setDiagnosticResults] = useState(null);
  const [bestRpcResult, setBestRpcResult] = useState(null);
  const [cacheStatus, setCacheStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedChain, setSelectedChain] = useState(100); // Default to Gnosis

  const chains = [
    { id: 1, name: 'Ethereum Mainnet' },
    { id: 100, name: 'Gnosis Chain' }
  ];

  const runDiagnostics = async () => {
    setIsLoading(true);
    try {
      const results = await diagnoseRpcs(selectedChain);
      setDiagnosticResults(results);
    } catch (error) {
      console.error('Diagnostics failed:', error);
      setDiagnosticResults({ error: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const testBestRpc = async () => {
    setIsLoading(true);
    try {
      const rpcUrl = await getBestRpc(selectedChain);
      setBestRpcResult({ success: true, url: rpcUrl });
    } catch (error) {
      console.error('Best RPC selection failed:', error);
      setBestRpcResult({ success: false, error: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const checkCache = () => {
    const status = getRpcCacheStatus();
    setCacheStatus(status);
  };

  const clearCache = () => {
    clearRpcCache();
    setCacheStatus(null);
    alert('RPC cache cleared!');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'working': return 'bg-green-100 text-green-800';
      case 'cors-blocked': return 'bg-red-100 text-red-800';
      case 'failed': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">RPC Diagnostics</h1>
        <p className="text-gray-600 mb-8">Test RPC endpoints for connectivity and CORS issues</p>

        {/* Chain Selection */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Chain
          </label>
          <select
            value={selectedChain}
            onChange={(e) => setSelectedChain(Number(e.target.value))}
            className="w-full border border-gray-300 rounded-md px-4 py-2"
          >
            {chains.map(chain => (
              <option key={chain.id} value={chain.id}>
                {chain.name} (Chain ID: {chain.id})
              </option>
            ))}
          </select>
        </div>

        {/* Action Buttons */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Actions</h2>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={runDiagnostics}
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded disabled:opacity-50"
            >
              {isLoading ? 'Running...' : 'Run Full Diagnostics'}
            </button>
            <button
              onClick={testBestRpc}
              disabled={isLoading}
              className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded disabled:opacity-50"
            >
              {isLoading ? 'Testing...' : 'Test Best RPC Selection'}
            </button>
            <button
              onClick={checkCache}
              className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded"
            >
              Check Cache Status
            </button>
            <button
              onClick={clearCache}
              className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded"
            >
              Clear Cache
            </button>
          </div>
        </div>

        {/* Best RPC Result */}
        {bestRpcResult && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Best RPC Selection Result</h2>
            {bestRpcResult.success ? (
              <div className="bg-green-50 border border-green-200 rounded p-4">
                <p className="font-medium text-green-800">✅ Success!</p>
                <p className="text-sm text-gray-700 mt-2">Selected RPC: <code className="bg-gray-100 px-2 py-1 rounded">{bestRpcResult.url}</code></p>
              </div>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded p-4">
                <p className="font-medium text-red-800">❌ Error</p>
                <p className="text-sm text-gray-700 mt-2">{bestRpcResult.error}</p>
              </div>
            )}
          </div>
        )}

        {/* Cache Status */}
        {cacheStatus && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Cache Status</h2>
            {Object.keys(cacheStatus).length === 0 ? (
              <p className="text-gray-600">No cached RPCs</p>
            ) : (
              Object.entries(cacheStatus).map(([key, data]) => (
                <div key={key} className="mb-4 last:mb-0">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-medium">{key}</h3>
                    <span className={`text-xs px-2 py-1 rounded ${data.isExpired ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                      {data.isExpired ? 'Expired' : `Expires in ${data.expiresIn}s`}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    <p>Age: {data.age} seconds</p>
                    <p>Cached RPCs:</p>
                    <ul className="list-disc list-inside ml-4">
                      {data.urls.map((url, i) => (
                        <li key={i} className="text-xs">{url}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Diagnostic Results */}
        {diagnosticResults && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Diagnostic Results</h2>

            {diagnosticResults.error ? (
              <div className="bg-red-50 border border-red-200 rounded p-4">
                <p className="text-red-800">{diagnosticResults.error}</p>
              </div>
            ) : (
              <>
                {/* Summary */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                  <div className="text-center p-4 bg-gray-50 rounded">
                    <p className="text-2xl font-bold">{diagnosticResults.totalRpcs}</p>
                    <p className="text-sm text-gray-600">Total RPCs</p>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded">
                    <p className="text-2xl font-bold text-green-700">{diagnosticResults.working}</p>
                    <p className="text-sm text-gray-600">Working</p>
                  </div>
                  <div className="text-center p-4 bg-red-50 rounded">
                    <p className="text-2xl font-bold text-red-700">{diagnosticResults.corsBlocked}</p>
                    <p className="text-sm text-gray-600">CORS Blocked</p>
                  </div>
                  <div className="text-center p-4 bg-yellow-50 rounded">
                    <p className="text-2xl font-bold text-yellow-700">{diagnosticResults.otherFailures}</p>
                    <p className="text-sm text-gray-600">Other Failures</p>
                  </div>
                </div>

                {/* Detailed Results */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-gray-700">Detailed Results</h3>
                  {diagnosticResults.results.map((result, index) => (
                    <div key={index} className="border border-gray-200 rounded p-4">
                      <div className="flex justify-between items-start mb-2">
                        <code className="text-sm break-all flex-1">{result.url}</code>
                        <span className={`ml-4 text-xs px-2 py-1 rounded whitespace-nowrap ${getStatusColor(result.status)}`}>
                          {result.status}
                        </span>
                      </div>
                      {result.latency && (
                        <p className="text-sm text-gray-600">⚡ Latency: {result.latency.toFixed(0)}ms</p>
                      )}
                      {result.blockNumber && (
                        <p className="text-sm text-gray-600">📦 Block: {result.blockNumber}</p>
                      )}
                      {result.error && (
                        <p className="text-sm text-red-600">❌ Error: {result.error}</p>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-6">
          <h3 className="font-semibold text-blue-900 mb-2">How to Use</h3>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li><strong>Run Full Diagnostics:</strong> Tests all configured RPC endpoints and shows their status</li>
            <li><strong>Test Best RPC Selection:</strong> Runs the actual RPC selection algorithm used by the app</li>
            <li><strong>Check Cache Status:</strong> Shows which RPCs are currently cached and when they expire</li>
            <li><strong>Clear Cache:</strong> Forces a re-test of all RPCs on next selection</li>
          </ul>
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> CORS-blocked RPCs indicate browser security restrictions.
              The app will automatically exclude these and use only working RPCs.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
