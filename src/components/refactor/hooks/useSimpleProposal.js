import { useState, useEffect } from 'react';
import { useProposal } from './useProposal';

/**
 * Super Simple Proposal Hook
 * 
 * The easiest way to get proposal title and opening time.
 * Just pass a proposal address and get back the info you need!
 * 
 * Example:
 * const { title, openingTime, loading } = useSimpleProposal('0x...');
 */
export function useSimpleProposal(proposalAddress) {
  const proposal = useProposal(proposalAddress);
  
  // Simple state for easier access
  const [simpleData, setSimpleData] = useState({
    title: null,
    openingTime: null,
    isOpen: false,
    daysUntilOpening: null,
    loading: false,
    error: null
  });

  // Update simple data when proposal data changes
  useEffect(() => {
    if (proposal.loading) {
      setSimpleData(prev => ({ ...prev, loading: true, error: null }));
      return;
    }

    if (proposal.error) {
      setSimpleData(prev => ({ ...prev, loading: false, error: proposal.error }));
      return;
    }

    if (proposal.hasData) {
      const title = proposal.getMarketName();
      const openingInfo = proposal.getOpeningTimeInfo();
      
      setSimpleData({
        title,
        openingTime: openingInfo?.localString || null,
        isOpen: openingInfo?.isOpen || false,
        daysUntilOpening: openingInfo?.daysUntilOpening || null,
        loading: false,
        error: null
      });
    } else {
      setSimpleData({
        title: null,
        openingTime: null,
        isOpen: false,
        daysUntilOpening: null,
        loading: false,
        error: null
      });
    }
  }, [proposal]);

  return simpleData;
}

/**
 * Even Simpler Hook - Just Title
 * 
 * Example:
 * const title = useProposalTitle('0x...');
 */
export function useProposalTitle(proposalAddress) {
  const { title } = useSimpleProposal(proposalAddress);
  return title;
}

/**
 * Even Simpler Hook - Just Opening Time
 * 
 * Example:
 * const openingTime = useProposalOpeningTime('0x...');
 */
export function useProposalOpeningTime(proposalAddress) {
  const { openingTime, isOpen, daysUntilOpening } = useSimpleProposal(proposalAddress);
  return { openingTime, isOpen, daysUntilOpening };
} 