const { getSwapQuote } = require("./FutarchyQuoteHelper");
const { ethers } = require("hardhat");

async function main() {
    console.log("📚 Testing Futarchy Quote Helper Lib...");

    // Proposal: 0x7e9F...
    const PROPOSAL = "0x7e9Fc0C3d6C1619d4914556ad2dEe6051Ce68418";
    const AMOUNT = "100";

    // Test 1: YES Pool (Sell Currency -> Buy YES)
    console.log(`\n--- CASE 1: YES POOL (Sell ${AMOUNT} Currency) ---`);
    try {
        const quoteYes = await getSwapQuote({
            proposal: PROPOSAL,
            amount: AMOUNT,
            isYesPool: true,
            isInputCompanyToken: false, // Selling Currency
            slippagePercentage: 0.03
        }, ethers.provider);

        console.log("Expected Receive (YES):", quoteYes.expectedReceive);
        console.log("Min Receive (3% Sl.):  ", quoteYes.minReceive);
        console.log("Exec Price:            ", quoteYes.executionPrice);
        console.log("Current Pool Price:    ", quoteYes.currentPoolPrice);
        console.log("Price After:           ", quoteYes.priceAfter);
        console.log("Inverted?              ", quoteYes.isInverted);
    } catch (e) {
        console.log("Inverted?              ", e.isInverted); // Assuming 'isInverted' might be part of the error object or context
        console.log("YES Pool Error:", e.message);
    }

    // Test 2: NO Pool (Sell Currency -> Buy NO)
    console.log(`\n--- CASE 2: NO POOL (Sell ${AMOUNT} Currency) ---`);
    try {
        const quoteNo = await getSwapQuote({
            proposal: PROPOSAL,
            amount: AMOUNT,
            isYesPool: false,
            isInputCompanyToken: false, // Selling Currency
            slippagePercentage: 0.03
        }, ethers.provider);

        console.log("Expected Receive (NO): ", quoteNo.expectedReceive);
        console.log("Min Receive (3% Sl.):  ", quoteNo.minReceive);
        console.log("Exec Price:            ", quoteNo.executionPrice);
        console.log("Current Pool Price:    ", quoteNo.currentPoolPrice);
        console.log("Price After:           ", quoteNo.priceAfter);
        console.log("Inverted?              ", quoteNo.isInverted);
        console.log("Start SqrtP:           ", quoteNo.startSqrtPrice);
    } catch (e) {
        console.log("NO Pool Error:", e.message);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
