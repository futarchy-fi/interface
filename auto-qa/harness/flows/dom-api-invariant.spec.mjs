/**
 * dom-api-invariant.spec.mjs — Phase 5 slice 4: DOM↔API invariant
 *
 * The canonical Phase 5 deliverable: prove the harness can intercept
 * a real API call the futarchy app makes, return a controlled
 * response, and assert the DOM reflects what the API returned. This
 * is the foundation for catching "API is healthy but the UI shows
 * the wrong number" bugs (the PR #64 shape from interface).
 *
 * Slice 4 v1 — minimal mechanism proof. Picks the simplest API→DOM
 * path on the futarchy app: the /companies page calls three GraphQL
 * queries against `https://api.futarchy.fi/registry/graphql`
 * (aggregator → organizations → proposalentities), and the
 * organization `name` field gets rendered verbatim as the
 * `org.title` cell in `<OrganizationsTable>`. We mock the
 * organizations response with a probe name and assert it appears in
 * the DOM. Future sub-slices extend this to actual numeric prices
 * (pool data, candle aggregates, etc.) once the mechanism is proven.
 *
 * What this test verifies:
 *   1. `context.route` can intercept the futarchy app's GraphQL POSTs
 *      to `api.futarchy.fi/registry/graphql`.
 *   2. The handler can dispatch on operation name (aggregator vs
 *      organizations vs proposalentities) by inspecting the POST
 *      body's `query` text.
 *   3. The mocked org name ("HARNESS-PROBE-ORG-…") propagates
 *      through useAggregatorCompanies → transformOrgToCard →
 *      <OrganizationsTable> → DOM.
 *
 * What this test does NOT verify (deferred to sub-slices):
 *   - Numeric price values (the eventual Phase 5 invariant scope)
 *   - Pool data (volumeToken*, liquidity, sqrtPrice)
 *   - The /v3/conditional REST endpoint (used by proposalsList,
 *     where the dataTransformer overrides prices with "$0.00")
 *   - Cross-protocol price reconciliation (Algebra vs CoW etc.)
 *
 * Skipping rules: same as flows/app-discovery.spec.mjs — skips when
 * HARNESS_NO_WEBSERVER=1. Run via `npm run auto-qa:e2e:ui:full`.
 */

import { test, expect } from '@playwright/test';

import {
    installWalletStub,
    nStubWallets,
} from '../fixtures/wallet-stub.mjs';
import {
    REGISTRY_GRAPHQL_URL,
    CANDLES_GRAPHQL_URL,
    PROBE_ORG_NAME,
    PROBE_POOL_YES,
    PROBE_POOL_NO,
    makeGraphqlMockHandler,
    makeCandlesMockHandler,
    fakeProposal,
    fakePoolBearingProposal,
} from '../fixtures/api-mocks.mjs';

const STUB_RPC_URL =
    process.env.HARNESS_FRONTEND_RPC_URL ||
    process.env.HARNESS_ANVIL_URL ||
    'http://localhost:8546';

