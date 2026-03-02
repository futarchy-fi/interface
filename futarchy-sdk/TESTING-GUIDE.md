# 🧪 Real Futarchy Split Testing Guide

## 🎯 **Goal**: Test real sDAI split operation on your proposal `0xDA36a35CA4Fe6214C37a452159C0C9EAd45D5919`

## 📋 **Prerequisites**
- ✅ MetaMask installed  
- ✅ Connected to Gnosis Chain (chain ID 100)
- ✅ Some sDAI tokens in your wallet
- ✅ A small amount of XDAI for gas (~$1-2)

## 🚀 **Step-by-Step Testing**

### **1. Open the Interface**
```bash
# Start local server
python -m http.server 8000
# OR
npx serve .

# Open in browser
http://localhost:8000/futarchy.html
```

### **2. Connect Your Wallet**
1. Click **"Connect Wallet"** button
2. MetaMask will prompt to connect
3. If not on Gnosis Chain, it will auto-switch
4. ✅ You should see: `Connected: 0x1234...5678`

### **3. Check Your Setup**
The interface should show:
- **Proposal**: `0xDA36a35CA4Fe6214C37a452159C0C9EAd45D5919` ✅
- **Collateral**: `sDAI` ✅  
- **Your Balance**: `X.XXXX sDAI`
- **Approval Status**: `Not Approved` (initially)

### **4. Approve sDAI (One-time setup)**
1. Click **"Check Approval Status"** 
2. If shows "Not Approved":
   - Select approval amount (recommend "Unlimited Approval")
   - Click **"Approve Collateral"**
   - Confirm in MetaMask
   - Wait for confirmation
   - ✅ Should show: `Already Approved ✓`

### **5. Test Split Operation**
1. **Set Amount**: Start with `1` sDAI for testing
2. Click **"Split Position"**
3. **Watch the logs** - you'll see:
   ```
   🔀 Splitting 1 tokens via DataLayer...
   pending: Preparing to split position...
   pending: Splitting 1.0 tokens into YES/NO positions...
   📤 TX: 0xabcdef123456...
   pending: Transaction submitted, waiting for confirmation...
   🎉 Position split successful! Block: 31234567
   ⚡ Gas used: 185432
   ```

### **6. What Happens**
- **Input**: 1 sDAI removed from wallet
- **Output**: ~1 YES token + ~1 NO token minted
- **Result**: You now have positions on both sides of the proposal

## 💡 **Testing Amounts**

### **Conservative Testing**
- **Start**: `1 sDAI` (minimal test)
- **Medium**: `10 sDAI` (moderate test)  
- **Real Use**: `100+ sDAI` (actual trading)

### **Get sDAI if Needed**
```javascript
// You can wrap DAI → sDAI on Gnosis Chain
// Or bridge sDAI from mainnet
// Minimal amount needed: 1-5 sDAI for testing
```

## 📊 **Expected Results**

### **Gas Costs**
- **Approval**: ~50,000 gas (~$2-5)
- **Split**: ~200,000 gas (~$8-20)  
- **Total**: ~$10-25

### **Token Balances After Split**
```
Before: 100 sDAI
After:  99 sDAI + 1 YES token + 1 NO token
Total Value: Still 100 sDAI equivalent
```

## 🔧 **Troubleshooting**

### **"No sDAI Balance"**
- Get sDAI from Gnosis Chain DEX
- Or bridge from mainnet
- Minimum: 1 sDAI for testing

### **"Transaction Failed"**  
- Check approval status first
- Ensure sufficient sDAI balance
- Try smaller amount

### **"Wrong Network"**
- Switch to Gnosis Chain (chain ID 100)
- Interface will auto-prompt

### **"High Gas Fees"**
- Normal on first split (~$10-25)
- Subsequent operations cheaper

## 🎯 **Success Indicators**

✅ **Wallet Connected**: Shows your address  
✅ **Approval Working**: Shows "Approved ✓"  
✅ **Balance Updates**: Shows your sDAI amount  
✅ **Split Transaction**: Gets transaction hash  
✅ **Real-time Updates**: See pending → success flow  
✅ **Gas Usage**: Shows actual gas used  

## 🏆 **You've Successfully**
1. **Connected** to real Gnosis Chain
2. **Approved** sDAI for futarchy router  
3. **Split** real sDAI into YES/NO tokens
4. **Created** actual prediction market positions
5. **Used** the complete DataLayer → ViemExecutor → FutarchyCartridge flow

## 🔄 **Next Steps**
- **Merge Positions**: Combine YES/NO back to sDAI
- **Trade Tokens**: Sell YES or NO based on your prediction
- **Redeem Winners**: After proposal resolution
- **Try Larger Amounts**: Scale up your positions

## 🚨 **Safety Notes**
- **Start Small**: Use 1-5 sDAI for initial testing
- **Real Money**: These are real transactions with real tokens
- **Gas Costs**: Budget $10-30 for testing
- **Proposal Status**: Check if proposal is still active

**🎉 Ready to test the future of prediction market governance!** 🏛️✨ 