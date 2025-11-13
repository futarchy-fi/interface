import React from 'react';
import { usePoolDiscovery } from '../hooks/usePoolDiscovery';

const ArthurTests = () => {
  const { 
    pools, 
    poolStats, 
    poolDetails,
    loading, 
    error, 
    discoverPools, 
    isReady 
  } = usePoolDiscovery();

  // Create our own getFutarchyPools function
  const getFutarchyPools = () => {
    return {
      // Prediction Markets
      yesCompany: {
        address: pools.YES_COMPANY_PREDICTION,
        exists: poolDetails.YES_COMPANY_PREDICTION?.exists || false,
        stats: poolStats.YES_COMPANY_PREDICTION,
        details: poolDetails.YES_COMPANY_PREDICTION
      },
      noCompany: {
        address: pools.NO_COMPANY_PREDICTION,
        exists: poolDetails.NO_COMPANY_PREDICTION?.exists || false,
        stats: poolStats.NO_COMPANY_PREDICTION,
        details: poolDetails.NO_COMPANY_PREDICTION
      },
      yesCurrency: {
        address: pools.YES_CURRENCY_PREDICTION,
        exists: poolDetails.YES_CURRENCY_PREDICTION?.exists || false,
        stats: poolStats.YES_CURRENCY_PREDICTION,
        details: poolDetails.YES_CURRENCY_PREDICTION
      },
      noCurrency: {
        address: pools.NO_CURRENCY_PREDICTION,
        exists: poolDetails.NO_CURRENCY_PREDICTION?.exists || false,
        stats: poolStats.NO_CURRENCY_PREDICTION,
        details: poolDetails.NO_CURRENCY_PREDICTION
      },
      // Conditional Correlated Pools
      yesCorrelated: {
        address: pools.YES_CORRELATED,
        exists: poolDetails.YES_CORRELATED?.exists || false,
        stats: poolStats.YES_CORRELATED,
        details: poolDetails.YES_CORRELATED
      },
      noCorrelated: {
        address: pools.NO_CORRELATED,
        exists: poolDetails.NO_CORRELATED?.exists || false,
        stats: poolStats.NO_CORRELATED,
        details: poolDetails.NO_CORRELATED
      }
    };
  };

  const futarchyPools = getFutarchyPools();

  // Get company YES price
  const getCompanyYesPrice = () => {
    const companyYes = futarchyPools.yesCompany;
    if (companyYes?.exists && companyYes?.stats?.price) {
      return parseFloat(companyYes.stats.price).toFixed(6);
    }
    return 'N/A';
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          🧪 Arthur Tests - Company YES Price
        </h2>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Loading pools...</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="text-red-800">
              <strong>Error:</strong> {error}
            </div>
          </div>
        )}

        {/* Manual Discovery Button */}
        <div className="mb-6">
          <button
            onClick={discoverPools}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            {loading ? 'Discovering...' : 'Discover Pools'}
          </button>
        </div>

        {/* Company YES Price Display */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Main Price Card */}
          <div className="bg-gradient-to-r from-green-50 to-green-100 border border-green-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-green-800 mb-4">
              ✅ Company YES Price
            </h3>
            
            <div className="text-3xl font-bold text-green-900 mb-2">
              {getCompanyYesPrice()}
            </div>
            
            <div className="text-sm text-green-700">
              {futarchyPools.yesCompany?.exists ? 
                'Price from live pool' : 
                'Pool not found or no price available'
              }
            </div>

            {/* Pool Status */}
            <div className="mt-4 flex items-center">
              <div className={`w-3 h-3 rounded-full mr-2 ${
                futarchyPools.yesCompany?.exists ? 'bg-green-500' : 'bg-red-500'
              }`}></div>
              <span className="text-sm text-gray-600">
                Pool Status: {futarchyPools.yesCompany?.exists ? 'Active' : 'Not Found'}
              </span>
            </div>
          </div>

          {/* Pool Details Card */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              📊 Pool Details
            </h3>
            
            <div className="space-y-3 text-sm">
              <div>
                <span className="font-medium text-gray-700">Pool Address:</span>
                <div className="text-gray-600 font-mono text-xs">
                  {futarchyPools.yesCompany?.address || 'Not available'}
                </div>
              </div>
              
              <div>
                <span className="font-medium text-gray-700">Pool Exists:</span>
                <span className="ml-2 text-gray-600">
                  {futarchyPools.yesCompany?.exists ? '✅ Yes' : '❌ No'}
                </span>
              </div>

              {futarchyPools.yesCompany?.stats && (
                <div>
                  <span className="font-medium text-gray-700">Raw Price Data:</span>
                  <pre className="mt-1 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                    {JSON.stringify(futarchyPools.yesCompany.stats, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* All Pools Summary */}
        {isReady && (
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-800 mb-4">
              🏊 All Futarchy Pools
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Prediction Markets */}
              <div>
                <h4 className="font-medium text-blue-700 mb-2">Prediction Markets:</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>YES Company:</span>
                    <span className={futarchyPools.yesCompany?.exists ? 'text-green-600' : 'text-red-600'}>
                      {futarchyPools.yesCompany?.exists ? '✅' : '❌'}
                      {futarchyPools.yesCompany?.stats?.price && 
                        ` (${parseFloat(futarchyPools.yesCompany.stats.price).toFixed(6)})`
                      }
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>NO Company:</span>
                    <span className={futarchyPools.noCompany?.exists ? 'text-green-600' : 'text-red-600'}>
                      {futarchyPools.noCompany?.exists ? '✅' : '❌'}
                      {futarchyPools.noCompany?.stats?.price && 
                        ` (${parseFloat(futarchyPools.noCompany.stats.price).toFixed(6)})`
                      }
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>YES Currency:</span>
                    <span className={futarchyPools.yesCurrency?.exists ? 'text-green-600' : 'text-red-600'}>
                      {futarchyPools.yesCurrency?.exists ? '✅' : '❌'}
                      {futarchyPools.yesCurrency?.stats?.price && 
                        ` (${parseFloat(futarchyPools.yesCurrency.stats.price).toFixed(6)})`
                      }
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>NO Currency:</span>
                    <span className={futarchyPools.noCurrency?.exists ? 'text-green-600' : 'text-red-600'}>
                      {futarchyPools.noCurrency?.exists ? '✅' : '❌'}
                      {futarchyPools.noCurrency?.stats?.price && 
                        ` (${parseFloat(futarchyPools.noCurrency.stats.price).toFixed(6)})`
                      }
                    </span>
                  </div>
                </div>
              </div>

              {/* Conditional Correlated Pools */}
              <div>
                <h4 className="font-medium text-blue-700 mb-2">Conditional Pools:</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>YES Correlated:</span>
                    <span className={futarchyPools.yesCorrelated?.exists ? 'text-green-600' : 'text-red-600'}>
                      {futarchyPools.yesCorrelated?.exists ? '✅' : '❌'}
                      {futarchyPools.yesCorrelated?.stats?.price && 
                        ` (${parseFloat(futarchyPools.yesCorrelated.stats.price).toFixed(6)})`
                      }
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>NO Correlated:</span>
                    <span className={futarchyPools.noCorrelated?.exists ? 'text-green-600' : 'text-red-600'}>
                      {futarchyPools.noCorrelated?.exists ? '✅' : '❌'}
                      {futarchyPools.noCorrelated?.stats?.price && 
                        ` (${parseFloat(futarchyPools.noCorrelated.stats.price).toFixed(6)})`
                      }
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Raw Pools Data */}
            <div className="mt-4">
              <h4 className="font-medium text-blue-700 mb-2">Raw Pools Data:</h4>
              <pre className="text-xs bg-blue-100 p-2 rounded overflow-x-auto max-h-40">
                {JSON.stringify(pools, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {/* Hook Usage Example */}
        <div className="mt-8 bg-gray-100 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            🔧 Hook Usage Example
          </h3>
          <pre className="text-sm bg-gray-900 text-green-400 p-4 rounded overflow-x-auto">
{`// Simple usage with getFutarchyPools:
const { pools, poolStats, poolDetails, loading } = usePoolDiscovery();

const getFutarchyPools = () => ({
  yesCompany: {
    address: pools.YES_COMPANY_PREDICTION,
    exists: poolDetails.YES_COMPANY_PREDICTION?.exists,
    stats: poolStats.YES_COMPANY_PREDICTION
  },
  // ... other pools
});

const futarchyPools = getFutarchyPools();
const companyYesPrice = futarchyPools.yesCompany?.stats?.price;

// Current company YES price: ${getCompanyYesPrice()}`}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default ArthurTests; 