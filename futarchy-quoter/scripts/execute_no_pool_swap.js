const hre = require("hardhat");
const { ethers } = hre;

const ROUTER_ADDRESS = "0xfFB643E73f280B97809A8b41f7232AB401a04ee1";

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
    "function approve(address spender, uint256 amount) returns (bool)"
];

async function main() {
    const [signer] = await ethers.getSigners();
    console.log(`\n🚀 Executing NO Pool Swap with Account: ${signer.address}`);

    const tokenInAddress = "0xCA7445827f6B5408d7fDD57615526933b769c1f3"; // NO_sDAI
    const tokenOutAddress = "0xd26F0d2bBaeb156571177Cc32b3a4A70Ce21cb3A"; // NO_GNO

    // Amount to Sell
    const amountInVal = "0.203130534168788395";
    const amountIn = ethers.parseEther(amountInVal);

    console.log(`   Router:   ${ROUTER_ADDRESS}`);
    console.log(`   TokenIn:  ${tokenInAddress} (NO_sDAI)`);
    console.log(`   AmountIn: ${amountInVal}`);

    const tokenIn = new ethers.Contract(tokenInAddress, ERC20_ABI, signer);
    const router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, signer);

    // 1. Balance Check
    const balance = await tokenIn.balanceOf(signer.address);
    if (balance < amountIn) {
        console.error(`❌ Insufficient Balance: Have ${ethers.formatEther(balance)}, Need ${amountInVal}`);
        return;
    }
    console.log(`   ✅ Balance Sufficient.`);

    // 2. Approve
    console.log(`\n🔓 Checking Allowance...`);
    const allowance = await tokenIn.allowance(signer.address, ROUTER_ADDRESS);
    if (allowance < amountIn) {
        console.log(`   ⚠️ Allowance too low. Approving...`);
        const txApprove = await tokenIn.approve(ROUTER_ADDRESS, amountIn);
        console.log(`   ⏳ Waiting for Approval: ${txApprove.hash}`);
        await txApprove.wait();
        console.log(`   ✅ Approved!`);
    } else {
        console.log(`   ✅ Allowance Sufficient.`);
    }

    // 3. Execute
    const params = {
        tokenIn: tokenInAddress,
        tokenOut: tokenOutAddress,
        recipient: signer.address,
        deadline: Math.floor(Date.now() / 1000) + 600,
        amountIn: amountIn,
        amountOutMinimum: 0, // No slippage protection for this test
        limitSqrtPrice: 0
    };

    console.log(`\n💸 Executing exactInputSingle...`);
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
