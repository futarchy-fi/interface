/**
 * @fileoverview Futarchy Liquidity Manager
 * 
 * A module for managing SushiSwap V2 liquidity pools for Futarchy proposals.
 * This module handles token approvals, pool creation, and liquidity addition.
 */

import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

// Contract ABIs
const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)"
];

const FACTORY_ABI = [
  "function getPair(address,address) view returns (address)",
  "function createPair(address,address) returns (address)"
];

// Create factory interface for parsing events
const FACTORY_INTERFACE = new ethers.utils.Interface([
  "event PairCreated(address indexed token0, address indexed token1, address pair, uint256)"
]);

const ROUTER_ABI = [
  "function addLiquidity(address,address,uint256,uint256,uint256,uint256,address,uint256) returns (uint256,uint256,uint256)",
  "function factory() view returns (address)"
];

const PROPOSAL_ABI = [
  "function marketName() view returns (string)",
  "function encodedQuestion() view returns (string)",
  "function collateralToken1() view returns (address)",
  "function collateralToken2() view returns (address)",
  "function wrappedOutcome(uint256) view returns (address)",
  "function numOutcomes() view returns (uint256)"
];

// Default addresses (can be overridden by .env or config)
const DEFAULT_ADDRESSES = {
  WXDAI: '0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d',
  SUSHI_ROUTER: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506', // SushiSwap V2 Router on Gnosis Chain
  SUSHI_FACTORY: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4'  // SushiSwap V2 Factory on Gnosis Chain
};

/**
 * Creates a liquidity provider instance
 * @param {Object} options - Provider, signer, and callback functions
 * @returns {Object} Liquidity provider interface
 */
