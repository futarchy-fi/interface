"use client";

import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { DEFAULT_PROPOSAL_ID } from '../../../../components/futarchyFi/marketPage/constants/contracts';

// Import MarketPageShowcase with no SSR
const MarketPageShowcase = dynamic(
  () => import("../../../../components/futarchyFi/marketPage/MarketPageShowcase"),
  { ssr: false }
);

export default function MarketPage() {
  const router = useRouter();
  
  useEffect(() => {
    // Check if no query parameters are provided
    if (Object.keys(router.query).length === 0 && router.isReady) {
      // Redirect to market page with default proposal ID
      router.replace(`/markets/${DEFAULT_PROPOSAL_ID}`);
      return;
    }
  }, [router]);
  
  // Don't render the component if we're redirecting
  if (Object.keys(router.query).length === 0) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-futarchyLavender"></div>
      </div>
    );
  }
  
  return <MarketPageShowcase  />;
}

// Remove static generation
