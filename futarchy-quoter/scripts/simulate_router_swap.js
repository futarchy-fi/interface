const hre = require("hardhat");
const { ethers } = hre;

const ROUTER_ADDRESS = "0xfFB643E73f280B97809A8b41f7232AB401a04ee1";
const POOL_ADDRESS = "0x51b56a6566EfB1b91371024f7CE063cEC7F23B69";

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

async function main() {
    const [signer] = await ethers.getSigners();
    console.log(`\n🕵️ Simulation User: ${signer.address}`);

    const pool = await ethers.getContractAt("IAlgebraPool", POOL_ADDRESS);
    const token0 = await pool.token0();
    const token1 = await pool.token1();

    // We want to SELL Amount0 (Add to pool) to Buy Amount1 (Remove from pool).
    // From re-verified test step: Amount0 ~ 0.028723398731805069
    const amountInVal = "0.028723398731805069";
    const amountIn = ethers.parseEther(amountInVal);

    console.log(`   Router:  ${ROUTER_ADDRESS}`);
    console.log(`   TokenIn: ${token0} (Amount: ${amountInVal})`);
    console.log(`   TokenOut:${token1}`);

    const router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, signer);

    const params = {
        tokenIn: token0,
        tokenOut: token1,
        recipient: signer.address,
        deadline: Math.floor(Date.now() / 1000) + 600, // 10 mins
        amountIn: amountIn,
        amountOutMinimum: 0, // No slippage protection for simulation
        limitSqrtPrice: 0 // No limit
    };

    console.log(`\n🔄 Calling exactInputSingle.staticCall...`);

    try {
        // staticCall simulates the transaction on the node without broadcasting
        const amountOut = await router.exactInputSingle.staticCall(params);

        console.log(`\n✅ Simulation Successful!`);
        console.log(`   Amount Out (Token1): ${ethers.formatEther(amountOut)}`);

    } catch (e) {
        console.error("\n❌ Simulation Failed:");
        console.error("   Reason:", e.shortMessage || e.message);

        if (e.message.includes("STF") || e.message.includes("transfer")) {
            console.log("\n💡 NOTE: This failure is likely because your wallet does not have the tokens or allowance approved.");
            console.log("   Since this is a real node simulation, 'callStatic' still enforces balanceOf/allowance checks.");
            console.log("   To bypass this, we would need to fork the chain, which you asked not to do.");
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
