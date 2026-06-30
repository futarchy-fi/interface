/**
 * 63-pr50-milestones-legacy-id-to-address.scenario.mjs — catches PR
 * #50 (migrate per-company milestones page to subgraph).
 *
 * ── What KIND of bug this catches ───────────────────────────────────
 * Positive network-shape assertion on the GraphQL request BODY (not
 * just URL). Pre-PR-50, `/milestones?company_id=9` carried the
 * numeric `9` through to a Supabase-based company-data fetcher. The
 * `useOrganization` hook was gated on `isAddressId`
 * (`startsWith('0x') && length === 42`), so a numeric id stayed
 * gated OUT — the subgraph `organization(id:)` query for the
 * Gnosis DAO address NEVER fired.
 *
 * Post-PR-50, `milestones.js` maps legacy numeric/slug ids
 * (`9`, `gnosis`, `kleros`, …) to the corresponding Organization
 * CONTRACT ADDRESS up front (`0x3Fd2e8E71f75eED4b5c507706c413E33e
 * 0661bBf` for Gnosis DAO). Now `companyIdToUse` IS an address,
 * `useOrganization` fires, and the subgraph receives the
 * `organization(id: "0x3fd2e8...")` query — proving the legacy-id
 * mapping bridged correctly.
 *
 * A regression that reverts the mapping (e.g., dropping the
 * `LEGACY_ID_TO_ORG_ADDRESS` constant or restoring the old
 * `parseInt(companyIdToUse)` path) would skip the subgraph entirely
 * for legacy IDs — the page would either error out (no Supabase
 * mock) or render an empty milestones list silently. Either way,
 * the catch signal is: did the subgraph see the Gnosis DAO address
 * in any `organization(id:)` query?
 *
 * ── How this scenario catches it ────────────────────────────────────
 *   1. Navigate to `/milestones?company_id=9` (the canonical legacy
 *      numeric id for Gnosis DAO — present in
 *      `LEGACY_ID_TO_ORG_ADDRESS` per PR #50's mapping table).
 *   2. Factory-form mocks attach a `ctx.orgQueries` capture array.
 *   3. Registry mock's `onCall` callback inspects every incoming
 *      GraphQL query body; when the query contains
 *      `organization(id:` (the singular `useOrganization` shape,
 *      distinct from `organizations(where:`) AND the Gnosis DAO
 *      address (lowercase, since the hook lowercases via
 *      `orgAddress.toLowerCase()`), push to the capture array.
 *   4. Wait for the page to settle.
 *   5. Assert `ctx.orgQueries.length > 0` — the subgraph received
 *      at least one query targeting the Gnosis DAO address.
 *
 * ── Why a network-body match (not just URL match) ───────────────────
 * The slice-82 `ctx.callsTo` helper only filters on URL (no
 * `postData`). For GraphQL endpoints that handle multiple operation
 * shapes (registry serves aggregator + organizations(plural) +
 * organization(singular) + proposalentities), URL-only matching
 * can't distinguish which operation was issued. So this scenario
 * uses the slice-86 `onCall` + factory-mocks pattern to inspect
 * the GraphQL query string itself. Each captured entry includes
 * the query so the failure trace is debuggable.
 *
 * ── Verification protocol ───────────────────────────────────────────
 *
 *   1. Current code: assertion passes (one or more
 *      `organization(id: "0x3fd2e8...")` queries captured).
 *
 *   2. Mutate `src/pages/milestones.js` to revert the mapping:
 *      replace the `LEGACY_ID_TO_ORG_ADDRESS` resolution with the
 *      pre-fix `companyIdToUse = 9;` numeric path. → assertion
 *      FAILS with `Scenario 63 captured ZERO organization(id:) ...`
 *      because `useOrganization` is gated on `orgAddress.length
 *      === 42` and receives `null`.
 *
 *   3. Restore → passes.
 *
 * ── What this DOESN'T cover ─────────────────────────────────────────
 *   - The other half of PR #50 (deletion of `fetchCompanyData` +
 *     `ProposalsPageDataTransformer.jsx`). Those code paths are
 *     deleted, so there's no Supabase request to absence-assert
 *     on — a future revert would have to RECREATE the helpers, at
 *     which point the network-shape catch would surface the
 *     Supabase URL. Negative-shape coverage on a deleted-helper
 *     surface needs the helper to come back first; we don't gate
 *     PR #50's catch on that.
 *
 *   - The `marketEndTime → registryMetadata.closeTimestamp`
 *     migration in MarketPageShowcase. That's a fallback shape
 *     change that doesn't surface in network traffic for the
 *     happy path; catching it would need a market-page-specific
 *     scenario whose registry mock omits closeTimestamp from
 *     metadata and asserts the page handles the fallback
 *     correctly.
 */

