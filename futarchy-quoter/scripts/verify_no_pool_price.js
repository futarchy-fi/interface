const hre = require("hardhat");
const { ethers } = hre;

async function main() {
    const POOL_ADDRESS = "0x6E39EF837f300F231987b2871467f2d385b082B5";
    const pool = await ethers.getContractAt("contracts/experiments-swapr/AlgebraPriceDeltaHelper.sol:IAlgebraPool", POOL_ADDRESS);

    console.log(`\n🔍 Verifying NO Pool Price: ${POOL_ADDRESS}`);

    const globalState = await pool.globalState();
    const currentSqrtPriceX96 = globalState.price;
    // Price T1/T0 (Asset/Currency)
    const currentPriceT1T0 = (Number(currentSqrtPriceX96) / (2 ** 96)) ** 2;
    // Human Price (Currency/Asset)
    const currentPriceHuman = 1 / currentPriceT1T0;

    console.log(`   SqrtPriceX96:     ${currentSqrtPriceX96}`);
    console.log(`   Price (GNO/sDAI): ${currentPriceT1T0.toFixed(8)}`);
    console.log(`   Price (sDAI/GNO): ${currentPriceHuman.toFixed(6)}`);

    const target = 102.79;
    console.log(`   🎯 Target:        ${target}`);
    console.log(`   Difference:       ${Math.abs(currentPriceHuman - target).toFixed(6)}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
