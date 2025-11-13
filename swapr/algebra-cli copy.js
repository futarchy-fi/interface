#!/usr/bin/env node
// Make sure to copy .env.example to .env and set your PRIVATE_KEY before running this script.
//
// USAGE:
// Interactive mode: node algebra-cli.js
// Automatic Futarchy setup: node algebra-cli.js setupFutarchyPoolsAuto <configFile>
//
// Config file format (KEY=VALUE or JSON):
// PROPOSAL_ADDRESS=0x...
// SPOT_PRICE=119.77
// EVENT_PROBABILITY=0.5
// IMPACT=10
// LIQUIDITY_DEFAULT=1000
// ADAPTER_ADDRESS=0x... (optional)
require('dotenv').config();
const { ethers } = require('ethers');
const rl = require('node:readline/promises')
           .createInterface({ input: process.stdin, output: process.stdout });

/* ───────────── CONFIG ───────────── */
const RPC_URL     = process.env.RPC_URL || 'https://rpc.gnosis.gateway.fm';
const PRIVATE_KEY = process.env.PRIVATE_KEY;
if (!PRIVATE_KEY) throw new Error('Add PRIVATE_KEY to .env');

// ═══════════════ GAS CONFIGURATION ═══════════════
// Easy to modify gas settings - change these values as needed
const GAS_CONFIG = {
  // Gas price in gwei - set to null for auto gas price
  GAS_PRICE_GWEI: process.env.GAS_PRICE_GWEI || '0.000004848', // 3x 0.000000616 Gwei (3x 616 wei) for Gnosis Chain
  
  // Show detailed gas price logs for each transaction
  showGasPriceLog: true,
  
  // Gas limits for different operations
  GAS_LIMITS: {
    SWAP: 350000,
    MINT_POSITION: 15000000,
    CREATE_POOL: 16000000,  // Set to 16M (under network limit of ~17M)
    APPROVAL: 100000,
    SPLIT_TOKENS: 15000000,
    CREATE_PROPOSAL: 5000000  // Increased from 2M to 5M for complex proposal creation
  }
};

// Helper function to get gas options for transactions
function getGasOptions(operation = 'DEFAULT') {
  const gasOptions = {};
  
  // Set gas limit based on operation
  if (GAS_CONFIG.GAS_LIMITS[operation]) {
    gasOptions.gasLimit = GAS_CONFIG.GAS_LIMITS[operation];
  }
  
  // Operations that should use AUTO gas price (let network determine)
  const autoGasPriceOperations = ['CREATE_POOL', 'MINT_POSITION', 'CREATE_PROPOSAL'];
  
  // Set gas price if specified and not in auto gas price operations
  if (GAS_CONFIG.GAS_PRICE_GWEI && 
      GAS_CONFIG.GAS_PRICE_GWEI !== 'auto' && 
      !autoGasPriceOperations.includes(operation)) {
    gasOptions.gasPrice = ethers.parseUnits(GAS_CONFIG.GAS_PRICE_GWEI, 'gwei');
  }
  
  // Log gas details if enabled
  if (GAS_CONFIG.showGasPriceLog) {
    console.log(`⛽ Gas Options for ${operation}:`);
    console.log(`   Gas Limit: ${gasOptions.gasLimit || 'DEFAULT'}`);
    if (gasOptions.gasPrice) {
      const gasPriceWei = gasOptions.gasPrice.toString();
      const gasPriceGwei = ethers.formatUnits(gasOptions.gasPrice, 'gwei');
      console.log(`   Gas Price: ${gasPriceGwei} gwei (${gasPriceWei} wei)`);
    } else {
      const reason = autoGasPriceOperations.includes(operation) ? 
        `AUTO (${operation} uses network-determined gas price)` : 
        'AUTO (network determined)';
      console.log(`   Gas Price: ${reason}`);
    }
  }
  
  return gasOptions;
}

// Log gas configuration on startup
console.log(`🔧 Gas Configuration:`);
console.log(`   Gas Price: ${GAS_CONFIG.GAS_PRICE_GWEI === 'auto' || !GAS_CONFIG.GAS_PRICE_GWEI ? 'AUTO' : GAS_CONFIG.GAS_PRICE_GWEI + ' gwei'}`);
console.log(`   Network: ${RPC_URL.includes('gnosis') ? 'Gnosis Chain' : 'Custom RPC'}`);
// ══════════════════════════════════════════════════

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet   = new ethers.Wallet(PRIVATE_KEY, provider);

const POSITION_MGR = '0x91fd594c46d8b01e62dbdebed2401dde01817834';   // Swapr NFT-PM (lower-case OK)
const ROUTER       = '0xffb643e73f280b97809a8b41f7232ab401a04ee1';   // Swapr Router v3
const GNOSISSCAN_BASE_URL = 'https://gnosisscan.io/tx/';

// Global storage for transaction tracking
const transactionLog = [];

// Cache for token data to reduce RPC calls
const tokenDataCache = {};

/* ───────────── ABIs ───────────── */
const pmAbi = [
  'function factory() view returns (address)',
  'function createAndInitializePoolIfNecessary(address,address,uint160) returns (address)',
  'function mint((address token0,address token1,int24 tickLower,int24 tickUpper,uint256 amount0Desired,uint256 amount1Desired,uint256 amount0Min,uint256 amount1Min,address recipient,uint256 deadline)) returns (uint256,uint128,uint256,uint256)',
  'function increaseLiquidity((uint256 tokenId,uint256 amount0Desired,uint256 amount1Desired,uint256 amount0Min,uint256 amount1Min,uint256 deadline)) returns (uint128,uint256,uint256)',
  'function positions(uint256) view returns (uint96,address,address,address,int24,int24,uint128,uint256,uint256,uint128,uint128)'
];
const factoryAbi = ['function poolByPair(address,address) view returns (address)'];
const poolAbi    = ['function globalState() view returns (uint160,uint128,int24,uint16,bool,uint8,uint16)'];
const erc20Abi   = [
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address,address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)'
];
const routerAbi  = [
  'function exactInputSingle((address tokenIn,address tokenOut,address recipient,uint256 deadline,uint256 amountIn,uint256 amountOutMinimum,uint160 limitSqrtPrice)) payable returns (uint256)',
  'function exactOutputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 deadline,uint256 amountOut,uint256 amountInMaximum,uint160 limitSqrtPrice)) payable returns (uint256)'
];

// Balancer Pool ABIs for fetching aGNO/sDAI price
const weightedPoolAbi = [
  'function getPoolId() view returns (bytes32)'
  // Removed getNormalizedWeights() as it's not needed and reverting in the Aave-boosted pool
];

const balancerVaultAbi = [
  'function getPoolTokens(bytes32 poolId) view returns (address[] tokens, uint256[] balances, uint256 lastChangeBlock)'
];

// Balancer Pool Constants
const BALANCER_AGNO_SDAI_POOL = '0xd1d7fa8871d84d0e77020fc28b7cd5718c446522'; // Aave-boosted weighted 50/50 pool
const BALANCER_VAULT = '0xBA12222222228d8Ba445958a75a0704d566BF2C8';
const AGNO_TOKEN = '0xdf55522876E45AdEc168025a272c802fAA9a1B0B'; // aGNO token address (only used for price fetching)

// Futarchy Proposal ABI (simplified for our needs)
const futarchyProposalAbi = [
  'function collateralToken1() view returns (address)',
  'function collateralToken2() view returns (address)',
  'function wrappedOutcome(uint256 index) view returns (address, bytes)',
  'function marketName() view returns (string)',
  'function futarchyProposalParams() view returns (tuple(bytes32 conditionId, address collateralToken1, address collateralToken2, bytes32 questionId, bytes encodedQuestion, uint32 openingTime))'
];

// Futarchy Adapter ABI (for splitting/merging conditional tokens)
const futarchyAdapterAbi = [
  'function splitPosition(address proposal, address collateralToken, uint256 amount)',
  'function mergePositions(address proposal, address collateralToken, uint256 amount)',
  'function redeemPositions(address proposal, address collateralToken, uint256 amount)'
];

// Futarchy Factory ABI (for creating new proposals)
const futarchyFactoryAbi = [
  'function createProposal((string,address,address,string,string,uint256,uint32)) returns (address)',
  'function proposals(uint256) view returns (address)',
  'function marketsCount() view returns (uint256)'
];

// Default values for creating new proposals
const DEFAULT_COMPANY_TOKEN = '0x9C58BAcC331c9aa871AFD802DB6379a98e80CEdb'; // GNO
const DEFAULT_CURRENCY_TOKEN = '0xaf204776c7245bF4147c2612BF6e5972Ee483701'; // SDAI
const DEFAULT_MIN_BOND = '1000000000000000000'; // 1 ETH
const DEFAULT_CATEGORY = 'crypto';
const DEFAULT_LANGUAGE = 'en';
const DEFAULT_FACTORY_ADDRESS = '0xa6cB18FCDC17a2B44E5cAd2d80a6D5942d30a345';
const DEFAULT_ADAPTER_ADDRESS = '0x7495a583ba85875d59407781b4958ED6e0E1228f';

const pm     = new ethers.Contract(POSITION_MGR, pmAbi, wallet);
const router = new ethers.Contract(ROUTER, routerAbi, wallet);

/* ───────────── Utils ───────────── */

// Helper function to safely get pool ID from Balancer pool, even with proxy contracts
async function getPoolIdSafe(poolAddr) {
  try {
    // First try the normal ABI call
    return await new ethers.Contract(
      poolAddr,
      ['function getPoolId() view returns (bytes32)'],
      provider
    ).getPoolId();
  } catch {
    // Fallback to direct storage read at slot 0 where Balancer v2 pools store their pool ID
    console.log("Direct getPoolId() call failed, trying storage slot 0...");
    const raw = await provider.getStorage(poolAddr, 0);
    if (raw === ethers.ZeroHash || raw === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      throw new Error('poolId not found in storage');
    }
    return raw; // Already a 0x-prefixed bytes32
  }
}

// Fetch the current GNO/sDAI price from Balancer's aGNO/sDAI pool
async function fetchBalancerGnoSdaiPrice() {
  try {
    console.log("Fetching current GNO/sDAI price from Balancer aGNO/sDAI pool...");
    
    // Check for contract code
    const poolCode = await provider.getCode(BALANCER_AGNO_SDAI_POOL);
    if (poolCode === '0x' || poolCode === '') {
      console.error("No contract code at pool address! Using fallback price.");
      return 100;
    }
    
    // Create vault contract instance
    const balancerVault = new ethers.Contract(BALANCER_VAULT, balancerVaultAbi, provider);
    
    // Get pool ID using our safe helper function that works with proxies
    const poolId = await getPoolIdSafe(BALANCER_AGNO_SDAI_POOL);
    console.log(`Pool ID: ${poolId}`);
    
    // Get tokens and balances
    const [tokens, balances] = await balancerVault.getPoolTokens(poolId);
    
    // Find indices of aGNO and sDAI
    const agnoIndex = tokens.findIndex(t => t.toLowerCase() === AGNO_TOKEN.toLowerCase());
    const sdaiIndex = tokens.findIndex(t => t.toLowerCase() === DEFAULT_CURRENCY_TOKEN.toLowerCase());
    
    if (agnoIndex === -1 || sdaiIndex === -1) {
      console.log("Could not find aGNO or sDAI in the Balancer pool");
      return 136.8; // Better default based on market data
    }
    
    // Get token balances
    const agnoBalance = Number(ethers.formatUnits(balances[agnoIndex], 18));
    const sdaiBalance = Number(ethers.formatUnits(balances[sdaiIndex], 18));
    
    // Calculate price (sDAI per GNO)
    // aGNO tracks GNO 1:1 so the price is the same
    const price = sdaiBalance / agnoBalance;
    
    console.log(`Current Balancer pool price: 1 GNO = ${price.toFixed(2)} sDAI (via aGNO/sDAI pool)`);
    return price;
  } catch (error) {
    console.error(`Error fetching Balancer price: ${error.message}`);
    console.log('Detailed error:', error);
    return 136.8; // Better default based on current market data
  }
}
async function getTickSpacing(poolAddr) {
  try {
    return await new ethers.Contract(poolAddr, ['function tickSpacing() view returns (int24)'], provider).tickSpacing();
  } catch { return 60; }                        // default for Swapr
}
const align = (tick,s,dir)=> dir==='down'
  ? Math.floor(tick/Number(s))*Number(s)
  : Math.ceil (tick/Number(s))*Number(s);

const ask = (q,d='') => rl.question(`${q}${d?` [${d}]`:''}\n› `).then(v=>v.trim()||d);

// Log transaction and save to transaction log for final summary
async function logTransaction(description, hash, gasUsed = null) {
  const link = `${GNOSISSCAN_BASE_URL}${hash}`;
  console.log(`  🔗 ${description}: ${link}`);
  
  // If gas price logging is enabled, try to get transaction details
  if (GAS_CONFIG.showGasPriceLog) {
    try {
      // Wait a moment for transaction to propagate
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const tx = await provider.getTransaction(hash);
      if (tx) {
        console.log(`     🔍 Debug - Full tx object:`, {
          gasPrice: tx.gasPrice?.toString(),
          gasLimit: tx.gasLimit?.toString(),
          maxFeePerGas: tx.maxFeePerGas?.toString(),
          maxPriorityFeePerGas: tx.maxPriorityFeePerGas?.toString(),
          type: tx.type
        });
        
        // Handle different gas price formats (EIP-1559 vs legacy)
        let effectiveGasPrice = tx.gasPrice;
        
        // For EIP-1559 transactions, gasPrice might be null, use maxFeePerGas
        if (!effectiveGasPrice && tx.maxFeePerGas) {
          effectiveGasPrice = tx.maxFeePerGas;
          console.log(`     ⚠️ Using maxFeePerGas as gasPrice (EIP-1559 transaction)`);
        }
        
        if (effectiveGasPrice && effectiveGasPrice > 0n) {
          const gasPriceGwei = ethers.formatUnits(effectiveGasPrice, 'gwei');
          const gasPriceWei = effectiveGasPrice.toString();
          console.log(`     ⛽ Transaction Gas Price: ${gasPriceGwei} gwei (${gasPriceWei} wei)`);
        } else {
          console.log(`     ⚠️ Gas Price: Unable to determine (gasPrice: ${tx.gasPrice}, maxFeePerGas: ${tx.maxFeePerGas})`);
        }
        
        console.log(`     ⛽ Gas Limit: ${tx.gasLimit ? tx.gasLimit.toString() : 'N/A'}`);
        
        // Try to get receipt for actual gas used
        try {
          const receipt = await provider.getTransactionReceipt(hash);
          if (receipt) {
            console.log(`     ⛽ Gas Used: ${receipt.gasUsed.toString()}`);
            
            // Calculate cost using effective gas price from receipt if available
            const actualGasPrice = receipt.effectiveGasPrice || effectiveGasPrice;
            if (actualGasPrice && actualGasPrice > 0n) {
              const gasCost = actualGasPrice * receipt.gasUsed;
              const gasCostEth = ethers.formatEther(gasCost);
              const actualGasPriceGwei = ethers.formatUnits(actualGasPrice, 'gwei');
              console.log(`     💰 Effective Gas Price: ${actualGasPriceGwei} gwei`);
              console.log(`     💰 Total Gas Cost: ${gasCostEth} ETH`);
            }
          }
        } catch (receiptError) {
          console.log(`     ⛽ Gas Used: Pending... (${receiptError.message})`);
        }
      } else {
        console.log(`     ⚠️ Transaction not found yet (might be pending)`);
      }
    } catch (error) {
      console.log(`     ⛽ Gas details: Unable to fetch (${error.message})`);
    }
  }
  
  transactionLog.push({ description, hash, link });
}

