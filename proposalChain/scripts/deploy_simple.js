const hre = require("hardhat");
const { ethers } = hre;

// --- Configuration ---
const CONFIG = {
    MARKET_NAME: "GIP-140: Revamp Snapshot voting strategies",
    TOKENS: {
        COMPANY: "0x9C58BAcC331c9aa871AFD802DB6379a98e80CEdb", // GNO on Gnosis
        CURRENCY: "0xaf204776c7245bF4147c2612BF6e5972Ee483701" // sDAI on Gnosis
    },
    // Test Parameters
    SPOT_PRICE: 103, // sDAI per GNO
    PROBABILITY: 0.5,
    IMPACT: 0.001,
    LIQUIDITY_AMOUNT: "0.000001", // in sDAI terms (Quote)
    MIN_BOND: "1000000000000000000", // 1 token
    OPENING_TIME: 1755798465, // User provided
    CATEGORY: "crypto, kleros, governance",
    LANGUAGE: "en"
};

const CONTRACTS = {
    FACTORY: "0xa6cB18FCDC17a2B44E5cAd2d80a6D5942d30a345",
    ADAPTER: "0x7495a583ba85875d59407781b4958ED6e0E1228f",
    POSITION_MANAGER: "0x91fd594c46d8b01e62dbdebed2401dde01817834"
};

// --- ABIs ---

const ABIS = {
    ERC20: [
        "function approve(address spender, uint256 amount) external returns (bool)",
        "function allowance(address owner, address spender) external view returns (uint256)",
        "function balanceOf(address account) external view returns (uint256)",
        "function decimals() external view returns (uint8)",
        "function symbol() external view returns (string)"
    ],
    // Tuple: (marketName, companyToken, currencyToken, category, language, minBond, openingTime)
    FACTORY: [
        "function createProposal(tuple(string,address,address,string,string,uint256,uint32) params) external returns (address)",
        "event ProposalCreated(address indexed proposal, string marketName, address creator)" // Assuming generic event name or index match
    ],
    PROPOSAL: [
        "function wrappedOutcome(uint256 index) external view returns (address, bytes)"
    ],
    ADAPTER: [
        "function splitPosition(address proposal, address collateralToken, uint256 amount) external",
        "function mergePositions(address proposal, address collateralToken, uint256 amount) external"
    ],
    POSITION_MANAGER: [
        "function createAndInitializePoolIfNecessary(address token0, address token1, uint160 sqrtPriceX96) external returns (address pool)",
        "function mint(tuple(address token0, address token1, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline) params) external returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)"
    ]
};

// --- Helpers ---

// Price = token1/token0
function getSqrtPriceX96(price) {
    return BigInt(Math.floor(Math.sqrt(price) * (2 ** 96)));
}

async function getContract(address, abi, signer) {
    return new ethers.Contract(address, abi, signer);
}

// --- Main ---

