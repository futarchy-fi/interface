const hre = require("hardhat");
const { ethers } = hre;

async function main() {
    const POOL_ADDRESS = "0x6E39EF837f300F231987b2871467f2d385b082B5";
    // Using the fully qualified name that worked before
    const pool = await ethers.getContractAt("contracts/experiments-swapr/AlgebraPriceDeltaHelper.sol:IAlgebraPool", POOL_ADDRESS);

    console.log(`\n🔍 Inspecting Pool: ${POOL_ADDRESS}`);

    try {
        const token0 = await pool.token0();
        const token1 = await pool.token1();

        console.log(`   Token0: ${token0}`);
        console.log(`   Token1: ${token1}`);

        const globalState = await pool.globalState();
        const currentSqrtPriceX96 = globalState.price;
        const currentPrice = (Number(currentSqrtPriceX96) / (2 ** 96)) ** 2; // Token1 per Token0

        console.log(`   SqrtPriceX96: ${currentSqrtPriceX96}`);
        console.log(`   Price (T1/T0): ${currentPrice.toFixed(6)}`);
        console.log(`   Inverse (T0/T1): ${(1 / currentPrice).toFixed(6)}`);

    } catch (e) {
        console.error("Error reading pool:", e.message);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
