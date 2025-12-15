const hre = require("hardhat");
const { ethers } = hre;

async function main() {
    const HELPER_ADDRESS = "0x80b59721378127278f7DbF3f7c178d8828465f90";
    const POOL_ADDRESS = "0x51b56a6566EfB1b91371024f7CE063cEC7F23B69";

    // Same target as before
    const SPOT_PRICE = 107.73;
    const PROBABILITY = 0.6154;
    const IMPACT = 0.0744;
    const term = IMPACT * (1 - PROBABILITY);
    const targetPrice = SPOT_PRICE * (1 + term); // ~110.8126

    console.log(`\n🧪 Testing AlgebraPreciseHelper (Quoter Style)`);
    console.log(`   Helper: ${HELPER_ADDRESS}`);
    console.log(`   Target Price: ${targetPrice.toFixed(6)}`);

    const targetSqrtPrice = Math.sqrt(targetPrice);
    const targetSqrtPriceX96 = BigInt(Math.floor(targetSqrtPrice * (2 ** 96)));

    const helper = await ethers.getContractAt("AlgebraPreciseHelper", HELPER_ADDRESS);

    // This call will internally simulate swap and revert with result
    // We use callStatic to get the result
    console.log(`\n🔮 calling getDeltaToSqrtPrice (Simulating Swap via Revert)...`);

    try {
        const [amount0, amount1] = await helper.getDeltaToSqrtPrice.staticCall(POOL_ADDRESS, targetSqrtPriceX96);

        console.log(`\n✅ Precise Result (Multi-Tick):`);
        console.log(`   Amount0 Delta: ${ethers.formatEther(amount0)}`);
        console.log(`   Amount1 Delta: ${ethers.formatEther(amount1)}`);

    } catch (e) {
        console.error("\n❌ Error:", e.message);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
