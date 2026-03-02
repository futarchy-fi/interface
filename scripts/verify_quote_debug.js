const { ethers } = require("ethers");

// Configuration
const HELPER_ADDRESS = "0xe32bfb3DD8bA4c7F82dADc4982c04Afa90027EFb";
// const RPC_URL = "https://rpc.gnosischain.com"; 
const RPC_URL = "https://gnosis-rpc.publicnode.com"; // Alternative RPC

const HELPER_ABI = [
    "function simulateQuote(address proposal, bool isYesPool, uint8 inputType, uint256 amountIn) external view returns (int256 amount0Delta, int256 amount1Delta, uint160 startSqrtPrice, uint160 endSqrtPrice, bytes debugReason, bool isToken0Outcome)"
];

const POOL_OR_PROPOSAL = "0x7e9Fc0C3d6C1619d4914556ad2dEe6051Ce68418";

async function main() {
    try {
        console.log(`Connecting to RPC: ${RPC_URL}`);
        const provider = new ethers.providers.JsonRpcProvider(RPC_URL);

        // Simple Block Number check
        const blockNumber = await provider.getBlockNumber();
        console.log(`Connected! Current Block: ${blockNumber}`);

        const helper = new ethers.Contract(HELPER_ADDRESS, HELPER_ABI, provider);

        const amountIn = ethers.utils.parseEther("0.1");
        const isYesPool = true; // User said YES_GNO
        const inputType = 0; // Sell

        console.log(`Inspecting Target: ${POOL_OR_PROPOSAL}`);

        // CHECK 0: Is there code at this address?
        console.log("Checking code...");
        const code = await provider.getCode(POOL_OR_PROPOSAL);
        if (code === '0x') {
            console.error("ERROR: No code at address. It is an EOA or invalid address.");
            return;
        }
        console.log(`Code size: ${code.length / 2 - 1} bytes`);

        // CHECK 1: Is it a valid Proposal? Does it have yesPool()?
        try {
            const proposalAbi = ["function yesPool() view returns (address)", "function noPool() view returns (address)"];
            const proposalContract = new ethers.Contract(POOL_OR_PROPOSAL, proposalAbi, provider);

            console.log("Calling yesPool()...");
            const yesPoolAddress = await proposalContract.yesPool();
            console.log(`[Check 1] Proposal.yesPool() returned: ${yesPoolAddress}`);

            if (yesPoolAddress === "0x0000000000000000000000000000000000000000") {
                console.error("[!] YES Pool is address(0). Helper will fail.");
            } else {
                // CHECK 2: Does the pool exist and have liquidity?
                const poolAbi = [
                    "function token0() view returns (address)",
                    "function token1() view returns (address)",
                    "function liquidity() view returns (uint128)",
                    "function globalState() view returns (uint160 price, int24 tick, uint16 fee, uint16 timepointIndex, uint8 communityFeeToken0, uint8 communityFeeToken1, bool unlocked)"
                ];
                const poolContract = new ethers.Contract(yesPoolAddress, poolAbi, provider);

                console.log(`Inspecting Pool: ${yesPoolAddress}`);
                const liquidity = await poolContract.liquidity();
                const globalState = await poolContract.globalState();

                console.log(`[Check 2] Pool Liquidity: ${liquidity.toString()}`);
                console.log(`[Check 2] Pool Price (SqrtX96): ${globalState.price.toString()}`);

                if (liquidity.eq(0)) {
                    console.error("[!] Pool has ZERO liquidity. Swap will fail.");
                }
            }
        } catch (e) {
            console.error("[!] Failed to inspect Proposal/Pool logic:", e.message);
        }

        // Attempt Simulation
        console.log("\nRe-attempting Simulation...");
        try {
            const result = await helper.callStatic.simulateQuote(
                POOL_OR_PROPOSAL,
                isYesPool,
                inputType,
                amountIn,
                { gasLimit: 30000000 }
            );
            console.log("SUCCESS!");
            printResult(result);
        } catch (e) {
            console.log("Simulation Failed:", e.code || e.message);
            if (e.reason) console.log("Revert Reason:", e.reason);
            // console.log("Full Error:", e);
        }

    } catch (topLevelError) {
        console.error("FATAL SCRIPT ERROR:", topLevelError);
    }
}

function calculatePriceFromSqrt(sqrtPriceX96) {
    const sqrtPriceStr = sqrtPriceX96.toString();
    const curr = Number(sqrtPriceStr) / (2 ** 96);
    return curr * curr;
}

function printResult(result) {
    console.log("\n--- RESULT ---");
    console.log("Amount0Delta:", result.amount0Delta.toString());
    console.log("Amount1Delta:", result.amount1Delta.toString());
    console.log("StartSqrtPrice:", result.startSqrtPrice.toString());
    console.log("EndSqrtPrice:", result.endSqrtPrice.toString());
    console.log("IsToken0Outcome:", result.isToken0Outcome);

    const startPrice = calculatePriceFromSqrt(result.startSqrtPrice);
    const endPrice = calculatePriceFromSqrt(result.endSqrtPrice);

    console.log("\n--- PARSED ---");
    console.log("Start Price (Raw):", startPrice);
    console.log("End Price (Raw):", endPrice);

    let currentPoolPrice = startPrice;
    let priceAfter = endPrice;

    if (!result.isToken0Outcome) {
        console.log("Inverting prices (isToken0Outcome=false)...");
        currentPoolPrice = 1 / startPrice;
        priceAfter = 1 / endPrice;
    }

    console.log("Current Price (Display):", currentPoolPrice);
    console.log("Price After (Display):", priceAfter);
    console.log("Price Change:", priceAfter - currentPoolPrice);

    if (result.endSqrtPrice.toString() === "0") {
        console.error("\n[!] ERROR: EndSqrtPrice is ZERO. This explains why 'Price After' is missing.");
    }
}

main();
