const hre = require("hardhat");
const { ethers } = hre;

const HELPER_ADDRESS = "0x90578451572b1339C80664b0feBc5352342f425E"; // Verified Helper
const FACTORY_ADDRESS = "0xA0864cCA6E114013AB0e27cbd5B6f4c8947da766";
const PROPOSAL = "0x2C1e08674f3F78f8a1426a41C41B8BF546fA481a";

async function main() {
    console.log(`\n🧪 Calculating Arbitrage (Negative Impact)...`);

    // Inputs
    const spot = 0.0145;
    const impact = -0.0145;
    const prob = 0.0;

    // Calculate Targets
    const yesTarget = spot * (1 + impact * (1 - prob));
    const noTarget = spot * (1 - impact * prob);

    console.log(`🎯 Targets: YES ${yesTarget.toFixed(6)}, NO ${noTarget.toFixed(6)}`);

    // Helper Interface (for decoding error)
    const helperAbi = [
        "function simulateSwap(address pool, uint160 targetSqrtP) external",
        "error ReturnedDeltas(int256 amount0, int256 amount1)"
    ];
    const helper = new ethers.Contract(HELPER_ADDRESS, helperAbi, ethers.provider);

    // Find Pools
    const prop = await ethers.getContractAt("contracts/experiments-swapr/FutarchyArbitrageHelper.sol:IFutarchyProposal", PROPOSAL);
    const factory = await ethers.getContractAt("contracts/experiments-swapr/FutarchyArbitrageHelper.sol:IAlgebraFactory", FACTORY_ADDRESS);

    // YES Tokens (0, 2)
    const [t0] = await prop.wrappedOutcome(0);
    const [t2] = await prop.wrappedOutcome(2);
    // NO Tokens (1, 3)
    const [t1] = await prop.wrappedOutcome(1);
    const [t3] = await prop.wrappedOutcome(3);

    const poolYesInfo = await getPoolData(factory, helper, t0, t2, yesTarget, "YES");
    const poolNoInfo = await getPoolData(factory, helper, t1, t3, noTarget, "NO");

    printResult(poolYesInfo);
    printResult(poolNoInfo);
}

async function getPoolData(factory, helper, tokenA, tokenB, targetPriceHuman, label) {
    const poolAddr = await factory.poolByPair(tokenA, tokenB);
    if (poolAddr === ethers.ZeroAddress) {
        return { label, found: false };
    }

    const pool = await ethers.getContractAt("contracts/experiments-swapr/AlgebraPriceDeltaHelper.sol:IAlgebraPool", poolAddr);
    const token0 = await pool.token0();
    const token1 = await pool.token1();

    const isInverted = (token0.toLowerCase() === tokenB.toLowerCase());

    const t0Contract = await ethers.getContractAt("IERC20Metadata", token0);
    const t1Contract = await ethers.getContractAt("IERC20Metadata", token1);
    const s0 = await t0Contract.symbol();
    const s1 = await t1Contract.symbol();

    let targetPoolPrice = targetPriceHuman;
    if (isInverted) {
        targetPoolPrice = 1 / targetPriceHuman;
    }

    const sqrtP = Math.sqrt(targetPoolPrice);
    const targetSqrtPriceX96 = BigInt(Math.floor(sqrtP * (2 ** 96)));

    let amount0 = 0n, amount1 = 0n;

    try {
        await helper.simulateSwap.staticCall(poolAddr, targetSqrtPriceX96);
        console.log(`   ❓ Simulation did not revert? (Maybe already at price)`);
    } catch (e) {
        // Parse Revert
        if (e.data && helper.interface) {
            try {
                const decoded = helper.interface.parseError(e.data);
                if (decoded && decoded.name === "ReturnedDeltas") {
                    amount0 = decoded.args[0];
                    amount1 = decoded.args[1];
                } else {
                    console.log(`   ❌ Unknown Revert: ${decoded ? decoded.name : e.data}`);
                }
            } catch (err) {
                console.log(`   ❌ Decode Error: ${err.message}`);
            }
        } else {
            console.log(`   ❌ No Data Error: ${e.message}`);
        }
    }

    return {
        label,
        found: true,
        address: poolAddr,
        poolPrice: targetPoolPrice,
        humanPrice: targetPriceHuman,
        isInverted,
        tokens: `${s0} / ${s1}`,
        amount0,
        amount1,
        s0,
        s1
    };
}

function printResult(r) {
    if (!r.found) {
        console.log(`\n--- ${r.label}: Not Found ---`);
        return;
    }
    console.log(`\n--- ${r.label} (${r.address}) ---`);
    console.log(`   Tokens:   ${r.tokens}`);
    console.log(`   Inverted: ${r.isInverted}`);
    console.log(`   Target:   ${r.humanPrice.toFixed(6)}`);
    console.log(`   Delta 0:  ${ethers.formatEther(r.amount0)} (${r.s0})`);
    console.log(`   Delta 1:  ${ethers.formatEther(r.amount1)} (${r.s1})`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
