import { ethers } from "ethers";
// Import from our local wrapper instead of the original contracts file
import { ERC20_ABI } from "./contractWrapper.js";

/**
 * Creates a status manager for tracking and reporting operation status
 * @param {Function} onStatus - Callback function for status updates
 * @returns {Object} Status manager object
 */
export const createStatusManager = (onStatus) => ({
  update: (message, data = {}) => {
    console.log(message, data);
    onStatus?.(message);
  },
  error: (message, error) => {
    console.error(message, error);
    onStatus?.(`Error: ${error.message}`);
  }
});

/**
 * Handles swap errors consistently
 * @param {Error} err - The error object
 * @param {Object} options - Error handling options
 */
export const handleSwapError = (err, { setError, setLoading, onError }) => {
  console.error('Swap failed:', err);
  setError?.(err);
  setLoading?.(false);
  onError?.(err);
  throw err;
};

/**
 * Checks if a user has sufficient token balance
 * @param {string} tokenAddress - Token contract address
 * @param {BigNumber} amount - Amount to check
 * @param {string} userAddress - User's wallet address
 * @param {Provider} provider - Ethereum provider
 * @returns {Promise<BigNumber>} Current balance
 */
export const checkTokenBalance = async (tokenAddress, amount, userAddress, provider) => {
  const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  const balance = await tokenContract.balanceOf(userAddress);
  
  // Get token decimals for proper formatting of the error message
  let decimals;
  try {
    decimals = await tokenContract.decimals();
  } catch (err) {
    decimals = 18; // Fallback only for the error message formatting
    console.warn("Failed to get token decimals, using 18 for error message only:", err);
  }
  
  if (balance.lt(amount)) {
    throw new Error(`Insufficient balance. Have: ${ethers.utils.formatUnits(balance, decimals)}`);
  }
  return balance;
};

/**
 * Handles token approval process with proper gas settings
 * @param {string} tokenAddress - Token contract address
 * @param {string} spenderAddress - Address to approve
 * @param {BigNumber} amount - Amount to approve
 * @param {Signer} signer - Ethers signer
 * @param {Object} callbacks - Callback functions
 * @returns {Promise<Object>} Approval result
 */
export const handleTokenApproval = async (tokenAddress, spenderAddress, amount, signer, callbacks = {}) => {
  const userAddress = await signer.getAddress();
  const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
  const allowance = await tokenContract.allowance(userAddress, spenderAddress);
  
  if (allowance.lt(amount)) {
    console.log(`Approving token ${tokenAddress} for ${spenderAddress}`);
    
    // If previous allowance exists but is insufficient, reset it to 0 first
    // This is a security measure for certain ERC20 tokens
    if (allowance.gt(0)) {
      console.log(`Resetting previous token allowance from ${allowance.toString()}`);
      const resetTx = await tokenContract.approve(spenderAddress, 0, {
        gasLimit: 100000,
        type: 2,
        maxFeePerGas: ethers.utils.parseUnits("1.5", "gwei"),
        maxPriorityFeePerGas: ethers.utils.parseUnits("1", "gwei")
      });
      await resetTx.wait();
    }
    
    // Create approval transaction with MaxUint256 for unlimited approval
    const approveTx = await tokenContract.approve(
      spenderAddress,
      ethers.constants.MaxUint256, // Approve max amount to save gas on future transactions
      { 
        gasLimit: 100000,
        type: 2,
        maxFeePerGas: ethers.utils.parseUnits("1.5", "gwei"),
        maxPriorityFeePerGas: ethers.utils.parseUnits("1", "gwei")
      }
    );
    
    // Send approval transaction to callback
    callbacks.onApprove?.(approveTx);
    
    // Wait for approval to be confirmed
    const receipt = await approveTx.wait();
    console.log(`Token approval confirmed in tx: ${receipt.transactionHash}`);
    
    return {
      didApprove: true,
      tx: approveTx,
      receipt
    };
  }
  
  console.log(`Token already approved with allowance: ${allowance.toString()}`);
  return {
    didApprove: false,
    tx: null,
    receipt: null
  };
};

/**
 * Gets provider and signer from window.ethereum
 * @returns {Object} Provider and signer objects
 */
export const getProviderAndSigner = () => {
  // Check if we're in a browser environment
  const isBrowser = typeof window !== 'undefined';
  
  if (!isBrowser) {
    throw new Error("Cannot get default provider/signer in Node.js environment. Please provide custom provider/signer.");
  }
  
  if (!window.ethereum) {
    throw new Error("No ethereum provider found");
  }
  
  const provider = new ethers.providers.Web3Provider(window.ethereum);
  const signer = provider.getSigner();
  return { provider, signer };
};

