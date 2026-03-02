/**
 * Price Calculation Test for futarchyJS
 * 
 * This script tests the price calculation functions in futarchyJS.
 * It fetches real-time price data from Gnosis Chain and displays the results.
 * 
 * IMPORTANT: All environment variables must be set in .env file.
 * This test will not run with missing variables.
 */

import { ethers } from 'ethers';
import { environmentConfig, getEnvironmentConfig } from './futarchy.js';

// First validate environment variables
function validateEnvironment() {
  const config = getEnvironmentConfig();
  
  if (!config.environment.isValid) {
    console.error('\n❌ ERROR: Missing required environment variables:');
    config.environment.missingVars.forEach(v => {
      console.error(`   - ${v}`);
    });
    console.error('\nAll variables must be defined in your .env file.');
    console.error('This test will not work without all required variables.');
    console.error('Please copy .env.example to .env and fill in all values.');
    process.exit(1);
  }
  
  console.log('✅ Environment validation successful - all required variables are present');
}

// Run validation immediately
validateEnvironment();

// Get contract addresses from environment
const SDAI_CONTRACT_RATE = environmentConfig.contracts.currencyRateProvider;
const SDAI_RATE_PROVIDER_ABI = [
  "function getRate() external view returns (uint256)",
];
const UNISWAP_V3_POOL_ABI = [
  "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
];
const POOL_CONFIG_YES = {
  address: environmentConfig.pools.yes.address,
  tokenCompanySlot: environmentConfig.pools.yes.tokenCompanySlot,
};
const POOL_CONFIG_NO = {
  address: environmentConfig.pools.no.address,
  tokenCompanySlot: environmentConfig.pools.no.tokenCompanySlot,
};

// SushiSwap V2 constants for currency price calculations
const SUSHISWAP_V2_FACTORY = environmentConfig.dex.sushiswapV2.factory;
const SUSHISWAP_V2_FACTORY_ABI = [
  "function getPair(address tokenA, address tokenB) external view returns (address pair)"
];
const SUSHISWAP_V2_PAIR_ABI = [
  "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
  "function token0() external view returns (address)",
  "function token1() external view returns (address)"
];
const WXDAI_ADDRESS = "0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d";

// Company and currency position token addresses - UPDATED with current values from contracts.js
const CURRENCY_YES_TOKEN = "0x493A0D1c776f8797297Aa8B34594fBd0A7F8968a"; // Was incorrectly using old address
const CURRENCY_NO_TOKEN = "0xE1133Ef862f3441880adADC2096AB67c63f6E102";
const COMPANY_YES_TOKEN = "0x177304d505eCA60E1aE0dAF1bba4A4c4181dB8Ad";
const COMPANY_NO_TOKEN = "0xf1B3E5Ffc0219A4F8C0ac69EC98C97709EdfB6c9";

// Base token addresses
const BASE_CURRENCY_TOKEN = "0xaf204776c7245bF4147c2612BF6e5972Ee483701"; // SDAI
const BASE_COMPANY_TOKEN = "0x9C58BAcC331c9aa871AFD802DB6379a98e80CEdb"; // GNO

// Token ABI for balance checks
const ERC20_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)"
];

/**
 * Implementation of calculatePriceFromSqrtPriceX96 matching futarchy.js
 */
function calculatePriceFromSqrtPriceX96(sqrtPriceX96, tokenSlot) {
  // Convert sqrtPriceX96 to BigNumber if it's not already
  const sqrtPriceX96BN = ethers.BigNumber.isBigNumber(sqrtPriceX96) 
    ? sqrtPriceX96 
    : ethers.BigNumber.from(sqrtPriceX96);
  
  // For simplicity, we'll convert to a decimal string and use JavaScript math
  const sqrtPriceStr = ethers.utils.formatUnits(sqrtPriceX96BN, 0);
  const sqrtPrice = parseFloat(sqrtPriceStr);
  const price = (sqrtPrice * sqrtPrice) / 2**192;
  
  // If tokenSlot is 1, we need to invert the price
  return tokenSlot === 1 ? 1 / price : price;
}