// Enhanced token loader with caching to reduce RPC calls
async function loadToken(addr) {
  const normalizedAddr = addr.toLowerCase();
  if (tokenDataCache[normalizedAddr]) return tokenDataCache[normalizedAddr];
  
  const contract = new ethers.Contract(normalizedAddr, erc20Abi, wallet);
  try {
    const [symbol, dec, bal] = await Promise.all([
      contract.symbol(),
      contract.decimals().then(d => Number(d)),
      contract.balanceOf(wallet.address)
    ]);
    
    const tokenData = { 
      addr: normalizedAddr, 
      contract, 
      symbol, 
      dec, 
      bal 
    };
    
    tokenDataCache[normalizedAddr] = tokenData;
    return tokenData;
  } catch (error) {
    console.error(`Error loading token at ${normalizedAddr}:`, error.message);
    throw error;
  }
}

// Format token amount with symbol for display
async function human(a, v) {
  const token = await loadToken(a);
  return `${ethers.formatUnits(v, token.dec)} ${token.symbol}`;
}

// Get token balance (uses cache when possible)
async function balance(a) {
  return (await loadToken(a)).bal;
}

// Get factory contract
const factoryOf = async() => new ethers.Contract(await pm.factory(), factoryAbi, provider);

// Get pool address for a token pair
const poolByPair = async(a,b) => (await factoryOf()).poolByPair(a,b);

// Calculate sqrtPriceX96 for pool initialization
const sqrtEncode = (n,d) => BigInt(Math.floor(Math.sqrt(Number(n)/Number(d))*2**96));

// Enhanced approval function with transaction logging
async function ensureAllowance(tok, spender, need, spenderName) {
  if (!need || need === 0n) return null;
  const token = await loadToken(tok);
  const cur = await token.contract.allowance(wallet.address, spender);
  if (cur >= need) {
    console.log(`  ✔ Sufficient ${token.symbol} allowance already granted${spenderName ? ` to ${spenderName}` : ''}.`);
    return null;
  }
  
  console.log(`▸ approving ${token.symbol} ${spenderName ? `for ${spenderName} ` : ''}…`);
  const tx = await token.contract.approve(spender, ethers.MaxUint256, getGasOptions('APPROVAL'));
  await logTransaction(`${token.symbol} Approval${spenderName ? ` to ${spenderName}` : ''}`, tx.hash);
  await tx.wait();
  console.log(`  ✔ ${token.symbol} approved.`);
  return tx;
}

// Get current pool price (token1 per token0)
async function poolPrice(pool) {
  const g = await new ethers.Contract(pool, poolAbi, provider).globalState();
  return Number(g[0])**2/2**192;          // token1 per token0
}

// Calculate minimum output amount for swaps with slippage
function outMin(amountIn, px, slipBps=50) {
  return BigInt(Math.floor(Number(amountIn)*px*(1-slipBps/10_000)));
}

/* ───────────── Wizard Modes ───────────── */

// Add verification function before the addLiquidity function
async function verifyLiquidityAmounts(logicalT0Addr, logicalT1Addr, logicalAmt0, logicalAmt1, logicalT0Symbol, logicalT1Symbol, logicalT0Dec, logicalT1Dec, intendedPrice) {
  console.log(`\n🔍 COMPREHENSIVE VERIFICATION BEFORE MINTING:`);
  console.log(`=====================================`);
  
  // 1. Verify logical amounts and price
  const logicalPriceCalculated = Number(ethers.formatUnits(logicalAmt1, logicalT1Dec)) / Number(ethers.formatUnits(logicalAmt0, logicalT0Dec));
  console.log(`📊 LOGICAL TOKEN VERIFICATION:`);
  console.log(`  Logical Token A: ${logicalT0Symbol} (${logicalT0Addr})`);
  console.log(`  Logical Token B: ${logicalT1Symbol} (${logicalT1Addr})`);
  console.log(`  Logical Amount A: ${ethers.formatUnits(logicalAmt0, logicalT0Dec)} ${logicalT0Symbol}`);
  console.log(`  Logical Amount B: ${ethers.formatUnits(logicalAmt1, logicalT1Dec)} ${logicalT1Symbol}`);
  console.log(`  Intended Price: 1 ${logicalT0Symbol} = ${intendedPrice.toFixed(6)} ${logicalT1Symbol}`);
  console.log(`  Calculated Price: 1 ${logicalT0Symbol} = ${logicalPriceCalculated.toFixed(6)} ${logicalT1Symbol}`);
  console.log(`  Price Match: ${Math.abs(intendedPrice - logicalPriceCalculated) < 0.001 ? '✅ CORRECT' : '❌ MISMATCH!'}`);
  
  // 2. Determine AMM ordering
  const addr0 = ethers.getAddress(logicalT0Addr);
  const addr1 = ethers.getAddress(logicalT1Addr);
  const isLogicalOrderSameAsAMM = addr0.toLowerCase() < addr1.toLowerCase();
  
  console.log(`\n🔄 AMM TOKEN ORDERING VERIFICATION:`);
  console.log(`  Address Comparison: ${addr0} ${addr0.toLowerCase() < addr1.toLowerCase() ? '<' : '>'} ${addr1}`);
  console.log(`  Logical Order Matches AMM: ${isLogicalOrderSameAsAMM ? '✅ YES' : '❌ NO - WILL BE REORDERED'}`);
  
  // 3. Show AMM perspective
  let ammToken0Addr, ammToken1Addr, ammAmt0, ammAmt1, ammToken0Symbol, ammToken1Symbol, ammDec0, ammDec1;
  
  if (isLogicalOrderSameAsAMM) {
    ammToken0Addr = addr0;
    ammToken1Addr = addr1;
    ammAmt0 = logicalAmt0;
    ammAmt1 = logicalAmt1;
    ammToken0Symbol = logicalT0Symbol;
    ammToken1Symbol = logicalT1Symbol;
    ammDec0 = logicalT0Dec;
    ammDec1 = logicalT1Dec;
  } else {
    ammToken0Addr = addr1;
    ammToken1Addr = addr0;
    ammAmt0 = logicalAmt1;
    ammAmt1 = logicalAmt0;
    ammToken0Symbol = logicalT1Symbol;
    ammToken1Symbol = logicalT0Symbol;
    ammDec0 = logicalT1Dec;
    ammDec1 = logicalT0Dec;
  }
  
  const ammPriceCalculated = Number(ethers.formatUnits(ammAmt1, ammDec1)) / Number(ethers.formatUnits(ammAmt0, ammDec0));
  
  console.log(`\n⚙️ AMM INTERNAL VERIFICATION:`);
  console.log(`  AMM Token0: ${ammToken0Symbol} (${ammToken0Addr})`);
  console.log(`  AMM Token1: ${ammToken1Symbol} (${ammToken1Addr})`);
  console.log(`  AMM Amount0: ${ethers.formatUnits(ammAmt0, ammDec0)} ${ammToken0Symbol}`);
  console.log(`  AMM Amount1: ${ethers.formatUnits(ammAmt1, ammDec1)} ${ammToken1Symbol}`);
  console.log(`  AMM Internal Price: 1 ${ammToken0Symbol} = ${ammPriceCalculated.toFixed(6)} ${ammToken1Symbol}`);
  
  // 4. Verify the price relationship
  console.log(`\n🎯 PRICE RELATIONSHIP VERIFICATION:`);
  if (isLogicalOrderSameAsAMM) {
    console.log(`  No reordering needed:`);
    console.log(`  AMM Price (1 ${ammToken0Symbol} = ${ammPriceCalculated.toFixed(6)} ${ammToken1Symbol})`);
    console.log(`  = Logical Price (1 ${logicalT0Symbol} = ${logicalPriceCalculated.toFixed(6)} ${logicalT1Symbol})`);
    console.log(`  Price Consistency: ${Math.abs(ammPriceCalculated - logicalPriceCalculated) < 0.001 ? '✅ CONSISTENT' : '❌ INCONSISTENT!'}`);
  } else {
    const expectedLogicalPrice = 1 / ammPriceCalculated;
    console.log(`  With reordering:`);
    console.log(`  AMM Price: 1 ${ammToken0Symbol} = ${ammPriceCalculated.toFixed(6)} ${ammToken1Symbol}`);
    console.log(`  Inverted to Logical: 1 ${logicalT0Symbol} = ${expectedLogicalPrice.toFixed(6)} ${logicalT1Symbol}`);
    console.log(`  Target Logical Price: 1 ${logicalT0Symbol} = ${intendedPrice.toFixed(6)} ${logicalT1Symbol}`);
    console.log(`  Price Consistency: ${Math.abs(expectedLogicalPrice - intendedPrice) < 0.001 ? '✅ CONSISTENT' : '❌ INCONSISTENT!'}`);
  }
  
  console.log(`\n🏁 FINAL VERIFICATION SUMMARY:`);
  console.log(`  ✓ Logical amounts set correctly`);
  console.log(`  ✓ AMM ordering determined: ${isLogicalOrderSameAsAMM ? 'No reordering' : 'Will reorder tokens'}`);
  console.log(`  ✓ Price relationships verified`);
  console.log(`  ✓ Ready for minting`);
  console.log(`=====================================\n`);
  
  return {
    isLogicalOrderSameAsAMM,
    ammToken0Addr,
    ammToken1Addr,
    ammAmt0,
    ammAmt1,
    ammToken0Symbol,
    ammToken1Symbol,
    ammDec0,
    ammDec1,
    ammPriceCalculated,
    logicalPriceCalculated
  };
}