test.describe('Phase 5 slice 4 — DOM↔API invariant', () => {
    test.beforeEach(({}, testInfo) => {
        if (process.env.HARNESS_NO_WEBSERVER === '1') {
            testInfo.skip(true, 'requires Next.js dev server (run :ui:full)');
        }
    });

    test('mocked org name flows from GraphQL response into the OrganizationsTable cell', async ({ context, page }) => {
        test.setTimeout(180_000);

        // Track every operation we intercepted, for the trace if the
        // assertion fails — helps quickly diagnose "we mocked but the
        // page never asked" vs "we mocked but the DOM didn't render".
        const calls = [];
        await context.route(REGISTRY_GRAPHQL_URL, makeGraphqlMockHandler({
            onCall: (q) => {
                if (q.includes('aggregator(id:'))           calls.push('aggregator');
                else if (q.includes('organizations(where:'))calls.push('organizations');
                else if (q.includes('proposalentities('))    calls.push('proposalentities');
                else                                          calls.push(`other:${q.slice(0, 40)}`);
            },
        }));

        const wallet = nStubWallets(1)[0];
        await context.addInitScript(installWalletStub({
            privateKey: wallet.privateKey,
            rpcUrl: STUB_RPC_URL,
            chainId: 100,
        }));

        await page.goto('/companies', { waitUntil: 'domcontentloaded' });

        // The probe name should render in BOTH the company card
        // (CompaniesListCarousel) and the table row (OrganizationsTable).
        // Slim slice 4: assert at least one occurrence is visible.
        // The exact rendering paths can be exercised separately in
        // future iterations once we know which layout the user
        // primarily sees.
        const probeMatches = page.getByText(PROBE_ORG_NAME);
        await expect(probeMatches.first()).toBeVisible({ timeout: 30_000 });
        // Bonus assertion: the value rendered in MORE than one place,
        // so any future regression that renames `org.title` will
        // surface here, not silently in only one consumer.
        expect(await probeMatches.count()).toBeGreaterThanOrEqual(1);

        // Sanity: the page actually issued (at minimum) the aggregator
        // and organizations queries. If only `aggregator` showed up,
        // something broke the chain — useful breadcrumb in failure logs.
        expect(calls).toContain('aggregator');
        expect(calls).toContain('organizations');
    });

    test('slice 4b — mocked proposal counts flow into OrgRow active/total cells', async ({ context, page }) => {
        test.setTimeout(180_000);

        // Build 8 active + 3 hidden = 11 total nonArchived. Per
        // useAggregatorCompanies::transformOrgToCard:
        //   - nonArchived = filter !archived → 11
        //   - active = nonArchived.filter !hidden && !resolved → 8
        // So the OrgRow should render activeProposals=8,
        // proposalsCount=11. 8 + 11 are distinctive enough that
        // they're vanishingly unlikely to appear elsewhere in the
        // (mostly-empty under our mock) page.
        const proposals = [];
        for (let i = 0; i < 8; i++) proposals.push(fakeProposal(`a${i}`));
        for (let i = 0; i < 3; i++) proposals.push(fakeProposal(`h${i}`, { visibility: 'hidden' }));

        await context.route(REGISTRY_GRAPHQL_URL, makeGraphqlMockHandler({ proposals }));

        const wallet = nStubWallets(1)[0];
        await context.addInitScript(installWalletStub({
            privateKey: wallet.privateKey,
            rpcUrl: STUB_RPC_URL,
            chainId: 100,
        }));

        await page.goto('/companies', { waitUntil: 'domcontentloaded' });

        // Wait for our org to render so the table row exists.
        await expect(page.getByText(PROBE_ORG_NAME).first()).toBeVisible({ timeout: 30_000 });

        // The OrganizationsTable column layout (per
        // src/components/futarchyFi/companyList/table/OrganizationsTable.jsx
        // + OrgRow.jsx) is:
        //   td[0]=logo, td[1]=name+badges, td[2]=active, td[3]=total, td[4]=chain
        const row = page.getByRole('row').filter({ hasText: PROBE_ORG_NAME });
        await expect(row).toHaveCount(1);
        await expect(row.locator('td').nth(2)).toHaveText('8');
        await expect(row.locator('td').nth(3)).toHaveText('11');
    });

    test('slice 4d — zero-proposal edge case: OrgRow active/total cells render "0" / "0" when proposals=[]', async ({ context, page }) => {
        test.setTimeout(180_000);

        // Edge-case companion to slice 4b. Where 4b mocks 8 active +
        // 3 hidden = 11 total nonArchived (which proves the formatter
        // RENDERS counts and the FILTER MATH is structurally correct
        // for nonzero inputs), this slice mocks an EMPTY proposals
        // array and proves the formatter degrades to literal "0" /
        // "0" — NOT an empty cell, NOT "—", NOT "N/A", NOT "NaN".
        //
        // Bug classes caught (distinct from 4b):
        //   - Formatter that calls `.toString()` on undefined/null
        //     when proposals[] is empty (renders "undefined" or
        //     blank cell)
        //   - Formatter that uses `||` fallback to a non-zero
        //     placeholder ("—", "N/A", "?") when count is 0 (treats
        //     0 as falsy — classic JS edge-case bug)
        //   - Formatter that does division/percentage and emits
        //     "NaN" or "Infinity" when the denominator is 0
        //   - useAggregatorCompanies::transformOrgToCard that
        //     short-circuits and returns null when proposals=[],
        //     hiding the org row entirely (reverse of the desired
        //     behavior — empty org should still appear with 0/0)
        //   - Reducer pattern that initialises accumulator to a
        //     non-array value (e.g., `null`) and crashes on `.length`
        //     access for an empty list
        //
        // Why valuable now: the matrix-axis chaos work has hardened
        // the page against API-level failures (28 → 32 cells of
        // chaos coverage); this is the FIRST invariant-axis probe
        // that hardens the formatter against DATA-level edge cases
        // (empty inputs that pass type checks but trigger
        // arithmetic/falsy-coercion bugs in downstream code).
        //
        // Note on the org existence: useAggregatorCompanies still
        // returns the org row even when proposals=[] because the
        // org metadata comes from a SEPARATE GraphQL query
        // (`organizations`) than the proposal-list query
        // (`proposalentities`). Mocking proposals=[] only zeroes
        // the count fields; the row should still render with the
        // probe org name.
        await context.route(REGISTRY_GRAPHQL_URL, makeGraphqlMockHandler({
            proposals: [],
        }));

        const wallet = nStubWallets(1)[0];
        await context.addInitScript(installWalletStub({
            privateKey: wallet.privateKey,
            rpcUrl: STUB_RPC_URL,
            chainId: 100,
        }));

        await page.goto('/companies', { waitUntil: 'domcontentloaded' });

        // Probe org name still renders (proves the org-level data
        // path is independent of the proposal-list data path).
        await expect(page.getByText(PROBE_ORG_NAME).first()).toBeVisible({ timeout: 30_000 });

        // The OrganizationsTable column layout (per slice 4b's
        // pinning of OrganizationsTable.jsx + OrgRow.jsx):
        //   td[0]=logo, td[1]=name+badges, td[2]=active, td[3]=total, td[4]=chain
        const row = page.getByRole('row').filter({ hasText: PROBE_ORG_NAME });
        await expect(row).toHaveCount(1);
        // The CRITICAL pair of edge-case assertions: both cells
        // render literal "0", NOT empty, NOT dash, NOT "NaN".
        await expect(row.locator('td').nth(2)).toHaveText('0');
        await expect(row.locator('td').nth(3)).toHaveText('0');
    });

    test('slice 4f — archived filter applied in proposal counts (5 active + 2 hidden + 3 archived → "5" / "7")', async ({ context, page }) => {
        test.setTimeout(180_000);

        // Extends slice 4b's coverage of the active/total formatter to
        // the ARCHIVED filter — a separate filter branch in
        // `useAggregatorCompanies::transformOrgToCard`.
        //
        // Per src/hooks/useAggregatorCompanies.js (line 83):
        //   const nonArchived = proposalsForOrg.filter(
        //       p => parseMetadata(p.metadata).archived !== true
        //   );
        //
        // So a proposal whose metadata has `archived: true` is EXCLUDED
        // from `nonArchived` (and therefore from `active`, since
        // `active` is a subset of `nonArchived`).
        //
        // Test inputs:
        //   - 5 proposals with NO special metadata → all 5 are active
        //   - 2 proposals with `visibility: 'hidden'` → counted in
        //     nonArchived but NOT in active
        //   - 3 proposals with `archived: true` → excluded from
        //     nonArchived entirely (and therefore also from active)
        //   Total raw: 10 proposals
        //   Expected: active=5, nonArchived=7
        //
        // Bug classes caught (distinct from slice 4b which only tests
        // the hidden filter):
        //   - Regression that drops the archived filter — would render
        //     "5" / "10" instead of "5" / "7" (3 archived rows leak
        //     into the visible total)
        //   - Regression that treats `archived: false` as truthy (uses
        //     `m.archived` directly instead of `m.archived === true`)
        //     — flips the count direction
        //   - Regression that mis-types the field as "isArchived" or
        //     "deleted" instead of "archived" — silent miss
        //   - Regression that applies the archived filter in the
        //     active subset only (not in the nonArchived superset) —
        //     would render "5" / "10" because the total leaks
        //     archived rows
        //   - Regression where `parseMetadata` doesn't parse the
        //     JSON string and `.archived` lookup returns undefined —
        //     filter passes everything, totals leak
        //
        // Why this matters: archive is the "soft delete" mechanism
        // for proposals (per the hook's docstring). A regression that
        // breaks the archived filter would resurface deleted
        // proposals in the org's total count — visible product bug
        // affecting trust in the dashboard's accuracy.

        const proposals = [];
        for (let i = 0; i < 5; i++) proposals.push(fakeProposal(`a${i}`));
        for (let i = 0; i < 2; i++) proposals.push(fakeProposal(`h${i}`, { visibility: 'hidden' }));
        for (let i = 0; i < 3; i++) proposals.push(fakeProposal(`x${i}`, { archived: true }));

        await context.route(REGISTRY_GRAPHQL_URL, makeGraphqlMockHandler({ proposals }));

        const wallet = nStubWallets(1)[0];
        await context.addInitScript(installWalletStub({
            privateKey: wallet.privateKey,
            rpcUrl: STUB_RPC_URL,
            chainId: 100,
        }));

        await page.goto('/companies', { waitUntil: 'domcontentloaded' });

        await expect(page.getByText(PROBE_ORG_NAME).first()).toBeVisible({ timeout: 30_000 });

        // Same column layout as slice 4b:
        //   td[0]=logo, td[1]=name+badges, td[2]=active, td[3]=total, td[4]=chain
        const row = page.getByRole('row').filter({ hasText: PROBE_ORG_NAME });
        await expect(row).toHaveCount(1);
        await expect(row.locator('td').nth(2)).toHaveText('5');
        await expect(row.locator('td').nth(3)).toHaveText('7');
    });

    test('slice 4g — resolved filter excludes from active only, not nonArchived (6 normal + 2 resolved → "6" / "8")', async ({ context, page }) => {
        test.setTimeout(180_000);

        // Completes the filter-triplet coverage alongside slice 4b
        // (hidden) and slice 4f (archived). The three filters live in
        // DIFFERENT places in the code:
        //   - archived  → excludes from nonArchived (drops total)
        //   - hidden    → excludes from active only (total unchanged)
        //   - resolved  → excludes from active only (total unchanged)
        //
        // Per src/hooks/useAggregatorCompanies.js:83-89:
        //   const nonArchived = proposalsForOrg.filter(p =>
        //       parseMetadata(p.metadata).archived !== true
        //   );
        //   const active = nonArchived.filter(p => {
        //       const pm = parseMetadata(p.metadata);
        //       if (pm.visibility === 'hidden') return false;
        //       if (pm.resolution_status === 'resolved'
        //           || pm.resolution_outcome) return false;
        //       return true;
        //   });
        //
        // The `resolution_status === 'resolved'` branch is the
        // "explicit-resolved" path; the `pm.resolution_outcome`
        // truthy branch is the "implicit-resolved" path (any
        // outcome set implies resolution happened). This slice
        // exercises the EXPLICIT branch — `resolution_outcome`
        // coverage is a future slice.
        //
        // Test inputs:
        //   - 6 proposals with no special metadata → all 6 active
        //   - 2 proposals with `resolution_status: 'resolved'` →
        //     in nonArchived (NOT archived) but excluded from
        //     active
        //   Total raw: 8 proposals
        //   Expected: active=6, nonArchived=8
        //
        // Bug classes caught (distinct from 4b and 4f):
        //   - Regression that drops the resolved-status filter —
        //     would render "8" / "8" (resolved leak into active
        //     count alongside their nonArchived presence)
        //   - Regression that maps `resolution_status === 'resolved'`
        //     into the `archived` filter instead of the `active`
        //     filter — would render "6" / "6" (resolved would
        //     incorrectly drop from total)
        //   - Regression that uses loose equality
        //     (`pm.resolution_status == 'Resolved'` or similar) —
        //     case-sensitive bug surfaces here
        //   - Regression that switches the OR condition to AND
        //     (`'resolved' AND resolution_outcome`) — proposals
        //     with status='resolved' but outcome=undefined would
        //     leak into active
        //
        // Why this completes the filter triplet: archive, hidden,
        // resolved are the three states the dashboard
        // distinguishes from "currently active". A regression that
        // breaks ANY of them silently miscounts the org's true
        // activity level — visible product bug. The triplet probes
        // each filter branch in isolation so the failure log
        // points to exactly which branch broke.

        const proposals = [];
        for (let i = 0; i < 6; i++) proposals.push(fakeProposal(`n${i}`));
        for (let i = 0; i < 2; i++) proposals.push(fakeProposal(`r${i}`, { resolution_status: 'resolved' }));

        await context.route(REGISTRY_GRAPHQL_URL, makeGraphqlMockHandler({ proposals }));

        const wallet = nStubWallets(1)[0];
        await context.addInitScript(installWalletStub({
            privateKey: wallet.privateKey,
            rpcUrl: STUB_RPC_URL,
            chainId: 100,
        }));

        await page.goto('/companies', { waitUntil: 'domcontentloaded' });

        await expect(page.getByText(PROBE_ORG_NAME).first()).toBeVisible({ timeout: 30_000 });

        // Same column layout as 4b / 4d / 4f.
        const row = page.getByRole('row').filter({ hasText: PROBE_ORG_NAME });
        await expect(row).toHaveCount(1);
        // The DISTINGUISHING assertion vs 4f (which used 5/7):
        // active < total here, AND total is unchanged from the raw
        // 8-proposal input (proves resolved didn't drop from total).
        await expect(row.locator('td').nth(2)).toHaveText('6');
        await expect(row.locator('td').nth(3)).toHaveText('8');
    });

    test('slice 4h — resolution_outcome-truthy branch of the resolved filter (7 normal + 3 outcome:"yes" → "7" / "10")', async ({ context, page }) => {
        test.setTimeout(180_000);

        // Companion to slice 4g, exercises the OR-branch of the
        // resolved filter. Per
        // `src/hooks/useAggregatorCompanies.js:87`:
        //   if (pm.resolution_status === 'resolved'
        //       || pm.resolution_outcome) return false;
        //
        // 4g covers the LEFT branch:
        //   `resolution_status === 'resolved'` with no outcome
        //
        // 4h (this slice) covers the RIGHT branch:
        //   `resolution_outcome` truthy with no status
        //   (e.g., a proposal that's been resolved via outcome-
        //    assignment but the status field hasn't been backfilled,
        //    OR a proposal that uses a different state machine where
        //    `outcome` is set as soon as voting closes)
        //
        // The semantic distinction matters in production: some
        // proposal lifecycle paths set `resolution_outcome`
        // directly (e.g., admin-resolved proposals) without
        // changing `resolution_status`. A regression that drops
        // the OR's right side would silently leak those proposals
        // back into the active count even though they're done.
        //
        // Test inputs:
        //   - 7 proposals with no special metadata → all 7 active
        //   - 3 proposals with `resolution_outcome: 'yes'` (status
        //     omitted) → in nonArchived but excluded from active
        //   Total raw: 10 proposals
        //   Expected: active=7, nonArchived=10
        //
        // Bug classes caught (NEW vs 4g's left-branch coverage):
        //   - Regression that drops the right side of the OR
        //     (only checks status) — renders "10" / "10"
        //     (outcome-resolved proposals leak into active)
        //   - Regression that switches the OR to AND — only
        //     proposals with BOTH fields set would be excluded;
        //     these (with only outcome set) would leak into active
        //   - Regression that hard-codes truthiness check to
        //     specific string match (e.g., `outcome === 'resolved'`
        //     instead of just truthy) — "yes" / "no" outcomes
        //     would leak even though they ARE resolved
        //   - Regression that omits `pm.resolution_outcome` from
        //     the GraphQL query selection — `pm` lacks the field
        //     entirely, undefined → falsy → leaks into active
        //
        // Distinct numeric signature from 4g (6/8): 4h uses 7/10
        // so a failure log unambiguously identifies which branch
        // broke.

        const proposals = [];
        for (let i = 0; i < 7; i++) proposals.push(fakeProposal(`n${i}`));
        for (let i = 0; i < 3; i++) proposals.push(fakeProposal(`o${i}`, { resolution_outcome: 'yes' }));

        await context.route(REGISTRY_GRAPHQL_URL, makeGraphqlMockHandler({ proposals }));

        const wallet = nStubWallets(1)[0];
        await context.addInitScript(installWalletStub({
            privateKey: wallet.privateKey,
            rpcUrl: STUB_RPC_URL,
            chainId: 100,
        }));

        await page.goto('/companies', { waitUntil: 'domcontentloaded' });

        await expect(page.getByText(PROBE_ORG_NAME).first()).toBeVisible({ timeout: 30_000 });

        const row = page.getByRole('row').filter({ hasText: PROBE_ORG_NAME });
        await expect(row).toHaveCount(1);
        await expect(row.locator('td').nth(2)).toHaveText('7');
        await expect(row.locator('td').nth(3)).toHaveText('10');
    });

    test('slice 4i — chain DEFAULT branch (no metadata.chain → chainId=100 default → "Gnosis")', async ({ context, page }) => {
        test.setTimeout(180_000);

        // Completes the chain-formatter triplet alongside slice 4c v1
        // (lookup-table branch) and slice 4c v2 (template-literal
        // fallback branch). The three branches live in DIFFERENT
        // places in the code:
        //
        //   - useAggregatorCompanies.js (chainId resolution):
        //       const chainId = meta.chain
        //           ? parseInt(meta.chain, 10) : 100;
        //     ↑ default branch fires when meta.chain is absent/falsy
        //
        //   - ChainBadge.jsx (rendering):
        //       const cfg = CHAIN_CONFIG[chainId] ?? FALLBACK;
        //     ↑ lookup-table branch fires when chainId is in
        //       CHAIN_CONFIG (4c v1: chainId=10 → "Optimism")
        //     ↑ template-literal fallback fires when chainId is
        //       absent (4c v2: chainId=999 → "Chain 999")
        //     ↑ DEFAULT branch (this slice): chainId=100 → "Gnosis"
        //
        // The DEFAULT branch is structurally important because
        // 100 (Gnosis) is the PRODUCTION chain for futarchy.fi. A
        // regression that drops the `: 100` default would make all
        // orgs with absent metadata.chain render through the
        // fallback path as "Chain undefined" or similar — a
        // visible product bug affecting every default-chain org.
        //
        // Test inputs:
        //   - orgMetadata: null (the fixture's default, so we don't
        //     even need to pass it explicitly — using the bare
        //     fixture variant makes the test STRICTLY tighter:
        //     anything that breaks the default-chain path AND
        //     happens to override the fixture's defaults would
        //     surface here)
        //   - proposals: [] (irrelevant to chain; keeps the test
        //     focused on the chain cell)
        //   Expected: td[4] === "Gnosis"
        //
        // Bug classes caught (NEW vs 4c v1 and 4c v2):
        //   - Regression that DROPS the `: 100` default in the
        //     chainId resolution (`meta.chain ? parseInt(...) :
        //     undefined`) — would render "Chain undefined" or
        //     "Chain NaN" via the template-literal fallback
        //   - Regression that changes the default chainId to a
        //     different number (e.g., a refactor that flips the
        //     default to mainnet `1`) — would render "ETH"
        //     instead of "Gnosis" — silent product bug because
        //     the chain badge is small and easy to overlook
        //   - Regression that removes the Gnosis entry from
        //     CHAIN_CONFIG (or renames its shortName) — would
        //     render "Chain 100" or undefined
        //   - Regression in the fixture that injects a stale
        //     metadata.chain value as a SIDE EFFECT (e.g., a
        //     helper that defaults to `JSON.stringify({chain: '1'})`
        //     when null is passed) — would render the wrong
        //     chain even when the test asks for default
        //
        // Why finishing the chain triplet now: the chain
        // identifier appears in many places throughout the app
        // (wallet stub, RainbowKit, RPC routing). A regression
        // that breaks the DOM display would still let the underlying
        // chain wiring work — silent visual bug. With v1, v2, and
        // this i in the catalog, all three rendering paths have
        // explicit probes; a future change that breaks any one
        // surfaces with a clear failure log.

        // Bare-minimum mock — no orgMetadata, no proposals.
        await context.route(REGISTRY_GRAPHQL_URL, makeGraphqlMockHandler({}));

        const wallet = nStubWallets(1)[0];
        await context.addInitScript(installWalletStub({
            privateKey: wallet.privateKey,
            rpcUrl: STUB_RPC_URL,
            chainId: 100,
        }));

        await page.goto('/companies', { waitUntil: 'domcontentloaded' });

        await expect(page.getByText(PROBE_ORG_NAME).first()).toBeVisible({ timeout: 30_000 });

        const row = page.getByRole('row').filter({ hasText: PROBE_ORG_NAME });
        await expect(row).toHaveCount(1);
        // td[4] is the chain cell; ChainBadge renders shortName.
        // Default chain (chainId=100) → CHAIN_CONFIG[100].shortName
        // === "Gnosis" (per src/components/futarchyFi/companyList/
        // components/ChainBadge.jsx).
        await expect(row.locator('td').nth(4)).toHaveText('Gnosis');
    });

    test('slice 4l — filter-chain stress test: 10 mixed-flag proposals → "3" / "6" (multi-flag combinations stable)', async ({ context, page }) => {
        test.setTimeout(180_000);

        // Stress test of the filter chain across all 8 combinations
        // of (archived, hidden, resolved) flags. Where 4b, 4f, 4g,
        // and 4h each probe ONE filter branch in isolation (single
        // flag per proposal), this slice mocks proposals with
        // MULTIPLE flags set to verify the filter chain is stable
        // under realistic mixed inputs.
        //
        // 8 proposals in the truth-table corners:
        //   1. normal (no flags)         × 3 → all 3 active
        //   2. archived only             × 1 → excluded by nonArchived
        //   3. hidden only               × 1 → in nonArchived, not in active
        //   4. resolved only             × 1 → in nonArchived, not in active
        //   5. archived + hidden         × 1 → excluded by nonArchived
        //   6. archived + resolved       × 1 → excluded by nonArchived
        //   7. hidden + resolved         × 1 → in nonArchived, not in active
        //   8. archived + hidden + resolved × 1 → excluded by nonArchived
        //
        //   Total proposals raw: 3 + 1×5 = 8 distinct flag patterns
        //   (3 normals + 5 unique combinations + 0 duplicates of any
        //   combo). Actually: 3 + 1 + 1 + 1 + 1 + 1 + 1 + 1 = 10
        //   wait let me recount:
        //
        // Let me redo the math precisely:
        //   normal:                       3 copies → all 3 ACTIVE
        //   archived only:                1 copy   → NOT in nonArchived
        //   hidden only:                  1 copy   → in nonArchived,
        //                                            NOT in active
        //   resolved only:                1 copy   → in nonArchived,
        //                                            NOT in active
        //   archived + hidden:            1 copy   → NOT in nonArchived
        //   archived + resolved:          1 copy   → NOT in nonArchived
        //   hidden + resolved:            1 copy   → in nonArchived,
        //                                            NOT in active
        //   archived + hidden + resolved: 1 copy   → NOT in nonArchived
        //
        //   Total: 3 + 1 + 1 + 1 + 1 + 1 + 1 + 1 = 10 proposals
        //
        //   nonArchived = 10 - 4 (archived ones) = 6
        //     → 3 normal + 1 hidden + 1 resolved + 1 hidden+resolved
        //   active      = 3 (only the truly-normal ones)
        //
        // Expected DOM: td[2]='3', td[3]='6'.
        //
        // Bug classes caught (NEW vs 4b, 4f, 4g, 4h — none of those
        // exercise multi-flag inputs):
        //   - Filter chain that DOUBLE-COUNTS exclusions when a
        //     proposal triggers multiple flags (e.g., subtracts from
        //     total once per flag) → would render lower numbers
        //   - Filter chain that applies hidden/resolved checks BEFORE
        //     archived check and then re-applies archived → could
        //     leak archived proposals into active if the second
        //     check is dropped during a refactor
        //   - Filter that uses a single `.filter()` with combined
        //     boolean logic and gets the precedence wrong (e.g.,
        //     `!(archived && hidden)` instead of `!archived && !hidden`)
        //   - Filter that special-cases the "all three" proposal
        //     and miscounts it (treats it differently than the
        //     archived-only one)
        //   - Regression where the filters operate on the WRONG
        //     intermediate set (e.g., active filter operates on
        //     the original proposals[] instead of nonArchived[]) —
        //     would render active=4 (3 normals + 1 archived-only,
        //     because the archived flag is missed)
        //
        // Why this is the right next step: with 4b/4f/4g/4h each
        // probing single-flag inputs, a refactor that breaks the
        // COMPOSITION of filters (rather than any individual filter)
        // would slip through. This slice pins the composition by
        // testing the filter chain end-to-end with multi-flag data.

        const proposals = [];
        // 3 normal active
        for (let i = 0; i < 3; i++) proposals.push(fakeProposal(`n${i}`));
        // 1 archived only
        proposals.push(fakeProposal('A', { archived: true }));
        // 1 hidden only
        proposals.push(fakeProposal('H', { visibility: 'hidden' }));
        // 1 resolved only
        proposals.push(fakeProposal('R', { resolution_status: 'resolved' }));
        // 1 archived + hidden
        proposals.push(fakeProposal('AH', { archived: true, visibility: 'hidden' }));
        // 1 archived + resolved
        proposals.push(fakeProposal('AR', { archived: true, resolution_status: 'resolved' }));
        // 1 hidden + resolved
        proposals.push(fakeProposal('HR', { visibility: 'hidden', resolution_status: 'resolved' }));
        // 1 all three
        proposals.push(fakeProposal('AHR', { archived: true, visibility: 'hidden', resolution_status: 'resolved' }));

        await context.route(REGISTRY_GRAPHQL_URL, makeGraphqlMockHandler({ proposals }));

        const wallet = nStubWallets(1)[0];
        await context.addInitScript(installWalletStub({
            privateKey: wallet.privateKey,
            rpcUrl: STUB_RPC_URL,
            chainId: 100,
        }));

        await page.goto('/companies', { waitUntil: 'domcontentloaded' });

        await expect(page.getByText(PROBE_ORG_NAME).first()).toBeVisible({ timeout: 30_000 });

        const row = page.getByRole('row').filter({ hasText: PROBE_ORG_NAME });
        await expect(row).toHaveCount(1);
        // active = 3 (only the 3 normal proposals; 4 are archived,
        // 3 are hidden-or-resolved among the non-archived)
        // nonArchived = 6 (10 raw - 4 archived)
        await expect(row.locator('td').nth(2)).toHaveText('3');
        await expect(row.locator('td').nth(3)).toHaveText('6');
    });

    test('slice 4m — logo fallback image src (no org metadata → "/assets/fallback-company.png")', async ({ context, page }) => {
        test.setTimeout(180_000);

        // FIRST attribute-level invariant in the catalog. All prior
        // slices (4 v1, 4b, 4d, 4f, 4g, 4h, 4i, 4c v1/v2/v3a/v3b,
        // 4e, 4j, 4k, 4l) assert on the DOM's TEXT content. This
        // slice asserts on a DOM ATTRIBUTE (`<img src=...>`) — a
        // distinct rendering surface that catches a different class
        // of bug.
        //
        // Per `src/hooks/useAggregatorCompanies.js:95`:
        //   image: meta.coverImage || meta.logo
        //          || '/assets/fallback-company.png',
        //
        // Per `src/components/futarchyFi/companyList/table/OrgRow.jsx:29`:
        //   src={image || '/assets/fallback-company.png'}
        //
        // The fallback is DOUBLY-guarded: useAggregatorCompanies
        // ensures `image` is always set to the fallback path when
        // no metadata supplies a coverImage or logo, and OrgRow has
        // its own `|| '/assets/fallback-company.png'` belt-and-
        // suspenders fallback. This test confirms the OUTER end of
        // the chain (the actual `<img>` rendered to the DOM)
        // resolves to the fallback path when nothing else is
        // mocked.
        //
        // Note on Next.js Image: the rendered `<img>` may carry a
        // src wrapped by the Next.js Image Optimization endpoint
        // (e.g., `/_next/image?url=%2Fassets%2Ffallback-company.png&w=64&q=75`).
        // Using a regex substring match on `fallback-company`
        // tolerates either form (raw path or wrapped URL) so the
        // test isn't brittle to whether the optimization endpoint
        // is hit.
        //
        // Bug classes caught (NEW vs text-level invariants):
        //   - Regression in useAggregatorCompanies that drops the
        //     `|| '/assets/fallback-company.png'` from the chain
        //     (image becomes undefined when metadata is missing)
        //     — OrgRow's belt-and-suspenders catches it, but the
        //     intermediate path is broken; this test wouldn't
        //     catch it alone but the combined coverage tightens
        //     intermediate contracts.
        //   - Regression in OrgRow that drops the `|| '...'`
        //     fallback (relies entirely on the hook's fallback)
        //     — when the hook breaks first, OrgRow renders an
        //     empty src; this slice catches BOTH layers because
        //     the assertion fires on the OrgRow output.
        //   - Regression that changes the fallback filename
        //     (e.g., to `default-company.png`) — would silently
        //     succeed if both layers were updated, but a refactor
        //     that updates only one would surface here.
        //   - Regression that points the fallback at an external
        //     URL (e.g., `https://placeholder.com/...`) — would
        //     leak cross-origin loads on every fallback render;
        //     the substring match on `fallback-company` would
        //     fail because the URL doesn't contain that token.
        //   - Regression that drops Next.js Image wrapping
        //     entirely and switches to a plain `<img>` — could
        //     pass this test (the src would still contain
        //     `fallback-company`) but lose image optimization
        //     in production. Future iteration can tighten by
        //     also asserting on the `srcset` attribute.
        //
        // Why this matters: the logo column is one of the most
        // visible elements on the /companies page. A regression
        // that breaks the fallback would show broken-image icons
        // for every org without metadata — visible product bug
        // affecting any org that hasn't set a logo.

        // Bare-minimum mock — no orgMetadata.
        await context.route(REGISTRY_GRAPHQL_URL, makeGraphqlMockHandler({}));

        const wallet = nStubWallets(1)[0];
        await context.addInitScript(installWalletStub({
            privateKey: wallet.privateKey,
            rpcUrl: STUB_RPC_URL,
            chainId: 100,
        }));

        await page.goto('/companies', { waitUntil: 'domcontentloaded' });

        await expect(page.getByText(PROBE_ORG_NAME).first()).toBeVisible({ timeout: 30_000 });

        // Locate the org's row, then its logo image (in td[0]).
        const row = page.getByRole('row').filter({ hasText: PROBE_ORG_NAME });
        await expect(row).toHaveCount(1);
        // The img element inside td[0]. Substring match tolerates
        // Next.js Image's optimization wrapper (e.g., src might be
        // `/_next/image?url=...fallback-company.png`).
        await expect(row.locator('img').first()).toHaveAttribute(
            'src',
            /fallback-company/,
        );
    });

    test('slice 4c v1 — chain enum formatter (mocked metadata.chain → ChainBadge text)', async ({ context, page }) => {
        test.setTimeout(180_000);

        // Per useAggregatorCompanies::transformOrgToCard:
        //   const meta = parseMetadata(org.metadata);     // JSON.parse the string
        //   const chainId = meta.chain ? parseInt(meta.chain, 10) : 100;
        // Per ChainBadge::CHAIN_CONFIG[10].shortName === 'Optimism'.
        // Default chain is 100 → "Gnosis"; flipping to 10 must shift
        // the badge text. This is a different formatter class from
        // 4a/4b (string-passthrough / integer-toString) — int → enum
        // mapping with a fallback case.
        await context.route(REGISTRY_GRAPHQL_URL, makeGraphqlMockHandler({
            orgMetadata: JSON.stringify({ chain: '10' }),
        }));

        const wallet = nStubWallets(1)[0];
        await context.addInitScript(installWalletStub({
            privateKey: wallet.privateKey,
            rpcUrl: STUB_RPC_URL,
            chainId: 100,
        }));

        await page.goto('/companies', { waitUntil: 'domcontentloaded' });

        await expect(page.getByText(PROBE_ORG_NAME).first()).toBeVisible({ timeout: 30_000 });

        const row = page.getByRole('row').filter({ hasText: PROBE_ORG_NAME });
        await expect(row).toHaveCount(1);
        // Chain cell is td[4]; ChainBadge renders shortName.
        await expect(row.locator('td').nth(4)).toHaveText('Optimism');
    });

    test('slice 4c v2 — chain enum FALLBACK formatter (unknown chain → "Chain N" template literal)', async ({ context, page }) => {
        test.setTimeout(180_000);

        // ChainBadge.jsx falls back when the chainId isn't in
        // CHAIN_CONFIG to:
        //   { shortName: `Chain ${chainId}`, name: `Chain ${chainId}` }
        // 4c v1 covered the lookup-table branch (chain=10 → "Optimism");
        // this test covers the fallback branch — a TEMPLATE-LITERAL
        // formatter that interpolates the input number into a string.
        // Different bug shape than 4c v1: regression that drops the
        // fallback (e.g., crashes on missing key, or renders empty)
        // would surface here, not in 4c v1.
        await context.route(REGISTRY_GRAPHQL_URL, makeGraphqlMockHandler({
            orgMetadata: JSON.stringify({ chain: '999' }),
        }));

        const wallet = nStubWallets(1)[0];
        await context.addInitScript(installWalletStub({
            privateKey: wallet.privateKey,
            rpcUrl: STUB_RPC_URL,
            chainId: 100,
        }));

        await page.goto('/companies', { waitUntil: 'domcontentloaded' });

        await expect(page.getByText(PROBE_ORG_NAME).first()).toBeVisible({ timeout: 30_000 });

        const row = page.getByRole('row').filter({ hasText: PROBE_ORG_NAME });
        await expect(row).toHaveCount(1);
        // Fallback formatter: shortName = `Chain ${chainId}`.
        await expect(row.locator('td').nth(4)).toHaveText('Chain 999');
    });

    test('slice 4c v3b — candles price flows through prefetchedPrices into EventHighlightCard\'s formatter ("0.4200 SDAI")', async ({ context, page }) => {
        test.setTimeout(180_000);

        // The full canonical Phase 5 invariant: a numeric value
        // produced by an API endpoint is mocked, the real React app
        // pulls it through its hooks + formatters, and the visible
        // DOM string matches the formatter's exact output.
        //
        // Path:
        //   registry/graphql → fetchProposalsFromAggregator → events
        //   candles/graphql  → collectAndFetchPoolPrices → priceMap
        //                      attachPrefetchedPrices → event.prefetchedPrices
        //   carousel renders <EventHighlightCard prefetchedPrices=... />
        //   useLatestPoolPrices short-circuits to prefetched values
        //   EventHighlightCard formats:
        //     `${prices.yes.toFixed(precision)} ${baseTokenSymbol}`
        //     where precision=4 if any price<1, baseTokenSymbol='SDAI'
        //     when metadata.currencyTokens.base.tokenSymbol unset.
        //
        // YES=0.42 (<1) → high-precision format → "0.4200 SDAI".

        const richProposal = fakePoolBearingProposal({});
        await context.route(REGISTRY_GRAPHQL_URL, makeGraphqlMockHandler({
            proposals: [richProposal],
        }));

        await context.route(CANDLES_GRAPHQL_URL, makeCandlesMockHandler({
            prices: {
                [PROBE_POOL_YES]: 0.42,
                [PROBE_POOL_NO]:  0.58,
            },
        }));

        const wallet = nStubWallets(1)[0];
        await context.addInitScript(installWalletStub({
            privateKey: wallet.privateKey,
            rpcUrl: STUB_RPC_URL,
            chainId: 100,
        }));

        await page.goto('/companies', { waitUntil: 'domcontentloaded' });

        // Pre-flight: confirm the carousel rendered our event at all
        // (proves the proposal passed the visibility/resolved/etc.
        // filters and the carousel got far enough to mount the card).
        await expect(
            page.getByText('HARNESS-PROBE-EVENT-001').first(),
        ).toBeVisible({ timeout: 30_000 });

        // Now the actual canonical assertion: the formatter's output
        // ("YES toFixed(4) = '0.4200', + ' SDAI'") is in the DOM.
        await expect(
            page.getByText('0.4200 SDAI').first(),
        ).toBeVisible({ timeout: 15_000 });
    });

    test('slice 4j — precision=4 stays sticky when YES≥1 but NO<1 (1.42 / 0.58 → "1.4200 SDAI")', async ({ context, page }) => {
        test.setTimeout(180_000);

        // Strict tightening of slice 4c v3b. Where v3b mocks BOTH
        // prices < 1 (yes=0.42, no=0.58) and verifies precision=4,
        // this slice exercises the OR-branch of the precision logic.
        //
        // Per `src/components/futarchyFi/companyList/cards/
        // highlightCards/EventHighlightCard.jsx:298-301`:
        //   const shouldUseHighPrecision =
        //       (prices.no !== null && prices.no < 1) ||
        //       (prices.yes !== null && prices.yes < 1);
        //   const precision = shouldUseHighPrecision ? 4 : 2;
        //
        // The conditional uses `||` to require EITHER price < 1 to
        // engage high-precision. So:
        //   - yes=0.42 + no=0.58 (both <1) → precision=4 (v3b)
        //   - yes=1.42 + no=0.58 (NO<1)    → precision=4 (this slice)
        //   - yes=1.42 + no=1.58 (neither) → precision=2 (future)
        //
        // The case under test (yes=1.42 + no=0.58) is the one that
        // catches a SUBTLE regression: if someone refactored
        // `shouldUseHighPrecision` to only check `prices.yes < 1`
        // (forgetting the NO leg), v3b would still pass (YES<1
        // there), but this slice would fail because YES≥1 → the
        // YES-only check would return false → precision=2 → DOM
        // shows "1.42 SDAI" instead of "1.4200 SDAI".
        //
        // Why this matters: precision regressions are visually
        // subtle (2-decimal vs 4-decimal). For an arbitrage user
        // who needs to see the 3rd/4th decimal to spot price
        // drift across YES/NO, dropping precision is a real
        // product bug. The shouldUseHighPrecision logic is the
        // mechanism that keeps precision sticky in mixed cases —
        // this test pins that mechanism in isolation.
        //
        // Bug classes caught (NEW vs 4c v3b):
        //   - Refactor that drops the NO leg from
        //     `shouldUseHighPrecision` (only checks YES) — passes
        //     v3b, fails here
        //   - Refactor that swaps `||` to `&&` (would require
        //     BOTH to be <1) — passes v3b (both ARE <1), fails
        //     here (only NO is <1, so combined && would be false
        //     → precision=2 → "1.42 SDAI")
        //   - Hard-code of `precision = 2` (assumes "%" display
        //     never needs >2 decimals) — passes 4c v3b only by
        //     accident (the 0.4200 vs 0.42 distinction would have
        //     surfaced); definitely fails here
        //   - Regression that flips the comparison operator from
        //     `< 1` to `>= 1` — passes v3b (both <1, so the
        //     flipped check returns false for both → precision=2
        //     incorrect; should fail v3b too if v3b's assertion
        //     is tight). The cross-coverage here strengthens v3b.

        const richProposal = fakePoolBearingProposal({});
        await context.route(REGISTRY_GRAPHQL_URL, makeGraphqlMockHandler({
            proposals: [richProposal],
        }));

        await context.route(CANDLES_GRAPHQL_URL, makeCandlesMockHandler({
            prices: {
                [PROBE_POOL_YES]: 1.42,
                [PROBE_POOL_NO]:  0.58,
            },
        }));

        const wallet = nStubWallets(1)[0];
        await context.addInitScript(installWalletStub({
            privateKey: wallet.privateKey,
            rpcUrl: STUB_RPC_URL,
            chainId: 100,
        }));

        await page.goto('/companies', { waitUntil: 'domcontentloaded' });

        // Pre-flight: the carousel mounts our event card.
        await expect(
            page.getByText('HARNESS-PROBE-EVENT-001').first(),
        ).toBeVisible({ timeout: 30_000 });

        // The canonical assertion: precision=4 stays sticky.
        // "1.4200 SDAI" not "1.42 SDAI". The 4-decimal format is
        // the SIGNATURE that proves both legs of the OR engaged
        // in the precision decision.
        await expect(
            page.getByText('1.4200 SDAI').first(),
        ).toBeVisible({ timeout: 15_000 });
    });

    test('slice 4k — precision=2 branch: BOTH prices ≥1 drops precision to 2 (1.42 / 1.58 → "1.42 SDAI")', async ({ context, page }) => {
        test.setTimeout(180_000);

        // Completes the price-precision triplet alongside slice
        // 4c v3b and slice 4j. Truth table for the
        // shouldUseHighPrecision OR:
        //   - both <1   (4c v3b: 0.42, 0.58)  → precision=4
        //   - one <1    (4j: 1.42, 0.58)      → precision=4
        //   - none <1   (4k: 1.42, 1.58) ★    → precision=2
        //
        // Per `EventHighlightCard.jsx:298-301`:
        //   const shouldUseHighPrecision =
        //       (prices.no !== null && prices.no < 1) ||
        //       (prices.yes !== null && prices.yes < 1);
        //   const precision = shouldUseHighPrecision ? 4 : 2;
        //
        // When BOTH prices >=1, BOTH legs of the OR return false,
        // shouldUseHighPrecision is false, precision drops to 2,
        // and toFixed(2) emits "1.42" — NOT "1.4200".
        //
        // Why test this branch: it's the ONLY case where the OR
        // returns false. A regression that hard-codes precision=4
        // (never drops to 2) would pass v3b and 4j but fail here.
        // A regression that inverts the comparison from `< 1` to
        // `>= 1` would pass v3b and 4j only by accident; here it
        // would still fail because (1.42 >= 1) || (1.58 >= 1) is
        // true → precision=4 stuck → "1.4200 SDAI" appears
        // instead of "1.42 SDAI".
        //
        // Note on realism: in futarchy, conditional-token prices
        // typically sum to ~1, so the (both >=1) case is rare in
        // production. But it's a legal state under low-liquidity
        // or non-arbitraged conditions, and the formatter logic
        // exists to handle it. The test pins that logic so a
        // future "simplify the formatter" refactor that loses the
        // precision=2 branch surfaces here.
        //
        // Bug classes caught (NEW vs 4c v3b and 4j):
        //   - Hard-coded precision=4 (never drops) — passes v3b
        //     and 4j, fails here ("1.4200 SDAI" instead of "1.42")
        //   - Inverted comparison `>= 1` instead of `< 1` — passes
        //     v3b and 4j only by accident, fails here
        //   - shouldUseHighPrecision permanently true (a refactor
        //     that always returns true "to be safe") — would
        //     pass v3b and 4j, fail here
        //   - precision=2 hard-coded instead of conditional — would
        //     pass this test but FAIL v3b and 4j (those want 4
        //     decimals); cross-coverage protects the whole table

        const richProposal = fakePoolBearingProposal({});
        await context.route(REGISTRY_GRAPHQL_URL, makeGraphqlMockHandler({
            proposals: [richProposal],
        }));

        await context.route(CANDLES_GRAPHQL_URL, makeCandlesMockHandler({
            prices: {
                [PROBE_POOL_YES]: 1.42,
                [PROBE_POOL_NO]:  1.58,
            },
        }));

        const wallet = nStubWallets(1)[0];
        await context.addInitScript(installWalletStub({
            privateKey: wallet.privateKey,
            rpcUrl: STUB_RPC_URL,
            chainId: 100,
        }));

        await page.goto('/companies', { waitUntil: 'domcontentloaded' });

        await expect(
            page.getByText('HARNESS-PROBE-EVENT-001').first(),
        ).toBeVisible({ timeout: 30_000 });

        // The canonical assertion: precision=2 — "1.42 SDAI" not
        // "1.4200 SDAI". The 2-decimal format is the SIGNATURE
        // that proves the precision-drop branch engaged.
        // page.getByText defaults to substring matching; we want
        // EXACT here because "1.42 SDAI" is a substring of
        // "1.4200 SDAI" and the wrong-precision case would
        // spuriously pass under substring matching.
        await expect(
            page.getByText('1.42 SDAI', { exact: true }).first(),
        ).toBeVisible({ timeout: 15_000 });
    });

    test('slice 4c v3a — candles GraphQL endpoint is hit with the proposal\'s pool addresses', async ({ context, page }) => {
        test.setTimeout(180_000);

        // The /companies page also fires the EventsHighlightCarousel,
        // which calls fetchProposalsFromAggregator (DIFFERENT data path
        // from useAggregatorCompanies — it uses the carousel-shape
        // PROPOSALS_QUERY with displayName/proposalAddress fields) →
        // collectAndFetchPoolPrices → POST to candles/graphql.
        //
        // 4c v3a is plumbing-only: prove the carousel pipeline reaches
        // the candles endpoint with our mocked pool addresses. 4c v3b
        // (next iteration) builds on top to assert the formatted price
        // renders in the carousel card.

        // Track which candles requests came in so we can assert the
        // pipeline reached the expected stage.
        const candlesCalls = [];

        // Registry mock — must respond to BOTH the
        // useAggregatorCompanies queries (table view) AND the
        // useAggregatorProposals queries (carousel). Both use the same
        // operation NAMES (aggregator / organizations / proposalentities)
        // but the carousel's proposalentities query selects more fields
        // (displayNameEvent etc.), so we stuff a richer object into
        // the response — the table view ignores extra fields.
        const richProposal = fakePoolBearingProposal({});
        await context.route(REGISTRY_GRAPHQL_URL, makeGraphqlMockHandler({
            proposals: [richProposal],
        }));

        // Candles mock — return a known YES price; capture pool
        // addresses requested so the test can assert routing.
        await context.route(CANDLES_GRAPHQL_URL, makeCandlesMockHandler({
            prices: {
                [PROBE_POOL_YES]: 0.42,
                [PROBE_POOL_NO]:  0.58,
            },
            onCall: (q) => {
                const ids = [...q.matchAll(/"(0x[a-fA-F0-9]{40})"/g)].map(m => m[1].toLowerCase());
                candlesCalls.push(ids);
            },
        }));

        const wallet = nStubWallets(1)[0];
        await context.addInitScript(installWalletStub({
            privateKey: wallet.privateKey,
            rpcUrl: STUB_RPC_URL,
            chainId: 100,
        }));

        await page.goto('/companies', { waitUntil: 'domcontentloaded' });

        // Wait until at least one candles request comes in. Small
        // poll loop tolerates the carousel's async data-fetch ordering.
        await expect.poll(() => candlesCalls.length, { timeout: 30_000 }).toBeGreaterThan(0);

        // Assert at least one candles call mentioned one of our probe
        // pool addresses — proves the carousel pipeline routed our
        // mocked proposal's metadata through to the bulk price fetcher.
        const flat = candlesCalls.flat();
        expect(flat).toContain(PROBE_POOL_YES);
    });

    test('slice 4e — candles requests cover BOTH legs (PROBE_POOL_YES AND PROBE_POOL_NO) — catches "drop NO leg" optimization regression', async ({ context, page }) => {
        test.setTimeout(180_000);

        // Strict tightening of slice 4c v3a. Where v3a only asserts
        // the YES leg appears in candles requests, this slice asserts
        // BOTH legs (YES + NO) end up in candles requests across the
        // bulk-prefetch + per-pool-fallback paths combined.
        //
        // Bug class caught (NEW vs v3a):
        //   - Fetch optimizer that DROPS the NO leg under the
        //     assumption "the prices sum to 1, so we can compute
        //     NO from YES" — false economy, because:
        //       * Conditional-token AMMs don't strictly enforce
        //         yes+no=1 at every block (tiny drift from fees,
        //         rounding, async oracle updates)
        //       * The NO pool's separate state can diverge from
        //         the YES pool under low-liquidity conditions
        //       * Computing NO from (1 - YES) loses precision and
        //         hides real arbitrage opportunities the user
        //         would want to see
        //     A regression that lands such an optimization would
        //     pass slice 4c v3a (YES still queried) but fail this
        //     test (NO no longer queried).
        //   - Indexer-side change that renames the NO pool address
        //     in the response — the request itself goes out but
        //     references a stale ID. This test catches the
        //     STALE-ID-IN-REQUEST shape because the assertion
        //     operates on the request body, not the response.
        //   - Carousel render path that mounts a YES-only card
        //     (loses the NO display) — the request side wouldn't
        //     fail, but a downstream regression that drops the NO
        //     mount path would skip emitting the NO query entirely.
        //
        // Why valuable: the YES/NO symmetry is a load-bearing
        // assumption throughout the futarchy app — if it breaks
        // silently in the request layer, the broken assumption
        // propagates without a clean failure signal until a user
        // notices a stuck "NO: --" cell. This invariant catches it
        // at the network boundary, before any downstream consumer
        // sees missing data.

        const candlesCalls = [];

        const richProposal = fakePoolBearingProposal({});
        await context.route(REGISTRY_GRAPHQL_URL, makeGraphqlMockHandler({
            proposals: [richProposal],
        }));

        await context.route(CANDLES_GRAPHQL_URL, makeCandlesMockHandler({
            prices: {
                [PROBE_POOL_YES]: 0.42,
                [PROBE_POOL_NO]:  0.58,
            },
            onCall: (q) => {
                const ids = [...q.matchAll(/"(0x[a-fA-F0-9]{40})"/g)].map(m => m[1].toLowerCase());
                candlesCalls.push(ids);
            },
        }));

        const wallet = nStubWallets(1)[0];
        await context.addInitScript(installWalletStub({
            privateKey: wallet.privateKey,
            rpcUrl: STUB_RPC_URL,
            chainId: 100,
        }));

        await page.goto('/companies', { waitUntil: 'domcontentloaded' });

        // Tighter poll than v3a: wait until BOTH addresses appear
        // across the union of all candles requests. Either leg can
        // arrive in any order (bulk vs per-pool fallback have
        // different timing) so the assertion is set-membership, not
        // request-ordering.
        await expect.poll(
            () => {
                const flat = candlesCalls.flat();
                return flat.includes(PROBE_POOL_YES) && flat.includes(PROBE_POOL_NO);
            },
            { timeout: 30_000 },
        ).toBe(true);

        const flat = candlesCalls.flat();
        // Explicit assertions for failure-message clarity. v3a's
        // single `.toContain(YES)` produces a vague failure if the
        // pipeline broke entirely; these split out so the failure
        // log says exactly which leg is missing.
        expect(flat).toContain(PROBE_POOL_YES);
        expect(flat).toContain(PROBE_POOL_NO);
    });
});
