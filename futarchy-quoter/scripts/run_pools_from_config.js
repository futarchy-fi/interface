const hre = require("hardhat");
const { ethers } = hre;
const fs = require('fs');
require('dotenv').config();

// Load Config
const configPath = './deploymentConfig.json';
let FILE_CONFIG = {};
if (fs.existsSync(configPath)) {
    FILE_CONFIG = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} else {
    console.warn("⚠️ deploymentConfig.json not found, using defaults.");
}

const CONFIG = {
    MARKET_NAME: process.env.MARKET_NAME || `${FILE_CONFIG.MARKET_NAME_PREFIX || "TEST"}: ${FILE_CONFIG.MARKET_NAME_SUFFIX || "Default Market"}`,
    TOKENS: FILE_CONFIG.TOKENS || {
        COMPANY: "0x9C58BAcC331c9aa871AFD802DB6379a98e80CEdb",
        CURRENCY: "0xaf204776c7245bF4147c2612BF6e5972Ee483701"
    },
    SPOT_PRICE: FILE_CONFIG.SPOT_PRICE || 103,
    IMPACT: FILE_CONFIG.IMPACT || 0.001,
    PROBABILITY: FILE_CONFIG.PROBABILITY || 0.5,
    LIQUIDITY_AMOUNT: FILE_CONFIG.LIQUIDITY_AMOUNT || "0.0001",
    CATEGORY: FILE_CONFIG.CATEGORY || "crypto, kleros, governance",
    LANGUAGE: "en",
    MIN_BOND: FILE_CONFIG.MIN_BOND || "1000000000000000000",
    OPENING_TIME: FILE_CONFIG.OPENING_TIME || Math.floor(Date.now() / 1000) + 3600
};

async function main() {
    // Address handling
    const orchestratorAddress = process.env.ORCHESTRATOR_ADDRESS;
    if (!orchestratorAddress) {
        throw new Error("❌ Error: You must provide ORCHESTRATOR_ADDRESS env var.");
    }

    const [signer] = await ethers.getSigners();
    console.log(`\n🚀 Executing Pools on Existing Contract: ${orchestratorAddress}`);
    console.log(`   Signer: ${signer.address}`);
    console.log(`   Market Name: "${CONFIG.MARKET_NAME}"`);

    const orchestrator = await ethers.getContractAt("FutarchyOrchestrator", orchestratorAddress);

    // 1. Prepare Inputs
    console.log(`\n1️⃣  Preparing Inputs from Config...`);
    const spotPriceWei = ethers.parseUnits(CONFIG.SPOT_PRICE.toString(), 18);
    const impactWei = ethers.parseUnits(CONFIG.IMPACT.toString(), 18);
    const probabilityWei = ethers.parseUnits(CONFIG.PROBABILITY.toString(), 18);
    const liquidityAmountWei = ethers.parseUnits(CONFIG.LIQUIDITY_AMOUNT, 18);

    // 2. Approve Tokens (Safe logic)
    console.log(`\n2️⃣  Approving Tokens (Safe logic)...`);

    // Read from ENV or default to safe low values
    const safeCompanyAmount = process.env.COMPANY_TOKEN_APPROVAL_AMOUNT || "0.02";
    const safeCurrencyAmount = process.env.CURRENCY_TOKEN_APPROVAL_AMOUNT || "1";

    const safeCompany = ethers.parseEther(safeCompanyAmount);
    const safeCurrency = ethers.parseEther(safeCurrencyAmount);

    console.log(`   Approval Limits: Company=${safeCompanyAmount}, Currency=${safeCurrencyAmount}`);

    const companyToken = await ethers.getContractAt("IERC20", CONFIG.TOKENS.COMPANY);
    const currencyToken = await ethers.getContractAt("IERC20", CONFIG.TOKENS.CURRENCY);

    await (await companyToken.approve(orchestratorAddress, safeCompany)).wait();
    await (await currencyToken.approve(orchestratorAddress, safeCurrency)).wait();
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
