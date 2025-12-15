const hre = require("hardhat");
const { ethers } = hre;

const ROUTER_ADDRESS = "0xfFB643E73f280B97809A8b41f7232AB401a04ee1";
const POOL_ADDRESS = "0x6E39EF837f300F231987b2871467f2d385b082B5";

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
    "function allowance(address owner, address spender) view returns (uint256)"
];

async function main() {
    const [signer] = await ethers.getSigners();
    console.log(`\n🕵️ Simulation User: ${signer.address}`);

    // Pool Tokens
    // Token0 (NO_sDAI) = 0xCA7445827f6B5408d7fDD57615526933b769c1f3
    // Token1 (NO_GNO)  = 0xd26F0d2bBaeb156571177Cc32b3a4A70Ce21cb3A
    const tokenInAddress = "0xCA7445827f6B5408d7fDD57615526933b769c1f3";
    const tokenOutAddress = "0xd26F0d2bBaeb156571177Cc32b3a4A70Ce21cb3A";

    // Amount to Sell (Add to Pool)
    const amountInVal = "0.203130534168788395";
    const amountIn = ethers.parseEther(amountInVal);

    console.log(`   Router:   ${ROUTER_ADDRESS}`);
    console.log(`   TokenIn:  ${tokenInAddress} (NO_sDAI)`);
    console.log(`   AmountIn: ${amountInVal}`);
    console.log(`   TokenOut: ${tokenOutAddress} (NO_GNO)`);

    const tokenIn = new ethers.Contract(tokenInAddress, ERC20_ABI, signer);

    // Check Balance first (Simulation will fail if no balance)
    try {
        const bal = await tokenIn.balanceOf(signer.address);
        console.log(`   Balance:  ${ethers.formatEther(bal)}`);
        if (bal < amountIn) {
            console.warn("   ⚠️ WARNING: Insufficient Balance. staticCall will likely fail.");
        }
    } catch (e) {
        console.log("   Could not fetch balance.");
    }

    const router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, signer);

    const params = {
        tokenIn: tokenInAddress,
        tokenOut: tokenOutAddress,
        recipient: signer.address,
        deadline: Math.floor(Date.now() / 1000) + 600,
        amountIn: amountIn,
        amountOutMinimum: 0,
        limitSqrtPrice: 0
    };

    console.log(`\n🔄 Calling exactInputSingle.staticCall...`);

    try {
        const amountOut = await router.exactInputSingle.staticCall(params);
        console.log(`\n✅ Simulation Successful!`);
        console.log(`   Amount Out (NO_GNO): ${ethers.formatEther(amountOut)}`);
        console.log(`   (Helper predicted: ~0.00197)`);

    } catch (e) {
        console.error("\n❌ Simulation Failed:", e.shortMessage || e.message);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
