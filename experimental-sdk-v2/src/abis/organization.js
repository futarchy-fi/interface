export const ORGANIZATION_ABI = [
    "function createAndAddProposalMetadata(address pool, string question, string event, string description, string metadata, string metadataURI) external returns (address)",
    "function proposals(uint256) external view returns (address)",
    "function getProposals() external view returns (address[])",
    "function owner() external view returns (address)",
    "function transferOwnership(address newOwner) external"
];
