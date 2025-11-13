import React, { createContext, useContext, useState, useEffect } from 'react';
import { useProposal } from '../hooks/useProposal';

/**
 * Global Proposal Context for Futarchy Refactor Module
 * Provides proposal data to all components, replacing hardcoded constants
 */
const ProposalContext = createContext();

// Default proposal address (can be overridden)
const DEFAULT_PROPOSAL_ADDRESS = '0xDA36a35CA4Fe6214C37a452159C0C9EAd45D5919';

export function ProposalProvider({ children, defaultProposalAddress = DEFAULT_PROPOSAL_ADDRESS }) {
  // Use the proposal hook for all proposal management
  const proposal = useProposal(defaultProposalAddress);
  
  // Additional state for global module configuration
  const [moduleTitle, setModuleTitle] = useState('Futarchy Refactor Module');
  const [moduleDescription, setModuleDescription] = useState('Self-contained components with strategy-based system');
  
  // Local loading state for proposal changes (separate from initial load)
  const [isChangingProposal, setIsChangingProposal] = useState(false);

  // Update module title when proposal data loads
  useEffect(() => {
    if (proposal.isReady) {
      setModuleTitle(`${proposal.getMarketName()} - Futarchy Module`);
      setModuleDescription(`Dynamic module for proposal: ${proposal.proposalAddress.slice(0, 6)}...${proposal.proposalAddress.slice(-4)}`);
    } else {
      setModuleTitle('Futarchy Refactor Module');
      setModuleDescription('Self-contained components with strategy-based system');
    }
  }, [proposal.isReady, proposal.proposalAddress, proposal.getMarketName]);

  // Enhanced changeProposal function that manages loading state properly
  const changeProposal = async (newAddress) => {
    setIsChangingProposal(true);
    try {
      await proposal.changeProposal(newAddress);
      return true;
    } catch (error) {
      throw error;
    } finally {
      setIsChangingProposal(false);
    }
  };

  // Provide comprehensive proposal data and utilities
  const contextValue = {
    // Core proposal data
    ...proposal,
    
    // Override loading state to include proposal changing
    isLoading: () => proposal.isLoading || isChangingProposal,
    
    // Override change proposal with enhanced loading management
    changeProposal,
    
    // Module configuration
    moduleTitle,
    moduleDescription,
    setModuleTitle,
    setModuleDescription,
    
    // Token utilities for components
    getTokenAddress: (tokenType) => {
      const tokens = proposal.getTokens();
      const mapping = {
        'company': tokens.companyToken,
        'currency': tokens.currencyToken,
        'baseCurrency': tokens.currencyToken, // Alias
        'baseCompany': tokens.companyToken,   // Alias
        'yesCompany': tokens.yesCompanyToken,
        'noCompany': tokens.noCompanyToken,
        'yesCurrency': tokens.yesCurrencyToken,
        'noCurrency': tokens.noCurrencyToken,
        'currencyYes': tokens.yesCurrencyToken, // Alias
        'currencyNo': tokens.noCurrencyToken,   // Alias
        'companyYes': tokens.yesCompanyToken,   // Alias
        'companyNo': tokens.noCompanyToken      // Alias
      };
      return mapping[tokenType] || null;
    },
    
    // Get all token addresses as an object (for compatibility with existing code)
    getTokenAddresses: () => {
      const tokens = proposal.getTokens();
      return {
        BASE_CURRENCY_TOKEN_ADDRESS: tokens.currencyToken,
        BASE_COMPANY_TOKEN_ADDRESS: tokens.companyToken,
        CURRENCY_YES_TOKEN_ADDRESS: tokens.yesCurrencyToken,
        CURRENCY_NO_TOKEN_ADDRESS: tokens.noCurrencyToken,
        COMPANY_YES_TOKEN_ADDRESS: tokens.yesCompanyToken,
        COMPANY_NO_TOKEN_ADDRESS: tokens.noCompanyToken,
        // Additional mappings for backward compatibility
        baseCurrency: tokens.currencyToken,
        baseCompany: tokens.companyToken,
        currencyYes: tokens.yesCurrencyToken,
        currencyNo: tokens.noCurrencyToken,
        companyYes: tokens.yesCompanyToken,
        companyNo: tokens.noCompanyToken
      };
    },
    
    // Token metadata helpers
    getTokenMetadata: () => {
      if (!proposal.isReady) return {};
      
      const tokens = proposal.getTokens();
      return {
        baseCurrency: {
          symbol: 'CURRENCY', // Could be enhanced to read from ERC20
          name: 'Currency Token',
          address: tokens.currencyToken
        },
        baseCompany: {
          symbol: 'COMPANY', // Could be enhanced to read from ERC20
          name: 'Company Token', 
          address: tokens.companyToken
        },
        currencyYes: {
          symbol: 'YES_CURRENCY',
          name: 'YES Currency Token',
          address: tokens.yesCurrencyToken
        },
        currencyNo: {
          symbol: 'NO_CURRENCY',
          name: 'NO Currency Token',
          address: tokens.noCurrencyToken
        },
        companyYes: {
          symbol: 'YES_COMPANY',
          name: 'YES Company Token',
          address: tokens.yesCompanyToken
        },
        companyNo: {
          symbol: 'NO_COMPANY',
          name: 'NO Company Token',
          address: tokens.noCompanyToken
        }
      };
    },
    
    // Check if specific token types are available
    hasBaseTokens: () => {
      const tokens = proposal.getTokens();
      return !!(tokens.companyToken && tokens.currencyToken);
    },
    
    hasOutcomeTokens: () => {
      const tokens = proposal.getTokens();
      return !!(tokens.yesCompanyToken && tokens.noCompanyToken && 
               tokens.yesCurrencyToken && tokens.noCurrencyToken);
    },
    
    // Status helpers
    isProposalReady: () => proposal.isReady,
    hasError: () => proposal.hasError,
    getErrorMessage: () => proposal.error,
    
    // Additional status
    isChangingProposal: () => isChangingProposal,
    
    // Display helpers
    getDisplayInfo: () => ({
      marketName: proposal.getMarketName(),
      proposalAddress: proposal.proposalAddress,
      shortAddress: proposal.proposalAddress ? 
        `${proposal.proposalAddress.slice(0, 6)}...${proposal.proposalAddress.slice(-4)}` : 
        'No proposal loaded',
      conditionId: proposal.getConditionId()
    }),
    
    // Opening time helpers
    getOpeningTime: () => proposal.getOpeningTime(),
    getOpeningTimeInfo: () => proposal.getOpeningTimeInfo(),
    
    // Check if proposal is open for voting
    isOpenForVoting: () => {
      const timeInfo = proposal.getOpeningTimeInfo();
      return timeInfo ? timeInfo.isOpen : false;
    }
  };

  return (
    <ProposalContext.Provider value={contextValue}>
      {children}
    </ProposalContext.Provider>
  );
}

// Custom hook to use the proposal context
export function useProposalContext() {
  const context = useContext(ProposalContext);
  if (!context) {
    throw new Error('useProposalContext must be used within a ProposalProvider');
  }
  return context;
}

// Helper hook for components that need to wait for proposal data
export function useProposalReady() {
  const context = useProposalContext();
  return {
    isReady: context.isProposalReady(),
    isLoading: context.isLoading(),
    hasError: context.hasError(),
    error: context.getErrorMessage(),
    proposal: context
  };
}

export default ProposalContext; 