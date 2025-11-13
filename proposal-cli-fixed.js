#!/usr/bin/env node

/**
 * Simple Terminal Proposal Data Fetcher - FIXED VERSION
 * Run with: node proposal-cli-fixed.js
 * 
 * This script allows you to input a proposal address and get basic proposal data
 * using pure JavaScript and ethers without the React components.
 * 
 * FIXES:
 * - Complete Reality.io ABI (matching working refactor)
 * - Enhanced logging and error handling
 * - Better BigNumber handling
 */

const { ethers } = require('ethers');
const readline = require('readline');

// Configuration
const GNOSIS_RPC_URL = 'https://rpc.gnosischain.com';
const GNOSIS_CHAIN_ID = 100;
const HIDE_POOL_DISCOVERY = true; // Set to false to enable pool discovery

// Proposal Contract ABI (minimal for data reading)
const FUTARCHY_PROPOSAL_ABI = [
  {
    "inputs": [],
    "name": "marketName",
    "outputs": [{"internalType": "string", "name": "", "type": "string"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "collateralToken1",
    "outputs": [{"internalType": "contract IERC20", "name": "", "type": "address"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "collateralToken2", 
    "outputs": [{"internalType": "contract IERC20", "name": "", "type": "address"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "conditionId",
    "outputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "questionId",
    "outputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "numOutcomes",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "index", "type": "uint256"}],
    "name": "wrappedOutcome",
    "outputs": [
      {"internalType": "contract IERC20", "name": "wrapped1155", "type": "address"},
      {"internalType": "bytes", "name": "data", "type": "bytes"}
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

// ERC20 ABI for token details
const ERC20_ABI = [
  {
    "inputs": [],
    "name": "name",
    "outputs": [{"internalType": "string", "name": "", "type": "string"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "symbol",
    "outputs": [{"internalType": "string", "name": "", "type": "string"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "decimals",
    "outputs": [{"internalType": "uint8", "name": "", "type": "uint8"}],
    "stateMutability": "view",
    "type": "function"
  }
];

// Reality.io ABI (complete version from working refactor)
const REALITY_ETH_ABI = [
  {"inputs":[],"stateMutability":"nonpayable","type":"constructor"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"question_id","type":"bytes32"},{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":true,"internalType":"bytes32","name":"answer_hash","type":"bytes32"},{"indexed":false,"internalType":"bytes32","name":"answer","type":"bytes32"},{"indexed":false,"internalType":"uint256","name":"nonce","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"bond","type":"uint256"}],"name":"LogAnswerReveal","type":"event"},
  {"inputs":[{"internalType":"bytes32","name":"question_id","type":"bytes32"}],"name":"getOpeningTS","outputs":[{"internalType":"uint32","name":"","type":"uint32"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"name":"questions","outputs":[{"internalType":"bytes32","name":"content_hash","type":"bytes32"},{"internalType":"address","name":"arbitrator","type":"address"},{"internalType":"uint32","name":"opening_ts","type":"uint32"},{"internalType":"uint32","name":"timeout","type":"uint32"},{"internalType":"uint32","name":"finalize_ts","type":"uint32"},{"internalType":"bool","name":"is_pending_arbitration","type":"bool"},{"internalType":"uint256","name":"bounty","type":"uint256"},{"internalType":"bytes32","name":"best_answer","type":"bytes32"},{"internalType":"bytes32","name":"history_hash","type":"bytes32"},{"internalType":"uint256","name":"bond","type":"uint256"},{"internalType":"uint256","name":"min_bond","type":"uint256"}],"stateMutability":"view","type":"function"}
];

const REALITY_ETH_ADDRESS = '0xE78996A233895bE74a66F451f1019cA9734205cc';

// Algebra Factory and Pool ABIs for pool discovery
const ALGEBRA_FACTORY_ADDRESS = '0x91fd594c46d8b01e62dbdebed2401dde01817834';
const ALGEBRA_FACTORY_ABI = [
  {
    "inputs": [{"internalType": "address", "name": "tokenA", "type": "address"}, {"internalType": "address", "name": "tokenB", "type": "address"}],
    "name": "poolByPair",
    "outputs": [{"internalType": "address", "name": "pool", "type": "address"}],
    "stateMutability": "view",
    "type": "function"
  }
];

// Algebra Pool ABI for getting pool data
const ALGEBRA_POOL_ABI = [
  {
    "inputs": [],
    "name": "token0",
    "outputs": [{"internalType": "address", "name": "", "type": "address"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "token1", 
    "outputs": [{"internalType": "address", "name": "", "type": "address"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "globalState",
    "outputs": [
      {"internalType": "uint160", "name": "price", "type": "uint160"},
      {"internalType": "int24", "name": "tick", "type": "int24"},
      {"internalType": "uint16", "name": "lastFee", "type": "uint16"},
      {"internalType": "uint8", "name": "pluginConfig", "type": "uint8"},
      {"internalType": "uint16", "name": "communityFee", "type": "uint16"},
      {"internalType": "bool", "name": "unlocked", "type": "bool"}
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

/**
 * Get provider for Gnosis Chain
 */
function getProvider() {
  return new ethers.providers.JsonRpcProvider(GNOSIS_RPC_URL, {
    chainId: GNOSIS_CHAIN_ID,
    name: 'gnosis'
  });
}

/**
 * Get proposal contract instance
 */
function getProposalContract(proposalAddress, provider) {
  return new ethers.Contract(proposalAddress, FUTARCHY_PROPOSAL_ABI, provider);
}

/**
 * Get ERC20 contract instance
 */
function getERC20Contract(tokenAddress, provider) {
  return new ethers.Contract(tokenAddress, ERC20_ABI, provider);
}

/**
 * Get Reality.io contract instance
 */
function getRealityContract(provider) {
  return new ethers.Contract(REALITY_ETH_ADDRESS, REALITY_ETH_ABI, provider);
}

/**
 * Get token metadata
 */
async function getTokenMetadata(tokenAddress, provider) {
  try {
    const contract = getERC20Contract(tokenAddress, provider);
    const [name, symbol, decimals] = await Promise.all([
      contract.name(),
      contract.symbol(),
      contract.decimals()
    ]);
    
    return { name, symbol, decimals, address: tokenAddress };
  } catch (error) {
    console.warn(`Warning: Could not read token metadata for ${tokenAddress}:`, error.message);
    return { 
      name: 'Unknown Token', 
      symbol: 'UNKNOWN', 
      decimals: 18, 
      address: tokenAddress 
    };
  }
}

/**
 * Get Algebra factory contract
 */
function getAlgebraFactory(provider) {
  return new ethers.Contract(ALGEBRA_FACTORY_ADDRESS, ALGEBRA_FACTORY_ABI, provider);
}

/**
 * Get Algebra pool contract
 */
function getAlgebraPool(poolAddress, provider) {
  return new ethers.Contract(poolAddress, ALGEBRA_POOL_ABI, provider);
}

/**
 * Find pool address for token pair
 */
async function findPoolByPair(tokenA, tokenB, provider) {
  try {
    const factory = getAlgebraFactory(provider);
    const poolAddress = await factory.poolByPair(tokenA, tokenB);
    
    // Check if pool address is valid
    if (!poolAddress || poolAddress === ethers.constants.AddressZero) {
      return ethers.constants.AddressZero;
    }
    
    return poolAddress;
  } catch (error) {
    // Don't log detailed errors for missing pools - it's expected behavior
    if (error.message.includes('execution reverted') || 
        error.message.includes('VM execution error') ||
        error.message.includes('missing revert data')) {
      // Pool doesn't exist - this is normal, not an error
      return ethers.constants.AddressZero;
    }
    
    console.error(`Unexpected error finding pool for ${tokenA}/${tokenB}:`, error.message);
    return ethers.constants.AddressZero;
  }
}

/**
 * Get pool data including token info and prices
 */
async function getPoolData(poolAddress, provider) {
  if (poolAddress === ethers.constants.AddressZero) {
    return null;
  }

  try {
    const pool = getAlgebraPool(poolAddress, provider);
    
    // Get pool state and token addresses
    const [globalState, token0Address, token1Address] = await Promise.all([
      pool.globalState(),
      pool.token0(),
      pool.token1()
    ]);

    // Get token metadata
    const [token0Meta, token1Meta] = await Promise.all([
      getTokenMetadata(token0Address, provider),
      getTokenMetadata(token1Address, provider)
    ]);

    // Calculate prices from sqrtPriceX96
    const sqrtPriceX96 = globalState[0];
    const sqrtPriceX96Number = Number(sqrtPriceX96);
    
    if (sqrtPriceX96Number === 0) {
      return {
        poolAddress,
        token0: token0Meta,
        token1: token1Meta,
        exists: true,
        initialized: false,
        error: 'Pool not initialized (price = 0)'
      };
    }

    // Calculate price: token1 per token0
    const price = Math.pow(sqrtPriceX96Number / Math.pow(2, 96), 2);
    
    // Adjust for decimals
    const decimalsAdjustment = Math.pow(10, token0Meta.decimals - token1Meta.decimals);
    const token1PerToken0 = price * decimalsAdjustment;
    const token0PerToken1 = 1 / token1PerToken0;

    return {
      poolAddress,
      token0: token0Meta,
      token1: token1Meta,
      exists: true,
      initialized: true,
      prices: {
        token1PerToken0: token1PerToken0,
        token0PerToken1: token0PerToken1,
        sqrtPriceX96: sqrtPriceX96.toString()
      },
      tick: globalState[1].toString()
    };

  } catch (error) {
    console.error(`Error getting pool data for ${poolAddress}:`, error.message);
    return {
      poolAddress,
      exists: false,
      error: error.message
    };
  }
}

/**
 * Explore pools for a proposal
 */
async function exploreProposalPools(proposalData, provider) {
  console.log('\n🏊 Exploring Futarchy Pools...\n');
  
  const { wrappedOutcomes, tokens } = proposalData;
  
  console.log('🔍 [DEBUG] Raw proposalData:');
  console.log('  wrappedOutcomes:', wrappedOutcomes);
  console.log('  tokens:', tokens);
  console.log('');
  
  // Map wrapped outcomes to typed tokens
  const yesCompanyToken = wrappedOutcomes[0]?.address;  // Index 0
  const noCompanyToken = wrappedOutcomes[1]?.address;   // Index 1  
  const yesCurrencyToken = wrappedOutcomes[2]?.address; // Index 2
  const noCurrencyToken = wrappedOutcomes[3]?.address;  // Index 3
  
  console.log('🔍 [DEBUG] Mapped token addresses:');
  console.log('  yesCompanyToken (index 0):', yesCompanyToken);
  console.log('  noCompanyToken (index 1):', noCompanyToken);
  console.log('  yesCurrencyToken (index 2):', yesCurrencyToken);
  console.log('  noCurrencyToken (index 3):', noCurrencyToken);
  console.log('  companyToken (base):', tokens.companyToken);
  console.log('  currencyToken (base):', tokens.currencyToken);
  
  // Compare with refactor constants (known working tokens)
  console.log('🔍 [DEBUG] Compare with refactor constants:');
  const REFACTOR_POSITION_TOKENS = {
    currency: {
      yes: '0x9ea98d3f845c3b3bdb2310aa5c301505b61402c7', // YES_SDAI
      no: '0x24334a29a324ed40a08aaf035bbedff374313145',  // NO_SDAI
    },
    company: {
      yes: '0x481c7bfaf541d3c42a841a752c19c4664708ff5d', // YES_GNO
      no: '0x5cde0e3d8b69345b7a6143cfb3fdf4d4a6659d5d',  // NO_GNO
    }
  };
  
  console.log('  REFACTOR YES_CURRENCY:', REFACTOR_POSITION_TOKENS.currency.yes);
  console.log('  MY yesCurrencyToken:   ', yesCurrencyToken);
  console.log('  MATCH:', REFACTOR_POSITION_TOKENS.currency.yes === yesCurrencyToken);
  
  console.log('  REFACTOR NO_CURRENCY: ', REFACTOR_POSITION_TOKENS.currency.no);
  console.log('  MY noCurrencyToken:   ', noCurrencyToken);
  console.log('  MATCH:', REFACTOR_POSITION_TOKENS.currency.no === noCurrencyToken);
  
  console.log('  REFACTOR YES_COMPANY: ', REFACTOR_POSITION_TOKENS.company.yes);
  console.log('  MY yesCompanyToken:   ', yesCompanyToken);
  console.log('  MATCH:', REFACTOR_POSITION_TOKENS.company.yes === yesCompanyToken);
  
  console.log('  REFACTOR NO_COMPANY:  ', REFACTOR_POSITION_TOKENS.company.no);
  console.log('  MY noCompanyToken:    ', noCompanyToken);
  console.log('  MATCH:', REFACTOR_POSITION_TOKENS.company.no === noCompanyToken);
  
  console.log('');
  
  // Get metadata for wrapped tokens
  console.log('🪙 Getting wrapped token metadata...');
  const [yesCompanyMeta, noCompanyMeta, yesCurrencyMeta, noCurrencyMeta, companyMeta, currencyMeta] = await Promise.all([
    getTokenMetadata(yesCompanyToken, provider),
    getTokenMetadata(noCompanyToken, provider),
    getTokenMetadata(yesCurrencyToken, provider),
    getTokenMetadata(noCurrencyToken, provider),
    getTokenMetadata(tokens.companyToken, provider),
    getTokenMetadata(tokens.currencyToken, provider)
  ]);

  // Define pools to discover
  const poolsToDiscover = [
    // 2 Conditional Pools
    {
      name: 'YES Conditional Pool',
      description: 'YES_CURRENCY / YES_COMPANY',
      tokenA: yesCurrencyToken,
      tokenB: yesCompanyToken,
      tokenAMeta: yesCurrencyMeta,
      tokenBMeta: yesCompanyMeta,
      category: 'conditional',
      type: 'YES'
    },
    {
      name: 'NO Conditional Pool', 
      description: 'NO_CURRENCY / NO_COMPANY',
      tokenA: noCurrencyToken,
      tokenB: noCompanyToken,
      tokenAMeta: noCurrencyMeta,
      tokenBMeta: noCompanyMeta,
      category: 'conditional',
      type: 'NO'
    },
    // 4 Prediction Pools
    {
      name: 'YES Currency Prediction',
      description: 'YES_CURRENCY / CURRENCY',
      tokenA: yesCurrencyToken,
      tokenB: tokens.currencyToken,
      tokenAMeta: yesCurrencyMeta,
      tokenBMeta: currencyMeta,
      category: 'prediction',
      type: 'YES_CURRENCY'
    },
    {
      name: 'NO Currency Prediction',
      description: 'NO_CURRENCY / CURRENCY', 
      tokenA: noCurrencyToken,
      tokenB: tokens.currencyToken,
      tokenAMeta: noCurrencyMeta,
      tokenBMeta: currencyMeta,
      category: 'prediction',
      type: 'NO_CURRENCY'
    },
    {
      name: 'YES Company Prediction',
      description: 'YES_COMPANY / CURRENCY',
      tokenA: yesCompanyToken,
      tokenB: tokens.currencyToken,
      tokenAMeta: yesCompanyMeta,
      tokenBMeta: currencyMeta,
      category: 'prediction',
      type: 'YES_COMPANY'
    },
    {
      name: 'NO Company Prediction',
      description: 'NO_COMPANY / CURRENCY',
      tokenA: noCompanyToken,
      tokenB: tokens.currencyToken,
      tokenAMeta: noCompanyMeta,
      tokenBMeta: currencyMeta,
      category: 'prediction',
      type: 'NO_COMPANY'
    }
  ];

  console.log('🔍 Discovering pools...\n');
  
  const poolResults = [];
  
  for (const poolConfig of poolsToDiscover) {
    console.log(`🔎 Looking for: ${poolConfig.name}`);
    console.log(`   ${poolConfig.tokenAMeta.symbol} / ${poolConfig.tokenBMeta.symbol}`);
    console.log(`   [DEBUG] TokenA: ${poolConfig.tokenA}`);
    console.log(`   [DEBUG] TokenB: ${poolConfig.tokenB}`);
    
    // Find pool
    console.log(`   [DEBUG] Calling findPoolByPair(${poolConfig.tokenA}, ${poolConfig.tokenB})`);
    const poolAddress = await findPoolByPair(poolConfig.tokenA, poolConfig.tokenB, provider);
    
    if (poolAddress === ethers.constants.AddressZero) {
      console.log(`   ❌ Pool not found`);
      poolResults.push({
        ...poolConfig,
        poolAddress: ethers.constants.AddressZero,
        exists: false
      });
    } else {
      console.log(`   ✅ Found pool: ${poolAddress}`);
      
      // Get pool data
      const poolData = await getPoolData(poolAddress, provider);
      poolResults.push({
        ...poolConfig,
        ...poolData
      });
    }
    
    console.log('');
  }

  // Display results
  displayPoolResults(poolResults);
}

/**
 * Display pool exploration results
 */
function displayPoolResults(poolResults) {
  console.log('\n' + '='.repeat(80));
  console.log('🏊 FUTARCHY POOLS EXPLORATION RESULTS');
  console.log('='.repeat(80));

  // Group by category
  const conditionalPools = poolResults.filter(p => p.category === 'conditional');
  const predictionPools = poolResults.filter(p => p.category === 'prediction');

  // Display conditional pools
  console.log('\n🔗 CONDITIONAL POOLS (YES/NO Outcome Correlation)');
  console.log('-'.repeat(60));
  conditionalPools.forEach(pool => displayPoolInfo(pool));

  // Display prediction pools  
  console.log('\n📈 PREDICTION POOLS (Outcome vs Base Token)');
  console.log('-'.repeat(60));
  predictionPools.forEach(pool => displayPoolInfo(pool));

  console.log('\n' + '='.repeat(80));
  console.log('📊 Pool exploration completed!');
}

/**
 * Display individual pool information
 */
function displayPoolInfo(pool) {
  console.log(`\n📍 ${pool.name}`);
  console.log(`   Description: ${pool.description}`);
  console.log(`   Address: ${pool.poolAddress}`);
  
  if (!pool.exists) {
    console.log(`   ❌ Status: Pool does not exist`);
    return;
  }
  
  if (!pool.initialized) {
    console.log(`   ⚠️ Status: Pool exists but not initialized`);
    console.log(`   Error: ${pool.error}`);
    return;
  }
  
  console.log(`   ✅ Status: Active and initialized`);
  console.log(`   Token0: ${pool.token0.name} (${pool.token0.symbol})`);
  console.log(`     Address: ${pool.token0.address}`);
  console.log(`     Decimals: ${pool.token0.decimals}`);
  console.log(`   Token1: ${pool.token1.name} (${pool.token1.symbol})`);
  console.log(`     Address: ${pool.token1.address}`);
  console.log(`     Decimals: ${pool.token1.decimals}`);
  
  if (pool.prices) {
    console.log(`   💰 Prices:`);
    console.log(`     1 ${pool.token0.symbol} = ${formatPrice(pool.prices.token1PerToken0)} ${pool.token1.symbol}`);
    console.log(`     1 ${pool.token1.symbol} = ${formatPrice(pool.prices.token0PerToken1)} ${pool.token0.symbol}`);
    console.log(`   📊 Technical: Tick ${pool.tick}, sqrtPriceX96: ${pool.prices.sqrtPriceX96}`);
  }
}

/**
 * Format price for display
 */
function formatPrice(price) {
  if (price === 0) return '0';
  if (price < 0.000001) return price.toExponential(4);
  if (price < 0.01) return price.toFixed(8);
  if (price < 1) return price.toFixed(6);
  if (price < 1000) return price.toFixed(4);
  return price.toFixed(2);
}

/**
 * Get proposal opening time from Reality.io (improved version matching refactor)
 */
async function getOpeningTime(questionId, provider) {
  try {
    console.log('🔍 [Reality.io] Input questionId:', questionId);
    console.log('🔍 [Reality.io] Input questionId type:', typeof questionId);
    console.log('🔍 [Reality.io] Input questionId toString:', questionId.toString());
    console.log('🔍 [Reality.io] Input questionId as hex:', questionId);
    console.log('🔍 [Reality.io] Input questionId length:', questionId.length);
    console.log('🔍 [Reality.io] HashZero comparison:', ethers.constants.HashZero);
    console.log('🔍 [Reality.io] HashZero equals check:', questionId === ethers.constants.HashZero);
    
    if (!questionId || questionId === ethers.constants.HashZero) {
      console.log('❌ [Reality.io] QuestionId is null or HashZero, returning null');
      return null;
    }
    
    console.log('🔍 [Reality.io] Creating provider...');
    console.log('🔍 [Reality.io] Creating contract with address:', REALITY_ETH_ADDRESS);
    const realityContract = getRealityContract(provider);
    
    console.log('🔍 [Reality.io] About to call getOpeningTS with questionId:', questionId.toString());
    console.log('🔍 [Reality.io] Exact parameter being sent:', JSON.stringify(questionId));
    console.log('🔍 [Reality.io] Parameter as bytes32:', questionId);
    
    // Get opening timestamp from Reality.io
    const openingTs = await realityContract.getOpeningTS(questionId);
    console.log('🔍 [Reality.io] Raw response from getOpeningTS:', openingTs);
    console.log('🔍 [Reality.io] Response type:', typeof openingTs);
    console.log('🔍 [Reality.io] Response toString:', openingTs.toString());
    
    // Handle the response - it might be a BigNumber or regular number
    let openingTimeNumber;
    if (typeof openingTs === 'object' && openingTs.toNumber) {
      // It's a BigNumber
      openingTimeNumber = openingTs.toNumber();
    } else {
      // It's already a regular number
      openingTimeNumber = Number(openingTs);
    }
    
    console.log('🔍 [Reality.io] Final openingTimeNumber:', openingTimeNumber);
    
    // Check if opening time is set (0 means not set)
    if (openingTimeNumber === 0) {
      console.log('⚠️ [Reality.io] Opening time is 0 - question has no opening time set');
      return null;
    }
    
    const openingTime = new Date(openingTimeNumber * 1000);
    const now = new Date();
    const isOpen = now >= openingTime;
    
    console.log('🔍 [Reality.io] Final openingTime as Date:', openingTime);
    
    return {
      timestamp: openingTimeNumber,
      date: openingTime,
      isOpen,
      timeUntil: isOpen ? 0 : openingTime.getTime() - now.getTime()
    };
    
  } catch (error) {
    console.error('❌ [Reality.io] Error getting opening time:', error);
    console.error('❌ [Reality.io] Error details:', error.message);
    console.error('❌ [Reality.io] Error stack:', error.stack);
    return null; // Don't fail the entire proposal load if opening time fails
  }
}

/**
 * Fetch and display proposal data, return data for pool exploration
 */
async function fetchProposalData(proposalAddress) {
  console.log('\n🔍 Fetching proposal data...\n');
  
  try {
    const provider = getProvider();
    const contract = getProposalContract(proposalAddress, provider);
    
    // Get basic proposal data
    console.log('📋 Reading basic proposal info...');
    const [
      marketName,
      collateralToken1,
      collateralToken2,
      conditionId,
      questionId,
      numOutcomes
    ] = await Promise.all([
      contract.marketName(),
      contract.collateralToken1(),
      contract.collateralToken2(),
      contract.conditionId(),
      contract.questionId(),
      contract.numOutcomes()
    ]);
    
    console.log('🔍 Raw questionId from contract:', questionId);
    console.log('🔍 QuestionId type:', typeof questionId);
    console.log('🔍 QuestionId toString:', questionId.toString());
    
    // Get token metadata
    console.log('🪙 Reading token metadata...');
    const [companyToken, currencyToken] = await Promise.all([
      getTokenMetadata(collateralToken1, provider),
      getTokenMetadata(collateralToken2, provider)
    ]);
    
    // Get wrapped outcomes
    console.log('🎯 Reading wrapped outcomes...');
    const wrappedOutcomes = [];
    for (let i = 0; i < numOutcomes.toNumber(); i++) {
      const outcome = await contract.wrappedOutcome(i);
      wrappedOutcomes.push({
        index: i,
        address: outcome.wrapped1155,
        data: outcome.data
      });
    }
    
    // Get opening time
    console.log('⏰ Reading opening time from Reality.io...');
    const openingTime = await getOpeningTime(questionId, provider);
    
    // Display results
    console.log('\n' + '='.repeat(60));
    console.log('📊 PROPOSAL DATA SUMMARY');
    console.log('='.repeat(60));
    
    console.log(`\n📋 Basic Info:`);
    console.log(`   Market Name: ${marketName}`);
    console.log(`   Proposal Address: ${proposalAddress}`);
    console.log(`   Condition ID: ${conditionId}`);
    console.log(`   Question ID: ${questionId}`);
    console.log(`   Number of Outcomes: ${numOutcomes.toString()}`);
    
    console.log(`\n🪙 Collateral Tokens:`);
    console.log(`   Company Token: ${companyToken.name} (${companyToken.symbol})`);
    console.log(`      Address: ${companyToken.address}`);
    console.log(`      Decimals: ${companyToken.decimals}`);
    console.log(`   Currency Token: ${currencyToken.name} (${currencyToken.symbol})`);
    console.log(`      Address: ${currencyToken.address}`);
    console.log(`      Decimals: ${currencyToken.decimals}`);
    
    console.log(`\n🎯 Wrapped Outcome Tokens:`);
    wrappedOutcomes.forEach((outcome, index) => {
      const tokenType = index < 2 ? 'Company' : 'Currency';
      const position = index % 2 === 0 ? 'YES' : 'NO';
      console.log(`   [${outcome.index}] ${position}_${tokenType}: ${outcome.address}`);
    });
    
    if (openingTime) {
      console.log(`\n⏰ Voting Schedule:`);
      console.log(`   Opening Time: ${openingTime.date.toISOString()}`);
      console.log(`   Local Time: ${openingTime.date.toLocaleString()}`);
      console.log(`   Status: ${openingTime.isOpen ? '🟢 OPEN FOR VOTING' : '🔴 NOT YET OPEN'}`);
      if (!openingTime.isOpen) {
        const days = Math.floor(openingTime.timeUntil / (1000 * 60 * 60 * 24));
        const hours = Math.floor((openingTime.timeUntil % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        console.log(`   Time Until Opening: ${days}d ${hours}h`);
      }
    } else {
      console.log(`\n⏰ Voting Schedule: ❓ Opening time not available`);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Data fetch completed successfully!');
    
    // Return data for pool exploration
    return {
      proposalAddress,
      marketName,
      wrappedOutcomes: wrappedOutcomes,
      tokens: {
        companyToken: collateralToken1,
        currencyToken: collateralToken2
      },
      openingTime,
      conditionId,
      questionId
    };
    
  } catch (error) {
    console.error('\n❌ Error fetching proposal data:');
    console.error(error.message);
    
    if (error.message.includes('INVALID_ARGUMENT')) {
      console.error('\n💡 Tip: Make sure the proposal address is valid and checksummed');
    } else if (error.message.includes('CALL_EXCEPTION')) {
      console.error('\n💡 Tip: The address might not be a valid proposal contract');
    }
    
    return null;
  }
}

/**
 * Prompt user for proposal address
 */
function promptForProposal() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  console.log('🏛️ Futarchy Proposal Data Fetcher (FIXED)');
  console.log('=========================================\n');
  console.log('Enter a proposal address to fetch its data from Gnosis Chain.');
  console.log('Example: 0xDA36a35CA4Fe6214C37a452159C0C9EAd45D5919\n');
  
  rl.question('Proposal Address: ', async (proposalAddress) => {
    if (!proposalAddress.trim()) {
      console.log('❌ Please enter a valid proposal address');
      rl.close();
      return;
    }
    
    // Validate address format
    if (!ethers.utils.isAddress(proposalAddress.trim())) {
      console.log('❌ Invalid Ethereum address format');
      rl.close();
      return;
    }
    
    // Fetch proposal data
    const proposalData = await fetchProposalData(proposalAddress.trim());
    
    if (!proposalData) {
      // Failed to fetch data, ask if they want to try another
      rl.question('\nTry another proposal? (y/n): ', (answer) => {
        if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
          rl.close();
          promptForProposal();
        } else {
          console.log('\n👋 Goodbye!');
          rl.close();
        }
      });
      return;
    }
    
    // Ask if they want to explore pools (only if not hidden)
    if (!HIDE_POOL_DISCOVERY) {
      rl.question('\n🏊 Would you like to explore the Futarchy pools for this proposal? (y/n): ', async (poolAnswer) => {
        if (poolAnswer.toLowerCase() === 'y' || poolAnswer.toLowerCase() === 'yes') {
          try {
            const provider = getProvider();
            await exploreProposalPools(proposalData, provider);
          } catch (error) {
            console.error('\n❌ Error exploring pools:', error.message);
          }
        }
        
        // Ask if they want to fetch another proposal
        rl.question('\nFetch another proposal? (y/n): ', (answer) => {
          if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
            rl.close();
            promptForProposal(); // Recursive call
          } else {
            console.log('\n👋 Goodbye!');
            rl.close();
          }
        });
      });
    } else {
      console.log('\n🏊 Pool discovery is currently disabled (HIDE_POOL_DISCOVERY = true)');
      
      // Ask if they want to fetch another proposal
      rl.question('\nFetch another proposal? (y/n): ', (answer) => {
        if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
          rl.close();
          promptForProposal(); // Recursive call
        } else {
          console.log('\n👋 Goodbye!');
          rl.close();
        }
      });
    }
  });
}

// Main execution
if (require.main === module) {
  promptForProposal();
}

module.exports = {
  fetchProposalData,
  exploreProposalPools,
  getProvider,
  getProposalContract,
  getTokenMetadata,
  getOpeningTime,
  findPoolByPair,
  getPoolData,
  getAlgebraFactory,
  getAlgebraPool
}; 