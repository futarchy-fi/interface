import { useState, useCallback, useEffect } from 'react';
import { 
  getProposalData, 
  getProposalDisplayInfo, 
  validateProposalContract,
  isValidProposalAddress 
} from '../utils/proposalUtils';

/**
 * React hook for managing proposal data
 * Provides dynamic proposal switching and contract data reading
 */
export function useProposal(defaultProposalAddress = null) {
  // State
  const [proposalAddress, setProposalAddress] = useState(defaultProposalAddress);
  const [proposalData, setProposalData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isValid, setIsValid] = useState(false);

  // Load proposal data
  const loadProposal = useCallback(async (address) => {
    if (!address || !isValidProposalAddress(address)) {
      setError('Invalid proposal address');
      setIsValid(false);
      setProposalData(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Validate contract first
      await validateProposalContract(address);
      
      // Load proposal data
      const data = await getProposalData(address);
      
      setProposalData(data);
      setIsValid(true);
      setProposalAddress(address);
      
    } catch (err) {
      console.error('Error loading proposal:', err);
      setError(err.message);
      setIsValid(false);
      setProposalData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Change proposal address
  const changeProposal = useCallback(async (newAddress) => {
    if (newAddress !== proposalAddress) {
      await loadProposal(newAddress);
    }
  }, [proposalAddress, loadProposal]);

  // Get display info for current proposal
  const getDisplayInfo = useCallback(async () => {
    if (!proposalAddress || !isValid) return null;
    
    try {
      return await getProposalDisplayInfo(proposalAddress);
    } catch (err) {
      console.error('Error getting display info:', err);
      return null;
    }
  }, [proposalAddress, isValid]);

  // Load initial proposal if provided
  useEffect(() => {
    if (defaultProposalAddress) {
      loadProposal(defaultProposalAddress);
    }
  }, [defaultProposalAddress, loadProposal]);

  // Helper getters
  const getTokens = useCallback(() => {
    return proposalData?.tokens || {};
  }, [proposalData]);

  const getPoolAddresses = useCallback(() => {
    return proposalData?.poolAddresses || [];
  }, [proposalData]);

  const getMarketName = useCallback(() => {
    return proposalData?.marketName || 'Unknown Market';
  }, [proposalData]);

  const getConditionId = useCallback(() => {
    return proposalData?.conditionId || null;
  }, [proposalData]);

  const getOpeningTime = useCallback(() => {
    return proposalData?.openingTime || null;
  }, [proposalData]);

  const getOpeningTimeInfo = useCallback(() => {
    const openingTime = proposalData?.openingTime;
    if (!openingTime) return null;
    
    const openingDate = new Date(openingTime * 1000); // Convert Unix timestamp to Date
    const now = new Date();
    const timeUntilOpening = openingTime * 1000 - now.getTime(); // Milliseconds until opening
    
    return {
      timestamp: openingTime,
      date: openingDate,
      utcString: openingDate.toUTCString(),
      localString: openingDate.toLocaleString(),
      timeUntilOpening, // Milliseconds (negative if already opened)
      isOpen: timeUntilOpening <= 0,
      daysUntilOpening: Math.ceil(timeUntilOpening / (1000 * 60 * 60 * 24)),
      hoursUntilOpening: Math.ceil(timeUntilOpening / (1000 * 60 * 60)),
      minutesUntilOpening: Math.ceil(timeUntilOpening / (1000 * 60))
    };
  }, [proposalData]);

  // Check if proposal has all required data
  const isComplete = useCallback(() => {
    if (!proposalData) return false;
    
    const tokens = proposalData.tokens;
    return (
      tokens.companyToken &&
      tokens.currencyToken &&
      tokens.yesCompanyToken &&
      tokens.noCompanyToken &&
      tokens.yesCurrencyToken &&
      tokens.noCurrencyToken
    );
  }, [proposalData]);

  return {
    // State
    proposalAddress,
    proposalData,
    loading,
    error,
    isValid,
    
    // Actions
    loadProposal,
    changeProposal,
    getDisplayInfo,
    
    // Getters
    getTokens,
    getPoolAddresses,
    getMarketName,
    getConditionId,
    getOpeningTime,
    getOpeningTimeInfo,
    isComplete,
    
    // Computed values
    hasData: !!proposalData,
    hasError: !!error,
    isLoading: loading,
    isReady: isValid && proposalData && isComplete()
  };
} 