import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import CircularProgressBar from "../../components/CircularProgressBar";
import { createSupabasePoolFetcher } from "../../../../../../SupabasePoolFetcher";
import ChainBadge from "../../components/ChainBadge";

// Create Supabase pool fetcher instance (you'd get these from env vars)
const supabasePoolFetcher = createSupabasePoolFetcher(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'your-supabase-url',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-supabase-key'
);

// Simple hook for fetching latest pool prices from Supabase including event probability
const useLatestPoolPrices = (poolAddresses, eventId, metadata) => {
  const [prices, setPrices] = useState({ yes: null, no: null, eventProbability: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLatestPrices = async () => {
      setLoading(true);

      try {
        console.log(`[SIMPLE FETCH] Getting latest candles for event ${eventId}`);

        // Fetch conditional pool prices in parallel
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

        // Fetch event probability from prediction pools
        // Use the YES prediction pool price directly as event probability (same as MarketPageShowcase)
        let eventProbability = null;
        const predictionPools = metadata?.prediction_pools;

        console.log(`[PREDICTION POOLS DEBUG] Event ${eventId}:`, {
          hasPredictionPools: !!predictionPools,
          yesAddress: predictionPools?.yes?.address,
          noAddress: predictionPools?.no?.address
        });

        if (predictionPools?.yes?.address) {
          console.log(`[PREDICTION POOLS DEBUG] Fetching YES prediction pool for ${eventId}:`, predictionPools.yes.address);

          const predYesResult = await supabasePoolFetcher.fetch('pools.candle', {
            id: predictionPools.yes.address,
            limit: 1
          });

          console.log(`[PREDICTION POOLS DEBUG] Fetch result for ${eventId}:`, {
            status: predYesResult?.status,
            dataLength: predYesResult?.data?.length,
            data: predYesResult?.data
          });

          if (predYesResult?.status === 'success' && predYesResult.data.length > 0) {
            const predYesPrice = predYesResult.data[0].price;

            console.log(`[PREDICTION POOLS DEBUG] YES prediction price for ${eventId}:`, predYesPrice);

            if (predYesPrice > 0) {
              // Convert to percentage and cap at 100%
              const probValue = Math.min(predYesPrice * 100, 100);
              eventProbability = `${probValue.toFixed(2)}%`;
              console.log(`[PREDICTION POOLS DEBUG] Calculated event probability for ${eventId}: ${eventProbability}`);
            } else {
              console.log(`[PREDICTION POOLS DEBUG] Price is zero or invalid for ${eventId}`);
            }
          } else {
            console.log(`[PREDICTION POOLS DEBUG] No data or failed fetch for ${eventId}`);
          }
        } else {
          console.log(`[PREDICTION POOLS DEBUG] Missing YES prediction pool address for ${eventId}`);
        }

        setPrices({ yes: yesPrice, no: noPrice, eventProbability });

      } catch (error) {
        console.error(`[SIMPLE FETCH] Error fetching latest prices:`, error);
        setPrices({ yes: null, no: null, eventProbability: null });
      } finally {
        setLoading(false);
      }
    };

    if (poolAddresses?.yes || poolAddresses?.no || metadata?.prediction_pools) {
      fetchLatestPrices();
    } else {
      setLoading(false);
    }
  }, [poolAddresses?.yes, poolAddresses?.no, metadata?.prediction_pools?.yes?.address, metadata?.prediction_pools?.no?.address, eventId]);

  return { prices, loading };
};

// Loading Spinner Component (inspired by CollateralModal)
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

