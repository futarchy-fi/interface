// Test with 1 USDS (like in the modal screenshot)
const { ethers } = require('ethers');

const YES_USDS = '0x87f94FaBA3e8FD5fbb9f49F7e9Ab24E8fC6E7B7E';
const YES_TSLAON = '0x192e4580d85dc767F81F8AD02428F042E3c1074e';
const QUOTER_V2_ADDRESS = '0x61fFE014bA17989E743c5F6cB21bF9697530B21e';

const QUOTER_V2_ABI = [
    "function quoteExactInputSingle(tuple(address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)"
];

const ERC20_ABI = ["function decimals() view returns (uint8)", "function symbol() view returns (string)"];

async function test() {
    const provider = new ethers.providers.JsonRpcProvider('https://ethereum-rpc.publicnode.com');

    const tokenInContract = new ethers.Contract(YES_USDS, ERC20_ABI, provider);
    const decimalsIn = await tokenInContract.decimals();

    const amountInWei = ethers.utils.parseUnits('1', decimalsIn);
    console.log('[QUOTER] Testing with 1 USDS');
    console.log('[QUOTER] Amount in wei:', amountInWei.toString());

    const quoterContract = new ethers.Contract(QUOTER_V2_ADDRESS, QUOTER_V2_ABI, provider);

    const params = {
        tokenIn: YES_USDS,
        tokenOut: YES_TSLAON,
        amountIn: amountInWei,
        fee: 500,
        sqrtPriceLimitX96: 0
    };

    console.log('[QUOTER] Calling QuoterV2...');
    const result = await quoterContract.callStatic.quoteExactInputSingle(params);
    const [amountOut] = result;

    const amountOutFormatted = ethers.utils.formatUnits(amountOut, 18);
    console.log('[QUOTER] ✅ SUCCESS!');
    console.log('[QUOTER] Input: 1 USDS');
    console.log('[QUOTER] Output:', amountOutFormatted, 'TSLAon');
}

test().catch(console.error);
