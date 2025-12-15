import { fetchCompanyData } from "../../proposalsList/page/proposalsPage/ProposalsPageDataTransformer";

// Helper function to simulate API delay
const simulateDelay = () => {
  const minDelay = 500;
  const maxDelay = 2000;
  const randomDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
  return new Promise((resolve) => setTimeout(resolve, randomDelay));
};

// Helper function to calculate time progress
const calculateTimeProgress = (startTime, endTime) => {
  const now = Date.now() / 1000;
  const totalDuration = endTime - startTime;
  const elapsed = now - startTime;
  const progress = (elapsed / totalDuration) * 100;
  return Math.min(Math.max(progress, 0), 100);
};

// Helper function to create event highlight from proposal data
const createEventHighlight = (proposal, companyData, index, companyId) => {
  console.log(`[EventsHighlightDataTransformer] Processing proposal ${index + 1}:`, {
    id: proposal.proposalID,
    title: proposal.proposalTitle?.substring(0, 50) + '...',
    timestamp: proposal.timestamp,
    endTime: proposal.endTime,
    endTimeType: typeof proposal.endTime,
    endTimeAsDate: proposal.endTime ? new Date(proposal.endTime * 1000) : null,
    pool_yes: proposal.pool_yes,
    pool_no: proposal.pool_no,
    conditional_pools: proposal.metadata?.conditional_pools,
    prediction_pools: proposal.metadata?.prediction_pools
  });

  const eventData = {
    eventId: proposal.proposalID || `event-${index}`,
    eventTitle: proposal.proposalTitle,
    companyLogo: companyData.logo || "/assets/gnosis-dao-logo.png",
    authorName: companyData.name || "Unknown Company", // Use company name as author
    // Pass initial stats, which might be basic or null
    stats: {
      yesPrice: proposal.prices?.approval, // Will be a string like "250.00 SDAI"
      noPrice: proposal.prices?.refusal,   // Will be a string like "230.00 SDAI"
    },
    // Pass data needed for the card to fetch its own prices and manage countdown
    predictionPools: proposal.predictionPools ||
                    (proposal.metadata?.prediction_pools ? proposal.metadata.prediction_pools : null),
    poolAddresses: {
      // Use conditional pools from metadata (more consistent for price fetching)
      yes: proposal.metadata?.conditional_pools?.yes?.address || proposal.pool_yes,
      no: proposal.metadata?.conditional_pools?.no?.address || proposal.pool_no
    },
    countdownFinish: proposal.countdownFinish,
    startTime: proposal.timestamp,
    endTime: proposal.endTime,
    timeProgress: calculateTimeProgress(
      proposal.timestamp,
      proposal.endTime
    ),
    status: proposal.approvalStatus,
    resolutionStatus: proposal.resolution_status, // Add resolution status for timestamp logic
    currencyToken: companyData.currencyToken || "GNO",
    description: proposal.proposals_markdown_market?.[0]?.proposal_markdown ||
                proposal.proposalsDocMarket?.[0]?.proposalsDoc ||
                "No description available",
    // Additional data from the new API structure
    conditionId: proposal.conditionId,
    questionId: proposal.questionId,
    tokens: proposal.tokens,
    tags: proposal.tags,
    metadata: proposal.metadata,
    companyId: companyId, // Add company ID for tracking
    chainId: proposal.metadata?.chain || 100 // Extract chain from metadata, default to Gnosis (100)
  };

  // Debug log the final pool addresses being passed to EventHighlightCard
  console.log(`[EventsHighlightDataTransformer] Final poolAddresses for ${proposal.proposalID}:`, {
    yes: eventData.poolAddresses.yes,
    no: eventData.poolAddresses.no,
    source: {
      conditional_yes: proposal.metadata?.conditional_pools?.yes?.address,
      conditional_no: proposal.metadata?.conditional_pools?.no?.address,
      root_yes: proposal.pool_yes,
      root_no: proposal.pool_no
    }
  });

  return eventData;
};

