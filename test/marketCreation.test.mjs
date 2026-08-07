import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateMetadata, mergeMetadataForUpdate } from '../src/features/marketCreation/validateMetadata.js';
import { priceImpactConstantProduct, evaluateFloor } from '../src/features/marketCreation/liquidityFloor.js';
import { deriveTwapTiming, TWAP_BUFFER_SECONDS } from '../src/features/marketCreation/marketCreationWorkflow.js';
import { buildProposalParams } from '../src/features/marketCreation/proposalCalldata.js';

// Conditional (wrapped YES/NO) company tokens — what the pools actually hold.
const COND_YES = '0x1111111111111111111111111111111111111111';
const COND_NO = '0x2222222222222222222222222222222222222222';
const OTHER = '0x0000000000000000000000000000000000000001';
const GOOD = {
  chain: 100, snapshot_id: '0xabc', closeTimestamp: 1790000000,
  twapStartTimestamp: 1789000000, twapDurationHours: 120,
  coingecko_ticker: 'pnk-ticker',
  invertTwapPoolYes: false, invertTwapPoolNo: false,
};
const POOLS_ALIGNED = {
  yes: { token0: COND_YES, conditionalCompanyToken: COND_YES },
  no: { token0: COND_NO, conditionalCompanyToken: COND_NO },
};

test('valid metadata passes', () => {
  // conditional company token IS token0 in both pools => invert false, matches GOOD
  const r = validateMetadata(GOOD, { pools: POOLS_ALIGNED });
  assert.equal(r.ok, true, r.errors.join('; '));
});

test('wrong invert flag is caught with a correction (the shipped-wrong-price bug)', () => {
  const bad = { ...GOOD, invertTwapPoolYes: true }; // conditional token is token0 => should be false
  const r = validateMetadata(bad, { pools: POOLS_ALIGNED });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('invertTwapPoolYes')));
  assert.equal(r.corrected.invertTwapPoolYes, false);
});

test('invert flag must be true when the conditional company token is NOT token0', () => {
  const r = validateMetadata(GOOD, {
    pools: {
      yes: { token0: OTHER, conditionalCompanyToken: COND_YES },
      no: { token0: OTHER, conditionalCompanyToken: COND_NO },
    },
  });
  assert.equal(r.ok, false); // GOOD has false, but conditional!=token0 => expected true
  assert.equal(r.corrected.invertTwapPoolYes, true);
});

test('missing ticker is caught', () => {
  const { coingecko_ticker, ...noTicker } = GOOD;
  const r = validateMetadata(noTicker);
  assert.ok(r.errors.some(e => e.includes('coingecko_ticker')));
});

test('invert check deferred before pools exist', () => {
  const r = validateMetadata(GOOD, {}); // no pools
  assert.ok(r.warnings.some(w => w.includes('pools do not exist yet')));
  assert.ok(!r.errors.some(e => e.includes('invert')));
});

test('TWAP window starting in the past is an error; fresh window passes', () => {
  const now = GOOD.twapStartTimestamp + 3600; // draft went stale by an hour
  const stale = validateMetadata(GOOD, { nowUnix: now });
  assert.ok(stale.errors.some(e => e.includes('starts in the past')));
  const fresh = validateMetadata(GOOD, { nowUnix: GOOD.twapStartTimestamp + 60 }); // within grace
  assert.ok(!fresh.errors.some(e => e.includes('starts in the past')));
});

