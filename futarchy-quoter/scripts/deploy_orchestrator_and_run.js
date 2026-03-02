const hre = require("hardhat");
const { ethers } = hre;
const fs = require('fs');
const { execSync } = require('child_process');


// Load Config
const configPath = './deploymentConfig.json';
let FILE_CONFIG = {};
if (fs.existsSync(configPath)) {
    FILE_CONFIG = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} else {
    console.warn("⚠️ deploymentConfig.json not found, using defaults.");
}

const CONFIG = {
    // Allow overriding market name via ENV var for quick testing, else use config file
    MARKET_NAME: process.env.MARKET_NAME || `${FILE_CONFIG.MARKET_NAME_PREFIX || "TEST"}: ${FILE_CONFIG.MARKET_NAME_SUFFIX || "Default Market"}`,
    TOKENS: FILE_CONFIG.TOKENS || {
        COMPANY: "0x9C58BAcC331c9aa871AFD802DB6379a98e80CEdb",
        CURRENCY: "0xaf204776c7245bF4147c2612BF6e5972Ee483701"
    },
    SPOT_PRICE: FILE_CONFIG.SPOT_PRICE || 103,
    IMPACT: FILE_CONFIG.IMPACT || 0.001,
    PROBABILITY: FILE_CONFIG.PROBABILITY || 0.5,
    LIQUIDITY_AMOUNT: FILE_CONFIG.LIQUIDITY_AMOUNT || "0.0001",

    // Proposal Params
    CATEGORY: FILE_CONFIG.CATEGORY || "crypto, kleros, governance",
    LANGUAGE: "en",
    MIN_BOND: FILE_CONFIG.MIN_BOND || "1000000000000000000",
    OPENING_TIME: FILE_CONFIG.OPENING_TIME || Math.floor(Date.now() / 1000) + 3600
};

const CONTRACTS = FILE_CONFIG.CONTRACTS || {
    FACTORY: "0xa6cB18FCDC17a2B44E5cAd2d80a6D5942d30a345",
    ADAPTER: "0x7495a583ba85875d59407781b4958ED6e0E1228f",
    POSITION_MANAGER: "0x91fd594c46d8b01e62dbdebed2401dde01817834"
};

async function main() {
    const [signer] = await ethers.getSigners();
    console.log(`\n🚀 Starting Deployment with: ${signer.address}`);

    // 1. Deploy Orchestrator
    console.log(`\n1️⃣  Deploying FutarchyOrchestrator...`);
    const Orchestrator = await ethers.getContractFactory("FutarchyOrchestrator");
    const orchestrator = await Orchestrator.deploy(
        CONTRACTS.FACTORY,
        CONTRACTS.ADAPTER,
        CONTRACTS.POSITION_MANAGER
    );
    await orchestrator.waitForDeployment();
    const orchestratorAddress = await orchestrator.getAddress();
    console.log(`   ✅ Orchestrator Deployed: ${orchestratorAddress}`);

    // Save to file
    fs.writeFileSync('deployed_orchestrator.json', JSON.stringify({
        address: orchestratorAddress,
        factory: CONTRACTS.FACTORY,
        adapter: CONTRACTS.ADAPTER,
        positionManager: CONTRACTS.POSITION_MANAGER,
        timestamp: new Date().toISOString()
    }, null, 2));

    // --- INTEGRATED VERIFICATION ---
    console.log(`\n🕵️ Starting Integrated Verification (TEST_DEPLOY_VERIFY)...`);
    console.log("   Waiting 30 seconds for block propagation..."); // Longer wait for safety
    await new Promise(r => setTimeout(r, 30000));

    try {
        const verifyCmd = `npx hardhat verify --network gnosis ${orchestratorAddress} ${CONTRACTS.FACTORY} ${CONTRACTS.ADAPTER} ${CONTRACTS.POSITION_MANAGER}`;
        console.log(`   Running: ${verifyCmd}`);
        execSync(verifyCmd, { stdio: 'inherit' });
        console.log("   ✅ Verification command finished.");
    } catch (e) {
        console.error("   ⚠️ Verification failed (non-fatal for pool creation):", e.message);
        // We continue to ensure pools are created even if Etherscan API acts up
    }
    // -------------------------------

    // 2. Prepare Inputs
    console.log(`\n2️⃣  Preparing Inputs...`);

    const spotPriceWei = ethers.parseUnits(CONFIG.SPOT_PRICE.toString(), 18);
    const impactWei = ethers.parseUnits(CONFIG.IMPACT.toString(), 18);
    const probabilityWei = ethers.parseUnits(CONFIG.PROBABILITY.toString(), 18);
    const liquidityAmountWei = ethers.parseUnits(CONFIG.LIQUIDITY_AMOUNT, 18);

    console.log(`   Spot (wei): ${spotPriceWei.toString()}`);
    console.log(`   Impact (wei): ${impactWei.toString()}`);
    console.log(`   Prob (wei): ${probabilityWei.toString()}`);
    console.log(`   Liquidity (wei): ${liquidityAmountWei.toString()}`);

    // 3. Approve Tokens (Safe Allowances)
    console.log(`\n3️⃣  Approving Tokens (Safe logic)...`);

    // Read from ENV or default to safe low values
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

    // 4. Executing Pools
    console.log(`\n4️⃣  Creating Pools...`);

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
