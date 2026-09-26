import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateMetadata, mergeMetadataForUpdate } from '../src/features/marketCreation/validateMetadata.js';
import { priceImpactConstantProduct, evaluateFloor } from '../src/features/marketCreation/liquidityFloor.js';

const COMPANY = '0x37b60f4e9a31a64ccc0024dce7d0fd07eaa0f7b3'; // PNK
const GOOD = {
  chain: 100, snapshot_id: '0xabc', closeTimestamp: 1790000000,
  twapStartTimestamp: 1789000000, twapDurationHours: 120,
  coingecko_ticker: 'pnk-ticker',
  invertTwapPoolYes: false, invertTwapPoolNo: false,
};

test('valid metadata passes', () => {
  // company IS token0 in both pools => invert should be false, matches GOOD
  const r = validateMetadata(GOOD, { companyTokenAddress: COMPANY, poolToken0: { yes: COMPANY, no: COMPANY } });
  assert.equal(r.ok, true, r.errors.join('; '));
});

test('wrong invert flag is caught with a correction (the shipped-wrong-price bug)', () => {
  const bad = { ...GOOD, invertTwapPoolYes: true }; // but company is token0 => should be false
  const r = validateMetadata(bad, { companyTokenAddress: COMPANY, poolToken0: { yes: COMPANY, no: COMPANY } });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('invertTwapPoolYes')));
  assert.equal(r.corrected.invertTwapPoolYes, false);
});

test('invert flag must be true when company is NOT token0', () => {
  const other = '0x0000000000000000000000000000000000000001';
  const r = validateMetadata(GOOD, { companyTokenAddress: COMPANY, poolToken0: { yes: other, no: other } });
  assert.equal(r.ok, false); // GOOD has false, but company!=token0 => expected true
  assert.equal(r.corrected.invertTwapPoolYes, true);
});

test('missing ticker is caught', () => {
  const { coingecko_ticker, ...noTicker } = GOOD;
  const r = validateMetadata(noTicker);
  assert.ok(r.errors.some(e => e.includes('coingecko_ticker')));
});

test('invert check deferred before pools exist', () => {
  const r = validateMetadata(GOOD, { companyTokenAddress: COMPANY }); // no poolToken0
  assert.ok(r.warnings.some(w => w.includes('pools do not exist yet')));
});

test('read-modify-write preserves all keys', () => {
  const existing = JSON.stringify({ a: 1, snapshot_id: '0x1', keepme: 'yes' });
  const merged = mergeMetadataForUpdate(existing, { snapshot_id: '0x2' });
  assert.equal(merged.a, 1);
  assert.equal(merged.keepme, 'yes');    // not dropped
  assert.equal(merged.snapshot_id, '0x2'); // patched
});

test('read-modify-write refuses to write over unparseable metadata', () => {
  assert.throws(() => mergeMetadataForUpdate('{not json', { x: 1 }), /does not parse/);
});

test('floor: deep pool passes, thin pool is DRAFT', () => {
  // ~$100k sDAI vs equivalent company => a $100 trade is tiny impact
  const deep = evaluateFloor({ reserveInTokens: 100000, reserveOutTokens: 1000, inputUsdPrice: 1 });
  assert.equal(deep.passes, true);
  assert.equal(deep.state, 'LIVE');
  // ~$300 pool => a $100 trade blows it out
  const thin = evaluateFloor({ reserveInTokens: 300, reserveOutTokens: 3, inputUsdPrice: 1 });
  assert.equal(thin.passes, false);
  assert.equal(thin.state, 'DRAFT');
});

test('floor: zero/unknown liquidity => max impact => DRAFT', () => {
  assert.equal(priceImpactConstantProduct(0, 0, 100), 1);
  const r = evaluateFloor({ reserveInTokens: 0, reserveOutTokens: 0 });
  assert.equal(r.state, 'DRAFT');
});
