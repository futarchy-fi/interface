import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { getWeb3Provider } from '../utils/poolUtils';
import { ERC20_ABI } from '../abis';

// Contract addresses from algebra-cli.js
const POSITION_MGR = '0x91fd594c46d8b01e62dbdebed2401dde01817834';

// ABIs from algebra-cli.js  
const pmAbi = [
  'function factory() view returns (address)',
  'function createAndInitializePoolIfNecessary(address,address,uint160) returns (address)',
  'function mint((address token0,address token1,int24 tickLower,int24 tickUpper,uint256 amount0Desired,uint256 amount1Desired,uint256 amount0Min,uint256 amount1Min,address recipient,uint256 deadline)) returns (uint256,uint128,uint256,uint256)',
];

// Tick spacing utils from algebra-cli.js
const getTickSpacing = async (poolAddr, provider) => {
  try {
    return await new ethers.Contract(poolAddr, ['function tickSpacing() view returns (int24)'], provider).tickSpacing();
  } catch { 
    return 60; // default for Swapr
  }
};

const align = (tick, spacing, dir) => dir === 'down'
  ? Math.floor(tick / Number(spacing)) * Number(spacing)
  : Math.ceil(tick / Number(spacing)) * Number(spacing);

/**
 * Hook for handling pool creation workflow
 * Manages approvals, pool creation, and liquidity provision
 */
