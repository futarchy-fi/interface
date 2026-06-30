/**
 * 45-pr64-prefixed-shape.scenario.mjs — sister to scenario 44.
 *
 * ── What slice 44 catches vs what this catches ──────────────────────
 * Scenario 44 mocks `/candles/graphql` with `pool.proposal: "0x..."`
 * (plain address, no `<chainId>-` prefix — the production-PROXIED
 * shape). It exercises the THEN-branch of the PR #64 guard at
 * `useAggregatorProposals.js:319`:
 *
 *     const propAddr = raw.includes('-') ? raw.split('-').slice(1).join('-') : raw;
 *                                                                            ^^^^^^^
 *                                                                            slice 44
 *
 * This scenario mocks `pool.proposal: "100-0x..."` (with prefix — the
 * DIRECT-upstream shape) and exercises the THEN-branch:
 *
 *     const propAddr = raw.includes('-') ? raw.split('-').slice(1).join('-') : raw;
 *                                          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
 *                                          slice 45 (this one)
 *
 * Together the two scenarios pin BOTH branches of the guard:
 *   - Guard REMOVED entirely (unconditional `split('-').slice(1).join('-')`)
 *       → 44 FAILS (plain → ""), 45 still PASSES (prefixed → "0x...")
 *   - Guard INVERTED (then/else swapped)
 *       → 44 FAILS (plain → ""), 45 ALSO FAILS (prefixed →
 *         "100-0x..." → lookup miss in poolMap)
 *   - Semantically-equivalent rewrites (e.g. `raw.replace(/^\d+-/, '')`)
 *       → both PASS (correct — the tests don't over-constrain
 *         implementation)
 *
 * ── Why this matters ────────────────────────────────────────────────
 * Production code claims to handle both shapes (per PR #64's comment
 * at hook line 315: "handle both shapes (prefixed for direct upstream,
 * plain for proxied)"). The actual deployed `/candles/graphql` proxy
 * does strip the prefix, but the indexer's direct GraphQL endpoint
 * still emits the prefixed form. So a regression on the THEN-branch
 * would surface when:
 *   - Someone bypasses the proxy and queries the indexer directly
 *   - The proxy's stripping behavior is rolled back
 *   - A different deployment topology (e.g., local Checkpoint without
 *     the api proxy) emits the prefixed form
 *
 * Same poolless probe + same candles-handler-dispatching-on-query
 * pattern as slice 44 — only the `proposal` field shape differs.
 *
 * ── Verification protocol ───────────────────────────────────────────
 * Run both scenarios. Modify `useAggregatorProposals.js:319` to each
 * of these forms and confirm the expected pass/fail:
 *
 *   form                                      | 44   | 45
 *   ------------------------------------------|------|------
 *   `raw.includes('-') ? ... slice ... : raw` | PASS | PASS    (fix intact)
 *   `raw.split('-').slice(1).join('-')`       | FAIL | PASS    (guard removed)
 *   `raw.includes('-') ? raw : ... slice ...` | FAIL | FAIL    (guard inverted)
 *   `raw`                                     | PASS | FAIL    (no stripping at all)
 *   `raw.replace(/^\d+-/, '')`                | PASS | PASS    (equivalent rewrite)
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

// Poolless probe proposal — same shape as scenario 44. The ABSENCE of
// `conditional_pools` in metadata forces dependency on
// `bulkFetchPoolsByChain` at hook line 447.
const POOLLESS_PROBE_TITLE = 'HARNESS-PROBE-EVENT-PR64-PFX';
const POOLLESS_PROPOSAL = {
    id:                  '0xprop00000000000000000000000000000000000045',
    displayNameEvent:    POOLLESS_PROBE_TITLE,
    displayNameQuestion: POOLLESS_PROBE_TITLE,
    description:         'Harness probe — PR #64 prefixed-shape branch',
    metadata:        JSON.stringify({ chain: '100' }),
    metadataURI:     null,
    proposalAddress: PROBE_PROPOSAL_ADDRESS,
    owner:           '0x0000000000000000000000000000000000000000',
    organization:    { id: PROBE_ORG_ID },
};

// Candles handler — IDENTICAL to scenario 44's except the `proposal`
// field on the proposal_in response carries the `<chainId>-<address>`
// prefix (direct-upstream shape). Chain id matches the proposal's
// `metadata.chain = '100'` (also the harness default — anvil fork
// chain id is 100).
function makeCandlesHandlerForPR64Prefixed({ proposalToPools, prices }) {
    return async (route) => {
        const body = JSON.parse(route.request().postData() || '{}');
        const q = body.query || '';
        const variables = body.variables || {};

        if (q.includes('proposal_in')) {
            const pools = [];
            for (const id of (variables.ids || [])) {
                // Same lookup-key logic as scenario 44 — strip on our
                // side to find pp by plain addr.
                const propAddr = id.includes('-')
                    ? id.split('-').slice(1).join('-').toLowerCase()
                    : id.toLowerCase();
                const pp = proposalToPools[propAddr];
                if (!pp) continue;
                // KEY DIFFERENCE from scenario 44: prefixed response
                // shape. The indexer's direct GraphQL emits IDs in
                // `<chainId>-<address>` form; production's
                // `/candles/graphql` proxy strips this prefix, but a
                // direct query (or alternate deployment topology)
                // doesn't. The post-PR-#64 code handles both shapes;
                // this scenario asserts the THEN-branch of the guard
                // still works.
                const prefixedProposal = `100-${propAddr}`;
                pools.push({
                    id:       pp.yes,
                    proposal: prefixedProposal,
                    type:        'CONDITIONAL',
                    outcomeSide: 'YES',
                });
                pools.push({
                    id:       pp.no,
                    proposal: prefixedProposal,
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

        // id_in query — same shape as scenario 44.
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
    name:        '45-pr64-prefixed-shape',
    description: 'Sister to 44: poolless proposal + candles mock with PREFIXED pool.proposal ("100-0x..."). Exercises the THEN-branch of the raw.includes("-") guard. Together with 44 pins both prefix shapes — catches guard removal, inversion, or accidental shape change.',
    bugShape:    'PR #64 prefix-stripping THEN-branch regression',
    route:       '/companies',

    mocks: {
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({
            proposals: [POOLLESS_PROPOSAL],
        }),
        [CANDLES_GRAPHQL_URL]: makeCandlesHandlerForPR64Prefixed({
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
        async (page) => {
            await expect(
                page.getByText(POOLLESS_PROBE_TITLE).first(),
            ).toBeVisible({ timeout: 30_000 });
        },
        async (page) => {
            // Same DOM signal as scenario 44 — "0.4200 SDAI" only
            // appears if poolAddresses got populated, which requires
            // the prefix-stripping branch to extract a valid propAddr
            // from "100-0x...".
            await expect(
                page.getByText('0.4200 SDAI').first(),
            ).toBeVisible({ timeout: 15_000 });
        },
    ],

    timeout: 180_000,
};