// Add Timestamp component similar to ProposalsCard
const EventTimestamp = ({ countdownFinish, timestamp, endTime, resolutionStatus }) => {
  const [remainingTime, setRemainingTime] = useState("");

  useEffect(() => {
    const updateRemainingTime = () => {
      const now = Date.now() / 1000; // Current time in seconds
      
      console.log(`[EventTimestamp] Debug values:`, {
        countdownFinish,
        timestamp,
        endTime,
        resolutionStatus,
        now,
        endTimeType: typeof endTime,
        endTimeAsDate: endTime ? new Date(endTime * 1000) : null
      });
      
      if (endTime) {
        const timeLeft = endTime - now;
        const endDate = new Date(endTime * 1000).toLocaleDateString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
        
        if (timeLeft <= 0) {
          // End time has passed
          if (resolutionStatus !== 'open') {
            // Market is actually ended/resolved
            setRemainingTime(`Ended on: ${endDate}`);
          } else {
            // Market is still open for submissions despite deadline
            setRemainingTime(`Open: ${endDate}`);
          }
        } else {
          // End time hasn't passed yet - show countdown
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
          
          setRemainingTime(`Open until: ${timeString}`);
        }
      } else {
        // Fallback to start date if no end time
        const startDate = new Date(timestamp * 1000).toLocaleDateString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        });
        setRemainingTime(`Started: ${startDate}`);
      }
    };

    updateRemainingTime();
    const interval = setInterval(updateRemainingTime, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [countdownFinish, timestamp, endTime, resolutionStatus]);

  return remainingTime ? (
    <div className="text-xs text-futarchyGray11 dark:text-futarchyGray112 font-medium mt-1">
      {remainingTime}
    </div>
  ) : null;
};

