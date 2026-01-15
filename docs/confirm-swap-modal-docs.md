# Component Documentation: ConfirmSwapModal

**File**: `src/components/futarchyFi/marketPage/ConfirmSwapModal.jsx`

The `ConfirmSwapModal` is the central orchestration component for the Futarchy Swap workflow. It manages the user interface and state transitions for the multi-step "Split-Swap" process.

## Key Responsibilities

1.  **Workflow Orchestration**: Manages the sequence of Split -> Approve -> Swap.
2.  **Chain Abstraction**: Dynamically selects the execution strategy based on the connected chain (Gnosis vs. Mainnet).
3.  **User Feedback**: Provides real-time status updates, error handling, and transaction confirmation.

## Props

| Prop | Type | Description |
| :--- | :--- | :--- |
| `transactionData` | `Object` | Contains details about the swap (action, amount, outcome). |
| `additionalCollateralNeeded` | `String` | **Crucial**: The amount of collateral to split. Calculated by the parent (`ShowcaseSwapComponent`) using the "Smart Split" logic. |
| `proposalId` | `String` | ID of the current proposal/market. |
| `onClose` | `Function` | Callback to close the modal. |
| `onTransactionComplete` | `Function` | Callback when the entire flow is finished. |

## State Machine & Logic

### 1. Initialization
*   On mount, the component determines the `selectedSwapMethod`.
*   **Mainnet (Chain 1)**: Forces `uniswapSdk`.
*   **Gnosis (Chain 100)**: Defaults to `algebra` (Swapr) or `cowswap`.

### 2. "Smart Split" Execution
*   **Check**: `if (parseFloat(additionalCollateralNeeded) > 0)`
*   **Action**: Calls `handleCollateralAction`.
*   **Implementation**:
    *   Checks user's base token balance (e.g., sDAI).
    *   Approves the `FutarchyRouter` if needed.
    *   Calls `router.splitPosition()`.

### 3. Approval & Swap
The logic branches based on `selectedSwapMethod`:

#### A. Gnosis Chain (`algebra` / `sushiswap`)
*   **Helper**: `sushiswapV3Helper.js`
*   **Approval**: Standard ERC20 approval to the router (Sushi V3 or Algebra).
*   **Swap**: Executes the swap directly on the router.

#### B. Ethereum Mainnet (`uniswapSdk`)
*   **Helper**: `uniswapSdk.js`
*   **Approval**: Two-step Permit2 flow.
    1.  Approve Token -> Permit2.
    2.  Approve Permit2 -> Universal Router.
*   **Swap**: Executes via Universal Router.

## Key Functions

*   `handleConfirmSwap`: Main entry point. Triggers the flow.
*   `handleCollateralAction`: Handles the split transaction.
*   `handleTokenApproval`: Generic ERC20 approval handler.
*   `getStepsData`: Generates the UI steps (e.g., "Step 1: Split", "Step 2: Approve") dynamically based on the chain and state.

## Integration with Parent (`ShowcaseSwapComponent`)

The "Smart Split" calculation happens **upstream** in `ShowcaseSwapComponent.jsx`. The modal is "dumb" regarding *how much* to split; it just executes the split for the amount passed in `additionalCollateralNeeded`.

```javascript
// ShowcaseSwapComponent.jsx logic
const additionalCollateralNeeded = amountInWei.sub(existingBalance);
// Passed to modal
<ConfirmSwapModal additionalCollateralNeeded={format(additionalCollateralNeeded)} ... />
```