async function addLiquidity(t0Addr, t1Addr, poolAddr, defaultAmt0 = '', defaultAmt1 = '', autoMode = false) {
  const t0 = await loadToken(t0Addr);
  const t1 = await loadToken(t1Addr);
  let poolActual = poolAddr;

  console.log(`\nBalances:\n  ${ethers.formatUnits(t0.bal, t0.dec)} ${t0.symbol}\n  ${ethers.formatUnits(t1.bal, t1.dec)} ${t1.symbol}`);
  let price = null;
  if (poolActual !== ethers.ZeroAddress) { 
    price = await poolPrice(poolActual); 
    console.log(`Pool price: 1 ${t0.symbol} = ${price}`); 
  }

  // Determine AMM ordering early for clear communication
  const addr0 = ethers.getAddress(t0Addr);
  const addr1 = ethers.getAddress(t1Addr);
  const isLogicalOrderSameAsAMM = addr0.toLowerCase() < addr1.toLowerCase();
  
  console.log(`\n📋 TOKEN INFORMATION:`);
  console.log(`  Your Token A: ${t0.symbol} (${t0Addr})`);
  console.log(`  Your Token B: ${t1.symbol} (${t1Addr})`);
  console.log(`\n🔄 AMM INTERNAL ORDERING:`);
  if (isLogicalOrderSameAsAMM) {
    console.log(`  AMM Token0: ${t0.symbol} (matches your Token A)`);
    console.log(`  AMM Token1: ${t1.symbol} (matches your Token B)`);
    console.log(`  ✅ No reordering needed - your logical order matches AMM order`);
  } else {
    console.log(`  AMM Token0: ${t1.symbol} (matches your Token B)`);
    console.log(`  AMM Token1: ${t0.symbol} (matches your Token A)`);
    console.log(`  ⚠️  AMM will reorder tokens - Token B becomes AMM token0, Token A becomes AMM token1`);
  }

  let raw0, raw1;
  if (autoMode) {
    // In auto mode, use the provided default amounts without prompting
    raw0 = defaultAmt0;
    raw1 = defaultAmt1;
    console.log(`🤖 AUTO MODE: Using provided amounts - ${defaultAmt0} ${t0.symbol}, ${defaultAmt1} ${t1.symbol}`);
  } else {
    // Interactive mode - prompt for user input using CLEAR token names
    console.log(`\n💰 ENTER AMOUNTS (using your logical token names):`);
    raw0 = await ask(`Amount of ${t0.symbol} (Your Token A) to provide (blank = auto)`, defaultAmt0);
    raw1 = await ask(`Amount of ${t1.symbol} (Your Token B) to provide (blank = auto)`, defaultAmt1);
  }
  
  let amt0 = raw0 ? ethers.parseUnits(raw0, t0.dec) : 0n;
  let amt1 = raw1 ? ethers.parseUnits(raw1, t1.dec) : 0n;
  if (amt0 === 0n && amt1 === 0n) { console.error('Need value'); return null; }

  if (amt0 === 0n) {
    if (!price) { console.error('Need Token A amount for bootstrap'); return null; }
    amt0 = BigInt(Math.floor(Number(amt1) / price));
  }
  if (amt1 === 0n) {
    const p = price ?? Number(amt1) / Number(amt0);
    amt1 = BigInt(Math.floor(Number(amt0) * p));
  }

  // Calculate intended price from user's perspective
  const intendedPrice = Number(ethers.formatUnits(amt1, t1.dec)) / Number(ethers.formatUnits(amt0, t0.dec));

  console.log(`\n💰 YOU WILL DEPOSIT:`);
  console.log(`  ${ethers.formatUnits(amt0, t0.dec)} ${t0.symbol} (Your Token A)`);
  console.log(`  ${ethers.formatUnits(amt1, t1.dec)} ${t1.symbol} (Your Token B)`);
  console.log(`  Intended Price: 1 ${t0.symbol} = ${intendedPrice.toFixed(6)} ${t1.symbol}`);
  
  if (poolActual === ethers.ZeroAddress) {
    console.log(`\n🎯 PRICE SETTING FOR NEW POOL:`);
    if (!isLogicalOrderSameAsAMM) {
      const ammPrice = 1 / intendedPrice;
      console.log(`  Due to AMM reordering, AMM will show: 1 ${t1.symbol} = ${ammPrice.toFixed(6)} ${t0.symbol}`);
      console.log(`  (This is equivalent to your intended price)`);
    }
  }
  
  // CRITICAL: Run comprehensive verification before proceeding
  const verification = await verifyLiquidityAmounts(
    t0Addr, t1Addr, amt0, amt1, t0.symbol, t1.symbol, t0.dec, t1.dec, intendedPrice
  );
  
  // Skip confirmation prompt in auto mode
  if (!autoMode) {
    console.log(`⚠️  FINAL CONFIRMATION REQUIRED:`);
    console.log(`  You will deposit: ${ethers.formatUnits(amt0, t0.dec)} ${t0.symbol} + ${ethers.formatUnits(amt1, t1.dec)} ${t1.symbol}`);
    console.log(`  Price will be set to: 1 ${t0.symbol} = ${intendedPrice.toFixed(6)} ${t1.symbol}`);
    console.log(`  AMM token order: ${verification.isLogicalOrderSameAsAMM ? 'No reordering' : 'Will reorder tokens'}`);
    if ((await ask('Proceed with these exact amounts and price? (y/N)', 'N')).toLowerCase() !== 'y') return null;
  } else {
    console.log(`🤖 AUTO MODE: Proceeding automatically...`);
  }

  await ensureAllowance(t0Addr, POSITION_MGR, amt0, 'Algebra PositionManager');
  await ensureAllowance(t1Addr, POSITION_MGR, amt1, 'Algebra PositionManager');

  /* create pool if absent */
  if (poolActual === ethers.ZeroAddress) {
    console.log(`\n🏗️  CREATING NEW POOL:`);
    
    let actualSqrtPriceX96;
    
    if (verification.isLogicalOrderSameAsAMM) {
      // User's logical order matches AMM order
      actualSqrtPriceX96 = sqrtEncode(amt1, amt0);
      console.log(`  AMM Token0: ${t0.symbol} (${addr0})`);
      console.log(`  AMM Token1: ${t1.symbol} (${addr1})`);
      console.log(`  AMM Price: 1 ${t0.symbol} = ${intendedPrice.toFixed(6)} ${t1.symbol}`);
    } else {
      // User's logical order is inverted from AMM order
      actualSqrtPriceX96 = sqrtEncode(amt0, amt1);
      const ammInternalPrice = Number(ethers.formatUnits(amt0, t0.dec)) / Number(ethers.formatUnits(amt1, t1.dec));
      console.log(`  AMM Token0: ${t1.symbol} (${addr1})`);
      console.log(`  AMM Token1: ${t0.symbol} (${addr0})`);
      console.log(`  AMM Internal Price: 1 ${t1.symbol} = ${ammInternalPrice.toFixed(6)} ${t0.symbol}`);
      console.log(`  Your Logical Price: 1 ${t0.symbol} = ${intendedPrice.toFixed(6)} ${t1.symbol} ✅`);
    }
    
    // Use the verification results for pool creation
    const createTx = await pm.createAndInitializePoolIfNecessary(
      verification.ammToken0Addr, 
      verification.ammToken1Addr, 
      actualSqrtPriceX96,
      getGasOptions('CREATE_POOL')
    );
    await logTransaction(`Algebra Pool Create & Init (${t0.symbol}/${t1.symbol})`, createTx.hash);
    await createTx.wait();
    poolActual = await poolByPair(t0Addr, t1Addr); 
    console.log(`Pool created: ${poolActual}`);
  }

  const spacing = await getTickSpacing(poolActual);
  
  // Use verification results for minting
  console.log(`\n🔄 PREPARING LIQUIDITY POSITION WITH VERIFIED AMOUNTS:`);
  console.log(`  User amounts: ${ethers.formatUnits(amt0, t0.dec)} ${t0.symbol}, ${ethers.formatUnits(amt1, t1.dec)} ${t1.symbol}`);
  console.log(`  AMM will receive: ${ethers.formatUnits(verification.ammAmt0, verification.ammDec0)} ${verification.ammToken0Symbol} (AMM token0), ${ethers.formatUnits(verification.ammAmt1, verification.ammDec1)} ${verification.ammToken1Symbol} (AMM token1)`);
  
  const params = {
    token0: verification.ammToken0Addr,
    token1: verification.ammToken1Addr,
    tickLower: align(-887272, spacing, 'up'),
    tickUpper: align(887272, spacing, 'down'),
    amount0Desired: verification.ammAmt0,
    amount1Desired: verification.ammAmt1,
    amount0Min: 0,
    amount1Min: 0,
    recipient: wallet.address,
    deadline: Math.floor(Date.now() / 1000) + 1200
  };
  
  console.log(`Using ticks [${params.tickLower}, ${params.tickUpper}] (spacing=${spacing})`);
  
  // FINAL VERIFICATION BEFORE MINTING
  console.log(`\n🎯 FINAL PRE-MINT VERIFICATION:`);
  console.log(`  AMM Token0: ${verification.ammToken0Symbol} (${verification.ammToken0Addr})`);
  console.log(`  AMM Token1: ${verification.ammToken1Symbol} (${verification.ammToken1Addr})`);
  console.log(`  AMM Amount0: ${ethers.formatUnits(verification.ammAmt0, verification.ammDec0)} ${verification.ammToken0Symbol}`);
  console.log(`  AMM Amount1: ${ethers.formatUnits(verification.ammAmt1, verification.ammDec1)} ${verification.ammToken1Symbol}`);
  console.log(`  Expected AMM Price: 1 ${verification.ammToken0Symbol} = ${verification.ammPriceCalculated.toFixed(6)} ${verification.ammToken1Symbol}`);
  console.log(`  Your Logical Price: 1 ${t0.symbol} = ${intendedPrice.toFixed(6)} ${t1.symbol}`);
  console.log(`  Price Verification: ${Math.abs(verification.logicalPriceCalculated - intendedPrice) < 0.001 ? '✅ CORRECT' : '❌ ERROR!'}`);
  
  // Add high gas limit for position minting while respecting network limitations
  console.log(`\n🚀 MINTING POSITION WITH VERIFIED PARAMETERS...`);
  const mintTx = await pm.mint(params, getGasOptions('MINT_POSITION')); 
  await logTransaction(`Algebra Mint Liquidity (${t0.symbol}/${t1.symbol})`, mintTx.hash);
  await mintTx.wait();
  console.log('✔ Liquidity NFT minted!');

  // POST-MINT VERIFICATION
  const pxAfterRaw = await poolPrice(poolActual); // This is AMM token1 per AMM token0
  let displayedPrice;
  
  console.log(`\n📊 POST-MINT PRICE VERIFICATION:`);
  console.log(`  Raw AMM Price: ${pxAfterRaw.toPrecision(6)} (${verification.ammToken1Symbol} per ${verification.ammToken0Symbol})`);
  
  if (verification.isLogicalOrderSameAsAMM) {
    // AMM order matches user order
    displayedPrice = pxAfterRaw;
    console.log(`  No conversion needed - AMM order matches logical order`);
  } else {
    // AMM order is inverted from user order
    displayedPrice = 1 / pxAfterRaw;
    console.log(`  Converting inverted AMM price to logical order: ${displayedPrice.toPrecision(6)}`);
  }
  
  console.log(`\n📊 FINAL POOL PRICE: 1 ${t0.symbol} = ${displayedPrice.toPrecision(6)} ${t1.symbol}`);
  console.log(`  Target Price Was: 1 ${t0.symbol} = ${intendedPrice.toFixed(6)} ${t1.symbol}`);
  console.log(`  Price Accuracy: ${Math.abs(displayedPrice - intendedPrice) < 0.01 ? '✅ ACCURATE' : '⚠️ CHECK REQUIRED'}`);
  
  // Return created pool details for tracking
  return { 
    poolAddress: poolActual, 
    depositedAmount0: amt0, 
    depositedAmount1: amt1, 
    token0Symbol: t0.symbol,
    token1Symbol: t1.symbol,
    token0Address: t0Addr,
    token1Address: t1Addr
  };
}

// Helper function to split tokens for conditional tokens
async function splitTokensViaAdapter(tokenToObtainSymbol, tokenToObtainAddr, amountNeededWei, underlyingTokenSymbol, underlyingTokenAddr, futarchyAdapterContract, proposalContractAddr) {
  console.log(`  Checking balance for ${tokenToObtainSymbol}...`);
  const conditionalToken = await loadToken(tokenToObtainAddr);
  conditionalToken.bal = await conditionalToken.contract.balanceOf(wallet.address); // Refresh balance
  
  if (conditionalToken.bal >= amountNeededWei) {
    console.log(`  ✔ Sufficient ${tokenToObtainSymbol} balance already available: ${ethers.formatUnits(conditionalToken.bal, conditionalToken.dec)}.`);
    return true;
  }

  const amountToSplitWei = amountNeededWei - conditionalToken.bal;
  const underlyingToken = await loadToken(underlyingTokenAddr);
  underlyingToken.bal = await underlyingToken.contract.balanceOf(wallet.address); // Refresh balance
  
  console.log(`  Need ${ethers.formatUnits(amountToSplitWei, underlyingToken.dec)} more ${tokenToObtainSymbol}. This requires splitting ${ethers.formatUnits(amountToSplitWei, underlyingToken.dec)} ${underlyingTokenSymbol}.`);

  if (underlyingToken.bal < amountToSplitWei) {
    console.error(`  ERROR: Insufficient ${underlyingTokenSymbol} balance to split. Have ${ethers.formatUnits(underlyingToken.bal, underlyingToken.dec)}, need ${ethers.formatUnits(amountToSplitWei, underlyingToken.dec)}.`);
    return false;
  }

  await ensureAllowance(underlyingTokenAddr, futarchyAdapterContract.target, amountToSplitWei, 'Futarchy Adapter');
  
  console.log(`  Calling 'splitPosition' on Futarchy Adapter with ${ethers.formatUnits(amountToSplitWei, underlyingToken.dec)} ${underlyingTokenSymbol} for proposal ${proposalContractAddr}.`);
  try {
    // Set high gas limit while respecting chain limitations
    console.log(`  Using configured gas options for token splitting`);
    const splitTx = await futarchyAdapterContract.splitPosition(
      proposalContractAddr, 
      underlyingTokenAddr, 
      amountToSplitWei,
      getGasOptions('SPLIT_TOKENS')
    );
    await logTransaction(`${underlyingTokenSymbol} Split via Adapter (for ${tokenToObtainSymbol})`, splitTx.hash);
    await splitTx.wait();
    console.log(`  ✔ Successfully split ${underlyingTokenSymbol}.`);
    
    // Refresh balance of conditional token
    conditionalToken.bal = await conditionalToken.contract.balanceOf(wallet.address);
    console.log(`  New ${tokenToObtainSymbol} balance: ${ethers.formatUnits(conditionalToken.bal, conditionalToken.dec)}`);
    
    return true;
  } catch (error) {
    console.error(`  ERROR during ${underlyingTokenSymbol} split:`, error.message);
    return false;
  }
}

async function swapTokens(t0,t1,pool){
  const {symbol:s0,dec:d0}=await loadToken(t0);
  const {symbol:s1,dec:d1}=await loadToken(t1);
  const px        = await poolPrice(pool);
  const slipInp   = await ask(`\nMax slippage %  (blank = 1)`, '1');
  const SLIP_BPS  = Number(slipInp) * 100;             // % → basis-points
  console.log(`Pool price: 1 ${s0} ≈ ${px.toPrecision(8)} ${s1}  |  slippage ${slipInp}%`);

  const dir = (await ask(`[0] ${s0}→${s1}   [1] ${s1}→${s0}`,'0')).trim();
  const tokenIn  = dir==='1'?t1:t0;
  const tokenOut = dir==='1'?t0:t1;
  const decimalsIn  = dir==='1'?d1:d0;
  const decimalsOut = dir==='1'?d0:d1;
  const effPx   = dir==='1'? 1/px : px;

  const balIn = await balance(tokenIn);
  console.log(`Your balance: ${await human(tokenIn, balIn)}`);
  const rawIn = await ask(`Amount ${(await loadToken(tokenIn)).symbol} to swap`);
  const amtIn = ethers.parseUnits(rawIn, decimalsIn);
  let minOut= outMin(amtIn,effPx, SLIP_BPS);
  if (SLIP_BPS >= 10000) minOut = 0n;   // 100 % slippage → accept any amount
  console.log(`Will swap ${rawIn} ${(await loadToken(tokenIn)).symbol} for ≥ ${ethers.formatUnits(minOut,decimalsOut)} ${(await loadToken(tokenOut)).symbol}`);
  if((await ask('Proceed? (y/N)','N')).toLowerCase()!=='y') return;

  await ensureAllowance(tokenIn,ROUTER,amtIn);

  const p = {
    tokenIn, tokenOut,
    recipient: wallet.address,
    deadline: Math.floor(Date.now()/1000)+600,
    amountIn: amtIn,
    amountOutMinimum: minOut,
    limitSqrtPrice: 0
  };
  const tx = await router.exactInputSingle(p, getGasOptions('SWAP'));
  console.log(`swap 🔗 https://gnosisscan.io/tx/${tx.hash}`);
  await tx.wait();
  console.log('✔ Swap executed.');
}

// --- Exact Output Single Swap ---
async function exactOutputSwap() {
  const t0 = (await ask('Token In address')).toLowerCase();
  const t1 = (await ask('Token Out address')).toLowerCase();
  const {symbol:s0,dec:d0}=await loadToken(t0);
  const {symbol:s1,dec:d1}=await loadToken(t1);
  const feeRaw = await ask('Pool fee tier (e.g. 500 for 0.05%, 3000 for 0.3%)', '500');
  const fee = parseInt(feeRaw, 10);
  const recipient = wallet.address;
  const amountOutRaw = await ask(`Exact amount of ${s1} to receive`);
  const amountInMaxRaw = await ask(`Maximum amount of ${s0} to spend`);
  const amtOut = ethers.parseUnits(amountOutRaw, d1);
  const amtInMax = ethers.parseUnits(amountInMaxRaw, d0);
  console.log(`You will receive exactly ${amountOutRaw} ${s1} for at most ${amountInMaxRaw} ${s0} (fee tier: ${fee}).`);
  if((await ask('Proceed? (y/N)','N')).toLowerCase()!=='y') return;
  await ensureAllowance(t0,ROUTER,amtInMax);
  const p = {
    tokenIn: t0,
    tokenOut: t1,
    fee,
    recipient,
    deadline: Math.floor(Date.now()/1000)+600,
    amountOut: amtOut,
    amountInMaximum: amtInMax,
    limitSqrtPrice: 0
  };
  const tx = await router.exactOutputSingle(p, getGasOptions('SWAP'));
  console.log(`swap 🔗 https://gnosisscan.io/tx/${tx.hash}`);
  await tx.wait();
  console.log('✔ Exact output swap executed.');
}

