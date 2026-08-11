/**
 * 26-market-page-registry-empty.scenario.mjs — chaos: empty-200
 * on /markets/[address] from the REGISTRY side.
 *
 * Where #24 covers REGISTRY 502 on the market page (fetch throws
 * → `.catch` branch), this slice covers the SAME terminal UX
 * (page-shell mounts via static MARKETS_CONFIG) but via a
 * DIFFERENT control-flow branch: the registry endpoint stays UP
 * and HEALTHY but returns no matching proposal rows. The market
 * page's `registryAdapter.fetchProposalMetadataFromRegistry` fires
 * its `.then(empty)` instead of `.catch`. Mirrors #05 (registry-
 * empty-orgs on /companies) on the market-page surface.
 *
 * Bug-shapes guarded:
 *   - `.then(empty)` silently HANGS on a forever loading state
 *     (`useContractConfig` only clears `loading=false` on
 *     `.catch`, so an empty-success leaves the page perpetually
 *     pre-mount-stage)
 *   - Empty proposalentities triggers "Market Not Found" FALSE
 *     POSITIVE (the gate intended to fire on missing-from-
 *     MARKETS_CONFIG also fires on empty-registry-response —
 *     two distinct failure modes collapsing into a single UX
 *     signal makes user-side debugging impossible)
 *   - Different fallback UX than #24 — same dead-data shape via
 *     different control flow; user can't tell whether to retry
 *     or whether the proposal genuinely has no metadata
 *   - `proposalentities[0]` access crashes (no defensive guard
 *     against empty array — "Cannot read property 'metadata'
 *     of undefined")
 *   - Empty registry response triggers a CHAIN-VALIDATION false
 *     positive (WrongNetworkModal fires because the wallet
 *     chain check was incorrectly gated on the registry having
 *     returned non-empty rows — same chain-validation-vs-data-
 *     fetch coupling bug as #24's WrongNetworkModal bug shape)
 *
 * Distinct from #24 (same page, different control flow) because
 * the `.then(empty)` vs `.catch` branches diverge in real
 * production code paths:
 *   - #24 hard 502: `.catch` fires → `setError(message)` →
 *     downstream consumers see `error !== null`
 *   - #26 empty 200: `.then([])` fires → `setData([])` →
 *     downstream consumers see `data.length === 0`
 *   A regression that only handled `.catch` correctly (e.g., a
 *   refactor that moved `loading=false` into `.catch` only)
 *   would break #26 while #24 still passes — same shape as the
 *   #02/#05 distinction on /companies.
 *
 * Why no `useAnvilRpcProxy: true`: same rationale as #24/#25 —
 * the page-shell mount probe is enough to prove the failure
 * mode doesn't cascade; adding the proxy would conflate registry
 * chaos with chain-side reads.
 */

import { expect } from '@playwright/test';

import {
    REGISTRY_GRAPHQL_URL,
    CANDLES_GRAPHQL_URL,
    MARKET_PROBE_ADDRESS,
    makeMarketCandlesMockHandler,
} from '../fixtures/api-mocks.mjs';

export default {
    name:        '26-market-page-registry-empty',
    description: 'REGISTRY responds 200 with empty proposalentities + CANDLES happy on /markets/<probe>. Asserts the page-shell still mounts (Trading Pair label + wallet shorthand visible) — proves the static MARKETS_CONFIG entry is sufficient even when registry returns zero matching rows. Distinct code path from #24 (.then-with-empty vs .catch), same expected page-shell UX. Catches: forever-loading on empty-200 path, Market Not Found false positive, chain-validation gating regression.',
    bugShape:    'empty-200 path hangs forever-loading on market-page / "Market Not Found" false positive on empty registry response (wrong code path collapse) / proposalentities[0] crashes on empty array / chain-validation incorrectly gated on registry having returned non-empty rows / divergent fallback UX from #24 (same dead-data shape, different control flow)',
    route:       `/markets/${MARKET_PROBE_ADDRESS}`,

    mocks: {
        // REGISTRY empty-but-valid: respond 200 + valid GraphQL
        // shape but with empty arrays for every query type the
        // market page issues. Distinct from #24's 502 — fires
        // the `.then(empty)` branch in `registryAdapter`.
        [REGISTRY_GRAPHQL_URL]: async (route) => {
            const body = JSON.parse(route.request().postData() || '{}');
            const q = body.query || '';
            let data;
            if (/proposalentities\s*\(/.test(q)) {
                // The market-page's registry adapter filters by
                // `proposalAddress` — returning [] simulates a
                // proposal that's in MARKETS_CONFIG but not in
                // the registry (e.g., new market created locally
                // before the registry indexer caught up).
                data = { proposalentities: [] };
            } else if (q.includes('aggregator(id:')) {
                // Aggregator lookup also returns null to keep
                // every branch on the empty path.
                data = { aggregator: null };
            } else if (q.includes('organizations(where:')) {
                data = { organizations: [] };
            } else {
                // Catch-all: empty data for any unknown query.
                data = {};
            }
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ data }),
            });
        },
        // CANDLES happy path — isolates the registry-side empty
        // failure mode.
        [CANDLES_GRAPHQL_URL]: makeMarketCandlesMockHandler(),
    },

    assertions: [
        // Page-shell-mounted probe: "Trading Pair" label proves
        // the chart-parameter strip mounted from static
        // MARKETS_CONFIG (registry-side enrichment was unavailable
        // but didn't block the foundation). If `.then(empty)`
        // hangs in loading state forever, this label never
        // appears.
        async (page) => {
            await expect(
                page.getByText('Trading Pair').first(),
            ).toBeVisible({ timeout: 30_000 });
        },
        // Wallet shorthand — proves the chain-validation gate
        // didn't false-positive on the empty registry response
        // (which would have replaced this with the
        // WrongNetworkModal).
        async (page) => {
            await expect(
                page.getByText('0xf3…2266').first(),
            ).toBeVisible({ timeout: 15_000 });
        },
    ],

    timeout: 60_000,
};