export function createLiquidityProvider({
  provider,
  signer,
  onApprovalNeeded,
  onPoolCreation,
  onLiquidityAdded,
  onTransaction
}) {
  // Validation
  if (!provider) throw new Error('Provider is required');
  if (!signer) throw new Error('Signer is required');
  
  // Use environment variables if available - no fallback to old router variable
  const routerAddress = process.env.SUSHISWAP_V2_ROUTER_POOL_CREATOR || DEFAULT_ADDRESSES.SUSHI_ROUTER;
  const factoryAddress = process.env.SUSHISWAP_V2_FACTORY || DEFAULT_ADDRESSES.SUSHI_FACTORY;
  const wxdaiAddress = process.env.WXDAI_ADDRESS || DEFAULT_ADDRESSES.WXDAI;
  
  // Create contract instances
  const router = new ethers.Contract(routerAddress, ROUTER_ABI, signer);
  const factory = new ethers.Contract(factoryAddress, FACTORY_ABI, signer);
  
  // Keep track of token contracts
  const tokenContracts = new Map();
  
  /**
   * Gets or creates a token contract instance
   * @param {string} tokenAddress - Token address
   * @returns {ethers.Contract} Token contract
   */
  const getTokenContract = (tokenAddress) => {
    if (!tokenContracts.has(tokenAddress)) {
      const contract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
      tokenContracts.set(tokenAddress, contract);
    }
    return tokenContracts.get(tokenAddress);
  };
  
  /**
   * Checks if a token needs approval for the router
   * @param {string} tokenAddress - Token address
   * @param {string} amount - Amount to approve (in wei)
   * @returns {Promise<boolean>} Whether approval is needed
   */
  const needsApproval = async (tokenAddress, amount) => {
    try {
      const tokenContract = getTokenContract(tokenAddress);
      const signerAddress = await signer.getAddress();
      const currentAllowance = await tokenContract.allowance(signerAddress, routerAddress);
      
      return currentAllowance.lt(amount);
    } catch (error) {
      console.error(`Error checking allowance for ${tokenAddress}:`, error);
      throw error;
    }
  };
  
  /**
   * Approves a token for the router
   * @param {string} tokenAddress - Token address
   * @param {string} amount - Amount to approve (in wei)
   * @returns {Promise<ethers.ContractTransaction>} Approval transaction
   */
  const approveToken = async (tokenAddress, amount) => {
    try {
      const tokenContract = getTokenContract(tokenAddress);
      
      // Get token symbol for logging
      const symbol = await tokenContract.symbol();
      
      // Check if approval is needed
      const requiresApproval = await needsApproval(tokenAddress, amount);
      if (!requiresApproval) {
        console.log(`${symbol} already approved for Router`);
        return null;
      }
      
      // Ask for approval if callback is provided
      if (onApprovalNeeded) {
        const shouldApprove = await onApprovalNeeded(symbol);
        if (!shouldApprove) {
          throw new Error(`User declined to approve ${symbol}`);
        }
      }
      
      // Max uint256 for unlimited approval
      const MAX_UINT256 = ethers.constants.MaxUint256;
      
      // Estimate gas for approve
      const gasEstimate = await tokenContract.estimateGas.approve(routerAddress, MAX_UINT256);
      
      // Send approval transaction
      const tx = await tokenContract.approve(routerAddress, MAX_UINT256, {
        gasLimit: gasEstimate.mul(120).div(100) // Add 20% buffer
      });
      
      // Call transaction callback if provided
      if (onTransaction) {
        onTransaction({
          type: 'approval',
          hash: tx.hash,
          token: {
            address: tokenAddress,
            symbol
          }
        });
      }
      
      // Wait for confirmation
      await tx.wait(1);
      
      console.log(`Approved ${symbol} for Router`);
      return tx;
    } catch (error) {
      console.error(`Error approving ${tokenAddress}:`, error);
      throw error;
    }
  };
  
  /**
   * Gets or creates a trading pair for two tokens
   * @param {string} token0Address - First token address
   * @param {string} token1Address - Second token address
   * @returns {Promise<string>} Pair address
   */
  const getOrCreatePair = async (token0Address, token1Address) => {
    try {
      console.log(`Getting or creating pair for tokens: ${token0Address}, ${token1Address}`);
      
      // Get factory contract
      const factoryContract = new ethers.Contract(
        factoryAddress,
        FACTORY_ABI,
        signer
      );
      
      // Check if pair already exists - Double check with a direct call to the contract
      const existingPair = await factoryContract.getPair(token0Address, token1Address);
      
      // If pair exists and is not zero address, return it
      if (existingPair && existingPair !== ethers.constants.AddressZero) {
        // Double check that the pair is valid by trying to interact with it
        try {
          const pairAbi = ["function token0() view returns (address)", "function token1() view returns (address)"];
          const pairContract = new ethers.Contract(existingPair, pairAbi, provider);
          
          // Try to call a method on the pair to verify it exists
          const [verifyToken0, verifyToken1] = await Promise.all([
            pairContract.token0(),
            pairContract.token1()
          ]);
          
          // Try to get token symbols for better output
          try {
            const token0Contract = new ethers.Contract(verifyToken0, ERC20_ABI, provider);
            const token1Contract = new ethers.Contract(verifyToken1, ERC20_ABI, provider);
            const symbol0 = await token0Contract.symbol();
            const symbol1 = await token1Contract.symbol();
            console.log(`✓ Using existing ${symbol0}/${symbol1} pool at ${existingPair}`);
          } catch (e) {
            console.log(`✓ Using existing pool at ${existingPair}`);
          }
          
          return existingPair;
        } catch (verifyError) {
          // If verification fails, we'll create a new pair
          console.log('Creating new pair...');
        }
      } else {
        console.log('Creating new pair...');
      }
      
      // Get token symbols for better logging
      try {
        const token0Contract = new ethers.Contract(token0Address, ERC20_ABI, provider);
        const token1Contract = new ethers.Contract(token1Address, ERC20_ABI, provider);
        const symbol0 = await token0Contract.symbol();
        const symbol1 = await token1Contract.symbol();
        console.log(`Creating ${symbol0}/${symbol1} pool...`);
      } catch (e) {
        console.log('Creating new pool...');
      }
      
      // Use fixed gas limit approach
      console.log('Sending createPair transaction...');
      const tx = await factoryContract.createPair(token0Address, token1Address, {
        gasLimit: 3000000, // High fixed gas limit
        type: 2, // EIP-1559 transaction
        maxFeePerGas: ethers.utils.parseUnits("1.5", "gwei"),
        maxPriorityFeePerGas: ethers.utils.parseUnits("1", "gwei")
      });
      
      console.log(`Transaction sent: ${tx.hash}`);
      console.log('Waiting for confirmation...');
      
      const receipt = await tx.wait(1);
      console.log('Transaction confirmed');
      
      // Handle success case
      const pairAddress = await extractPairAddress(receipt, factoryContract, token0Address, token1Address);
      console.log(`✓ New pool created at ${pairAddress}`);
      return pairAddress;
    } catch (error) {
      console.error('Error creating pair:', error.message);
      throw error;
    }
  };
  
  /**
   * Helper function to extract the pair address from a transaction receipt
   * @param {Object} receipt - Transaction receipt
   * @param {ethers.Contract} factoryContract - Factory contract
   * @param {string} token0Address - First token address
   * @param {string} token1Address - Second token address
   * @returns {Promise<string>} Pair address
   */
  const extractPairAddress = async (receipt, factoryContract, token0Address, token1Address) => {
    // Get the pair address from the event logs
    let pairAddress;
    for (const log of receipt.logs) {
      try {
        if (log.topics[0] === ethers.utils.id('PairCreated(address,address,address,uint256)')) {
          const parsedLog = FACTORY_INTERFACE.parseLog(log);
          pairAddress = parsedLog.args.pair;
          break;
        }
      } catch (e) {
        // Silently continue if we can't parse this log
      }
    }
    
    if (!pairAddress) {
      // If we couldn't extract from logs, query the factory
      pairAddress = await factoryContract.getPair(token0Address, token1Address);
      
      if (pairAddress === ethers.constants.AddressZero) {
        throw new Error('Failed to find created pair address');
      }
    }
    
    return pairAddress;
  };
  
  /**
   * Adds liquidity to a pair
   * @param {string} token0Address - First token address
   * @param {string} token1Address - Second token address
   * @param {string} amount0 - Amount of first token (in wei)
   * @param {string} amount1 - Amount of second token (in wei)
   * @returns {Promise<Object>} Liquidity addition result
   */
  const addLiquidity = async (token0Address, token1Address, amount0, amount1) => {
    try {
      console.log(`Adding liquidity for tokens: ${token0Address}, ${token1Address}`);
      console.log(`Amounts: ${ethers.utils.formatEther(amount0)}, ${ethers.utils.formatEther(amount1)}`);
      
      // Create token contracts
      const token0Contract = new ethers.Contract(token0Address, ERC20_ABI, signer);
      const token1Contract = new ethers.Contract(token1Address, ERC20_ABI, signer);
      
      // Get token symbols for better logging
      const [symbol0, symbol1] = await Promise.all([
        token0Contract.symbol().catch(() => 'Token0'),
        token1Contract.symbol().catch(() => 'Token1')
      ]);
      
      console.log(`Token symbols: ${symbol0}, ${symbol1}`);
      
      // Check balances
      const userAddress = await signer.getAddress();
      
      const [balance0, balance1] = await Promise.all([
        token0Contract.balanceOf(userAddress),
        token1Contract.balanceOf(userAddress)
      ]);
      
      console.log(`User balances: ${ethers.utils.formatEther(balance0)} ${symbol0}, ${ethers.utils.formatEther(balance1)} ${symbol1}`);
      
      if (balance0.lt(amount0)) {
        const error = `Insufficient ${symbol0} balance. Have ${ethers.utils.formatEther(balance0)}, need ${ethers.utils.formatEther(amount0)}`;
        console.error(error);
        return { success: false, error };
      }
      
      if (balance1.lt(amount1)) {
        const error = `Insufficient ${symbol1} balance. Have ${ethers.utils.formatEther(balance1)}, need ${ethers.utils.formatEther(amount1)}`;
        console.error(error);
        return { success: false, error };
      }
      
      // Check allowances
      const router = new ethers.Contract(routerAddress, ROUTER_ABI, signer);
      
      const [allowance0, allowance1] = await Promise.all([
        token0Contract.allowance(userAddress, routerAddress),
        token1Contract.allowance(userAddress, routerAddress)
      ]);
      
      console.log(`Allowances: ${ethers.utils.formatEther(allowance0)} ${symbol0}, ${ethers.utils.formatEther(allowance1)} ${symbol1}`);
      
      // Approve tokens if needed
      if (allowance0.lt(amount0)) {
        console.log(`Approving ${symbol0}...`);
        if (typeof onApprovalNeeded === 'function') {
          const shouldApprove = await onApprovalNeeded(symbol0);
          if (!shouldApprove) {
            return { success: false, error: `${symbol0} approval declined` };
          }
        }
        
        const approveTx = await token0Contract.approve(routerAddress, ethers.constants.MaxUint256);
        console.log(`${symbol0} approval transaction hash: ${approveTx.hash}`);
        
        if (typeof onTransaction === 'function') {
          onTransaction({
            type: 'approval',
            token: { symbol: symbol0 },
            hash: approveTx.hash
          });
        }
        
        await approveTx.wait(1);
        console.log(`${symbol0} approved`);
      }
      
      if (allowance1.lt(amount1)) {
        console.log(`Approving ${symbol1}...`);
        if (typeof onApprovalNeeded === 'function') {
          const shouldApprove = await onApprovalNeeded(symbol1);
          if (!shouldApprove) {
            return { success: false, error: `${symbol1} approval declined` };
          }
        }
        
        const approveTx = await token1Contract.approve(routerAddress, ethers.constants.MaxUint256);
        console.log(`${symbol1} approval transaction hash: ${approveTx.hash}`);
        
        if (typeof onTransaction === 'function') {
          onTransaction({
            type: 'approval',
            token: { symbol: symbol1 },
            hash: approveTx.hash
          });
        }
        
        await approveTx.wait(1);
        console.log(`${symbol1} approved`);
      }
      
      // Get current time for deadline
      const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      console.log(`Using deadline: ${deadline} (${new Date(deadline * 1000).toISOString()})`);
      
      // Add liquidity with hardcoded gas limit - no estimation
      console.log('Calling router.addLiquidity with fixed gas limit...');
      console.log('Parameters:', {
        tokenA: token0Address,
        tokenB: token1Address,
        amountADesired: amount0.toString(),
        amountBDesired: amount1.toString(),
        amountAMin: ethers.BigNumber.from(amount0).mul(95).div(100).toString(),
        amountBMin: ethers.BigNumber.from(amount1).mul(95).div(100).toString(),
        to: userAddress,
        deadline
      });
      
      // Use fixed gas limit approach instead of estimating
      const tx = await router.addLiquidity(
        token0Address,
        token1Address,
        amount0,
        amount1,
        ethers.BigNumber.from(amount0).mul(95).div(100), // 5% slippage
        ethers.BigNumber.from(amount1).mul(95).div(100), // 5% slippage
        userAddress,
        deadline,
        { 
          gasLimit: 500000, // Fixed gas limit 
          type: 2, // EIP-1559
          maxFeePerGas: ethers.utils.parseUnits("1.5", "gwei"),
          maxPriorityFeePerGas: ethers.utils.parseUnits("1", "gwei")
        }
      );
      
      console.log(`AddLiquidity transaction hash: ${tx.hash}`);
      
      if (typeof onTransaction === 'function') {
        onTransaction({
          type: 'addLiquidity',
          hash: tx.hash
        });
      }
      
      console.log('Waiting for transaction confirmation...');
      const receipt = await tx.wait(1);
      console.log('Transaction confirmed, receipt:', receipt.transactionHash);
      
      return { success: true };
    } catch (error) {
      console.error('Error in addLiquidity:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        reason: error.reason
      });
      
      if (error.transaction) {
        console.error('Transaction hash:', error.transaction.hash);
      }
      
      console.error('Stack trace:', error.stack);
      return { 
        success: false, 
        error: error.message,
        details: {
          reason: error.reason || "Unknown error",
          code: error.code,
          data: error.data
        }
      };
    }
  };
  
  /**
   * Creates liquidity pools from a configuration file
   * @param {string} configPath - Path to the config file
   * @returns {Promise<Object>} Results of pool creation
   */
  const createPoolsFromConfig = async (configPath) => {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (!config.proposalAddress) {
        return { success: false, error: 'Missing proposal address in config' };
      }
      
      // Get token addresses from the proposal contract
      const proposalContract = new ethers.Contract(
        config.proposalAddress,
        [
          "function numOutcomes() view returns (uint256)",
          "function wrappedOutcome(uint256) view returns (address)"
        ],
        provider
      );
      
      const numOutcomes = await proposalContract.numOutcomes();
      const outcomeTokens = [];
      
      for (let i = 0; i < numOutcomes.toNumber(); i++) {
        const tokenAddress = await proposalContract.wrappedOutcome(i);
        const tokenContract = new ethers.Contract(
          tokenAddress,
          ["function symbol() view returns (string)"],
          provider
        );
        
        try {
          const symbol = await tokenContract.symbol();
          outcomeTokens.push({
            index: i,
            address: tokenAddress,
            symbol
          });
        } catch (e) {
          // If symbol() call fails, use a generic name
          outcomeTokens.push({
            index: i,
            address: tokenAddress,
            symbol: `Outcome ${i}`
          });
        }
      }
      
      // Get WXDAI address
      const wxdaiAddress = process.env.WXDAI_ADDRESS;
      if (!wxdaiAddress) {
        return { success: false, error: 'Missing WXDAI_ADDRESS in environment' };
      }
      
      // Get WXDAI contract
      const wxdaiContract = new ethers.Contract(
        wxdaiAddress,
        ["function symbol() view returns (string)"],
        provider
      );
      const wxdaiSymbol = await wxdaiContract.symbol();
      
      // Check if we're using the pooled or distributed approach for WXDAI
      const usePoolSpecificAmounts = config.liquidity.wxdaiAmountsPerPool && 
                                   config.liquidity.wxdaiAmountsPerPool.length === outcomeTokens.length;
      
      // Get liquidity amounts
      const wxdaiTotalAmount = config.liquidity.wxdaiAmount;
      // Calculate per-pool WXDAI amount if we're not using pool-specific amounts
      const wxdaiPerPoolAmount = !usePoolSpecificAmounts 
        ? ethers.BigNumber.from(wxdaiTotalAmount).div(outcomeTokens.length).toString()
        : null;
      
      // Call onPoolCreation with all pools info if provided
      if (typeof onPoolCreation === 'function') {
        const shouldCreateAllPools = await onPoolCreation('ALL POOLS', 'ALL OUTCOME TOKENS');
        if (!shouldCreateAllPools) {
          return { success: false, error: 'User cancelled pool creation' };
        }
      }
      
      // Create pools for each outcome token
      const results = [];
      
      for (let i = 0; i < outcomeTokens.length; i++) {
        const token = outcomeTokens[i];
        
        // Get token amount from config if available
        let tokenAmount;
        if (config.liquidity.outcomeTokenAmounts && config.liquidity.outcomeTokenAmounts[i]) {
          tokenAmount = config.liquidity.outcomeTokenAmounts[i];
        } else if (i < 2) {
          // First two tokens are YES_TOKEN1, NO_TOKEN1
          tokenAmount = config.liquidity.token1Amount;
        } else {
          // Next tokens are YES_TOKEN2, NO_TOKEN2
          tokenAmount = config.liquidity.token2Amount;
        }
        
        // Get WXDAI amount for this specific pool
        const wxdaiAmount = usePoolSpecificAmounts 
          ? config.liquidity.wxdaiAmountsPerPool[i] 
          : wxdaiPerPoolAmount;
        
        // Call onPoolCreation if provided for this specific pool
        if (typeof onPoolCreation === 'function' && token.symbol !== 'ALL POOLS') {
          const shouldCreatePool = await onPoolCreation(wxdaiSymbol, token.symbol);
          if (!shouldCreatePool) {
            results.push({
              success: false,
              error: 'User cancelled pool creation',
              token0: { symbol: wxdaiSymbol },
              token1: token
            });
            continue;
          }
        }
        
        // Call onLiquidityAdded if provided
        if (typeof onLiquidityAdded === 'function') {
          const shouldAddLiquidity = await onLiquidityAdded(
            wxdaiSymbol,
            ethers.utils.formatEther(wxdaiAmount),
            token.symbol,
            ethers.utils.formatEther(tokenAmount)
          );
          
          if (!shouldAddLiquidity) {
            results.push({
              success: false,
              error: 'User cancelled liquidity addition',
              token0: { symbol: wxdaiSymbol },
              token1: token
            });
            continue;
          }
        }
        
        // Create the pair and add liquidity
        try {
          console.log(`Processing pool: WXDAI <> ${token.symbol}`);
          
          // First get or create the pair
          const pairAddress = await getOrCreatePair(wxdaiAddress, token.address);
          
          // Then add liquidity
          const liquidityResult = await addLiquidity(wxdaiAddress, token.address, wxdaiAmount, tokenAmount);
          
          if (liquidityResult.success) {
            console.log(`✓ Successfully added liquidity to WXDAI/${token.symbol} pool`);
            results.push({
              success: true,
              pairAddress,
              token0: { address: wxdaiAddress, symbol: wxdaiSymbol },
              token1: token
            });
          } else {
            // Don't log as error, just log the issue and continue
            if (liquidityResult.error && liquidityResult.error.includes("Insufficient")) {
              console.log(`ℹ Couldn't add liquidity: ${liquidityResult.error}`);
            } else {
              console.log(`ℹ Failed to add liquidity: ${liquidityResult.error}`);
            }
            
            results.push({
              success: false,
              error: liquidityResult.error,
              token0: { address: wxdaiAddress, symbol: wxdaiSymbol },
              token1: token
            });
          }
        } catch (error) {
          // Don't log as error, just report the issue and continue with other pools
          console.log(`ℹ Error with ${token.symbol} pool: ${error.message}`);
          results.push({
            success: false,
            error: error.message,
            token0: { address: wxdaiAddress, symbol: wxdaiSymbol },
            token1: token
          });
        }
      }
      
      const overallSuccess = results.some(r => r.success);
      return {
        success: overallSuccess,
        results
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };
  
  /**
   * Gets token info for a given address
   * @param {string} tokenAddress - Token address
   * @returns {Promise<Object>} Token info
   */
  const getTokenInfo = async (tokenAddress) => {
    try {
      const tokenContract = getTokenContract(tokenAddress);
      
      const [name, symbol, decimals, balance] = await Promise.all([
        tokenContract.name(),
        tokenContract.symbol(),
        tokenContract.decimals(),
        tokenContract.balanceOf(await signer.getAddress())
      ]);
      
      return {
        address: tokenAddress,
        name,
        symbol,
        decimals,
        balance: ethers.utils.formatUnits(balance, decimals)
      };
    } catch (error) {
      console.error(`Error getting token info for ${tokenAddress}:`, error);
      throw error;
    }
  };
  
  /**
   * Gets pair info for two tokens
   * @param {string} token0Address - First token address
   * @param {string} token1Address - Second token address
   * @returns {Promise<Object>} Pair info
   */
  const getPairInfo = async (token0Address, token1Address) => {
    try {
      const pairAddress = await factory.getPair(token0Address, token1Address);
      
      if (pairAddress === ethers.constants.AddressZero) {
        return {
          exists: false,
          address: null
        };
      }
      
      const token0 = await getTokenInfo(token0Address);
      const token1 = await getTokenInfo(token1Address);
      
      return {
        exists: true,
        address: pairAddress,
        token0,
        token1
      };
    } catch (error) {
      console.error(`Error getting pair info:`, error);
      throw error;
    }
  };
  
  /**
   * Gets all pools for a proposal
   * @param {string} proposalAddress - Proposal address
   * @returns {Promise<Object>} Pools info
   */
  const getProposalPools = async (proposalAddress) => {
    try {
      // Create proposal contract
      const proposalContract = new ethers.Contract(
        proposalAddress,
        PROPOSAL_ABI,
        provider
      );
      
      // Get proposal details
      const [name, encodedQuestion, numOutcomes] = await Promise.all([
        proposalContract.marketName(),
        proposalContract.encodedQuestion(),
        proposalContract.numOutcomes()
      ]);
      
      // Parse encoded question if needed
      let question = encodedQuestion;
      if (encodedQuestion.includes('␟')) {
        const parts = encodedQuestion.split('␟');
        question = parts[0]; // Use the title part as the question
      }
      
      // Get outcome tokens
      const outcomeTokens = [];
      for (let i = 0; i < numOutcomes.toNumber(); i++) {
        const tokenAddress = await proposalContract.wrappedOutcome(i);
        const tokenInfo = await getTokenInfo(tokenAddress);
        
        outcomeTokens.push({
          index: i,
          ...tokenInfo
        });
      }
      
      // Get pools
      const pools = [];
      for (const token of outcomeTokens) {
        const pairInfo = await getPairInfo(wxdaiAddress, token.address);
        pools.push(pairInfo);
      }
      
      return {
        proposalAddress,
        name,
        question,
        outcomeTokens,
        pools
      };
    } catch (error) {
      console.error(`Error getting proposal pools:`, error);
      throw error;
    }
  };
  
  // Return public interface
  return {
    // Check whether a token is approved for spending
    needsApproval,
    
    // Approve a token for spending
    approveToken,
    
    // Create or get a pair for two tokens
    getOrCreatePair,
    
    // Add liquidity to a pair
    addLiquidity,
    
    // Create pools from a configuration file
    createPoolsFromConfig,
    
    // Get token information
    getTokenInfo,
    
    // Get pair information
    getPairInfo,
    
    // Get all pools for a proposal
    getProposalPools,
    
    // Get contract instances
    getContracts: () => ({
      router,
      factory
    }),
    
    // Helper method to get token contract at a given address
    getTokenContract
  };
}