const mockEventHighlights = {
  "futarchyfi": [
    {
      eventId: "EVT-1",
      companyLogo: "/assets/futarchy-logo.svg",
      eventTitle: "US Presidential Election 2024 Impact",
      authorName: "FutarchyFi Research",
      stats: {
        yesPrice: "$0.67",
        noPrice: "$0.33"
      },
      startTime: Date.now() / 1000 - 86400 * 30, // Started 30 days ago
      endTime: Date.now() / 1000 + 86400 * 180, // Ends in 180 days
    },
    {
      eventId: "EVT-2",
      companyLogo: "/assets/futarchy-logo.svg",
      eventTitle: "Bitcoin ETF Market Impact Analysis",
      authorName: "Crypto Research Team",
      stats: {
        yesPrice: "$0.82",
        noPrice: "$0.18"
      },
      startTime: Date.now() / 1000 - 86400 * 15,
      endTime: Date.now() / 1000 + 86400 * 45,
    },
    {
      eventId: "EVT-3",
      companyLogo: "/assets/futarchy-logo.svg",
      eventTitle: "Fed Interest Rate Decision Effects",
      authorName: "EAD",
      stats: {
        yesPrice: "$0.45",
        noPrice: "$0.55"
      },
      startTime: Date.now() / 1000 - 86400 * 5,
      endTime: Date.now() / 1000 + 86400 * 25,
    }
  ],
  "gnosis": [
    {
      eventId: "GNO-EVT-1",
      companyLogo: "/assets/gnosis-dao-logo.png",
      eventTitle: "EU Crypto Regulation Impact",
      authorName: "Regulatory Research",
      stats: {
        yesPrice: "$0.58",
        noPrice: "$0.42"
      },
      startTime: Date.now() / 1000 - 86400 * 10,
      endTime: Date.now() / 1000 + 86400 * 90,
    },
    {
      eventId: "GNO-EVT-2",
      companyLogo: "/assets/gnosis-dao-logo.png",
      eventTitle: "China CBDC Global Effects",
      authorName: "Asian Markets Team",
      stats: {
        yesPrice: "$0.71",
        noPrice: "$0.29"
      },
      startTime: Date.now() / 1000 - 86400 * 20,
      endTime: Date.now() / 1000 + 86400 * 60,
    }
  ],
  "skymavis": [
    {
      eventId: "SKY-EVT-1",
      companyLogo: "/assets/skymavis-logo-bg.png",
      eventTitle: "Gaming Market Recession Impact",
      authorName: "Gaming Industry Analysis",
      stats: {
        yesPrice: "$0.39",
        noPrice: "$0.61"
      },
      startTime: Date.now() / 1000 - 86400 * 15,
      endTime: Date.now() / 1000 + 86400 * 75,
    }
  ]
};

// Main function to fetch event highlight data
export const fetchEventHighlightData = async (companyId = "all") => {
  try {
    // If companyId is "all", fetch data from all available companies
    if (companyId === "all") {
      console.log("[EventsHighlightDataTransformer] Fetching data from ALL companies");
      
      // Import getAvailableCompanies to get all company IDs
      const { getAvailableCompanies } = await import("../../proposalsList/page/proposalsPage/ProposalsPageDataTransformer");
      const availableCompanyIds = await getAvailableCompanies();
      
      console.log("[EventsHighlightDataTransformer] Available company IDs for milestones:", availableCompanyIds);
      
      // Fetch data from all companies in parallel
      const allCompanyData = await Promise.all(
        availableCompanyIds.map(async (id) => {
          try {
            console.log(`[EventsHighlightDataTransformer] Fetching data for company ${id}`);
            const data = await fetchCompanyData(id, false);
            return { companyId: id, data };
          } catch (error) {
            console.warn(`[EventsHighlightDataTransformer] Failed to fetch data for company ${id}:`, error);
            return { companyId: id, data: null };
          }
        })
      );
      
      // Combine all active milestones from all companies
      let allEventHighlights = [];
      
      for (const { companyId: currentCompanyId, data: companyData } of allCompanyData) {
        if (!companyData || !companyData.proposals || companyData.proposals.length === 0) {
          console.log(`[EventsHighlightDataTransformer] No proposals found for company ${currentCompanyId}`);
          continue;
        }
        
        // Filter for active milestones - include both "ongoing"/"on_going" and "pending_review" statuses
        // but exclude already resolved events
        const activeProposals = companyData.proposals.filter(p => 
          (p.approvalStatus === "ongoing" || 
           p.approvalStatus === "on_going" ||
           p.approvalStatus === "pending_review") &&
          p.resolution_status !== "resolved"
        );
        
        if (!activeProposals || activeProposals.length === 0) {
          console.log(`[EventsHighlightDataTransformer] No active proposals found for company ${currentCompanyId}`);
          continue;
        }
        
        // Transform active proposals for this company
        const companyEventHighlights = activeProposals.map((proposal, index) => {
          return createEventHighlight(proposal, companyData, index, currentCompanyId);
        });
        
        allEventHighlights = allEventHighlights.concat(companyEventHighlights);
      }
      
      // Sort by most recent first
      allEventHighlights.sort((a, b) => b.startTime - a.startTime);
      
      console.log(`[EventsHighlightDataTransformer] Found ${allEventHighlights.length} active milestones across all companies`);
      return allEventHighlights;
    }
    
    // Single company logic (existing behavior)
    console.log(`[EventsHighlightDataTransformer] Fetching data for single company: ${companyId}`);
    
    // Call fetchCompanyData with useNewPrices = false to defer detailed price fetching
    const companyData = await fetchCompanyData(companyId, false); 
    
    if (!companyData || !companyData.proposals || companyData.proposals.length === 0) {
      console.log("No proposals found in company data");
      return [];
    }

    // Filter for active milestones - include both "ongoing"/"on_going" and "pending_review" statuses
    // but exclude already resolved events
    const activeProposals = companyData.proposals.filter(p => 
      (p.approvalStatus === "ongoing" || 
       p.approvalStatus === "on_going" ||
       p.approvalStatus === "pending_review") &&
      p.resolution_status !== "resolved"
    );
    
    if (!activeProposals || activeProposals.length === 0) {
      console.log("No active proposals found");
      return [];
    }

    // Transform all active proposals into event highlights
    const eventHighlights = activeProposals.map((proposal, index) => {
      return createEventHighlight(proposal, companyData, index, companyId);
    });

    console.log(`Found ${eventHighlights.length} active milestones for company ${companyId}`);
    return eventHighlights;

  } catch (error) {
    console.error("Error fetching event highlights:", error);
    return [];
  }
}; 