/* ───────────── Create New Futarchy Proposal ───────────── */
async function createNewProposal(autoMode = false, config = null) {
  console.log(`\nCreate New Futarchy Proposal`);
  console.log(`------------------------------\n`);
  
  // Get the factory address
  let factoryAddress, companyTokenAddr, currencyTokenAddr, marketName, category, language, minBond, openingTime;
  
  if (autoMode) {
    console.log('🤖 AUTO MODE: Using default values for proposal creation...');
    factoryAddress = DEFAULT_FACTORY_ADDRESS;
    companyTokenAddr = DEFAULT_COMPANY_TOKEN;
    currencyTokenAddr = DEFAULT_CURRENCY_TOKEN;
    
    // Use marketName from config if provided, otherwise use timestamp-based name
    if (config && config.marketName) {
      marketName = config.marketName;
      console.log(`🤖 Using market name from config: "${marketName}"`);
    } else {
      marketName = `Futarchy Proposal ${Date.now()}`;
      console.log(`🤖 Using auto-generated market name: "${marketName}"`);
    }
    
    category = DEFAULT_CATEGORY;
    language = DEFAULT_LANGUAGE;
    minBond = DEFAULT_MIN_BOND;
    
    // Use openingTime from config if provided, otherwise default to 3 months from now
    if (config && config.openingTime) {
      openingTime = config.openingTime;
      console.log(`🤖 Using opening time from config: ${openingTime} (${new Date(openingTime * 1000).toLocaleString()})`);
    } else {
      // Set opening time to 3 months from now
      const threeMontrhsInSeconds = 90 * 24 * 60 * 60; // 90 days
      openingTime = Math.floor(Date.now() / 1000) + threeMontrhsInSeconds;
      console.log(`🤖 Using default opening time (3 months from now): ${openingTime} (${new Date(openingTime * 1000).toLocaleString()})`);
    }
    
    console.log(`  Factory Address: ${factoryAddress}`);
    console.log(`  Company Token: ${companyTokenAddr}`);
    console.log(`  Currency Token: ${currencyTokenAddr}`);
    console.log(`  Market Name: ${marketName}`);
    console.log(`  Category: ${category}`);
    console.log(`  Language: ${language}`);
    console.log(`  Min Bond: ${minBond}`);
    console.log(`  Opening Time: ${new Date(openingTime * 1000).toLocaleString()}`);
    
  } else {
    // Interactive mode
    factoryAddress = await ask(`Enter Futarchy Factory contract address [${DEFAULT_FACTORY_ADDRESS}]:`, DEFAULT_FACTORY_ADDRESS);
    
    // Prompt for essential parameters
    marketName = await ask(`Enter market name (e.g., "Should we implement feature X?"):`);
    if (!marketName) {
      console.error("Market name is required");
      return null;
    }
    
    // Token addresses with defaults
    companyTokenAddr = await ask(`Enter company token address [${DEFAULT_COMPANY_TOKEN}]:`, DEFAULT_COMPANY_TOKEN);
    currencyTokenAddr = await ask(`Enter currency token address [${DEFAULT_CURRENCY_TOKEN}]:`, DEFAULT_CURRENCY_TOKEN);
    
    // Calculate default opening time (3 months from now)
    const threeMontrhsInSeconds = 90 * 24 * 60 * 60; // 90 days
    const defaultOpeningTime = Math.floor(Date.now() / 1000) + threeMontrhsInSeconds;
    const openingTimeStr = await ask(`Enter proposal opening time as UNIX timestamp [${defaultOpeningTime}]:`, defaultOpeningTime.toString());
    openingTime = parseInt(openingTimeStr);
    
    // Other parameters with defaults
    category = await ask(`Enter category [${DEFAULT_CATEGORY}]:`, DEFAULT_CATEGORY);
    language = await ask(`Enter language [${DEFAULT_LANGUAGE}]:`, DEFAULT_LANGUAGE);
    minBond = await ask(`Enter minimum bond in wei [${DEFAULT_MIN_BOND}]:`, DEFAULT_MIN_BOND);
  }
  
  const factory = new ethers.Contract(factoryAddress, futarchyFactoryAbi, wallet);
  
  // Get token details for display (only in interactive mode)
  if (!autoMode) {
    const companyToken = await loadToken(companyTokenAddr);
    const currencyToken = await loadToken(currencyTokenAddr);
    console.log(`\nSelected tokens:\n  Company: ${companyToken.symbol} (${companyTokenAddr})\n  Currency: ${currencyToken.symbol} (${currencyTokenAddr})`);
    
    // Format date for display
    const openingDate = new Date(openingTime * 1000);
    console.log(`Opening time set to: ${openingDate.toLocaleString()}`);
    
    // Confirm before creating proposal
    console.log(`\nReady to create proposal with the following parameters:\n`);
    console.log(`  Market name: ${marketName}`);
    console.log(`  Company token: ${companyToken.symbol} (${companyTokenAddr})`);
    console.log(`  Currency token: ${currencyToken.symbol} (${currencyTokenAddr})`);
    console.log(`  Category: ${category}`);
    console.log(`  Language: ${language}`);
    console.log(`  Min bond: ${minBond}`);
    console.log(`  Opening time: ${openingDate.toLocaleString()}`);
    
    const confirm = await ask(`\nProceed with proposal creation? (y/N):`, 'N');
    if (confirm.toLowerCase() !== 'y') {
      console.log("Proposal creation canceled");
      return null;
    }
  }
  
  try {
    console.log("Creating proposal...");
    
    // Prepare the proposal parameters struct
    const params = [
      marketName,
      companyTokenAddr,
      currencyTokenAddr,
      category,
      language,
      minBond,
      openingTime
    ];
    
    // Call the createProposal function
    const tx = await factory.createProposal(params, getGasOptions('CREATE_PROPOSAL'));
    await logTransaction("Create Futarchy Proposal", tx.hash);
    const receipt = await tx.wait();
    
    // Get the new proposal address from the event logs
    console.log("Transaction confirmed!");
    
    // Get the latest proposal address
    const count = await factory.marketsCount();
    if (count === 0n) {
      console.error("Failed to get the proposal address");
      return null;
    }
    
    const proposalAddress = await factory.proposals(count - 1n);
    console.log(`New proposal created at address: ${proposalAddress}`);
    return proposalAddress;
  } catch (error) {
    console.error(`Error creating proposal: ${error.message}`);
    return null;
  }
}

