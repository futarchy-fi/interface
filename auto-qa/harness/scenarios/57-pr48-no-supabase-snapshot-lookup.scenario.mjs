/**
 * 57-pr48-no-supabase-snapshot-lookup.scenario.mjs — catches PR #48
 * (Read Snapshot proposal ID from on-chain metadata only).
 *
 * ── What KIND of bug this catches ───────────────────────────────────
 * Negative network assertion. Pre-PR-48, `useSnapshotData` queried
 * the Supabase `market_event_proposal_links` table for every market
 * page mount, even when the Registry already had `snapshot_id` in
 * metadata. PR #48 deleted the Supabase code path entirely.
 *
 * A regression that re-introduces the Supabase lookup (e.g., by
 * re-importing `fetchSnapshotProposalId` and gating on a feature
 * flag) wouldn't be caught by DOM-text assertions — the "Snapshot
 * Vote" badge renders identically either way (both paths produce
 * the same `snapshotProposalId`). Only the network shape differs:
 * pre-fix issues a POST/GET to
 * `${SUPABASE_URL}/rest/v1/market_event_proposal_links?select=*`;
 * post-fix issues zero requests to that endpoint.
 *
 * Distinct from scenario 50 (network-shape-companies): that one
 * asserts /companies hits the SUBGRAPH endpoints (positive shape).
 * This one asserts /markets does NOT hit the SUPABASE Snapshot
 * endpoint (negative shape). Together they pin the migration arc.
 *
 * ── How this scenario catches it ────────────────────────────────────
 *   1. Navigate to `/markets/${MARKET_PROBE_ADDRESS}`.
 *   2. Wait for the page to settle (useSnapshotData fires on mount
 *      and resolves within ~5s).
 *   3. Assert `ctx.callsTo(/market_event_proposal_links/)` is empty
 *      — no request to the Supabase table the pre-PR-48 code used.
 *
 * Reverting PR #48 re-introduces `fetchSnapshotProposalId`, which
 * issues
 * `${SUPABASE_URL}/rest/v1/market_event_proposal_links?select=*`.
 * In the harness, SUPABASE_URL is `harness-supabase.invalid` so
 * the request fails — but the FAILED request still appears in
 * `ctx.networkRequests`, so the assertion correctly trips.
 *
 * ── Verification protocol ───────────────────────────────────────────
 *
 *   1. Current code: assertion passes (zero
 *      `market_event_proposal_links` requests).
 *
 *   2. Mutate `src/hooks/useSnapshotData.js` to re-import
 *      `fetchSnapshotProposalId` from `../utils/supabaseSnapshot`
 *      and call it inside the existing useEffect. (Requires also
 *      re-creating `src/utils/supabaseSnapshot.js` since PR #48
 *      deleted it — see git show b5ca120^:src/utils/supabaseSnapshot.js
 *      for the pre-fix content.) → assertion FAILS with N≥1.
 *
 *   3. Restore → passes.
 *
 * ── Mocks ───────────────────────────────────────────────────────────
 * Same registry + candles mocks as scenarios 10 / 49. Supabase URL
 * resolves to `harness-supabase.invalid` (set by Playwright config
 * env), so any request fails at DNS resolution. The page handles
 * the failure gracefully (catch + console.error excluded in the
 * scenario 10 fixture too) — the failure isn't the catch signal,
 * the REQUEST PRESENCE is.
 */

import { expect } from '@playwright/test';

import {
    REGISTRY_GRAPHQL_URL,
    CANDLES_GRAPHQL_URL,
    MARKET_PROBE_ADDRESS,
    fakeMarketProposalEntity,
    makeGraphqlMockHandler,
    makeMarketCandlesMockHandler,
} from '../fixtures/api-mocks.mjs';

export default {
    name:        '57-pr48-no-supabase-snapshot-lookup',
    description: 'Catches PR #48 (Read Snapshot proposal ID from on-chain metadata only). Navigate to /markets/<probe>, assert NO request to the Supabase market_event_proposal_links table. Reverting PR #48 (re-importing fetchSnapshotProposalId) re-introduces the request and trips ctx.callsTo. Negative network assertion KIND.',
    bugShape:    'Supabase market_event_proposal_links lookup re-introduced in useSnapshotData: every market page mount issues an extra failing-DNS request to harness-supabase.invalid, deprecated data path back in service',
    route:       `/markets/${MARKET_PROBE_ADDRESS}`,

    mocks: {
        [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({
            // Provide a snapshot_id in metadata so the Registry-only
            // path resolves the snapshot data. With this, post-fix
            // useSnapshotData has no reason to look anywhere else.
            proposals: [fakeMarketProposalEntity({
                metadataExtra: {
                    snapshot_id: '0xfeed1234feed1234feed1234feed1234feed1234feed1234feed1234feed1234',
                },
            })],
        }),
        [CANDLES_GRAPHQL_URL]: makeMarketCandlesMockHandler(),
    },

    assertions: [
        // Sanity: the page mounts past the initial gate. Same anchor
        // as scenario 10 — proves useContractConfig resolved enough
        // for the chart-parameter strip to render. Without this
        // sanity, an empty `callsTo` could be vacuously true (page
        // crashed before any fetch).
        async (page) => {
            await expect(
                page.getByText('Trading Pair').first(),
            ).toBeVisible({ timeout: 30_000 });
        },

        // Wait for useSnapshotData's mount effect to settle. The
        // effect fires immediately on mount; the pre-fix Supabase
        // call would land in the first ~1s, but we give 3s slack
        // for slow CI machines.
        async (page) => {
            await page.waitForTimeout(3000);
        },

        // Core assertion: NO request to the Supabase
        // market_event_proposal_links table. Slice 82's
        // ctx.callsTo helper accepts a RegExp; we use a forgiving
        // pattern that catches any URL containing the table name
        // (so different REST shapes like `?select=*` or
        // `?id=eq.0x...` still match).
        async (page, ctx) => {
            const supabaseLookups = ctx.callsTo(/market_event_proposal_links/);
            if (supabaseLookups.length > 0) {
                const summary = supabaseLookups
                    .slice(0, 3)
                    .map((r, i) => `  ${i + 1}. ${r.method} ${r.url}`)
                    .join('\n');
                throw new Error(
                    `Scenario 57 found ${supabaseLookups.length} request(s) to the deprecated ` +
                    `Supabase market_event_proposal_links endpoint (PR #48 removed this code path):\n${summary}`,
                );
            }
        },
    ],

    timeout: 180_000,
};
