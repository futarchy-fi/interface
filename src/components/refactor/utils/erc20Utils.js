import { ethers } from 'ethers';

/**
 * ERC20 Token Utilities
 * Read token information from contracts
 */

// Basic ERC20 ABI for reading token info
const ERC20_ABI = [
  'function symbol() view returns (string)',
  'function name() view returns (string)', 
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)'
];

/**
 * Get RPC provider for Gnosis Chain
 */
export const getGnosisProvider = () => {
  return new ethers.providers.JsonRpcProvider('https://rpc.gnosischain.com');
};

/**
 * Read ERC20 token information from contract
 */
export const readTokenInfo = async (tokenAddress) => {
  if (!tokenAddress || tokenAddress === 'native') {
    console.log('✅ Native token detected');
    return {
      symbol: 'XDAI',
      name: 'Gnosis Chain Native Token',
      decimals: 18,
      isNative: true
    };
  }

  console.log(`📡 Reading token info for: ${tokenAddress}`);

  try {
    const provider = getGnosisProvider();
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

    console.log(`🔍 Calling contract methods for ${tokenAddress}...`);

    const [symbol, name, decimals] = await Promise.all([
      contract.symbol().catch(err => {
        console.error(`Symbol call failed for ${tokenAddress}:`, err);
        return `SYM_${tokenAddress.slice(0, 6)}`;
      }),
      contract.name().catch(err => {
        console.error(`Name call failed for ${tokenAddress}:`, err);
        return `Token ${tokenAddress.slice(0, 8)}...`;
      }),
      contract.decimals().catch(err => {
        console.error(`Decimals call failed for ${tokenAddress}:`, err);
        return 18;
      })
    ]);

    console.log(`✅ Token info loaded for ${tokenAddress}:`, { symbol, name, decimals });

    return {
      symbol,
      name, 
      decimals,
      isNative: false,
      address: tokenAddress
    };
  } catch (error) {
    console.error(`❌ Error reading token info for ${tokenAddress}:`, error);
    return {
      symbol: `TOKEN_${tokenAddress.slice(0, 6)}`,
      name: `Unknown Token ${tokenAddress.slice(0, 8)}...`,
      decimals: 18,
      isNative: false,
      address: tokenAddress,
      error: error.message
    };
  }
};

/**
 * Read multiple token infos in parallel
 */
export const readMultipleTokenInfos = async (tokenAddresses) => {
  console.log('📡 Reading multiple token infos for addresses:', tokenAddresses);
  
  const promises = tokenAddresses.map(address => 
    readTokenInfo(address).catch(error => {
      console.error(`❌ Failed to read token ${address}:`, error);
      return {
        symbol: `ERR_${address.slice(0, 6)}`,
        name: `Error Token ${address.slice(0, 8)}...`,
        decimals: 18,
        isNative: false,
        address,
        error: error.message
      };
    })
  );

  const results = await Promise.all(promises);
  
  // Return as address -> info mapping
  const mapping = {};
  tokenAddresses.forEach((address, index) => {
    mapping[address] = results[index];
    console.log(`📝 Mapped ${address} ->`, results[index]);
  });
  
  console.log('✅ All token infos loaded:', mapping);
  return mapping;
};

/**
 * Enhanced token categorization based on proposal structure
 */
export const categorizeProposalToken = (tokenType, tokenInfo, proposalData = null) => {
  const categories = {
    native: {
      category: 'Native',
      color: '#1E40AF',
      bgColor: '#EBF4FF',
      icon: '💎',
      description: 'Native gas token for Gnosis Chain'
    },
    
    // Base collateral tokens
    baseCurrency: {
      category: 'Base Currency',
      color: '#059669', 
      bgColor: '#D1FAE5',
      icon: '💰',
      description: 'Currency collateral token for this market'
    },
    baseCompany: {
      category: 'Base Company',
      color: '#7C3AED',
      bgColor: '#EDE9FE', 
      icon: '🏢',
      description: 'Company collateral token for this market'
    },
    
    // Currency outcome tokens
    currencyYes: {
      category: 'Currency YES',
      color: '#10B981',
      bgColor: '#D1FAE5',
      icon: '✅💰',
      description: 'YES position in currency market'
    },
    currencyNo: {
      category: 'Currency NO', 
      color: '#EF4444',
      bgColor: '#FEE2E2',
      icon: '❌💰',
      description: 'NO position in currency market'
    },
    
    // Company outcome tokens
    companyYes: {
      category: 'Company YES',
      color: '#10B981',
      bgColor: '#D1FAE5', 
      icon: '✅🏢',
      description: 'YES position in company market'
    },
    companyNo: {
      category: 'Company NO',
      color: '#EF4444',
      bgColor: '#FEE2E2',
      icon: '❌🏢', 
      description: 'NO position in company market'
    }
  };

  const categoryData = categories[tokenType] || {
    category: 'Unknown',
    color: '#6B7280',
    bgColor: '#F3F4F6',
    icon: '❓',
    description: 'Unknown token type'
  };

  return {
    ...categoryData,
    // Use actual token info from contract
    symbol: tokenInfo.symbol,
    name: tokenInfo.name,
    decimals: tokenInfo.decimals,
    address: tokenInfo.address,
    tokenType,
    isConditional: ['currencyYes', 'currencyNo', 'companyYes', 'companyNo'].includes(tokenType),
    isBaseToken: ['baseCurrency', 'baseCompany'].includes(tokenType),
    isNative: tokenInfo.isNative,
    proposalMarket: proposalData?.marketName || null,
    error: tokenInfo.error
  };
};

/**
 * Cache for token information to avoid repeated calls
 */
let tokenInfoCache = {};
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get token info with caching
 */
export const getCachedTokenInfo = async (tokenAddress) => {
  const now = Date.now();
  const cacheKey = tokenAddress;
  
  // Check if cache is valid and has the token
  if (now - cacheTimestamp < CACHE_DURATION && tokenInfoCache[cacheKey]) {
    return tokenInfoCache[cacheKey];
  }
  
  // Read from contract
  const tokenInfo = await readTokenInfo(tokenAddress);
  
  // Update cache
  tokenInfoCache[cacheKey] = tokenInfo;
  cacheTimestamp = now;
  
  return tokenInfo;
};

/**
 * Clear token info cache
 */
export const clearTokenInfoCache = () => {
  tokenInfoCache = {};
  cacheTimestamp = 0;
};

/**
 * Validate if token address looks valid
 */
export const isValidTokenAddress = (address) => {
  if (!address || address === 'native') return true;
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

export default {
  readTokenInfo,
  readMultipleTokenInfos,
  categorizeProposalToken,
  getCachedTokenInfo,
  clearTokenInfoCache,
  isValidTokenAddress,
  getGnosisProvider
}; 