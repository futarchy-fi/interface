const hre = require("hardhat");
const { ethers } = hre;

const ROUTER_ADDRESS = "0xfFB643E73f280B97809A8b41f7232AB401a04ee1";
const POOL_ADDRESS = "0x51b56a6566EfB1b91371024f7CE063cEC7F23B69";

const ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)"
];

const ROUTER_ABI = [
    {
        "inputs": [
            {
                "components": [
                    { "internalType": "address", "name": "tokenIn", "type": "address" },
                    { "internalType": "address", "name": "tokenOut", "type": "address" },
                    { "internalType": "uint24", "name": "fee", "type": "uint24" },
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
    console.log(`\n🚀 Executing Correction Swap with Account: ${signer.address}`);

    const pool = await ethers.getContractAt("contracts/experiments-swapr/AlgebraPriceDeltaHelper.sol:IAlgebraPool", POOL_ADDRESS);
    const token0Address = await pool.token0(); // GNO
    const token1Address = await pool.token1(); // SDAI

    // Helper said: Need to BUY 0.014307... GNO (Token0)
    const amountOutVal = "0.014307684078062245";
    const amountOut = ethers.parseEther(amountOutVal);

    // Max SDAI willing to pay (Slippage protection)
    // Sim showed ~1.579. Let's cap at 2.0.
    const maxAmountIn = ethers.parseEther("2.0");

    console.log(`\n📦 Correction Params:`);
    console.log(`   Buy (TokenOut): ${amountOutVal} GNO`);
    console.log(`   Pay (TokenIn):  SDAI`);
    console.log(`   Router:         ${ROUTER_ADDRESS}`);

    const sdaiToken = new ethers.Contract(token1Address, ERC20_ABI, signer);
    const router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, signer);

    // 1. Check SDAI Balance
    console.log(`\n🔍 Checking SDAI Balance...`);
    const balance = await sdaiToken.balanceOf(signer.address);
    console.log(`   Balance: ${ethers.formatEther(balance)} SDAI`);

    if (balance < ethers.parseEther("1.6")) {
        console.warn("⚠️ Warning: Low SDAI Balance. Might fail if < 1.6");
    }

    // 2. Approve SDAI
    console.log(`\n🔓 Checking SDAI Allowance...`);
    const allowance = await sdaiToken.allowance(signer.address, ROUTER_ADDRESS);
    if (allowance < maxAmountIn) {
        console.log(`   ⚠️ Allowance too low. Approving 2.0 SDAI...`);
        const txApprove = await sdaiToken.approve(ROUTER_ADDRESS, maxAmountIn);
        console.log(`   ⏳ Waiting for Approval: ${txApprove.hash}`);
        await txApprove.wait();
        console.log(`   ✅ Approved!`);
    } else {
        console.log(`   ✅ Allowance Sufficient.`);
    }

    // 3. Execute
    const params = {
        tokenIn: token1Address, // SDAI
        tokenOut: token0Address, // GNO
        fee: 0,
        recipient: signer.address,
        deadline: Math.floor(Date.now() / 1000) + 600,
        amountOut: amountOut,
        amountInMaximum: maxAmountIn,
        limitSqrtPrice: 0
    };

    console.log(`\n💸 Executing exactOutputSingle...`);
    const txSwap = await router.exactOutputSingle(params);
    console.log(`   ⏳ Transaction sent: ${txSwap.hash}`);
    console.log(`   waiting for confirmation...`);

    const receipt = await txSwap.wait();
    console.log(`\n✅ Transaction Confirmed! Block: ${receipt.blockNumber}`);
    console.log(`   🔗 Explorer: https://gnosisscan.io/tx/${txSwap.hash}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
