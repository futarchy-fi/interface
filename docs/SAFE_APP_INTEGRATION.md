# Safe App Integration Documentation

## Overview

This document describes the Gnosis Safe (Safe App) integration in the Futarchy Web application. The integration enables seamless interaction with Gnosis Safe multisig wallets, providing a smooth user experience for Safe users performing futarchy operations.

## What is a Safe App?

Gnosis Safe (now Safe) is a multi-signature smart contract wallet that requires multiple approvals for transactions. Safe Apps are web applications that integrate with the Safe interface, allowing users to interact with dApps directly from their Safe wallet.

## Key Features

### 1. Safe Wallet Detection
The application automatically detects when a user is connected via a Gnosis Safe wallet using the `isSafeWallet()` utility function.

**Location:** `src/utils/ethersAdapters.js:268`

```javascript
export const isSafeWallet = (walletClient) => {
    const connectorName = walletClient?.connector?.name?.toLowerCase() || '';
    const connectorId = walletClient?.connector?.id?.toLowerCase() || '';
    // Check for explicit Safe connector or Gnosis Safe name
    return connectorName.includes('safe') ||
           connectorId.includes('safe') ||
           connectorName.includes('gnosis');
};
```

**Detection Logic:**
- Checks wallet connector name for "safe" or "gnosis"
- Checks wallet connector ID for "safe"
- Case-insensitive matching

### 2. Transaction Handling

When a Safe wallet is detected, the application modifies transaction handling to accommodate Safe's multisig approval workflow.

#### Standard Wallet Flow:
1. Send transaction
2. Wait for transaction confirmation (`.wait()`)
3. Proceed with next step

#### Safe Wallet Flow:
1. Send transaction to Safe
2. **Skip** `.wait()` call (prevents UI hanging)
3. Throw `SAFE_TRANSACTION_SENT` error
4. Show user feedback
5. Auto-close modals

**Why Skip `.wait()`?**

Safe transactions don't immediately execute on-chain. They require:
- Multiple signatures from Safe owners
- Manual execution after threshold is met
- Waiting would cause the UI to hang indefinitely

### 3. Implementation Pattern

The Safe App integration follows a consistent pattern across all transaction functions:

```javascript
// Send transaction
const tx = await contract.someFunction(args);
console.log('Transaction sent:', tx.hash);

// Check for Safe wallet
if (isSafeWallet(walletClient)) {
    console.log('Safe wallet detected - skipping wait()');
    onSafeTransaction?.(); // Trigger toast notification
    onClose?.(); // Auto-close modal
    throw new Error("SAFE_TRANSACTION_SENT"); // Signal to stop execution
}

// Standard wallet: wait for confirmation
const receipt = await tx.wait();
console.log('Transaction confirmed:', receipt);
```

## Integration Points

### 1. Swap Modal (`ConfirmSwapModal.jsx`)

**Location:** `src/components/futarchyFi/marketPage/ConfirmSwapModal.jsx`

**Safe Integration Points:**
- Line 1283-1286: Token approval transactions
- Line 1926: Swap transaction execution
- Line 2038: Alternative swap paths
- Line 2152: Fallback swap methods
- Line 2223: Market outcome swaps
- Line 2302: Conditional token swaps
- Line 2394: Direct AMM swaps
- Line 2498: Emergency swap fallbacks

**Error Handling:**
```javascript
// Line 1550 and 2749
if (error.message === "SAFE_TRANSACTION_SENT") {
    console.log('Safe transaction queued - operation complete');
    setSwapStatus('safe_pending');
    onClose();
    return; // Exit gracefully
}
```

### 2. Collateral Modal (`CollateralModal.jsx`)

**Location:** `src/components/futarchyFi/marketPage/collateralModal/CollateralModal.jsx`

**Safe Integration Points:**
- Line 564-568: Token approval for split/merge operations

**Implementation:**
```javascript
const approveTx = await tokenContract.approve(spenderAddress, MaxUint256);
console.log(`Approval transaction sent:`, approveTx.hash);

// Check for Safe wallet
if (isSafeWallet(walletClient)) {
    console.log('Safe wallet detected - skipping wait() and auto-closing');
    onSafeTransaction?.(); // Trigger toast
    onClose(); // Auto-close for Safe
    throw new Error("SAFE_TRANSACTION_SENT"); // Signal to stop execution
}

await approveTx.wait();
```

**Error Handling:**
```javascript
// Line 1684
if (error.message === "SAFE_TRANSACTION_SENT") {
    console.log('Safe transaction submitted successfully');
    return; // Exit without showing error
}
```

### 3. Uniswap SDK Integration (`uniswapSdk.js`)

**Location:** `src/utils/uniswapSdk.js`

**Safe Integration Points:**
- Line 379-381: Permit2 token approval
- Line 440-442: Permit2 router approval
- Line 601-603: Uniswap V3 swap execution

### 4. Uniswap V3 Helper (`uniswapV3Helper.js`)

**Location:** `src/utils/uniswapV3Helper.js`

**Safe Integration Points:**
- Line 325-327: Permit2 approval (first instance)
- Line 376-378: ERC20 approval
- Line 413-415: Permit2 approval (second instance)

### 5. SushiSwap V3 Helper (`sushiswapV3Helper.js`)

**Location:** `src/utils/sushiswapV3Helper.js`

**Safe Integration Points:**
- Line 284-286: Token approval for SushiSwap V3 swaps

## User Experience Flow

### Standard Wallet User:
1. Click "Confirm Swap" or "Add Collateral"
2. Approve transaction in wallet
3. Wait for on-chain confirmation
4. See success message
5. Modal closes automatically