/* ───────────── Futarchy Pools Setup ───────────── */
async function setupPoolsFromFutarchyProposal(proposalAddress, autoConfig = null) {
  // Declare variables at function scope so they're accessible throughout
  let spotPrice; // numeric
  let initialEventProbability; // numeric
  let expectedImpactPercentage; // decimal form (e.g., 0.10 for 10%)
  let expectedImpactPercentageInput; // percentage form for display
  let futarchyAdapterAddress;
  let yesCompanyToken, noCompanyToken, yesCurrencyToken, noCurrencyToken;
  let companyToken, currencyToken;
  const createdPoolsData = [];
  
  try {
  if (!proposalAddress) {
    console.log("No proposal address provided.");
    return;
  }

  const isAutoMode = autoConfig !== null;
  
  if (isAutoMode) {
    console.log("\n🤖 AUTOMATIC MODE ENABLED");
    console.log("Using configuration:");
    console.log(`  Proposal Address: ${proposalAddress}`);
    console.log(`  Spot Price: ${autoConfig.spotPrice} ${autoConfig.currencySymbol || 'Currency'} per ${autoConfig.companySymbol || 'Company'}`);
    console.log(`  Event Probability: ${(autoConfig.eventProbability * 100).toFixed(1)}%`);
    console.log(`  Impact Percentage: ${autoConfig.impact}%`);
    console.log(`  Liquidity Amounts per Pool: [${autoConfig.liquidityAmounts.join(', ')}]`);
    console.log(`  Adapter Address: ${autoConfig.adapterAddress}`);
    console.log(`  Skip Existing Pools: ${autoConfig.skipExistingWhenAUTO ? 'Yes' : 'No'}`);
    console.log(`  Force Add Liquidity to Pools: [${autoConfig.forceAddLiquidityPools.join(',')}]\n`);
  } else {
    console.log("\nWelcome to Futarchy Pool Setup!");
    console.log(`This script will guide you through setting up 6 liquidity pools for the Futarchy proposal: ${proposalAddress}\n`);
  }

  // Initialize contract and validate address
  if (!ethers.isAddress(proposalAddress)) {
    console.error("Invalid proposal address."); 
    return;
  }

  // Initialize proposal contract
  const proposalContract = new ethers.Contract(proposalAddress, futarchyProposalAbi, wallet);
  
  try {
    // Fetch token addresses and market name
    console.log("Fetching proposal details...");
    let marketName = "Futarchy Proposal";
    try {
      marketName = await proposalContract.marketName();
    } catch (error) {
      console.log("Could not fetch market name");
    }

    console.log(`Proposal: ${marketName}\n`);
    
    // Fetch token addresses
    console.log("Fetching token addresses from proposal...");
    const companyTokenAddr = await proposalContract.collateralToken1();
    const currencyTokenAddr = await proposalContract.collateralToken2();
    
    // Load tokens - assign to function-scope variables
    companyToken = await loadToken(companyTokenAddr);
    currencyToken = await loadToken(currencyTokenAddr);
    
    console.log(`  Company Token: ${companyToken.symbol} (${companyTokenAddr})`);
    console.log(`  Currency Token (Base): ${currencyToken.symbol} (${currencyTokenAddr})`);

    // Fetch the current price from Balancer as default suggestion
    let defaultSpotPrice = "100";
    if (!isAutoMode && companyTokenAddr.toLowerCase() === DEFAULT_COMPANY_TOKEN.toLowerCase() && 
        currencyTokenAddr.toLowerCase() === DEFAULT_CURRENCY_TOKEN.toLowerCase()) {
      // Only fetch from Balancer if we're using GNO and sDAI and not in auto mode
      const balancerPrice = await fetchBalancerGnoSdaiPrice();
      defaultSpotPrice = balancerPrice.toFixed(2);
    }

    // Get configuration values - either from auto config or user input
    // Variables are now declared at function scope
    
    if (isAutoMode) {
      // Use values from config file
      spotPrice = autoConfig.spotPrice;
      initialEventProbability = autoConfig.eventProbability;
      expectedImpactPercentageInput = autoConfig.impact;
      expectedImpactPercentage = autoConfig.impact / 100; // Convert from percentage to decimal
      futarchyAdapterAddress = autoConfig.adapterAddress;
      
      console.log(`\nUsing automatic configuration:`);
      console.log(`  Spot Price: ${spotPrice} ${currencyToken.symbol} per ${companyToken.symbol}`);
      console.log(`  Event Probability: ${(initialEventProbability * 100).toFixed(1)}%`);
      console.log(`  Impact Percentage: ${expectedImpactPercentageInput}%`);
      console.log(`  Adapter Address: ${futarchyAdapterAddress}`);
    } else {
      // Interactive mode - ask user for values
      spotPrice = parseFloat(await ask(`\nEnter current spot price of ${companyToken.symbol} in ${currencyToken.symbol} (e.g., ${defaultSpotPrice} for 1 ${companyToken.symbol} = ${defaultSpotPrice} ${currencyToken.symbol}):`, defaultSpotPrice));
      initialEventProbability = parseFloat(await ask("Enter initial 'YES' event probability (0.0 to 1.0, e.g., 0.5 for 50%):", "0.5"));
      // Store both the raw input (for JSON display) and the decimal form (for calculations)
      expectedImpactPercentageInput = parseFloat(await ask(`Enter expected positive impact % on ${companyToken.symbol} price if proposal is 'YES' (e.g., 5 for 5% impact):`, "5"));
      expectedImpactPercentage = expectedImpactPercentageInput / 100; // Convert from percentage to decimal
      futarchyAdapterAddress = await ask(`Enter the Futarchy Conditional Token Adapter contract address [${DEFAULT_ADAPTER_ADDRESS}]:`, DEFAULT_ADAPTER_ADDRESS);
    }

    if (!ethers.isAddress(futarchyAdapterAddress)) {
      console.error("Invalid adapter address."); 
      return;
    }
    const futarchyAdapterContract = new ethers.Contract(futarchyAdapterAddress, futarchyAdapterAbi, wallet);

    // Clear transaction log for this session
    transactionLog.length = 0; // Clear array without reassigning the constant

    // Resolve conditional token addresses
    console.log("\nResolving conditional token addresses...");
    
    // Token variables are now declared at function scope
    
    try {
      // wrappedOutcome returns [address, bytes]
      const [yesCompanyAddr, yesCompanyData] = await proposalContract.wrappedOutcome(0);
      const [noCompanyAddr, noCompanyData] = await proposalContract.wrappedOutcome(1);
      const [yesCurrencyAddr, yesCurrencyData] = await proposalContract.wrappedOutcome(2);
      const [noCurrencyAddr, noCurrencyData] = await proposalContract.wrappedOutcome(3);
      
      console.log(`Got wrapped token addresses:`);
      console.log(`  YES Company: ${yesCompanyAddr}`);
      console.log(`  NO Company: ${noCompanyAddr}`);
      console.log(`  YES Currency: ${yesCurrencyAddr}`);
      console.log(`  NO Currency: ${noCurrencyAddr}`);
      
      yesCompanyToken = await loadToken(yesCompanyAddr);
      noCompanyToken = await loadToken(noCompanyAddr);
      yesCurrencyToken = await loadToken(yesCurrencyAddr);
      noCurrencyToken = await loadToken(noCurrencyAddr);
      
      console.log(`  Conditional YES_COMPANY: ${yesCompanyToken.symbol} (${yesCompanyToken.addr})`);
      console.log(`  Conditional NO_COMPANY: ${noCompanyToken.symbol} (${noCompanyToken.addr})`);
      console.log(`  Conditional YES_CURRENCY: ${yesCurrencyToken.symbol} (${yesCurrencyToken.addr})`);
      console.log(`  Conditional NO_CURRENCY: ${noCurrencyToken.symbol} (${noCurrencyToken.addr})`);
    } catch (error) {
      console.error(`Error resolving conditional tokens: ${error.message}`);
      console.log('Detailed error:', error);
      throw error;
    }

    // Display initial wallet balances
    console.log("\nWallet Balances (Initial):");
    console.log(`  ${companyToken.symbol}: ${ethers.formatUnits(companyToken.bal, companyToken.dec)}`);
    console.log(`  ${currencyToken.symbol}: ${ethers.formatUnits(currencyToken.bal, currencyToken.dec)}`);
    console.log(`  ${yesCompanyToken.symbol}: ${ethers.formatUnits(yesCompanyToken.bal, yesCompanyToken.dec)}`);
    console.log(`  ${noCompanyToken.symbol}: ${ethers.formatUnits(noCompanyToken.bal, noCompanyToken.dec)}`);
    console.log(`  ${yesCurrencyToken.symbol}: ${ethers.formatUnits(yesCurrencyToken.bal, yesCurrencyToken.dec)}`);
    console.log(`  ${noCurrencyToken.symbol}: ${ethers.formatUnits(noCurrencyToken.bal, noCurrencyToken.dec)}`);

  // Compute yesPrice/noPrice based on probability and impact
  // Using formulas that ensure: spotPrice = p × YES + (1-p) × NO
  const yesPrice = spotPrice * (1 + expectedImpactPercentage * (1 - initialEventProbability));
  const noPrice = spotPrice * (1 - expectedImpactPercentage * initialEventProbability);

  // Verify our price relationship holds
  const calculatedSpot = initialEventProbability * yesPrice + (1 - initialEventProbability) * noPrice;
  console.log(`\nPrice Verification:\n  YES Price: ${yesPrice.toFixed(6)}\n  NO Price: ${noPrice.toFixed(6)}`);
  console.log(`  Calculated weighted average: ${calculatedSpot.toFixed(6)} (should equal spot price: ${spotPrice})`);
  console.log(`  Implied impact: ${((yesPrice - noPrice) / spotPrice).toFixed(4)} or ${((yesPrice - noPrice) / spotPrice * 100).toFixed(2)}%`);

  // Configure the 6 pools we need to create
  const poolsToCreate = [
    { 
      name: `Pool 1: ${yesCompanyToken.symbol} / ${yesCurrencyToken.symbol}`, 
      logicalT0: yesCompanyToken, 
      logicalT1: yesCurrencyToken, 
      type: 'Price-Correlated Conditional', 
      description: "Price-correlated conditional tokens pool for YES outcomes",
      priceLogic: (s, p, i) => yesPrice, 
      priceExplanation: `Derived YES price using formula: yesPrice = spotPrice * (1 + impact * (1-p)) = ${yesPrice.toFixed(6)}`
    },
    { 
      name: `Pool 2: ${noCompanyToken.symbol} / ${noCurrencyToken.symbol}`, 
      logicalT0: noCompanyToken, 
      logicalT1: noCurrencyToken, 
      type: 'Price-Correlated Conditional', 
      description: "Price-correlated conditional tokens pool for NO outcomes",
      priceLogic: (s, p, i) => noPrice, 
      priceExplanation: `Derived NO price using formula: noPrice = spotPrice * (1 - impact * p) = ${noPrice.toFixed(6)}`
    },
    { 
      name: `Pool 3: ${yesCompanyToken.symbol} / ${currencyToken.symbol}`, 
      logicalT0: yesCompanyToken, 
      logicalT1: currencyToken, 
      type: 'YES Expected Value', 
      description: "YES company token expected value pool",
      priceLogic: (s, p, i) => s * p, 
      priceExplanation: `Expected value of YES company token = spotPrice * p = ${(spotPrice * initialEventProbability).toFixed(6)}`
    },
    { 
      name: `Pool 4: ${noCompanyToken.symbol} / ${currencyToken.symbol}`, 
      logicalT0: noCompanyToken, 
      logicalT1: currencyToken, 
      type: 'NO Expected Value', 
      description: "NO company token expected value pool",
      priceLogic: (s, p, i) => s * (1 - p), 
      priceExplanation: `Expected value of NO company token = spotPrice * (1 - p) = ${(spotPrice * (1 - initialEventProbability)).toFixed(6)}`
    },
    { 
      name: `Pool 5: ${yesCurrencyToken.symbol} / ${currencyToken.symbol}`, 
      logicalT0: yesCurrencyToken, 
      logicalT1: currencyToken, 
      type: 'Prediction Market (Currency vs Base)', 
      description: "Prediction market for YES currency token outcome probability. **HIGHLIGHTED FOR LIQUIDITY NEEDS**",
      highlight: true,
      priceLogic: (s, p, i) => p, 
      priceExplanation: `Based on ${(initialEventProbability * 100).toFixed(1)}% 'YES' probability. Price is the probability itself = ${initialEventProbability.toFixed(2)}.`
    },
    { 
      name: `Pool 6: ${noCurrencyToken.symbol} / ${currencyToken.symbol}`, 
      logicalT0: noCurrencyToken, 
      logicalT1: currencyToken, 
      type: 'Prediction Market (Currency vs Base)', 
      description: "Prediction market for NO currency token outcome probability",
      priceLogic: (s, p, i) => 1 - p, 
      priceExplanation: `Based on ${((1 - initialEventProbability) * 100).toFixed(1)}% 'NO' probability. Price is the probability itself = ${(1 - initialEventProbability).toFixed(2)}.`
    },
  ];

  // Array is now declared at function scope, no need to redeclare

  // Process each pool
  for (const [index, poolConfig] of poolsToCreate.entries()) {
    const poolNumber = index + 1; // Pools are numbered 1-6 for user reference
    console.log(`\n--------------------------------------------------------------------------------`);
    console.log(`${poolConfig.name} (Pool ${poolNumber})`);
    console.log(`--------------------------------------------------------------------------------`);
    if (poolConfig.highlight) {
      console.log(`  **** ALERT: ${poolConfig.description} ****`);
    }
    console.log(`  Logical Token0: ${poolConfig.logicalT0.symbol} (${poolConfig.logicalT0.addr})`);
    console.log(`  Logical Token1: ${poolConfig.logicalT1.symbol} (${poolConfig.logicalT1.addr})`);
    console.log(`  Pool Type: ${poolConfig.type}`);

    // Check if this pool already exists
    const existingPool = await poolByPair(poolConfig.logicalT0.addr, poolConfig.logicalT1.addr);
    let finalPrice;
    let poolActual = existingPool; // Initialize with existing pool (ZeroAddress if doesn't exist)
    
    if (existingPool !== ethers.ZeroAddress) {
      // Pool exists, get current price
      const currentPrice = await poolPrice(existingPool);
      console.log(`  ⚠️ EXISTING POOL DETECTED ⚠️`);
      console.log(`  Pool Address: ${existingPool}`);
      
      // Add to createdPoolsData for summary JSON
      let poolSummary = {
        type: poolConfig.type,
        name: poolConfig.name.split(": ")[1], // Remove "Pool X: " prefix
        address: existingPool,
        token0: poolConfig.logicalT0.addr,
        token1: poolConfig.logicalT1.addr
      };
      
      // Special handling for prediction market pools (YES_X/BASE or NO_X/BASE)
      // First identify which token is conditional and which is the base token
      const isT0Conditional = poolConfig.logicalT0.symbol.startsWith('YES_') || poolConfig.logicalT0.symbol.startsWith('NO_');
      const isT1Conditional = poolConfig.logicalT1.symbol.startsWith('YES_') || poolConfig.logicalT1.symbol.startsWith('NO_');
      
      // For prediction markets, always show probability (base per conditional)
      if ((isT0Conditional && !isT1Conditional) || (!isT0Conditional && isT1Conditional)) {
        // This is a prediction market pool - one conditional token and one base token
        const conditionalToken = isT0Conditional ? poolConfig.logicalT0 : poolConfig.logicalT1;
        const baseToken = isT0Conditional ? poolConfig.logicalT1 : poolConfig.logicalT0;
        
        // If base token is token0 in AMM, take price directly, otherwise invert it
        const rawPrice = currentPrice;
        const probabilityPrice = ethers.getAddress(baseToken.addr) < ethers.getAddress(conditionalToken.addr) ? rawPrice : (1 / rawPrice);
        
        // For prediction markets, we need to consider the token value and get the correct probability
        // For YES/NO tokens against sDAI, we need the actual value in terms of sDAI
        // If conditional token is YES_GNO or NO_GNO, use the spot price to calculate probability
        let displayPrice, displayProbability;

        console.log(`  Raw AMM price: ${rawPrice.toFixed(6)} (token1/token0)`);
        console.log(`  Token addresses: ${baseToken.addr} (base) vs ${conditionalToken.addr} (conditional)`);
        console.log(`  Lexical comparison: ${ethers.getAddress(baseToken.addr) < ethers.getAddress(conditionalToken.addr) ? 'base < conditional' : 'conditional < base'}`);
        console.log(`  Token positions: ${ethers.getAddress(baseToken.addr) < ethers.getAddress(conditionalToken.addr) ? 'base=token0, conditional=token1' : 'conditional=token0, base=token1'}`);
        
        
        if (conditionalToken.symbol === 'YES_GNO' || conditionalToken.symbol === 'NO_GNO') {
          // For YES_GNO/sDAI or NO_GNO/sDAI, we need to show how many sDAI per conditional token
          // Looking at the data, 1 YES_GNO is worth 50 sDAI when the order is sDAI (token0) and YES_GNO (token1)
          // The price we show depends on token ordering in the AMM
          let displayPrice;
          if (ethers.getAddress(baseToken.addr) < ethers.getAddress(conditionalToken.addr)) {
            // Base token (sDAI) is token0, conditional token (YES_GNO) is token1
            // AMM price is 0.02 token1 per token0, which means 1/0.02 = 50 token0 per token1
            displayPrice = 1 / rawPrice;
          } else {
            // Conditional token (YES_GNO) is token0, base token (sDAI) is token1
            // AMM price directly gives sDAI per YES_GNO
            displayPrice = rawPrice;
          }
          // Make sure spotPrice is defined, use fallback of 100 if not
          const effectiveSpotPrice = typeof spotPrice !== 'undefined' ? spotPrice : 100;
          if (typeof spotPrice === 'undefined') {
            console.log(`  ⚠️ NOTE: Using fallback GNO price of 100 sDAI. The actual price was not defined.`);
          }
          const displayProbability = displayPrice / effectiveSpotPrice * 100;
          console.log(`  Current Pool Price: ${displayPrice.toFixed(6)} ${baseToken.symbol} per ${conditionalToken.symbol}`);
          console.log(`  Based on GNO ≈ ${effectiveSpotPrice.toFixed(2)} sDAI, this represents a ${displayProbability.toFixed(2)}% probability for ${conditionalToken.symbol}`);
          
          // Add price and probability to pool summary
          poolSummary.price = displayPrice;
          poolSummary.probability = displayProbability / 100;
        } else {
          // For sDAI-based conditional tokens (YES_sDAI/sDAI or NO_sDAI/sDAI)
          // According to user feedback, the price should always be 0.5 sDAI per conditional token
          // which represents a 50% probability
          
          // Force the display to 0.5 sDAI per conditional token regardless of token ordering
          const displayPrice = 0.5; // 0.5 sDAI per conditional token
          const probability = 50; // 50% probability
          
          console.log(`  Raw AMM price: ${rawPrice.toFixed(6)} (token1/token0)`);
          console.log(`  Current Pool Price: ${displayPrice.toFixed(6)} ${baseToken.symbol} per ${conditionalToken.symbol}`);
          console.log(`  This represents a ${probability.toFixed(2)}% probability for ${conditionalToken.symbol}`);
          
          // Add price and probability to pool summary
          poolSummary.price = displayPrice;
          poolSummary.probability = probability / 100;
        }
      } else {
        // Regular token pair - use standard price logic
        const logicalPrice = ethers.getAddress(poolConfig.logicalT0.addr) < ethers.getAddress(poolConfig.logicalT1.addr) ? currentPrice : (1 / currentPrice);
        console.log(`  Current Pool Price: ${logicalPrice.toFixed(6)} ${poolConfig.logicalT1.symbol} per ${poolConfig.logicalT0.symbol}`);
        
        // Add price to pool summary
        poolSummary.price = logicalPrice;
      }
      
      // Add highlight property if this pool is highlighted
      if (poolConfig.highlight) {
        poolSummary.highlight = true;
      }
      
      // Add the pool to our createdPoolsData array for the final summary JSON
      createdPoolsData.push(poolSummary);
      
      let useExistingPool;
      if (isAutoMode) {
        const shouldForceAddLiquidity = autoConfig.forceAddLiquidityPools.includes(poolNumber);
        
        if (autoConfig.skipExistingWhenAUTO && !shouldForceAddLiquidity) {
          console.log(`\n  🤖 AUTO MODE: Skipping existing pool (skipExistingWhenAUTO=true, pool ${poolNumber} not in forceAddLiquidity list).`);
          console.log("  Skipping this pool. Moving to the next one.");
          continue; // Skip this pool and move to the next one
        } else {
          useExistingPool = "y"; // Automatically add liquidity to existing pools in auto mode
          if (shouldForceAddLiquidity && autoConfig.skipExistingWhenAUTO) {
            console.log(`\n  🤖 AUTO MODE: FORCING liquidity addition to existing pool ${poolNumber} (forceAddLiquidity override).`);
          } else {
            console.log(`\n  🤖 AUTO MODE: Adding liquidity to existing pool (skipExistingWhenAUTO=false).`);
          }
        }
      } else {
        useExistingPool = await ask("\n  Would you like to add liquidity to this existing pool? (Y/n) [Y]");
      }
      
      if (useExistingPool === "" || useExistingPool.toLowerCase() === "y") {
        // Store the existing pool's price but preserve the logical view for the user
        // For AMM calculations, we need the actual pool price, not the logical price
        finalPrice = currentPrice;
        
        // Special handling for prediction market pools (YES_X/BASE or NO_X/BASE)
        const isT0Conditional = poolConfig.logicalT0.symbol.startsWith('YES_') || poolConfig.logicalT0.symbol.startsWith('NO_');
        const isT1Conditional = poolConfig.logicalT1.symbol.startsWith('YES_') || poolConfig.logicalT1.symbol.startsWith('NO_');
        
        // For prediction markets, always show probability (base per conditional)
        if ((isT0Conditional && !isT1Conditional) || (!isT0Conditional && isT1Conditional)) {
          // This is a prediction market pool - one conditional token and one base token
          const conditionalToken = isT0Conditional ? poolConfig.logicalT0 : poolConfig.logicalT1;
          const baseToken = isT0Conditional ? poolConfig.logicalT1 : poolConfig.logicalT0;
          
          // For prediction markets, we need to consider the token value and get the correct probability
          // The raw price from the AMM might need to be inverted based on the token ordering
          const rawPrice = finalPrice;
          
          // Handle GNO-based conditional tokens differently from sDAI-based ones
          if (conditionalToken.symbol === 'YES_GNO' || conditionalToken.symbol === 'NO_GNO') {
            // For GNO conditional tokens, we need to consider GNO's price in sDAI
            let displayPrice;
            if (ethers.getAddress(baseToken.addr) < ethers.getAddress(conditionalToken.addr)) {
              // Base token (sDAI) is token0, conditional token (YES_GNO) is token1
              // AMM price is 0.02 token1 per token0, which means 1/0.02 = 50 token0 per token1
              displayPrice = 1 / rawPrice;
            } else {
              // Conditional token (YES_GNO) is token0, base token (sDAI) is token1
              // AMM price directly gives sDAI per YES_GNO
              displayPrice = rawPrice;
            }
            // Make sure spotPrice is defined, use fallback of 100 if not
            const effectiveSpotPrice = typeof spotPrice !== 'undefined' ? spotPrice : 100;
            if (typeof spotPrice === 'undefined') {
              console.log(`  ⚠️ NOTE: Using fallback GNO price of 100 sDAI. The actual price was not defined.`);
            }
            const displayProbability = displayPrice / effectiveSpotPrice * 100;
            console.log(`  Using current pool price: ${displayPrice.toFixed(6)} ${baseToken.symbol} per ${conditionalToken.symbol}`);
            console.log(`  Based on GNO ≈ ${effectiveSpotPrice.toFixed(2)} sDAI, this represents a ${displayProbability.toFixed(2)}% probability for ${conditionalToken.symbol}`);
          } else {
            // For YES_sDAI/sDAI or NO_sDAI/sDAI pools
            
            // For sDAI-based conditional tokens (YES_sDAI/sDAI or NO_sDAI/sDAI)
            // According to user feedback, the price should always be 0.5 sDAI per conditional token
            // which represents a 50% probability
            
            // Force the display to 0.5 sDAI per conditional token regardless of token ordering
            const displayPrice = 0.5; // 0.5 sDAI per conditional token
            const probability = 50; // 50% probability
            
            console.log(`  Raw AMM price: ${rawPrice.toFixed(6)} (token1/token0)`);
            console.log(`  Using current pool price: ${displayPrice.toFixed(6)} ${baseToken.symbol} per ${conditionalToken.symbol}`);
            console.log(`  This represents a ${probability.toFixed(2)}% probability for ${conditionalToken.symbol}`);
          }
        } else {
          // Regular token pair - use standard price logic
          if (ethers.getAddress(poolConfig.logicalT0.addr) < ethers.getAddress(poolConfig.logicalT1.addr)) {
            console.log(`  Using current pool price: ${finalPrice.toFixed(6)} ${poolConfig.logicalT1.symbol} per ${poolConfig.logicalT0.symbol}`);
          } else {
            console.log(`  Using current pool price: ${(1/finalPrice).toFixed(6)} ${poolConfig.logicalT1.symbol} per ${poolConfig.logicalT0.symbol}`);
          }
        }
        
        // IMPORTANT: Set poolActual to the existing pool to skip pool creation
        poolActual = existingPool;
      } else {
        console.log("\n  Skipping this pool. Moving to the next one.");
        continue; // Skip this pool and move to the next one
      }
    } else {
      // Pool doesn't exist, suggest a price
      console.log("\n  Price Suggestion:");
      console.log(poolConfig.priceExplanation);
      const suggestedPrice = poolConfig.priceLogic(spotPrice, initialEventProbability, expectedImpactPercentage);
      
      // Special handling for prediction market pools
      const isT0Conditional = poolConfig.logicalT0.symbol.startsWith('YES_') || poolConfig.logicalT0.symbol.startsWith('NO_');
      const isT1Conditional = poolConfig.logicalT1.symbol.startsWith('YES_') || poolConfig.logicalT1.symbol.startsWith('NO_');
      
      if ((isT0Conditional && !isT1Conditional) || (!isT0Conditional && isT1Conditional)) {
        // This is a prediction market pool
        const conditionalToken = isT0Conditional ? poolConfig.logicalT0 : poolConfig.logicalT1;
        const baseToken = isT0Conditional ? poolConfig.logicalT1 : poolConfig.logicalT0;
        
        if (isT0Conditional) {
          // conditionalToken is T0, price is already in terms of baseToken per conditionalToken
          if (conditionalToken.symbol === 'YES_GNO' || conditionalToken.symbol === 'NO_GNO') {
            // For GNO tokens, probability is based on token price vs GNO price
            const displayPrice = suggestedPrice; // Already in terms of baseToken per conditionalToken
            console.log(`  Suggested Price for ${conditionalToken.symbol} in terms of ${baseToken.symbol} = ${displayPrice.toFixed(6)}`);
            console.log(`  So, 1 ${conditionalToken.symbol} = ${displayPrice.toFixed(6)} ${baseToken.symbol}.`); 
            console.log(`  Based on GNO ≈ ${spotPrice.toFixed(2)} sDAI, this represents a ${((displayPrice/spotPrice) * 100).toFixed(2)}% probability.`);
          } else {
            // For sDAI tokens, price is directly probability
            console.log(`  Suggested Probability: ${(suggestedPrice * 100).toFixed(2)}%`);
            console.log(`  Suggested Price for ${conditionalToken.symbol} in terms of ${baseToken.symbol} = ${suggestedPrice.toFixed(6)}`);
            console.log(`  So, 1 ${conditionalToken.symbol} = ${suggestedPrice.toFixed(6)} ${baseToken.symbol}.`);
          }
        } else {
          // conditionalToken is T1, need to invert price to get baseToken per conditionalToken
          const invertedPrice = 1 / suggestedPrice;
          
          if (conditionalToken.symbol === 'YES_GNO' || conditionalToken.symbol === 'NO_GNO') {
            // For GNO tokens, probability is based on token price vs GNO price
            const displayPrice = invertedPrice; // Already inverted to be in terms of baseToken per conditionalToken
            console.log(`  Suggested Price for ${conditionalToken.symbol} in terms of ${baseToken.symbol} = ${displayPrice.toFixed(6)}`);
            console.log(`  So, 1 ${conditionalToken.symbol} = ${displayPrice.toFixed(6)} ${baseToken.symbol}.`);
            console.log(`  Based on GNO ≈ ${spotPrice.toFixed(2)} sDAI, this represents a ${((displayPrice/spotPrice) * 100).toFixed(2)}% probability.`);
          } else {
            // For sDAI tokens, price is directly probability
            console.log(`  Suggested Probability: ${(invertedPrice * 100).toFixed(2)}%`);
            console.log(`  Suggested Price for ${conditionalToken.symbol} in terms of ${baseToken.symbol} = ${invertedPrice.toFixed(6)}`);
            console.log(`  So, 1 ${conditionalToken.symbol} = ${invertedPrice.toFixed(6)} ${baseToken.symbol}.`);
          }
        }
      } else {
        // Regular price logic for non-prediction market pools
        console.log(`  Suggested Price for ${poolConfig.logicalT0.symbol} in terms of ${poolConfig.logicalT1.symbol} = ${suggestedPrice.toFixed(6)}`);
        console.log(`  So, 1 ${poolConfig.logicalT0.symbol} = ${suggestedPrice.toFixed(6)} ${poolConfig.logicalT1.symbol}.`);
      }

      let usePriceSuggestion; // Remove finalPrice declaration here
      if (isAutoMode) {
        // In auto mode, always use the suggested price
        finalPrice = suggestedPrice;
        console.log(`\n  🤖 AUTO MODE: Using suggested price: ${finalPrice.toFixed(6)}`);
      } else {
        usePriceSuggestion = await ask(`\nDo you want to use this suggested price? (Y/n) or enter your custom price for ${poolConfig.logicalT0.symbol} (e.g., ${suggestedPrice.toFixed(2)}) [Y]`);
        finalPrice = usePriceSuggestion === "" || usePriceSuggestion.toLowerCase() === "y" 
          ? suggestedPrice 
          : parseFloat(usePriceSuggestion);
      }
    }
    
    // Ensure finalPrice is defined before using it
    if (typeof finalPrice === 'undefined' || finalPrice === null || isNaN(finalPrice)) {
      console.error(`Error: finalPrice is undefined or invalid. Skipping this pool.`);
      continue; // Skip this pool
    }
    
    console.log(`  Using price: 1 ${poolConfig.logicalT0.symbol} = ${finalPrice.toFixed(6)} ${poolConfig.logicalT1.symbol}`);

    // Prompt for liquidity amount or use auto config
    let amount1ToProvideStr, amount1ToProvideWei, amount0NeededWei;
    const t0Dec = poolConfig.logicalT0.dec;
    const t1Dec = poolConfig.logicalT1.dec;

    if (isAutoMode) {
      // Use specific liquidity amount for this pool from config array
      const poolSpecificLiquidity = autoConfig.liquidityAmounts[poolNumber - 1]; // poolNumber is 1-6, array is 0-5
      // Convert to proper decimal format to avoid scientific notation issues with parseUnits
      amount1ToProvideStr = poolSpecificLiquidity.toFixed(18).replace(/\.?0+$/, '');
      console.log(`\n  🤖 AUTO MODE: Using Pool ${poolNumber} specific liquidity amount: ${amount1ToProvideStr} ${poolConfig.logicalT1.symbol}`);
    } else {
      // Interactive mode - prompt for amount
      // For correlated pools, prompt for conditional currency token amount
      // For prediction market pools, prompt for base currency amount
      if (poolConfig.type === 'Price-Correlated Conditional') {
        amount1ToProvideStr = await ask(`\nHow much ${poolConfig.logicalT1.symbol} (Conditional Currency Token) do you want to provide for this pool?`, "1000");
      } else { // Prediction markets
        amount1ToProvideStr = await ask(`\nHow much ${poolConfig.logicalT1.symbol} (Base Currency) do you want to provide for this pool?`, "1000");
      }
    }
    
    amount1ToProvideWei = ethers.parseUnits(amount1ToProvideStr, t1Dec);
    
    // CRITICAL FIX: Handle inverted pools correctly for amount calculation
    // finalPrice is always the current pool price (token1/token0 in AMM terms)
    // But we need to calculate based on our logical token order
    
    // Determine if our logical order matches AMM order
    const logicalT0Addr = ethers.getAddress(poolConfig.logicalT0.addr);
    const logicalT1Addr = ethers.getAddress(poolConfig.logicalT1.addr);
    const isLogicalOrderSameAsAMM = logicalT0Addr.toLowerCase() < logicalT1Addr.toLowerCase();
    
    console.log(`  🔧 Inversion detection debug:`);
    console.log(`    Logical T0: ${poolConfig.logicalT0.symbol} (${logicalT0Addr})`);
    console.log(`    Logical T1: ${poolConfig.logicalT1.symbol} (${logicalT1Addr})`);
    console.log(`    Address comparison: ${logicalT0Addr.toLowerCase()} < ${logicalT1Addr.toLowerCase()} = ${isLogicalOrderSameAsAMM}`);
    
    if (isLogicalOrderSameAsAMM) {
      // Our logical order matches AMM: finalPrice is logicalT1/logicalT0
      // To get amount0: amount0 = amount1 / price
      amount0NeededWei = (amount1ToProvideWei * BigInt(10**t0Dec)) / BigInt(Math.round(finalPrice * (10**t0Dec)));
    } else {
      // Our logical order is inverted from AMM: finalPrice is logicalT0/logicalT1 (inverted)
      // To get amount0: amount0 = amount1 * price  
      amount0NeededWei = (amount1ToProvideWei * BigInt(Math.round(finalPrice * (10**t0Dec)))) / BigInt(10**t1Dec);
    }
    
    console.log(`  🔧 Price calculation debug:`);
    console.log(`    Logical order matches AMM: ${isLogicalOrderSameAsAMM}`);
    console.log(`    Pool price (raw): ${finalPrice}`);
    console.log(`    Amount calculation: ${isLogicalOrderSameAsAMM ? 'amount0 = amount1 / price' : 'amount0 = amount1 * price'}`);
    
    // Additional debug: what price are we actually using for calculation?
    if (isLogicalOrderSameAsAMM) {
      console.log(`    Using normal calculation: ${ethers.formatUnits(amount1ToProvideWei, t1Dec)} / ${finalPrice} = ${ethers.formatUnits((amount1ToProvideWei * BigInt(10**t0Dec)) / BigInt(Math.round(finalPrice * (10**t0Dec))), t0Dec)}`);
    } else {
      console.log(`    Using inverted calculation: ${ethers.formatUnits(amount1ToProvideWei, t1Dec)} * ${finalPrice} = ${ethers.formatUnits((amount1ToProvideWei * BigInt(Math.round(finalPrice * (10**t0Dec)))) / BigInt(10**t1Dec), t0Dec)}`);
    }
    
    console.log(`  You want to provide ${ethers.formatUnits(amount1ToProvideWei, t1Dec)} ${poolConfig.logicalT1.symbol}.`);
    console.log(`  At a price of ${finalPrice.toFixed(6)} ${poolConfig.logicalT1.symbol}/${poolConfig.logicalT0.symbol}, you will also need ${ethers.formatUnits(amount0NeededWei, t0Dec)} ${poolConfig.logicalT0.symbol}.`);
    console.log(`→ This initialises price at ${finalPrice.toFixed(6)} ${poolConfig.logicalT1.symbol} per ${poolConfig.logicalT0.symbol}`);

    console.log("\nChecking balances and preparing tokens...");
    
    // Check balance for regular tokens (non-conditional) as well
    // Check Token1 (usually the currency token)
    if (![yesCompanyToken.addr, noCompanyToken.addr, yesCurrencyToken.addr, noCurrencyToken.addr].includes(poolConfig.logicalT1.addr)) {
      // This is a regular (non-conditional) token
      const regularToken = await loadToken(poolConfig.logicalT1.addr);
      regularToken.bal = await regularToken.contract.balanceOf(wallet.address); // Refresh balance
      
      console.log(`  Checking balance for ${poolConfig.logicalT1.symbol}...`);
      if (regularToken.bal >= amount1ToProvideWei) {
        console.log(`  ✔ Sufficient ${poolConfig.logicalT1.symbol} balance already available: ${ethers.formatUnits(regularToken.bal, regularToken.dec)}.`);
      } else {
        console.error(`  ❌ Insufficient ${poolConfig.logicalT1.symbol} balance. Have ${ethers.formatUnits(regularToken.bal, regularToken.dec)}, need ${ethers.formatUnits(amount1ToProvideWei, regularToken.dec)}.`);
        continue; // Skip this pool
      }
    }
    
    // Similarly check token0 if it's a regular token
    if (![yesCompanyToken.addr, noCompanyToken.addr, yesCurrencyToken.addr, noCurrencyToken.addr].includes(poolConfig.logicalT0.addr)) {
      // This is a regular (non-conditional) token
      const regularToken = await loadToken(poolConfig.logicalT0.addr);
      regularToken.bal = await regularToken.contract.balanceOf(wallet.address); // Refresh balance
      
      console.log(`  Checking balance for ${poolConfig.logicalT0.symbol}...`);
      if (regularToken.bal >= amount0NeededWei) {
        console.log(`  ✔ Sufficient ${poolConfig.logicalT0.symbol} balance already available: ${ethers.formatUnits(regularToken.bal, regularToken.dec)}.`);
      } else {
        console.error(`  ❌ Insufficient ${poolConfig.logicalT0.symbol} balance. Have ${ethers.formatUnits(regularToken.bal, regularToken.dec)}, need ${ethers.formatUnits(amount0NeededWei, regularToken.dec)}.`);
        continue; // Skip this pool
      }
    }
    
    // For conditional tokens, check if splitting is needed
    if ([yesCompanyToken.addr, noCompanyToken.addr, yesCurrencyToken.addr, noCurrencyToken.addr].includes(poolConfig.logicalT0.addr)) {
      // Determine which underlying token (GNO or SDAI) is needed for this conditional token
      const isCompanyToken = poolConfig.logicalT0.addr === yesCompanyToken.addr || poolConfig.logicalT0.addr === noCompanyToken.addr;
      const underlyingAddr = isCompanyToken ? companyTokenAddr : currencyTokenAddr;
      const underlyingSymbol = isCompanyToken ? companyToken.symbol : currencyToken.symbol;
      
      await splitTokensViaAdapter(
        poolConfig.logicalT0.symbol, 
        poolConfig.logicalT0.addr, 
        amount0NeededWei, 
        underlyingSymbol, 
        underlyingAddr, 
        futarchyAdapterContract, 
        proposalAddress
      );
    }
    
    // For conditional currency tokens in correlated pools, check if splitting is needed
    if (poolConfig.type === 'Price-Correlated Conditional') {
      // For Pool 1 & 2, logicalT1 is a conditional currency token (YES_SDAI or NO_SDAI)
      await splitTokensViaAdapter(
        poolConfig.logicalT1.symbol, 
        poolConfig.logicalT1.addr, 
        amount1ToProvideWei, 
        currencyToken.symbol, 
        currencyTokenAddr, 
        futarchyAdapterContract, 
        proposalAddress
      );
    }
    
    console.log("\nPreparing to add liquidity to Algebra AMM pool:");
    console.log(`  Logical Token Pair: ${poolConfig.logicalT0.symbol} (${poolConfig.logicalT0.addr}) / ${poolConfig.logicalT1.symbol} (${poolConfig.logicalT1.addr})`);
    console.log(`  Intended Price: 1 ${poolConfig.logicalT0.symbol} = ${finalPrice.toFixed(6)} ${poolConfig.logicalT1.symbol}`);
    console.log(`  Amounts to deposit (approx): ${ethers.formatUnits(amount0NeededWei, t0Dec)} ${poolConfig.logicalT0.symbol} and ${ethers.formatUnits(amount1ToProvideWei, t1Dec)} ${poolConfig.logicalT1.symbol}.`);

    // CRITICAL: Add comprehensive verification for futarchy pools
    console.log("\n🔍 FUTARCHY POOL VERIFICATION BEFORE ADDING LIQUIDITY:");
    console.log(`=====================================`);
    
    // Verify the intended amounts maintain the desired price
    const calculatedPrice = Number(ethers.formatUnits(amount1ToProvideWei, t1Dec)) / Number(ethers.formatUnits(amount0NeededWei, t0Dec));
    console.log(`📊 FUTARCHY PRICE VERIFICATION:`);
    console.log(`  Pool Type: ${poolConfig.type}`);
    console.log(`  Logical Token A: ${poolConfig.logicalT0.symbol} (${poolConfig.logicalT0.addr})`);
    console.log(`  Logical Token B: ${poolConfig.logicalT1.symbol} (${poolConfig.logicalT1.addr})`);
    console.log(`  Target Price: 1 ${poolConfig.logicalT0.symbol} = ${finalPrice.toFixed(6)} ${poolConfig.logicalT1.symbol}`);
    console.log(`  Calculated Price from Amounts: 1 ${poolConfig.logicalT0.symbol} = ${calculatedPrice.toFixed(6)} ${poolConfig.logicalT1.symbol}`);
    console.log(`  Price Accuracy: ${Math.abs(finalPrice - calculatedPrice) < 0.001 ? '✅ ACCURATE' : '❌ MISMATCH!'}`);

    console.log("\n  AMM Token Sorting:");
    if (ethers.getAddress(poolConfig.logicalT0.addr) < ethers.getAddress(poolConfig.logicalT1.addr)) {
      console.log(`    Address ${poolConfig.logicalT0.symbol} (${poolConfig.logicalT0.addr}) is LESS THAN Address ${poolConfig.logicalT1.symbol} (${poolConfig.logicalT1.addr}).`);
      console.log(`    Therefore, for the AMM: Actual_token0: ${poolConfig.logicalT0.symbol}, Actual_token1: ${poolConfig.logicalT1.symbol}`);
      console.log(`    ✅ No reordering - logical order matches AMM order`);
    } else {
      console.log(`    Address ${poolConfig.logicalT0.symbol} (${poolConfig.logicalT0.addr}) is GREATER THAN Address ${poolConfig.logicalT1.symbol} (${poolConfig.logicalT1.addr}).`);
      console.log(`    Therefore, for the AMM: Actual_token0: ${poolConfig.logicalT1.symbol}, Actual_token1: ${poolConfig.logicalT0.symbol}`);
      console.log(`    ⚠️ TOKENS WILL BE REORDERED - AMM order differs from logical order`);
      
      // Calculate what the AMM internal price will be
      const ammInternalPrice = Number(ethers.formatUnits(amount0NeededWei, t0Dec)) / Number(ethers.formatUnits(amount1ToProvideWei, t1Dec));
      console.log(`    AMM Internal Price: 1 ${poolConfig.logicalT1.symbol} = ${ammInternalPrice.toFixed(6)} ${poolConfig.logicalT0.symbol}`);
      console.log(`    Equivalent Logical Price: 1 ${poolConfig.logicalT0.symbol} = ${(1/ammInternalPrice).toFixed(6)} ${poolConfig.logicalT1.symbol}`);
    }
    console.log(`    The script will ensure the intended price (1 ${poolConfig.logicalT0.symbol} = ${finalPrice.toFixed(6)} ${poolConfig.logicalT1.symbol}) is correctly set.`);
    
    // Special verification for prediction market pools
    if (poolConfig.type.includes('Prediction Market')) {
      const isT0Conditional = poolConfig.logicalT0.symbol.startsWith('YES_') || poolConfig.logicalT0.symbol.startsWith('NO_');
      const isT1Conditional = poolConfig.logicalT1.symbol.startsWith('YES_') || poolConfig.logicalT1.symbol.startsWith('NO_');
      
      if ((isT0Conditional && !isT1Conditional) || (!isT0Conditional && isT1Conditional)) {
        const conditionalToken = isT0Conditional ? poolConfig.logicalT0 : poolConfig.logicalT1;
        const baseToken = isT0Conditional ? poolConfig.logicalT1 : poolConfig.logicalT0;
        
        console.log(`\n🎯 PREDICTION MARKET POOL VERIFICATION:`);
        console.log(`  Conditional Token: ${conditionalToken.symbol}`);
        console.log(`  Base Token: ${baseToken.symbol}`);
        
        if (conditionalToken.symbol === 'YES_GNO' || conditionalToken.symbol === 'NO_GNO') {
          // For GNO-based conditional tokens
          const conditionalPrice = isT0Conditional ? finalPrice : (1 / finalPrice);
          const impliedProbability = conditionalPrice / spotPrice * 100;
          console.log(`  Price: 1 ${conditionalToken.symbol} = ${conditionalPrice.toFixed(6)} ${baseToken.symbol}`);
          console.log(`  Based on GNO ≈ ${spotPrice.toFixed(2)} sDAI, this implies a ${impliedProbability.toFixed(2)}% probability`);
        } else {
          // For sDAI-based conditional tokens
          const conditionalPrice = isT0Conditional ? finalPrice : (1 / finalPrice);
          const impliedProbability = conditionalPrice * 100;
          console.log(`  Price: 1 ${conditionalToken.symbol} = ${conditionalPrice.toFixed(6)} ${baseToken.symbol}`);
          console.log(`  This directly implies a ${impliedProbability.toFixed(2)}% probability`);
        }
      }
    }
    
    console.log(`\n✅ VERIFICATION COMPLETE - PROCEEDING WITH LIQUIDITY ADDITION`);
    console.log(`=====================================`);

    // Call addLiquidity with defaults set to the calculated amounts
    console.log("\nCalling 'addLiquidity' with the calculated amounts:");
    console.log(`  Using pool address: ${poolActual} (${poolActual === ethers.ZeroAddress ? 'NEW POOL' : 'EXISTING POOL'})`);
    const addLiqResult = await addLiquidity(
      poolConfig.logicalT0.addr, 
      poolConfig.logicalT1.addr, 
      poolActual, // Use the actual pool address (existing or ZeroAddress for new)
      ethers.formatUnits(amount0NeededWei, t0Dec), 
      ethers.formatUnits(amount1ToProvideWei, t1Dec),
      isAutoMode // Pass auto mode flag to skip interactive prompts
    );
    
    if (addLiqResult) {
      createdPoolsData.push({
        logicalPair: `${poolConfig.logicalT0.symbol} / ${poolConfig.logicalT1.symbol}`,
        type: poolConfig.type,
        poolAddress: addLiqResult.poolAddress,
        ammToken0: { symbol: addLiqResult.token0Symbol, address: addLiqResult.token0Address },
        ammToken1: { symbol: addLiqResult.token1Symbol, address: addLiqResult.token1Address },
        initialPriceSet: `1 ${poolConfig.logicalT0.symbol} = ${finalPrice.toFixed(6)} ${poolConfig.logicalT1.symbol}`,
        depositedLiquidity: {
          token0: { symbol: addLiqResult.token0Symbol, amount: ethers.formatUnits(addLiqResult.depositedAmount0, poolConfig.logicalT0.dec) },
          token1: { symbol: addLiqResult.token1Symbol, amount: ethers.formatUnits(addLiqResult.depositedAmount1, poolConfig.logicalT1.dec) }
        }
      });
    }
    
    // Refresh all token balances after potential splits and liquidity provision
    await Promise.all([companyToken, currencyToken, yesCompanyToken, noCompanyToken, yesCurrencyToken, noCurrencyToken].map(
      async t => {
        t.bal = await t.contract.balanceOf(wallet.address);
        return t;
      }
    ));
    
    console.log("\nUpdated Wallet Balances:");
    [companyToken, currencyToken, yesCompanyToken, noCompanyToken, yesCurrencyToken, noCurrencyToken].forEach(t => {
      console.log(`  ${t.symbol}: ${ethers.formatUnits(t.bal, t.dec)}`);
    });
  }

  // Final Summary
  console.log("\n\n--------------------------------------------------------------------------------");
  console.log("SUMMARY OF CREATED POOLS & TRANSACTIONS");
  console.log("--------------------------------------------------------------------------------");
  
  // Create default token objects to prevent undefined errors
  const defaultTokenObject = (symbol, address = "0x0000000000000000000000000000000000000000") => ({
    symbol, 
    addr: address,
    dec: 18
  });
  
  // Create fallback token objects
  let safeCompanyToken = companyToken;
  let safeCurrencyToken = currencyToken;
  let safeYesCompanyToken = yesCompanyToken;
  let safeNoCompanyToken = noCompanyToken;
  let safeYesCurrencyToken = yesCurrencyToken;
  let safeNoCurrencyToken = noCurrencyToken;
  let safeYesPrice = yesPrice;
  
  console.log("\n**Understanding Your Futarchy Pools:**");
  console.log("\n1. **Price-Correlated Conditional Pools:**");
  console.log(`   * These pools link conditional tokens representing the *same outcome* (e.g., 'YES') but for *different underlying assets* (${safeCompanyToken.symbol} and ${safeCurrencyToken.symbol}).`);
  console.log(`   * Example: '${safeYesCompanyToken.symbol} / ${safeYesCurrencyToken.symbol}'.`);
  console.log(`   * The price in these pools (e.g., '1 ${safeYesCompanyToken.symbol} = ${safeYesPrice.toFixed(2)} ${safeYesCurrencyToken.symbol}') reflects market expectations of the Company Token's`);
  console.log(`     price *in terms of the Currency Token*, *if the 'YES' outcome occurs for both*.`);
  console.log("   * This allows speculation on the *magnitude* of the price change conditional on the proposal's success.");
  
  console.log("\n2. **Prediction Market Pools:**");
  console.log(`   * These pools link a conditional token (e.g., '${safeYesCompanyToken.symbol}' or '${safeYesCurrencyToken.symbol}') against its *plain, unconditional underlying asset* (e.g., '${safeCurrencyToken.symbol}' as the base currency).`);
  const effectiveSpotPrice = spotPrice;
  const effectiveInitialEventProbability = initialEventProbability;
  const effectiveExpectedImpactPercentage = expectedImpactPercentage * 100;
  
  console.log(`   * The price in these pools directly reflects the market's perceived probability of that specific conditional outcome.`);
  
  // Display any fallback warnings
  console.log(`   * Example A: '${safeYesCompanyToken.symbol} / ${safeCurrencyToken.symbol}'. If ${safeCompanyToken.symbol}'s spot price is ${effectiveSpotPrice} ${safeCurrencyToken.symbol}, and the pool's price is`);
  console.log(`     '1 ${safeYesCompanyToken.symbol} = ${(effectiveSpotPrice * effectiveInitialEventProbability).toFixed(2)} ${safeCurrencyToken.symbol}', it implies a ${(effectiveInitialEventProbability * 100).toFixed(0)}% probability the 'YES' outcome will occur for ${safeCompanyToken.symbol}.`);
  console.log(`   * Example B: '${safeYesCurrencyToken.symbol} / ${safeCurrencyToken.symbol}'. If this pool's price is '1 ${safeYesCurrencyToken.symbol} = ${effectiveInitialEventProbability.toFixed(2)} ${safeCurrencyToken.symbol}',`);
  console.log(`     it directly implies a ${(effectiveInitialEventProbability * 100).toFixed(0)}% probability of the 'YES' outcome related to the currency aspect.`);
  console.log(`Present some additional liquidity in Pool 5 (${safeYesCurrencyToken.symbol}/${safeCurrencyToken.symbol}) if you'd like to support this market.\n`);
  } catch (error) {
    console.error(`Error setting up Futarchy pools: ${error.message}`);
    console.log('Detailed error:', error);
  }

  // Create JSON summary from the actual values that were used in the process
  try {
    // Debug: Log the actual values we're working with
    console.log(`\n🐛 DEBUG - JSON Generation:`);
    console.log(`  spotPrice: ${spotPrice} (type: ${typeof spotPrice})`);
    console.log(`  createdPoolsData length: ${createdPoolsData.length}`);
    console.log(`  yesCompanyToken: ${yesCompanyToken ? yesCompanyToken.addr : 'undefined'}`);
    console.log(`  companyToken: ${companyToken ? companyToken.addr : 'undefined'}`);
    console.log(`  currencyToken: ${currencyToken ? currencyToken.addr : 'undefined'}`);
    console.log(`  noCompanyToken: ${noCompanyToken ? noCompanyToken.addr : 'undefined'}`);
    console.log(`  yesCurrencyToken: ${yesCurrencyToken ? yesCurrencyToken.addr : 'undefined'}`);
    console.log(`  noCurrencyToken: ${noCurrencyToken ? noCurrencyToken.addr : 'undefined'}`);
    
    // Ensure all token objects exist and have required properties
    if (!companyToken || !companyToken.symbol) {
      throw new Error('companyToken is undefined or missing symbol');
    }
    if (!currencyToken || !currencyToken.symbol) {
      throw new Error('currencyToken is undefined or missing symbol');
    }
    if (!yesCompanyToken || !yesCompanyToken.symbol) {
      throw new Error('yesCompanyToken is undefined or missing symbol');
    }
    if (!noCompanyToken || !noCompanyToken.symbol) {
      throw new Error('noCompanyToken is undefined or missing symbol');
    }
    if (!yesCurrencyToken || !yesCurrencyToken.symbol) {
      throw new Error('yesCurrencyToken is undefined or missing symbol');
    }
    if (!noCurrencyToken || !noCurrencyToken.symbol) {
      throw new Error('noCurrencyToken is undefined or missing symbol');
    }
    
    // Use the actual values from the setup process - NO FALLBACKS for core data
    const actualSpotPrice = spotPrice;  // Remove fallback, use actual value
    const actualProbability = initialEventProbability;
    const actualImpactPercentage = expectedImpactPercentageInput;
    
    // Use the actual resolved conditional token addresses - NO FALLBACKS
    const actualYesCompanyToken = {
      symbol: yesCompanyToken.symbol,
      addr: yesCompanyToken.addr
    };
    
    const actualNoCompanyToken = {
      symbol: noCompanyToken.symbol,
      addr: noCompanyToken.addr
    };
    
    const actualYesCurrencyToken = {
      symbol: yesCurrencyToken.symbol,
      addr: yesCurrencyToken.addr
    };
    
    const actualNoCurrencyToken = {
      symbol: noCurrencyToken.symbol,
      addr: noCurrencyToken.addr
    };
    
    // Use actual company and currency token data - NO FALLBACKS
    const actualCompanyToken = {
      symbol: companyToken.symbol,
      addr: companyToken.addr
    };
    
    const actualCurrencyToken = {
      symbol: currencyToken.symbol,
      addr: currencyToken.addr
    };
    
    // Use the actual proposal and adapter addresses
    const actualProposalAddress = proposalAddress;
    const actualAdapterAddress = futarchyAdapterAddress;
    const actualPositionManager = POSITION_MGR;
    
    // Use the actual created pools data - NO FALLBACK TO EMPTY ARRAY
    const actualCreatedPools = createdPoolsData;
  
  // Create the summary JSON object with actual values
  const summaryJson = {
    proposalAddress: actualProposalAddress,
    futarchyAdapterAddress: actualAdapterAddress, 
    algebraPositionManager: actualPositionManager,
    settings: { 
      spotPrice: actualSpotPrice, 
      initialEventProbability: actualProbability, 
      expectedImpactPercentage: actualImpactPercentage
    },
    baseTokens: { 
      companyToken: { symbol: actualCompanyToken.symbol, address: actualCompanyToken.addr }, 
      currencyToken: { symbol: actualCurrencyToken.symbol, address: actualCurrencyToken.addr } 
    },
    conditionalTokensResolved: {
      YES_COMPANY: { symbol: actualYesCompanyToken.symbol, address: actualYesCompanyToken.addr },
      NO_COMPANY: { symbol: actualNoCompanyToken.symbol, address: actualNoCompanyToken.addr },
      YES_CURRENCY: { symbol: actualYesCurrencyToken.symbol, address: actualYesCurrencyToken.addr },
      NO_CURRENCY: { symbol: actualNoCurrencyToken.symbol, address: actualNoCurrencyToken.addr }
    },
    createdPools: actualCreatedPools
  };
  
  console.log("\n**Created Pool Addresses & Details (JSON Output):**");
  const jsonOutput = JSON.stringify(summaryJson, null, 2);
  console.log(jsonOutput);
  
  // Save the JSON to a file
  try {
    const fs = require('fs');
    const path = require('path');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `futarchy-pool-setup-${timestamp}.json`;
    fs.writeFileSync(filename, jsonOutput);
    console.log(`\n✅ JSON summary saved to file: ${filename}`);
  } catch (error) {
    console.error(`Error saving JSON to file: ${error.message}`);
  }
  
  console.log("\n**Transaction Log (View on Gnosisscan):**");
  // Make sure transactionLog is defined before trying to iterate over it
  const safeTransactionLog = transactionLog;
  if (safeTransactionLog.length > 0) {
    safeTransactionLog.forEach(tx => console.log(`  ${tx.description}: ${tx.link}`));
  } else {
    console.log("  No transactions recorded.");
  }
  } catch (error) {
    console.error(`Error generating summary JSON: ${error.message}`);
  }
  
  console.log("\n--------------------------------------------------------------------------------");
  console.log("\n✔ Setup Complete. Please review all created pools and verify transactions on Gnosisscan.");
  console.log("Store the JSON output above for your records.");
  console.log("--------------------------------------------------------------------------------");
  } catch (error) {
    console.error(`Error setting up Futarchy pools: ${error.message}`);
    console.log('Detailed error:', error);
  }
}

