"use client";

import dynamic from 'next/dynamic';

// Import MarketPage with no SSR to avoid document undefined errors
const MarketPage = dynamic(
  () => import("../../../components/futarchyFi/marketPage/page/MarketPage"),
  { ssr: false }
);

export default function NewMarketPage() {
  return <MarketPage />;
} 