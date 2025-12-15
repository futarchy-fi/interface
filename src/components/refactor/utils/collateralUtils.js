import { ethers } from 'ethers';
import { ERC20_ABI, FUTARCHY_ROUTER_ABI } from '../abis';
import { 
  FUTARCHY_ROUTER_ADDRESS,
  MARKET_ADDRESS,
  BASE_CURRENCY_TOKEN_ADDRESS,
  BASE_COMPANY_TOKEN_ADDRESS,
  BASE_TOKENS_CONFIG
} from '../constants/addresses';

// Get provider
export const getWeb3Provider = () => {
  if (!window.ethereum) {
    throw new Error('Please install MetaMask!');
  }
  return new ethers.providers.Web3Provider(window.ethereum);
};

// Get signer
export const getSigner = () => {
  const provider = getWeb3Provider();
  return provider.getSigner();
};

// Get token allowance
export const getTokenAllowance = async (tokenAddress, userAddress, spenderAddress) => {
  try {
    const provider = getWeb3Provider();
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const allowance = await tokenContract.allowance(userAddress, spenderAddress);
    return allowance;
  } catch (error) {
    console.error('Error getting token allowance:', error);
    throw error;
  }
};

// Approve token spending
export const approveToken = async (tokenAddress, spenderAddress, amount) => {
  try {
    const signer = getSigner();
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
    
    const tx = await tokenContract.approve(spenderAddress, amount);
    await tx.wait();
    return tx;
  } catch (error) {
    console.error('Error approving token:', error);
    throw error;
  }
};

// Check if approval is needed
export const isApprovalNeeded = async (tokenAddress, userAddress, spenderAddress, amount) => {
  try {
    const allowance = await getTokenAllowance(tokenAddress, userAddress, spenderAddress);
    return allowance.lt(amount);
  } catch (error) {
    console.error('Error checking approval:', error);
    return true; // Default to needing approval if check fails
  }
};

// Add collateral (split position)
export const addCollateral = async (tokenType, amount, proposalAddress, tokenAddress) => {
  try {
    const signer = getSigner();
    const routerContract = new ethers.Contract(FUTARCHY_ROUTER_ADDRESS, FUTARCHY_ROUTER_ABI, signer);
    
    if (!proposalAddress || !tokenAddress) {
      throw new Error('Proposal address and token address are required');
    }
    
    // Convert amount to wei
    const amountWei = ethers.utils.parseUnits(amount.toString(), 18);
    
    const tx = await routerContract.splitPosition(
      proposalAddress,
      tokenAddress,
      amountWei
    );
    
    await tx.wait();
    return tx;
  } catch (error) {
    console.error('Error adding collateral:', error);
    throw error;
  }
};

// Remove collateral (merge positions)
export const removeCollateral = async (tokenType, amount, proposalAddress, tokenAddress) => {
  try {
    const signer = getSigner();
    const routerContract = new ethers.Contract(FUTARCHY_ROUTER_ADDRESS, FUTARCHY_ROUTER_ABI, signer);
    
    if (!proposalAddress || !tokenAddress) {
      throw new Error('Proposal address and token address are required');
    }
    
    // Convert amount to wei
    const amountWei = ethers.utils.parseUnits(amount.toString(), 18);
    
    const tx = await routerContract.mergePositions(
      proposalAddress,
      tokenAddress,
      amountWei
    );
    
    await tx.wait();
    return tx;
  } catch (error) {
    console.error('Error removing collateral:', error);
    throw error;
  }
};

// Get token balance
export const getTokenBalance = async (tokenAddress, userAddress) => {
  try {
    const provider = getWeb3Provider();
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const balance = await tokenContract.balanceOf(userAddress);
    return ethers.utils.formatUnits(balance, 18);
  } catch (error) {
    console.error('Error getting token balance:', error);
    throw error;
  }
};

// Get collateral information
export const getCollateralInfo = (currencyToken = null, companyToken = null) => {
  // Fallback to defaults if no tokens provided (for backwards compatibility)
  return {
    currency: currencyToken || {
      address: null,
      symbol: 'CURRENCY',
      name: 'Currency Token',
      decimals: 18
    },
    company: companyToken || {
      address: null,
      symbol: 'COMPANY',
      name: 'Company Token',
      decimals: 18
    }
  };
};

// Estimate gas for operations
export const estimateGasForSplit = async (tokenType, amount, proposalAddress, tokenAddress) => {
  try {
    const provider = getWeb3Provider();
    const routerContract = new ethers.Contract(FUTARCHY_ROUTER_ADDRESS, FUTARCHY_ROUTER_ABI, provider);
    
    if (!proposalAddress || !tokenAddress) {
      throw new Error('Proposal address and token address are required');
    }
    
    const amountWei = ethers.utils.parseUnits(amount.toString(), 18);
    
    const gasEstimate = await routerContract.estimateGas.splitPosition(
      proposalAddress,
      tokenAddress,
      amountWei
    );
    
    return gasEstimate;
  } catch (error) {
    console.error('Error estimating gas for split:', error);
    // Return a default gas estimate if estimation fails
    return ethers.BigNumber.from('200000');
  }
};

export const estimateGasForMerge = async (tokenType, amount, proposalAddress, tokenAddress) => {
  try {
    const provider = getWeb3Provider();
    const routerContract = new ethers.Contract(FUTARCHY_ROUTER_ADDRESS, FUTARCHY_ROUTER_ABI, provider);
    
    if (!proposalAddress || !tokenAddress) {
      throw new Error('Proposal address and token address are required');
    }
    
    const amountWei = ethers.utils.parseUnits(amount.toString(), 18);
    
    const gasEstimate = await routerContract.estimateGas.mergePositions(
      proposalAddress,
      tokenAddress,
      amountWei
    );
    
    return gasEstimate;
  } catch (error) {
    console.error('Error estimating gas for merge:', error);
    // Return a default gas estimate if estimation fails
    return ethers.BigNumber.from('200000');
  }
};

// Format error messages
export const formatError = (error) => {
  if (error.code === 4001 || error.code === "ACTION_REJECTED") {
    return "Transaction rejected by user";
  }
  if (error.message.includes("insufficient funds")) {
    return "Insufficient funds for transaction";
  }
  if (error.message.includes("User denied")) {
    return "Transaction rejected by user";
  }
  return error.message || "Unknown error occurred";
}; 