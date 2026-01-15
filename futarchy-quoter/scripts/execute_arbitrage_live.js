const hre = require("hardhat");
const { ethers } = hre;

const ROUTER_ADDRESS = "0xfFB643E73f280B97809A8b41f7232AB401a04ee1";
const HELPER_ADDRESS = "0xBF191FDd58E542230718701308d1B029b9E2231F";

const PROPOSAL_ADDRESS = "0x9590dAF4d5cd4009c3F9767C5E7668175cFd37CF";
const SPOT_PRICE = "107";
const PROBABILITY = "0.1194"; // 11.94%
const IMPACT = "0.332"; // 33.2%

// Router ABI (exactInputSingle)
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
    "function allowance(address owner, address spender) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function symbol() view returns (string)"
];

const HELPER_ABI = [
    "function simulateArbitrage(address proposal, uint256 spotPrice18, uint256 probability18, int256 impact18) external returns (tuple(tuple(address pool, address token0, address token1, string token0Symbol, string token1Symbol, bool isInverted, int256 amount0Delta, int256 amount1Delta, uint160 currentSqrtPrice, uint160 targetSqrtPrice, uint256 targetPriceHuman) yesPool, tuple(address pool, address token0, address token1, string token0Symbol, string token1Symbol, bool isInverted, int256 amount0Delta, int256 amount1Delta, uint160 currentSqrtPrice, uint160 targetSqrtPrice, uint256 targetPriceHuman) noPool))"
];

async function main() {
    const [signer] = await ethers.getSigners();
    console.log(`\n🚀 STARTING LIVE ARBITRAGE EXECUTION`);
    console.log(`   User: ${signer.address}`);
    console.log(`   Router: ${ROUTER_ADDRESS}`);

    const helper = new ethers.Contract(HELPER_ADDRESS, HELPER_ABI, signer);
    const router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, signer);

    const spot = ethers.parseEther(SPOT_PRICE);
    const prob = ethers.parseEther(PROBABILITY);
    const impact = ethers.parseEther(IMPACT);

    console.log(`\n🔮 Simulating Arbitrage...`);
    const result = await helper.simulateArbitrage.staticCall(PROPOSAL_ADDRESS, spot, prob, impact);
    console.log("   ✅ Simulation Complete.");

    await processPool(signer, router, result.yesPool, "YES");
    await processPool(signer, router, result.noPool, "NO");
}

async function processPool(signer, router, poolInfo, label) {
    if (poolInfo.pool === ethers.ZeroAddress) {
        console.log(`\n--- ${label} POOL: Skipped (Not Found) ---`);
        return;
    }

    console.log(`\n---------------------------------------------------`);
    console.log(`--- Processing ${label} POOL (${poolInfo.pool}) ---`);
    console.log(`---------------------------------------------------`);

    // Determine Trade
    // amountDelta > 0 means User SELLS (Pool Receives)
    // amountDelta < 0 means User BUYS (Pool Gives)

    let tokenIn, tokenOut, amountIn, targetSqrtPrice;
    let symbolIn, symbolOut;

    const d0 = BigInt(poolInfo.amount0Delta);
    const d1 = BigInt(poolInfo.amount1Delta);

    if (d0 === 0n && d1 === 0n) {
        console.log(`   ✅ Pool is already at target price. No trade needed.`);
        return;
    }

    if (d0 > 0n) {
        // Sell Token0
        tokenIn = poolInfo.token0;
        tokenOut = poolInfo.token1;
        amountIn = d0;
        symbolIn = poolInfo.token0Symbol;
        symbolOut = poolInfo.token1Symbol;
    } else {
        // Sell Token1 (since d1 must be > 0 if d0 < 0 in a swap)
        tokenIn = poolInfo.token1;
        tokenOut = poolInfo.token0;
        amountIn = d1;
        symbolIn = poolInfo.token1Symbol;
        symbolOut = poolInfo.token0Symbol;
    }

    targetSqrtPrice = poolInfo.targetSqrtPrice;

    console.log(`   Strategy: SELL ${ethers.formatEther(amountIn)} ${symbolIn} -> BUY ${symbolOut}`);
    console.log(`   Target SqrtPrice: ${targetSqrtPrice.toString()}`);

    const tokenInContract = new ethers.Contract(tokenIn, ERC20_ABI, signer);

    // 1. Balance Check
    const balance = await tokenInContract.balanceOf(signer.address);
    if (balance < amountIn) {
        console.error(`\n❌ ERROR: Insufficient Balance!`);
        console.error(`   Have: ${ethers.formatEther(balance)} ${symbolIn}`);
        console.error(`   Need: ${ethers.formatEther(amountIn)} ${symbolIn}`);
        console.log(`   Skipping this pool...`);
        return;
    }

    // 2. Approve
    console.log(`\n   🔓 Checking Allowance for ${symbolIn}...`);
    const allowance = await tokenInContract.allowance(signer.address, ROUTER_ADDRESS);
    if (allowance < amountIn) {
        console.log(`      ⚠️ Allowance too low. Approving ${ethers.formatEther(amountIn)}...`);
        // Approve exact amount
        const txApprove = await tokenInContract.approve(ROUTER_ADDRESS, amountIn);
        console.log(`      ⏳ Waiting for Approval: ${txApprove.hash}`);
        await txApprove.wait();
        console.log(`      ✅ Approved!`);
    } else {
        console.log(`      ✅ Allowance Sufficient.`);
    }

    // 3. Execute
    const params = {
        tokenIn: tokenIn,
        tokenOut: tokenOut,
        recipient: signer.address,
        deadline: Math.floor(Date.now() / 1000) + 1200, // 20 mins
        amountIn: amountIn,
        amountOutMinimum: 0, // Slippage handled by limitStatsPrice
        limitSqrtPrice: targetSqrtPrice
    };

    console.log(`\n   💸 PREPARING EXECUTION...`);
    console.log(`   Sending ${ethers.formatEther(amountIn)} ${symbolIn}`);
    console.log(`   Limit SqrtPrice: ${targetSqrtPrice}`);

    // Execution Block
    try {
        const txSwap = await router.exactInputSingle(params, { gasLimit: 3000000 }); // High gas limit safety
        console.log(`   ⏳ Transaction sent: ${txSwap.hash}`);
        console.log(`      Waiting for confirmation...`);

        const receipt = await txSwap.wait();
        console.log(`   ✅ Transaction Confirmed! Block: ${receipt.blockNumber}`);
    } catch (e) {
        console.error(`   ❌ Transaction Failed:`, e.message);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
