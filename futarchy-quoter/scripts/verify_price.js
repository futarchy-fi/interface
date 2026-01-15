const hre = require("hardhat");
const { ethers } = hre;

async function main() {
    const POOL_ADDRESS = "0x51b56a6566EfB1b91371024f7CE063cEC7F23B69";
    const pool = await ethers.getContractAt("contracts/experiments-swapr/AlgebraPriceDeltaHelper.sol:IAlgebraPool", POOL_ADDRESS);

    console.log(`\n🔍 Verifying Pool Price: ${POOL_ADDRESS}`);

    const globalState = await pool.globalState();
    const currentSqrtPriceX96 = globalState.price;
    const currentPrice = (Number(currentSqrtPriceX96) / (2 ** 96)) ** 2;

    const token0 = await pool.token0(); // GNO (Company)
    const token1 = await pool.token1(); // SDAI (Currency)

    console.log(`   Current SqrtPriceX96: ${currentSqrtPriceX96}`);
    console.log(`   ✅ Current Price: ${currentPrice.toFixed(6)} SDAI per GNO`);

    // Target was ~110.81
    const target = 110.8126;
    console.log(`   🎯 Target was:    ${target}`);
    const diff = Math.abs(currentPrice - target);
    console.log(`   Difference:       ${diff.toFixed(6)}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