/**
 * Calculates position information from yes and no amounts
 * @param {string} yesAmount - YES token amount
 * @param {string} noAmount - NO token amount
 * @returns {Object} Position information
 */
export const calculatePositionInfo = (yesAmount, noAmount) => {
  const yes = parseFloat(yesAmount);
  const no = parseFloat(noAmount);
  
  return {
    total: yes + no,
    netPosition: yes - no
  };
};

/**
 * Formats a token amount from BigNumber to human-readable string
 * @param {BigNumber|string} amount - Raw amount (BigNumber or string)
 * @param {number} decimals - Token decimals (required)
 * @returns {string} Formatted amount
 */
export const formatTokenAmount = (amount, decimals) => {
  try {
    // Require decimals to be specified, no default
    if (decimals === null || decimals === undefined) {
      throw new Error('Token decimals must be specified');
    }
    
    if (!amount) return '0';
    
    // Convert to BigNumber if it's not already
    const amountBN = ethers.BigNumber.isBigNumber(amount) 
      ? amount 
      : ethers.BigNumber.from(amount);
    
    return ethers.utils.formatUnits(amountBN, decimals);
  } catch (err) {
    console.error('Error formatting token amount:', err);
    return '0';
  }
};

/**
 * Parses a human-readable token amount to BigNumber
 * @param {string|number} amount - Human-readable amount
 * @param {number} decimals - Token decimals (required)
 * @returns {BigNumber} Parsed amount
 */
export const parseTokenAmount = (amount, decimals) => {
  if (decimals === undefined) {
    console.error('Decimals not specified in parseTokenAmount');
    throw new Error('Decimals must be specified in parseTokenAmount');
  }

  try {
    // Handle empty or null values
    if (!amount || amount === '0' || amount === 0) {
      return ethers.BigNumber.from('0');
    }

    // Convert any amount to a proper string representation
    let amountStr = amount.toString();
    
    // Parse the amount with ethers, which handles the decimal places correctly
    return ethers.utils.parseUnits(amountStr, decimals);
  } catch (error) {
    // Log the error with useful debugging information
    console.error(`Error parsing token amount: ${amount} with decimals: ${decimals}`, error);
    throw error; // Re-throw to allow proper error handling
  }
};

/**
 * Validates if a token amount is valid and sufficient
 * @param {string|number} amount - Amount to validate
 * @param {string|number} balance - Available balance
 * @param {number} decimals - Token decimals (required)
 * @returns {Object} Validation result
 */
export const validateTokenAmount = (amount, balance, decimals) => {
  try {
    // Require decimals to be specified, no default
    if (decimals === null || decimals === undefined) {
      throw new Error('Token decimals must be specified');
    }
    
    if (!amount || amount === '0' || parseFloat(amount) <= 0) {
      return { 
        isValid: false, 
        error: 'Amount must be greater than 0' 
      };
    }
    
    const amountValue = parseFloat(amount);
    const balanceValue = parseFloat(balance);
    
    if (isNaN(amountValue)) {
      return { 
        isValid: false, 
        error: 'Invalid amount format' 
      };
    }
    
    if (amountValue > balanceValue) {
      return { 
        isValid: false, 
        error: `Insufficient balance. Have: ${balance}` 
      };
    }
    
    return { isValid: true, error: null };
  } catch (err) {
    console.error('Error validating token amount:', err);
    return { isValid: false, error: err.message };
  }
};

/**
 * Gets the status of a transaction
 * @param {Provider} provider - Ethereum provider
 * @param {string} txHash - Transaction hash
 * @returns {Promise<Object>} Transaction status
 */
export const getTransactionStatus = async (provider, txHash) => {
  try {
    const tx = await provider.getTransaction(txHash);
    if (!tx) return { status: "pending", confirmations: 0 };
    
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) return { status: "pending", confirmations: tx.confirmations };
    
    return {
      status: receipt.status === 1 ? "success" : "failed",
      confirmations: tx.confirmations,
      receipt
    };
  } catch (err) {
    console.error('Error getting transaction status:', err);
    return { status: "error", error: err.message };
  }
};

/**
 * Estimates gas for a contract method call
 * @param {Contract} contract - Ethers contract
 * @param {string} method - Method name
 * @param {Array} args - Method arguments
 * @param {number|string} value - ETH value to send
 * @returns {Promise<BigNumber>} Gas estimate with buffer
 */