/**
 * Test token balances for a specific wallet address
 * @param {string} walletAddress - Wallet address to check balances for 
 */
async function testBalances(walletAddress) {
  console.log("\n💰 Testing Token Balances for:", walletAddress);
  console.log("=================================================");
  
  try {
    // Connect to Gnosis chain
    const provider = new ethers.providers.JsonRpcProvider("https://rpc.ankr.com/gnosis");
    console.log("✅ Connected to Gnosis Chain");
    
    // Helper function to get token balance and format it
    async function getTokenBalance(tokenAddress, tokenName) {
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
      let symbol;
      try {
        symbol = await tokenContract.symbol();
      } catch (error) {
        symbol = tokenName; // Use provided name if symbol() fails
      }
      
      let decimals;
      try {
        decimals = await tokenContract.decimals();
      } catch (error) {
        console.error(`Error getting decimals for token ${tokenAddress}:`, error);
        throw new Error(`Could not determine decimals for token ${tokenAddress}. Test cannot continue.`);
      }
      
      const balance = await tokenContract.balanceOf(walletAddress);
      const formattedBalance = ethers.utils.formatUnits(balance, decimals);
      
      return {
        symbol,
        balance: formattedBalance,
        raw: balance.toString(),
        tokenAddress
      };
    }
    
    // Create an array of token info we want to check
    const tokens = [
      { address: BASE_CURRENCY_TOKEN, name: 'SDAI (Base Currency)' },
      { address: BASE_COMPANY_TOKEN, name: 'GNO (Base Company)' },
      { address: CURRENCY_YES_TOKEN, name: 'YES_SDAI' },
      { address: CURRENCY_NO_TOKEN, name: 'NO_SDAI' },
      { address: COMPANY_YES_TOKEN, name: 'YES_GNO' },
      { address: COMPANY_NO_TOKEN, name: 'NO_GNO' }
    ];
    
    // Get all token balances in parallel
    const balances = await Promise.all(
      tokens.map(token => getTokenBalance(token.address, token.name))
    );
    
    // Format and display results
    console.log("\n📋 Token Balances:");
    console.log("------------------");
    
    const baseTokens = balances.slice(0, 2);
    const positionTokens = balances.slice(2);
    
    console.log("Base Tokens:");
    baseTokens.forEach(token => {
      console.log(`  ${token.symbol}: ${token.balance}`);
    });
    
    console.log("\nPosition Tokens:");
    positionTokens.forEach(token => {
      console.log(`  ${token.symbol}: ${token.balance}`);
    });
    
    // Calculate net positions
    const yesSDaiBalance = parseFloat(balances[2].balance);
    const noSDaiBalance = parseFloat(balances[3].balance);
    const yesGnoBalance = parseFloat(balances[4].balance);
    const noGnoBalance = parseFloat(balances[5].balance);
    
    console.log("\nNet Positions:");
    
    // Currency position
    const currencyNetPosition = yesSDaiBalance - noSDaiBalance;
    const currencySurplusType = currencyNetPosition > 0 ? 'YES' : 'NO';
    const currencySurplusAmount = Math.abs(currencyNetPosition);
    
    console.log(`  Currency: ${currencyNetPosition > 0 ? '+' : ''}${currencyNetPosition.toFixed(6)} SDAI (${currencySurplusType} surplus: ${currencySurplusAmount.toFixed(6)})`);
    
    // Company position
    const companyNetPosition = yesGnoBalance - noGnoBalance;
    const companySurplusType = companyNetPosition > 0 ? 'YES' : 'NO';
    const companySurplusAmount = Math.abs(companyNetPosition);
    
    console.log(`  Company: ${companyNetPosition > 0 ? '+' : ''}${companyNetPosition.toFixed(6)} GNO (${companySurplusType} surplus: ${companySurplusAmount.toFixed(6)})`);
    
    // Return the balances
    return balances;
    
  } catch (error) {
    console.error("❌ Balance check failed with error:", error);
    return null;
  }
}

/**
 * Main test function
 */
