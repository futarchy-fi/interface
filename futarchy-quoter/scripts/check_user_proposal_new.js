const hre = require("hardhat");
const { ethers } = hre;

const fs = require("fs");

async function main() {
    let output = "";
    function log(msg) {
        console.log(msg);
        output += msg + "\n";
    }

    log("🧪 Checking Arbitrage for Proposal (Latest Helper - Simulate)...");

    const HELPER_ADDRESS = "0x6743529b98B4D146Bf65e6BE8432FF2Ad693bf45"; // Verified Dual-Mode Helper
    const PROPOSAL_ADDRESS = "0x3D076d5d12341226527241f8a489D4A8863B73e5";

    // Params
    // Spot: 107.01
    // Prob: 50.01% (0.5001)
    // Impact: 3% (0.03)

    const spot = ethers.parseEther("107.01");
    const prob = ethers.parseEther("0.5001");
    const impact = ethers.parseEther("0.03");

    console.log(`   Proposal: ${PROPOSAL_ADDRESS}`);
    console.log(`   Spot:     107.01`);
    console.log(`   Prob:     50.01%`);
    console.log(`   Impact:   3%`);

    // ABI updated for 'simulateArbitrage'
    const helperAbi = [
        "function simulateArbitrage(address proposal, uint256 spotPrice18, uint256 probability18, int256 impact18) external returns (tuple(tuple(address pool, address token0, address token1, string token0Symbol, string token1Symbol, bool isInverted, int256 amount0Delta, int256 amount1Delta, uint160 currentSqrtPrice, uint160 targetSqrtPrice, uint256 targetPriceHuman) yesPool, tuple(address pool, address token0, address token1, string token0Symbol, string token1Symbol, bool isInverted, int256 amount0Delta, int256 amount1Delta, uint160 currentSqrtPrice, uint160 targetSqrtPrice, uint256 targetPriceHuman) noPool))"
    ];

    const helper = new ethers.Contract(HELPER_ADDRESS, helperAbi, ethers.provider);

    console.log(`\n🔮 Calling simulateArbitrage (staticCall)...`);

    try {
        const result = await helper.simulateArbitrage.staticCall(PROPOSAL_ADDRESS, spot, prob, impact);

        console.log(`\n✅ Result Received!`);

        printPool(result.yesPool, "YES");
        printPool(result.noPool, "NO");

    } catch (e) {
        console.error("❌ Error:", e);
    }
}

function printPool(p, label) {
    if (p.pool === ethers.ZeroAddress) {
        console.log(`\n--- ${label} POOL: NOT FOUND ---`);
        return;
    }
    console.log(`\n--- ${label} POOL (${p.pool}) ---`);
    console.log(`   Token0:   ${p.token0} (${p.token0Symbol})`);
    console.log(`   Token1:   ${p.token1} (${p.token1Symbol})`);
    console.log(`   Inverted: ${p.isInverted}`);
    console.log(`   Target:   ${ethers.formatEther(p.targetPriceHuman)}`);

    const d0 = parseFloat(ethers.formatEther(p.amount0Delta));
    const d1 = parseFloat(ethers.formatEther(p.amount1Delta));

    if (d0 > 0) console.log(`   Action:   SELL ${d0.toFixed(4)} ${p.token0Symbol}`);
    if (d0 < 0) console.log(`   Action:   BUY  ${Math.abs(d0).toFixed(4)} ${p.token0Symbol}`);

    if (d1 > 0) console.log(`   Action:   SELL ${d1.toFixed(4)} ${p.token1Symbol}`);
    if (d1 < 0) console.log(`   Action:   BUY  ${Math.abs(d1).toFixed(4)} ${p.token1Symbol}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
