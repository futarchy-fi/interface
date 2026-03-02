import { useState } from 'react';
import { useCompanyInfo } from '../hooks/useCompanyInfo';
import { DEFAULT_COMPANY_ID } from '../constants/supabase';

/**
 * Company Information Display Component
 * Provides a UI for fetching and displaying company information from Supabase Edge Functions
 */
const CompanyInfoDisplay = () => {
  const [inputId, setInputId] = useState(DEFAULT_COMPANY_ID);
  const {
    companyInfo,
    loading,
    error,
    status,
    fetchCompanyInfo,
    refreshCompanyInfo,
    clearCompanyInfo,
    getFetchStats,
    isDataStale,
    hasData,
    fetchHistory,
    lastFetchedId
  } = useCompanyInfo(DEFAULT_COMPANY_ID);

  const handleFetchById = async () => {
    if (!inputId || inputId < 1) {
      alert('Please enter a valid company ID (positive integer)');
      return;
    }
    await fetchCompanyInfo(inputId);
  };

  const handleInputChange = (e) => {
    const value = parseInt(e.target.value, 10);
    setInputId(isNaN(value) ? '' : value);
  };

  const fetchStats = getFetchStats();

  return (
    <div className="bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-6 rounded-t-lg">
        <h2 className="text-2xl font-bold mb-2">🏢 Company Information</h2>
        <p className="text-blue-100">
          Fetch company details using Supabase Edge Functions
        </p>
      </div>

      {/* Input Section */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-end gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Company ID
            </label>
            <input
              type="number"
              value={inputId}
              onChange={handleInputChange}
              placeholder={`Enter ID (default: ${DEFAULT_COMPANY_ID})`}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              min="1"
              step="1"
            />
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={handleFetchById}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {loading ? '🔄 Fetching...' : '📥 Fetch Company'}
            </button>
            
            <button
              onClick={() => fetchCompanyInfo(DEFAULT_COMPANY_ID)}
              disabled={loading}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {loading ? '🔄 Loading...' : `🏠 Default (ID: ${DEFAULT_COMPANY_ID})`}
            </button>
            
            {hasData && (
              <button
                onClick={refreshCompanyInfo}
                disabled={loading}
                className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                🔄 Refresh
              </button>
            )}
            
            {hasData && (
              <button
                onClick={clearCompanyInfo}
                disabled={loading}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                🗑️ Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Status Section */}
      <div className="p-6">
        {/* Status Badge */}
        <div className="mb-4">
          <span className="text-sm font-medium text-gray-600 mr-2">Status:</span>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            status === 'loading' ? 'bg-blue-100 text-blue-800' :
            status === 'success' ? 'bg-green-100 text-green-800' :
            status === 'error' ? 'bg-red-100 text-red-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {status === 'loading' && '🔄 Loading'}
            {status === 'success' && '✅ Success'}
            {status === 'error' && '❌ Error'}
            {status === 'idle' && '⏸️ Idle'}
          </span>
          
          {hasData && isDataStale() && (
            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
              ⚠️ Data may be stale
            </span>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <h4 className="text-red-800 font-medium mb-1">Error</h4>
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {/* Company Info Display */}
        {hasData && companyInfo && (
          <div className="mb-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                📋 Company Information (ID: {lastFetchedId})
              </h3>
              
              {/* Formatted Display */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <span className="text-sm font-medium text-gray-600">Company Name:</span>
                  <p className="text-gray-900">{companyInfo.displayName}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600">Company ID:</span>
                  <p className="text-gray-900">{companyInfo.id}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600">Fetched At:</span>
                  <p className="text-gray-900 text-sm">
                    {new Date(companyInfo.fetchedAt).toLocaleString()}
                  </p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600">Valid Data:</span>
                  <p className="text-gray-900">
                    {companyInfo.hasValidData ? '✅ Yes' : '❌ No'}
                  </p>
                </div>
              </div>

              {/* Raw JSON Display */}
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
                  📄 Show Raw JSON Data
                </summary>
                <pre className="mt-2 p-3 bg-gray-100 rounded-md text-xs overflow-x-auto border">
                  {JSON.stringify(companyInfo, null, 2)}
                </pre>
              </details>
            </div>
          </div>
        )}

        {/* Statistics */}
        {fetchHistory.length > 0 && (
          <div className="mt-6">
            <h4 className="text-md font-semibold text-gray-900 mb-3">📊 Fetch Statistics</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{fetchStats.total}</div>
                <div className="text-sm text-blue-700">Total Requests</div>
              </div>
              <div className="bg-green-50 p-3 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{fetchStats.successful}</div>
                <div className="text-sm text-green-700">Successful</div>
              </div>
              <div className="bg-red-50 p-3 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{fetchStats.failed}</div>
                <div className="text-sm text-red-700">Failed</div>
              </div>
              <div className="bg-purple-50 p-3 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">{fetchStats.averageDuration}ms</div>
                <div className="text-sm text-purple-700">Avg Duration</div>
              </div>
            </div>

            {/* Recent History */}
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
                📝 Show Recent Fetch History ({fetchHistory.length})
              </summary>
              <div className="mt-2 max-h-40 overflow-y-auto">
                {fetchHistory.map((fetch, index) => (
                  <div key={index} className={`p-2 rounded mb-1 text-xs ${
                    fetch.success ? 'bg-green-50 border-l-2 border-green-400' : 'bg-red-50 border-l-2 border-red-400'
                  }`}>
                    <div className="flex justify-between items-center">
                      <span>ID: {fetch.id} | {fetch.success ? '✅' : '❌'} | {fetch.duration}ms</span>
                      <span className="text-gray-500">{new Date(fetch.timestamp).toLocaleTimeString()}</span>
                    </div>
                    {fetch.error && <div className="text-red-600 mt-1">{fetch.error}</div>}
                  </div>
                ))}
              </div>
            </details>
          </div>
        )}

        {/* No Data State */}
        {!hasData && !loading && !error && (
          <div className="text-center py-8">
            <div className="text-gray-400 text-6xl mb-4">🏢</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Company Data</h3>
            <p className="text-gray-600 mb-4">
              Enter a company ID above and click "Fetch Company" to get started.
            </p>
            <p className="text-sm text-gray-500">
              Default company ID is {DEFAULT_COMPANY_ID}. You can use that to test the functionality.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CompanyInfoDisplay; 