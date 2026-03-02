"use client";

import { useEffect, useState } from "react";
import Proposals from "../../../components/futarchyFi/proposalsList/page/proposalsPage/ProposalsPage";
import dynamic from 'next/dynamic';

// Import MarketPageShowcase with no SSR
const MarketPageShowcase = dynamic(
  () => import("../../../components/futarchyFi/marketPage/MarketPageShowcase"),
  { ssr: false, loading: () => (
    <div className="flex justify-center items-center min-h-screen bg-white">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-futarchyLavender"></div>
    </div>
  )}
);

export default function ProposalsPage() {
  // State to track which component to render
  const [showMarket, setShowMarket] = useState(false);
  // State to track if we're in a loading state
  const [isLoading, setIsLoading] = useState(true);
  // Store the hash to preserve it
  const [hash, setHash] = useState('');
  
  useEffect(() => {
    // Check URL hash when component mounts on client side
    if (typeof window !== 'undefined') {
      // Get and store the current hash
      const currentHash = window.location.hash;
      setHash(currentHash);
      
      // If the hash matches gnosis-milestone-0, show MarketPageShowcase instead
      if (currentHash === '#gnosis-milestone-0') {
        setShowMarket(true);
      }
      
      // Override the ProposalsPage's URL modification to preserve our hash
      const originalPushState = window.history.pushState;
      window.history.pushState = function() {
        // Call the original method
        const result = originalPushState.apply(this, arguments);
        
        // Check if our hash was removed and add it back
        if (currentHash && !window.location.hash) {
          window.history.pushState({}, '', window.location.pathname + currentHash);
        }
        
        return result;
      };
      
      // Listen for hash changes
      const handleHashChange = () => {
        const newHash = window.location.hash;
        setHash(newHash);
        setShowMarket(newHash === '#gnosis-milestone-0');
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
  }, []);
  
  // For Proposals component, create a custom props object that prevents URL modification
  const proposalsProps = {
    initialCompanyId: 'gnosis',
    // Add this special flag to tell our component not to modify URL
    preserveHash: true
  };
  
  // Show loading state initially
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-futarchyLavender"></div>
      </div>
    );
  }
  
  // Render different component based on hash
  return showMarket ? <MarketPageShowcase /> : <Proposals {...proposalsProps} />;
}

// Add static generation for the page (still needed for initial load)
export async function getStaticProps() {
  return {
    props: {}, // will be passed to the page component as props
  };
}