/**
 * SubgraphPoolFetcher spec mirror (auto-qa).
 *
 * Pins src/utils/SubgraphPoolFetcher.js — the frontend's direct-to-
 * subgraph pool fetcher, alternate to SupabasePoolFetcher.js. Three
 * fetcher functions + a factory dispatcher.
 *
 * Five concerns:
 *
 *   1. Default chainId = 100 (Gnosis) across all entry points. A
 *      regression to 1 (Ethereum) silently routes Gnosis pool queries
 *      to the wrong subgraph → empty results.
 *
 *   2. Pool IDs are LOWERCASED before query — subgraph uses lowercase
 *      pool IDs internally. A regression that drops .toLowerCase()
 *      would return null for any checksummed-case input.
 *
 *   3. Query shape DIVERGENCE — the file uses INLINE interpolation in
 *      fetchPoolPrice + fetchPoolsBatch, but VARIABLE binding in
 *      fetchPoolCandles. Pinned the asymmetry so a refactor either
 *      unifies (preferring variable binding for safety) or keeps the
 *      split deliberately.
 *
 *   4. NaN→null guard — parseFloat returning NaN gets coerced to null
 *      so consumers don't propagate NaN through arithmetic. A
 *      regression that drops the isNaN check would yield NaN prices
 *      that silently break math everywhere.
 *
 *   5. Factory dispatcher (createSubgraphPoolFetcher) — 3 operations
 *      pinned ('pools.price', 'pools.batch', 'pools.candles') with
 *      a structured "unsupported operation" fallback.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SRC = readFileSync(
    new URL('../../src/utils/SubgraphPoolFetcher.js', import.meta.url),
    'utf8',
);

// --- spec mirror of NaN→null mapping ---
function priceOrNull(rawPrice) {
    const p = parseFloat(rawPrice);
    return isNaN(p) ? null : p;
}

// --- spec mirror of fetchPoolCandles result mapping ---
function mapCandles(rawCandles) {
    return rawCandles
        .map(c => ({
            timestamp: Number(c.periodStartUnix),
            price: parseFloat(c.close),
        }))
        .filter(c => !Number.isNaN(c.price))
        .sort((a, b) => a.timestamp - b.timestamp);
}

// ---------------------------------------------------------------------------
// Default chainId — every entry point defaults to 100 (Gnosis)
// ---------------------------------------------------------------------------

test('source — fetchPoolPrice defaults chainId to 100 (Gnosis)', () => {
    assert.match(SRC,
        /export async function fetchPoolPrice\(poolAddress,\s*chainId\s*=\s*100\)/,
        `fetchPoolPrice default chainId drifted from 100 (Gnosis)`);
});

test('source — fetchPoolPrices destructures chainId = 100 default', () => {
    assert.match(SRC,
        /async function fetchPoolPrices\(\{\s*yesAddress,\s*noAddress,\s*chainId\s*=\s*100\s*\}\)/,
        `fetchPoolPrices default chainId drifted from 100`);
});

test('source — fetchPoolsBatch defaults chainId to 100', () => {
    assert.match(SRC,
        /export async function fetchPoolsBatch\(poolAddresses,\s*chainId\s*=\s*100\)/,
        `fetchPoolsBatch default chainId drifted from 100`);
});

test('source — fetchPoolCandles defaults chainId to 100 in destructuring', () => {
    assert.match(SRC,
        /export async function fetchPoolCandles\(\{\s*poolAddress,\s*limit\s*=\s*500,\s*periodSeconds\s*=\s*3600,\s*chainId\s*=\s*100\s*\}\)/,
        `fetchPoolCandles default chainId drifted from 100`);
});

test('source — createSubgraphPoolFetcher factory defaults to chain 100', () => {
    assert.match(SRC,
        /export function createSubgraphPoolFetcher\(defaultChainId\s*=\s*100\)/,
        `factory default chain drifted from 100`);
});

// ---------------------------------------------------------------------------
// Pool ID lowercasing — subgraph uses lowercase IDs
// ---------------------------------------------------------------------------

test('source — fetchPoolPrice lowercases poolAddress before the query', () => {
    // Pinned: subgraph stores pool IDs lowercased. A regression that
    // drops .toLowerCase() would 404 every checksummed-case input.
    assert.match(SRC,
        /poolId\s*=\s*poolAddress\.toLowerCase\(\)/,
        `fetchPoolPrice must lowercase poolAddress before query`);
});

test('source — fetchPoolsBatch lowercases each address AND filters falsy', () => {
    // Pinned: .map(a => a?.toLowerCase()).filter(Boolean) — handles
    // null/undefined entries safely AND filters them out so the
    // generated query doesn't contain `""`.
    assert.match(SRC,
        /poolAddresses\.map\(a\s*=>\s*a\?\.\s*toLowerCase\(\)\)\.filter\(Boolean\)/,
        `fetchPoolsBatch lowercase + falsy-filter shape drifted`);
});

test('source — fetchPoolCandles lowercases poolAddress before query', () => {
    assert.match(SRC,
        /poolId\s*=\s*poolAddress\.toLowerCase\(\)[\s\S]*query GetCandles/,
        `fetchPoolCandles must lowercase poolAddress (subgraph uses lowercase IDs)`);
});

// ---------------------------------------------------------------------------
// Query shape — fetchPoolPrice + fetchPoolsBatch use INLINE interpolation
// ---------------------------------------------------------------------------

test('source — fetchPoolPrice uses INLINE interpolation: pool(id: "${poolId}")', () => {
    // Pinned current state. Note: variable-binding form would be
    // safer (no injection surface). The fact that fetchPoolCandles
    // uses variable binding is documented in a separate test.
    assert.match(SRC,
        /pool\(id:\s*"\$\{poolId\}"\)/,
        `fetchPoolPrice uses inline interpolation — pinned current state. ` +
        `If a refactor moves it to variable binding, that's an improvement; ` +
        `update this test deliberately.`);
});

test('source — fetchPoolsBatch uses INLINE interpolation: id_in: [${list}]', () => {
    assert.match(SRC,
        /id_in:\s*\[\$\{lowercasedAddresses\.map\(a\s*=>\s*`"\$\{a\}"`\)\.join\(', '\)\}\]/,
        `fetchPoolsBatch inline-interpolation shape drifted`);
});

// ---------------------------------------------------------------------------
// Query shape — fetchPoolCandles uses GraphQL VARIABLE binding (the safer style)
// ---------------------------------------------------------------------------

test('source — fetchPoolCandles uses VARIABLE binding (NOT inline)', () => {
    // Pinned: this is a SAFER pattern than fetchPoolPrice/Batch use.
    // Variable binding routes through the parser; no SQL-injection-
    // style hazard. Documenting the inconsistency for future cleanup.
    assert.match(SRC,
        /query GetCandles\(\$poolId:\s*String!,\s*\$limit:\s*Int!,\s*\$period:\s*BigInt!\)/,
        `fetchPoolCandles must use variable binding (poolId: String!, limit: Int!, period: BigInt!)`);
});

test('source — fetchPoolCandles binding types: BigInt for period (Graph Node convention)', () => {
    // Pinned: Graph Node uses BigInt for period (string in JSON). A
    // regression to Int! would fail validation against Graph Node
    // schema for the period field.
    assert.match(SRC,
        /\$period:\s*BigInt!/,
        `period variable type must be BigInt! (Graph Node convention) — ` +
        `Int! would fail Graph Node validation`);
});

test('source — fetchPoolCandles passes period as STRING (not number) — required by BigInt', () => {
    // Pinned: BigInt scalar in GraphQL JSON is encoded as STRING.
    // A regression that passes a number would fail "BigInt must be string".
    assert.match(SRC,
        /period:\s*String\(periodSeconds\)/,
        `period must be passed as String(periodSeconds) — JSON encoding of BigInt`);
});

// ---------------------------------------------------------------------------
// fetchPoolCandles defaults — limit=500, periodSeconds=3600 (1h)
// ---------------------------------------------------------------------------

test('source — fetchPoolCandles default limit = 500', () => {
    // Pinned: 500 candles ≈ 20 days at 1h periods. A regression to a
    // smaller default truncates chart history silently.
    assert.match(SRC,
        /limit\s*=\s*500/,
        `fetchPoolCandles default limit drifted from 500`);
});

test('source — fetchPoolCandles default periodSeconds = 3600 (1 hour)', () => {
    // Pinned: 3600 = 1h. Drift to 60 (1min) would 60x data volume;
    // drift to 86400 (1d) would make charts look empty for short
    // proposals.
    assert.match(SRC,
        /periodSeconds\s*=\s*3600/,
        `fetchPoolCandles default periodSeconds drifted from 3600 (1h)`);
});

test('source — fetchPoolCandles orderBy + orderDirection: periodStartUnix DESC + first: limit', () => {
    // Pinned: gets the LATEST candles first (then reversed client-side
    // to ascending). A regression to ASC would return the OLDEST
    // candles up to limit — silent old-data display.
    assert.match(SRC,
        /first:\s*\$limit[\s\S]*orderBy:\s*periodStartUnix[\s\S]*orderDirection:\s*desc/,
        `fetchPoolCandles must be: first: $limit, orderBy: periodStartUnix, orderDirection: desc`);
});

// ---------------------------------------------------------------------------
// NaN→null guard — three call sites
// ---------------------------------------------------------------------------

test('priceOrNull spec mirror — valid number string returns float', () => {
    assert.equal(priceOrNull('1.5'), 1.5);
    assert.equal(priceOrNull('0.0001'), 0.0001);
});

test('priceOrNull spec mirror — invalid input returns null (not NaN)', () => {
    // CRITICAL: NaN propagates through arithmetic silently. Returning
    // null forces callers to handle the missing-data case.
    assert.equal(priceOrNull(undefined), null);
    assert.equal(priceOrNull(null), null);
    assert.equal(priceOrNull(''), null);
    assert.equal(priceOrNull('not a number'), null);
});

test('source — fetchPoolPrice maps parseFloat-NaN to null (not NaN)', () => {
    // Pinned at the call site.
    assert.match(SRC,
        /price:\s*isNaN\(price\)\s*\?\s*null\s*:\s*price/,
        `fetchPoolPrice missing isNaN→null guard — would propagate NaN to consumers`);
});

test('source — fetchPoolsBatch ALSO maps NaN→null inside the loop', () => {
    // Pinned: both call sites must agree. A regression that fixes only
    // one would silently differ between batch and single fetch.
    const matches = [...SRC.matchAll(/isNaN\(price\)\s*\?\s*null\s*:\s*price/g)];
    assert.ok(matches.length >= 2,
        `expected isNaN→null guard at >=2 sites (fetchPoolPrice + fetchPoolsBatch); ` +
        `got ${matches.length}`);
});

test('source — fetchPoolCandles filters NaN candles via !Number.isNaN(c.price)', () => {
    // Pinned the candle-list filter. NaN candles in the array would
    // crash chart rendering on min/max calculations.
    assert.match(SRC,
        /\.filter\(c\s*=>\s*!Number\.isNaN\(c\.price\)\)/,
        `fetchPoolCandles must filter NaN candles before sort`);
});

// ---------------------------------------------------------------------------
// fetchPoolCandles result shape — {timestamp, price} (legacy Supabase compat)
// ---------------------------------------------------------------------------

test('mapCandles spec mirror — converts {periodStartUnix, close} to {timestamp, price}', () => {
    const r = mapCandles([
        { periodStartUnix: '100', close: '1.5' },
        { periodStartUnix: '200', close: '2.0' },
    ]);
    assert.deepEqual(r, [
        { timestamp: 100, price: 1.5 },
        { timestamp: 200, price: 2 },
    ]);
});

test('mapCandles spec mirror — sorts ASCENDING by timestamp (matches old Supabase shape)', () => {
    // Pinned: subgraph returns DESC; we re-sort to ASC so consumers
    // can index `[length-1]` as the latest candle (matches the
    // legacy Supabase pool_candles table).
    const r = mapCandles([
        { periodStartUnix: '300', close: '3.0' },
        { periodStartUnix: '100', close: '1.0' },
        { periodStartUnix: '200', close: '2.0' },
    ]);
    assert.deepEqual(r.map(c => c.timestamp), [100, 200, 300]);
});

test('mapCandles spec mirror — drops candles with NaN close (parseFloat fail)', () => {
    const r = mapCandles([
        { periodStartUnix: '100', close: '1.5' },
        { periodStartUnix: '200', close: 'bad' },
        { periodStartUnix: '300', close: '3.0' },
    ]);
    assert.equal(r.length, 2,
        `NaN-close candles must be filtered out`);
    assert.deepEqual(r.map(c => c.timestamp), [100, 300]);
});

// ---------------------------------------------------------------------------
// fetchPoolPrices — Promise.all + missing-address pass-through
// ---------------------------------------------------------------------------

test('source — fetchPoolPrices runs YES/NO fetches in parallel via Promise.all', () => {
    // Pinned: serial fetches would double the wall-clock time. Pinned
    // the parallel pattern.
    assert.match(SRC,
        /Promise\.all\(\s*\[[\s\S]*?yesAddress\s*\?[\s\S]*?fetchPoolPrice\(yesAddress[\s\S]*?noAddress\s*\?[\s\S]*?fetchPoolPrice\(noAddress/,
        `fetchPoolPrices must use Promise.all for YES + NO parallel fetch`);
});

test('source — fetchPoolPrices passes Promise.resolve(null) for missing yes/no address', () => {
    // Pinned: when only YES address is provided, NO branch must
    // resolve(null) — NOT throw, NOT call fetch with null/undefined.
    assert.match(SRC,
        /yesAddress\s*\?\s*fetchPoolPrice\(yesAddress,\s*chainId\)\s*:\s*Promise\.resolve\(null\)/,
        `fetchPoolPrices YES branch must Promise.resolve(null) when address missing`);
    assert.match(SRC,
        /noAddress\s*\?\s*fetchPoolPrice\(noAddress,\s*chainId\)\s*:\s*Promise\.resolve\(null\)/,
        `fetchPoolPrices NO branch must Promise.resolve(null) when address missing`);
});

test('source — fetchPoolPrices result.yes/.no use ?? null (NOT || null)', () => {
    // Pinned: ?? null lets a price of 0 survive (legitimate 0 price).
    // || null would falsy-coerce 0 to null — silent corruption.
    assert.match(SRC,
        /yes:\s*yesResult\?\.\s*price\s*\?\?\s*null/,
        `fetchPoolPrices yes must use ?? null (not || null) — price=0 must survive`);
    assert.match(SRC,
        /no:\s*noResult\?\.\s*price\s*\?\?\s*null/,
        `fetchPoolPrices no must use ?? null (not || null)`);
});

// ---------------------------------------------------------------------------
// Factory dispatcher — 3 operations + structured unsupported fallback
// ---------------------------------------------------------------------------

test('source — factory supports exactly 3 operations: pools.price, pools.batch, pools.candles', () => {
    // Pinned: the supported list. Adding a new op = deliberate API
    // extension. Removing one breaks any consumer using it.
    assert.match(SRC, /case ['"]pools\.price['"]/);
    assert.match(SRC, /case ['"]pools\.batch['"]/);
    assert.match(SRC, /case ['"]pools\.candles['"]/);
});

test('source — factory unsupported-op response includes supportedOperations array', () => {
    // Pinned: when a consumer requests an unknown op, the response
    // tells them what IS supported. A regression that drops this
    // makes debug harder.
    assert.match(SRC,
        /supportedOperations:\s*\[['"]pools\.price['"],\s*['"]pools\.batch['"],\s*['"]pools\.candles['"]\]/,
        `factory unsupported-op must list supportedOperations`);
});

test('source — factory dispatcher branches use args.chainId || defaultChainId', () => {
    // Pinned: per-call chain override falls through to the factory's
    // default. A regression that ignores args.chainId locks every
    // call to the default chain.
    assert.match(SRC,
        /chainId\s*=\s*args\.chainId\s*\|\|\s*defaultChainId/,
        `factory must allow per-call chainId override via args.chainId`);
});

test('source — factory pools.price returns array (single result wrapped) for shape uniformity', () => {
    // Pinned: pools.price returns `data: [result]` not `data: result`.
    // This makes pools.price + pools.batch return-shape symmetric so
    // consumers don't need to check.
    assert.match(SRC,
        /case ['"]pools\.price['"]:\s*\{[\s\S]*?data:\s*result\s*\?\s*\[result\]\s*:\s*\[\]/,
        `pools.price must wrap single result in array (uniform with pools.batch)`);
});
