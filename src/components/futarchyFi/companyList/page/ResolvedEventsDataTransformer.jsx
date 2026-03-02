import { fetchCompanyData } from "../../proposalsList/page/proposalsPage/ProposalsPageDataTransformer";
import { collectAndFetchPoolPrices, attachPrefetchedPrices } from "../../../../utils/SubgraphBulkPriceFetcher";
import { fetchProposalsFromAggregator } from "../../../../hooks/useAggregatorProposals";
import { ENABLE_V2_SUBGRAPH } from "../../../../config/featureFlags";
import { DEFAULT_AGGREGATOR } from "../../../../config/subgraphEndpoints";

const FIFTY_DAYS_IN_MS = 50 * 24 * 60 * 60 * 1000;

const getResolvedTimestampMs = (event) => {
  if (event.endDate) {
    const parsedDate = Date.parse(event.endDate);
    if (!Number.isNaN(parsedDate)) {
      return parsedDate;
    }
  }

  if (event.endTime != null) {
    const numericEndTime = typeof event.endTime === "number"
      ? event.endTime
      : Number(event.endTime);

    if (!Number.isNaN(numericEndTime)) {
      // Values coming from transformers are seconds-based, but fall back in case they are ms already
      return numericEndTime > 1e12 ? numericEndTime : numericEndTime * 1000;
    }
  }

  return null;
};

const filterRecentResolvedEvents = (events) => {
  // Bypassing the recent filter so all resolved markets are shown permanently
  return events;
};

// Helper function to create resolved event highlight from proposal data
const createResolvedEventHighlight = (proposal, companyData, index, companyId) => {
  console.log(`[ResolvedEventsDataTransformer] Processing resolved proposal ${index + 1}:`, {
    id: proposal.proposalID,
    title: proposal.proposalTitle?.substring(0, 50) + '...',
    resolution_status: proposal.resolution_status,
    resolution_outcome: proposal.resolution_outcome,
    metadata_resolution_outcome: proposal.metadata?.resolution_outcome,
    metadata_finalOutcome: proposal.metadata?.finalOutcome,
    end_date: proposal.end_date,
    impact: proposal.metadata?.impact
  });

  const normalizedEndDate = proposal.end_date || (() => {
    if (proposal.endTime == null) {
      return null;
    }

    const numericEndTime = typeof proposal.endTime === "number"
      ? proposal.endTime
      : Number(proposal.endTime);

    if (Number.isNaN(numericEndTime)) {
      return null;
    }

    const endTimeMs = numericEndTime > 1e12 ? numericEndTime : numericEndTime * 1000;
    return new Date(endTimeMs).toISOString();
  })();

  const eventData = {
    eventId: proposal.proposalID || `resolved-event-${index}`,
    eventTitle: proposal.proposalTitle,
    companyLogo: companyData.logo || "/assets/gnosis-dao-logo.png",
    authorName: companyData.name || "Unknown Company",

    // Resolution specific data
    resolutionStatus: proposal.resolution_status,
    resolutionOutcome: proposal.resolution_outcome || proposal.metadata?.resolution_outcome, // "yes", "no", or null
    // Prioritize direct resolution_outcome over metadata nested values
    finalOutcome: proposal.resolution_outcome || proposal.metadata?.finalOutcome || proposal.metadata?.resolution_outcome,

    // Impact data - ensure it's a number for HighlightCard
    impact: typeof proposal.metadata?.impact === 'number' ? proposal.metadata.impact :
      (typeof proposal.metadata?.impact === 'string' ? parseFloat(proposal.metadata.impact) : 0),

    // Pool addresses for price fetching (same structure as active events)
    poolAddresses: {
      // Use conditional pools from metadata (more consistent for price fetching)
      yes: proposal.metadata?.conditional_pools?.yes?.address || proposal.pool_yes,
      no: proposal.metadata?.conditional_pools?.no?.address || proposal.pool_no
    },

    // Time data
    endTime: proposal.endTime,
    endDate: normalizedEndDate,

    // Market metadata
    metadata: proposal.metadata,
    companyId: companyId,

    // Token symbols for dynamic display
    companySymbol: proposal.metadata?.companyTokens?.base?.tokenSymbol || 'GNO',
    currencySymbol: proposal.metadata?.currencyTokens?.base?.tokenSymbol || 'sDAI',

    // Display titles if available
    displayTitle0: proposal.metadata?.display_title_0,
    displayTitle1: proposal.metadata?.display_title_1,

    // Description
    description: proposal.proposals_markdown_market?.[0]?.proposal_markdown ||
      proposal.proposalsDocMarker?.[0]?.proposalsDoc ||
      proposal.metadata?.description ||
      "No description available",

    // Chain information
    chainId: proposal.metadata?.chain || 100 // Extract chain from metadata, default to Gnosis (100)
  };

  return eventData;
};