async function createFutarchy() {
    const [signer] = await ethers.getSigners();
    console.log(`\n🚀 Starting Deployment with: ${signer.address}`);

    // 1. Create Proposal
    console.log(`\n1️⃣  Creating Proposal...`);
    const factory = await getContract(CONTRACTS.FACTORY, ABIS.FACTORY, signer);

    const params = [
        CONFIG.MARKET_NAME,
        CONFIG.TOKENS.COMPANY,
        CONFIG.TOKENS.CURRENCY,
        CONFIG.CATEGORY,
        CONFIG.LANGUAGE,
        CONFIG.MIN_BOND,
        CONFIG.OPENING_TIME
    ];

    console.log(`\n2️⃣  Fetching Token Addresses...`);
    const proposal = await getContract(proposalAddress, ABIS.PROPOSAL, signer);
    const [yesCompany] = await proposal.wrappedOutcome(0);
    const [yesCurrency] = await proposal.wrappedOutcome(2);

    console.log(`   YES Company: ${yesCompany}`);
    console.log(`   YES Currency: ${yesCurrency}`);

    // 3. Prepare Amounts & Ordering
    console.log(`\n3️⃣  Calculating Amounts...`);

    // Target Price for YES-Comp / YES-Curr pair
    // Ratio = Spot * (1 + Impact) 
    // Example: 103 * 1.001 = 103.103
    const targetPriceRatio = CONFIG.SPOT_PRICE * (1 + CONFIG.IMPACT);
    console.log(`   Target Price (YES-Comp/YES-Curr): ${targetPriceRatio}`);

    // Determine Token0/Token1
    let token0, token1, priceForPool;
    if (yesCompany.toLowerCase() < yesCurrency.toLowerCase()) {
        token0 = yesCompany;
        token1 = yesCurrency;
        // Price = token1/token0 = YES-Curr / YES-Comp? 
        // No. If Token0 is Comp, Token1 is Curr.
        // Price Quote(Curr) per Base(Comp) is standard.
        // So Price = 103.103.
        priceForPool = targetPriceRatio;
        console.log(`   Order: YES-Company < YES-Currency (Standard)`);
    } else {
        token0 = yesCurrency;
        token1 = yesCompany;
        // Inverted: Price = Token1(Comp) / Token0(Curr)
        // Price = 1 / 103.103
        priceForPool = 1 / targetPriceRatio;
        console.log(`   Order: YES-Currency < YES-Company (Inverted)`);
    }

    const sqrtPriceX96 = getSqrtPriceX96(priceForPool);
    console.log(`   SqrtPriceX96: ${sqrtPriceX96.toString()}`);

    // Liquidity Amounts
    // Desired: ~0.000001 Quote (YES-Currency or sDAI terms)
    // If Standard: amount1 = 0.000001, amount0 = amount1 / 103.103
    // If Inverted: amount0 = 0.000001, amount1 = amount0 * (1/103.103) ? 
    // Wait. Inverted means Token0=Curr. So amount0 is Quote.
    // Let's stick to "User wants ~1e-6 sDAI worth".

    const amountCurrency = ethers.parseUnits(CONFIG.LIQUIDITY_AMOUNT, 18); // sDAI 18 decimals? sDAI is 18.
    const amountCompany = BigInt(Math.floor(Number(amountCurrency) / targetPriceRatio));

    console.log(`   Amount YES-Currency: ${amountCurrency.toString()} wei`);
    console.log(`   Amount YES-Company: ${amountCompany.toString()} wei`);

    // 4. Split Tokens
    console.log(`\n4️⃣  Splitting Tokens (0.01 GNO / 1 sDAI allowance)...`);

    const adapter = await getContract(CONTRACTS.ADAPTER, ABIS.ADAPTER, signer);
    const companyToken = await getContract(CONFIG.TOKENS.COMPANY, ABIS.ERC20, signer);
    const currencyToken = await getContract(CONFIG.TOKENS.CURRENCY, ABIS.ERC20, signer);

    // Approve Adapter
    // User requested safe allowance: 0.01 GNO, 1 sDAI
    const safeGnoAllowance = ethers.parseEther("0.01");
    const safeSdaiAllowance = ethers.parseEther("1");

    await (await companyToken.approve(CONTRACTS.ADAPTER, safeGnoAllowance)).wait();
    await (await currencyToken.approve(CONTRACTS.ADAPTER, safeSdaiAllowance)).wait();
    console.log(`   Approved Adapter.`);

    // Split
    // We need 'amountCompany' of YES-Comp => Split 'amountCompany' of GNO
    // We need 'amountCurrency' of YES-Curr => Split 'amountCurrency' of sDAI

    console.log(`   Splitting GNO...`);
    const txSplit1 = await adapter.splitPosition(proposalAddress, CONFIG.TOKENS.COMPANY, amountCompany);
    await txSplit1.wait();

    console.log(`   Splitting sDAI...`);
    const txSplit2 = await adapter.splitPosition(proposalAddress, CONFIG.TOKENS.CURRENCY, amountCurrency);
    await txSplit2.wait();

    console.log(`   ✅ Tokens Split.`);

    // 5. Create & Mint Pool
    console.log(`\n5️⃣  Creating & Minting Pool...`);
    const posManager = await getContract(CONTRACTS.POSITION_MANAGER, ABIS.POSITION_MANAGER, signer);
    const yesCompToken = await getContract(yesCompany, ABIS.ERC20, signer);
    const yesCurrToken = await getContract(yesCurrency, ABIS.ERC20, signer);

    // Approve Position Manager
    await (await yesCompToken.approve(CONTRACTS.POSITION_MANAGER, amountCompany)).wait();
    await (await yesCurrToken.approve(CONTRACTS.POSITION_MANAGER, amountCurrency)).wait();
    console.log(`   Approved Position Manager.`);

    // Create Pool
    console.log(`   Initializing Pool...`);
    const txPool = await posManager.createAndInitializePoolIfNecessary(token0, token1, sqrtPriceX96);
    await txPool.wait();
    console.log(`   Pool Initialized.`);

    // Mint
    console.log(`   Minting Liquidity...`);

    // Match amounts to token0/token1
    const amount0 = token0 === yesCompany ? amountCompany : amountCurrency;
    const amount1 = token1 === yesCompany ? amountCompany : amountCurrency;

    const mintParams = {
        token0: token0,
        token1: token1,
        tickLower: -887220, // Full range approx (check spacing/min tick) - using Algebra default range often safe or standard Uniswap full range
        tickUpper: 887220,
        amount0Desired: amount0,
        amount1Desired: amount1,
        amount0Min: 0,
        amount1Min: 0,
        recipient: signer.address,
        deadline: Math.floor(Date.now() / 1000) + 300
    };

    const txMint = await posManager.mint(mintParams);
    const receiptMint = await txMint.wait();

    console.log(`   ✅ Liquidity Minted! Tx: ${txMint.hash}`);
}

createFutarchy().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
