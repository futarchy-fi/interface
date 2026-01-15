const hre = require("hardhat");
const { ethers } = hre;

const ORCHESTRATOR_ADDRESS = "0x6b5b8Ee9097D3e267F60dA1b417C5f8aCa505bf3"; // User provided

const CONFIG = {
    MARKET_NAME: "TEST_EXISTING_RUN: GIP-140 Revamp Snapshot voting strategies be apporved",
    TOKENS: {
        COMPANY: "0x9C58BAcC331c9aa871AFD802DB6379a98e80CEdb", // GNO
        CURRENCY: "0xaf204776c7245bF4147c2612BF6e5972Ee483701" // sDAI
    },
    SPOT_PRICE: 103, // 103 sDAI per GNO
    IMPACT: 0.001,   // 0.1% positive impact
    PROBABILITY: 0.5,
    LIQUIDITY_AMOUNT: "0.0001", // Quote token amount

    // Proposal Params
    CATEGORY: "crypto, kleros, governance",
    LANGUAGE: "en",
    MIN_BOND: "1000000000000000000",
    OPENING_TIME: Math.floor(Date.now() / 1000) + 3600
};

async function main() {
    const [signer] = await ethers.getSigners();
    console.log(`\n🚀 Executing on Existing Orchestrator: ${ORCHESTRATOR_ADDRESS}`);
    console.log(`   Signer: ${signer.address}`);

    const orchestrator = await ethers.getContractAt("FutarchyOrchestrator", ORCHESTRATOR_ADDRESS);

    // 1. Prepare Inputs
    console.log(`\n1️⃣  Preparing Inputs...`);
    const spotPriceWei = ethers.parseUnits(CONFIG.SPOT_PRICE.toString(), 18);
    const impactWei = ethers.parseUnits(CONFIG.IMPACT.toString(), 18);
    const probabilityWei = ethers.parseUnits(CONFIG.PROBABILITY.toString(), 18);
    const liquidityAmountWei = ethers.parseUnits(CONFIG.LIQUIDITY_AMOUNT, 18);

    console.log(`   Spot (wei): ${spotPriceWei.toString()}`);
    console.log(`   Impact (wei): ${impactWei.toString()}`);
    console.log(`   Prob (wei): ${probabilityWei.toString()}`);
    console.log(`   Liquidity (wei): ${liquidityAmountWei.toString()}`);

    // 2. Approve Tokens
    console.log(`\n2️⃣  Approving Tokens (Safe logic)...`);
    const safeGno = ethers.parseEther("0.02"); // Sufficient for 6 pools
    const safeSdai = ethers.parseEther("1");

    const gno = await ethers.getContractAt("IERC20", CONFIG.TOKENS.COMPANY);
    const sdai = await ethers.getContractAt("IERC20", CONFIG.TOKENS.CURRENCY);

    console.log("   Approving GNO...");
    await (await gno.approve(ORCHESTRATOR_ADDRESS, safeGno)).wait();
    console.log("   Approving sDAI...");
    await (await sdai.approve(ORCHESTRATOR_ADDRESS, safeSdai)).wait();
    console.log(`   ✅ Approved.`);

    // 3. Executing Pools
    console.log(`\n3️⃣  Creating Pools...`);

    // --- POOL 1 (Creates Proposal) ---
    console.log(`   Creating Pool 1 (YES-Comp/YES-Curr) & Proposal...`);

    const proposalParams = {
        marketName: CONFIG.MARKET_NAME,
        companyToken: CONFIG.TOKENS.COMPANY,
        currencyToken: CONFIG.TOKENS.CURRENCY,
        category: CONFIG.CATEGORY,
        language: CONFIG.LANGUAGE,
        minBond: CONFIG.MIN_BOND,
        openingTime: CONFIG.OPENING_TIME
    };

    const tx1 = await orchestrator.createProposalAndYesConditionalPool(
        proposalParams,
        spotPriceWei,
        impactWei,
        probabilityWei,
        liquidityAmountWei
    );
    console.log(`   Tx Sent: ${tx1.hash}`);
    const receipt1 = await tx1.wait();

    // Find Proposal Address
    let proposalAddress;
    const event = receipt1.logs.find(log => {
        try { return orchestrator.interface.parseLog(log)?.name === "PoolCreated"; } catch (e) { return false; }
    });
    if (event) {
        const parsed = orchestrator.interface.parseLog(event);
        proposalAddress = parsed.args.proposal;
        console.log(`   ✅ Proposal Created: ${proposalAddress}`);
        console.log(`   ✅ Pool 1 Created: ${parsed.args.pool}`);
    } else {
        throw new Error("Could not find PoolCreated event to get proposal address");
    }

    // --- Helper for subsequent pools ---
    const createPool = async (methodName, poolId, label) => {
        console.log(`\n   Creating Pool ${poolId} (${label})...`);
        try {
            let tx;
            if (poolId === 2) {
                tx = await orchestrator.createNoConditionalPool(proposalAddress, spotPriceWei, impactWei, probabilityWei, liquidityAmountWei);
            } else if (poolId === 3) {
                tx = await orchestrator.createYesExpectedValuePool(proposalAddress, spotPriceWei, probabilityWei, liquidityAmountWei);
            } else if (poolId === 4) {
                tx = await orchestrator.createNoExpectedValuePool(proposalAddress, spotPriceWei, probabilityWei, liquidityAmountWei);
            } else if (poolId === 5) {
                tx = await orchestrator.createYesPredictionPool(proposalAddress, probabilityWei, liquidityAmountWei);
            } else if (poolId === 6) {
                tx = await orchestrator.createNoPredictionPool(proposalAddress, probabilityWei, liquidityAmountWei);
            }

            console.log(`   Tx Sent: ${tx.hash}`);
            await tx.wait();
            console.log(`   ✅ Pool ${poolId} Created.`);
        } catch (e) {
            console.error(`   ❌ Failed to create Pool ${poolId}:`, e.message);
        }
    }

    // --- Remaining Pools ---
    await createPool("createNoConditionalPool", 2, "NO-Comp/NO-Curr");
    await createPool("createYesExpectedValuePool", 3, "YES-Comp/Currency");
    await createPool("createNoExpectedValuePool", 4, "NO-Comp/Currency");
    await createPool("createYesPredictionPool", 5, "YES-Curr/Currency");
    await createPool("createNoPredictionPool", 6, "NO-Curr/Currency");

    console.log(`\n✅ All Operations Complete!`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
