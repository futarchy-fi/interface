# Redeem Example (Claim Winnings)

This document illustrates the "Redeem" operation, where a user claims their winnings after a market has resolved.

## Scenario
*   **Market Result**: Resolved to **YES**.
*   **User**: Has 100 YES tokens (winning) and 50 NO tokens (losing).
*   **Goal**: Redeem the 100 YES tokens for the underlying collateral + bonus.

## Workflow

The redemption process involves approving both the "Company" and "Currency" token representations (Collateral1 and Collateral2) because the router needs to handle the unwrapping/burning process for the specific outcome.

### 1. Approve Company Token (Collateral1)
*   **Contract**: Company Token Address
*   **Function**: `approve(spender, amount)`
*   **Args**:
    *   `spender`: `FUTARCHY_ROUTER_ADDRESS`
    *   `amount`: `MAX_UINT256`

### 2. Approve Currency Token (Collateral2)
*   **Contract**: Currency Token Address
*   **Function**: `approve(spender, amount)`
*   **Args**:
    *   `spender`: `FUTARCHY_ROUTER_ADDRESS`
    *   `amount`: `MAX_UINT256`

### 3. Execute Redemption
*   **Contract**: `FutarchyRouter`
*   **Function**: `redeemProposal(proposal, collateral1Amount, collateral2Amount)`
*   **Args**:
    *   `proposal`: Market/Proposal Address
    *   `collateral1Amount`: Amount of Company tokens to redeem (in Wei)
    *   `collateral2Amount`: Amount of Currency tokens to redeem (in Wei)

## Code Snippet (from `RedemptionModal.jsx`)

```javascript
const txData = routerInterface.encodeFunctionData('redeemProposal', [
  marketAddress,
  companyAmountInWei,
  currencyAmountInWei,
]);

// Sent via walletClient or signer
await walletClient.sendTransaction({
  to: routerAddress,
  data: txData,
  gas: BigInt(redeemGasLimit),
});
```
