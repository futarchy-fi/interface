export const ERC20_ABI = [
  // Balance
  {
    "name": "balanceOf",
    "inputs": [{ "type": "address", "name": "account" }],
    "outputs": [{ "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  // Allowance
  {
    "name": "allowance",
    "inputs": [
      { "type": "address", "name": "owner" },
      { "type": "address", "name": "spender" }
    ],
    "outputs": [{ "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  // Approve
  {
    "name": "approve",
    "inputs": [
      { "type": "address", "name": "spender" },
      { "type": "uint256", "name": "amount" }
    ],
    "outputs": [{ "type": "bool" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // Transfer
  {
    "name": "transfer",
    "inputs": [
      { "type": "address", "name": "recipient" },
      { "type": "uint256", "name": "amount" }
    ],
    "outputs": [{ "type": "bool" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // TransferFrom
  {
    "name": "transferFrom",
    "inputs": [
      { "type": "address", "name": "sender" },
      { "type": "address", "name": "recipient" },
      { "type": "uint256", "name": "amount" }
    ],
    "outputs": [{ "type": "bool" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // Symbol
  {
    "name": "symbol",
    "inputs": [],
    "outputs": [{ "type": "string" }],
    "stateMutability": "view",
    "type": "function"
  },
  // Name
  {
    "name": "name",
    "inputs": [],
    "outputs": [{ "type": "string" }],
    "stateMutability": "view",
    "type": "function"
  },
  // Decimals
  {
    "name": "decimals",
    "inputs": [],
    "outputs": [{ "type": "uint8" }],
    "stateMutability": "view",
    "type": "function"
  },
  // Total Supply
  {
    "name": "totalSupply",
    "inputs": [],
    "outputs": [{ "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
]; 