import { fetchCompanyData } from "../../proposalsList/page/proposalsPage/ProposalsPageDataTransformer";

const THIRTY_DAYS_IN_MS = 30 * 24 * 60 * 60 * 1000;

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
  const now = Date.now();

  return events.filter((event) => {
    const resolvedAt = getResolvedTimestampMs(event);
    if (resolvedAt == null) {
      return false;
    }

    return resolvedAt + THIRTY_DAYS_IN_MS >= now;
  });
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
export const fetchResolvedEventHighlightData = async (companyId = "all", limit = 10) => {
  try {
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
        console.log("[ResolvedEventsDataTransformer] No resolved events within the 15 day visibility window");
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

      console.log(`[ResolvedEventsDataTransformer] Found ${recentResolvedEvents.length} Recently resolved events (<= 15 days old), returning ${limitedResults.length}`);
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
      console.log(`No resolved events within the 15 day window for company ${companyId}`);
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

    console.log(`Found ${recentResolvedEvents.length} Recently resolved events for company ${companyId}, returning ${limitedResults.length}`);
    return limitedResults;

  } catch (error) {
    console.error("Error fetching resolved event highlights:", error);
    return [];
  }
}; 
