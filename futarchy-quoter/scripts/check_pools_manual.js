const hre = require("hardhat");
const { ethers } = hre;

async function main() {
    const PROP = "0x7e9Fc0C3d6C1619d4914556ad2dEe6051Ce68418";
    const FACTORY = "0xa6cB18FCDC17a2B44E5cAd2d80a6D5942d30a345";

    console.log(`Checking Pools for Proposal: ${PROP}`);
    const prop = await ethers.getContractAt("contracts/experiments-swapr/FutarchyArbitrageHelper.sol:IFutarchyProposal", PROP);
    const factory = await ethers.getContractAt("contracts/experiments-swapr/FutarchyArbitrageHelper.sol:IAlgebraFactory", FACTORY);

    // Get Tokens
    // 0 & 2 (YES)
    const [t0] = await prop.wrappedOutcome(0);
    const [t2] = await prop.wrappedOutcome(2);

    // 1 & 3 (NO)
    const [t1] = await prop.wrappedOutcome(1);
    const [t3] = await prop.wrappedOutcome(3);

    console.log(`Tokens YES: ${t0} / ${t2}`);
    console.log(`Tokens NO:  ${t1} / ${t3}`);

    // Check Pools
    const poolYes = await factory.poolByPair(t0, t2);
    console.log(`Pool YES: ${poolYes}`);

    const poolNo = await factory.poolByPair(t1, t3);
    console.log(`Pool NO:  ${poolNo}`);

    // If pools exist, check state
    if (poolYes !== ethers.ZeroAddress) {
        try {
            const p = await ethers.getContractAt("IAlgebraPool", poolYes);
            const s = await p.globalState();
            console.log(`YES Price: ${s.price}`);
        } catch (e) { console.log("YES Pool Read Error:", e.message); }
    }

    if (poolNo !== ethers.ZeroAddress) {
        try {
            const p = await ethers.getContractAt("IAlgebraPool", poolNo);
            const s = await p.globalState();
            console.log(`NO Price: ${s.price}`);
        } catch (e) { console.log("NO Pool Read Error:", e.message); }
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
