import axios from "axios";

// Mock data for debug mode
const mockProposals = [
  {
    proposalID: "1",
    approvalStatus: "approved",
    countdownFinish: true,
    timestamp: Date.now() / 1000 - 86400 * 30, // 30 days ago
    endTime: Date.now() / 1000 - 86400 * 15, // 15 days ago
    tags: ["Governance", "Treasury"],
    prices: { approval: "$1.12", refusal: "$1.03" },
    proposalTitle: "FutarchyFi Quarterly Budget",
    proposalsDocMarket: [{ proposalsDoc: "doc1", proposalMarket: "market1" }],
    participatingUsers: [
      { address: "0x1234...5678", amount: "1,000 GNO" },
      { address: "0x8765...4321", amount: "500 GNO" },
    ],
  },
  {
    proposalID: "2",
    approvalStatus: "refused",
    countdownFinish: true,
    timestamp: Date.now() / 1000 - 86400 * 15, // 15 days ago
    endTime: Date.now() / 1000 - 86400 * 5, // 5 days ago
    tags: ["Protocol", "Security"],
    prices: { approval: "$1.03", refusal: "$0.78" },
    proposalTitle: "FutarchyFi Token Buyback Program",
    proposalsDocMarket: [{ proposalsDoc: "doc2", proposalMarket: "market2" }],
    participatingUsers: [
      { address: "0x2345...6789", amount: "2,500 GNO" },
      { address: "0x9876...5432", amount: "1,200 GNO" },
    ],
  },
  {
    proposalID: "3",
    approvalStatus: "ongoing",
    countdownFinish: false,
    timestamp: Date.now() / 1000 - 86400 * 2, // 2 days ago
    endTime: Date.now() / 1000 + 86400 * 5, // 5 days from now
    tags: ["Development", "Infrastructure"],
    prices: { approval: "$1.45", refusal: "$0.95" },
    proposalTitle: "FutarchyFi Protocol Upgrade Implementation",
    proposalsDocMarket: [{ proposalsDoc: "doc3", proposalMarket: "market3" }],
    participatingUsers: [
      { address: "0x3456...7890", amount: "3,000 GNO" },
      { address: "0x0987...6543", amount: "1,800 GNO" },
    ],
  },
];

// Helper function to create timestamps
const createTimestamp = (dateString) => {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    console.error("Invalid date:", dateString);
    return null;
  }
  return date.getTime() / 1000;
};

// Function to format address for display
const formatAddress = (address) => {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

// Function to format price values
const formatPrice = (price) => {
  if (!price) return "$0.00";
  // Remove the 'fake_' prefix if it exists and add dollar sign
  return `$${price.replace("fake_", "")}`;
};

// Function to simulate API delay
const simulateDelay = () => {
  const minDelay = 500; // 0.5 seconds
  const maxDelay = 2000; // 2 seconds
  const randomDelay =
    Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
  return new Promise((resolve) => setTimeout(resolve, randomDelay));
};

// Main function to fetch and transform proposals data
export const fetchAndTransformProposals = async () => {
  try {
    const isDebugMode = process.env.NEXT_PUBLIC_DEBUG_MODE?.toLowerCase() === "true";

    if (isDebugMode) {
      await simulateDelay();
      return mockProposals;
    }

    if (!process.env.NEXT_PUBLIC_API_URL) {
      throw new Error("API URL not configured");
    }

    const response = await axios.get(
      `${process.env.NEXT_PUBLIC_API_URL}/v3/conditional?conditional_symbol=all`
    );
    
    // Transform the array of proposals
    const transformedProposals = response.data.map(proposal => ({
      proposalID: proposal.base_market_id.toString(),
      approvalStatus: proposal.enviroment_config.status.active ? "pending" : "refused",
      countdownFinish: false,
      timestamp: createTimestamp(proposal.start_date),
      endTime: createTimestamp(proposal.start_date),
      tags: proposal.metadata.type ? [proposal.metadata.type] : [],
      prices: {
        approval: "$0.00",
        refusal: "$0.00",
      },
      proposalTitle: proposal.metadata.name,
      proposalsDocMarket: [{
        proposalsDoc: proposal.metadata.description,
        proposalMarket: proposal.symbol,
      }],
      participatingUsers: [],
    }));

    return transformedProposals;
  } catch (error) {
    console.error("Error fetching or transforming proposals:", error);
    throw error;
  }
};

// Optional: Export helper functions for testing
export const helpers = {
  createTimestamp,
  formatAddress,
  formatPrice,
};
