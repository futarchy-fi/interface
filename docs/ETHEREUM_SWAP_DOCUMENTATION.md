# Ethereum Swap Integration Documentation

This document outlines the technical implementation of the `ConfirmSwapModal` on the Ethereum chain, detailing the contract interactions, ABIs, and workflow for executing swaps using Uniswap V3 with Permit2.

## 1. Key Contracts & Addresses (Ethereum Mainnet)

| Contract | Address | Description |
|----------|---------|-------------|
| **Futarchy Router** | `0xAc9Bf8EbA6Bd31f8E8c76f8E8B2AAd0BD93f98Dc` | Handles collateral splitting (minting outcome tokens). |
| **Permit2** | `0x000000000022D473030F116dDEE9F6B43aC78BA3` | Canonical Permit2 contract for efficient approvals. |
| **Universal Router** | `0x66a9893cc07d91d95644aedd05d03f95e1dba8af` | Uniswap's Universal Router for executing swaps. |
| **Uniswap V3 Router** | `0xE592427A0AEce92De3Edee1F18E0157C05861564` | Legacy SwapRouter (fallback, usually not used on Mainnet). |

## 2. Workflow Overview

The swap process on Ethereum is divided into two main steps:
1.  **Collateral Management**: Preparing outcome tokens (if "Buy" or "Sell" requires minting).
2.  **Swap Execution**: Using Permit2 and Universal Router to swap tokens.

### Step 1: Collateral (Split Position)
*Only performed if the user needs to mint outcome tokens (e.g., buying a position).*

1.  **Approve Router**: The user approves the `FutarchyRouter` to spend their Base Token (e.g., USDC, DAI).
2.  **Split Position**: The user calls `splitPosition` on the `FutarchyRouter` to mint "Yes" and "No" tokens from the collateral.

### Step 2: Swap (Permit2 + Universal Router)
*This flow applies when `chain.id === 1` (Ethereum Mainnet).*

1.  **Approve Token -> Permit2**:
    *   Check standard ERC20 allowance of the Token for `PERMIT2_ADDRESS`.
    *   If insufficient, call `Token.approve(PERMIT2_ADDRESS, MaxUint256)`.
2.  **Approve Permit2 -> Universal Router**:
    *   Check Permit2 allowance for `UNISWAP_UNIVERSAL_ROUTER`.
    *   If insufficient, call `Permit2.approve(token, UNISWAP_UNIVERSAL_ROUTER, amount, expiration)`.
3.  **Execute Swap**:
    *   Call `UniversalRouter.execute()` with encoded V3 Swap and Sweep commands.

## 3. ABIs and Data Structures

### A. Futarchy Router ABI (Partial)
Used for splitting collateral.
```json
[
  {
    "inputs": [
      { "internalType": "contract FutarchyProposal", "name": "proposal", "type": "address" },
      { "internalType": "contract IERC20", "name": "collateralToken", "type": "address" },
      { "internalType": "uint256", "name": "amount", "type": "uint256" }
    ],
    "name": "splitPosition",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
]
```

### B. Permit2 ABI (Partial)
Used for the two-step approval process.
```json
[
  {
    "name": "approve",
    "type": "function",
    "stateMutability": "nonpayable",
    "inputs": [
      { "name": "token", "type": "address" },
      { "name": "spender", "type": "address" },
      { "name": "amount", "type": "uint160" },
      { "name": "expiration", "type": "uint48" }
    ],
    "outputs": []
  },
  {
    "name": "allowance",
    "type": "function",
    "stateMutability": "view",
    "inputs": [
      { "name": "owner", "type": "address" },
      { "name": "token", "type": "address" },
      { "name": "spender", "type": "address" }
    ],
    "outputs": [
      { "name": "amount", "type": "uint160" },
      { "name": "expiration", "type": "uint48" },
      { "name": "nonce", "type": "uint48" }
    ]
  }
]
```

### C. Universal Router ABI (Partial)
Used for executing the swap.
```json
[
  {
    "name": "execute",
    "type": "function",
    "stateMutability": "payable",
    "inputs": [
      { "name": "commands", "type": "bytes" },
      { "name": "inputs", "type": "bytes[]" },
      { "name": "deadline", "type": "uint256" }
    ],
    "outputs": []
  }
]
```

## 4. Detailed Call Flow (Sequence)

### 1. Check & Approve Token for Permit2
**Call:** `Token.allowance(User, PERMIT2_ADDRESS)`
*   **If < Amount:**
    *   **Transaction:** `Token.approve(PERMIT2_ADDRESS, MaxUint256)`

### 2. Check & Approve Permit2 for Universal Router
**Call:** `Permit2.allowance(User, Token, UNISWAP_UNIVERSAL_ROUTER)`
*   **If < Amount OR Expired:**
    *   **Transaction:** `Permit2.approve(Token, UNISWAP_UNIVERSAL_ROUTER, MaxUint160, Expiration)`
    *   *Note: Expiration is set to ~1 year in the future.*

### 3. Execute Swap via Universal Router
**Transaction:** `UniversalRouter.execute(commands, inputs, deadline)`

*   **Commands (bytes):** `0x0004` (Hex concatenation of command IDs)
    *   `0x00`: `V3_SWAP_EXACT_IN`
    *   `0x04`: `SWEEP`

*   **Inputs (bytes[]):**
    1.  **V3 Swap Parameters (Encoded):**
        *   `recipient`: `0x000...002` (MsgSender constant)
        *   `amountIn`: Input amount (wei)
        *   `amountOutMin`: Minimum output amount (wei)
        *   `path`: Packed bytes (`tokenIn` + `fee` + `tokenOut`)
        *   `payerIsUser`: `true`
    2.  **Sweep Parameters (Encoded):**
        *   `token`: `tokenOut`
        *   `recipient`: `UserAddress`
        *   `amountMin`: `amountOutMin`

## 5. Code References
*   **Modal Logic:** `src/components/futarchyFi/marketPage/ConfirmSwapModal.jsx`
*   **Uniswap/Permit2 Helpers:** `src/utils/uniswapV3Helper.js`
*   **Constants & Router Address:** `src/components/futarchyFi/marketPage/constants/contracts.js`
