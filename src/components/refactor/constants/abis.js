// Futarchy Factory ABI
export const FUTARCHY_FACTORY_ABI = [
  'function createProposal((string,address,address,string,string,uint256,uint32)) returns (address)',
  'function proposals(uint256) view returns (address)',
  'function marketsCount() view returns (uint256)'
];

// Additional ABIs can be added here as needed
export const ERC20_ABI = [
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address,address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
  'function transfer(address,uint256) returns (bool)'
]; 