// Main function to fetch resolved event highlight data
export const fetchResolvedEventHighlightData = async (companyId = "all", limit = 10, options = {}) => {
  const { connectedWallet } = options;
  const effectiveAggregator = ENABLE_V2_SUBGRAPH ? DEFAULT_AGGREGATOR : options.aggregatorAddress;

  try {
    // ========================================
    // V2 SUBGRAPH PATH: Fetch from aggregator when enabled
    // ========================================
    if (ENABLE_V2_SUBGRAPH) {
      console.log("[ResolvedEventsDataTransformer] V2 mode: fetching resolved events from aggregator subgraph");

      const { proposals } = await fetchProposalsFromAggregator(effectiveAggregator, connectedWallet);

      // Filter for resolved proposals
      const resolvedProposals = proposals.filter(p =>
        p.resolution_status === 'resolved' &&
        (p.resolution_outcome !== null && p.resolution_outcome !== undefined)
      );

      console.log(`[ResolvedEventsDataTransformer] Found ${resolvedProposals.length} resolved proposals from subgraph (of ${proposals.length} total)`);

      if (resolvedProposals.length === 0) {
        console.log("[ResolvedEventsDataTransformer] No resolved proposals in subgraph");
        return [];
      }

      // Transform subgraph proposals into resolved event highlights
      const resolvedEvents = resolvedProposals.map((proposal, index) => ({
        eventId: proposal.eventId || proposal.proposalAddress,
        eventTitle: proposal.eventTitle || proposal.proposalTitle || 'Unknown Proposal',
        companyLogo: proposal.companyLogo || '/assets/fallback-company.png',
        authorName: proposal.authorName || 'Unknown Organization',
        resolutionStatus: proposal.resolutionStatus || proposal.resolution_status,
        resolutionOutcome: proposal.resolutionOutcome || proposal.resolution_outcome,
        finalOutcome: proposal.finalOutcome || proposal.resolution_outcome,
        impact: typeof proposal.metadata?.impact === 'number' ? proposal.metadata.impact :
          (typeof proposal.metadata?.impact === 'string' ? parseFloat(proposal.metadata.impact) : 0),
        poolAddresses: proposal.poolAddresses || { yes: null, no: null },
        endTime: proposal.endTime,
        endDate: proposal.endTime ? new Date(proposal.endTime * 1000).toISOString() : null,
        metadata: proposal.metadata,
        companyId: proposal.companyId,
        companySymbol: proposal.metadata?.companyTokens?.base?.tokenSymbol || 'GNO',
        currencySymbol: proposal.metadata?.currencyTokens?.base?.tokenSymbol || 'sDAI',
        displayTitle0: proposal.metadata?.display_title_0,
        displayTitle1: proposal.metadata?.display_title_1,
        description: proposal.description || 'No description available',
        chainId: proposal.chainId || 100,
        isOwner: proposal.isOwner,
        isEditor: proposal.isEditor,
        fromSubgraph: proposal.fromSubgraph,
        proposalMetadataAddress: proposal.proposalMetadataAddress,
        visibility: proposal.visibility
      }));

      // Apply 50-day recency filter
      const recentResolved = filterRecentResolvedEvents(resolvedEvents);

      if (recentResolved.length === 0) {
        console.log("[ResolvedEventsDataTransformer] No resolved events within the 50 day visibility window");
        return [];
      }

      // Sort by end date (most recently resolved first)
      recentResolved.sort((a, b) => {
        const aTime = new Date(a.endDate || a.endTime * 1000).getTime();
        const bTime = new Date(b.endDate || b.endTime * 1000).getTime();
        return bTime - aTime;
      });

      // Limit results
      const limitedResults = recentResolved.slice(0, limit);

      // Bulk fetch pool prices
      console.log(`[ResolvedEventsDataTransformer] Bulk fetching pool prices for ${limitedResults.length} resolved events...`);
      const priceMap = await collectAndFetchPoolPrices(limitedResults);
      attachPrefetchedPrices(limitedResults, priceMap);

      console.log(`[ResolvedEventsDataTransformer] V2 mode: Returning ${limitedResults.length} recently resolved events`);
      return limitedResults;
    }

    // ========================================
    // SUPABASE PATH (fallback when V2 disabled)
    // ========================================
    // If companyId is "all", fetch data from all available companies
    if (companyId === "all") {
      console.log("[ResolvedEventsDataTransformer] Fetching resolved events from ALL companies");

      // Import getAvailableCompanies to get all company IDs
      const { getAvailableCompanies } = await import("../../proposalsList/page/proposalsPage/ProposalsPageDataTransformer");
      const availableCompanyIds = await getAvailableCompanies();

      console.log("[ResolvedEventsDataTransformer] Available company IDs for resolved events:", availableCompanyIds);

      // Fetch data from all companies in parallel
      const allCompanyData = await Promise.all(
        availableCompanyIds.map(async (id) => {
          try {
            console.log(`[ResolvedEventsDataTransformer] Fetching data for company ${id}`);
            const data = await fetchCompanyData(id, false);
            return { companyId: id, data };
          } catch (error) {
            console.warn(`[ResolvedEventsDataTransformer] Failed to fetch data for company ${id}:`, error);
            return { companyId: id, data: null };
          }
        })
      );

      // Combine all resolved events from all companies
      let allResolvedEvents = [];

      for (const { companyId: currentCompanyId, data: companyData } of allCompanyData) {
        if (!companyData || !companyData.proposals || companyData.proposals.length === 0) {
          console.log(`[ResolvedEventsDataTransformer] No proposals found for company ${currentCompanyId}`);
          continue;
        }

        // Filter for resolved events
        const resolvedProposals = companyData.proposals.filter(p =>
          p.resolution_status === "resolved" &&
          (p.resolution_outcome !== null || p.metadata?.resolution_outcome !== null)
        );

        if (!resolvedProposals || resolvedProposals.length === 0) {
          console.log(`[ResolvedEventsDataTransformer] No resolved proposals found for company ${currentCompanyId}`);
          continue;
        }

        // Transform resolved proposals for this company
        const companyResolvedEvents = resolvedProposals.map((proposal, index) => {
          return createResolvedEventHighlight(proposal, companyData, index, currentCompanyId);
        });

        allResolvedEvents = allResolvedEvents.concat(companyResolvedEvents);
      }

      const recentResolvedEvents = filterRecentResolvedEvents(allResolvedEvents);

      if (recentResolvedEvents.length === 0) {
        console.log("[ResolvedEventsDataTransformer] No resolved events within the 50 day visibility window");
        return [];
      }

      // Sort by end date (most recently resolved first)
      recentResolvedEvents.sort((a, b) => {
        const aTime = new Date(a.endDate || a.endTime * 1000).getTime();
        const bTime = new Date(b.endDate || b.endTime * 1000).getTime();
        return bTime - aTime;
      });

      // Limit results
      const limitedResults = recentResolvedEvents.slice(0, limit);

      // BULK FETCH: Get all pool prices in one query per chain
      console.log(`[ResolvedEventsDataTransformer] Bulk fetching pool prices for ${limitedResults.length} resolved events...`);
      const priceMap = await collectAndFetchPoolPrices(limitedResults);
      attachPrefetchedPrices(limitedResults, priceMap);

      console.log(`[ResolvedEventsDataTransformer] Found ${recentResolvedEvents.length} Recently Resolved events (<= 50 days old), returning ${limitedResults.length}`);
      return limitedResults;
    }

    // Single company logic
    console.log(`[ResolvedEventsDataTransformer] Fetching resolved events for single company: ${companyId}`);

    const companyData = await fetchCompanyData(companyId, false);

    if (!companyData || !companyData.proposals || companyData.proposals.length === 0) {
      console.log("No proposals found in company data");
      return [];
    }

    // Filter for resolved events
    const resolvedProposals = companyData.proposals.filter(p =>
      p.resolution_status === "resolved" &&
      (p.resolution_outcome !== null || p.metadata?.resolution_outcome !== null)
    );

    if (!resolvedProposals || resolvedProposals.length === 0) {
      console.log("No resolved proposals found");
      return [];
    }

    // Transform resolved proposals into event highlights
    const resolvedEventHighlights = resolvedProposals.map((proposal, index) => {
      return createResolvedEventHighlight(proposal, companyData, index, companyId);
    });

    const recentResolvedEvents = filterRecentResolvedEvents(resolvedEventHighlights);

    if (recentResolvedEvents.length === 0) {
      console.log(`No resolved events within the 50 day window for company ${companyId}`);
      return [];
    }

    // Sort by end date (most recently resolved first)
    recentResolvedEvents.sort((a, b) => {
      const aTime = new Date(a.endDate || a.endTime * 1000).getTime();
      const bTime = new Date(b.endDate || b.endTime * 1000).getTime();
      return bTime - aTime;
    });

    // Limit results
    const limitedResults = recentResolvedEvents.slice(0, limit);

    // BULK FETCH: Get all pool prices in one query per chain
    console.log(`[ResolvedEventsDataTransformer] Bulk fetching pool prices for ${limitedResults.length} resolved events...`);
    const priceMap = await collectAndFetchPoolPrices(limitedResults);
    attachPrefetchedPrices(limitedResults, priceMap);

    console.log(`Found ${recentResolvedEvents.length} Recently Resolved events for company ${companyId}, returning ${limitedResults.length}`);
    return limitedResults;

  } catch (error) {
    console.error("Error fetching resolved event highlights:", error);
    return [];
  }
}; 
