import React, { useState, useEffect, useMemo } from "react";
import CircularProgressBar from "../../components/CircularProgressBar";
import { createSupabasePoolFetcher } from "../../../../../../SupabasePoolFetcher";
import { generateMarketUrl } from "../../constants/staticPaths";
import ChainBadge from "../../components/ChainBadge";

// Create Supabase pool fetcher instance (same as EventHighlightCard)
const supabasePoolFetcher = createSupabasePoolFetcher(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'your-supabase-url',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-supabase-key'
);

// Simple hook for fetching latest pool prices from Supabase (same as EventHighlightCard)
const useLatestPoolPrices = (poolAddresses, eventId, metadata) => {
  const [prices, setPrices] = useState({ yes: null, no: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLatestPrices = async () => {
      setLoading(true);
      
      try {
        console.log(`[SIMPLE FETCH] Getting latest candles for event ${eventId}`);
        
        // Fetch latest candles in parallel - much simpler!
        const [yesResult, noResult] = await Promise.all([
          poolAddresses?.yes ? supabasePoolFetcher.fetch('pools.candle', { 
            id: poolAddresses.yes, 
            limit: 1 
          }) : Promise.resolve(null),
          poolAddresses?.no ? supabasePoolFetcher.fetch('pools.candle', { 
            id: poolAddresses.no, 
            limit: 1 
          }) : Promise.resolve(null)
        ]);

        let yesPrice = null;
        let noPrice = null;

        // Extract prices from latest candles
        if (yesResult?.status === 'success' && yesResult.data.length > 0) {
          yesPrice = yesResult.data[0].price;
          console.log(`[SIMPLE FETCH] YES price from latest candle: ${yesPrice}`);
        }

        if (noResult?.status === 'success' && noResult.data.length > 0) {
          noPrice = noResult.data[0].price;
          console.log(`[SIMPLE FETCH] NO price from latest candle: ${noPrice}`);
        }

        setPrices({ yes: yesPrice, no: noPrice });
        
      } catch (error) {
        console.error(`[SIMPLE FETCH] Error fetching latest prices:`, error);
        setPrices({ yes: null, no: null });
      } finally {
        setLoading(false);
      }
    };

    if (poolAddresses?.yes || poolAddresses?.no) {
      fetchLatestPrices();
    } else {
      setLoading(false);
    }
  }, [poolAddresses?.yes, poolAddresses?.no, eventId]);

  return { prices, loading };
};

// Loading Spinner Component
const LoadingSpinner = ({ className = "h-5 w-5 text-futarchyGray12 dark:text-white" }) => (
  <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
      strokeOpacity="0.2"
    />
    <path
      d="M4 12a8 8 0 018-8"
      stroke="currentColor"
      strokeWidth="4"
      strokeLinecap="round"
    />
  </svg>
);

// Timestamp component adapted for endTime
const Timestamp = ({ endTime }) => {
  const [remainingTime, setRemainingTime] = useState("");

  useEffect(() => {
    const updateRemainingTime = () => {
      const now = Date.now() / 1000; // Current time in seconds

      if (endTime) {
        const timeLeft = endTime - now;

        if (timeLeft <= 0) {
          const endDate = new Date(endTime * 1000).toLocaleDateString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          });
          setRemainingTime(`Ended on: ${endDate}`);
        } else {
          const days = Math.floor(timeLeft / 86400);
          const hours = Math.floor((timeLeft % 86400) / 3600);
          const minutes = Math.floor((timeLeft % 3600) / 60);

          let timeString = '';
          if (days > 0) {
            timeString += `${days}d `;
          }
          if (hours > 0 || days > 0) {
            timeString += `${hours}h `;
          }
          timeString += `${minutes}m`;

          setRemainingTime(`Remaining Time: ${timeString}`);
        }
      } else {
        setRemainingTime("No end time specified");
      }
    };

    updateRemainingTime();
    const interval = setInterval(updateRemainingTime, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [endTime]);

  return remainingTime ? (
    <div className="w-fit px-2 py-0.5 text-start rounded-full text-xs bg-futarchyGold9/35 border border-futarchyGold9 text-futarchyGold11 dark:border-futarchyGold6 dark:bg-futarchyGold7/15 dark:text-futarchyGold6 font-medium mt-1">
      {remainingTime}
    </div>
  ) : null;
};

