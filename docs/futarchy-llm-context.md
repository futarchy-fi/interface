# Futarchy LLM Context Guide

This guide provides a comprehensive overview of the Futarchy application's core operations, pointing to specific architectural documentation and examples. Use this context to understand how to implement, debug, or explain the system's workflows.

## 1. Swap Architecture ("Split-Swap")

The primary mechanism for trading conditional tokens.

*   **Gnosis Chain (ID 100)**: [swap-architecture-chain-100.md](./swap-architecture-chain-100.md)
    *   Uses Swapr (Algebra) or SushiSwap V3.
    *   Standard ERC20 Approvals.
*   **Ethereum Mainnet (ID 1)**: [swap-architecture-chain-1.md](./swap-architecture-chain-1.md)
    *   Uses Uniswap V3 + Universal Router.
    *   Uses **Permit2** for approvals.
*   **Component**: [confirm-swap-modal-docs.md](./confirm-swap-modal-docs.md)
    *   Details the `ConfirmSwapModal` state machine and "Smart Split" logic.

## 2. Collateral Management

### Merge (Remove Collateral)
Combining YES and NO tokens to redeem the underlying collateral.

*   **Guide**: [merge-example.md](./merge-example.md)
*   **Component**: `CollateralModal.jsx`
*   **Key Function**: `FutarchyRouter.mergePositions`

### Split (Add Collateral)
Splitting collateral into YES and NO tokens (usually done automatically during Swap).

*   **Logic**: See "Smart Split" in [swap-architecture-chain-100.md](./swap-architecture-chain-100.md).
*   **Key Function**: `FutarchyRouter.splitPosition`

## 3. Redemption (Claim Winnings)

Claiming collateral after a market has resolved.

*   **Guide**: [redeem-example.md](./redeem-example.md)
*   **Component**: `RedemptionModal.jsx`
*   **Key Function**: `FutarchyRouter.redeemProposal`

## 4. Key Contracts

*   **FutarchyRouter**: Handles Split, Merge, and Redeem operations.
*   **Universal Router (Mainnet)**: Handles Swaps on Ethereum.
*   **Permit2 (Mainnet)**: Handles Token Approvals for Universal Router.

## 5. Quick Reference

*   **Interactions Cheat Sheet**: [futarchy-interactions-reference.md](./futarchy-interactions-reference.md)
    *   Concise guide to Split, Merge, Smart Swap, and Redeem interactions.
*   **Full Lifecycle Example**: [full-lifecycle-example-chain-1.md](./full-lifecycle-example-chain-1.md)
    *   End-to-end walkthrough of a user journey on Ethereum Mainnet.
