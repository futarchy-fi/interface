# Full Lifecycle Example: Ethereum Mainnet (Chain 1)

This document walks through a complete user journey on Ethereum Mainnet, focusing on a **Conditional Market** (Impact Betting) scenario.

**Scenario**:
*   **Market**: "Will ETH hit $5k by Dec 31?"
*   **User Goal**: Bet on the **impact** of the event on an asset (e.g., "Buy ETH if YES").
*   **Strategy**: **Conditional Trade**.
    *   *Logic*: "I want to hold ETH if the event happens. If the event *doesn't* happen, I want my original capital back."
*   **Investment**: 100 sDAI.
*   **Outcome**: Market resolves to **YES**.

---

## Phase 1: Enter Position (Split-Swap)

**Goal**: Convert 100 sDAI into a position where you hold **YES_ETH** (Exposure to ETH if YES) and **NO_sDAI** (Money back if NO).

### Step 1: "Smart Split" (Add Collateral)
The system splits your collateral into conditional tokens for both outcomes.

*   **Action**: Split 100 sDAI into 100 YES_sDAI + 100 NO_sDAI.
*   **Contract**: `FutarchyRouter`
*   **Function**: `splitPosition`
*   **Call**:
    ```javascript
    router.splitPosition(marketAddress, sDAIAddress, 100 ether)
    ```

### Step 2: Swap for Conditional Asset
You swap your `YES_sDAI` for `YES_ETH`. You **keep** your `NO_sDAI` as a hedge (refund) if the event fails.

*   **Action**: Swap 100 YES_sDAI -> YES_ETH.
*   **Router**: `Universal Router` (via Permit2).

#### A. Approve Permit2
*   **Contract**: YES_sDAI Token (ERC20)
*   **Function**: `approve`
*   **Call**: `yesSdaiToken.approve(PERMIT2_ADDRESS, MAX_UINT256)`

#### B. Approve Universal Router
*   **Contract**: Permit2
*   **Function**: `approve`
*   **Call**: `permit2.approve(yesSdaiToken, UNIVERSAL_ROUTER, amount, expiration)`

#### C. Execute Swap
*   **Contract**: `Universal Router`
*   **Function**: `execute`
*   **Commands**: `V3_SWAP_EXACT_IN` + `SWEEP`
*   **Result**: User sells 100 YES_sDAI, receives ~X YES_ETH.
*   **Final Holding**: ~X YES_ETH + 100 NO_sDAI.

---

## Phase 2: Exit Position (Merge) - *Optional*

*If the user wanted to exit early (before resolution).*

**Scenario**: User wants to cash out.
**Requirement**: User needs equal amounts of YES_sDAI and NO_sDAI to merge.

1.  **Swap Back**: Swap YES_ETH -> YES_sDAI.
2.  **Merge**:
    *   **Call**: `router.mergePositions(market, sDAI, amount)`
    *   **Result**: Burn YES_sDAI + NO_sDAI, receive sDAI.

---

## Phase 3: Claim Winnings (Redeem)

**Scenario**: Market resolves to **YES**.
**User Holding**: ~X YES_ETH + 100 NO_sDAI.

### Outcome Analysis
*   **YES_ETH**: Since YES happened, these redeem for real ETH. (Profit/Loss depends on ETH price).
*   **NO_sDAI**: Since YES happened, these are worthless (0 sDAI).
    *   *Note*: If NO had happened, NO_sDAI would redeem for 100 sDAI (Money Back), and YES_ETH would be worthless.

### Step 1: Approve Tokens
*   **Approve Company Token (YES_ETH)**: `yesEthToken.approve(ROUTER, MAX)`
*   **Approve Currency Token (YES_sDAI)**: `yesSdaiToken.approve(ROUTER, MAX)` (If holding any)

### Step 2: Redeem
*   **Contract**: `FutarchyRouter`
*   **Function**: `redeemProposal`
*   **Call**:
    ```javascript
    router.redeemProposal(
      marketAddress,
      xAmount, // Amount of Company (YES_ETH) tokens
      0        // Amount of Currency (YES_sDAI) tokens
    )
    ```
*   **Result**: User receives ETH.