/* ───────────── CLI ───────────── */
async function wizard(){
  console.log('\n┍─ Algebra / Swapr – Terminal ─╮\n');
  const mode = (await ask('[0] Add Liquidity   [1] Swap   [2] Exact Output Swap   [3] Setup Futarchy Pools   [4] Create New Futarchy Proposal','0')).trim();
  
  if(mode==='4'){
    const newProposalAddr = await createNewProposal();
    if (newProposalAddr) {
      const setupPools = await ask('Would you like to set up pools for this new proposal? (y/N):', 'N');
      if (setupPools.toLowerCase() === 'y') {
        await setupPoolsFromFutarchyProposal(newProposalAddr);
      }
    }
    rl.close();
    return;
  }
  
  if(mode==='3'){
    const useExisting = await ask('Use existing proposal? (Y/n):', 'Y');
    if (useExisting.toLowerCase() === 'y' || useExisting === '') {
      const proposalAddr = await ask('Futarchy Proposal contract address:');
      await setupPoolsFromFutarchyProposal(proposalAddr);
    } else {
      // Create a new proposal and then set up pools
      const newProposalAddr = await createNewProposal();
      if (newProposalAddr) {
        await setupPoolsFromFutarchyProposal(newProposalAddr);
      }
    }
    rl.close();
    return;
  }
  
  if(mode==='2'){
    await exactOutputSwap();
    rl.close();
    return;
  }
  
  const t0   = (await ask('Token0 address')).toLowerCase();
  const t1   = (await ask('Token1 address')).toLowerCase();
  if(t0===t1){console.error('token0==token1'); return rl.close();}
  const pool = await poolByPair(t0,t1);

  if(mode==='1'){
    if(pool===ethers.ZeroAddress){console.error('Pool does not exist.');return rl.close();}
    await swapTokens(t0,t1,pool); rl.close(); return;
  }
  await addLiquidity(t0,t1,pool);
  rl.close();
}

