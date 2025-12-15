const hre = require("hardhat");
const { ethers } = hre;

const ROUTER_ADDRESS = "0xfFB643E73f280B97809A8b41f7232AB401a04ee1";
const POOL_ADDRESS = "0x51b56a6566EfB1b91371024f7CE063cEC7F23B69";

// ABI for exactOutputSingle
const ROUTER_ABI = [
    {
        "inputs": [
            {
                "components": [
                    { "internalType": "address", "name": "tokenIn", "type": "address" },
                    { "internalType": "address", "name": "tokenOut", "type": "address" },
                    { "internalType": "uint24", "name": "fee", "type": "uint24" }, // V3 router usually wants fee for single
                    { "internalType": "address", "name": "recipient", "type": "address" },
                    { "internalType": "uint256", "name": "deadline", "type": "uint256" },
                    { "internalType": "uint256", "name": "amountOut", "type": "uint256" },
                    { "internalType": "uint256", "name": "amountInMaximum", "type": "uint256" },
                    { "internalType": "uint160", "name": "limitSqrtPrice", "type": "uint160" }
                ],
                "internalType": "struct ISwapRouter.ExactOutputSingleParams",
                "name": "params",
                "type": "tuple"
            }
        ],
        "name": "exactOutputSingle",
        "outputs": [{ "internalType": "uint256", "name": "amountIn", "type": "uint256" }],
        "stateMutability": "payable",
        "type": "function"
    }
];

async function main() {
    const [signer] = await ethers.getSigners();
    const pool = await ethers.getContractAt("contracts/experiments-swapr/AlgebraPriceDeltaHelper.sol:IAlgebraPool", POOL_ADDRESS);
    const token0 = await pool.token0(); // GNO (Company)
    const token1 = await pool.token1(); // SDAI (Currency)

    // Helper said: Amount0 = -0.014307... (Remove GNO from Pool)
    // Means User BUYS GNO.
    const amountOutVal = "0.014307684078062245";
    const amountOut = ethers.parseEther(amountOutVal);

    // We pay with SDAI
    // TokenIn = SDAI, TokenOut = GNO

    console.log(`\n🧪 Simulating Correction (Buying back GNO)...`);
    console.log(`   User:    ${signer.address}`);
    console.log(`   Buying:  ${amountOutVal} GNO`);
    console.log(`   Paying:  [Calculated by Router] SDAI`);

    const router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, signer);

    // Need to find fee.
    const globalState = await pool.globalState();
    // Algebra doesn't strictly use fee in path for V3 router exactly same way as Uniswap, 
    // but Single params usually ask for it. 
    // Wait, Swapr Router might be Algebra Router which might differ slightly?
    // The user provided standard V3 Interface earlier.
    // Let's assume standard ExactOutputSingleParams which has `fee`.
    // Algebra fee is dynamic, but maybe 0 is accepted or looked up?
    // or we pass the pool fee?
    const fee = globalState.fee; // e.g. 180 (0.018%)
    // Note: params definition typically wants uint24 fee.

    // However, for Algebra, the fee is dynamic. 
    // If this is the Algebra Router, it might lookup the pool by tokens.
    // The ABI provided by user earlier had:
    // struct ExactOutputSingleParams { tokenIn, tokenOut, fee, ... }
    // So we pass it.

    // Note: Algebra pools (Swapr) might not use the 'fee' param to find the pool, 
    // but the router interface usually demands it.

    const params = {
        tokenIn: token1, // SDAI
        tokenOut: token0, // GNO
        fee: 0, // Try 0, or maybe the static fee? Algebra usually ignores this for lookup if it uses one pool per pair logic.
        recipient: signer.address,
        deadline: Math.floor(Date.now() / 1000) + 600,
        amountOut: amountOut,
        amountInMaximum: ethers.parseEther("1000"), // Max Cap
        limitSqrtPrice: 0
    };

    console.log(`\n🔄 Calling exactOutputSingle.staticCall...`);

    try {
        const amountInReq = await router.exactOutputSingle.staticCall(params);
        console.log(`   ✅ Simulation Successful!`);
        console.log(`   Cost: ${ethers.formatEther(amountInReq)} SDAI`);

    } catch (e) {
        console.error("\n❌ Simulation Failed:", e.shortMessage || e.message);
        // Fallback: Try with fee? Although Algebra pools usually don't need fee tier to identify.
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
