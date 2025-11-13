import React, { useState, useCallback, useEffect } from 'react';
import { ethers } from 'ethers';
import { ERC20_ABI } from '../abis';
import { getWeb3Provider, findPoolByPair, detectPoolType } from '../utils/poolUtils';
import { formatTokenAddress } from '../utils/tokenUtils';
import { usePoolCreation } from '../hooks/usePoolCreation';
import { useProposalContext } from '../context/ProposalContext';

// Contract addresses from algebra-cli.js
const POSITION_MGR = '0x91fd594c46d8b01e62dbdebed2401dde01817834';
const ROUTER = '0xffb643e73f280b97809a8b41f7232ab401a04ee1';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

// ABIs from algebra-cli.js
const pmAbi = [
  'function factory() view returns (address)',
  'function createAndInitializePoolIfNecessary(address,address,uint160) returns (address)',
  'function mint((address token0,address token1,int24 tickLower,int24 tickUpper,uint256 amount0Desired,uint256 amount1Desired,uint256 amount0Min,uint256 amount1Min,address recipient,uint256 deadline)) returns (uint256,uint128,uint256,uint256)',
];

const poolAbi = ['function globalState() view returns (uint160,uint128,int24,uint16,bool,uint8,uint16)'];

const PoolSearchAndCreate = () => {
  // State for token inputs
  const [token0Address, setToken0Address] = useState('');
  const [token1Address, setToken1Address] = useState('');
  
  // State for search results
  const [searchResult, setSearchResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // State for token data
  const [token0Data, setToken0Data] = useState(null);
  const [token1Data, setToken1Data] = useState(null);
  
  // State for pool creation
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    amount0: '',
    amount1: '',
    priceRatio: ''
  });
  const [ammTokenOrder, setAmmTokenOrder] = useState(null);

  // Use pool creation hook
  const poolCreation = usePoolCreation();

  // Get proposal context for helpful hints
  const { getTokenAddresses, isProposalReady, getDisplayInfo } = useProposalContext();

  // Load token data similar to algebra-cli.js loadToken function
  const loadTokenData = useCallback(async (address) => {
    try {
      const provider = getWeb3Provider();
      const contract = new ethers.Contract(address, ERC20_ABI, provider);
      
      const [symbol, decimals, totalSupply] = await Promise.all([
        contract.symbol(),
        contract.decimals(),
        contract.totalSupply()
      ]);
      
      // Get user balance if wallet is connected
      let balance = ethers.BigNumber.from(0);
      try {
        const signer = provider.getSigner();
        const userAddress = await signer.getAddress();
        balance = await contract.balanceOf(userAddress);
      } catch (e) {
        console.log('No wallet connected, balance will be 0');
      }
      
      return {
        address,
        contract,
        symbol,
        decimals: Number(decimals),
        totalSupply,
        balance,
        formattedBalance: ethers.utils.formatUnits(balance, decimals)
      };
    } catch (error) {
      console.error(`Error loading token ${address}:`, error);
      throw new Error(`Invalid token address or network error: ${error.message}`);
    }
  }, []);

  // Get pool price similar to algebra-cli.js poolPrice function
  const getPoolPrice = useCallback(async (poolAddress) => {
    try {
      const provider = getWeb3Provider();
      const poolContract = new ethers.Contract(poolAddress, poolAbi, provider);
      const globalState = await poolContract.globalState();
      const sqrtPriceX96 = globalState[0];
      
      // Convert sqrtPriceX96 to human readable price (token1 per token0)
      const price = Number(sqrtPriceX96) ** 2 / 2 ** 192;
      return price;
    } catch (error) {
      console.error('Error getting pool price:', error);
      return null;
    }
  }, []);

  // Search for pool
  const searchPool = useCallback(async () => {
    if (!token0Address || !token1Address) {
      setError('Please enter both token addresses');
      return;
    }

    if (!ethers.utils.isAddress(token0Address) || !ethers.utils.isAddress(token1Address)) {
      setError('Please enter valid Ethereum addresses');
      return;
    }

    if (token0Address.toLowerCase() === token1Address.toLowerCase()) {
      setError('Token addresses cannot be the same');
      return;
    }

    setLoading(true);
    setError(null);
    setSearchResult(null);

    try {
      // Load token data
      console.log('Loading token data...');
      const [token0, token1] = await Promise.all([
        loadTokenData(token0Address),
        loadTokenData(token1Address)
      ]);
      
      setToken0Data(token0);
      setToken1Data(token1);

      // Search for pool
      console.log('Searching for pool...');
      const poolAddress = await findPoolByPair(token0Address, token1Address);
      
      if (poolAddress === ZERO_ADDRESS) {
        // Pool doesn't exist
        const poolType = detectPoolType(token0Address, token1Address, token0.symbol, token1.symbol);
        setSearchResult({
          exists: false,
          poolAddress: null,
          token0,
          token1,
          poolType,
          price: null
        });
      } else {
        // Pool exists - get price and additional info
        console.log('Pool found, getting price...');
        const price = await getPoolPrice(poolAddress);
        const poolType = detectPoolType(token0Address, token1Address, token0.symbol, token1.symbol);
        
        setSearchResult({
          exists: true,
          poolAddress,
          token0,
          token1,
          poolType,
          price,
          formattedPrice: price ? price.toFixed(6) : 'N/A'
        });
      }

    } catch (err) {
      console.error('Search error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token0Address, token1Address, loadTokenData, getPoolPrice]);

  // Determine AMM token ordering (which token will be actual token0/token1)
  const determineAmmTokenOrder = useCallback((token0Addr, token1Addr, token0Symbol, token1Symbol) => {
    const addr0 = ethers.utils.getAddress(token0Addr);
    const addr1 = ethers.utils.getAddress(token1Addr);
    
    if (addr0.toLowerCase() < addr1.toLowerCase()) {
      // User's token0 will be AMM's token0, token1 will be AMM's token1
      return {
        userToken0BecomesAmmToken: 0,
        userToken1BecomesAmmToken: 1,
        ammToken0Address: addr0,
        ammToken1Address: addr1,
        ammToken0Symbol: token0Symbol,
        ammToken1Symbol: token1Symbol,
        isSwapped: false,
        priceExplanation: `1 ${token0Symbol} = X ${token1Symbol}`
      };
    } else {
      // User's token0 will be AMM's token1, token1 will be AMM's token0 (SWAPPED!)
      return {
        userToken0BecomesAmmToken: 1,
        userToken1BecomesAmmToken: 0,
        ammToken0Address: addr1,
        ammToken1Address: addr0,
        ammToken0Symbol: token1Symbol,
        ammToken1Symbol: token0Symbol,
        isSwapped: true,
        priceExplanation: `1 ${token0Symbol} = X ${token1Symbol} (AMM will swap order internally)`
      };
    }
  }, []);

  // Handle create pool button click
  const handleCreatePool = useCallback(() => {
    if (searchResult && searchResult.token0 && searchResult.token1) {
      // Determine the actual AMM token ordering
      const tokenOrder = determineAmmTokenOrder(
        searchResult.token0.address,
        searchResult.token1.address,
        searchResult.token0.symbol,
        searchResult.token1.symbol
      );
      setAmmTokenOrder(tokenOrder);
    }
    setShowCreateForm(true);
    poolCreation.reset();
  }, [poolCreation, searchResult, determineAmmTokenOrder]);

  // Calculate price ratio for pool initialization
  const calculatePriceRatio = useCallback(() => {
    if (!createFormData.amount0 || !createFormData.amount1) return '';
    
    const amt0 = parseFloat(createFormData.amount0);
    const amt1 = parseFloat(createFormData.amount1);
    
    if (amt0 > 0 && amt1 > 0) {
      const ratio = amt1 / amt0;
      return ratio.toFixed(6);
    }
    return '';
  }, [createFormData.amount0, createFormData.amount1]);

  // Update price ratio when amounts change
  useEffect(() => {
    const ratio = calculatePriceRatio();
    setCreateFormData(prev => ({ ...prev, priceRatio: ratio }));
  }, [calculatePriceRatio]);

  // Execute pool creation using the hook
  const executePoolCreation = useCallback(async () => {
    if (!searchResult || !token0Data || !token1Data) return;
    
    if (!createFormData.amount0 || !createFormData.amount1) {
      setError('Please enter both token amounts');
      return;
    }

    setError(null);

    const result = await poolCreation.createPool({
      token0Address,
      token1Address,
      token0Data,
      token1Data,
      amount0String: createFormData.amount0,
      amount1String: createFormData.amount1,
      onStepUpdate: (steps) => {
        // Steps are managed by the hook, no need to update local state
      }
    });

    if (result.success) {
      // Refresh search to show the new pool
      setTimeout(() => {
        searchPool();
        setShowCreateForm(false);
      }, 2000);
    } else {
      setError(result.error);
    }
  }, [searchResult, token0Data, token1Data, createFormData, token0Address, token1Address, searchPool, poolCreation]);

  // Combine local error with pool creation error
  const displayError = error || poolCreation.error;

  // Helper function to check if an address matches a current proposal token
  const getTokenHint = useCallback((address) => {
    if (!isProposalReady() || !address) return null;
    
    const proposalTokens = getTokenAddresses();
    const displayInfo = getDisplayInfo();
    
    const normalizedAddress = address.toLowerCase();
    
    if (proposalTokens.baseCurrency?.toLowerCase() === normalizedAddress) {
      return `💡 Currency Token from ${displayInfo.marketName}`;
    }
    if (proposalTokens.baseCompany?.toLowerCase() === normalizedAddress) {
      return `💡 Company Token from ${displayInfo.marketName}`;
    }
    if (proposalTokens.currencyYes?.toLowerCase() === normalizedAddress) {
      return `💡 YES Currency Token from ${displayInfo.marketName}`;
    }
    if (proposalTokens.currencyNo?.toLowerCase() === normalizedAddress) {
      return `💡 NO Currency Token from ${displayInfo.marketName}`;
    }
    if (proposalTokens.companyYes?.toLowerCase() === normalizedAddress) {
      return `💡 YES Company Token from ${displayInfo.marketName}`;
    }
    if (proposalTokens.companyNo?.toLowerCase() === normalizedAddress) {
      return `💡 NO Company Token from ${displayInfo.marketName}`;
    }
    
    return null;
  }, [isProposalReady, getTokenAddresses, getDisplayInfo]);

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Pool Search & Create</h2>
        <p className="text-gray-600">Search for existing Algebra pools or create new ones</p>
        {isProposalReady() && (
          <p className="text-sm text-blue-600 mt-1">
            💡 Tip: Use the token addresses from "{getDisplayInfo().marketName}" above for relevant pools
          </p>
        )}
      </div>

      {/* Token Input Form */}
      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Token 0 Address
          </label>
          <input
            type="text"
            value={token0Address}
            onChange={(e) => setToken0Address(e.target.value)}
            placeholder="0x..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {getTokenHint(token0Address) && (
            <p className="text-xs text-green-600 mt-1">{getTokenHint(token0Address)}</p>
          )}
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Token 1 Address
          </label>
          <input
            type="text"
            value={token1Address}
            onChange={(e) => setToken1Address(e.target.value)}
            placeholder="0x..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {getTokenHint(token1Address) && (
            <p className="text-xs text-green-600 mt-1">{getTokenHint(token1Address)}</p>
          )}
        </div>
        
        <button
          onClick={searchPool}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Searching...' : 'Search Pool'}
        </button>
      </div>

      {/* Error Display */}
      {displayError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">{displayError}</div>
            </div>
          </div>
        </div>
      )}

      {/* Search Results */}
      {searchResult && (
        <div className="border border-gray-200 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-semibold mb-4">Search Results</h3>
          
          {/* Token Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="bg-gray-50 p-3 rounded">
              <h4 className="font-medium text-gray-900">{searchResult.token0.symbol}</h4>
              <p className="text-sm text-gray-600">{formatTokenAddress(searchResult.token0.address)}</p>
              <p className="text-sm text-gray-500">Balance: {searchResult.token0.formattedBalance}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <h4 className="font-medium text-gray-900">{searchResult.token1.symbol}</h4>
              <p className="text-sm text-gray-600">{formatTokenAddress(searchResult.token1.address)}</p>
              <p className="text-sm text-gray-500">Balance: {searchResult.token1.formattedBalance}</p>
            </div>
          </div>

          {/* Pool Information */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">Pool Information</h4>
            <p className="text-sm text-blue-700 mb-2">{searchResult.poolType.description}</p>
            
            {searchResult.exists ? (
              <div>
                <div className="flex items-center mb-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Pool Exists
                  </span>
                </div>
                <p className="text-sm text-blue-600">
                  <strong>Pool Address:</strong> {formatTokenAddress(searchResult.poolAddress)}
                </p>
                {searchResult.price && (
                  <p className="text-sm text-blue-600">
                    <strong>Current Price:</strong> 1 {searchResult.token0.symbol} = {searchResult.formattedPrice} {searchResult.token1.symbol}
                  </p>
                )}
                <a
                  href={`https://gnosisscan.io/address/${searchResult.poolAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center mt-2 text-sm text-blue-600 hover:text-blue-800"
                >
                  View on Gnosisscan
                  <svg className="ml-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            ) : (
              <div>
                <div className="flex items-center mb-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    Pool Does Not Exist
                  </span>
                </div>
                <p className="text-sm text-blue-600 mb-3">No pool found for this token pair.</p>
                <button
                  onClick={handleCreatePool}
                  className="bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors"
                >
                  Create Pool
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pool Creation Form */}
      {showCreateForm && searchResult && !searchResult.exists && (
        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4">Create New Pool</h3>
          
          {/* AMM Token Order Explanation */}
          {ammTokenOrder && (
            <div className={`mb-4 p-4 rounded-lg border-2 ${
              ammTokenOrder.isSwapped ? 'bg-yellow-50 border-yellow-300' : 'bg-green-50 border-green-300'
            }`}>
              <h4 className="font-semibold text-gray-800 mb-2">
                🔄 AMM Token Ordering {ammTokenOrder.isSwapped ? '(⚠️ SWAPPED)' : '(✅ SAME)'}
              </h4>
              <div className="text-sm space-y-2">
                <p><strong>Your Input Order:</strong> {searchResult.token0.symbol} / {searchResult.token1.symbol}</p>
                <p><strong>AMM Internal Order:</strong> {ammTokenOrder.ammToken0Symbol} / {ammTokenOrder.ammToken1Symbol}</p>
                
                {ammTokenOrder.isSwapped ? (
                  <div className="bg-yellow-100 p-2 rounded border border-yellow-400">
                    <p className="text-yellow-800 font-medium">⚠️ Important: AMM will swap token order internally!</p>
                    <p className="text-yellow-700 text-xs">
                      When you enter amounts below, the price will be calculated as: {ammTokenOrder.priceExplanation}
                    </p>
                  </div>
                ) : (
                  <div className="bg-green-100 p-2 rounded border border-green-400">
                    <p className="text-green-800 font-medium">✅ Token order matches AMM internal order</p>
                    <p className="text-green-700 text-xs">
                      Price will be calculated as: {ammTokenOrder.priceExplanation}
                    </p>
                  </div>
                )}
                
                <div className="text-xs text-gray-600 mt-2">
                  <strong>Technical:</strong> AMM requires token0 address &lt; token1 address.
                  <br />Your {searchResult.token0.symbol} address: <code className="bg-gray-200 px-1 rounded text-xs">{searchResult.token0.address.slice(0,8)}...</code>
                  <br />Your {searchResult.token1.symbol} address: <code className="bg-gray-200 px-1 rounded text-xs">{searchResult.token1.address.slice(0,8)}...</code>
                </div>
              </div>
            </div>
          )}

          {/* Suggested Amounts Helper */}
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-medium text-blue-800 mb-2">💡 Suggested Amounts</h4>
            <p className="text-sm text-blue-700 mb-2">
              Pool creation works better with reasonable amounts. Here are some suggestions:
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setCreateFormData(prev => ({ 
                  ...prev, 
                  amount0: searchResult.token0.symbol.includes('YES_') || searchResult.token0.symbol.includes('NO_') ? '10' : '1',
                  amount1: searchResult.token1.symbol.includes('YES_') || searchResult.token1.symbol.includes('NO_') ? '5' : '100'
                }))}
                className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"
              >
                Prediction Market (10 conditional / 5-100 base)
              </button>
              <button
                onClick={() => setCreateFormData(prev => ({ 
                  ...prev, 
                  amount0: '1',
                  amount1: '1'
                }))}
                className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"
              >
                Equal Amounts (1:1)
              </button>
              <button
                onClick={() => setCreateFormData(prev => ({ 
                  ...prev, 
                  amount0: '100',
                  amount1: '100'
                }))}
                className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"
              >
                Higher Liquidity (100:100)
              </button>
            </div>
            <p className="text-xs text-blue-600 mt-2">
              ⚠️ Avoid tiny amounts like 0.000001 - they can cause precision/gas issues
            </p>
          </div>

          <div className="space-y-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Amount of {searchResult.token0.symbol}
                {ammTokenOrder && ammTokenOrder.isSwapped && (
                  <span className="text-yellow-600 text-xs ml-2">
                    (will be AMM token{ammTokenOrder.userToken0BecomesAmmToken})
                  </span>
                )}
              </label>
              <input
                type="number"
                value={createFormData.amount0}
                onChange={(e) => setCreateFormData(prev => ({ ...prev, amount0: e.target.value }))}
                placeholder={`Enter ${searchResult.token0.symbol} amount`}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Available: {searchResult.token0.formattedBalance} {searchResult.token0.symbol}
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Amount of {searchResult.token1.symbol}
                {ammTokenOrder && ammTokenOrder.isSwapped && (
                  <span className="text-yellow-600 text-xs ml-2">
                    (will be AMM token{ammTokenOrder.userToken1BecomesAmmToken})
                  </span>
                )}
              </label>
              <input
                type="number"
                value={createFormData.amount1}
                onChange={(e) => setCreateFormData(prev => ({ ...prev, amount1: e.target.value }))}
                placeholder={`Enter ${searchResult.token1.symbol} amount`}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Available: {searchResult.token1.formattedBalance} {searchResult.token1.symbol}
              </p>
            </div>
            
            {createFormData.priceRatio && (
              <div className="bg-gray-50 p-3 rounded">
                <p className="text-sm text-gray-700">
                  <strong>Initial Price (Your View):</strong> 1 {searchResult.token0.symbol} = {createFormData.priceRatio} {searchResult.token1.symbol}
                </p>
                {ammTokenOrder && ammTokenOrder.isSwapped && (
                  <p className="text-xs text-yellow-600 mt-1">
                    <strong>AMM Internal Price:</strong> 1 {ammTokenOrder.ammToken0Symbol} = {(1/parseFloat(createFormData.priceRatio)).toFixed(6)} {ammTokenOrder.ammToken1Symbol}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Creation Steps */}
          {poolCreation.steps.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Progress:</h4>
              <div className="space-y-2">
                {poolCreation.steps.map((step) => (
                  <div key={step.id} className="flex items-center space-x-2">
                    {step.status === 'completed' && (
                      <svg className="h-5 w-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {step.status === 'pending' && (
                      <svg className="animate-spin h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    )}
                    {step.status === 'failed' && (
                      <svg className="h-5 w-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                    <span className={`text-sm ${
                      step.status === 'completed' ? 'text-green-700' :
                      step.status === 'pending' ? 'text-blue-700' :
                      step.status === 'failed' ? 'text-red-700' :
                      'text-gray-700'
                    }`}>
                      {step.description}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex space-x-2">
            <button
              onClick={executePoolCreation}
              disabled={poolCreation.loading || !createFormData.amount0 || !createFormData.amount1}
              className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {poolCreation.loading ? 'Creating Pool...' : 'Create Pool & Add Liquidity'}
            </button>
            <button
              onClick={() => setShowCreateForm(false)}
              disabled={poolCreation.loading}
              className="bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PoolSearchAndCreate; 