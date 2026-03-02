export const AGGREGATOR_ABI = [
    "function createAndAddOrganizationMetadata(string name, string description, string metadata, string metadataURI) external returns (address)",
    "function organizations(uint256) external view returns (address)",
    "function getOrganizations() external view returns (address[])",
    "function owner() external view returns (address)",
    "function transferOwnership(address newOwner) external"
];