/**
 * Creates a default liquidity provider with console logging
 * @param {Object} options - Provider and signer
 * @returns {Object} Liquidity provider interface
 */
export function createDefaultLiquidityProvider({ provider, signer }) {
  return createLiquidityProvider({
    provider,
    signer,
    onApprovalNeeded: (symbol) => {
      console.log(`Approval needed for ${symbol}`);
      return true; // Always approve
    },
    onPoolCreation: (token0Symbol, token1Symbol) => {
      console.log(`Creating pool for ${token0Symbol}/${token1Symbol}`);
      return true; // Always create
    },
    onLiquidityAdded: (token0Symbol, amount0, token1Symbol, amount1) => {
      console.log(`Adding ${amount0} ${token0Symbol} and ${amount1} ${token1Symbol} to pool`);
      return true; // Always add
    },
    onTransaction: (txInfo) => {
      console.log(`Transaction: ${txInfo.type} - ${txInfo.hash}`);
    }
  });
}

/**
 * Helper function to format transaction URL for Gnosis Chain
 * @param {string} txHash - Transaction hash
 * @returns {string} Explorer URL
 */
export function getExplorerUrl(txHash) {
  return `https://gnosisscan.io/tx/${txHash}`;
}

/**
 * Helper function to format address URL for Gnosis Chain
 * @param {string} address - Ethereum address
 * @returns {string} Explorer URL
 */
export function getAddressExplorerUrl(address) {
  return `https://gnosisscan.io/address/${address}`;
}

/**
 * Helper function to validate token amounts against balance
 * @param {string} tokenAddress - Token address
 * @param {string} amount - Amount to validate (in wei)
 * @param {ethers.Signer} signer - Signer to check balance for
 * @returns {Promise<boolean>} Whether the amount is valid
 */
export async function validateTokenAmount(tokenAddress, amount, signer) {
  const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer.provider);
  const balance = await tokenContract.balanceOf(await signer.getAddress());
  return balance.gte(amount);
} 