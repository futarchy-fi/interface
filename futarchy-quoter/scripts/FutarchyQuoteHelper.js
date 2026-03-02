const { ethers } = require("ethers");

/**
 * @title Futarchy Quote Helper
 * @notice Simple utility to get swap quotes from the FutarchyArbitrageHelper.
 */

// 🚀 CONFIGURATION
const HELPER_ADDRESS = "0xe32bfb3DD8bA4c7F82dADc4982c04Afa90027EFb"; // Verified Gnosis Contract (With endSqrtPrice & Inversion)
const HELPER_ABI = [
    "function simulateQuote(address proposal, bool isYesPool, uint8 inputType, uint256 amountIn) external returns (tuple(int256 amount0Delta, int256 amount1Delta, uint160 startSqrtPrice, uint160 endSqrtPrice, bytes debugReason, bool isToken0Outcome))"
];

/**
 * Get a detailed swap quote for a Futarchy Proposal.
 * 
 * @param {Object} params - The parameters object.
 * @param {string} params.proposal - Address of the proposal.
 * @param {string} params.amount - Amount to swap as a string (e.g. "1.5").
 * @param {boolean} params.isYesPool - TRUE for YES Pool, FALSE for NO Pool.
 * @param {boolean} params.isInputCompanyToken - TRUE if selling Company Token (Outcome), FALSE if selling Currency (Collateral).
 * @param {number} params.slippagePercentage - Slippage tolerance (e.g. 0.03 for 3%).
 * @param {Object} provider - Ethers.js Provider or Signer.
 * 
 * @returns {Promise<Object>} JSON object with quote details.
 */
async function getSwapQuote({ proposal, amount, isYesPool, isInputCompanyToken, slippagePercentage }, provider) {

    // 1. Setup
    const helper = new ethers.Contract(HELPER_ADDRESS, HELPER_ABI, provider);
    const amountBig = ethers.parseEther(amount);

    // 2. Determine Input Type
    // Contract expects: 0 = Company Token, 1 = Currency Token
    const inputType = isInputCompanyToken ? 0 : 1;

    // 3. Simulate (StaticCall is CRITICAL)
    // We add gasLimit to be safe, though usually not needed if logic is clean.
    const txOverrides = { gasLimit: 30_000_000 };

    let result;
    try {
        result = await helper.simulateQuote.staticCall(proposal, isYesPool, inputType, amountBig, txOverrides);
    } catch (error) {
        console.error("Simulation Failed:", error.message);
        throw new Error("Simulation failed. Check if pool exists or amount is valid.");
    }

    // 4. Parse Results
    // Result has: amount0Delta, amount1Delta, startSqrtPrice, endSqrtPrice
    const d0 = result.amount0Delta;
    const d1 = result.amount1Delta;

    // One delta is Neg (Input), One is Pos (Output)
    // We verify against our input amount.
    // Note: JS BigInts are signed.

    let amountOutBig = 0n;

    if (d0 < 0n) {
        // User sent Token0 (Delta is negative for pool? No, pool receives positive. User pays negative?)
        // Standard Uniswap convention: 
        // amount0 > 0: Pool receives (User Sells).
        // amount0 < 0: Pool sends (User Buys).

        // Wait, let's check my Helper logic logic again or just rely on "positive one is output"?
        // Actually, if we swap EXACT INPUT, the input delta is exact.
        // The output delta is what we get.

        // Let's look at absolute values.
        // Input is roughly `amountBig`.
        // Output is the other one.
    }

    // Let's simplify: Expected Receive is the absolute value of the NEGATIVE delta? 
    // Or positive? 
    // If I Sell, I give tokens (Pos Delta to Pool). Pool gives me tokens (Neg Delta from Pool).
    // So Output is the Negative Delta (from pool perspective).

    // Let's just find the one that IS NOT the input.
    // Input ~= amountBig.
    const absD0 = d0 < 0n ? -d0 : d0;
    const absD1 = d1 < 0n ? -d1 : d1;

    // Fuzzy match input
    // The input delta should be exactly amountBig (or very close if fees taken? No, exact input).
    if (absD0 === amountBig) {
        amountOutBig = absD1;
    } else {
        amountOutBig = absD0;
    }

    // 5. Calculations
    const expectedReceive = ethers.formatEther(amountOutBig);

    // Min Receive = Expected * (1 - slippage)
    // We do this in number math for simplicity, or BigInt for precision
    const slippageFactor = 1 - slippagePercentage;
    const minReceiveVal = Number(expectedReceive) * slippageFactor;
    const minReceive = minReceiveVal.toFixed(18); // String

    // Prices
    const amountInNum = Number(amount);
    const amountOutNum = Number(expectedReceive);

    // Execution Price should always be "Currency per Asset" (Collateral / Outcome)
    // If Selling Asset (Input=Asset, Output=Currency): Price = Out/In
    // If Buying Asset (Input=Currency, Output=Asset):  Price = In/Out
    let executionPriceVal = 0;
    if (amountInNum > 0 && amountOutNum > 0) {
        if (isInputCompanyToken) {
            executionPriceVal = amountOutNum / amountInNum;
        } else {
            executionPriceVal = amountInNum / amountOutNum;
        }
    }

    // Current Pool Price (from sqrtPrice)
    const startSqrtPrice = result.startSqrtPrice;
    let currentPoolPrice = calculatePriceFromSqrt(startSqrtPrice);

    // Price After
    const endSqrtPrice = result.endSqrtPrice;
    let priceAfterNum = 0;
    if (endSqrtPrice > 0n) {
        priceAfterNum = calculatePriceFromSqrt(endSqrtPrice);
    }

    // Inversion Logic
    // isToken0Outcome: T0=Outcome, T1=Currency -> Price = T1/T0 = Curr/Out (Correct)
    // !isToken0Outcome: T0=Currency, T1=Outcome -> Price = T1/T0 = Out/Curr (Inverted)
    let isInverted = false;
    if (!result.isToken0Outcome) {
        currentPoolPrice = (currentPoolPrice > 0) ? 1 / currentPoolPrice : 0;
        priceAfterNum = (priceAfterNum > 0) ? 1 / priceAfterNum : 0;
        isInverted = true;
    }

    return {
        expectedReceive: expectedReceive,
        minReceive: minReceive,
        slippagePct: slippagePercentage,
        currentPoolPrice: currentPoolPrice.toFixed(6),
        priceAfter: priceAfterNum.toFixed(6),
        executionPrice: executionPriceVal.toFixed(6),
        startSqrtPrice: startSqrtPrice.toString(),
        endSqrtPrice: endSqrtPrice.toString(),
        isInverted: isInverted,
        // Raw big ints if needed
        raw: {
            amountIn: amountBig,
            amountOut: amountOutBig
        }
    };
}

// Internal: Calc Price from SqrtX96
function calculatePriceFromSqrt(sqrtPriceX96) {
    // Price = (sqrtPrice / 2^96) ^ 2
    // We need to know if we invert? 
    // The result from helper is strictly Pool Price (Token1/Token0).
    // The User needs to know which is which.
    // For simplicity, we return the raw ratio T1/T0.
    // Usage: if T0 is Asset, Price is Currency/Asset.

    const curr = Number(sqrtPriceX96) / (2 ** 96);
    return curr * curr;
}

module.exports = { getSwapQuote, HELPER_ADDRESS };
