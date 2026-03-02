# 🚰 How to Remove All Liquidity from One Proposal

This guide explains how to remove all liquidity from all pools associated with a single futarchy proposal.

## 📋 Prerequisites

- Navigate to the `swapr` folder
- Ensure you have the correct proposal's pool addresses in `remove-config.json`

## 🔧 Step 1: Edit remove-config.json

Open `remove-config.json` and make the following changes:

### Current State (Default)
```json
{
  "removeSettings": {
    "percentage": 100,
    "confirmBeforeEach": false,
    "stopOnError": false
  },
  "poolsToRemove": [
    {
      "name": "YES_GNO / YES_sDAI",
      "type": "Price-Correlated Conditional",
      "address": "0xabC492c842DE65afCB1325796F0D9F5FbF42F079",
      "enabled": false,  // ❌ DISABLED
      "collect": false   // ❌ NOT COLLECTING FEES
    },
    // ... other pools also disabled
  ]
}
```

### Required Changes for Full Removal

Change **ALL** pools to:
- Set `"enabled": true` ✅
- Set `"collect": true` ✅ (to collect any accumulated fees)

### After Editing (Ready to Remove)
```json
{
  "removeSettings": {
    "percentage": 100,
    "confirmBeforeEach": false,
    "stopOnError": false
  },
  "poolsToRemove": [
    {
      "name": "YES_GNO / YES_sDAI",
      "type": "Price-Correlated Conditional",
      "address": "0xabC492c842DE65afCB1325796F0D9F5FbF42F079",
      "enabled": true,   // ✅ ENABLED
      "collect": true    // ✅ COLLECTING FEES
    },
    {
      "name": "NO_GNO / NO_sDAI", 
      "type": "Price-Correlated Conditional",
      "address": "0x1aeFc9B8eC6bD5BEdA6cf3fb33483Ae86F11383D",
      "enabled": true,   // ✅ ENABLED
      "collect": true    // ✅ COLLECTING FEES
    },
    {
      "name": "YES_GNO / sDAI",
      "type": "YES Expected Value",
      "address": "0xc7f83cE09207c5cF67f13be22a5c417a69246E6C",
      "enabled": true,   // ✅ ENABLED
      "collect": true    // ✅ COLLECTING FEES
    },
    {
      "name": "NO_GNO / sDAI",
      "type": "NO Expected Value", 
      "address": "0x40728af5d1f1Be25b0de9E3dB5f27934Ac795b7e",
      "enabled": true,   // ✅ ENABLED
      "collect": true    // ✅ COLLECTING FEES
    },
    {
      "name": "YES_sDAI / sDAI",
      "type": "Prediction Market (Currency vs Base)",
      "address": "0x83B0CB95AC5Dfa57fe38498Fdc57B4910DD5026C",
      "enabled": true,   // ✅ ENABLED
      "collect": true    // ✅ COLLECTING FEES
    },
    {
      "name": "NO_sDAI / sDAI",
      "type": "Prediction Market (Currency vs Base)",
      "address": "0xB460eFC630917695567D1746704b17A85FAD834E",
      "enabled": true,   // ✅ ENABLED
      "collect": true    // ✅ COLLECTING FEES
    }
  ]
}
```

## ⚙️ Step 2: Understand the Settings

### Remove Settings Explained
```json
"removeSettings": {
  "percentage": 100,        // Remove 100% of liquidity
  "confirmBeforeEach": false,  // Don't ask for confirmation on each pool
  "stopOnError": false     // Continue even if one pool fails
}
```

### Pool Settings Explained
- `"enabled": true` - Include this pool in the removal process
- `"collect": true` - Collect accumulated fees before removing liquidity
- `"address"` - The actual pool contract address (must be correct!)

## 🚀 Step 3: Run the Removal Command

```bash
npm run remove
```

## 📊 What Happens During Removal

### Expected Output
```
🚰 Liquidity Removal Process
============================

Processing 6 enabled pools...

────────────────────────────────
POOL 1 – YES_GNO / YES_sDAI
────────────────────────────────
📍 Address: 0xabC492c842DE65afCB1325796F0D9F5FbF42F079
💰 Collecting fees... ✅
🚰 Removing 100% liquidity... ✅

────────────────────────────────
POOL 2 – NO_GNO / NO_sDAI
────────────────────────────────
📍 Address: 0x1aeFc9B8eC6bD5BEdA6cf3fb33483Ae86F11383D
💰 Collecting fees... ✅
🚰 Removing 100% liquidity... ✅

... (continues for all 6 pools)

🎉 SUMMARY
==========
✅ Successfully processed: 6 pools
❌ Failed: 0 pools
💰 Total fees collected: X.XX tokens
🚰 Total liquidity removed: Y.YY tokens
```

## ⚠️ Important Notes

### Before Running
1. **Double-check pool addresses** - Make sure they match your actual proposal
2. **Verify wallet connection** - Ensure you're connected to Gnosis Chain
3. **Check gas balance** - Have enough GNO for transaction fees
4. **Backup config** - Save a copy of your `remove-config.json` before editing

### During Execution
- The process will run automatically (no confirmations needed)
- Each pool removal is a separate blockchain transaction
- If one pool fails, others will continue (unless `stopOnError: true`)

### After Completion
- All liquidity positions will be closed
- Accumulated fees will be collected to your wallet
- You can view remaining positions with `npm run view`

## 🔍 Verification Commands

### Check What Will Be Removed (Before Running)
```bash
npm run view
```

### Verify Complete Removal (After Running)
```bash
npm run view
```

Should show zero liquidity in all pools.

## 🛠️ Troubleshooting

### Common Issues

**Pool Address Mismatch**
```
❌ Error: Pool not found at address 0x...
```
*Solution: Update `remove-config.json` with correct pool addresses*

**Insufficient Gas**
```
❌ Error: insufficient funds for gas
```
*Solution: Add more GNO to your wallet*

**Pool Already Empty**
```
⚠️ Warning: No liquidity found in pool 0x...
```
*This is normal - the pool is already empty*

### Getting Pool Addresses
If you need to find the correct pool addresses for your proposal:
1. Check your futarchy setup files: `futarchy-pool-setup-*.json`
2. Look for `createdPools` section
3. Copy the `poolAddress` values to `remove-config.json`

## 📁 File Locations

```
swapr/
├── remove-config.json          # ← Edit this file
├── futarchy-pool-setup-*.json  # Pool addresses source
└── LIQUIDITY-REMOVAL-GUIDE.md  # ← This guide
```

## 🎯 Quick Reference

### Full Process Summary
1. **Edit** `remove-config.json` - Set all pools to `enabled: true` and `collect: true`
2. **Run** `npm run remove`
3. **Verify** with `npm run view`

### One-Line Command (After Config)
```bash
npm run remove
```

That's it! Your proposal's liquidity will be completely removed from all 6 pools. 🎉 