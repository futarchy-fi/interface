const hre = require("hardhat");
const { ethers } = hre;

async function main() {
    const HELPER_ADDRESS = "0x80b59721378127278f7DbF3f7c178d8828465f90"; // Deployed Precise Helper
    const POOL_ADDRESS = "0x6E39EF837f300F231987b2871467f2d385b082B5"; // NO Pool

    // Params from User
    const SPOT_PRICE = 107.73;
    const PROBABILITY = 0.6154;
    const IMPACT = 0.0744;

    // Formula: Spot * (1 - Impact * Prob)
    // Note: User logic.
    const term = IMPACT * PROBABILITY; // 0.04578576
    const targetHumanPrice = SPOT_PRICE * (1 - term); // 107.73 * (1 - 0.045...) ~ 102.79

    console.log(`\n🧪 Testing AlgebraPreciseHelper on NO Pool`);
    console.log(`   Pool: ${POOL_ADDRESS}`);
    console.log(`   Tokens: Token0=NO_sDAI(Currency), Token1=NO_GNO(Asset)`);
    console.log(`   Strategy: Pool Price is (Asset/Currency) which is 1/HumanPrice`);

    // Target Pool Price (Token1/Token0) = 1 / TargetHuman
    // Because Token1 is Asset (NO_GNO) and Token0 is Currency (NO_sDAI)
    // Actually, wait.
    // If GlobalState.price is 0.0097, that means Price = T1/T0.
    // T1(NO_GNO) / T0(NO_sDAI) = 0.0097 NO_GNO per NO_sDAI? 
    // Wait. 
    // Usually Price X/Y means "Value of X in terms of Y". 
    // If T1/T0 = 0.0097, then 1 unit of T0 buys 0.0097 units of T1? No.
    // V3 Price P = y/x.
    // amount1 = P * amount0.
    // If P = 0.0097:
    // 1 Token0 (sDAI) = 0.0097 Token1 (GNO)? 
    // This implies GNO is worth ~102 sDAI. 
    // 1 GNO = 102 sDAI. 
    // So 1 sDAI = 1/102 GNO = 0.0097 GNO.
    // Correct.
    // So the pool tracks "Amount of GNO per sDAI".

    // We want "Amount of sDAI per GNO" (Human Price) to be 102.79.
    // So "Amount of GNO per sDAI" (Pool Price) should be 1 / 102.79.

    const targetPoolPrice = 1 / targetHumanPrice;

    console.log(`\n📊 Prices:`);
    console.log(`   Target Human Price (sDAI/GNO): ${targetHumanPrice.toFixed(6)}`);
    console.log(`   Target Pool Price (GNO/sDAI):  ${targetPoolPrice.toFixed(10)}`);

    const targetSqrtPrice = Math.sqrt(targetPoolPrice);
    const targetSqrtPriceX96 = BigInt(Math.floor(targetSqrtPrice * (2 ** 96)));

    const helper = await ethers.getContractAt("AlgebraPreciseHelper", HELPER_ADDRESS);

    console.log(`\n🔮 Calling getDeltaToSqrtPrice...`);

    try {
        const [amount0, amount1] = await helper.getDeltaToSqrtPrice.staticCall(POOL_ADDRESS, targetSqrtPriceX96);

        console.log(`\n✅ Precise Result:`);
        console.log(`   Amount0 Delta (NO_sDAI): ${ethers.formatEther(amount0)}`);
        console.log(`   Amount1 Delta (NO_GNO):  ${ethers.formatEther(amount1)}`);

    } catch (e) {
        console.error("\n❌ Error:", e.message);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
