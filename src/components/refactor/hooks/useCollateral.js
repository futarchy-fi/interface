import { useState, useCallback, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { ethers } from 'ethers';
import {
  getWeb3Provider,
  getTokenBalance,
  isApprovalNeeded,
  approveToken,
  addCollateral,
  removeCollateral,
  getCollateralInfo,
  estimateGasForSplit,
  estimateGasForMerge
} from '../utils/collateralUtils';
import { 
  getTokenSymbol,
  getTokenName
} from '../utils/balanceUtils';
import { 
  FUTARCHY_ROUTER_ADDRESS
} from '../constants/addresses';
import { useProposalContext } from '../context/ProposalContext';
import { useProposalTokens } from './useProposalTokens';

export function useCollateral() {
  const { address: userAddress, isConnected } = useAccount();
  
  // Use global proposal context and enhanced token system
  const proposal = useProposalContext();
  const proposalTokens = useProposalTokens();
  
  // State for current operation
  const [currentStep, setCurrentStep] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [txHash, setTxHash] = useState(null);

  // State for token metadata - now dynamically fetched
  const [tokenMetadata, setTokenMetadata] = useState({
    currency: { symbol: 'CURRENCY', name: 'Currency Token', address: null },
    company: { symbol: 'COMPANY', name: 'Company Token', address: null }
  });
  const [metadataLoading, setMetadataLoading] = useState(false);

  // Operation steps
  const STEPS = {
    CHECKING_BALANCE: 'Checking balance...',
    CHECKING_APPROVAL: 'Checking approval...',
    APPROVING: 'Approving tokens...',
    CONFIRMING_APPROVAL: 'Confirming approval...',
    EXECUTING: 'Executing transaction...',
    CONFIRMING: 'Confirming transaction...',
    COMPLETED: 'Transaction completed!',
  };

  // Fetch token metadata dynamically from proposal context
  useEffect(() => {
    const fetchTokenMetadata = async () => {
      if (!proposal.isProposalReady() || !proposalTokens.isReady) {
        // Reset to defaults if no proposal
        setTokenMetadata({
          currency: { symbol: 'CURRENCY', name: 'Currency Token', address: null },
          company: { symbol: 'COMPANY', name: 'Company Token', address: null }
        });
        return;
      }

      setMetadataLoading(true);
      try {
        // Get token addresses from proposal context
        const currencyTokenInfo = proposalTokens.getTokenInfoByType('currencyToken') || 
                                 proposalTokens.getTokenInfoByType('baseCurrency');
        const companyTokenInfo = proposalTokens.getTokenInfoByType('companyToken') ||
                                proposalTokens.getTokenInfoByType('baseCompany');

        if (currencyTokenInfo && companyTokenInfo) {
          setTokenMetadata({
            currency: {
              symbol: currencyTokenInfo.symbol,
              name: currencyTokenInfo.name,
              address: currencyTokenInfo.address
            },
            company: {
              symbol: companyTokenInfo.symbol,
              name: companyTokenInfo.name,
              address: companyTokenInfo.address
            }
          });
        } else {
          // Try to fetch from contract if enhanced tokens not available
          const tokens = proposal.getTokens();
          if (tokens?.currencyToken && tokens?.companyToken) {
        const [
          currencySymbol,
          currencyName,
          companySymbol,
          companyName
        ] = await Promise.all([
              getTokenSymbol(tokens.currencyToken),
              getTokenName(tokens.currencyToken),
              getTokenSymbol(tokens.companyToken),
              getTokenName(tokens.companyToken)
        ]);

        setTokenMetadata({
          currency: {
            symbol: currencySymbol,
            name: currencyName,
                address: tokens.currencyToken
          },
          company: {
            symbol: companySymbol,
            name: companyName,
                address: tokens.companyToken
              }
            });
          }
        }
      } catch (err) {
        console.error('Error fetching token metadata:', err);
        // Keep fallback values if fetch fails
      } finally {
        setMetadataLoading(false);
      }
    };

    fetchTokenMetadata();
  }, [proposal, proposalTokens, proposalTokens.isReady]);

  // Reset state
  const resetState = useCallback(() => {
    setCurrentStep(null);
    setLoading(false);
    setError(null);
    setSuccess(null);
    setTxHash(null);
  }, []);

  // Add collateral operation
  const handleAddCollateral = useCallback(async (tokenType, amount) => {
    if (!userAddress || !amount || amount <= 0) {
      setError('Invalid parameters');
      return false;
    }

    if (!proposal.isProposalReady()) {
      setError('No proposal loaded. Please load a proposal first.');
      return false;
    }

    try {
      resetState();
      setLoading(true);

      // Get token address from current proposal context
      const tokenAddress = tokenType === 'currency' ? tokenMetadata.currency.address : tokenMetadata.company.address;
      
      if (!tokenAddress) {
        throw new Error('Token address not found. Please ensure proposal is loaded.');
      }

      // Step 1: Check balance
      setCurrentStep(STEPS.CHECKING_BALANCE);
      const balance = await getTokenBalance(tokenAddress, userAddress);
      
      if (parseFloat(balance) < parseFloat(amount)) {
        throw new Error(`Insufficient balance. You have ${balance} tokens but tried to use ${amount}`);
      }

      // Step 2: Check approval
      setCurrentStep(STEPS.CHECKING_APPROVAL);
      const amountWei = ethers.utils.parseUnits(amount.toString(), 18);
      const needsApproval = await isApprovalNeeded(tokenAddress, userAddress, FUTARCHY_ROUTER_ADDRESS, amountWei);

      // Step 3: Approve if needed
      if (needsApproval) {
        setCurrentStep(STEPS.APPROVING);
        const approvalTx = await approveToken(tokenAddress, FUTARCHY_ROUTER_ADDRESS, amountWei);
        
        setCurrentStep(STEPS.CONFIRMING_APPROVAL);
        await approvalTx.wait();
      }

      // Step 4: Execute split position - now with dynamic proposal and token
      setCurrentStep(STEPS.EXECUTING);
      const proposalAddress = proposal.proposalAddress;
      const tx = await addCollateral(tokenType, amount, proposalAddress, tokenAddress);
      setTxHash(tx.hash);

      // Step 5: Wait for confirmation
      setCurrentStep(STEPS.CONFIRMING);
      await tx.wait();

      // Step 6: Success
      setCurrentStep(STEPS.COMPLETED);
      setSuccess(`Successfully added ${amount} ${tokenMetadata[tokenType]?.symbol || tokenType} collateral!`);
      
      return true;
    } catch (err) {
      console.error('Error adding collateral:', err);
      setError(err.message || 'Failed to add collateral');
      return false;
    } finally {
      setLoading(false);
    }
  }, [userAddress, resetState, tokenMetadata, proposal]);

  // Remove collateral operation
  const handleRemoveCollateral = useCallback(async (tokenType, amount) => {
    if (!userAddress || !amount || amount <= 0) {
      setError('Invalid parameters');
      return false;
    }

    if (!proposal.isProposalReady()) {
      setError('No proposal loaded. Please load a proposal first.');
      return false;
    }

    try {
      resetState();
      setLoading(true);

      // Get token address from current proposal context
      const tokenAddress = tokenType === 'currency' ? tokenMetadata.currency.address : tokenMetadata.company.address;
      
      if (!tokenAddress) {
        throw new Error('Token address not found. Please ensure proposal is loaded.');
      }

      // For removing collateral, we need to check YES/NO token balances
      // This is a simplified version - in reality you'd check position token balances
      setCurrentStep(STEPS.CHECKING_BALANCE);
      
      // Step 1: Execute merge positions directly (simplified) - now with dynamic proposal and token
      setCurrentStep(STEPS.EXECUTING);
      const proposalAddress = proposal.proposalAddress;
      const tx = await removeCollateral(tokenType, amount, proposalAddress, tokenAddress);
      setTxHash(tx.hash);

      // Step 2: Wait for confirmation
      setCurrentStep(STEPS.CONFIRMING);
      await tx.wait();

      // Step 3: Success
      setCurrentStep(STEPS.COMPLETED);
      setSuccess(`Successfully removed ${amount} ${tokenMetadata[tokenType]?.symbol || tokenType} collateral!`);
      
      return true;
    } catch (err) {
      console.error('Error removing collateral:', err);
      setError(err.message || 'Failed to remove collateral');
      return false;
    } finally {
      setLoading(false);
    }
  }, [userAddress, resetState, tokenMetadata, proposal]);

  // Get collateral balances - now using dynamic addresses
  const getBalances = useCallback(async () => {
    if (!userAddress || !tokenMetadata.currency.address || !tokenMetadata.company.address) {
      return { currency: '0', company: '0' };
    }

    try {
      const [currencyBalance, companyBalance] = await Promise.all([
        getTokenBalance(tokenMetadata.currency.address, userAddress),
        getTokenBalance(tokenMetadata.company.address, userAddress),
      ]);

      return {
        currency: currencyBalance,
        company: companyBalance,
      };
    } catch (err) {
      console.error('Error getting balances:', err);
      return { currency: '0', company: '0' };
    }
  }, [userAddress, tokenMetadata]);

  // Get gas estimates - now using dynamic addresses
  const getGasEstimate = useCallback(async (operation, tokenType, amount) => {
    if (!proposal.isProposalReady()) {
      return ethers.BigNumber.from('200000');
    }

    try {
      const tokenAddress = tokenType === 'currency' ? tokenMetadata.currency.address : tokenMetadata.company.address;
      const proposalAddress = proposal.proposalAddress;
      
      if (operation === 'add') {
        return await estimateGasForSplit(tokenType, amount, proposalAddress, tokenAddress);
      } else if (operation === 'remove') {
        return await estimateGasForMerge(tokenType, amount, proposalAddress, tokenAddress);
      }
      return ethers.BigNumber.from('200000');
    } catch (err) {
      console.error('Error estimating gas:', err);
      return ethers.BigNumber.from('200000');
    }
  }, [tokenMetadata, proposal]);

  return {
    // State
    currentStep,
    loading,
    error,
    success,
    txHash,
    isConnected,
    userAddress,
    metadataLoading: metadataLoading || proposalTokens.loading,

    // Actions
    handleAddCollateral,
    handleRemoveCollateral,
    resetState,
    getBalances,
    getGasEstimate,

    // Utils
    collateralInfo: tokenMetadata, // Now returns dynamic metadata from proposal context
    steps: STEPS,
  };
} 