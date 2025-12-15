# Algebra Arbitrage Helper

This project includes a specialized helper contract to calculate precise precision adjustments for Algebra (Swapr) pools in the Futarchy ecosystem.

## 🚀 Deployed Contract
**Network:** Gnosis Chain  
**Address:** `0xB261e5BEC88b8d235F27956aa497e57aa02142Ab`  
**Verified:** [GnosisScan/Sourcify](https://gnosisscan.io/address/0xB261e5BEC88b8d235F27956aa497e57aa02142Ab)

---

## 📖 How to Use

The contract provides useful functions for Arbitrage and Swap Simulation:

### 1. `estimateArbitrage` (Read Mode)
A **View** function (Read-Only) for approximate arbitrage calculation.
*   **Pros**: Instant, No Gas/Simulation required, Safe to call on Etherscan "Read Contract".
*   **Cons**: Approximate (uses constant product math on active tick).
*   **Usage**: UI estimation.

### 2. `simulateArbitrage` (Precise Mode)
A **State-Changing** simulation function. MUST be called via `staticCall`.
*   **Pros**: 100% Precise. Simulates actual swaps and tick crossings.
*   **Usage**: Executing arbitrage transactions.
*   **Input**: Proposal Address, Spot Price (1e18), Probability (1e18), Impact (1e18).

### 3. `simulateQuote` (New! 🔮)
A comprehensive swap simulator for generic quotes.
*   **Pros**: precise simulation of executing a swap on a proposal pool.
*   **Input**: 
    1.  `proposal` (address)
    2.  `isYesPool` (bool): True for YES/Collateral, False for NO/Collateral.
    3.  `inputType` (uint8): `0` for Company Token (Asset), `1` for Currency (Collateral).
    4.  `amountIn` (uint256): Amount of tokens to swap.
*   **Returns**: `SwapSimulationResult` struct.
    *   `amount0Delta`: Token0 change (Neg = User Send, Pos = User Receive).
    *   `amount1Delta`: Token1 change.
    *   `startSqrtPrice`: Price before swap.
    *   `endSqrtPrice`: Price after swap (currently approximate or 0 depending on implementation details of revert-trick).


### 4. Function Comparison: Which one should I use?

| Function | Input | Goal | Use Case |
| :--- | :--- | :--- | :--- |
| **`simulateQuote`** | Proposal Addr, Amount | "I want to know the price." | **UI / Users**. Calculating swap quotes for a specific proposal. Simplest to use. |
| **`simulateExactInput`** | Pool Addr, Amount | "I want to debug this pool." | **Devs / Debugging**. Calculating swap quotes for a specific *pool address* directly. |
| **`simulateSwap`** | Pool Addr, **Target Price** | "I want to move the price." | **Arbitrageurs**. Calculating how many tokens to swap to reach a specific target price (for Algo Arb). |
| **`simulateArbitrage`** | Proposal Addr, Params | "I want to arb this proposal." | **Arbitrageurs**. Full wrapper that calculates both YES/NO pools to reach a target price based on probability/impact. |

---

## 🛠 Example Usage (JavaScript)

### Getting a Precise Quote
Use `staticCall` to prevent gas spending.

```javascript
const helperAbi = [
  "function simulateQuote(address proposal, bool isYesPool, uint8 inputType, uint256 amountIn) external returns (tuple(int256 amount0Delta, int256 amount1Delta, uint160 startSqrtPrice, uint160 endSqrtPrice, bytes debugReason))"
];
const helper = new ethers.Contract("0xB261e5BEC88b8d235F27956aa497e57aa02142Ab", helperAbi, provider);

// Simulate selling 100 Outcome Tokens for Collateral in YES Pool
// inputType 0 = Outcome Token
const res = await helper.simulateQuote.staticCall(
    "0xProposal...", 
    true, // isYesPool
    0,    // inputType 0
    ethers.parseEther("100")
);

// amount0Delta/amount1Delta contain precise movement.
// One will be positive (user sold/pool received), one negative (user bought/pool paid).
```

## ⚠️ Notes
*   **`staticCall` is mandatory** for `simulateArbitrage` and `simulateQuote`. Direct transactions will revert to avoid spending user funds accidentally.
*   If `debugReason` is returned in the struct, it contains the raw bytes of the revert reason if parsing failed.

### 5. FAQ

**Q: Do I need tokens or approval to simulate?**
**A: NO.**
All functions in this helper (`simulateQuote`, `simulateExactInput`, `simulateSwap`, `simulateArbitrage`) use the **Revert Trick**. They never check your balance.

**Q: When DO I need balance?**
**A:** Only when you want to **Execute** the real trade on the **Router** (e.g. `swaprRouter.exactInputSingle`). That is a real transaction and requires tokens and approval. The Helper is strictly for *calculation*.

**Q: Why does the Router fail even with `staticCall`?**
**A:** The Router tries to pull tokens from your wallet (`transferFrom`) *before* calling the pool. If you have 0 balance, this transfer fails immediately.
**my Helper** talks directly to the Pool and reverts *inside* the swap process (in the callback), effectively "interrupting" the swap before the Pool asks for payment. That's why the Helper works with 0 balance!

---

## 📚 JS Utility Library (`FutarchyQuoteHelper.js`)

We have created a ready-to-use JavaScript library to make getting quotes easy.

### **Features**
*   Returns `expectedReceive`, `minReceive` (based on slippage), `executionPrice`, and `priceAfter` (New!).
*   Returns `expectedReceive`, `minReceive` (based on slippage), `executionPrice`, and `priceAfter` (New!).
*   **Min Receive Calculation:** `Expected Amount * (1 - slippagePercentage)` (**Off-Chain / JS**).
*   Handles token decimals and BigInt math for you.
*   Safe to use in Frontend or Scripts.

### **Installation**
Copy `scripts/FutarchyQuoteHelper.js` into your project.

### **Usage**

```javascript
const { getSwapQuote } = require("./scripts/FutarchyQuoteHelper");
const { ethers } = require("ethers");

async function example() {
    const provider = new ethers.JsonRpcProvider("https://rpc.gnosischain.com"); // or window.ethereum

    const quote = await getSwapQuote({
        proposal: "0xProposalAddress...",
        amount: "0.1",                // Amount to swap
        isYesPool: true,              // YES vs NO pool
        isInputCompanyToken: true,    // True = Selling Asset, False = Selling Collateral
        slippagePercentage: 0.03      // 3% Slippage
    }, provider);

    console.log("Expected Receive:", quote.expectedReceive);
    console.log("Min Receive:",      quote.minReceive);
    console.log("Exec Price:",       quote.executionPrice);
}
```

### **Output JSON Format**
```json
{
  "expectedReceive": "0.123456...",
  "minReceive": "0.119752...",
  "slippagePct": 0.03,
  "currentPoolPrice": "137.44",
  "priceAfter": "138.96", 
  "executionPrice": "138.21", 
  "minReceive": "0.701...",
  "isInverted": false,
  "startSqrtPrice": "...",
  "raw": { ...BigInts... }
}
```

### Note on Inversion (`isInverted`)
The library automatically detects if the pool is "inverted" (e.g. Asset/Currency vs Currency/Asset) and flips the price so it is always "Currency per Asset" (Human Readable). You don't need to do any math!
