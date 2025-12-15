const { ethers } = require("ethers");

// ---------------------------------------------------------
// CONFIGURATION
// ---------------------------------------------------------

// 1. The specific Uniswap V3 Pool you want to find positions for
// Default to a known pool, or allow passing arguments
const TARGET_POOL = {
    token0: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // Example: WBTC
    token1: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // Example: WETH
    fee: 3000, // Fee tier: 500 (0.05%), 3000 (0.3%), 10000 (1%)
};

// 2. Mainnet NonfungiblePositionManager Contract Address (Same for most chains)
const NFPM_ADDRESS = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88";

// 3. Minimal ABI to fetch positions
const NFPM_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
    "function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)"
];

// ---------------------------------------------------------
// MAIN FUNCTION
// ---------------------------------------------------------

async function findPositionsForPool(providerOrSigner, walletAddress, targetPool = TARGET_POOL) {
    console.log(`\n🔍 Scanning positions for: ${walletAddress}`);

    // Create Contract Instance
    const nfpmContract = new ethers.Contract(NFPM_ADDRESS, NFPM_ABI, providerOrSigner);

    // 1. Get number of NFT positions owned by address
    let balance;
    try {
        balance = await nfpmContract.balanceOf(walletAddress);
        console.log(`Found ${balance} total Uniswap V3 positions.`);
    } catch (error) {
        console.error("Error fetching balance:", error.message);
        return [];
    }

    const foundLinks = [];

    // 2. Loop through all positions
    for (let i = 0; i < balance; i++) {
        try {
            // Get Token ID by index
            const tokenId = await nfpmContract.tokenOfOwnerByIndex(walletAddress, i);

            // Get Position Details
            const position = await nfpmContract.positions(tokenId);

            // 3. Filter: Check if this position matches our Target Pool
            // Note: We normalize addresses to lowercase for comparison
            const posToken0 = position.token0.toLowerCase();
            const posToken1 = position.token1.toLowerCase();
            const posFee = Number(position.fee);

            const targetA = targetPool.token0.toLowerCase();
            const targetB = targetPool.token1.toLowerCase();

            // Uniswap tokens are always sorted, but we check both combinations just in case your config is mixed
            const isMatch =
                (posFee === targetPool.fee) &&
                ((posToken0 === targetA && posToken1 === targetB) ||
                    (posToken0 === targetB && posToken1 === targetA));

            if (isMatch) {
                const link = `https://app.uniswap.org/pools/${tokenId}`;
                console.log(`✅ MATCH Found! Token ID: ${tokenId} -> Liquidity: ${position.liquidity}`);
                foundLinks.push(link);
            }

        } catch (err) {
            console.error(`Error fetching index ${i}:`, err.message);
        }
    }

    if (foundLinks.length === 0) {
        console.log("No matching positions found for this pool.");
    }

    return foundLinks;
}

// ---------------------------------------------------------
// USAGE EXAMPLES
// ---------------------------------------------------------

async function main() {
    // Basic argument parsing
    const args = process.argv.slice(2);
    const userAddress = args[0] || "0xYourWalletAddressHere"; // User must provide address or default
    const rpcUrl = args[1] || "https://eth.llamarpc.com"; // User can provide RPC

    if (args.length === 0) {
        console.log("Usage: node find_uniswap_positions.js <walletAddress> [rpcUrl]");
        console.log("Using default/example values...");
    }

    try {
        // Use a Public RPC
        const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

        // Run finder
        const links = await findPositionsForPool(provider, userAddress);

        console.log("\n--- VALID MANAGE LINKS ---");
        links.forEach(link => console.log(link));

    } catch (error) {
        console.error("Critical Error:", error);
    }
}

// Only run main if called directly
if (require.main === module) {
    main();
}

module.exports = { findPositionsForPool };
