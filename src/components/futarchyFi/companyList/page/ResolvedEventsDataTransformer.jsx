import { collectAndFetchPoolPrices, attachPrefetchedPrices } from "../../../../utils/SubgraphBulkPriceFetcher";
import { fetchProposalsFromAggregator } from "../../../../hooks/useAggregatorProposals";
import { DEFAULT_AGGREGATOR } from "../../../../config/subgraphEndpoints";

const filterRecentResolvedEvents = (events) => {
  // Bypassing the recent filter so all resolved markets are shown permanently
  return events;
};

// Fetch resolved proposals from the registry subgraph aggregator.
export const fetchResolvedEventHighlightData = async (_companyId = "all", limit = 10, options = {}) => {
  const { connectedWallet } = options;
  const aggregatorAddress = DEFAULT_AGGREGATOR;

  try {
    const { proposals } = await fetchProposalsFromAggregator(aggregatorAddress, connectedWallet);

    const resolvedProposals = proposals.filter(p => {
      // Skip proposals from archived/hidden orgs (same rule as Active Milestones)
      const orgMeta = p.orgMetadata || {};
      if (orgMeta.archived === true) return false;
      if (orgMeta.visibility === 'hidden' && !p.isEditor) return false;

      return p.resolution_status === 'resolved'
        && p.resolution_outcome !== null
        && p.resolution_outcome !== undefined;
    });

    console.log(`[ResolvedEventsDataTransformer] Found ${resolvedProposals.length} resolved proposals from subgraph (of ${proposals.length} total)`);
    if (resolvedProposals.length === 0) return [];

    const resolvedEvents = resolvedProposals.map(proposal => ({
      eventId: proposal.eventId || proposal.proposalAddress,
      eventTitle: proposal.eventTitle || proposal.proposalTitle || 'Unknown Proposal',
      companyLogo: proposal.companyLogo || '/assets/fallback-company.png',
      authorName: proposal.authorName || 'Unknown Organization',
      resolutionStatus: proposal.resolutionStatus || proposal.resolution_status,
      resolutionOutcome: proposal.resolutionOutcome || proposal.resolution_outcome,
      finalOutcome: proposal.finalOutcome || proposal.resolution_outcome,
      impact: typeof proposal.metadata?.impact === 'number'
        ? proposal.metadata.impact
        : (typeof proposal.metadata?.impact === 'string' ? parseFloat(proposal.metadata.impact) : 0),
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

    const recentResolved = filterRecentResolvedEvents(resolvedEvents);
    if (recentResolved.length === 0) return [];

    recentResolved.sort((a, b) => {
      const aTime = new Date(a.endDate || a.endTime * 1000).getTime();
      const bTime = new Date(b.endDate || b.endTime * 1000).getTime();
      return bTime - aTime;
    });

    const limitedResults = recentResolved.slice(0, limit);

    const priceMap = await collectAndFetchPoolPrices(limitedResults);
    attachPrefetchedPrices(limitedResults, priceMap);

    return limitedResults;
  } catch (error) {
    console.error("Error fetching resolved event highlights:", error);
    return [];
  }
};
