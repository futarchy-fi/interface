import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SOURCE = readFileSync(
  new URL('../../src/components/futarchyFi/marketPage/MarketPageShowcase.jsx', import.meta.url),
  'utf8',
);

test('TWAP dispatch uses the market chain for its RPC and pool ABI', () => {
  assert.match(SOURCE, /1:\s*process\.env\.NEXT_PUBLIC_ETHEREUM_RPC\s*\|\|\s*'https:\/\/ethereum-rpc\.publicnode\.com'/);
  assert.match(SOURCE, /100:\s*process\.env\.NEXT_PUBLIC_GNOSIS_RPC\s*\|\|\s*'https:\/\/rpc\.gnosischain\.com'/);
  assert.match(SOURCE, /chainId=\{config\.chainId\s*\|\|\s*100\}/);
  assert.match(SOURCE, /numericChainId === 1\s*\?\s*UNISWAP_V3_TWAP_ABI\s*:\s*ALGEBRA_TWAP_ABI/);
  assert.match(SOURCE, /numericChainId === 1\s*\?\s*await poolContract\.observe\(\[aStart, aEnd\]\)\s*:\s*await poolContract\.getTimepoints\(\[aStart, aEnd\]\)/);
});

test('unsupported chains fail closed instead of reading Gnosis', () => {
  assert.match(SOURCE, /const rpcUrl = TWAP_RPC_BY_CHAIN\[Number\(chainId\)\]/);
  assert.match(SOURCE, /if \(!rpcUrl\) \{\s*throw new Error\(`TWAP is not configured for chain \$\{chainId\}`\)/);
});

test('changing chains clears both provider and token-order caches', () => {
  assert.match(SOURCE, /providerRef\.current = null;\s*poolToken0CacheRef\.current = \{\};\s*\}, \[chainId\]\)/);
});
