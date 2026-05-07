"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Proposals from "../components/futarchyFi/proposalsList/page/proposalsPage/ProposalsPage";
import dynamic from 'next/dynamic';

// Import MarketPageShowcase with no SSR
const MarketPageShowcase = dynamic(
  () => import("../components/futarchyFi/marketPage/MarketPageShowcase"),
  {
    ssr: false, loading: () => (
      <div className="flex justify-center items-center min-h-screen bg-white dark:bg-futarchyDarkGray2">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-futarchyLavender"></div>
      </div>
    )
  }
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

      // Map legacy numeric/slug company IDs to the on-chain Organization
      // contract address used by the aggregator subgraph.
      const LEGACY_ID_TO_ORG_ADDRESS = {
        '9': '0x3Fd2e8E71f75eED4b5c507706c413E33e0661bBf',     // Gnosis DAO
        '10': '0xaAB097ead5c2Db1Ca7b1E5034224A2118EDAbe36',    // Kleros DAO
        '11': '0x2F345ce868Cc7840A89472F2503944E4ef8F797c',    // VeloraDAO
        gnosis: '0x3Fd2e8E71f75eED4b5c507706c413E33e0661bBf',
        kleros: '0xaAB097ead5c2Db1Ca7b1E5034224A2118EDAbe36',
        velora: '0x2F345ce868Cc7840A89472F2503944E4ef8F797c',
        aave: '0xb84b41518806b70FeE6dAE06982aBD9526cb59C7',
        cow: '0xe071734B1cE5332Da778fb1FFD79456375d420D9',
      };
      const DEFAULT_COMPANY_ID = LEGACY_ID_TO_ORG_ADDRESS.gnosis;

      let companyIdToUse = company_id;

      if (!companyIdToUse) {
        console.warn('No company_id provided, defaulting to Gnosis');
        companyIdToUse = DEFAULT_COMPANY_ID;
      } else if (
        typeof companyIdToUse === 'string' &&
        companyIdToUse.startsWith('0x') &&
        companyIdToUse.length === 42
      ) {
        // Already an address — pass through
        console.log('[Milestones] Using address-based ID:', companyIdToUse);
      } else {
        const key = String(companyIdToUse).toLowerCase();
        const mapped = LEGACY_ID_TO_ORG_ADDRESS[key];
        if (mapped) {
          console.log(`[Milestones] Mapped legacy ID "${companyIdToUse}" → ${mapped}`);
          companyIdToUse = mapped;
        } else {
          console.warn(`[Milestones] Unknown company_id "${companyIdToUse}", falling back to Gnosis`);
          companyIdToUse = DEFAULT_COMPANY_ID;
        }
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
      window.history.pushState = function () {
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