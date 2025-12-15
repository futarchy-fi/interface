import axios from "axios";
import { fetchCompanyData } from "../../proposalsList/page/proposalsPage/ProposalsPageDataTransformer";

// Mock highlight data using the existing proposals data
const mockHighlights = {
  "futarchyfi": [
    {
      proposalId: "FUT-3",
      companyLogo: "/assets/futarchy-logo.svg",
      proposalTitle: "Protocol Upgrade Implementation",
      authorName: "John Anderson",
      stats: {
        volume: "$1.45M",
        trades: 156
      },
      endTime: Date.now() / 1000 + 86400 * 5,
      timestamp: Date.now() / 1000 - 86400 * 2,
    },
    {
      proposalId: "FUT-4",
      companyLogo: "/assets/futarchy-logo.svg",
      proposalTitle: "Treasury Reallocation Strategy",
      authorName: "Sarah Mitchell",
      stats: {
        volume: "$2.1M",
        trades: 234
      },
      endTime: Date.now() / 1000 + 86400 * 7,
      timestamp: Date.now() / 1000 - 86400 * 1,
    }
  ],
  "gnosis": [
    {
      proposalId: "GNO-1",
      companyLogo: "/assets/gnosis-dao-logo.png",
      proposalTitle: "Chain Bridge Upgrade",
      authorName: "Michael Chen",
      stats: {
        volume: "$3.2M",
        trades: 412
      },
      endTime: Date.now() / 1000 + 86400 * 6,
      timestamp: Date.now() / 1000 - 86400 * 3,
    },
    {
      proposalId: "GNO-4",
      companyLogo: "/assets/gnosis-dao-logo.png",
      proposalTitle: "Gnosis Protocol V3 Implementation",
      authorName: "Emma Thompson",
      stats: {
        volume: "$1.78M",
        trades: 198
      },
      endTime: Date.now() / 1000 + 86400 * 6, // 6 days from now
      timestamp: Date.now() / 1000 - 86400 * 4, // Started 4 days ago
    }
  ],
  "skymavis": [
    {
      proposalId: "SKY-1",
      companyLogo: "/assets/skymavis-logo-bg.png",
      proposalTitle: "Axie Infinity Season 24 Update",
      authorName: "David Wilson",
      stats: {
        volume: "$1.8M",
        trades: 289
      },
      endTime: Date.now() / 1000 + 86400 * 4,
      timestamp: Date.now() / 1000 - 86400 * 2,
    }
  ]
};

// Helper function to calculate time progress
const calculateTimeProgress = (startTime, endTime) => {
  const now = Date.now() / 1000;
  const totalDuration = endTime - startTime;
  const elapsed = now - startTime;
  const progress = (elapsed / totalDuration) * 100;
  
  // Ensure progress is between 0 and 100
  return Math.min(Math.max(progress, 0), 100);
};

// Helper function to simulate API delay
const simulateDelay = () => {
  const minDelay = 500;
  const maxDelay = 2000;
  const randomDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
  return new Promise((resolve) => setTimeout(resolve, randomDelay));
};

// Main function to fetch highlight data
export const fetchHighlightData = async (companyId = "gnosis") => {
  try {
    // Get company data from the proposals data transformer
    const companyData = await fetchCompanyData(companyId);
    
    if (!companyData || !companyData.proposals || companyData.proposals.length === 0) {
      console.log("No proposals found in company data");
      return [];
    }

    // Transform the first ongoing proposal into highlight format
    const ongoingProposal = companyData.proposals.find(p => p.approvalStatus === "ongoing");
    
    if (!ongoingProposal) {
      console.log("No ongoing proposals found");
      return [];
    }

    const highlight = {
      proposalId: ongoingProposal.proposalID,
      companyLogo: companyData.logo || "/assets/gnosis-dao-logo.png",
      proposalTitle: ongoingProposal.proposalTitle,
      authorName: "Unknown", // This might need to be added to the API response later
      stats: {
        volume: ongoingProposal.prices.approval, // Using approval price as volume
        trades: ongoingProposal.participatingUsers?.length || 0
      },
      endTime: ongoingProposal.endTime,
      timestamp: ongoingProposal.timestamp,
      timeProgress: calculateTimeProgress(
        ongoingProposal.timestamp,
        ongoingProposal.endTime
      )
    };

    return [highlight];

  } catch (error) {
    console.error("Error fetching highlights:", error);
    return [];
  }
}; 