import { expect } from '@playwright/test';

import {
    REGISTRY_GRAPHQL_URL,
    CANDLES_GRAPHQL_URL,
    makeGraphqlMockHandler,
    makeCandlesMockHandler,
} from '../fixtures/api-mocks.mjs';

// Gnosis DAO Organization contract address per PR #50's
// LEGACY_ID_TO_ORG_ADDRESS table. The address is lowercased by
// `useOrganization`'s `orgAddress.toLowerCase()` before sending, so
// matching against the lowercase form is what the mock callback
// actually sees.
const GNOSIS_DAO_ORG_ADDRESS_LOWER = '0x3fd2e8e71f75eed4b5c507706c413e33e0661bbf';

export default {
    name:        '63-pr50-milestones-legacy-id-to-address',
    description: 'Catches PR #50 (migrate per-company milestones page to subgraph). Navigate to /milestones?company_id=9, capture every registry-GraphQL query body, assert at least one is an organization(id: "0x3fd2e8...") query for the Gnosis DAO address. Reverting the LEGACY_ID_TO_ORG_ADDRESS mapping makes useOrganization skip the fetch (gate on isAddressId stays false for numeric "9"), and the capture stays empty.',
    bugShape:    'milestones legacy-id mapping reverted: ?company_id=9 stops resolving to Gnosis DAO\'s on-chain Organization address, useOrganization gate stays false, the page silently renders empty or errors out',
    route:       '/milestones?company_id=9',

    mocks: (ctx) => {
        // Scenario-scoped capture: every organization(id:) query
        // targeting the Gnosis DAO address.
        ctx.orgQueries = [];

        return {
            [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({
                organizations: [],
                onCall: (query, body) => {
                    // useOrganization emits a parameterized query
                    // — the ADDRESS is in body.variables.id, NOT
                    // inlined in the query string. So match on the
                    // QUERY SHAPE (organization(id: $id)) plus the
                    // VARIABLE value (lowercased Gnosis DAO addr).
                    if (!query.includes('organization(id:')) return;
                    const id = body?.variables?.id;
                    if (typeof id === 'string' &&
                        id.toLowerCase() === GNOSIS_DAO_ORG_ADDRESS_LOWER) {
                        ctx.orgQueries.push({ query, variables: body.variables });
                    }
                },
            }),
            [CANDLES_GRAPHQL_URL]: makeCandlesMockHandler({}),
        };
    },

    assertions: [
        // Wait for the page to settle. `useOrganization`'s mount
        // effect fires immediately; the registry POST lands within
        // ~1s on a warm dev server. 5s slack covers cold compile.
        async (page) => {
            await page.waitForTimeout(5000);
        },

        // Core: at least one organization(id:) query targeting the
        // Gnosis DAO address. The pre-fix path leaves
        // ctx.orgQueries empty because useOrganization receives
        // null (numeric `9` fails the address length check).
        async (page, ctx) => {
            const queries = ctx.orgQueries ?? [];
            if (queries.length === 0) {
                throw new Error(
                    `Scenario 63 captured ZERO organization(id:) queries targeting ` +
                    `the Gnosis DAO address (${GNOSIS_DAO_ORG_ADDRESS_LOWER}). ` +
                    `Expected: the milestones page maps ?company_id=9 → Gnosis ` +
                    `DAO org address → useOrganization issues an organization(id:) ` +
                    `subgraph query. Either PR #50's LEGACY_ID_TO_ORG_ADDRESS mapping ` +
                    `regressed, or useOrganization\'s subgraph endpoint changed. ` +
                    `Page URL: ${page.url()}.`,
                );
            }
            // Sanity: each captured query MUST include the
            // singular `organization(id:` shape (not the plural
            // `organizations`). If somehow a different query shape
            // got captured, the failure trace highlights it.
            for (const entry of queries) {
                expect(entry.query).toContain('organization(id:');
                expect(entry.variables?.id?.toLowerCase()).toBe(GNOSIS_DAO_ORG_ADDRESS_LOWER);
            }
        },
    ],

    timeout: 60_000,
};
