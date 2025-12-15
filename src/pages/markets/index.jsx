"use client";

import dynamic from 'next/dynamic';

// Import MarketPageShowcase with no SSR
const MarketPageShowcase = dynamic(
  () => import("../../components/futarchyFi/marketPage/MarketPageShowcase"),
  { ssr: false }
);

export default function MarketPage() {
  return <MarketPageShowcase  />;
}

// Remove static generation
