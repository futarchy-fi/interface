const hre = require("hardhat");
const { ethers } = hre;

async function main() {
    // Known Swapr Pool
    const POOL = "0x51b56a6566EfB1b91371024f7CE063cEC7F23B69";
    const pool = await ethers.getContractAt("contracts/experiments-swapr/AlgebraPriceDeltaHelper.sol:IAlgebraPool", POOL);

    // Algebra/Uniswap pools usually have a 'factory' method
    // I need to add it to ABI or use raw call, but let's try calling it if it exists on ABI?
    // The provided interface in AlgebraPriceDeltaHelper didn't have it.
    // I'll use a custom ABI.

    const abi = ["function factory() view returns (address)"];
    const p = new ethers.Contract(POOL, abi, ethers.provider);

    try {
        const factory = await p.factory();
        console.log(`✅ Correct Factory Address: ${factory}`);

        // Compare with Config
        const configFactory = "0xa6cB18FCDC17a2B44E5cAd2d80a6D5942d30a345";
        console.log(`   Config Factory:        ${configFactory}`);

        if (factory.toLowerCase() !== configFactory.toLowerCase()) {
            console.log("⚠️  MISMATCH! We deployed with the wrong factory.");
        } else {
            console.log("   Matches.");
        }

    } catch (e) {
        console.error("❌ Failed to get factory:", e.message);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
