# Permissionless Flash Arbitrage Plan

> **Status**: Planning Document  
> **Contract**: `GnosisFlashArbitrageV3`  
> **Address**: `0xe0545480aAB67Bc855806b1f64486F5c77F08eCC`  
> **Created**: 2026-01-23

---

## 📋 Table of Contents

1. [Current Behavior & Why It Reverts](#1-current-behavior--why-it-reverts)
2. [The `onlyOwner` Modifier Explained](#2-the-onlyowner-modifier-explained)
3. [Proposed Changes for Permissionless Access](#3-proposed-changes-for-permissionless-access)
4. [Security Considerations](#4-security-considerations)
5. [Implementation Options](#5-implementation-options)
6. [Recommended Approach](#6-recommended-approach)

---

## 1. Current Behavior & Why It Reverts

### The Problem

When calling `executeArbitrage()` with a wallet that is **not** the contract owner, the transaction reverts immediately with:

```
Error: execution reverted: OwnableUnauthorizedAccount
```

### Root Cause

The function is protected by OpenZeppelin's `onlyOwner` modifier:

```solidity
function executeArbitrage(
    address proposalAddress,
    address borrowToken,
    uint256 borrowAmount,
    ArbitrageDirection direction,
    uint256 minProfit
) external onlyOwner nonReentrant returns (ArbitrageResult memory result) {
//         ^^^^^^^^^ THIS BLOCKS NON-OWNERS
```

### Execution Flow (Current)

```
┌──────────────────────────────────────────────────────────────┐
│  User calls executeArbitrage()                                │
│                     │                                         │
│                     ▼                                         │
│  ┌─────────────────────────────────────────┐                 │
│  │  onlyOwner modifier checks:             │                 │
│  │  require(owner() == msg.sender)         │                 │
│  └─────────────────────────────────────────┘                 │
│                     │                                         │
│         ┌──────────┴──────────┐                              │
│         │                     │                              │
│    msg.sender              msg.sender                        │
│    == owner                != owner                          │
│         │                     │                              │
│         ▼                     ▼                              │
│    ✅ CONTINUE           ❌ REVERT                           │
│    (execute arb)         "OwnableUnauthorizedAccount"        │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. The `onlyOwner` Modifier Explained

### How OpenZeppelin's Ownable Works

```solidity
// From @openzeppelin/contracts/access/Ownable.sol

abstract contract Ownable is Context {
    address private _owner;

    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    function _checkOwner() internal view virtual {
        if (owner() != _msgSender()) {
            revert OwnableUnauthorizedAccount(_msgSender());
        }
    }
}
```

### Why This Was Added

The `onlyOwner` restriction was intentionally added for:

| Reason | Description |
|--------|-------------|
| **Profit Protection** | Ensures only the deployer receives profits |
| **Reentrancy Safety** | Prevents malicious callers from exploiting the callback |
| **Flash Loan Abuse** | Blocks unauthorized users from using the contract's flash loan access |
| **Bot Competition** | Prevents other bots from using your deployed contract |

---

## 3. Proposed Changes for Permissionless Access

### Option A: Remove `onlyOwner` (Simple)

**Change:**
```solidity
// BEFORE (current)
function executeArbitrage(...) external onlyOwner nonReentrant returns (...) {

// AFTER (permissionless)
function executeArbitrage(...) external nonReentrant returns (...) {
```

**Impact:**
- ✅ Anyone can call `executeArbitrage`
- ✅ Simple 1-line change
- ⚠️ Profits go to `msg.sender` (caller) - this is already the case
- ⚠️ Contract becomes a "public utility" for arbitrage

---

### Option B: Allowlist System (Controlled Access)

**Change:**
```solidity
// Add state variable
mapping(address => bool) public authorizedCallers;

// Add modifier
modifier onlyAuthorized() {
    require(authorizedCallers[msg.sender] || msg.sender == owner(), "Not authorized");
    _;
}

// Add management function
function setAuthorized(address caller, bool status) external onlyOwner {
    authorizedCallers[caller] = status;
}

// Update function
function executeArbitrage(...) external onlyAuthorized nonReentrant returns (...) {
```

**Impact:**
- ✅ Owner controls who can use the contract
- ✅ Can add/remove authorized callers
- ✅ Better than fully permissionless
- ⚠️ Requires additional gas for authorization check

---

### Option C: Profit Sharing Model (Incentive-Based)

**Change:**
```solidity
// Add state variables
uint256 public protocolFeePercent = 10; // 10% to contract owner
address public feeRecipient;

// Modify profit distribution in onUnlock()
function onUnlock(...) external returns (bytes memory) {
    // ... existing logic ...
    
    uint256 profit = balanceAfter - borrowAmount;
    
    // Split profit: 90% to caller, 10% to protocol
    uint256 protocolFee = (profit * protocolFeePercent) / 100;
    uint256 callerProfit = profit - protocolFee;
    
    if (protocolFee > 0) {
        IERC20(borrowToken).safeTransfer(feeRecipient, protocolFee);
    }
    if (callerProfit > 0) {
        IERC20(borrowToken).safeTransfer(_profitRecipient, callerProfit);
    }
    
    // ... rest of logic ...
}
```

**Impact:**
- ✅ Anyone can use the contract
- ✅ Contract owner earns passive income from all arbs
- ✅ Incentivizes development/maintenance
- ⚠️ More complex implementation
- ⚠️ Callers earn less than 100% of profit

---

### Option D: Separate User Contracts (Factory Pattern)

**Change:**
```solidity
// New factory contract
contract ArbitrageFactory {
    mapping(address => address) public userContracts;
    
    function createArbitrageContract() external returns (address) {
        GnosisFlashArbitrageV3 newContract = new GnosisFlashArbitrageV3(...);
        newContract.transferOwnership(msg.sender);
        userContracts[msg.sender] = address(newContract);
        return address(newContract);
    }
}
```

**Impact:**
- ✅ Each user gets their own contract
- ✅ Full ownership and control
- ✅ No profit sharing required
- ⚠️ Higher deployment cost per user
- ⚠️ More complex architecture

---

## 4. Security Considerations

### Current Security Model

| Protection | Method | Removed if Permissionless |
|------------|--------|---------------------------|
| Unauthorized access | `onlyOwner` | ❌ Removed |
| Reentrancy | `nonReentrant` | ✅ Kept |
| Flash loan repayment | `require(balance >= repayAmount)` | ✅ Kept |
| Minimum profit | `require(profit >= _minProfit)` | ✅ Kept |

### Risks of Permissionless Access

| Risk | Description | Mitigation |
|------|-------------|------------|
| **Front-running** | MEV bots could front-run user's arb | Accept as market reality |
| **Griefing** | Attackers could call with bad proposals | Validate proposal in contract |
| **Gas wars** | Competition for profitable arbs | Higher gas settings |
| **Contract exploitation** | Potential callback manipulation | Audit callback logic |

### Safe to Remove `onlyOwner` Because:

1. **Profits already go to `msg.sender`** - The caller receives the profit, not the owner
2. **Flash loan must be repaid** - Failed arbs revert, no loss to anyone
3. **No stored funds** - Contract doesn't hold assets between calls
4. **Stateless execution** - Each call is independent

---

## 5. Implementation Options

### For Existing Contract (No Code Change)

Since the contract is already deployed, you have these options:

| Option | Action | Downside |
|--------|--------|----------|
| **Transfer ownership** | `transferOwnership(newAddress)` | Still single owner |
| **Renounce ownership** | `renounceOwnership()` | ❌ Breaks the contract (owner = 0x0, no one can call) |
| **Deploy new contract** | Deploy V4 with changes | Gas cost ~$1-2 |

### For New Contract Deployment

1. **Modify the Solidity code** (one of Options A-D above)
2. **Compile**: `npx hardhat compile`
3. **Deploy**: `npx hardhat run scripts/deployV4.js --network gnosis`
4. **Verify**: `npx hardhat verify --network gnosis <address> <args>`
5. **Update scripts**: Change `contractAddress` in all arb-bot scripts

---

## 6. Recommended Approach

### For Maximum Permissionless Access

**Recommended: Option A + Safety Checks**

```solidity
// GnosisFlashArbitrageV4.sol

contract GnosisFlashArbitrageV4 is ReentrancyGuard {
    // Remove Ownable inheritance entirely
    
    // Keep all existing logic
    
    // Make executeArbitrage public
    function executeArbitrage(
        address proposalAddress,
        address borrowToken,
        uint256 borrowAmount,
        ArbitrageDirection direction,
        uint256 minProfit
    ) external nonReentrant returns (ArbitrageResult memory result) {
        // Profits automatically go to msg.sender
        _profitRecipient = msg.sender;
        
        // ... rest of existing logic ...
    }
    
    // Optional: Add admin recovery for stuck tokens
    address public admin;
    
    function recoverTokens(address token, uint256 amount) external {
        require(msg.sender == admin, "Only admin");
        IERC20(token).safeTransfer(admin, amount);
    }
}
```

### Migration Steps

1. Create `GnosisFlashArbitrageV4.sol` with changes above
2. Test on local fork: `npx hardhat test`
3. Deploy to Gnosis mainnet
4. Update `arb-bot.js` CONFIG:
   ```javascript
   contractAddress: "0x<NEW_V4_ADDRESS>",
   ```
5. Verify on Gnosisscan

---

## 📊 Comparison Summary

| Feature | Current V3 | Option A | Option B | Option C | Option D |
|---------|------------|----------|----------|----------|----------|
| Who can call | Owner only | Anyone | Allowlist | Anyone | Contract owners |
| Profit split | 100% caller | 100% caller | 100% caller | 90/10 | 100% caller |
| Complexity | Simple | Simple | Medium | Medium | High |
| Gas overhead | None | None | ~3k gas | ~5k gas | Deploy cost |
| Deployment | Existing | New | New | New | Factory + contracts |

---

## 🎯 Quick Decision Guide

- **Want simplest permissionless?** → Option A (remove `onlyOwner`)
- **Want controlled access?** → Option B (allowlist)
- **Want passive income?** → Option C (profit sharing)
- **Want full isolation?** → Option D (factory pattern)

---

## Next Steps

1. [ ] Decide which option fits your needs
2. [ ] Create the new contract file (V4)
3. [ ] Test locally with hardhat
4. [ ] Deploy to Gnosis Chain
5. [ ] Update arb-bot scripts with new address
6. [ ] Verify on Gnosisscan

---

*Document created: 2026-01-23*  
*Contract analyzed: GnosisFlashArbitrageV3 @ 0xe0545480aAB67Bc855806b1f64486F5c77F08eCC*
