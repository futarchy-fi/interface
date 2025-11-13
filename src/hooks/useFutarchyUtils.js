import { ethers } from "ethers";
import { ERC20_ABI } from "../components/futarchyFi/marketPage/constants/contracts";

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

export const handleSwapError = (err, { setError, setLoading, onError }) => {
  console.error('Swap failed:', err);
  setError?.(err);
  setLoading?.(false);
  onError?.(err);
  throw err;
};

export const checkTokenBalance = async (tokenAddress, amount, userAddress, provider) => {
  const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  const balance = await tokenContract.balanceOf(userAddress);
  
  if (balance.lt(amount)) {
    throw new Error(`Insufficient balance. Have: ${ethers.utils.formatUnits(balance, 18)}`);
  }
  return balance;
};

export const handleTokenApproval = async (tokenAddress, spenderAddress, amount, signer) => {
  const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
  const allowance = await tokenContract.allowance(await signer.getAddress(), spenderAddress);
  
  if (allowance.lt(amount)) {
    const tx = await tokenContract.approve(spenderAddress, ethers.constants.MaxUint256);
    await tx.wait();
    return true;
  }
  return false;
};

export const getProviderAndSigner = () => {
  if (!window.ethereum) {
    throw new Error("No ethereum provider found");
  }
  const provider = new ethers.providers.Web3Provider(window.ethereum);
  const signer = provider.getSigner();
  return { provider, signer };
};

export const calculatePositionInfo = (yesAmount, noAmount) => {
  const yes = parseFloat(yesAmount);
  const no = parseFloat(noAmount);
  
  return {
    total: yes + no,
    netPosition: yes - no
  };
};

export const formatTokenAmount = (amount, decimals = 18) => {
  try {
    if (!amount) return { amount: "0", formatted: "0" };
    
    const bigNumberAmount = ethers.BigNumber.from(amount);
    return {
      amount: bigNumberAmount.toString(),
      formatted: ethers.utils.formatUnits(bigNumberAmount, decimals)
    };
  } catch (err) {
    console.error('Error formatting token amount:', err);
    return { amount: "0", formatted: "0" };
  }
};

export const parseTokenAmount = (amount, decimals = 18) => {
  try {
    return ethers.utils.parseUnits(amount.toString(), decimals);
  } catch (err) {
    console.error('Error parsing token amount:', err);
    return ethers.BigNumber.from(0);
  }
};

export const validateTokenAmount = (amount, balance, decimals = 18) => {
  try {
    // Convert amount to BigNumber using parseUnits to handle decimals
    const parsedAmount = ethers.utils.parseUnits(amount.toString(), decimals);
    const parsedBalance = ethers.utils.parseUnits(balance.toString(), decimals);
    
    if (parsedAmount.lte(0)) {
      return { isValid: false, error: "Amount must be greater than 0" };
    }
    
    if (parsedAmount.gt(parsedBalance)) {
      return { isValid: false, error: "Insufficient balance" };
    }
    
    return { isValid: true, error: null };
  } catch (err) {
    console.error('Error validating token amount:', err);
    return { isValid: false, error: "Invalid amount" };
  }
};

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

export const estimateGas = async (contract, method, args, value = 0) => {
  try {
    const gasEstimate = await contract.estimateGas[method](...args, { value });
    // Add 20% buffer to gas estimate
    return gasEstimate.mul(120).div(100);
  } catch (err) {
    console.error('Error estimating gas:', err);
    throw err;
  }
};

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

export const validateSwapInput = (amount) => {
  if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
    throw new Error('Invalid amount');
  }
}; 