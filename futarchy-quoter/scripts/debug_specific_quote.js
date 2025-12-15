const hre = require("hardhat");
const { ethers } = hre;

async function main() {
    console.log("🔮 Debugging Specific Swap Quote...");

    const HELPER_ADDRESS = "0xe32bfb3DD8bA4c7F82dADc4982c04Afa90027EFb";
    // The user identified this as the proposal address
    const PROPOSAL_ADDRESS = "0x7e9Fc0C3d6C1619d4914556ad2dEe6051Ce68418";

    // Amount to Swap: 0.1
    const amountVal = "0.1";
    const amountIn = ethers.parseEther(amountVal);

    // Case: Sell 0.1 Company Token (Input Type 0)
    console.log(`\n--- DEBUG CASE: SELL 0.1 COMPANY TOKEN (Type 0) ---`);
    console.log(`Helper: ${HELPER_ADDRESS}`);
    console.log(`Proposal: ${PROPOSAL_ADDRESS}`);

    await getQuote(HELPER_ADDRESS, PROPOSAL_ADDRESS, 0, amountIn);
}

async function getQuote(helperAddr, proposal, inputType, amountIn) {
    const helperAbi = [
        "function simulateQuote(address proposal, bool isYesPool, uint8 inputType, uint256 amountIn) external returns (tuple(int256 amount0Delta, int256 amount1Delta, uint160 startSqrtPrice, uint160 endSqrtPrice, bytes debugReason, bool isToken0Outcome))"
    ];
    const helper = new ethers.Contract(helperAddr, helperAbi, ethers.provider);

    // Try YES Pool
    try {
        console.log(`   Querying YES Pool...`);
        // Note: simulateQuote is not view in some versions? No, it should be view or we use staticCall.
        const resYes = await helper.simulateQuote.staticCall(proposal, true, inputType, amountIn, { gasLimit: 30000000 });
        printResult(resYes, "YES", inputType, amountIn);
    } catch (e) {
        console.log(`   YES Pool Error: ${e.message}`);
        if (e.data) {
            console.log(`   Error Data: ${e.data}`);
        }
    }
}

function printResult(res, label, inputType, amountIn) {
    const d0 = BigInt(res.amount0Delta);
    const d1 = BigInt(res.amount1Delta);

    let amtIn, amtOut;

    // Logic: Input reduces balance (but here deltas are pool perspective? or user?)
    // Usually: D0 + D1. One is negative.
    // If d0 > 0, Pool received Token0. User sold Token0.

    if (d0 > 0n) {
        amtIn = d0;
        amtOut = -d1; // Output is negative delta
    } else {
        amtIn = d1;
        amtOut = -d0;
    }

    console.log(`   [${label} POOL RESULT]`);
    console.log(`      Input Delta:  ${ethers.formatEther(amtIn)}`);
    console.log(`      Output Delta: ${ethers.formatEther(amtOut)}`);
    console.log(`      Start SqrtP:  ${res.startSqrtPrice}`);
    console.log(`      End SqrtP:    ${res.endSqrtPrice}`);
    console.log(`      IsT0Outcome:  ${res.isToken0Outcome}`);

    if (res.endSqrtPrice === 0n) {
        console.error("      [!] CRITICAL: EndSqrtPrice is 0!");
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