test('deriveTwapTiming: window ends 48h before close, duration honored', () => {
  const close = 1790000000;
  const t = deriveTwapTiming(close, 120);
  assert.equal(t.twapStartTimestamp + 120 * 3600, close - TWAP_BUFFER_SECONDS); // ends 48h before close
  assert.equal(t.startCandleUnix, t.twapStartTimestamp - 3600);
  assert.equal(t.twapDurationHours, 120);
  const t24 = deriveTwapTiming(close, 24);
  assert.equal(t24.twapStartTimestamp, close - TWAP_BUFFER_SECONDS - 24 * 3600);
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

test('floor measures spot-price move, not execution impact (~2x smaller)', () => {
  // $3,300 reserve: execution impact of a $100 trade is 100/3400 ≈ 2.9% (< 3%)
  // but the spot move is 1 − (3300/3400)² ≈ 5.8% — must read DRAFT.
  const impact = priceImpactConstantProduct(3300, 33, 100);
  assert.ok(Math.abs(impact - (1 - (3300 / 3400) ** 2)) < 1e-12);
  assert.ok(impact > 0.05 && impact < 0.06);
  const r = evaluateFloor({ reserveInTokens: 3300, reserveOutTokens: 33, inputUsdPrice: 1 });
  assert.equal(r.state, 'DRAFT');
});

test('floor: zero/unknown liquidity => max impact => DRAFT', () => {
  assert.equal(priceImpactConstantProduct(0, 0, 100), 1);
  const r = evaluateFloor({ reserveInTokens: 0, reserveOutTokens: 0 });
  assert.equal(r.state, 'DRAFT');
});

test('buildProposalParams: epoch openingTimeUnix is authoritative, no Date round-trip', () => {
  const base = {
    marketName: 'KIP-90', companyToken: COND_YES, currencyToken: COND_NO,
    category: 'crypto', language: 'en', minBond: '1',
  };
  const p = buildProposalParams({ ...base, openingTimeUnix: 1790172800 });
  assert.equal(p[6], 1790172800); // exact epoch, immune to operator timezone
  assert.throws(() => buildProposalParams({ ...base, openingTimeUnix: NaN, openingTime: '' }), /Invalid opening time/);
});

// ---- increment C pure helpers ----
const { buildProposalMetadataArgs, buildInvertContext, buildInvertPatch } =
  await import('../src/features/marketCreation/orgMetadataWrite.js');

test('org metadata write args match the OrganizationManagerModal tuple', () => {
  const args = buildProposalMetadataArgs({
    proposalAddress: OTHER, question: 'Q?', event: 'E', description: 'D', metadata: { a: 1 },
  });
  assert.deepEqual(args, [OTHER, 'Q?', 'E', 'D', '{"a":1}', '']);
});

test('invert context pairs each pool token0 with its conditional company token', () => {
  const ctx = buildInvertContext({
    yesCompanyToken: COND_YES, noCompanyToken: COND_NO,
    yesPoolToken0: COND_YES, noPoolToken0: OTHER,
  });
  assert.deepEqual(ctx.pools.yes, { token0: COND_YES, conditionalCompanyToken: COND_YES });
  assert.deepEqual(ctx.pools.no, { token0: OTHER, conditionalCompanyToken: COND_NO });
  // partial data → that side omitted, validator defers
  assert.deepEqual(buildInvertContext({ yesCompanyToken: COND_YES }).pools, {});
});

test('invert patch contains ONLY changed flags; null when nothing changed', () => {
  const original = { invertTwapPoolYes: false, invertTwapPoolNo: true, keep: 'x' };
  const corrected = { ...original, invertTwapPoolYes: true };
  assert.deepEqual(buildInvertPatch(original, corrected), { invertTwapPoolYes: true });
  assert.equal(buildInvertPatch(original, null), null);
  assert.equal(buildInvertPatch(original, { ...original }), null);
});

test('end-to-end invert verification: wrong flags produce a flags-only merge', () => {
  const onChain = { ...GOOD, invertTwapPoolYes: false, invertTwapPoolNo: false, precious: 'keep-me' };
  const ctx = buildInvertContext({
    yesCompanyToken: COND_YES, noCompanyToken: COND_NO,
    yesPoolToken0: OTHER, noPoolToken0: COND_NO, // YES pool ordered the other way
  });
  const result = validateMetadata(onChain, ctx);
  const patch = buildInvertPatch(onChain, result.corrected);
  assert.deepEqual(patch, { invertTwapPoolYes: true });
  const merged = mergeMetadataForUpdate(JSON.stringify(onChain), patch);
  assert.equal(merged.precious, 'keep-me');
  assert.equal(merged.invertTwapPoolYes, true);
  assert.equal(merged.invertTwapPoolNo, false);
});