export function usePoolCreation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [steps, setSteps] = useState([]);

  // Check if user has sufficient balance
  const checkBalance = useCallback(async (tokenContract, userAddress, requiredAmount, tokenSymbol, decimals) => {
    const balance = await tokenContract.balanceOf(userAddress);
    if (balance.lt(requiredAmount)) {
      const requiredFormatted = ethers.utils.formatUnits(requiredAmount, decimals);
      const balanceFormatted = ethers.utils.formatUnits(balance, decimals);
      throw new Error(`Insufficient ${tokenSymbol} balance. Need ${requiredFormatted}, have ${balanceFormatted}`);
    }
    return balance;
  }, []);

  // Check and handle token approval
  const ensureApproval = useCallback(async (tokenContract, userAddress, spender, requiredAmount, tokenSymbol) => {
    const currentAllowance = await tokenContract.allowance(userAddress, spender);
    
    if (currentAllowance.lt(requiredAmount)) {
      // Need to approve
      const approveTx = await tokenContract.approve(spender, ethers.constants.MaxUint256);
      await approveTx.wait();
      return approveTx;
    }
    
    return null; // No approval needed
  }, []);

  // Calculate sqrtPriceX96 correctly (from algebra-cli.js)
  const sqrtEncode = useCallback((numerator, denominator) => {
    // EXACT copy of algebra-cli.js sqrtEncode function
    const n = Number(numerator);
    const d = Number(denominator);
    
    console.log(`sqrtEncode: n=${n}, d=${d}`);
    
    const result = BigInt(Math.floor(Math.sqrt(n / d) * Math.pow(2, 96)));
    
    console.log(`sqrtEncode result (BigInt): ${result.toString()}`);
    
    return ethers.BigNumber.from(result.toString());
  }, []);

  // Determine correct token ordering for Algebra
  const getTokenOrdering = useCallback((token0Address, token1Address, amount0, amount1) => {
    const addr0 = ethers.utils.getAddress(token0Address);
    const addr1 = ethers.utils.getAddress(token1Address);
    
    // Calculate intended price from user perspective
    const intendedPriceLogical = amount1.mul(ethers.BigNumber.from(10).pow(18)).div(amount0);
    
    if (addr0.toLowerCase() < addr1.toLowerCase()) {
      // Original order matches AMM order
      return {
        token0: addr0,
        token1: addr1,
        amount0Desired: amount0,
        amount1Desired: amount1,
        sqrtPriceX96: sqrtEncode(amount1, amount0)
      };
    } else {
      // Need to swap order for AMM
      return {
        token0: addr1,
        token1: addr0,
        amount0Desired: amount1,
        amount1Desired: amount0,
        sqrtPriceX96: sqrtEncode(amount0, amount1)
      };
    }
  }, [sqrtEncode]);

  // Get pool address by pair (from algebra-cli.js)
  const poolByPair = useCallback(async (provider, token0Addr, token1Addr) => {
    try {
      const pm = new ethers.Contract(POSITION_MGR, pmAbi, provider);
      const factoryAddr = await pm.factory();
      const factory = new ethers.Contract(factoryAddr, ['function poolByPair(address,address) view returns (address)'], provider);
      return await factory.poolByPair(token0Addr, token1Addr);
    } catch (error) {
      console.error('Error getting pool address:', error);
      return ethers.constants.AddressZero;
    }
  }, []);

  // Main pool creation function
  const createPool = useCallback(async ({ 
    token0Address, 
    token1Address, 
    token0Data, 
    token1Data, 
    amount0String, 
    amount1String,
    onStepUpdate 
  }) => {
    setLoading(true);
    setError(null);
    
    const currentSteps = [];
    
    try {
      const provider = getWeb3Provider();
      const signer = provider.getSigner();
      const userAddress = await signer.getAddress();
      
      // Parse amounts
      const amount0 = ethers.utils.parseUnits(amount0String, token0Data.decimals);
      const amount1 = ethers.utils.parseUnits(amount1String, token1Data.decimals);
      
      console.log(`Creating pool with amounts: ${amount0String} ${token0Data.symbol}, ${amount1String} ${token1Data.symbol}`);
      console.log(`Parsed amounts: ${amount0.toString()} (${token0Data.symbol}), ${amount1.toString()} (${token1Data.symbol})`);
      
      // Step 1: Check balances
      currentSteps.push({ id: 1, description: 'Checking token balances...', status: 'pending' });
      setSteps([...currentSteps]);
      onStepUpdate?.(currentSteps);
      
      const token0Contract = new ethers.Contract(token0Address, ERC20_ABI, signer);
      const token1Contract = new ethers.Contract(token1Address, ERC20_ABI, signer);
      
      await checkBalance(token0Contract, userAddress, amount0, token0Data.symbol, token0Data.decimals);
      await checkBalance(token1Contract, userAddress, amount1, token1Data.symbol, token1Data.decimals);
      
      currentSteps[0].status = 'completed';
      setSteps([...currentSteps]);
      onStepUpdate?.(currentSteps);
      
      // Step 2: Handle token0 approval
      currentSteps.push({ id: 2, description: `Checking ${token0Data.symbol} approval...`, status: 'pending' });
      setSteps([...currentSteps]);
      onStepUpdate?.(currentSteps);
      
      const approval0Needed = await token0Contract.allowance(userAddress, POSITION_MGR);
      if (approval0Needed.lt(amount0)) {
        currentSteps[1].description = `Approving ${token0Data.symbol}...`;
        setSteps([...currentSteps]);
        onStepUpdate?.(currentSteps);
        
        await ensureApproval(token0Contract, userAddress, POSITION_MGR, amount0, token0Data.symbol);
      }
      
      currentSteps[1].status = 'completed';
      setSteps([...currentSteps]);
      onStepUpdate?.(currentSteps);
      
      // Step 3: Handle token1 approval  
      currentSteps.push({ id: 3, description: `Checking ${token1Data.symbol} approval...`, status: 'pending' });
      setSteps([...currentSteps]);
      onStepUpdate?.(currentSteps);
      
      const approval1Needed = await token1Contract.allowance(userAddress, POSITION_MGR);
      if (approval1Needed.lt(amount1)) {
        currentSteps[2].description = `Approving ${token1Data.symbol}...`;
        setSteps([...currentSteps]);
        onStepUpdate?.(currentSteps);
        
        await ensureApproval(token1Contract, userAddress, POSITION_MGR, amount1, token1Data.symbol);
      }
      
      currentSteps[2].status = 'completed';
      setSteps([...currentSteps]);
      onStepUpdate?.(currentSteps);
      
      // Step 4: Create pool and add liquidity
      currentSteps.push({ id: 4, description: 'Creating pool and adding liquidity...', status: 'pending' });
      setSteps([...currentSteps]);
      onStepUpdate?.(currentSteps);
      
      // Get correct token ordering
      const poolParams = getTokenOrdering(token0Address, token1Address, amount0, amount1);
      
      console.log('Pool parameters:', {
        token0: poolParams.token0,
        token1: poolParams.token1,
        amount0Desired: poolParams.amount0Desired.toString(),
        amount1Desired: poolParams.amount1Desired.toString(),
        sqrtPriceX96: poolParams.sqrtPriceX96.toString()
      });
      
      // Create position manager contract
      const pm = new ethers.Contract(POSITION_MGR, pmAbi, signer);
      
      // Create pool if needed
      console.log('Creating/initializing pool...');
      const createTx = await pm.createAndInitializePoolIfNecessary(
        poolParams.token0,
        poolParams.token1,
        poolParams.sqrtPriceX96,
        { gasLimit: 15000000 }
      );
      console.log('Pool creation transaction hash:', createTx.hash);
      const createReceipt = await createTx.wait();
      console.log('Pool creation confirmed:', createReceipt.status === 1 ? 'SUCCESS' : 'FAILED');
      
      // Get the actual pool address
      const poolAddress = await poolByPair(provider, token0Address, token1Address);
      console.log('Pool address:', poolAddress);
      
      if (poolAddress === ethers.constants.AddressZero) {
        throw new Error('Pool was not created successfully - address is still zero');
      }
      
      // Get tick spacing for proper tick alignment
      const spacing = await getTickSpacing(poolAddress, provider);
      console.log('Tick spacing:', spacing);
      
      // Mint liquidity position with properly aligned ticks
      const mintParams = {
        token0: poolParams.token0,
        token1: poolParams.token1,
        tickLower: align(-887272, spacing, 'up'),   // Properly aligned
        tickUpper: align(887272, spacing, 'down'),  // Properly aligned
        amount0Desired: poolParams.amount0Desired,
        amount1Desired: poolParams.amount1Desired,
        amount0Min: 0, // Accept any amount due to slippage
        amount1Min: 0, // Accept any amount due to slippage
        recipient: userAddress,
        deadline: Math.floor(Date.now() / 1000) + 1200 // 20 minutes
      };
      
      console.log('Minting liquidity with params:', {
        ...mintParams,
        amount0Desired: mintParams.amount0Desired.toString(),
        amount1Desired: mintParams.amount1Desired.toString()
      });
      
      const mintTx = await pm.mint(mintParams, { gasLimit: 15000000 });
      console.log('Mint transaction hash:', mintTx.hash);
      const mintReceipt = await mintTx.wait();
      console.log('Mint transaction confirmed:', mintReceipt.status === 1 ? 'SUCCESS' : 'FAILED');
      
      currentSteps[3].status = 'completed';
      currentSteps.push({ id: 5, description: 'Pool created successfully!', status: 'completed' });
      setSteps([...currentSteps]);
      onStepUpdate?.(currentSteps);
      
      return {
        success: true,
        createTxHash: createTx.hash,
        mintTxHash: mintTx.hash,
        poolAddress,
        poolParams,
        receipt: mintReceipt
      };
      
    } catch (err) {
      console.error('Pool creation error:', err);
      setError(err.message);
      
      // Mark current step as failed
      if (currentSteps.length > 0) {
        currentSteps[currentSteps.length - 1].status = 'failed';
        setSteps([...currentSteps]);
        onStepUpdate?.(currentSteps);
      }
      
      return {
        success: false,
        error: err.message
      };
    } finally {
      setLoading(false);
    }
  }, [checkBalance, ensureApproval, getTokenOrdering, poolByPair]);

  // Reset state
  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setSteps([]);
  }, []);

  return {
    // State
    loading,
    error,
    steps,
    
    // Actions
    createPool,
    reset,
    
    // Utilities
    checkBalance,
    ensureApproval,
    sqrtEncode,
    getTokenOrdering
  };
}

export default usePoolCreation; 