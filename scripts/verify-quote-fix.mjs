import { ethers } from 'ethers';
import { quoteUniswapV3ExactInput } from '../src/utils/uniswapV3Quote.mjs';

const RPC_URL = 'https://eth.drpc.org';
const YES_POOL = '0xA95D30C125C20D001F6aed9F2EFF1B8e5577dcA3';
const YES_WETH = '0x642a8d92B4FC8ECd504DFc169Fbd15275354E620';
const YES_USDS = '0xee3db3b2f2296a92d8e57bf61e9423B0e7f5e7e1';
// Block immediately before liquidity was replenished in block 25,710,083.
const REPORTED_THIN_POOL_BLOCK = 25_710_082;

const provider = new ethers.providers.JsonRpcProvider(RPC_URL, 1);
console.log(`Ethereum mainnet YES pool ${YES_POOL} (fee 500, RPC ${RPC_URL})`);

async function printQuotes(label, blockTag) {
  console.log(`\n${label}`);
  let thousandQuote;
  for (const amountIn of ['1', '10', '1000']) {
    const quote = await quoteUniswapV3ExactInput({
      provider,
      tokenIn: YES_USDS,
      tokenOut: YES_WETH,
      amountIn,
      fee: 500,
      slippageBps: 300,
      blockTag
    });
    if (quote.poolAddress.toLowerCase() !== YES_POOL.toLowerCase()) {
      throw new Error(`Unexpected pool: ${quote.poolAddress}`);
    }
    console.log(
      `${amountIn.padStart(4)} USDS -> ${quote.amountOutFormatted} YES_WETH` +
      ` | impact ${quote.priceImpactPct.toFixed(4)}%` +
      ` | minOut@3% ${quote.minimumAmountOutFormatted}`
    );
    if (amountIn === '1000') thousandQuote = quote;
  }
  return thousandQuote;
}

await printQuotes('Latest state (pool has since been replenished)', undefined);
const thousandQuote = await printQuotes(`Reported thin-pool state (block ${REPORTED_THIN_POOL_BLOCK})`, REPORTED_THIN_POOL_BLOCK);

if (!thousandQuote || thousandQuote.priceImpactPct <= 15) {
  throw new Error('1000 USDS quote did not expose catastrophic price impact');
}
if (Number(thousandQuote.amountOutFormatted) >= 0.5) {
  throw new Error('1000 USDS quote regressed to the unsafe flat-price output');
}