const EventHighlightCard = ({
  companyLogo,
  proposalTitle,
  poolAddresses,
  timeProgress,
  startTime,
  endTime,
  countdownFinish,
  eventId,
  status,
  approvalStatus,
  metadata,
  resolutionStatus,
  chainId,
}) => {
  const searchParams = useSearchParams();
  const debugMode = searchParams.get('debugMode') === 'true';

  const currentStatus = status || approvalStatus;

  console.log('[EventHighlight Open]', { eventId, resolutionStatus });

  if (currentStatus === 'pending_review' && !debugMode) {
    return null;
  }

  // Extract display titles from metadata (similar to MarketPageShowcase)
  const displayTitle0 = metadata?.display_title_0 || null;
  const displayTitle1 = metadata?.display_title_1 || null;

  // If we have both display titles, use them; otherwise fall back to proposalTitle
  const shouldUseSplitTitles = displayTitle0 && displayTitle1;

  // Use the simplified hook instead of complex price fetching
  const { prices, loading: isLoadingPrices } = useLatestPoolPrices(poolAddresses, eventId, metadata);
  const [calculatedImpact, setCalculatedImpact] = useState("N/A");

  // Calculate impact when prices change
  useEffect(() => {
    if (prices.yes !== null && prices.no !== null) {
      const maxPrice = Math.max(prices.yes, prices.no);
        if (maxPrice !== 0) {
        const impact = ((prices.yes - prices.no) / maxPrice) * 100;
          setCalculatedImpact(impact >= 0 ? `+${impact.toFixed(2)}%` : `${impact.toFixed(2)}%`);
      } else {
        setCalculatedImpact("N/A");
      }
    } else {
      setCalculatedImpact("N/A");
    }
  }, [prices.yes, prices.no]);

  // Extract base token symbol from metadata
  const baseTokenSymbol = metadata?.currencyTokens?.base?.tokenSymbol ||
                          metadata?.BASE_TOKENS_CONFIG?.currency?.symbol ||
                          'SDAI';

  // Use high precision for small prices
  const shouldUseHighPrecision = (prices.no !== null && prices.no < 1) ||
                                (prices.yes !== null && prices.yes < 1);
  const precision = shouldUseHighPrecision ? 4 : 2;

  const formattedYesPrice = isLoadingPrices ? <LoadingSpinner /> : (prices.yes !== null ? `${prices.yes.toFixed(precision)} ${baseTokenSymbol}` : `0.00 ${baseTokenSymbol}`);
  const formattedNoPrice = isLoadingPrices ? <LoadingSpinner /> : (prices.no !== null ? `${prices.no.toFixed(precision)} ${baseTokenSymbol}` : `0.00 ${baseTokenSymbol}`);
  const impactDisplay = isLoadingPrices ? <LoadingSpinner /> : calculatedImpact;

  return (
    <div className="flex flex-col h-full bg-futarchyGray2 dark:bg-transparent border-2 border-futarchyGray3 dark:border-futarchyGray11/70 rounded-3xl group relative cursor-pointer md:w-[380px] w-full shadow-sm hover:shadow-xl transition-all duration-300">
      <a href={`/markets/${eventId}`} className="p-5 bg-futarchyGray2 dark:bg-transparent relative z-20 rounded-3xl flex flex-col h-full">
        <div className="flex flex-col gap-4 min-h-[240px]">
          {/* Logo and Chain Badge Row */}
          <div className="flex flex-row items-center justify-between">
            <div className="w-20 h-20 relative flex-shrink-0">
              <div className="absolute inset-0">
                <CircularProgressBar
                  currentProgress={timeProgress}
                  totalProgress={100}
                  radius={40}
                  strokeWidth={3}
                />
              </div>
              <div className="absolute inset-[8px] rounded-full overflow-hidden bg-futarchyGray3">
                <Image
                  src={companyLogo || "/assets/default-logo.png"}
                  alt="Company Logo"
                  layout="fill"
                  objectFit="cover"
                  className="rounded-full"
                />
              </div>
            </div>
            {chainId && <ChainBadge chainId={chainId} size="sm" />}
          </div>

          {/* Title Section - Full width, more prominent */}
          <div className="flex flex-col gap-2">
            <h3 className="text-lg font-bold font-oxanium text-futarchyGray12 dark:text-white leading-7 line-clamp-3">
              {shouldUseSplitTitles ? (
                <>
                  <span>{displayTitle0}</span>{' '}
                  <span className="text-futarchyViolet7">{displayTitle1}</span>
                </>
              ) : (
                proposalTitle || "Untitled Event"
              )}
            </h3>
            <EventTimestamp
              countdownFinish={countdownFinish}
              timestamp={startTime}
              endTime={endTime}
              resolutionStatus={resolutionStatus}
            />
          </div>
        </div>

        {/* Spacer to push stats to bottom */}
        <div className="flex-grow"></div>

        {/* Stats Section */}
        <div className="flex flex-col gap-2 mt-4">
          {/* First Row: YES Price, NO Price, Impact */}
          <div className="flex flex-col border-2 border-futarchyGray62 dark:border-futarchyGray112/40 bg-futarchyGray3 dark:bg-transparent rounded-xl">
            <div className="flex flex-row">
              <div className="flex flex-col items-center flex-1 p-2">
                <span className="text-xs text-futarchyGray11 leading-4 dark:text-white/70 font-medium">YES Price</span>
                <span className="text-sm font-semibold text-futarchyBlue9 dark:text-futarchyBlue9">
                  {formattedYesPrice}
                </span>
              </div>
              <div className="flex flex-col items-center flex-1 border-l border-futarchyGray62 dark:border-futarchyGray112/40 p-2">
                <span className="text-xs text-futarchyGray11 leading-4 dark:text-white/70 font-medium">NO Price</span>
                <span className="text-sm font-semibold text-futarchyGold8 dark:text-futarchyGold8">
                  {formattedNoPrice}
                </span>
              </div>
              <div className="flex flex-col items-center flex-1 border-l border-futarchyGray62 dark:border-futarchyGray112/40 p-2">
                <span className="text-xs text-futarchyGray11 leading-4 dark:text-white/70 font-medium">Impact</span>
                <span className={`text-sm font-semibold ${calculatedImpact.startsWith('+') ? 'text-futarchyTeal9 dark:text-futarchyTeal9' : calculatedImpact.startsWith('-') ? 'text-futarchyCrimson9 dark:text-futarchyCrimson9' : 'text-futarchyGray12 dark:text-white'}`}>
                  {impactDisplay}
                </span>
              </div>
            </div>
          </div>

          {/* Second Row: Event Probability (if available) */}
          {prices.eventProbability && (
            <div className="flex flex-col border-2 border-futarchyGray62 dark:border-futarchyGray112/40 bg-futarchyGray3 dark:bg-transparent rounded-xl p-2">
              <div className="flex flex-row items-center justify-between px-2">
                <span className="text-xs text-futarchyGray11 dark:text-white/70 font-medium">Event Probability</span>
                <span className="text-sm font-semibold text-futarchyViolet7 dark:text-futarchyViolet7">
                  {isLoadingPrices ? <LoadingSpinner className="h-4 w-4" /> : prices.eventProbability}
                </span>
              </div>
            </div>
          )}
        </div>
      </a>
    </div>
  );
};

export default EventHighlightCard; 
