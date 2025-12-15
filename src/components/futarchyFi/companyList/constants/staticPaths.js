// Static path list for hardcoded proposal addresses
// These will use the markets/[proposalId] route format instead of query parameters

export const STATIC_PROPOSAL_PATHS = [
  "0xBFE2b1B3746e401081C2abb56913c2d7042FA94d",
  // Add more proposal addresses here as needed
];

// Helper function to check if a proposalId should use static path
export const useStaticPath = (proposalId) => {
  return STATIC_PROPOSAL_PATHS.includes(proposalId);
};

// Helper function to generate the correct market URL
export const generateMarketUrl = (proposalId) => {
  // Always use the new markets path format
  return `/markets/${proposalId}`;
}; 