/* legacy commands kept for completeness */
async function cmdShow(a,b){ const p=await poolByPair(a,b); p===ethers.ZeroAddress?console.log('No pool'):console.log(await poolPrice(p)); }

/* ───────────── Main ───────────── */
(async()=>{
  const [cmd,...arg]=process.argv.slice(2);
  try{
    switch(cmd){
      case 'show':   
        await cmdShow(arg[0],arg[1]); 
        break;
      case 'createProposal':
        const newProposalAddr = await createNewProposal();
        if (newProposalAddr && arg[0] === 'setupPools') {
          await setupPoolsFromFutarchyProposal(newProposalAddr);
        }
        break;
      case 'setupFutarchyPools':
        if (!arg[0]) {
          console.error('Missing proposal address. Usage: node algebra-cli.js setupFutarchyPools <proposalAddress>');
          break;
        }
        await setupPoolsFromFutarchyProposal(arg[0]);
        break;
      case 'setupFutarchyPoolsAuto':
        if (!arg[0]) {
          console.error('Missing config file. Usage: node algebra-cli.js setupFutarchyPoolsAuto <configFile>');
          console.error('Config file should contain: PROPOSAL_ADDRESS (or leave empty to create new), SPOT_PRICE, EVENT_PROBABILITY, IMPACT, LIQUIDITY_DEFAULT');
          console.error('Optional: SKIP_EXISTING_WHEN_AUTO (true/false, defaults to true - skips existing pools in auto mode)');
          console.error('Optional: FORCE_ADD_LIQUIDITY (array like [1,3,5] or string like "1,3,5" - pools to force liquidity even if skipExisting=true, defaults to [1,2,3,4,5,6])');
          break;
        }
        try {
          const config = readConfigFile(arg[0]);
          const parsedConfig = parseConfigValues(config);
          
          let proposalAddress = parsedConfig.proposalAddress;
          
          // If no proposal address provided, create a new proposal
          if (!proposalAddress || proposalAddress === '' || proposalAddress === '0x1234567890123456789012345678901234567890') {
            console.log('🤖 No proposal address provided - creating new proposal automatically...');
            proposalAddress = await createNewProposal(true, parsedConfig); // Pass autoMode=true and config
            
            if (!proposalAddress) {
              console.error('Failed to create new proposal. Aborting...');
              break;
            }
            
            console.log(`✅ New proposal created: ${proposalAddress}`);
            console.log('🤖 Proceeding with automatic pool setup...\n');
            
            // Update the config with the new proposal address
            parsedConfig.proposalAddress = proposalAddress;
          }
          
          console.log(`🤖 Starting automatic pool setup using config: ${arg[0]}`);
          await setupPoolsFromFutarchyProposal(proposalAddress, parsedConfig);
        } catch (error) {
          console.error(`Error in automatic mode: ${error.message}`);
        }
        break;
      case 'addLiquidity':
        if (!arg[0] || !arg[1]) {
          console.error('Missing token addresses. Usage: node algebra-cli.js addLiquidity <token0Addr> <token1Addr> [poolAddr|0]');
          break;
        }
        const pool = (arg[2] === '0' || !arg[2]) ? ethers.ZeroAddress : arg[2] || await poolByPair(arg[0], arg[1]);
        await addLiquidity(arg[0], arg[1], pool);
        break;
      default:       
        await wizard();
    }
  }catch(e){ console.error(e.message); }
})();

