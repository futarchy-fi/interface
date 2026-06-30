/**
 * swaprSdk spec mirror (auto-qa).
 *
 * Pins src/utils/swaprSdk.js — Swapr V3 (Algebra) SDK quote module.
 * Six concerns + three hazards + one cross-file consistency check.
 *
 * Concerns:
 *
 *   1. ALGEBRA_SUBGRAPH URL — pinned exact endpoint. Includes a Graph
 *      API key in the path (HAZARD H1 — pinned for visibility).
 *
 *   2. fetchPoolData query — Pool by id with required fields (fee,
 *      liquidity, sqrtPrice, tick, tickSpacing, token0/token1 nested).
 *      Drift would break Algebra V3 quote calculations downstream.
 *
 *   3. sqrtPriceX96ToPrice — Algebra V3 standard formula. Cross-pin
 *      against canonical sqrt-price-x96.test.mjs (this is the 4th
 *      copy of this math: algebraQuoter, FutarchyQuoteHelper,
 *      getAlgebraPoolPrice, now swaprSdk).
 *
 *   4. calculatePriceImpact — `(execution - current) / current * 100`.
 *      Same formula as canonical impact-formula.test.mjs.
 *
 *   5. getPoolAddressForOutcome — magic string `'Event Will Occur'`
 *      vs anything else (NO/refusal). Cross-pin with the 3 callers in
 *      ShowcaseSwapComponent.jsx that PRODUCE this string.
 *
 *   6. executeSwaprV3Swap delegates to sushiswapV3Helper.executeAlgebraExactSingle
 *      with default gas (400k limit, 0.97 gwei) and 50bps slippage.
 *      Cross-file dependency that's easy to break silently.
 *
 * Hazards:
 *
 *   H1. Graph API key leak — `8b2690ffdd390bad59638b894ee8d9f6` baked
 *       into ALGEBRA_SUBGRAPH URL.
 *   H2. window.getSwaprDebugStats global pollution — attaches to
 *       window at module load (typeof window guard makes it
 *       SSR-safe but adds a window key in production).
 *   H3. Default decimals: 18 hardcoded in executeSwaprV3Swap's
 *       parseUnits — would corrupt non-18-decimal tokens (USDC=6).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SRC = readFileSync(
    new URL('../../src/utils/swaprSdk.js', import.meta.url),
    'utf8',
);

// --- spec mirror of sqrtPriceX96ToPrice (BigInt math) ---
function sqrtPriceX96ToPrice(sqrtPriceX96String) {
    try {
        const sqrt = BigInt(sqrtPriceX96String);
        const Q96 = 2n ** 96n;
        const sqrtSq = sqrt * sqrt;
        const Q192 = Q96 * Q96;
        return Number(sqrtSq) / Number(Q192);
    } catch {
        return null;
    }
}

// --- spec mirror of calculatePriceImpact ---
function calculatePriceImpact(currentPrice, executionPrice) {
    try {
        return ((parseFloat(executionPrice) - currentPrice) / currentPrice) * 100;
    } catch {
        return null;
    }
}

// --- spec mirror of getPoolAddressForOutcome ---
function getPoolAddressForOutcome(outcome, poolConfigYes, poolConfigNo) {
    const eventHappens = outcome === 'Event Will Occur';
    const poolConfig = eventHappens ? poolConfigYes : poolConfigNo;
    return poolConfig?.address;
}

// ---------------------------------------------------------------------------
// HAZARD H1 — ALGEBRA_SUBGRAPH URL contains a Graph API key
// ---------------------------------------------------------------------------

test('hazard H1 — ALGEBRA_SUBGRAPH URL contains hardcoded Graph API key', () => {
    // PINNED HAZARD: the URL bakes in a Graph API key
    // (8b2690ffdd390bad59638b894ee8d9f6) in the path. Same hazard
    // pattern as the CoinGecko key in spot-price.js. Pinned for
    // visibility; per /loop directive, leave as-is.
    assert.match(SRC,
        /https:\/\/gateway-arbitrum\.network\.thegraph\.com\/api\/8b2690ffdd390bad59638b894ee8d9f6\/subgraphs\/id\//,
        `ALGEBRA_SUBGRAPH URL with hardcoded Graph API key drifted. ` +
        `If the key was rotated or moved to env-var, that's an improvement (delete this test).`);
});

test('source — ALGEBRA_SUBGRAPH points to gateway-arbitrum.network.thegraph.com (Algebra V3 subgraph)', () => {
    assert.match(SRC,
        /ALGEBRA_SUBGRAPH\s*=\s*\n?\s*['"]https:\/\/gateway-arbitrum\.network\.thegraph\.com[^'"]+['"]/,
        `ALGEBRA_SUBGRAPH endpoint drifted from gateway-arbitrum.network.thegraph.com`);
});

test('source — ALGEBRA_SUBGRAPH uses HTTPS (NOT HTTP)', () => {
    assert.doesNotMatch(SRC, /http:\/\/gateway-arbitrum/,
        `ALGEBRA_SUBGRAPH must be HTTPS — leaks API key over HTTP otherwise`);
});

// ---------------------------------------------------------------------------
// fetchPoolData query shape — Pool by id with all required fields
// ---------------------------------------------------------------------------

test('source — fetchPoolData query selects pool by ID with fee/liquidity/sqrtPrice/tick/tickSpacing', () => {
    // Pinned: each field is read by downstream quote math. Drift in
    // any field name would silently produce undefined → NaN math.
    for (const field of ['fee', 'liquidity', 'sqrtPrice', 'tick', 'tickSpacing']) {
        assert.match(SRC, new RegExp(`\\b${field}\\b`),
            `fetchPoolData query missing required field "${field}"`);
    }
});

test('source — fetchPoolData uses VARIABLE binding ($id: ID!) — NOT inline interpolation', () => {
    // Pinned: $id variable binding. Inline interpolation would be
    // an injection vector. The variable is also typed ID! (NOT String!).
    assert.match(SRC,
        /query Pool\(\$id:\s*ID!\)/,
        `fetchPoolData must use $id: ID! variable binding (not inline interpolation)`);
});

test('source — fetchPoolData LOWERCASES poolAddress before query', () => {
    // Pinned: subgraph IDs are stored lowercased. A regression that
    // drops .toLowerCase() would 404 every checksummed-case input.
    assert.match(SRC,
        /id:\s*poolAddress\.toLowerCase\(\)/,
        `fetchPoolData must lowercase poolAddress before query`);
});

test('source — fetchPoolData throws when pool not found (NOT silent null)', () => {
    assert.match(SRC,
        /if\s*\(!json\.data\?\.\s*pool\)\s*\{\s*throw new Error\(`Pool \$\{poolAddress\} not found on Swapr Algebra subgraph`\)/,
        `fetchPoolData must throw on missing pool (silent null would propagate confusion downstream)`);
});

test('source — fetchPoolData throws on subgraph errors (joins error messages)', () => {
    assert.match(SRC,
        /if\s*\(json\.errors\?\.\s*length\)\s*\{\s*throw new Error\(`Subgraph error:\s*\$\{json\.errors\.map\(\(e\)\s*=>\s*e\.message\)\.join\(["'], ["']\)\}/,
        `fetchPoolData subgraph-error throw shape drifted`);
});

// ---------------------------------------------------------------------------
// sqrtPriceX96ToPrice — Algebra V3 formula (4th copy of this math!)
// ---------------------------------------------------------------------------

test('sqrtPriceX96ToPrice spec mirror — sqrt = 2^96 → price = 1', () => {
    assert.equal(sqrtPriceX96ToPrice((2n ** 96n).toString()), 1);
});

test('sqrtPriceX96ToPrice spec mirror — sqrt = 2 * 2^96 → price = 4', () => {
    assert.equal(sqrtPriceX96ToPrice((2n * (2n ** 96n)).toString()), 4);
});

test('sqrtPriceX96ToPrice spec mirror — null/invalid → null (not throw)', () => {
    // Pinned: try/catch returns null. Callers can null-check.
    assert.equal(sqrtPriceX96ToPrice(null), null);
    assert.equal(sqrtPriceX96ToPrice('not a number'), null);
});

test('sqrtPriceX96ToPrice spec mirror — non-negative for any sqrt', () => {
    for (const exp of [0, 48, 96, 144]) {
        const r = sqrtPriceX96ToPrice((2n ** BigInt(exp)).toString());
        assert.ok(r >= 0);
    }
});

test('source — sqrtPriceX96ToPrice formula matches canonical sqrt²/Q192 (4th copy)', () => {
    // Cross-pin: this file makes the FOURTH copy of this math
    // (algebraQuoter.js, FutarchyQuoteHelper.js, getAlgebraPoolPrice.js,
    // now swaprSdk.js). All must use identical formula. Drift in any
    // would silently differ from canonical sqrt-price-x96.test.mjs.
    assert.match(SRC,
        /sqrtPriceSquared\s*=\s*sqrtPriceX96\.mul\(sqrtPriceX96\)/,
        `inline rawPoolPrice formula must use sqrt.mul(sqrt) (consistent with canonical)`);
    assert.match(SRC,
        /Q192\s*=\s*Q96\.mul\(Q96\)/,
        `Q192 must be Q96.mul(Q96) (consistent across 4 files)`);
});

// ---------------------------------------------------------------------------
// calculatePriceImpact — same formula as canonical impact-formula.test.mjs
// ---------------------------------------------------------------------------

test('calculatePriceImpact spec mirror — execution > current → positive %', () => {
    // 1.0 execution vs 0.5 current: +100% impact (got 2x more out per in).
    assert.equal(calculatePriceImpact(0.5, '1.0'), 100);
});

test('calculatePriceImpact spec mirror — execution < current → negative %', () => {
    // 0.5 execution vs 1.0 current: -50% (slippage scenario).
    assert.equal(calculatePriceImpact(1.0, '0.5'), -50);
});

test('calculatePriceImpact spec mirror — equal prices → 0%', () => {
    assert.equal(calculatePriceImpact(1.0, '1.0'), 0);
});

test('calculatePriceImpact spec mirror — accepts string executionPrice (parseFloat)', () => {
    // Pinned the parseFloat coercion. A regression that uses Number()
    // would still work but parseFloat is the source's choice.
    assert.equal(calculatePriceImpact(2, '3.5'), 75);
});

test('source — calculatePriceImpact uses parseFloat on executionPrice (NOT Number)', () => {
    assert.match(SRC,
        /priceImpact\s*=\s*\(\(parseFloat\(executionPrice\)\s*-\s*currentPrice\)\s*\/\s*currentPrice\)\s*\*\s*100/,
        `calculatePriceImpact formula drifted from ((parseFloat(execution) - current) / current) * 100`);
});

// ---------------------------------------------------------------------------
// getPoolAddressForOutcome — magic string 'Event Will Occur'
// ---------------------------------------------------------------------------

test('getPoolAddressForOutcome spec mirror — "Event Will Occur" → poolConfigYes', () => {
    const r = getPoolAddressForOutcome('Event Will Occur', { address: '0xY' }, { address: '0xN' });
    assert.equal(r, '0xY');
});

test('getPoolAddressForOutcome spec mirror — anything else → poolConfigNo (default)', () => {
    // Pinned: the magic string is exact-match. ANY other input
    // (including "Event Won't Occur", "yes", "YES") routes to NO pool.
    // Pinned current behavior — could be a footgun if callers pass
    // unexpected strings.
    assert.equal(getPoolAddressForOutcome("Event Won't Occur", { address: '0xY' }, { address: '0xN' }), '0xN');
    assert.equal(getPoolAddressForOutcome('YES', { address: '0xY' }, { address: '0xN' }), '0xN');
    assert.equal(getPoolAddressForOutcome('yes', { address: '0xY' }, { address: '0xN' }), '0xN');
    assert.equal(getPoolAddressForOutcome('', { address: '0xY' }, { address: '0xN' }), '0xN');
    assert.equal(getPoolAddressForOutcome(null, { address: '0xY' }, { address: '0xN' }), '0xN');
});

test('getPoolAddressForOutcome spec mirror — undefined poolConfig (e.g. missing pool) → undefined', () => {
    // Pinned: `?.address` optional chaining — no throw on missing config.
    assert.equal(getPoolAddressForOutcome('Event Will Occur', null, { address: '0xN' }), undefined);
    assert.equal(getPoolAddressForOutcome("Event Won't Occur", { address: '0xY' }, undefined), undefined);
});

test('source — getPoolAddressForOutcome magic string is exactly "Event Will Occur" (NOT "Yes" / "approved")', () => {
    assert.match(SRC,
        /eventHappens\s*=\s*outcome\s*===\s*['"]Event Will Occur['"]/,
        `magic string drifted from exactly 'Event Will Occur' — callers in ShowcaseSwapComponent.jsx produce this string`);
});

// ---------------------------------------------------------------------------
// executeSwaprV3Swap — delegates to sushiswapV3Helper, default gas + slippage
// ---------------------------------------------------------------------------

test('source — executeSwaprV3Swap delegates to sushiswapV3Helper.executeAlgebraExactSingle', () => {
    // Pinned: cross-file dependency. A refactor that renames or
    // moves executeAlgebraExactSingle would silently break this
    // function with a confusing import error.
    assert.match(SRC,
        /import\(['"]\.\/sushiswapV3Helper['"]\)/,
        `executeSwaprV3Swap must import from './sushiswapV3Helper'`);
    assert.match(SRC,
        /executeAlgebraExactSingle\(\s*\{[\s\S]*?\}\s*\)/,
        `executeSwaprV3Swap must call executeAlgebraExactSingle`);
});

test('source — executeSwaprV3Swap default slippageBps: 50 (0.5%) — cross-pin with sushiswap-helper.test.mjs', () => {
    // Pinned: same default as sushiswap-helper. Drift = inconsistent
    // slippage between Sushi-direct and Swapr-via-Sushi paths.
    assert.match(SRC,
        /slippageBps:\s*50/,
        `executeSwaprV3Swap default slippageBps drifted from 50 (0.5%)`);
});

test('source — executeSwaprV3Swap default gas: gasLimit=400000, gasPrice=0.97 gwei (cross-pin)', () => {
    // Pinned: same defaults as sushiswapHelper.executeSushiSwapRoute.
    // Drift = inconsistent gas behavior between paths.
    assert.match(SRC,
        /gasLimit:\s*400000/,
        `gasLimit default drifted from 400000`);
    assert.match(SRC,
        /gasPrice:\s*ethers\.utils\.parseUnits\(['"]0\.97['"],\s*['"]gwei['"]\)/,
        `gasPrice default drifted from 0.97 gwei`);
});

// ---------------------------------------------------------------------------
// HAZARD H3 — hardcoded 18 decimals in parseUnits
// ---------------------------------------------------------------------------

test('hazard H3 — executeSwaprV3Swap parseUnits hardcodes 18 decimals (FOOTGUN for USDC=6 etc.)', () => {
    // PINNED HAZARD: the function takes amountIn as human-readable
    // and parses with 18 decimals. ANY non-18-decimal token (USDC=6,
    // WBTC=8) would be silently mis-scaled. Currently OK because
    // futarchy tokens are 18-decimal, but a future expansion to
    // non-18-decimal collateral would break.
    assert.match(SRC,
        /amountInWei\s*=\s*ethers\.utils\.parseUnits\(amountIn\.toString\(\),\s*18\)/,
        `executeSwaprV3Swap parseUnits decimals drifted from hardcoded 18`);
});

// ---------------------------------------------------------------------------
// HAZARD H2 — window.getSwaprDebugStats global pollution
// ---------------------------------------------------------------------------

test('hazard H2 — module attaches getSwaprDebugStats to window at load', () => {
    // PINNED HAZARD: typeof window check makes it SSR-safe, but in
    // production every page load adds window.getSwaprDebugStats AND
    // logs "🔍 Debug function available" to console.
    assert.match(SRC,
        /if\s*\(typeof\s+window\s*!==\s*['"]undefined['"]\)\s*\{\s*window\.getSwaprDebugStats\s*=\s*getSwaprDebugStats/,
        `window pollution shape drifted (or removed — delete test if so)`);
});

test('hazard H2 — module-load console.log "Debug function available" runs on every import', () => {
    assert.match(SRC,
        /console\.log\(['"]🔍 Debug function available:\s*window\.getSwaprDebugStats\(\)['"]/,
        `module-load console.log drifted (or removed — delete test if so)`);
});

// ---------------------------------------------------------------------------
// DEBUG_SWAPR_CALLS — env-driven flag, defaults FALSE
// ---------------------------------------------------------------------------

test('source — DEBUG_SWAPR_CALLS gated on NEXT_PUBLIC_DEBUG_MODE === "true"', () => {
    // Pinned: defaults FALSE in production (the env var is unset).
    // A regression that hardcodes true would log every Swapr call.
    assert.match(SRC,
        /DEBUG_SWAPR_CALLS\s*=\s*process\.env\.NEXT_PUBLIC_DEBUG_MODE\s*===\s*['"]true['"]/,
        `DEBUG_SWAPR_CALLS gating drifted — must require NEXT_PUBLIC_DEBUG_MODE === 'true'`);
});

test('source — logDebug short-circuits when DEBUG_SWAPR_CALLS is false', () => {
    // Pinned: early-return guard prevents log overhead in production.
    assert.match(SRC,
        /function logDebug[\s\S]*?if\s*\(!DEBUG_SWAPR_CALLS\)\s*return/,
        `logDebug must short-circuit when flag is false (early return)`);
});

// ---------------------------------------------------------------------------
// DEFAULT_GNOSIS_RPC pinned + ABIs + module imports
// ---------------------------------------------------------------------------

test('source — DEFAULT_GNOSIS_RPC = "https://rpc.gnosischain.com"', () => {
    // Pinned: same canonical Gnosis RPC as other files in the codebase.
    assert.match(SRC,
        /DEFAULT_GNOSIS_RPC\s*=\s*['"]https:\/\/rpc\.gnosischain\.com['"]/,
        `DEFAULT_GNOSIS_RPC drifted from canonical https://rpc.gnosischain.com`);
});

test('source — ERC20_ABI has decimals + symbol view functions', () => {
    assert.match(SRC,
        /ERC20_ABI\s*=\s*\[[\s\S]*?function decimals\(\) view returns \(uint8\)[\s\S]*?function symbol\(\) view returns \(string\)/,
        `ERC20_ABI shape drifted from decimals + symbol`);
});

test('source — imports @swapr/sdk core types (ChainId, Percent, SwaprToken, SwaprV3Trade, TokenAmount, TradeType)', () => {
    // Pinned: a refactor that removes any of these breaks the file's
    // primary export `getSwaprV3QuoteWithPriceImpact`.
    for (const sym of ['ChainId', 'Percent', 'SwaprToken', 'SwaprV3Trade', 'TokenAmount', 'TradeType']) {
        assert.match(SRC, new RegExp(`\\b${sym}\\b`),
            `@swapr/sdk import missing symbol "${sym}"`);
    }
});
