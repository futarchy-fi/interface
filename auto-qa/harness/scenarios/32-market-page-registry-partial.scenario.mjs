/**
 * 32-market-page-registry-partial.scenario.mjs — chaos: partial-
 * success registry on /markets/[address].
 *
 * Where #22 covers partial-success on the REGISTRY side of
 * /companies (two proposals — one fully-formed, one parseable-
 * but-degraded), this slice covers the symmetric failure mode
 * on the MARKET PAGE. Distinct from #24 (registry hard-502 →
 * `.catch`), #26 (registry empty-200 → `.then([])`), and #28
 * (registry malformed-body → SyntaxError) because the
 * proposalentities response is STRUCTURALLY VALID and contains
 * a row matching the requested `proposalAddress` — but the
 * row's optional sub-fields are degraded.
 *
 * Two distinctions from #22:
 *   - #22 returns TWO proposals (one full + one partial) and
 *     tests that the partial sibling doesn't poison the full
 *     one's render
 *   - #32 (this slice) returns ONE proposal matching the URL
 *     address with degraded metadata — tests that the
 *     single-row degradation doesn't break the page's
 *     enrichment pipeline (title/description/pool-address
 *     lookups all need a defensive branch for missing fields)
 *
 * Degraded fields:
 *   - `title`, `description`, `displayNameEvent`,
 *     `displayNameQuestion` all set to null (covers the
 *     "render falls back to MARKETS_CONFIG title?" case)
 *   - `metadata.conditional_pools` field MISSING from the
 *     parseable JSON (covers the pool-address-extraction
 *     defensive branch)
 *   - `organization` set to null (covers the nested-object
 *     null-guard pattern; a real-world bug shape from a
 *     dataset where the org reference was broken)
 *
 * Bug-shapes guarded:
 *   - Page CRASHES when proposal.title is null (formatter
 *     assumes string; renders `undefined` to DOM or
 *     errors out on string-method access like
 *     `proposal.title.toUpperCase()`)
 *   - Page renders "null" or "undefined" as the proposal
 *     title or description (missing `?? ''` somewhere in
 *     the formatter chain)
 *   - `proposal.organization.name` access CRASHES because
 *     `organization` is null (no nullish-chain guard)
 *   - `proposal.metadata.conditional_pools.yes.address`
 *     access CRASHES because `conditional_pools` is absent
 *     (same shape as #22's bug guard, but on the market
 *     page's address-extraction path which may be a
 *     separate code surface)
 *   - "Market Not Found" FALSE-POSITIVE because the
 *     metadata-validity check is too strict (rejects a
 *     row that's PRESENT but partially degraded, treating
 *     it as missing)
 *   - Chart panel goes BLANK because the conditional-pools
 *     address extraction throws and propagates up the
 *     chart-data-derivation chain
 *
 * Why no `useAnvilRpcProxy: true`: same rationale as prior
 * market-page chaos slices.
 */

import { expect } from '@playwright/test';

import {
    REGISTRY_GRAPHQL_URL,
    CANDLES_GRAPHQL_URL,
    MARKET_PROBE_ADDRESS,
    makeMarketCandlesMockHandler,
} from '../fixtures/api-mocks.mjs';

// Hand-construct a degraded proposal entity. Same
// proposalAddress as MARKET_PROBE_ADDRESS (so the registry
// adapter's filter matches it) but with key sub-fields
// stripped:
//   - title/description/displayName* nullified
//   - metadata JSON is parseable but missing conditional_pools
//   - organization is null (not just its aggregator)
function fakeDegradedMarketProposalEntity() {
    return {
        id:                  `proposal-${MARKET_PROBE_ADDRESS.slice(2, 10)}`,
        proposalAddress:     MARKET_PROBE_ADDRESS,
        // Parseable JSON, but conditional_pools is ABSENT —
        // exercises the optional-chain branch in pool-address
        // extraction. Same shape as #22's degraded proposal but
        // hitting a different code path (market-page lookups
        // by address, not list-rendering).
        metadata: JSON.stringify({ chain: '100' }),
        title:               null,
        description:         null,
        displayNameEvent:    null,
        displayNameQuestion: null,
        owner:               '0x0000000000000000000000000000000000000000',
        organization:        null,
    };
}

export default {
    name:        '32-market-page-registry-partial',
    description: 'REGISTRY returns a parseable proposalentity row matching the requested proposalAddress but with degraded sub-fields (title/description/displayName* null + metadata.conditional_pools absent + organization null) + CANDLES happy. Asserts the page-shell still mounts (Trading Pair + wallet shorthand visible) — proves the page handles per-field degradation via MARKETS_CONFIG fallbacks + defensive null-guards on nested access. Distinct from #24 (registry 502), #26 (registry empty), #28 (registry malformed) because the row is PRESENT and PARSEABLE, just missing optional sub-fields. Mirror of #22 (single-row case) on the market page.',
    bugShape:    'page crashes when proposal.title is null / page renders raw "undefined" or "null" as proposal title or description / proposal.organization.name crash from null nested-object access / proposal.metadata.conditional_pools.yes.address crash from missing nested field / "Market Not Found" false-positive on partially-degraded row / chart panel blank from address extraction propagating up the chart-data-derivation chain',
    route:       `/markets/${MARKET_PROBE_ADDRESS}`,

    mocks: {
        // REGISTRY partial: one row matching the URL address
        // but degraded. Inline mock builds the response by
        // dispatching on query shape — same pattern as #26.
        [REGISTRY_GRAPHQL_URL]: async (route) => {
            const body = JSON.parse(route.request().postData() || '{}');
            const q = body.query || '';
            let data;
            if (/proposalentities\s*\(/.test(q)) {
                data = { proposalentities: [fakeDegradedMarketProposalEntity()] };
            } else if (q.includes('aggregator(id:')) {
                data = { aggregator: null };
            } else if (q.includes('organizations(where:')) {
                data = { organizations: [] };
            } else {
                data = {};
            }
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ data }),
            });
        },
        [CANDLES_GRAPHQL_URL]: makeMarketCandlesMockHandler(),
    },

    assertions: [
        async (page) => {
            await expect(
                page.getByText('Trading Pair').first(),
            ).toBeVisible({ timeout: 30_000 });
        },
        async (page) => {
            await expect(
                page.getByText('0xf3…2266').first(),
            ).toBeVisible({ timeout: 15_000 });
        },
    ],

    timeout: 60_000,
};
