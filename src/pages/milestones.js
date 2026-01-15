"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Proposals from "../components/futarchyFi/proposalsList/page/proposalsPage/ProposalsPage";
import dynamic from 'next/dynamic';

// Import MarketPageShowcase with no SSR
const MarketPageShowcase = dynamic(
  () => import("../components/futarchyFi/marketPage/MarketPageShowcase"),
  { ssr: false, loading: () => (
    <div className="flex justify-center items-center min-h-screen bg-white dark:bg-futarchyDarkGray2">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-futarchyLavender"></div>
    </div>
  )}
);

export default function MilestonesPage() {
  const router = useRouter();
  const { company_id } = router.query;
  
  // State to track which component to render
  const [showMarket, setShowMarket] = useState(false);
  // State to track if we're in a loading state
  const [isLoading, setIsLoading] = useState(true);
  // Store the hash to preserve it
  const [hash, setHash] = useState('');
  // Store the effective company ID
  const [effectiveCompanyId, setEffectiveCompanyId] = useState(null);
  
  useEffect(() => {
    // Wait for router to be ready
    if (!router.isReady) return;
    
    // Check URL hash when component mounts on client side
    if (typeof window !== 'undefined') {
      // Get and store the current hash
      const currentHash = window.location.hash;
      setHash(currentHash);
      
      // If the hash matches specific milestone patterns, show MarketPageShowcase instead
      if (currentHash.includes('milestone') || currentHash.includes('market')) {
        setShowMarket(true);
      }
      
      // Determine the company ID to use
      let companyIdToUse = company_id;
      
      // If no company_id provided, default to gnosis (9) for backward compatibility
      if (!companyIdToUse) {
        console.warn('No company_id provided, defaulting to Gnosis (9)');
        companyIdToUse = '9';
      }
      
      // Convert string IDs to the format expected by the backend
      if (companyIdToUse === 'gnosis' || companyIdToUse === '9') {
        companyIdToUse = 9;
      } else if (companyIdToUse === 'kleros' || companyIdToUse === '10') {
        companyIdToUse = 10;
      } else {
        // Try to parse as number
        const numericId = parseInt(companyIdToUse);
        companyIdToUse = isNaN(numericId) ? 9 : numericId;
      }
      
      setEffectiveCompanyId(companyIdToUse);
      
      console.log('Milestones page initialized:', {
        originalCompanyId: company_id,
        effectiveCompanyId: companyIdToUse,
        hash: currentHash,
        showMarket: currentHash.includes('milestone') || currentHash.includes('market')
      });
      
      // Override the ProposalsPage's URL modification to preserve our hash
      const originalPushState = window.history.pushState;
      window.history.pushState = function() {
        // Call the original method
        const result = originalPushState.apply(this, arguments);
        
        // Check if our hash was removed and add it back
        if (currentHash && !window.location.hash) {
          window.history.pushState({}, '', window.location.pathname + window.location.search + currentHash);
        }
        
        return result;
      };
      
      // Listen for hash changes
      const handleHashChange = () => {
        const newHash = window.location.hash;
        setHash(newHash);
        setShowMarket(newHash.includes('milestone') || newHash.includes('market'));
      };
      
      window.addEventListener('hashchange', handleHashChange);
      
      // Set loading to false after a brief delay
      setTimeout(() => {
        setIsLoading(false);
      }, 300);
      
      // Clean up
      return () => {
        // Restore the original pushState function
        window.history.pushState = originalPushState;
        window.removeEventListener('hashchange', handleHashChange);
      };
    }
  }, [router.isReady, company_id]);
  
  // Show loading state initially or while router is not ready
  if (isLoading || !router.isReady || effectiveCompanyId === null) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-white dark:bg-futarchyDarkGray2">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-futarchyLavender"></div>
      </div>
    );
  }
  
  // For Proposals component, create a custom props object with the dynamic company ID
  const proposalsProps = {
    initialCompanyId: effectiveCompanyId,
    // Add this special flag to tell our component not to modify URL
    preserveHash: true
  };
  
  // Render different component based on hash
  return showMarket ? <MarketPageShowcase /> : <Proposals {...proposalsProps} />;
} 