const hre = require("hardhat");
const { ethers } = hre;

async function main() {
    console.log("🔍 Checking Tokens for Proposal 0x9590...");
    const PROPOSAL = "0x9590dAF4d5cd4009c3F9767C5E7668175cFd37CF";
    const FACTORY = "0xA0864cCA6E114013AB0e27cbd5B6f4c8947da766";

    // Proposal ABI
    const proposalAbi = [
        "function wrappedOutcome(uint256 index) view returns (address token, bytes data)"
    ];
    const proposalContract = new ethers.Contract(PROPOSAL, proposalAbi, ethers.provider);

    console.log("   Resolving Outcomes...");
    const t0 = await proposalContract.wrappedOutcome(0);
    console.log(`   Outcome 0: ${t0.token}`);

    // Check Outcome 2
    try {
        const t2 = await proposalContract.wrappedOutcome(2);
        console.log(`   Outcome 2: ${t2.token}`);

        console.log("   Checking Pool...");
        const factoryAbi = ["function poolByPair(address, address) view returns (address)"];
        const factoryContract = new ethers.Contract(FACTORY, factoryAbi, ethers.provider);

        const pool = await factoryContract.poolByPair(t0.token, t2.token);
        console.log(`   Pool for (0, 2): ${pool}`);

        const REAL_POOL = "0x4fF34E270CA54944955b2F595CeC4CF53BDc9e0c";
        if (pool === REAL_POOL) {
            console.log("   ✅ Matches Known YES Pool!");
        } else {
            console.log("   ❌ Does NOT match known pool!");
        }

    } catch (e) {
        console.log(`   ❌ Outcome 2 Error: ${e.message}`);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
