export { ERC20_ABI } from './ERC20';
export { FUTARCHY_ROUTER_ABI } from './FutarchyRouter';

export const FUTARCHY_PROPOSAL_ABI = [
  {
    "inputs": [],
    "name": "collateralToken1",
    "outputs": [{"internalType": "contract IERC20", "name": "", "type": "address"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "collateralToken2", 
    "outputs": [{"internalType": "contract IERC20", "name": "", "type": "address"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "conditionId",
    "outputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "encodedQuestion",
    "outputs": [{"internalType": "string", "name": "", "type": "string"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "futarchyProposalParams",
    "outputs": [
      {"internalType": "bytes32", "name": "conditionId", "type": "bytes32"},
      {"internalType": "contract IERC20", "name": "collateralToken1", "type": "address"},
      {"internalType": "contract IERC20", "name": "collateralToken2", "type": "address"},
      {"internalType": "bytes32", "name": "parentCollectionId", "type": "bytes32"},
      {"internalType": "uint256", "name": "parentOutcome", "type": "uint256"},
      {"internalType": "address", "name": "parentMarket", "type": "address"},
      {"internalType": "bytes32", "name": "questionId", "type": "bytes32"},
      {"internalType": "string", "name": "encodedQuestion", "type": "string"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "marketName",
    "outputs": [{"internalType": "string", "name": "", "type": "string"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "numOutcomes",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "name": "outcomes",
    "outputs": [{"internalType": "string", "name": "", "type": "string"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "parentCollectionId",
    "outputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "parentMarket",
    "outputs": [{"internalType": "address", "name": "", "type": "address"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "parentOutcome",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "parentWrappedOutcome",
    "outputs": [
      {"internalType": "contract IERC20", "name": "wrapped1155", "type": "address"},
      {"internalType": "bytes", "name": "data", "type": "bytes"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "questionId",
    "outputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "realityProxy",
    "outputs": [{"internalType": "contract FutarchyRealityProxy", "name": "", "type": "address"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "resolve",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "index", "type": "uint256"}],
    "name": "wrappedOutcome",
    "outputs": [
      {"internalType": "contract IERC20", "name": "wrapped1155", "type": "address"},
      {"internalType": "bytes", "name": "data", "type": "bytes"}
    ],
    "stateMutability": "view",
    "type": "function"
  }
]; 