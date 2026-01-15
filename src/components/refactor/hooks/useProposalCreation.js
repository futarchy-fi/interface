import { useState } from 'react';
import { ethers } from 'ethers';
import { useAccount, useWalletClient } from 'wagmi';
import { useProposalContext } from '../context/ProposalContext';
import { FUTARCHY_FACTORY_ADDRESS, PROPOSAL_DEFAULTS, GNOSIS_CHAIN_ID } from '../constants/addresses';
import { FUTARCHY_FACTORY_ABI } from '../constants/abis';

export const useProposalCreation = () => {
  const { address: userAddress, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { changeProposal } = useProposalContext();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);
  const [transactionHash, setTransactionHash] = useState(null);
  const [createdProposalAddress, setCreatedProposalAddress] = useState(null);

  // Get default form data
  const getDefaultFormData = () => {
    const threeMontrhsInSeconds = PROPOSAL_DEFAULTS.OPENING_TIME_MONTHS * 30 * 24 * 60 * 60;
    const defaultOpeningTime = Math.floor(Date.now() / 1000) + threeMontrhsInSeconds;
    const defaultDate = new Date(defaultOpeningTime * 1000);
    const localDateTimeString = defaultDate.toISOString().slice(0, 16);
    
    return {
      factoryAddress: FUTARCHY_FACTORY_ADDRESS,
      marketName: '',
      companyToken: PROPOSAL_DEFAULTS.COMPANY_TOKEN,
      currencyToken: PROPOSAL_DEFAULTS.CURRENCY_TOKEN,
      category: PROPOSAL_DEFAULTS.CATEGORY,
      language: PROPOSAL_DEFAULTS.LANGUAGE,
      minBond: PROPOSAL_DEFAULTS.MIN_BOND,
      openingTime: localDateTimeString
    };
  };

  // Validation function
  const validateFormData = (formData) => {
    const { marketName, companyToken, currencyToken, factoryAddress, openingTime } = formData;
    
    if (!marketName.trim()) {
      return { isValid: false, error: 'Market name is required' };
    }
    
    if (!ethers.utils.isAddress(companyToken)) {
      return { isValid: false, error: 'Invalid company token address' };
    }
    
    if (!ethers.utils.isAddress(currencyToken)) {
      return { isValid: false, error: 'Invalid currency token address' };
    }
    
    if (!ethers.utils.isAddress(factoryAddress)) {
      return { isValid: false, error: 'Invalid factory address' };
    }
    
    if (!openingTime) {
      return { isValid: false, error: 'Opening time is required' };
    }
    
    return { isValid: true };
  };

  // Main creation function
  const createProposal = async (formData) => {
    // Validate form data
    const validation = validateFormData(formData);
    if (!validation.isValid) {
      setSubmitStatus({ type: 'error', message: validation.error });
      return { success: false, error: validation.error };
    }
    
    setIsSubmitting(true);
    setSubmitStatus(null);
    setTransactionHash(null);
    setCreatedProposalAddress(null);
    
    try {
      // Check wallet connection
      if (!isConnected || !userAddress) {
        const error = 'No wallet connection found. Please connect your wallet.';
        setSubmitStatus({ type: 'error', message: error });
        return { success: false, error };
      }

      // Get provider and signer
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = await provider.getSigner();

      setSubmitStatus({ type: 'info', message: 'Preparing transaction...' });

      // Create factory contract
      const factory = new ethers.Contract(formData.factoryAddress, FUTARCHY_FACTORY_ABI, signer);
      
      // Convert opening time to unix timestamp
      const openingTimeUnix = Math.floor(new Date(formData.openingTime).getTime() / 1000);
      
      // Prepare the proposal parameters
      const params = [
        formData.marketName,
        formData.companyToken,
        formData.currencyToken,
        formData.category,
        formData.language,
        formData.minBond,
        openingTimeUnix
      ];
      
      console.log('Creating proposal with params:', params);
      
      // Call the createProposal function
      const tx = await factory.createProposal(params);
      setTransactionHash(tx.hash);
      setSubmitStatus({ 
        type: 'info', 
        message: `Transaction submitted! Hash: ${tx.hash}` 
      });
      
      // Wait for confirmation
      const receipt = await tx.wait();
      
      // Get the new proposal address
      const count = await factory.marketsCount();
      if (count.toString() === '0') {
        throw new Error('Failed to get the proposal address');
      }
      
      const proposalIndex = count.sub(1);
      const newProposalAddress = await factory.proposals(proposalIndex);
      setCreatedProposalAddress(newProposalAddress);
      
      setSubmitStatus({ 
        type: 'success', 
        message: `Proposal created successfully! Address: ${newProposalAddress}` 
      });
      
      return { 
        success: true, 
        proposalAddress: newProposalAddress, 
        transactionHash: tx.hash 
      };
      
    } catch (error) {
      console.error('Error creating proposal:', error);
      let errorMessage = 'Failed to create proposal: ';
      
      if (error.code === 'ACTION_REJECTED') {
        errorMessage += 'Transaction was rejected by user';
      } else if (error.reason) {
        errorMessage += error.reason;
      } else if (error.message) {
        errorMessage += error.message;
      } else {
        errorMessage += 'Unknown error occurred';
      }
      
      setSubmitStatus({ type: 'error', message: errorMessage });
      return { success: false, error: errorMessage };
    } finally {
      setIsSubmitting(false);
    }
  };

  // Switch to created proposal
  const switchToCreatedProposal = async () => {
    if (!createdProposalAddress) {
      throw new Error('No proposal address available to switch to');
    }
    
    try {
      setSubmitStatus({ type: 'info', message: 'Switching to new proposal...' });
      await changeProposal(createdProposalAddress);
      setSubmitStatus({ 
        type: 'success', 
        message: 'Successfully switched to new proposal! All components now use the new proposal data.' 
      });
      return { success: true };
    } catch (error) {
      const errorMessage = `Failed to switch to new proposal: ${error.message}`;
      setSubmitStatus({ type: 'error', message: errorMessage });
      return { success: false, error: errorMessage };
    }
  };

  // Reset function
  const resetCreation = () => {
    setIsSubmitting(false);
    setSubmitStatus(null);
    setTransactionHash(null);
    setCreatedProposalAddress(null);
  };

  return {
    // State
    isSubmitting,
    submitStatus,
    transactionHash,
    createdProposalAddress,
    
    // Wallet connection state
    isConnected,
    userAddress,
    
    // Functions
    getDefaultFormData,
    validateFormData,
    createProposal,
    switchToCreatedProposal,
    resetCreation
  };
}; 