// Component to show resolved status badge
const ResolvedStatusBadge = () => (
  <div className="w-fit px-2 py-0.5 text-start rounded-full text-xs bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 font-medium mt-1">
    ✓ Resolved
  </div>
);

const parsePrice = (price) => {
  if (typeof price === 'number') return price;
  if (typeof price === 'string') {
    const num = parseFloat(price.replace(/[^\\d.-]/g, ''));
    return isNaN(num) ? null : num;
  }
  return null;
};

const HighlightCard = ({
  marketName: marketNameProp,
  endTime: endTimeProp,
  proposalCreationTimestamp: proposalCreationTimestampProp,
  companyLogoUrl: companyLogoUrlProp,
  priceYes: priceYesProp,
  priceNo: priceNoProp,
  priceSpot: priceSpotProp,
  eventProbability: eventProbabilityProp,
  status: statusProp, // "Loading", "Done", "Error"
  marketId: marketIdProp,
  useMockData = false,
  // New props for resolved events
  isResolved = false,
  resolutionOutcome,
  finalOutcome,
  impact: impactProp,
  companySymbol = 'GNO',
  // Pool addresses for price fetching
  poolAddresses,
  metadata,
  chainId,
}) => {
  const mockData = {
    marketName: "Will NVIDIA's stock price exceed $1,000 by the end of 2024?",
    proposalCreationTimestamp: 1749888000, // June 20th, 2025
    endTime: 1766649600, // December 25th, 2025
    companyLogoUrl: "/assets/gnosis-dao-logo.svg",
    priceYes: 125.67,
    priceNo: 89.34,
    priceSpot: 100.00,
    eventProbability: 0.58,
    status: "Done",
    marketId: "mock-market-1",
  };

  const data = useMockData ? mockData : {
    marketName: marketNameProp,
    endTime: endTimeProp,
    proposalCreationTimestamp: proposalCreationTimestampProp,
    companyLogoUrl: companyLogoUrlProp,
    priceYes: priceYesProp,
    priceNo: priceNoProp,
    priceSpot: priceSpotProp,
    eventProbability: eventProbabilityProp,
    status: statusProp,
    marketId: marketIdProp,
  };

  const { marketName, endTime, proposalCreationTimestamp, companyLogoUrl, status, marketId } = data;

  // Extract display titles from metadata (similar to EventHighlightCard)
  const displayTitle0 = metadata?.display_title_0 || null;
  const displayTitle1 = metadata?.display_title_1 || null;

  // If we have both display titles, use them; otherwise fall back to marketName
  const shouldUseSplitTitles = displayTitle0 && displayTitle1;

  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const calculateProgress = () => {
      const now = Date.now() / 1000;
      if (!proposalCreationTimestamp || !endTime || now >= endTime) {
        setProgress(100);
        return;
      }
      if (now <= proposalCreationTimestamp) {
        setProgress(0);
        return;
      }
      const totalDuration = endTime - proposalCreationTimestamp;
      const elapsedTime = now - proposalCreationTimestamp;
      setProgress((elapsedTime / totalDuration) * 100);
    };

    calculateProgress();
    const timer = setInterval(calculateProgress, 60000); // Update every minute

    return () => clearInterval(timer);
  }, [proposalCreationTimestamp, endTime]);

  // Use dynamic price fetching for resolved events if poolAddresses are provided
  const { prices: fetchedPrices, loading: isPriceLoading } = useLatestPoolPrices(
    isResolved && poolAddresses ? poolAddresses : null, 
    marketId, 
    metadata
  );

  // Determine which prices to use - fetched for resolved events or props for active events
  const priceYes = isResolved && fetchedPrices.yes !== null ? fetchedPrices.yes : parsePrice(data.priceYes);
  const priceNo = isResolved && fetchedPrices.no !== null ? fetchedPrices.no : parsePrice(data.priceNo);
  const priceSpot = parsePrice(data.priceSpot);
  const eventProbability = parsePrice(data.eventProbability);
  
  const isLoading = status === "Loading" || (isResolved && isPriceLoading);
  const isError = status === "Error";

  const impact = useMemo(() => {
    // For both resolved and active events, calculate impact from yes/no prices if available
    if (priceYes !== null && priceNo !== null) {
      // Use the same calculation as EventHighlightCard
      const maxPrice = Math.max(priceYes, priceNo);
      if (maxPrice !== 0) {
        const impactValue = ((priceYes - priceNo) / maxPrice) * 100;
        return impactValue >= 0 ? `+${impactValue.toFixed(2)}%` : `${impactValue.toFixed(2)}%`;
      }
    }
    
    // Fallback for resolved events: use provided impact value if no prices available
    if (isResolved && impactProp !== undefined && impactProp !== null) {
      const numericImpact = typeof impactProp === 'string' ? parseFloat(impactProp) : impactProp;
      if (typeof numericImpact === 'number' && !isNaN(numericImpact)) {
        return numericImpact >= 0 ? `+${numericImpact.toFixed(2)}%` : `${numericImpact.toFixed(2)}%`;
      }
    }
    
    // Legacy calculation for active events with spot price
    if (priceYes !== null && priceNo !== null && priceSpot !== null && priceSpot !== 0) {
      const impactValue = ((priceYes - priceNo) / priceSpot) * 100;
      return impactValue >= 0 ? `+${impactValue.toFixed(2)}%` : `${impactValue.toFixed(2)}%`;
    }
    
    return "N/A";
  }, [priceYes, priceNo, priceSpot, isResolved, impactProp]);

  const isImpactPositive = impact !== "N/A" && !impact.startsWith("-");
  const impactTextColorClass = isImpactPositive ? "text-futarchyTeal9 dark:text-futarchyTeal9" : "text-futarchyCrimson9 dark:text-futarchyCrimson9";

  // Extract base token symbol from metadata
  const baseTokenSymbol = metadata?.currencyTokens?.base?.tokenSymbol ||
                          metadata?.BASE_TOKENS_CONFIG?.currency?.symbol ||
                          companySymbol ||
                          'SDAI';

  const renderValue = (value, format) => {
    if (isLoading) return <LoadingSpinner />;
    if (isError) return <span className="text-sm font-semibold text-red-500">Error</span>;
    if (value === null || value === undefined) return `0.00 ${baseTokenSymbol}`;
    if (typeof format !== 'function') return value;
    return format(value);
  };

  const formattedYesPrice = renderValue(priceYes, (v) => `${v.toFixed(2)} ${baseTokenSymbol}`);
  const formattedNoPrice = renderValue(priceNo, (v) => `${v.toFixed(2)} ${baseTokenSymbol}`);
  const formattedEventProbability = renderValue(eventProbability, (v) => `${(v * 100).toFixed(0)}%`);
  const impactDisplay = renderValue(impact);

  // Get final outcome for resolved events
  // Debug for KIP-77
  if (isResolved && marketNameProp?.includes('KIP-77')) {
    console.log(`[HighlightCard] KIP-77 specific debug:`, {
      resolutionOutcome,
      finalOutcome,
      marketId: marketIdProp,
      marketName: marketNameProp
    });
  }
  
  const outcome = finalOutcome || resolutionOutcome;
  const isYesOutcome = outcome?.toLowerCase() === 'yes';

  const statItems = isResolved ? [
    // For resolved events, show outcome and impact
    {
      label: "Outcome",
      value: outcome ? outcome.toUpperCase() : 'Unknown',
      colorClass: isYesOutcome ? "text-futarchyBlue9 dark:text-futarchyBlue9" : "text-futarchyGold8 dark:text-futarchyGold8",
    },
    {
      label: "Impact",
      value: impactDisplay,
      colorClass: impactTextColorClass,
    },
  ] : [
    // For active events, show yes/no prices and impact
    {
      label: "YES<br/>Price",
      value: formattedYesPrice,
      colorClass: "text-futarchyBlue9 dark:text-futarchyBlue9",
    },
    {
      label: "NO<br/>Price",
      value: formattedNoPrice,
      colorClass: "text-futarchyGold8 dark:text-futarchyGold8",
    },
    {
      label: "Impact",
      value: impactDisplay,
      colorClass: impactTextColorClass,
    },
  ];

  return (
    <a href={generateMarketUrl(marketId)} className="group flex flex-col h-full border-2 border-futarchyGray62 dark:border-futarchyGray11/70 rounded-3xl relative cursor-pointer md:w-[340px] w-full shadow-lg hover:shadow-2xl dark:shadow-md dark:hover:shadow-lg dark:hover:shadow-futarchyBlue9/20 transition-all duration-300 overflow-hidden">

      {/* Shine Effect Layer */}
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-white/80 dark:via-white/20 to-transparent transform -translate-x-full -skew-x-12 group-hover:translate-x-full transition-transform duration-700 ease-in-out z-20 pointer-events-none"></div>

      {/* Top Section */}
      <div className="p-5 bg-futarchyGray2 dark:bg-transparent flex flex-col min-h-[280px]">
        <div className="flex flex-col gap-4 flex-grow">
          {/* Logo and Chain Badge Row */}
          <div className="flex flex-row items-center justify-between">
            <div className="w-[72px] h-[72px] flex-shrink-0 relative">
              <CircularProgressBar
                currentProgress={progress}
                totalProgress={100}
                radius={36}
                strokeWidth={3}
              />
              {companyLogoUrl && (
                <div className="absolute inset-[8px] rounded-full overflow-hidden bg-futarchyGray3">
                   <img src={companyLogoUrl} alt="Company Logo" className="w-full h-full object-cover rounded-full" />
                </div>
              )}
            </div>
            {chainId && <ChainBadge chainId={chainId} size="sm" />}
          </div>

          {/* Title Section - Full width, more lines */}
          <div className="flex flex-col gap-2">
            <h3 className="text-lg font-bold font-oxanium text-futarchyGray12 dark:text-white leading-7 line-clamp-4">
              {shouldUseSplitTitles ? (
                <>
                  <span>{displayTitle0}</span>{' '}
                  <span className="text-futarchyViolet7">{displayTitle1}</span>
                </>
              ) : (
                marketName || "Untitled Market"
              )}
            </h3>
            {isResolved ? <ResolvedStatusBadge /> : <Timestamp endTime={endTime} />}
          </div>
        </div>
      </div>
      
      {/* Divider */}
      <div className="border-t-2 border-futarchyGray62 dark:border-futarchyGray11/70"></div>

      {/* Bottom Section - grows to fill space */}
      <div className="p-4 bg-futarchyGray3 dark:bg-futarchyDarkGray3 flex-grow flex items-end">
        <div className={`grid ${isResolved ? 'grid-cols-2' : 'grid-cols-3'} md:gap-1 gap-3 w-full`}>
          {statItems.map((item) => (
            <div
              key={item.label}
              className="flex flex-col items-center flex-1 p-1 md:p-3 rounded-2xl border-2 border-futarchyGray62 dark:border-futarchyGray112/40 bg-futarchyGray2 dark:bg-futarchyDarkGray2 transition-colors duration-300"
            >
              <span
                className="text-xs text-futarchyGray11 leading-4 dark:text-white/70 font-medium text-center h-8 flex items-center justify-center transition-colors duration-300 whitespace-nowrap"
                dangerouslySetInnerHTML={{ __html: item.label }}
              />
              <span className={`text-sm font-semibold ${item.colorClass}`}>
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </a>
  );
};

export default HighlightCard;