### Safe Wallet User:
1. Click "Confirm Swap" or "Add Collateral"
2. Transaction appears in Safe interface
3. **Modal closes immediately** with toast notification
4. User sees: "Safe transaction queued - please approve in Safe interface"
5. User opens Safe interface
6. Collects required signatures
7. Executes transaction when threshold met

## Technical Benefits

### 1. Prevents UI Hanging
- No indefinite waiting for multisig approvals
- Clean user experience

### 2. Clear User Feedback
- Toast notifications inform users
- Clear messaging about next steps
- Users understand they need to approve in Safe

### 3. Graceful Error Handling
- `SAFE_TRANSACTION_SENT` is treated as success, not error
- No confusing error messages
- Clean exit from transaction flow

### 4. Compatible with Futarchy SDK
The Safe App integration works seamlessly alongside the Futarchy SDK:
- SDK handles futarchy operations (split, merge, swap)
- Safe integration handles transaction waiting behavior
- Both can be used together without conflicts

## Implementation Checklist

When adding Safe support to a new transaction function:

- [ ] Import `isSafeWallet` from `src/utils/ethersAdapters.js`
- [ ] After sending transaction, check `if (isSafeWallet(walletClient))`
- [ ] If Safe detected:
  - [ ] Log detection: `console.log('Safe wallet detected')`
  - [ ] Call callback: `onSafeTransaction?.()`
  - [ ] Close UI: `onClose?.()`
  - [ ] Throw error: `throw new Error("SAFE_TRANSACTION_SENT")`
- [ ] In error handler, check for `SAFE_TRANSACTION_SENT`
- [ ] Treat `SAFE_TRANSACTION_SENT` as success, not failure

## Example: Adding Safe Support to New Function

```javascript
import { isSafeWallet } from '../../../utils/ethersAdapters';

async function performTransaction(walletClient, onSafeTransaction, onClose) {
    try {
        // 1. Send transaction
        const tx = await contract.someMethod(params);
        console.log('Transaction sent:', tx.hash);

        // 2. Check for Safe wallet
        if (isSafeWallet(walletClient)) {
            console.log('[YourComponent] Safe wallet detected - skipping wait()');
            onSafeTransaction?.(); // Show toast
            onClose?.(); // Close modal
            throw new Error("SAFE_TRANSACTION_SENT");
        }

        // 3. Standard wallet: wait for confirmation
        const receipt = await tx.wait();
        console.log('Transaction confirmed:', receipt);

        // 4. Continue with standard flow
        // ...

    } catch (error) {
        // 5. Handle Safe transaction as success
        if (error.message === "SAFE_TRANSACTION_SENT") {
            console.log('Safe transaction queued successfully');
            return; // Exit gracefully
        }

        // 6. Handle actual errors
        console.error('Transaction failed:', error);
        throw error;
    }
}
```

## Testing Safe Integration

### Manual Testing:
1. Connect wallet using Safe connector
2. Attempt swap operation
3. Verify modal closes immediately
4. Verify toast notification appears
5. Check Safe interface for pending transaction
6. Approve and execute in Safe
7. Verify transaction executes on-chain

### What to Check:
- ✅ Modal closes without waiting
- ✅ Toast shows "Safe transaction queued"
- ✅ No error messages displayed
- ✅ Transaction appears in Safe interface
- ✅ Transaction executes after Safe approval
- ✅ No console errors

## Configuration

No additional configuration is required. The integration works automatically when:
- User connects via Safe connector (WalletConnect to Safe)
- Connector name/ID includes "safe" or "gnosis"

## Compatibility

**Supported:**
- Gnosis Safe (all versions)
- Safe Apps SDK
- WalletConnect v2 to Safe
- Safe mobile app

**Wallet Connectors:**
- RainbowKit with Safe connector
- WalletConnect
- Any connector with "safe" in name/ID

## Future Enhancements

Potential improvements to consider:
1. Show pending Safe transactions in UI
2. Track transaction status via Safe API
3. Display required signatures count
4. Show Safe transaction details
5. Link directly to Safe interface for approval

## Related Files

**Core Integration:**
- `src/utils/ethersAdapters.js` - Safe detection utility
- `src/components/futarchyFi/marketPage/ConfirmSwapModal.jsx` - Swap integration
- `src/components/futarchyFi/marketPage/collateralModal/CollateralModal.jsx` - Collateral integration

**Helper Utilities:**
- `src/utils/uniswapSdk.js` - Uniswap SDK integration
- `src/utils/uniswapV3Helper.js` - Uniswap V3 helper
- `src/utils/sushiswapV3Helper.js` - SushiSwap V3 helper

## Support

For issues related to Safe integration:
1. Check console logs for Safe detection messages
2. Verify connector name includes "safe" or "gnosis"
3. Ensure `SAFE_TRANSACTION_SENT` is caught in error handlers
4. Check Safe interface for pending transactions

## Changelog

### v1.0.0 - Initial Safe App Integration
- Added `isSafeWallet()` detection utility
- Integrated Safe support in swap modal
- Integrated Safe support in collateral modal
- Added Safe support to all swap helpers
- Implemented `SAFE_TRANSACTION_SENT` error pattern
- Added auto-close and toast notifications for Safe transactions

### v1.1.0 - SDK Integration Compatibility
- Merged with Futarchy SDK integration from main branch
- Ensured Safe detection works with SDK operations
- Maintained Safe transaction handling in SDK cartridge flows
- Verified compatibility with split/merge operations

---

**Last Updated:** 2025-11-28
**Author:** Claude Code
**Branch:** feat/safe-app-integrations
