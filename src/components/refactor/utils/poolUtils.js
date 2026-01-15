import { ethers } from 'ethers';

// Constants
const ZERO_ADDRESS = ethers.constants?.AddressZero || "0x0000000000000000000000000000000000000000";

// Pool discovery utilities - similar to algebra-cli.js
const ALGEBRA_FACTORY_ADDRESS = '0x91fd594c46d8b01e62dbdebed2401dde01817834'; // From algebra-cli.js
const ALGEBRA_POSITION_MANAGER = '0x91fd594c46d8b01e62dbdebed2401dde01817834';

const factoryAbi = ['function poolByPair(address,address) view returns (address)'];
const pmAbi = ['function factory() view returns (address)'];

// Get web3 provider
export const getWeb3Provider = () => {
  if (!window.ethereum) {
    throw new Error('Please install MetaMask!');
  }
  return new ethers.providers.Web3Provider(window.ethereum);
};

// Get factory contract
export const getAlgebraFactory = async () => {
  const provider = getWeb3Provider();
  
  // Try to get factory from position manager first
  try {
    const pm = new ethers.Contract(ALGEBRA_POSITION_MANAGER, pmAbi, provider);
    const factoryAddress = await pm.factory();
    return new ethers.Contract(factoryAddress, factoryAbi, provider);
  } catch (error) {
    // Fallback to direct factory address
    console.warn('Could not get factory from position manager, using fallback');
    return new ethers.Contract(ALGEBRA_FACTORY_ADDRESS, factoryAbi, provider);
  }
};

// Find pool address for a token pair (similar to algebra-cli.js poolByPair)
export const findPoolByPair = async (tokenA, tokenB) => {
  try {
    const factory = await getAlgebraFactory();
    const poolAddress = await factory.poolByPair(tokenA, tokenB);
    return poolAddress;
  } catch (error) {
    console.error('Error finding pool:', error);
    return ZERO_ADDRESS;
  }
};

// Pool type detection based on token symbols/addresses
export const detectPoolType = (tokenA, tokenB, tokenASymbol, tokenBSymbol) => {
  const isTokenAConditional = tokenASymbol.startsWith('YES_') || tokenASymbol.startsWith('NO_');
  const isTokenBConditional = tokenBSymbol.startsWith('YES_') || tokenBSymbol.startsWith('NO_');
  
  // Prediction Market: One conditional token + one base token
  if ((isTokenAConditional && !isTokenBConditional) || (!isTokenAConditional && isTokenBConditional)) {
    const conditionalToken = isTokenAConditional ? { address: tokenA, symbol: tokenASymbol } : { address: tokenB, symbol: tokenBSymbol };
    const baseToken = isTokenAConditional ? { address: tokenB, symbol: tokenBSymbol } : { address: tokenA, symbol: tokenASymbol };
    
    return {
      type: 'PREDICTION_MARKET',
      subtype: conditionalToken.symbol.startsWith('YES_') ? 'YES_PREDICTION' : 'NO_PREDICTION',
      conditionalToken,
      baseToken,
      description: `${conditionalToken.symbol}/${baseToken.symbol} Prediction Market`
    };
  }
  
  // Conditional Pool: Both tokens are conditional with same outcome
  if (isTokenAConditional && isTokenBConditional) {
    const outcomeA = tokenASymbol.startsWith('YES_') ? 'YES' : 'NO';
    const outcomeB = tokenBSymbol.startsWith('YES_') ? 'YES' : 'NO';
    
    if (outcomeA === outcomeB) {
      return {
        type: 'CONDITIONAL_CORRELATED',
        subtype: `${outcomeA}_CORRELATED`,
        token0: { address: tokenA, symbol: tokenASymbol },
        token1: { address: tokenB, symbol: tokenBSymbol },
        outcome: outcomeA,
        description: `${tokenASymbol}/${tokenBSymbol} Conditional Pool (${outcomeA} outcome)`
      };
    }
  }
  
  // Regular pool: Neither token is conditional
  if (!isTokenAConditional && !isTokenBConditional) {
    return {
      type: 'REGULAR_POOL',
      subtype: 'BASE_TOKENS',
      token0: { address: tokenA, symbol: tokenASymbol },
      token1: { address: tokenB, symbol: tokenBSymbol },
      description: `${tokenASymbol}/${tokenBSymbol} Base Token Pool`
    };
  }
  
  // Unknown type
  return {
    type: 'UNKNOWN',
    subtype: 'MIXED',
    token0: { address: tokenA, symbol: tokenASymbol },
    token1: { address: tokenB, symbol: tokenBSymbol },
    description: `${tokenASymbol}/${tokenBSymbol} Unknown Pool Type`
  };
};

