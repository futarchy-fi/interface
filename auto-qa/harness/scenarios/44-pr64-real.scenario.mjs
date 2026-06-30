/**
 * 44-pr64-real.scenario.mjs — the FIRST scenario that actually catches
 * PR #64 by exercising the buggy code path end-to-end.
 *
 * ── Why this scenario exists ────────────────────────────────────────
 * Scenario 01 carries the tag `bugShape: 'PR #64 stale-price-but-API-
 * healthy'`, but it does NOT exercise the PR #64 bug site. PR #64
 * fixed a prefix-stripping bug in
 * `src/hooks/useAggregatorProposals.js::bulkFetchPoolsByChain` (line
 * 319). The fix added a `raw.includes('-') ?` guard — without it, when
 * `/candles/graphql` returns `pool.proposal` as a plain address
 * (production-proxied shape, no `<chainId>-` prefix),
 * `raw.split('-').slice(1).join('-')` returns "" and every pool gets
 * dropped, leaving `poolMap` empty and the carousel without prices.
 *
 * Scenario 01's mock proposal (via `fakePoolBearingProposal`) embeds
 * `metadata.conditional_pools.{yes,no}.address`, which
 * `transformProposalToEvent` reads at hook line 162 and uses to
 * populate `poolAddresses` BEFORE `bulkFetchPoolsByChain` ever runs.
 * Then at hook line 451, `bulkFetchPoolsByChain` only OVERRIDES
 * `poolAddresses` when poolMap is non-empty — so an empty poolMap
 * (the PR #64 bug) is invisible: the metadata-derived addresses
 * survive, the prices fetch succeeds, the DOM shows the right number.
 * The test passes whether PR #64's fix is present or not. (See
 * step 73 — honest gap-acknowledgment.)
 *
 * ── How this scenario closes that gap ───────────────────────────────
 * Two changes vs scenario 01:
 *
 *   (a) Mock proposal HAS NO `conditional_pools` in metadata, so
 *       `poolAddresses` is null after `transformProposalToEvent`.
 *       The carousel can ONLY get prices if `bulkFetchPoolsByChain`
 *       successfully populates `poolMap`.
 *
 *   (b) Candles mock answers TWO query shapes:
 *         - `pools(where: { proposal_in: ["100-0x..."] })` — the
 *           `bulkFetchPoolsByChain` query. Returns rows whose
 *           `proposal` field is a PLAIN address (no `<chainId>-`
 *           prefix), matching the production-proxied shape that PR
 *           #64's reproducer URL (`api.futarchy.fi/candles/graphql`)
 *           emits.
 *         - `pools(where: { id_in: ["0x..."] })` — the follow-up
 *           price fetch via `SubgraphBulkPriceFetcher.fetchPoolsBatch`.
 *           Returns rows with `price` populated.
 *
 * If the PR #64 fix is intact: pool.proposal = "0x..." (plain) →
 * `raw.includes('-') ? ... : raw` returns the plain address →
 * `propAddr` is non-empty → `poolMap[propAddr] = { yes, no }` →
 * `proposal.poolAddresses` populated → price fetch succeeds → DOM
 * shows "0.4200 SDAI".
 *
 * If the PR #64 fix regresses (someone removes the `raw.includes('-')`
 * guard): `raw.split('-').slice(1).join('-')` returns "" → `if
 * (!propAddr) continue` skips every pool → poolMap empty →
 * `poolAddresses` stays null → no price fetch → DOM stays at "0.00
 * SDAI" or LoadingSpinner → THIS ASSERTION FAILS. Bug caught.
 *
 * ── Verification protocol ───────────────────────────────────────────
 * After this scenario is in the suite, validate the catch with:
 *   1. Temporarily revert `src/hooks/useAggregatorProposals.js:319` to
 *      pre-PR-#64 form: `const propAddr = raw.split('-').slice(1).join('-');`
 *   2. Run scenario 01 — should still PASS (proves the gap is real).
 *   3. Run scenario 44 — should FAIL with assertion "0.4200 SDAI" not
 *      found (proves the catch is real).
 *   4. Restore the guard.
 *
 * Future companion (slice 75): a SISTER scenario with `pool.proposal`
 * as `"100-0x..."` (direct-upstream shape) to pin the OTHER branch of
 * the `raw.includes('-')` guard. Together the two scenarios catch
 * regressions in either direction.
 */

import { expect } from '@playwright/test';

import {
    REGISTRY_GRAPHQL_URL,
    CANDLES_GRAPHQL_URL,
    PROBE_POOL_YES,
    PROBE_POOL_NO,
    PROBE_PROPOSAL_ADDRESS,
    PROBE_ORG_ID,
    makeGraphqlMockHandler,
} from '../fixtures/api-mocks.mjs';

// A probe proposal WITHOUT `conditional_pools` in metadata. Forces the
// carousel to depend on `bulkFetchPoolsByChain` for pool discovery —
// which is exactly the code path PR #64 fixed. Cannot use
// `fakePoolBearingProposal` (which always embeds conditional_pools).
const POOLLESS_PROBE_TITLE = 'HARNESS-PROBE-EVENT-PR64';
const POOLLESS_PROPOSAL = {
    id:                  '0xprop00000000000000000000000000000000000044',
    displayNameEvent:    POOLLESS_PROBE_TITLE,
    displayNameQuestion: POOLLESS_PROBE_TITLE,
    description:         'Harness probe — PR #64 bulkFetchPoolsByChain dependency',
    // NO conditional_pools — `transformProposalToEvent` line 162 sees
    // no `proposalMeta.conditional_pools`, so `poolAddresses` stays
    // null. The only remaining path to populate it is
    // `bulkFetchPoolsByChain` at hook line 447.
    metadata:        JSON.stringify({ chain: '100' }),
    metadataURI:     null,
    proposalAddress: PROBE_PROPOSAL_ADDRESS,
    owner:           '0x0000000000000000000000000000000000000000',
    organization:    { id: PROBE_ORG_ID },
};