async function testPriceCalculations() {
  console.log("🔍 Starting futarchyJS price calculation test...");
  console.log("=================================================");
  
  try {
    // Connect to Gnosis chain using default RPC
    const provider = new ethers.providers.JsonRpcProvider("https://rpc.ankr.com/gnosis");
    console.log("✅ Connected to Gnosis Chain (default RPC: https://rpc.ankr.com/gnosis)");
    
    console.log("\n📊 Testing SDAI Rate Calculation:");
    console.log("--------------------------------");
    
    // Direct calculation of SDAI rate
    const sdaiRateContract = new ethers.Contract(
      SDAI_CONTRACT_RATE,
      SDAI_RATE_PROVIDER_ABI,
      provider
    );
    const sdaiRate = await sdaiRateContract.getRate();
    console.log("Raw SDAI Rate:", sdaiRate.toString());
    
    const sdaiPriceString = ethers.utils.formatUnits(sdaiRate, 18);
    console.log("SDAI Price (as string):", sdaiPriceString);
    
    const sdaiPriceFloat = parseFloat(sdaiPriceString);
    console.log("SDAI Price (as float):", sdaiPriceFloat);
    
    console.log("\n📊 Testing YES Pool Price Calculation:");
    console.log("-------------------------------------");
    
    // Get YES pool data
    const yesPoolContract = new ethers.Contract(POOL_CONFIG_YES.address, UNISWAP_V3_POOL_ABI, provider);
    const yesSlot0 = await yesPoolContract.slot0();
    const yesSqrtPriceX96 = yesSlot0.sqrtPriceX96;
    console.log("YES Pool sqrtPriceX96:", yesSqrtPriceX96.toString());
    
    // Calculate YES pool price
    const yesPrice = calculatePriceFromSqrtPriceX96(yesSqrtPriceX96, POOL_CONFIG_YES.tokenCompanySlot);
    console.log("YES Pool Price:", yesPrice);
    
    console.log("\n📊 Testing NO Pool Price Calculation:");
    console.log("------------------------------------");
    
    // Get NO pool data
    const noPoolContract = new ethers.Contract(POOL_CONFIG_NO.address, UNISWAP_V3_POOL_ABI, provider);
    const noSlot0 = await noPoolContract.slot0();
    const noSqrtPriceX96 = noSlot0.sqrtPriceX96;
    console.log("NO Pool sqrtPriceX96:", noSqrtPriceX96.toString());
    
    // Calculate NO pool price
    const noPrice = calculatePriceFromSqrtPriceX96(noSqrtPriceX96, POOL_CONFIG_NO.tokenCompanySlot);
    console.log("NO Pool Price:", noPrice);
    
    console.log("\n📊 Testing Currency Prices in XDAI:");
    console.log("----------------------------------");
    
    // Create factory contract instance
    const factory = new ethers.Contract(
      SUSHISWAP_V2_FACTORY,
      SUSHISWAP_V2_FACTORY_ABI,
      provider
    );
    
    // Get YES token price (YES_SDAI to WXDAI)
    const yesPairAddress = await factory.getPair(
      WXDAI_ADDRESS,
      CURRENCY_YES_TOKEN
    );
    console.log("YES Currency Pair Address:", yesPairAddress);
    
    // Get NO token price (NO_SDAI to WXDAI)
    const noPairAddress = await factory.getPair(
      WXDAI_ADDRESS,
      CURRENCY_NO_TOKEN
    );
    console.log("NO Currency Pair Address:", noPairAddress);
    
    let yesCurrencyInXdai = null;
    let noCurrencyInXdai = null;

    // Calculate YES_SDAI price in XDAI if pair exists
    if (yesPairAddress !== "0x0000000000000000000000000000000000000000") {
      const yesPair = new ethers.Contract(yesPairAddress, SUSHISWAP_V2_PAIR_ABI, provider);
      const yesToken0 = await yesPair.token0();
      const [yesReserve0, yesReserve1] = await yesPair.getReserves();
      
      console.log("YES pair token0:", yesToken0);
      console.log("YES pair reserves:", {
        reserve0: yesReserve0.toString(),
        reserve1: yesReserve1.toString()
      });
      
      // Calculate price based on which token is token0
      const yesTokenAddress = CURRENCY_YES_TOKEN;
      
      // The key fix: We should calculate XDAI per YES_SDAI (not YES_SDAI per XDAI)
      // This gives us the correct ratio for event probability calculation
      const xdaiPerYesCurrency = yesTokenAddress.toLowerCase() === yesToken0.toLowerCase()
        ? ethers.utils.formatEther(yesReserve1) / ethers.utils.formatEther(yesReserve0)
        : ethers.utils.formatEther(yesReserve0) / ethers.utils.formatEther(yesReserve1);
          
      // Then take the inverse to get actual yesCurrencyInXdai
      yesCurrencyInXdai = 1 / xdaiPerYesCurrency;
      
      console.log("XDAI per YES_SDAI:", xdaiPerYesCurrency);  
      console.log("YES Currency in XDAI:", yesCurrencyInXdai);
    } else {
      console.log("❌ YES Currency pair not found");
    }

    // Calculate NO_SDAI price in XDAI if pair exists
    if (noPairAddress !== "0x0000000000000000000000000000000000000000") {
      const noPair = new ethers.Contract(noPairAddress, SUSHISWAP_V2_PAIR_ABI, provider);
      const noToken0 = await noPair.token0();
      const [noReserve0, noReserve1] = await noPair.getReserves();
      
      console.log("NO pair token0:", noToken0);
      console.log("NO pair reserves:", {
        reserve0: noReserve0.toString(),
        reserve1: noReserve1.toString()
      });
      
      // Calculate price based on which token is token0
      const noTokenAddress = CURRENCY_NO_TOKEN;
      
      // Same fix for NO currency: Calculate XDAI per NO_SDAI first
      const xdaiPerNoCurrency = noTokenAddress.toLowerCase() === noToken0.toLowerCase()
        ? ethers.utils.formatEther(noReserve1) / ethers.utils.formatEther(noReserve0)
        : ethers.utils.formatEther(noReserve0) / ethers.utils.formatEther(noReserve1);
          
      // Then take the inverse
      noCurrencyInXdai = 1 / xdaiPerNoCurrency;
      
      console.log("XDAI per NO_SDAI:", xdaiPerNoCurrency);
      console.log("NO Currency in XDAI:", noCurrencyInXdai);
    } else {
      console.log("❌ NO Currency pair not found");
    }
    
    console.log("\n📊 Testing Event Probability Calculation:");
    console.log("---------------------------------------");
    
    let eventProbability = null;
    if (yesCurrencyInXdai && sdaiPriceFloat) {
      eventProbability = yesCurrencyInXdai / sdaiPriceFloat;
      eventProbability = Math.max(0, Math.min(1, eventProbability));
      console.log("Raw event probability:", yesCurrencyInXdai / sdaiPriceFloat);
      console.log("Clamped event probability:", eventProbability);
      console.log("Event probability percentage:", (eventProbability * 100).toFixed(2) + "%");
    } else {
      console.log("❌ Cannot calculate event probability - missing required values");
    }
    
    // Create a results object to return
    const results = {
      sdaiPrice: sdaiPriceFloat,
      yesCompanyPrice: yesPrice,
      noCompanyPrice: noPrice,
      yesCurrencyInXdai,
      noCurrencyInXdai,
      eventProbability: eventProbability !== null ? (eventProbability * 100).toFixed(2) + "%" : null
    };
    
    console.log("\n📋 Summary of Results:");
    console.log("---------------------");
    console.log(results);
    
    console.log("\n✅ Test completed successfully!");
    
    return results;
    
  } catch (error) {
    console.error("❌ Test failed with error:", error);
    return null;
  }
}

// Main function: Run all tests
async function runAllTests() {
  // First test price calculations
  await testPriceCalculations();
  
  // Then test balances if a wallet address is provided
  const walletAddress = process.argv[2];
  if (walletAddress) {
    await testBalances(walletAddress);
  } else {
    console.log("\n⚠️ No wallet address provided. To check token balances, run:");
    console.log("   npm test -- 0xYourWalletAddress");
  }
}

// Run all tests
runAllTests(); 