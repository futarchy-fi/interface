# Merge Example (Remove Collateral)

This document illustrates the "Merge" operation, where a user combines equal amounts of YES and NO outcome tokens to redeem the underlying collateral (e.g., sDAI).

## Scenario
*   **User**: Has 100 YES and 100 NO tokens.
*   **Goal**: Merge them to get back 100 sDAI.
*   **Chain**: Gnosis Chain (ID: 100) or Mainnet (ID: 1).

## Workflow

### 1. Approve YES Token
The router needs permission to burn your YES tokens.

*   **Contract**: YES Token Address (ERC20)
*   **Function**: `approve(spender, amount)`
*   **Args**:
    *   `spender`: `FUTARCHY_ROUTER_ADDRESS`
    *   `amount`: `MAX_UINT256` (or exact amount)

### 2. Approve NO Token
The router needs permission to burn your NO tokens.

*   **Contract**: NO Token Address (ERC20)
*   **Function**: `approve(spender, amount)`
*   **Args**:
    *   `spender`: `FUTARCHY_ROUTER_ADDRESS`
    *   `amount`: `MAX_UINT256` (or exact amount)

### 3. Execute Merge
The router burns the conditional tokens and releases the collateral.

*   **Contract**: `FutarchyRouter`
*   **Function**: `mergePositions(proposal, collateralToken, amount)`
*   **Args**:
    *   `proposal`: Market/Proposal Address
    *   `collateralToken`: Base Token Address (e.g., sDAI)
    *   `amount`: Amount of collateral to redeem (e.g., 100 * 10^18)

## Code Snippet (from `CollateralModal.jsx`)

```javascript
const mergeTx = await futarchyRouter.mergePositions(
  marketAddress,
  baseToken.address,
  amountInWei,
  {
    gasLimit: 2000000, // High gas limit for complex operation
    // ... gas price settings
  }
);
```
