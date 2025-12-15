const hre = require("hardhat");
const { ethers } = hre;

const ROUTER_ADDRESS = "0xfFB643E73f280B97809A8b41f7232AB401a04ee1";
const HELPER_ADDRESS = "0x90578451572b1339C80664b0feBc5352342f425E";
const PROPOSAL_ADDRESS = "0x7e9Fc0C3d6C1619d4914556ad2dEe6051Ce68418";

const ROUTER_ABI = [
    {
        "inputs": [
            {
                "components": [
                    { "internalType": "address", "name": "tokenIn", "type": "address" },
                    { "internalType": "address", "name": "tokenOut", "type": "address" },
                    { "internalType": "address", "name": "recipient", "type": "address" },
                    { "internalType": "uint256", "name": "deadline", "type": "uint256" },
                    { "internalType": "uint256", "name": "amountIn", "type": "uint256" },
                    { "internalType": "uint256", "name": "amountOutMinimum", "type": "uint256" },
                    { "internalType": "uint160", "name": "limitSqrtPrice", "type": "uint160" }
                ],
                "internalType": "struct ISwapRouter.ExactInputSingleParams",
                "name": "params",
                "type": "tuple"
            }
        ],
        "name": "exactInputSingle",
        "outputs": [{ "internalType": "uint256", "name": "amountOut", "type": "uint256" }],
        "stateMutability": "payable",
        "type": "function"
    }
];

const ERC20_ABI = [
    "function balanceOf(address account) view returns (uint256)",
    "function symbol() view returns (string)"
];

async function main() {
    const [signer] = await ethers.getSigners();
    console.log(`\n🕵️ User: ${signer.address}`);

    // Params
    const spot = ethers.parseEther("107.46");
    const prob = ethers.parseEther("0.2426");
    const impact = ethers.parseEther("0.4636");

    console.log("🔮 Fetching Arbitrage Data...");
    const helper = await ethers.getContractAt("FutarchyArbitrageHelper", HELPER_ADDRESS);
    const result = await helper.getArbitrageInfo.staticCall(PROPOSAL_ADDRESS, spot, prob, impact); // Use staticCall!

    // Process YES Pool
    if (result.yesPool.pool !== ethers.ZeroAddress) {
        console.log(`\n--- YES POOL (${result.yesPool.pool}) ---`);
        await simulateSwap(signer, result.yesPool);
    }

    // Process NO Pool
    if (result.noPool.pool !== ethers.ZeroAddress) {
        console.log(`\n--- NO POOL (${result.noPool.pool}) ---`);
        await simulateSwap(signer, result.noPool);
    }
}

async function simulateSwap(signer, poolInfo) {
    // Determine Trade
    // If Delta > 0, we sell that token? 
    // Wait. Helper returns "Amount Delta" to the POOL.
    // If Delta is POSITIVE, the Pool GETS tokens. So User SELLS.
    // If Delta is NEGATIVE, the Pool GIVES tokens. So User BUYS.

    let tokenIn, tokenOut, amountIn;

    // Check Token 0
    if (poolInfo.amount0Delta > 0n) {
        // Pool needs +Token0. User Sells Token0.
        tokenIn = poolInfo.token0;
        tokenOut = poolInfo.token1;
        amountIn = poolInfo.amount0Delta;
    } else if (poolInfo.amount1Delta > 0n) {
        // Pool needs +Token1. User Sells Token1.
        tokenIn = poolInfo.token1;
        tokenOut = poolInfo.token0;
        amountIn = poolInfo.amount1Delta;
    } else {
        console.log("   ✅ Pool is already balanced (or no valid trade).");
        return;
    }

    const tInContract = new ethers.Contract(tokenIn, ERC20_ABI, signer);
    const symIn = await tInContract.symbol();
    const tOutContract = new ethers.Contract(tokenOut, ERC20_ABI, signer);
    const symOut = await tOutContract.symbol();

    console.log(`   Action: SELL ${ethers.formatEther(amountIn)} ${symIn} -> BUY ${symOut}`);

    // Check Balance
    try {
        const bal = await tInContract.balanceOf(signer.address);
        console.log(`   Balance: ${ethers.formatEther(bal)} ${symIn}`);
        if (bal < amountIn) {
            console.warn("   ⚠️ WARNING: Insufficient Balance. Simulation might fail.");
        }
    } catch { }

    const router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, signer);

    const params = {
        tokenIn: tokenIn,
        tokenOut: tokenOut,
        recipient: signer.address,
        deadline: Math.floor(Date.now() / 1000) + 600,
        amountIn: amountIn,
        amountOutMinimum: 0,
        limitSqrtPrice: 0
    };

    try {
        const amountOut = await router.exactInputSingle.staticCall(params);
        console.log(`   ✅ Simulation SUCCESS!`);
        console.log(`   Received: ${ethers.formatEther(amountOut)} ${symOut}`);
    } catch (e) {
        console.error(`   ❌ Simulation FAILED: ${e.shortMessage || e.message}`);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
