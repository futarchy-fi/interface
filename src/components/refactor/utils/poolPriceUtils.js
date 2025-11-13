import { readContract } from '@wagmi/core';

const GNOSIS_CHAIN_ID = 100;

// Minimal ABI focusing on essential functions
const POOL_ABI = [
  { "name": "token0", "inputs": [], "outputs": [{ "type": "address" }], "stateMutability": "view", "type": "function" },
  { "name": "token1", "inputs": [], "outputs": [{ "type": "address" }], "stateMutability": "view", "type": "function" }
];

// Try different price function ABIs
const PRICE_FUNCTION_ABIS = [
  // Standard Algebra globalState
  {
    "name": "globalState",
    "outputs": [
      { "type": "uint160", "name": "price" },
      { "type": "int24", "name": "tick" },
      { "type": "uint16", "name": "fee" },
      { "type": "uint8", "name": "timepointIndex" },
      { "type": "uint16", "name": "communityFeeToken0" },
      { "type": "uint16", "name": "communityFeeToken1" },
      { "type": "bool", "name": "unlocked" }
    ],
    "inputs": [],
    "stateMutability": "view",
    "type": "function"
  },
  // Alternative Algebra globalState
  {
    "name": "globalState",
    "outputs": [
      { "type": "uint160", "name": "price" },
      { "type": "int24", "name": "tick" },
      { "type": "uint16", "name": "lastFee" },
      { "type": "uint8", "name": "pluginConfig" },
      { "type": "uint16", "name": "communityFee" },
      { "type": "bool", "name": "unlocked" }
    ],
    "inputs": [],
    "stateMutability": "view",
    "type": "function"
  },
  // Uniswap V3 style slot0
  {
    "name": "slot0",
    "outputs": [
      { "type": "uint160", "name": "sqrtPriceX96" },
      { "type": "int24", "name": "tick" },
      { "type": "uint16", "name": "observationIndex" },
      { "type": "uint16", "name": "observationCardinality" },
      { "type": "uint16", "name": "observationCardinalityNext" },
      { "type": "uint8", "name": "feeProtocol" },
      { "type": "bool", "name": "unlocked" }
    ],
    "inputs": [],
    "stateMutability": "view",
    "type": "function"
  }
];

const ERC20_ABI = [
  { "name": "decimals", "inputs": [], "outputs": [{ "type": "uint8" }], "stateMutability": "view", "type": "function" },
  { "name": "symbol", "inputs": [], "outputs": [{ "type": "string" }], "stateMutability": "view", "type": "function" },
  { "name": "name", "inputs": [], "outputs": [{ "type": "string" }], "stateMutability": "view", "type": "function" }
];

async function tryGetPoolPrice(poolAddress, config) {
  let sqrtPriceX96;
  let method = '';
  
  // Try globalState first
  for (const abi of PRICE_FUNCTION_ABIS) {
    try {
      console.log(`Trying ${abi.name}...`);
      const result = await readContract(config, {
        address: poolAddress,
        abi: [abi],
        functionName: abi.name,
        chainId: GNOSIS_CHAIN_ID,
      });
      
      sqrtPriceX96 = result[0]; // First element is always the price
      method = abi.name;
      console.log(`Success with ${method}:`, result);
      break;
    } catch (error) {
      console.log(`${abi.name} failed:`, error.message);
      continue;
    }
  }
  
  if (!sqrtPriceX96) {
    throw new Error('Unable to fetch price data from any known function. This contract may not be a supported pool type.');
  }
  
  return { sqrtPriceX96, method };
}

export async function fetchPoolPrice(poolAddress, config) {
  try {
    // Get token addresses first - this will also validate it's a pool contract
    const [token0Address, token1Address] = await Promise.all([
      readContract(config, {
        address: poolAddress,
        abi: POOL_ABI,
        functionName: 'token0',
        chainId: GNOSIS_CHAIN_ID,
      }),
      readContract(config, {
        address: poolAddress,
        abi: POOL_ABI,
        functionName: 'token1',
        chainId: GNOSIS_CHAIN_ID,
      })
    ]);

    // Try to get price data using different methods
    const { sqrtPriceX96, method } = await tryGetPoolPrice(poolAddress, config);

    // Get token details
    const [token0Decimals, token1Decimals, token0Symbol, token1Symbol, token0Name, token1Name] = await Promise.all([
      readContract(config, {
        address: token0Address,
        abi: ERC20_ABI,
        functionName: 'decimals',
        chainId: GNOSIS_CHAIN_ID,
      }),
      readContract(config, {
        address: token1Address,
        abi: ERC20_ABI,
        functionName: 'decimals',
        chainId: GNOSIS_CHAIN_ID,
      }),
      readContract(config, {
        address: token0Address,
        abi: ERC20_ABI,
        functionName: 'symbol',
        chainId: GNOSIS_CHAIN_ID,
      }),
      readContract(config, {
        address: token1Address,
        abi: ERC20_ABI,
        functionName: 'symbol',
        chainId: GNOSIS_CHAIN_ID,
      }),
      readContract(config, {
        address: token0Address,
        abi: ERC20_ABI,
        functionName: 'name',
        chainId: GNOSIS_CHAIN_ID,
      }),
      readContract(config, {
        address: token1Address,
        abi: ERC20_ABI,
        functionName: 'name',
        chainId: GNOSIS_CHAIN_ID,
      })
    ]);

    // Calculate prices from sqrtPriceX96
    const sqrtPriceX96Number = Number(sqrtPriceX96);
    
    if (sqrtPriceX96Number === 0) {
      throw new Error('Pool appears to be uninitialized (price is 0)');
    }
    
    // Compute price using the same logic as the original script
    const p = sqrtPriceX96Number / (2 ** 96);
    const priceT1perT0 = p * p;
    const priceT0perT1 = 1 / priceT1perT0;

    // Adjust for decimals
    const decimals0 = Number(token0Decimals);
    const decimals1 = Number(token1Decimals);
    const adjPriceT1perT0 = priceT1perT0 * (10 ** (decimals0 - decimals1));
    const adjPriceT0perT1 = priceT0perT1 * (10 ** (decimals1 - decimals0));

    return {
      token0: {
        address: token0Address,
        decimals: decimals0,
        symbol: token0Symbol,
        name: token0Name,
      },
      token1: {
        address: token1Address,
        decimals: decimals1,
        symbol: token1Symbol,
        name: token1Name,
      },
      prices: {
        token1PerToken0: adjPriceT1perT0,
        token0PerToken1: adjPriceT0perT1,
        sqrtPriceX96: sqrtPriceX96.toString(),
      },
      poolAddress,
      method, // Show which method successfully retrieved the price
    };
  } catch (error) {
    console.error('Error fetching pool price:', error);
    
    // Provide more helpful error messages
    if (error.message.includes('token0')) {
      throw new Error('Invalid pool address: Contract does not appear to be a pool (no token0 function)');
    }
    if (error.message.includes('token1')) {
      throw new Error('Invalid pool address: Contract does not appear to be a pool (no token1 function)');
    }
    
    throw error;
  }
}

export function formatPrice(price, precision = 6) {
  if (price === 0) return '0';
  return Number(price).toPrecision(precision);
}