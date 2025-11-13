export const FUTARCHY_ROUTER_ABI = [
  {
    "inputs": [
      {
        "internalType": "contract FutarchyProposal",
        "name": "proposal",
        "type": "address"
      },
      {
        "internalType": "contract IERC20",
        "name": "collateralToken",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "splitPosition",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "contract FutarchyProposal",
        "name": "proposal",
        "type": "address"
      },
      {
        "internalType": "contract IERC20",
        "name": "collateralToken",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "mergePositions",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
]; 