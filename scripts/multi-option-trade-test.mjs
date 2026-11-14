// Sends the same transactions the multi-option page builds, with small amounts, from the fleet wallet.
// Usage: PK=<private key> node scripts/multi-option-trade-test.mjs [read]   (from the repo root; 'read' sends nothing)
import { createPublicClient, createWalletClient, http, defineChain, formatUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import fs from 'fs';
const repo = new URL('..', import.meta.url).pathname;
const m = await import(`${repo}/src/utils/multiOption.mjs`);
const cfg = JSON.parse(fs.readFileSync(`${repo}/src/config/multi/nvda-next-ceo.json`, 'utf8'));
const chain = defineChain({ id: 4663, name: 'Robinhood Chain', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: ['https://rpc.mainnet.chain.robinhood.com'] } } });
const pub = createPublicClient({ chain, transport: http() });
const acct = privateKeyToAccount(process.env.PK.trim().startsWith('0x') ? process.env.PK.trim() : `0x${process.env.PK.trim()}`);
const wallet = createWalletClient({ account: acct, chain, transport: http() });
const send = async (calls) => {
  for (const c of calls) {
    const hash = await wallet.sendTransaction({ to: c.to, data: c.data });
    const r = await pub.waitForTransactionReceipt({ hash });
    console.log(`  ${r.status.padEnd(8)} ${c.label}  ${hash}`);
    if (r.status !== 'success') throw new Error(`reverted: ${c.label}`);
  }
};
const show = async (tag) => {
  const mk = await m.readMarket(pub, cfg); const b = await m.readBalances(pub, cfg, acct.address);
  console.log(`${tag}: spot ${mk.spot.toFixed(3)} implied ${mk.implied.toFixed(3)} sumP ${mk.sumProbability.toFixed(4)} | wallet ${formatUnits(b.currency, 6)} USDG ${formatUnits(b.company, 18)} NVDA | sets ${formatUnits(b.completeCurrency, 6)} USDG ${formatUnits(b.completeCompany, 18)} NVDA`);
  console.log('  ' + mk.options.map((o, i) => `${o.symbol} p=${(o.probability * 100).toFixed(2)}% P=${o.price.toFixed(2)} [${formatUnits(b.options[i].currency, 6)} | ${Number(formatUnits(b.options[i].company, 18)).toFixed(5)}]`).join('\n  '));
  return { mk, b };
};
const trade = async (sym, kind, side, text) => {
  const option = cfg.options.find((o) => o.symbol === sym);
  const route = m.tradeRoute(cfg, option, kind, side);
  const amountIn = m.parseAmount(text, route.tokenIn.decimals);
  const q = await m.quoteSwap(pub, cfg, route, amountIn, 100);
  console.log(`${kind} ${side} ${sym}: ${text} ${route.tokenIn.symbol} -> ~${formatUnits(q.amountOut, route.tokenOut.decimals)} ${route.tokenOut.symbol}`);
  await send(await m.planTrade(pub, cfg, acct.address, route, amountIn, q.minAmountOut));
  return q.amountOut;
};
console.log('account', acct.address);
await show('before');
const steps = (process.argv[2] || 'all');
if (steps === 'all') {
  const gotP = await trade('HAAS', 'probability', 'buy', '2');            // USDG -> HAAS_USDG
  await trade('HAAS', 'probability', 'sell', formatUnits(gotP, 6));        // back
  const gotN = await trade('BUCK', 'price', 'buy', '5');                   // BUCK_USDG -> BUCK_NVDA
  await trade('BUCK', 'price', 'sell', formatUnits(gotN, 18));             // back
  const { b } = await show('after trades');
  if (b.completeCurrency > 0n) { console.log('merge currency sets'); await send(await m.planMerge(pub, cfg, acct.address, 'currency', b.completeCurrency)); }
}
await show('after');
