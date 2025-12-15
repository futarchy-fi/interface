const hre = require("hardhat");
const { ethers } = hre;

async function main() {
    console.log("🧪 Testing FutarchyArbitrageHelper with Mock Proposal...");

    const HELPER_ADDRESS = "0x6142502Cba7CD660F38A7232d9474B0B89883533";

    // Real Pools we verified
    const YES_POOL = "0x51b56a6566EfB1b91371024f7CE063cEC7F23B69";
    const NO_POOL = "0x6E39EF837f300F231987b2871467f2d385b082B5";

    // YES: Token0=GNO, Token1=sDAI
    const YES_ASSET = "0x536Cd6D315c33E013BCceaea8351f1dC4B4A4a6F";
    const YES_CURRENCY = "0x5695F362007fB0Caf01b0D7370deBB30153244eD";

    // NO: Token0=NO_sDAI, Token1=NO_GNO
    const NO_ASSET = "0xd26F0d2bBaeb156571177Cc32b3a4A70Ce21cb3A";
    const NO_CURRENCY = "0xCA7445827f6B5408d7fDD57615526933b769c1f3";

    // Deploy Mock
    const Mock = await ethers.getContractFactory("MockFutarchyProposal");
    const mock = await Mock.deploy();
    await mock.waitForDeployment();
    const mockAddress = await mock.getAddress();
    console.log(`   Mock Proposal: ${mockAddress}`);

    // Setup Mock Tokens with waits
    console.log("   Setting up tokens...");
    let tx = await mock.setToken(0, YES_ASSET);
    await tx.wait();

    tx = await mock.setToken(2, YES_CURRENCY);
    await tx.wait();

    tx = await mock.setToken(1, NO_ASSET);
    await tx.wait();

    tx = await mock.setToken(3, NO_CURRENCY);
    await tx.wait();

    // Call Helper
    // Params: Spot=107.73, Prob=0.6154, Impact=0.0744
    const ONE = ethers.parseEther("1");
    // We strictly use strings for parseEther to avoid precision loss
    const spot = ethers.parseEther("107.73");
    const prob = ethers.parseEther("0.6154");
    const impact = ethers.parseEther("0.0744");

    const helper = await ethers.getContractAt("FutarchyArbitrageHelper", HELPER_ADDRESS);

    console.log(`\n🔮 Calling getArbitrageInfo...`);

    try {
        const result = await helper.getArbitrageInfo.staticCall(mockAddress, spot, prob, impact);

        console.log(`\n✅ Result Received!`);

        console.log(`\n--- YES POOL (${result.yesPool.pool}) ---`);
        console.log(`   Tokens: ${result.yesPool.token0Symbol} / ${result.yesPool.token1Symbol}`);
        console.log(`   Inverted: ${result.yesPool.isInverted}`);
        console.log(`   Target Price (Human): ${ethers.formatEther(result.yesPool.targetPriceHuman)}`);
        console.log(`   Delta 0: ${ethers.formatEther(result.yesPool.amount0Delta)}`);
        console.log(`   Delta 1: ${ethers.formatEther(result.yesPool.amount1Delta)}`);

        console.log(`\n--- NO POOL (${result.noPool.pool}) ---`);
        console.log(`   Tokens: ${result.noPool.token0Symbol} / ${result.noPool.token1Symbol}`);
        console.log(`   Inverted: ${result.noPool.isInverted}`);
        console.log(`   Target Price (Human): ${ethers.formatEther(result.noPool.targetPriceHuman)}`);
        console.log(`   Delta 0: ${ethers.formatEther(result.noPool.amount0Delta)}`);
        console.log(`   Delta 1: ${ethers.formatEther(result.noPool.amount1Delta)}`);

    } catch (e) {
        console.error("❌ Error:", e);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