export const estimateGas = async (contract, method, args, value = 0) => {
  try {
    if (!contract || !contract.estimateGas || !contract.estimateGas[method]) {
      console.error(`Invalid contract or method: ${method}`);
      // Return a generous default gas limit if we can't estimate
      return ethers.BigNumber.from("500000");
    }
    
    const gasEstimate = await contract.estimateGas[method](...args, { value });
    // Add 20% buffer to gas estimate
    return gasEstimate.mul(120).div(100);
  } catch (err) {
    console.error('Error estimating gas:', err);
    // Return a default gas limit if estimation fails
    return ethers.BigNumber.from("500000");
  }
};

/**
 * Handles transaction errors with user-friendly messages
 * @param {Error} error - Transaction error
 * @returns {string} User-friendly error message
 */
export const handleTransactionError = (error) => {
  if (error.code === 4001) {
    return "Transaction rejected by user";
  }
  
  if (error.code === -32603) {
    if (error.message.includes("insufficient funds")) {
      return "Insufficient funds for gas";
    }
  }
  
  return error.message || "Transaction failed";
};

/**
 * Validates swap input amount
 * @param {string|number} amount - Amount to validate
 */
export const validateSwapInput = (amount) => {
  if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
    throw new Error('Invalid amount');
  }
};

/**
 * Gets the decimals for an ERC-20 token from its contract
 * @param {string} tokenAddress - Token contract address
 * @param {ethers.providers.Provider} provider - Ethereum provider
 * @returns {Promise<number>} Number of decimals
 */
export const getTokenDecimals = async (tokenAddress, provider) => {
  try {
    const tokenAbi = [
      "function decimals() view returns (uint8)"
    ];
    
    const tokenContract = new ethers.Contract(tokenAddress, tokenAbi, provider);
    const decimals = await tokenContract.decimals();
    
    return parseInt(decimals.toString(), 10);
  } catch (error) {
    console.error(`Error getting decimals for token ${tokenAddress}:`, error);
    throw new Error(`Could not determine decimals for token ${tokenAddress}`);
  }
};

/**
 * Gets the symbol for an ERC-20 token from its contract
 * @param {string} tokenAddress - Token contract address
 * @param {ethers.providers.Provider} provider - Ethereum provider
 * @returns {Promise<string>} Token symbol
 */
export const getTokenSymbol = async (tokenAddress, provider) => {
  try {
    const tokenAbi = [
      "function symbol() view returns (string)"
    ];
    
    const tokenContract = new ethers.Contract(tokenAddress, tokenAbi, provider);
    return await tokenContract.symbol();
  } catch (error) {
    console.warn(`Error getting symbol for token ${tokenAddress}:`, error);
    return 'TOKEN'; // Fall back to generic name if the call fails
  }
};

/**
 * Retrieves token information (addresses and symbols) directly from the market contract
 * @param {string} marketAddress - The address of the market contract
 * @param {Object} provider - Ethers provider instance
 * @param {number} companyTokenSlot - The slot (0 or 1) where the company token is stored (0=collateralToken1, 1=collateralToken2)
 * @returns {Promise<Object>} Object containing token addresses and symbols
 */
export const getTokenInfoFromMarket = async (marketAddress, provider, companyTokenSlot = 0) => {
  try {
    // Market contract minimal ABI to get collateral tokens
    const marketAbi = [
      "function collateralToken1() view returns (address)",
      "function collateralToken2() view returns (address)"
    ];
    
    // ERC20 ABI for symbol (using function signature)
    const erc20Abi = [
      "function symbol() view returns (string)"
    ];
    
    const marketContract = new ethers.Contract(marketAddress, marketAbi, provider);
    
    // Get both collateral token addresses
    const collateralToken1 = await marketContract.collateralToken1();
    const collateralToken2 = await marketContract.collateralToken2();
    
    // Determine which token is company and which is currency based on companyTokenSlot
    const companyTokenAddress = companyTokenSlot === 0 ? collateralToken1 : collateralToken2;
    const currencyTokenAddress = companyTokenSlot === 0 ? collateralToken2 : collateralToken1;
    
    // Create contracts for both tokens to get their symbols
    const companyTokenContract = new ethers.Contract(companyTokenAddress, erc20Abi, provider);
    const currencyTokenContract = new ethers.Contract(currencyTokenAddress, erc20Abi, provider);
    
    // Get token symbols
    const companySymbol = await companyTokenContract.symbol();
    const currencySymbol = await currencyTokenContract.symbol();
    
    return {
      company: {
        address: companyTokenAddress,
        symbol: companySymbol
      },
      currency: {
        address: currencyTokenAddress,
        symbol: currencySymbol
      }
    };
  } catch (error) {
    console.error("Error getting token info from market:", error);
    throw error;
  }
}; 