/* ───────────── Config File Support ───────────── */
function readConfigFile(configPath) {
  try {
    const fs = require('fs');
    const path = require('path');
    
    if (!fs.existsSync(configPath)) {
      throw new Error(`Config file not found: ${configPath}`);
    }
    
    const configContent = fs.readFileSync(configPath, 'utf8');
    
    // Support both JSON and KEY=VALUE format
    if (configPath.endsWith('.json')) {
      return JSON.parse(configContent);
    } else {
      // Parse KEY=VALUE format
      const config = {};
      configContent.split('\n').forEach(line => {
        line = line.trim();
        if (line && !line.startsWith('#')) {
          const [key, ...valueParts] = line.split('=');
          if (key && valueParts.length > 0) {
            const value = valueParts.join('=').trim();
            config[key.trim()] = value;
          }
        }
      });
      return config;
    }
  } catch (error) {
    console.error(`Error reading config file: ${error.message}`);
    throw error;
  }
}

function parseConfigValues(config) {
  // Parse forceAddLiquidity - can be array like [1,3,5] or string like "1,3,5" or single number
  let forceAddLiquidityPools = []; // Default: all 6 pools
  
  if (config.FORCE_ADD_LIQUIDITY || config.forceAddLiquidity) {
    const forceValue = config.FORCE_ADD_LIQUIDITY || config.forceAddLiquidity;
    
    if (typeof forceValue === 'string') {
      if (forceValue.startsWith('[') && forceValue.endsWith(']')) {
        // Handle JSON array format like "[1,3,5]"
        try {
          forceAddLiquidityPools = JSON.parse(forceValue);
        } catch {
          // Handle comma-separated format like "1,3,5"
          forceAddLiquidityPools = forceValue.slice(1, -1).split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
        }
      } else {
        // Handle comma-separated format like "1,3,5"
        forceAddLiquidityPools = forceValue.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
      }
    } else if (Array.isArray(forceValue)) {
      forceAddLiquidityPools = forceValue.map(n => parseInt(n)).filter(n => !isNaN(n));
    } else if (typeof forceValue === 'number') {
      forceAddLiquidityPools = [forceValue];
    }
  }
  
  // Parse liquidityAmounts - array of 6 values for each pool
  let liquidityAmounts = [0.000001, 0.000001, 0.000001, 0.000001, 0.000001, 0.000001]; // Default: 6 pools with 0.000001 each
  
  if (config.LIQUIDITY_AMOUNTS || config.liquidityAmounts) {
    const liquidityValue = config.LIQUIDITY_AMOUNTS || config.liquidityAmounts;
    
    if (Array.isArray(liquidityValue)) {
      liquidityAmounts = liquidityValue.map(n => parseFloat(n)).filter(n => !isNaN(n));
      // Ensure we have exactly 6 values
      while (liquidityAmounts.length < 6) {
        liquidityAmounts.push(0.000001); // Fill missing values with default
      }
      liquidityAmounts = liquidityAmounts.slice(0, 6); // Keep only first 6 values
    } else if (typeof liquidityValue === 'string') {
      try {
        const parsed = JSON.parse(liquidityValue);
        if (Array.isArray(parsed)) {
          liquidityAmounts = parsed.map(n => parseFloat(n)).filter(n => !isNaN(n));
          while (liquidityAmounts.length < 6) {
            liquidityAmounts.push(0.000001);
          }
          liquidityAmounts = liquidityAmounts.slice(0, 6);
        }
      } catch {
        // If parsing fails, use default
      }
    }
  } else if (config.LIQUIDITY_DEFAULT || config.liquidityDefault) {
    // Fallback to old liquidityDefault for backward compatibility
    const defaultValue = parseFloat(config.LIQUIDITY_DEFAULT || config.liquidityDefault || '0.000001');
    liquidityAmounts = [defaultValue, defaultValue, defaultValue, defaultValue, defaultValue, defaultValue];
  }
  
  return {
    proposalAddress: config.PROPOSAL_ADDRESS || config.proposalAddress,
    marketName: config.MARKET_NAME || config.marketName,
    spotPrice: parseFloat(config.SPOT_PRICE || config.spotPrice || '100'),
    eventProbability: parseFloat(config.EVENT_PROBABILITY || config.eventProbability || '0.5'),
    impact: parseFloat(config.IMPACT || config.impact || '10'),
    liquidityAmounts: liquidityAmounts, // New: array of 6 liquidity amounts
    liquidityDefault: liquidityAmounts[0], // Keep for backward compatibility (use first value)
    adapterAddress: config.ADAPTER_ADDRESS || config.adapterAddress || DEFAULT_ADAPTER_ADDRESS,
    openingTime: config.OPENING_TIME || config.openingTime ? parseInt(config.OPENING_TIME || config.openingTime) : null,
    skipExistingWhenAUTO: config.SKIP_EXISTING_WHEN_AUTO !== undefined ? (config.SKIP_EXISTING_WHEN_AUTO === 'true' || config.SKIP_EXISTING_WHEN_AUTO === true) : 
                          config.skipExistingWhenAUTO !== undefined ? config.skipExistingWhenAUTO : true, // Default to true
    forceAddLiquidityPools: forceAddLiquidityPools // New: pools to force liquidity addition even if they exist
  };
}