// Custom candles handler that differentiates the two query shapes
// `useAggregatorProposals` issues against `/candles/graphql`:
//
//   1. `pools(where: { proposal_in: $ids })` from `bulkFetchPoolsByChain`.
//      Variables include the `<chainId>-<address>` IDs. We respond with
//      pool rows whose `proposal` field is the PRODUCTION-PROXIED shape
//      (plain address) — this is the exact shape that triggers the PR
//      #64 bug when the guard is removed.
//
//   2. `pools(where: { id_in: [...] })` from `SubgraphBulkPriceFetcher
//      .fetchPoolsBatch`. Addresses are embedded directly in the query
//      text. We respond with price-bearing rows.
//
// We can't reuse `makeCandlesMockHandler` here because (a) its regex
// `"(0x[a-fA-F0-9]{40})"` doesn't match the prefixed `"100-0x..."` IDs
// in `proposal_in` queries' variables and (b) its response shape lacks
// a `proposal` field. Inlining keeps the scenario self-contained while
// the helper is exercised; once this lands, the handler can be
// refactored into `api-mocks.mjs` if other scenarios need the same
// query-shape dispatch.
function makeCandlesHandlerForPR64({ proposalToPools, prices }) {
    return async (route) => {
        const body = JSON.parse(route.request().postData() || '{}');
        const q = body.query || '';
        const variables = body.variables || {};

        // (1) bulkFetchPoolsByChain — proposal_in query.
        if (q.includes('proposal_in')) {
            const pools = [];
            for (const id of (variables.ids || [])) {
                // Strip the prefix here on our side (we're simulating
                // the proxy) so we look up `proposalToPools` by the
                // plain address.
                const propAddr = id.includes('-')
                    ? id.split('-').slice(1).join('-').toLowerCase()
                    : id.toLowerCase();
                const pp = proposalToPools[propAddr];
                if (!pp) continue;
                pools.push({
                    id:       pp.yes,
                    // PRODUCTION-PROXIED SHAPE: plain address, no
                    // `<chainId>-` prefix. THIS is the field the
                    // PR #64 prefix-stripping bug operates on. With
                    // the guard removed, `raw.split('-').slice(1)
                    // .join('-')` returns "" for this value.
                    proposal: propAddr,
                    type:        'CONDITIONAL',
                    outcomeSide: 'YES',
                });
                pools.push({
                    id:       pp.no,
                    proposal: propAddr,
                    type:        'CONDITIONAL',
                    outcomeSide: 'NO',
                });
            }
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ data: { pools } }),
            });
        }

        // (2) fetchPoolsBatch — id_in query with addresses inline.
        const idMatches = [...q.matchAll(/"(0x[a-fA-F0-9]{40})"/g)]
            .map((m) => m[1].toLowerCase());
        const pools = idMatches
            .filter((addr) => Object.prototype.hasOwnProperty.call(prices, addr))
            .map((addr) => ({
                id:          addr,
                name:        `harness-pool-${addr.slice(2, 10)}`,
                price:       prices[addr],
                type:        'CONDITIONAL',
                outcomeSide: 'YES',
            }));
        return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: { pools } }),
        });
    };
}

export default {
    name:        '44-pr64-real',
    description: 'Catches PR #64 for real: poolless proposal → bulkFetchPoolsByChain is the only path to prices. Candles mock returns pool.proposal as plain address (production-proxied shape). If the prefix-stripping guard regresses, poolMap empties and the assertion fails.',
    bugShape:    'PR #64 bulkFetchPoolsByChain prefix-stripping regression',
    route:       '/companies',

    mocks: {
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({
            proposals: [POOLLESS_PROPOSAL],
        }),
        [CANDLES_GRAPHQL_URL]: makeCandlesHandlerForPR64({
            proposalToPools: {
                [PROBE_PROPOSAL_ADDRESS.toLowerCase()]: {
                    yes: PROBE_POOL_YES,
                    no:  PROBE_POOL_NO,
                },
            },
            prices: {
                [PROBE_POOL_YES]: 0.42,
                [PROBE_POOL_NO]:  0.58,
            },
        }),
    },

    assertions: [
        // Pre-flight: confirm the carousel rendered our event at all.
        // If THIS fails, the bug is upstream (registry mock / org
        // filter / visibility), not at the price-fetch layer.
        async (page) => {
            await expect(
                page.getByText(POOLLESS_PROBE_TITLE).first(),
            ).toBeVisible({ timeout: 30_000 });
        },
        // Canonical assertion: formatter chain renders the mocked
        // price IFF bulkFetchPoolsByChain successfully populated
        // poolAddresses. YES=0.42 (<1) → high-precision branch →
        // toFixed(4) = "0.4200" + " SDAI". Failure here = PR #64
        // bug returned.
        async (page) => {
            await expect(
                page.getByText('0.4200 SDAI').first(),
            ).toBeVisible({ timeout: 15_000 });
        },
    ],

    timeout: 180_000,
};
