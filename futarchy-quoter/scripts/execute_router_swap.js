const hre = require("hardhat");
const { ethers } = hre;

const ROUTER_ADDRESS = "0xfFB643E73f280B97809A8b41f7232AB401a04ee1";
const POOL_ADDRESS = "0x51b56a6566EfB1b91371024f7CE063cEC7F23B69";

// ABI for ERC20 (Standard)
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
                    { "internalType": "address", "name": "recipient", "type": "address" },
                    { "internalType": "uint256", "name": "deadline", "type": "uint256" },
                    { "internalType": "uint256", "name": "amountIn", "type": "uint256" },
                    { "internalType": "uint256", "name": "amountOutMinimum", "type": "uint256" },
                    { "internalType": "uint160", "name": "limitSqrtPrice", "type": "uint160" }
                ],
                "internalType": "struct ISwapRouter.ExactInputSingleParams", "name": "params", "type": "tuple"
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
    console.log(`\n🚀 Executing Swap with Account: ${signer.address}`);

    const pool = await ethers.getContractAt("IAlgebraPool", POOL_ADDRESS);
    const token0Address = await pool.token0(); // GNO
    const token1Address = await pool.token1(); // SDAI

    // Amount to Swap (Calculated Target)
    const amountInVal = "0.028723398731805069";
    const amountIn = ethers.parseEther(amountInVal);

    console.log(`\n📦 Swap Params:`);
    console.log(`   TokenIn (GNO):  ${token0Address}`);
    console.log(`   Amount:         ${amountInVal} GNO`);
    console.log(`   TokenOut (SDAI):${token1Address}`);
    console.log(`   Router:         ${ROUTER_ADDRESS}`);

    const gnoToken = new ethers.Contract(token0Address, ERC20_ABI, signer);
    const router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, signer);

    // 1. Check Balance
    console.log(`\n🔍 Checking Balance...`);
    const balance = await gnoToken.balanceOf(signer.address);
    if (balance < amountIn) {
        console.error(`❌ Insufficient GNO Balance! You have ${ethers.formatEther(balance)} but need ${amountInVal}`);
        return;
    }
    console.log(`   ✅ Balance Sufficient: ${ethers.formatEther(balance)} GNO`);

    // 2. Check & Approve
    console.log(`\n🔓 Checking Allowance...`);
    const allowance = await gnoToken.allowance(signer.address, ROUTER_ADDRESS);
    if (allowance < amountIn) {
        console.log(`   ⚠️ Allowance too low (${ethers.formatEther(allowance)}). Approving...`);
        const txApprove = await gnoToken.approve(ROUTER_ADDRESS, amountIn);
        console.log(`   ⏳ Waiting for Approval Tx: ${txApprove.hash}`);
        await txApprove.wait();
        console.log(`   ✅ Approved!`);
    } else {
        console.log(`   ✅ Allowance Sufficient.`);
    }

    // 3. Execute Swap
    const params = {
        tokenIn: token0Address,
        tokenOut: token1Address,
        recipient: signer.address,
        deadline: Math.floor(Date.now() / 1000) + 600, // 10 mins
        amountIn: amountIn,
        amountOutMinimum: 0, // 0 slippage for this test/demo
        limitSqrtPrice: 0 // No limit
    };

    console.log(`\n💸 Executing Swap (exactInputSingle)...`);
    const txSwap = await router.exactInputSingle(params);
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
