const hre = require("hardhat");
const { ethers } = hre;

async function main() {
    console.log("🧪 Checking Arbitrage for Proposal...");

    const HELPER_ADDRESS = "0x90578451572b1339C80664b0feBc5352342f425E";
    const PROPOSAL_ADDRESS = "0x7e9Fc0C3d6C1619d4914556ad2dEe6051Ce68418";

    // Params
    // Spot: 107.46
    // Prob: 24.26% (0.2426)
    // Impact: 46.36% (0.4636)

    // We strictly use strings for parseEther to avoid precision loss
    const spot = ethers.parseEther("107.46");
    const prob = ethers.parseEther("0.2426");
    const impact = ethers.parseEther("0.4636");

    console.log(`   Proposal: ${PROPOSAL_ADDRESS}`);
    console.log(`   Spot:     107.46`);
    console.log(`   Prob:     24.26%`);
    console.log(`   Impact:   46.36%`);

    const helper = await ethers.getContractAt("FutarchyArbitrageHelper", HELPER_ADDRESS);

    console.log(`\n🔮 Calling getArbitrageInfo...`);

    try {
        const result = await helper.getArbitrageInfo.staticCall(PROPOSAL_ADDRESS, spot, prob, impact);

        console.log(`\n✅ Result Received!`);

        if (result.yesPool.pool === ethers.ZeroAddress) {
            console.log(`\n--- YES POOL: NOT FOUND ---`);
        } else {
            console.log(`\n--- YES POOL (${result.yesPool.pool}) ---`);
            console.log(`   Tokens:   ${result.yesPool.token0Symbol} / ${result.yesPool.token1Symbol}`);
            console.log(`   Inverted: ${result.yesPool.isInverted}`);
            console.log(`   Target:   ${ethers.formatEther(result.yesPool.targetPriceHuman)}`);
            console.log(`   Delta 0:  ${ethers.formatEther(result.yesPool.amount0Delta)} (${result.yesPool.token0Symbol})`);
            console.log(`   Delta 1:  ${ethers.formatEther(result.yesPool.amount1Delta)} (${result.yesPool.token1Symbol})`);
        }

        if (result.noPool.pool === ethers.ZeroAddress) {
            console.log(`\n--- NO POOL: NOT FOUND ---`);
        } else {
            console.log(`\n--- NO POOL (${result.noPool.pool}) ---`);
            console.log(`   Tokens:   ${result.noPool.token0Symbol} / ${result.noPool.token1Symbol}`);
            console.log(`   Inverted: ${result.noPool.isInverted}`);
            console.log(`   Target:   ${ethers.formatEther(result.noPool.targetPriceHuman)}`);
            console.log(`   Delta 0:  ${ethers.formatEther(result.noPool.amount0Delta)} (${result.noPool.token0Symbol})`);
            console.log(`   Delta 1:  ${ethers.formatEther(result.noPool.amount1Delta)} (${result.noPool.token1Symbol})`);
        }

    } catch (e) {
        console.error("❌ Error:", e);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
