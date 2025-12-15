# Futarchy Interactions Reference

This document serves as a technical reference for the core interactions within the Futarchy system. It maps user actions to specific smart contract calls and logic.

## 1. Add Collateral (Split)

**User Action**: "Add Collateral" or "Split"
**Goal**: Convert base collateral (e.g., sDAI) into conditional tokens (YES + NO).

### Logic
*   **Input**: Amount of collateral to split.
*   **Output**: Equal amount of YES and NO tokens.

### Interaction
1.  **Approve**: User approves `FutarchyRouter` to spend `CollateralToken`.
2.  **Call**: `FutarchyRouter.splitPosition(proposal, collateralToken, amount)`

```javascript
// Example Call
await router.splitPosition(
  marketAddress,
  baseTokenAddress, // e.g. sDAI
  amountInWei
);
```

---

## 2. Remove Collateral (Merge)

**User Action**: "Remove Collateral" or "Merge"
**Goal**: Combine equal amounts of YES and NO tokens to redeem the underlying collateral.

### Logic
*   **Input**: Amount of YES and NO tokens to merge (must be equal).
*   **Output**: Base collateral (e.g., sDAI).

### Interaction
1.  **Approve YES**: User approves `FutarchyRouter` to spend YES tokens.
2.  **Approve NO**: User approves `FutarchyRouter` to spend NO tokens.
3.  **Call**: `FutarchyRouter.mergePositions(proposal, collateralToken, amount)`

```javascript
// Example Call
await router.mergePositions(
  marketAddress,
  baseTokenAddress, // e.g. sDAI
  amountInWei
);
```

---

## 3. Smart Swap (Split-Swap)

**User Action**: "Buy YES" or "Buy NO" (using Collateral)
**Goal**: Efficiently obtain a specific outcome token by splitting only what is needed and swapping the rest.

### Logic: "Smart Split"
The system calculates the minimal amount of collateral to split to avoid capital inefficiency.

**Formula**:
`SplitAmount = Max(0, RequiredInput - CurrentBalance)`

### Interaction Flow
1.  **Check Balance**: System checks if user already has enough of the *input* token (e.g., NO tokens to swap for YES).
2.  **Split (If Needed)**:
    *   If balance < required, call `splitPosition(SplitAmount)`.
3.  **Approve**:
    *   **Gnosis**: Approve Router (Swapr/Sushi) to spend input token.
    *   **Mainnet**: Approve Permit2 -> Approve Universal Router.
4.  **Swap**:
    *   **Gnosis**: `executeAlgebraExactSingle` or `executeSushiV3RouterSwap`.
    *   **Mainnet**: `executeUniswapV3Swap` (Universal Router).

---

## 4. Redeem (Claim Winnings)

**User Action**: "Redeem"
**Goal**: Claim collateral + bonus from winning tokens after market resolution.

### Interaction
1.  **Approve**: Approve both Company and Currency token representations (Collateral1 & Collateral2).
2.  **Call**: `FutarchyRouter.redeemProposal(proposal, amount1, amount2)`

```javascript
// Example Call
await router.redeemProposal(
  marketAddress,
  companyAmount,
  currencyAmount
);
```
