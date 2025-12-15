const hre = require("hardhat");
const { ethers } = hre;

async function main() {
    console.log("🔮 Simulating Swap Quote (Latest Helper)...");

    const HELPER_ADDRESS = "0x6743529b98B4D146Bf65e6BE8432FF2Ad693bf45";
    const PROPOSAL_ADDRESS = "0x9590dAF4d5cd4009c3F9767C5E7668175cFd37CF";

    // Amount to Swap: 0.1
    const amountVal = "0.1";
    const amountIn = ethers.parseEther(amountVal);

    // Params:
    // Input Type: 
    //   0 = Company Token (The 'Asset' of the Futarchy market)
    //   1 = Currency Token (The 'Collateral' e.g. sDAI/USDC)

    // Test Case 1: Sell 0.1 Company Token (Input Type 0)
    console.log(`\n--- CASE 1: INPUT 0.1 COMPANY TOKEN (Type 0) ---`);
    await getQuote(HELPER_ADDRESS, PROPOSAL_ADDRESS, 0, amountIn);

    // Test Case 2: Sell 0.1 Currency Token (Input Type 1)
    console.log(`\n--- CASE 2: INPUT 0.1 CURRENCY TOKEN (Type 1) ---`);
    await getQuote(HELPER_ADDRESS, PROPOSAL_ADDRESS, 1, amountIn);
}

async function getQuote(helperAddr, proposal, inputType, amountIn) {
    const helperAbi = [
        "function simulateQuote(address proposal, bool isYesPool, uint8 inputType, uint256 amountIn) external returns (tuple(int256 amount0Delta, int256 amount1Delta, uint160 startSqrtPrice, uint160 endSqrtPrice, bytes debugReason))"
    ];
    const helper = new ethers.Contract(helperAddr, helperAbi, ethers.provider);

    // DIRECT TEST
    const YES_POOL = "0x4fF34E270CA54944955b2F595CeC4CF53BDc9e0c";
    console.log(`\n--- DIRECT TEST: simulateExactInput on YES Pool ---`);
    // YES POOL
    try {
        console.log(`   Querying YES Pool...`);
        const resYes = await helper.simulateQuote.staticCall(proposal, true, inputType, amountIn, { gasLimit: 30000000 });
        printResult(resYes, "YES", inputType, amountIn);
    } catch (e) {
        console.log(`   YES Pool Error: ${e.message}`);
    }

    // NO POOL
    try {
        console.log(`   Querying NO Pool...`);
        const resNo = await helper.simulateQuote.staticCall(proposal, false, inputType, amountIn, { gasLimit: 30000000 });
        printResult(resNo, "NO", inputType, amountIn);
    } catch (e) {
        console.log(`   NO Pool Error: ${e.message}`);
    }
}

function printResult(res, label, inputType, amountIn) {
    // Result has amount0Delta, amount1Delta
    // inputType 0 => Company is Input.
    // We need to know which one is Input to determine AmountOut.
    // Actually, one delta will be POSITIVE (Pool Receives = User Sells = Input).
    // The other delta will be NEGATIVE (Pool Gives = User Buys = Output).

    const d0 = BigInt(res.amount0Delta);
    const d1 = BigInt(res.amount1Delta);

    let amtIn, amtOut;

    if (d0 > 0n) {
        amtIn = d0;
        amtOut = -d1;
    } else {
        amtIn = d1;
        amtOut = -d0;
    }

    // Verify amountIn matches roughly
    console.log(`   [${label} POOL]`);
    if (d0 === 0n && d1 === 0n) {
        console.log(`      FAILED. DebugReason: ${res.debugReason}`);
        return;
    }

    console.log(`      Input Delta:  ${ethers.formatEther(amtIn)} (Matches Input: ${amtIn === BigInt(amountIn) ? "YES" : "NO"})`);
    console.log(`      Output Delta: ${ethers.formatEther(amtOut)}`);

    const price = Number(ethers.formatEther(amtOut)) / Number(ethers.formatEther(amtIn));
    console.log(`      Exec Price:   ${price.toFixed(6)}`);
    console.log(`      Start SqrtP:  ${res.startSqrtPrice}`);
    if (res.debugReason && res.debugReason !== "0x") {
        console.log(`      DebugReason: ${res.debugReason}`);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