// Discover all relevant pools for a futarchy proposal
export const discoverFutarchyPools = async (proposalTokens) => {
  const pools = {};
  const poolDetails = {};
  
  console.log('🔍 === STARTING POOL DISCOVERY ===');
  console.log('📋 ProposalTokens object:', proposalTokens);
  console.log('🔧 ProposalTokens.isReady:', proposalTokens.isReady);
  
  // Get all token info
  const currencyToken = proposalTokens.getTokenInfoByType('currencyToken');
  const companyToken = proposalTokens.getTokenInfoByType('companyToken');
  const yesCurrencyToken = proposalTokens.getTokenInfoByType('yesCurrencyToken');
  const noCurrencyToken = proposalTokens.getTokenInfoByType('noCurrencyToken');
  const yesCompanyToken = proposalTokens.getTokenInfoByType('yesCompanyToken');
  const noCompanyToken = proposalTokens.getTokenInfoByType('noCompanyToken');
  
  console.log('🎯 Retrieved token infos:');
  console.log('  💰 currencyToken:', currencyToken);
  console.log('  🏢 companyToken:', companyToken);
  console.log('  ✅💰 yesCurrencyToken:', yesCurrencyToken);
  console.log('  ❌💰 noCurrencyToken:', noCurrencyToken);
  console.log('  ✅🏢 yesCompanyToken:', yesCompanyToken);
  console.log('  ❌🏢 noCompanyToken:', noCompanyToken);
  
  if (!currencyToken || !companyToken || !yesCurrencyToken || !noCurrencyToken || !yesCompanyToken || !noCompanyToken) {
    console.warn('❌ Not all token types available for pool discovery');
    console.warn('Missing tokens:', {
      currencyToken: !currencyToken,
      companyToken: !companyToken, 
      yesCurrencyToken: !yesCurrencyToken,
      noCurrencyToken: !noCurrencyToken,
      yesCompanyToken: !yesCompanyToken,
      noCompanyToken: !noCompanyToken
    });
    return { pools, poolDetails };
  }
  
  // Define the pool pairs we want to discover
  const poolPairs = [
    // Prediction Markets (4 pools - created by futarchy system)
    {
      key: 'YES_CURRENCY_PREDICTION',
      tokenA: yesCurrencyToken.address,
      tokenB: currencyToken.address,
      symbolA: yesCurrencyToken.symbol,
      symbolB: currencyToken.symbol,
      description: 'YES Currency Prediction Market',
      category: 'prediction',
      expected: true
    },
    {
      key: 'NO_CURRENCY_PREDICTION', 
      tokenA: noCurrencyToken.address,
      tokenB: currencyToken.address,
      symbolA: noCurrencyToken.symbol,
      symbolB: currencyToken.symbol,
      description: 'NO Currency Prediction Market',
      category: 'prediction',
      expected: true
    },
    {
      key: 'YES_COMPANY_PREDICTION',
      tokenA: yesCompanyToken.address,
      tokenB: currencyToken.address,
      symbolA: yesCompanyToken.symbol,
      symbolB: currencyToken.symbol,
      description: 'YES Company Prediction Market',
      category: 'prediction',
      expected: true
    },
    {
      key: 'NO_COMPANY_PREDICTION',
      tokenA: noCompanyToken.address,
      tokenB: currencyToken.address,
      symbolA: noCompanyToken.symbol,
      symbolB: currencyToken.symbol,
      description: 'NO Company Prediction Market',
      category: 'prediction',
      expected: true
    },
    // Conditional Correlated Pools (2 pools - created by futarchy system)
    {
      key: 'YES_CORRELATED',
      tokenA: yesCurrencyToken.address,
      tokenB: yesCompanyToken.address,
      symbolA: yesCurrencyToken.symbol,
      symbolB: yesCompanyToken.symbol,
      description: 'YES Outcome Correlated Pool',
      category: 'conditional',
      expected: true
    },
    {
      key: 'NO_CORRELATED',
      tokenA: noCurrencyToken.address,
      tokenB: noCompanyToken.address,
      symbolA: noCurrencyToken.symbol,
      symbolB: noCompanyToken.symbol,
      description: 'NO Outcome Correlated Pool',
      category: 'conditional',
      expected: true
    }
  ];

  // Optional pools that might exist on the DEX (not created by futarchy)
  const optionalPools = [
    {
      key: 'BASE_TOKENS',
      tokenA: currencyToken.address,
      tokenB: companyToken.address,
      symbolA: currencyToken.symbol,
      symbolB: companyToken.symbol,
      description: 'Base Currency/Company Pool (Optional DEX Pool)',
      category: 'dex',
      expected: false
    }
  ];
  
  console.log('🎯 Futarchy pools to discover (expected):', poolPairs);
  console.log('🔍 Optional DEX pools to check:', optionalPools);
  
  // Discover futarchy pools (expected to exist)
  console.log('🔍 Discovering Futarchy pools...');
  
  for (const pair of poolPairs) {
    try {
      console.log(`🔎 Searching for ${pair.expected ? 'EXPECTED' : 'OPTIONAL'} pool: ${pair.description}`);
      console.log(`   Token A: ${pair.symbolA} (${pair.tokenA})`);
      console.log(`   Token B: ${pair.symbolB} (${pair.tokenB})`);
      
      const poolAddress = await findPoolByPair(pair.tokenA, pair.tokenB);
      const poolType = detectPoolType(pair.tokenA, pair.tokenB, pair.symbolA, pair.symbolB);
      
      pools[pair.key] = poolAddress;
      poolDetails[pair.key] = {
        address: poolAddress,
        exists: poolAddress !== ZERO_ADDRESS,
        tokenA: { address: pair.tokenA, symbol: pair.symbolA },
        tokenB: { address: pair.tokenB, symbol: pair.symbolB },
        type: poolType,
        description: pair.description,
        category: pair.category,
        expected: pair.expected
      };
      
      if (poolAddress !== ZERO_ADDRESS) {
        console.log(`  ✅ Found ${pair.description}: ${poolAddress}`);
      } else {
        if (pair.expected) {
          console.log(`  ❌ MISSING EXPECTED: ${pair.description}`);
        } else {
          console.log(`  ℹ️ Optional not found: ${pair.description}`);
        }
      }
    } catch (error) {
      console.error(`❌ Error discovering ${pair.description}:`, error);
      pools[pair.key] = ZERO_ADDRESS;
      poolDetails[pair.key] = {
        address: ZERO_ADDRESS,
        exists: false,
        error: error.message,
        description: pair.description,
        category: pair.category,
        expected: pair.expected
      };
    }
  }

  // Check optional DEX pools
  console.log('🔍 Checking optional DEX pools...');
  
  for (const pair of optionalPools) {
    try {
      console.log(`🔎 Checking optional pool: ${pair.description}`);
      console.log(`   Token A: ${pair.symbolA} (${pair.tokenA})`);
      console.log(`   Token B: ${pair.symbolB} (${pair.tokenB})`);
      
      const poolAddress = await findPoolByPair(pair.tokenA, pair.tokenB);
      const poolType = detectPoolType(pair.tokenA, pair.tokenB, pair.symbolA, pair.symbolB);
      
      pools[pair.key] = poolAddress;
      poolDetails[pair.key] = {
        address: poolAddress,
        exists: poolAddress !== ZERO_ADDRESS,
        tokenA: { address: pair.tokenA, symbol: pair.symbolA },
        tokenB: { address: pair.tokenB, symbol: pair.symbolB },
        type: poolType,
        description: pair.description,
        category: pair.category,
        expected: pair.expected
      };
      
      if (poolAddress !== ZERO_ADDRESS) {
        console.log(`  💡 Found optional DEX pool: ${pair.description}: ${poolAddress}`);
      } else {
        console.log(`  ℹ️ Optional DEX pool not found: ${pair.description} (this is normal)`);
      }
    } catch (error) {
      console.log(`ℹ️ Could not check optional pool ${pair.description}:`, error.message);
      pools[pair.key] = ZERO_ADDRESS;
      poolDetails[pair.key] = {
        address: ZERO_ADDRESS,
        exists: false,
        error: error.message,
        description: pair.description,
        category: pair.category,
        expected: pair.expected
      };
    }
  }
  
  console.log('🎉 === POOL DISCOVERY COMPLETE ===');
  console.log('📊 Discovered pools:', pools);
  console.log('📋 Pool details:', poolDetails);
  
  return { pools, poolDetails };
};

// Get pool statistics (price, liquidity, etc.)
export const getPoolStats = async (poolAddress) => {
  if (poolAddress === ZERO_ADDRESS) {
    return null;
  }
  
  try {
    const provider = getWeb3Provider();
    const poolAbi = [
      'function globalState() view returns (uint160,uint128,int24,uint16,bool,uint8,uint16)',
      'function token0() view returns (address)',
      'function token1() view returns (address)'
    ];
    const pool = new ethers.Contract(poolAddress, poolAbi, provider);
    
    // Get actual token0 and token1 from contract
    const [globalState, token0Address, token1Address] = await Promise.all([
      pool.globalState(),
      pool.token0(),
      pool.token1()
    ]);
    
    // Calculate price from sqrtPriceX96
    const sqrtPriceX96 = globalState[0];
    const price = Number(sqrtPriceX96)**2/2**192; // token1 per token0
    
    return {
      sqrtPriceX96: sqrtPriceX96.toString(),
      price,
      tick: globalState[2],
      liquidity: globalState[1].toString(),
      token0: token0Address.toLowerCase(),
      token1: token1Address.toLowerCase()
    };
  } catch (error) {
    console.error('Error getting pool stats:', error);
    return null;
  }
}; 