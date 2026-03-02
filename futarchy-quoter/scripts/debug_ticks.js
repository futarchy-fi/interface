const hre = require("hardhat");
const { ethers } = hre;

const TICK_MATH_ABI = [
    "function getTickAtSqrtRatio(uint160 sqrtPriceX96) internal pure returns (int24 tick)"
];

// Simple JS Tick Math for debugging
function getTickAtTop(price) {
    // price = 1.0001^tick
    // log(price) = tick * log(1.0001)
    // tick = log(price) / log(1.0001)
    return Math.floor(Math.log(price) / Math.log(1.0001));
}

async function main() {
    const POOL_ADDRESS = "0x51b56a6566EfB1b91371024f7CE063cEC7F23B69";
    // Manually define ABI with tickSpacing if missing from artifact
    const pool = await ethers.getContractAt([
        "function globalState() view returns (uint160 price, int24 tick, uint16 fee, uint16 timepointIndex, uint8 communityFeeToken0, uint8 communityFeeToken1, bool unlocked)",
        "function tickSpacing() view returns (int24)",
        "function token0() view returns (address)",
        "function token1() view returns (address)"
    ], POOL_ADDRESS);

    console.log(`\n🔍 Debugging Ticks for Pool: ${POOL_ADDRESS}`);

    // 1. Get Pool State
    const globalState = await pool.globalState();
    const tickSpacing = await pool.tickSpacing();
    const currentTick = Number(globalState.tick);
    const currentPriceToken1Per0 = 1.0001 ** currentTick;

    console.log(`   Current Tick:    ${currentTick}`);
    console.log(`   Tick Spacing:    ${tickSpacing}`);
    console.log(`   Price (Tick):    ${currentPriceToken1Per0.toFixed(4)}`);

    // 2. Analyze Checkpoints
    // We moved from ~113.30 down to ~109.60.
    // Let's see what ticks correspond to those prices.

    // Invert prices because earlier we saw Price = Token1/Token0 (Currency/Company)
    // Wait, earlier log said: "Current Price: 113.29 SDAI per GNO".
    // 1.0001^Tick should match this if Token1 is quote.

    const startPrice = 113.30;
    const targetPrice = 110.81;
    const actualEndPrice = 109.60;

    const startTick = Math.floor(Math.log(startPrice) / Math.log(1.0001));
    const targetTick = Math.floor(Math.log(targetPrice) / Math.log(1.0001));
    const endTick = Math.floor(Math.log(actualEndPrice) / Math.log(1.0001));

    console.log(`\n📊 Tick Analysis:`);
    console.log(`   Start Price ${startPrice}  -> Tick ~${startTick}`);
    console.log(`   Target Price ${targetPrice} -> Tick ~${targetTick}`);
    console.log(`   End Price ${actualEndPrice}    -> Tick ~${endTick}`);

    console.log(`\n   Delta (Start -> Target): ${targetTick - startTick} ticks`);
    console.log(`   Delta (Start -> End):    ${endTick - startTick} ticks`);

    // 3. Check for tick crossings
    // If we crossed a multiple of TickSpacing, we crossed a boundary.
    // Or if there are initialized ticks in between.

    console.log(`\n🚧 Boundary Check (Spacing ${tickSpacing}):`);

    // Simple check: iterate ticks between start and end
    let crossed = 0;
    for (let t = startTick; t >= endTick; t--) {
        if (t % Number(tickSpacing) === 0) {
            console.log(`   ⚠️ Crossed Tick Spacing Boundary at ${t} (Price: ${(1.0001 ** t).toFixed(4)})`);
            crossed++;
        }
    }

    if (crossed > 0) {
        console.log(`\n🛑 CONCLUSION: We crossed ${crossed} tick boundaries!`);
        console.log(`   The "AlgebraPriceDeltaHelper" assumes CONSTANT LIQUIDITY within the current tick.`);
        console.log(`   Since we crossed boundaries, liquidity likely changed, causing the estimate to be wrong.`);
        console.log(`   To be more precise, we need a multi-tick simulation (Quoter) or iterative calculation.`);
    } else {
        console.log(`\n✅ No tick boundaries crossed. Variance might be due to Fee precision or standard math drift.`);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
