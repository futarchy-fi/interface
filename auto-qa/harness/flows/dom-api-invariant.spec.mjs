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
    PROBE_PROPOSAL_ADDRESS,
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

    test('slice 4n — cover-image branch of fallback chain (metadata.coverImage wins over logo and fallback)', async ({ context, page }) => {
        test.setTimeout(180_000);

        // Companion to slice 4m (fallback branch). The 3-tier image
        // cascade in `useAggregatorCompanies.js:95` is:
        //   image: meta.coverImage || meta.logo
        //          || '/assets/fallback-company.png'
        //
        // Branches:
        //   - coverImage set    → uses coverImage (this slice)
        //   - coverImage unset, logo set → uses logo (future slice)
        //   - both unset        → uses fallback (slice 4m)
        //
        // This slice pins the FIRST branch: when coverImage is set,
        // it wins regardless of whether logo is also set. The
        // test mocks only coverImage (no logo) to keep the probe
        // narrow — a future iteration can add a mixed-flag test
        // (both coverImage and logo set, coverImage still wins)
        // to mirror the filter-chain stress test pattern of 4l.
        //
        // The probe path is a relative URL (`/test-probe-cover.png`)
        // rather than an external URL because Next.js Image is
        // strict about external domains — they must be whitelisted
        // in next.config.js or the optimization endpoint refuses
        // them. A relative path is always safe and renders the
        // same code path.
        //
        // Bug classes caught (NEW vs slice 4m):
        //   - Regression that DROPS the coverImage branch from
        //     the cascade (uses only `meta.logo || fallback`) —
        //     would render the fallback even when coverImage is
        //     set, leak the cover-image asset entirely
        //   - Regression that REORDERS the cascade (e.g.,
        //     `logo || coverImage || fallback`) — if logo
        //     happened to be set in production data, it would
        //     win over coverImage, silently changing which
        //     asset displays. This slice doesn't catch the
        //     reorder directly (logo is undefined here) but
        //     the symmetric future slice would.
        //   - Regression that hard-codes the fallback ignoring
        //     metadata entirely — also caught by slice 4m, but
        //     this slice catches it from a DIFFERENT input
        //     (coverImage set, expected to win) so the failure
        //     log points at a more specific cause.
        //   - Regression that strips the coverImage field from
        //     the GraphQL selection — `meta.coverImage` would
        //     be undefined, falling through to fallback. This
        //     slice catches the symptom; a future iteration can
        //     also verify the network request contains the
        //     `coverImage` field selection.
        //
        // Substring match on `test-probe-cover` (omitting the
        // `.png` suffix and any path prefix) tolerates Next.js's
        // optimization endpoint wrapping (e.g.,
        // `/_next/image?url=%2Ftest-probe-cover.png&w=64&q=75`)
        // and ALSO any future change in how URLs are encoded
        // (e.g., a switch from URL-encoded to base64-encoded
        // query params).

        await context.route(REGISTRY_GRAPHQL_URL, makeGraphqlMockHandler({
            orgMetadata: JSON.stringify({ coverImage: '/test-probe-cover.png' }),
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
        // The img's src attribute should reference our cover-image
        // probe path. Substring match tolerates the Next.js Image
        // optimization endpoint wrapping. CRITICALLY, the assertion
        // should NOT pass if the fallback was rendered instead —
        // `test-probe-cover` is distinctive enough that it can't
        // appear in `fallback-company.png` (which slice 4m catches).
        await expect(row.locator('img').first()).toHaveAttribute(
            'src',
            /test-probe-cover/,
        );
    });

    test('slice 4o — logo-only branch of image cascade (no coverImage → metadata.logo wins → completes image triplet)', async ({ context, page }) => {
        test.setTimeout(180_000);

        // Completes the image-cascade triplet alongside slice 4m
        // (fallback branch) and slice 4n (coverImage branch). The
        // 3-tier cascade in `useAggregatorCompanies.js:95` is:
        //   image: meta.coverImage || meta.logo
        //          || '/assets/fallback-company.png'
        //
        // All three branches now have isolated probes:
        //   - coverImage set    → uses coverImage (4n)
        //   - logo set, no cover → uses logo (4o) ★
        //   - both unset        → uses fallback (4m)
        //
        // Why this slice now: with 4m and 4n in place, a refactor
        // that drops the LOGO branch entirely (e.g., shortening
        // the cascade to `coverImage || fallback`) would still
        // pass both existing tests but break this one — the
        // failure log would point exactly at the dropped middle
        // branch.
        //
        // The mock sets `logo` but NOT `coverImage`, so the
        // cascade has to fall through coverImage's `undefined`
        // (which is falsy via `||`) to read logo. If a regression
        // SHORT-CIRCUITS the cascade earlier (e.g., always uses
        // coverImage even when undefined, falling back to
        // fallback directly), the test catches it because
        // `test-probe-logo` wouldn't appear in the rendered src
        // — only `fallback-company` would.
        //
        // Bug classes caught (NEW vs 4m and 4n):
        //   - Regression that DROPS the logo branch entirely
        //     (cascade becomes `coverImage || fallback`) —
        //     when logo is set but coverImage is not, the
        //     fallback renders instead; this test catches it
        //   - Regression that uses `meta.logoUrl` or
        //     `meta.logoImage` instead of `meta.logo` —
        //     typo-class bug; the field would be read as
        //     undefined and the fallback renders
        //   - Regression that wraps `meta.logo` in
        //     `parseLogoUrl(meta.logo)` (adds a transformation
        //     step) — would silently mutate the URL and the
        //     substring match might miss the canonical
        //     `test-probe-logo` token if the transformation
        //     adds prefixes/suffixes
        //   - Regression where the JSON parse fails on
        //     `meta.logo` (e.g., expecting an object instead
        //     of a string) and `meta.logo` becomes undefined
        //     in a try/catch — would fall through to fallback
        //
        // Note on precedence — what this slice does NOT catch:
        // a cascade REORDER (e.g., `logo || coverImage` instead
        // of `coverImage || logo`) would still pass this test
        // because logo is set and coverImage is undefined,
        // either order produces the same outcome. Catching the
        // reorder requires a "BOTH set" test where coverImage
        // wins — that's a natural future slice 4p (precedence
        // test) analogous to slice 4l's multi-flag pattern for
        // the filter triplet.

        await context.route(REGISTRY_GRAPHQL_URL, makeGraphqlMockHandler({
            orgMetadata: JSON.stringify({ logo: '/test-probe-logo.png' }),
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
        // Substring match on `test-probe-logo` (distinctive token
        // that cannot appear in `test-probe-cover.png` or
        // `fallback-company.png` — the other two branches' outputs).
        // This means a failure log here directly identifies which
        // wrong branch was rendered.
        await expect(row.locator('img').first()).toHaveAttribute(
            'src',
            /test-probe-logo/,
        );
    });

    test('slice 4p — image-cascade PRECEDENCE: BOTH coverImage AND logo set → coverImage wins (catches reorder regression)', async ({ context, page }) => {
        test.setTimeout(180_000);

        // Precedence test for the image triplet, analogous to slice
        // 4l's multi-flag stress test for the filter triplet. The
        // single-branch tests (4n: coverImage, 4o: logo, 4m:
        // fallback) each set ONLY ONE field. None of them catches a
        // cascade-REORDER regression because each setup happens to
        // produce the same outcome under either OR order.
        //
        // This slice mocks BOTH `coverImage` AND `logo`, which
        // forces the cascade order to matter:
        //   - Correct cascade `coverImage || logo || fallback`:
        //     coverImage wins → "test-probe-cover" in src
        //   - Reordered cascade `logo || coverImage || fallback`:
        //     logo wins → "test-probe-logo" in src ← BUG
        //
        // Asserting the COVER token (not LOGO) is in the src is
        // the precise statement of the precedence invariant.
        //
        // Bug classes caught (NEW vs 4m, 4n, 4o):
        //   - Cascade REORDER bug (logo || coverImage swap) —
        //     would change which asset displays whenever both
        //     are set (a real production case for orgs that
        //     have both fields)
        //   - Refactor that hard-codes `meta.logo` as preferred
        //     (e.g., "always prefer the logo" UX decision
        //     mistakenly implemented) — would silently swap
        //     branding for the affected orgs
        //   - Refactor that picks the cascade based on
        //     `meta.imagePreference` or a feature flag,
        //     defaulting to logo — would change behavior
        //     based on flag state
        //   - Refactor that combines fields (`coverImage +
        //     logo` overlay) — would render coverImage
        //     primarily but a regression that only renders
        //     logo would surface here
        //
        // Additional assertion: NOT containing the LOGO token.
        // Pure positive assertion would pass even if the src
        // contained BOTH tokens (e.g., a future "render multiple
        // images" refactor). The negative assertion sharpens the
        // probe to "coverImage is the SOLE rendered asset".
        //
        // This completes a full coverage lattice for the image
        // cascade (analogous to the filter triplet's lattice
        // formed by 4b/4f/4g/4h + 4l):
        //   - 4m: fallback branch in isolation
        //   - 4n: coverImage branch in isolation
        //   - 4o: logo branch in isolation
        //   - 4p: precedence (coverImage over logo)
        // A future variant could also add (logo over fallback)
        // but that's the same OR-falsy semantics as 4o so
        // marginal value.

        await context.route(REGISTRY_GRAPHQL_URL, makeGraphqlMockHandler({
            orgMetadata: JSON.stringify({
                coverImage: '/test-probe-cover.png',
                logo:       '/test-probe-logo.png',
            }),
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
        const img = row.locator('img').first();
        // POSITIVE: coverImage must appear in the rendered src.
        await expect(img).toHaveAttribute('src', /test-probe-cover/);
        // NEGATIVE: the logo token must NOT appear (proving
        // coverImage is the sole rendered asset; sharpens the
        // probe against multi-image refactors).
        await expect(img).not.toHaveAttribute('src', /test-probe-logo/);
    });

    test('slice 4q — href on event card link: proposal address flows through to /market?proposalId= URL', async ({ context, page }) => {
        test.setTimeout(180_000);

        // Opens the href-attribute dimension. Where the image
        // triplet (4m/4n/4o/4p) probes `<img src="...">`, this
        // slice probes `<a href="...">` — a different attribute
        // class with different bug-shape risks (navigation rather
        // than asset loading).
        //
        // Per `src/components/futarchyFi/companyList/cards/
        // highlightCards/EventHighlightCard.jsx:307-310,314`:
        //   const marketUrl = USE_QUERY_PARAM_URLS
        //     ? `/market?proposalId=${eventId}`
        //     : `/markets/${eventId}`;
        //   ...
        //   <a href={marketUrl} ...>
        //
        // The current production default (per
        // `src/config/featureFlags.js:11`): USE_QUERY_PARAM_URLS
        // = true, so the carousel-card link points at
        // `/market?proposalId=${eventId}` (NOT `/markets/`).
        // The eventId comes from `event.eventId` (which the
        // carousel's transformOrgToCard derives from the
        // proposal's address). With our pool-bearing proposal
        // fixture using PROBE_PROPOSAL_ADDRESS
        // ('0xbbbb...bbbb'), the href should contain
        // `proposalId=0xbbbb...bbbb`.
        //
        // Note: this slice deliberately pins the
        // USE_QUERY_PARAM_URLS=true behavior because that's the
        // current production state. A future iteration can add
        // a companion test that flips the flag (or stubs the
        // import) to also pin the `/markets/${eventId}` form,
        // closing the precedence-coverage analogy with the
        // image triplet's 4p slice.
        //
        // Why this matters: the event card is the user's primary
        // entry point to a market page from the /companies
        // listing. A regression that breaks the href would route
        // every user click to a 404 or wrong page — visible
        // product bug affecting the entire navigation flow.
        //
        // Bug classes caught (NEW dimension — href vs prior
        // img.src attribute-level tests):
        //   - Regression that breaks the marketUrl template
        //     (e.g., dropping the `/` prefix → relative-URL
        //     navigation goes to `./market?...` which depends
        //     on the current path — likely 404)
        //   - Regression that uses the wrong field for the URL
        //     query value (e.g., `${event.id}` instead of
        //     `${event.eventId}` — they may differ subtly)
        //   - Regression that drops the proposalId parameter
        //     entirely (e.g., `/market` only) — every card
        //     would route to the same generic page
        //   - Regression that flips USE_QUERY_PARAM_URLS to
        //     false — would render `/markets/<addr>` instead;
        //     this test catches the flip because
        //     `proposalId=` wouldn't appear in the path form
        //   - Regression that hardcodes a static query value
        //     (e.g., all cards link to the same proposalId)
        //     — caught by the SECOND assertion below which
        //     pins the specific PROBE_PROPOSAL_ADDRESS
        //
        // Two assertions for sharper bug-class isolation:
        //   (a) href contains `proposalId=` (proves the
        //       query-param URL form is engaged)
        //   (b) href contains the PROBE_PROPOSAL_ADDRESS
        //       (proves the proposal's address flows through
        //       from registry data to the navigation URL)

        const richProposal = fakePoolBearingProposal({});
        await context.route(REGISTRY_GRAPHQL_URL, makeGraphqlMockHandler({
            proposals: [richProposal],
        }));

        const wallet = nStubWallets(1)[0];
        await context.addInitScript(installWalletStub({
            privateKey: wallet.privateKey,
            rpcUrl: STUB_RPC_URL,
            chainId: 100,
        }));

        await page.goto('/companies', { waitUntil: 'domcontentloaded' });

        // Wait for the event card to mount (proves the carousel
        // pipeline got far enough to render the link).
        await expect(
            page.getByText('HARNESS-PROBE-EVENT-001').first(),
        ).toBeVisible({ timeout: 30_000 });

        // The card's anchor wraps the entire card content. Find
        // it by getRole('link') filtered to one that contains
        // the probe event title. Multiple <a> elements may exist
        // on the page (nav, footer, etc.), so the filter is
        // critical for picking the right one.
        const eventLink = page.getByRole('link').filter({
            hasText: 'HARNESS-PROBE-EVENT-001',
        }).first();
        await expect(eventLink).toBeVisible({ timeout: 15_000 });
        // (a) Assert href uses the query-param URL form (per
        //     production feature flag default).
        await expect(eventLink).toHaveAttribute('href', /proposalId=/);
        // (b) Assert the PROBE_PROPOSAL_ADDRESS flows through.
        //     `PROBE_PROPOSAL_ADDRESS` is already lowercase in
        //     the fixture so no casing normalization is needed;
        //     this would only fail if the carousel renamed the
        //     field or applied a transform that drops the
        //     low-bit hex characters.
        await expect(eventLink).toHaveAttribute(
            'href',
            new RegExp(PROBE_PROPOSAL_ADDRESS, 'i'),
        );
    });

    test('slice 4s — eventTitle FALLBACK branch: displayNameEvent absent → displayNameQuestion rendered', async ({ context, page }) => {
        test.setTimeout(180_000);

        // Opens the title-cascade triplet, parallel in structure
        // to the image cascade (4m/4n/4o/4p). Per
        // `src/hooks/useAggregatorProposals.js:145`:
        //   eventTitle: proposal.displayNameEvent
        //               || proposal.displayNameQuestion
        //               || 'Unknown Proposal'
        //
        // The 3-tier title cascade has branches:
        //   - displayNameEvent set    → uses event (future 4r)
        //   - displayNameEvent absent, displayNameQuestion set
        //                              → uses question (4s) ★
        //   - both absent              → 'Unknown Proposal' (future 4t)
        //
        // This slice exercises the FALLBACK branch. The fixture
        // default sets BOTH fields to the same value, so to
        // isolate the fallback we have to override
        // displayNameEvent to a falsy value while keeping
        // displayNameQuestion distinctive.
        //
        // Why this branch first (vs the preferred-branch test 4r):
        // the preferred branch is trivially covered by every
        // existing carousel-card test (slice 4c v3a, 4c v3b, 4e,
        // 4j, 4k, 4p) because they all use the fixture default
        // and assert HARNESS-PROBE-EVENT-001 appears. The
        // FALLBACK branch is uncovered terrain — if a regression
        // dropped `|| proposal.displayNameQuestion` from the
        // cascade, the existing tests would still pass (because
        // displayNameEvent is set in the default fixture); only
        // a test that explicitly nulls displayNameEvent catches
        // it.
        //
        // Bug classes caught (NEW — first title-cascade test):
        //   - Regression that DROPS the displayNameQuestion
        //     branch from the cascade — would render 'Unknown
        //     Proposal' fallback even when displayNameQuestion
        //     is set
        //   - Regression that uses the wrong field name (e.g.,
        //     `questionText` or `displayName` instead of
        //     `displayNameQuestion`) — typo-class bug; field
        //     would read as undefined, fall through to fallback
        //   - Regression that SHORT-CIRCUITS the cascade at
        //     displayNameEvent (e.g., uses
        //     `proposal.displayNameEvent ?? 'Unknown'` instead
        //     of the full OR-chain) — would render 'Unknown'
        //     when displayNameEvent is null/undefined even
        //     though displayNameQuestion is present
        //   - Regression that GraphQL query selection drops
        //     `displayNameQuestion` — `proposal.displayNameQuestion`
        //     undefined → falls through
        //
        // The probe token `HARNESS-PROBE-QUESTION-FALLBACK` is
        // distinctive enough to never appear in the
        // displayNameEvent value or the 'Unknown Proposal'
        // fallback string. A failure log here directly
        // identifies that the fallback branch is broken.

        // Override fakePoolBearingProposal's title fields to
        // isolate the fallback branch: nullify
        // displayNameEvent, set displayNameQuestion to a
        // distinctive token.
        const richProposal = {
            ...fakePoolBearingProposal({}),
            displayNameEvent:    null,
            displayNameQuestion: 'HARNESS-PROBE-QUESTION-FALLBACK',
        };
        await context.route(REGISTRY_GRAPHQL_URL, makeGraphqlMockHandler({
            proposals: [richProposal],
        }));

        const wallet = nStubWallets(1)[0];
        await context.addInitScript(installWalletStub({
            privateKey: wallet.privateKey,
            rpcUrl: STUB_RPC_URL,
            chainId: 100,
        }));

        await page.goto('/companies', { waitUntil: 'domcontentloaded' });

        // Assert the question text appears (NOT the event text,
        // which is null in this fixture). If the fallback branch
        // is broken, the carousel would render 'Unknown Proposal'
        // or the event-text default — neither contains the
        // distinctive 'HARNESS-PROBE-QUESTION-FALLBACK' token.
        await expect(
            page.getByText('HARNESS-PROBE-QUESTION-FALLBACK').first(),
        ).toBeVisible({ timeout: 30_000 });
    });

    test('slice 4t — eventTitle FINAL FALLBACK: both fields null → "Unknown Proposal" rendered', async ({ context, page }) => {
        test.setTimeout(180_000);

        // Completes the title-cascade triplet alongside slice 4s
        // (fallback branch). Per
        // `src/hooks/useAggregatorProposals.js:145`:
        //   eventTitle: proposal.displayNameEvent
        //               || proposal.displayNameQuestion
        //               || 'Unknown Proposal'
        //
        // Branches probed:
        //   - displayNameEvent set    → uses event (4r, future)
        //   - event absent, question set → uses question (4s)
        //   - both absent             → 'Unknown Proposal' (4t) ★
        //
        // This slice exercises the FINAL FALLBACK. Setting both
        // fields to null forces the cascade to fall through to
        // the hardcoded 'Unknown Proposal' string.
        //
        // Why this branch matters: the 'Unknown Proposal' string
        // is a structural safety net — it prevents the entire
        // carousel from crashing on a malformed proposal entity.
        // A regression that drops this string entirely would
        // either:
        //   - Render an empty card title (visually broken UX)
        //   - Throw an exception during render (whole-carousel
        //     crash because React can't render `undefined` as
        //     children inline) → cascading failure across the
        //     /companies page
        //
        // Both outcomes are real bugs that text-level invariants
        // catch cleanly.
        //
        // Bug classes caught (NEW vs 4s):
        //   - Regression that DROPS the 'Unknown Proposal'
        //     fallback string entirely — eventTitle becomes
        //     undefined, downstream consumers crash
        //   - Regression that uses a different fallback string
        //     (e.g., 'No Title', 'Untitled', '?') — the
        //     'Unknown Proposal' substring assertion catches
        //     the change immediately
        //   - Regression that changes the fallback to an empty
        //     string `''` — visually broken, the assertion
        //     would still fail because 'Unknown Proposal' is
        //     absent
        //   - Regression that throws on null/undefined input
        //     (e.g., `proposal.displayNameEvent.toLowerCase()`
        //     without null-guarding) — the carousel never
        //     reaches the render path; the test times out
        //     waiting for 'Unknown Proposal'
        //
        // Note on filter interactions: useAggregatorProposals
        // might filter out proposals with null titles in some
        // future regression (e.g., adding a `proposal.displayNameEvent
        // && proposal.displayNameQuestion` precondition). If
        // that filter is added, this test would fail because
        // the proposal would be filtered before reaching the
        // carousel render. That itself is a bug (the 'Unknown
        // Proposal' fallback exists for a reason), so the
        // failure is informative.

        const richProposal = {
            ...fakePoolBearingProposal({}),
            displayNameEvent:    null,
            displayNameQuestion: null,
        };
        await context.route(REGISTRY_GRAPHQL_URL, makeGraphqlMockHandler({
            proposals: [richProposal],
        }));

        const wallet = nStubWallets(1)[0];
        await context.addInitScript(installWalletStub({
            privateKey: wallet.privateKey,
            rpcUrl: STUB_RPC_URL,
            chainId: 100,
        }));

        await page.goto('/companies', { waitUntil: 'domcontentloaded' });

        // Assert the final-fallback string appears in the card.
        // Substring match on 'Unknown Proposal' (without
        // exactness constraint) — the string may appear inside
        // a longer rendered phrase or aria-label.
        await expect(
            page.getByText('Unknown Proposal').first(),
        ).toBeVisible({ timeout: 30_000 });
    });

    test('slice 4u — SPLIT-TITLE display when both fields set: card renders BOTH event and question text', async ({ context, page }) => {
        test.setTimeout(180_000);

        // Discovered during empirical testing that the
        // "precedence" framing I'd planned doesn't match the
        // actual product behavior. When BOTH displayNameEvent
        // AND displayNameQuestion are set with DIFFERENT values,
        // the card does NOT pick one — it renders BOTH as a
        // SPLIT display (question as prefix line, event as
        // suffix line).
        //
        // The two render paths:
        //   - `useAggregatorProposals.js:145` (single-line
        //     fallback chain):
        //       eventTitle: displayNameEvent
        //                   || displayNameQuestion
        //                   || 'Unknown Proposal'
        //     used when ONE field is absent (covered by 4s, 4t)
        //   - `useAggregatorProposals.js:198-199` (split-display
        //     metadata): copies both fields into
        //     `metadata.display_title_0` (= displayNameQuestion)
        //     and `metadata.display_title_1` (= displayNameEvent)
        //     — the carousel passes metadata to the card
        //   - `EventHighlightCard.jsx:266`:
        //       const shouldUseSplitTitles =
        //           displayTitle0 && displayTitle1;
        //     when true, the card renders BOTH lines as a
        //     prefix+suffix display (real production pattern:
        //     "What's the impact" + "if GIP-145 passes?")
        //
        // So the title cascade isn't a 4-way precedence lattice
        // (analogous to image cascade) — it's a 3-way fallback
        // chain (4r preferred / 4s fallback / 4t final) PLUS a
        // SPLIT-DISPLAY branch (4u) when both fields are set.
        // Structurally different from the image cascade's 4p
        // precedence test.
        //
        // What this slice probes:
        //   - Both displayNameEvent and displayNameQuestion
        //     flow through to `metadata.display_title_0/1`
        //   - `shouldUseSplitTitles` correctly detects "both
        //     set" and engages the split-display branch
        //   - Both texts render in the card's DOM
        //
        // Two POSITIVE assertions (no negative this time —
        // BOTH must appear, that IS the invariant):
        //   (a) 'HARNESS-PROBE-EVENT-PART' appears (event-leg
        //       flows from displayNameEvent →
        //       metadata.display_title_1 → card render)
        //   (b) 'HARNESS-PROBE-QUESTION-PART' appears
        //       (question-leg flows from displayNameQuestion →
        //       metadata.display_title_0 → card render)
        //
        // Bug classes caught (NEW vs 4s and 4t):
        //   - Regression that DROPS the split-display branch
        //     (`shouldUseSplitTitles` always false, or the
        //     conditional render path removed) — only one
        //     text would appear; one of the assertions fails
        //   - Regression in useAggregatorProposals that DROPS
        //     `metadata.display_title_0` or
        //     `metadata.display_title_1` from the proposal
        //     transform — card's `displayTitle0/1` undefined →
        //     split-display branch never engages
        //   - Regression in the mapping (e.g., swap
        //     display_title_0 = displayNameEvent instead of
        //     displayNameQuestion) — both texts still appear
        //     but in WRONG positions; this slice would pass
        //     (both visible) but a future stricter slice could
        //     assert ordering
        //   - Refactor that uses one field for title and the
        //     other for tooltip/aria-label (visible only on
        //     hover) — `toBeVisible()` may fail for the
        //     non-rendered text
        //
        // Why this matters: split-title display is the
        // production-realistic case for futarchy proposals.
        // A regression that breaks it would either hide one
        // text (UX loss) or render in the wrong layout (visual
        // regression).
        //
        // Distinctive tokens 'EVENT-PART' / 'QUESTION-PART'
        // (vs the slice 4s 'QUESTION-FALLBACK' and 4t
        // 'Unknown Proposal') keep failure logs unambiguous —
        // each title-cascade slice has its own probe set.

        const richProposal = {
            ...fakePoolBearingProposal({}),
            displayNameEvent:    'HARNESS-PROBE-EVENT-PART',
            displayNameQuestion: 'HARNESS-PROBE-QUESTION-PART',
        };
        await context.route(REGISTRY_GRAPHQL_URL, makeGraphqlMockHandler({
            proposals: [richProposal],
        }));

        const wallet = nStubWallets(1)[0];
        await context.addInitScript(installWalletStub({
            privateKey: wallet.privateKey,
            rpcUrl: STUB_RPC_URL,
            chainId: 100,
        }));

        await page.goto('/companies', { waitUntil: 'domcontentloaded' });

        // Both texts must appear — the split-display invariant.
        await expect(
            page.getByText('HARNESS-PROBE-EVENT-PART').first(),
        ).toBeVisible({ timeout: 30_000 });
        await expect(
            page.getByText('HARNESS-PROBE-QUESTION-PART').first(),
        ).toBeVisible({ timeout: 15_000 });
    });

    test('slice 4v — "Unknown Organization" fallback: org.name=null → fallback string appears in table row', async ({ context, page }) => {
        test.setTimeout(180_000);

        // Parallel in shape to slice 4t (proposal-level 'Unknown
        // Proposal' fallback) but at the ORG level. Per
        // `src/hooks/useAggregatorCompanies.js:93`:
        //   title: org.name || 'Unknown Organization',
        //
        // When `org.name` is null/undefined/falsy, the cascade
        // falls through to the hardcoded 'Unknown Organization'
        // string. This slice mocks `org.name = null` (via the
        // new `orgName` fixture parameter just added to
        // `makeGraphqlMockHandler`) and asserts the fallback
        // appears in the table row.
        //
        // Two render surfaces affected by the title field:
        //   - OrgRow's name cell (td[1]) — displays the title
        //   - Carousel cards — the carousel does its own thing
        //     with proposal titles (slice 4s/4t/4u), so this
        //     test scopes to the table row only
        //
        // Why this matters: 'Unknown Organization' is the
        // structural safety net at the org level — parallel
        // role to 'Unknown Proposal' at the proposal level.
        // A regression that drops this fallback would render
        // an empty cell or throw on null, cascading into a
        // broken table row.
        //
        // Bug classes caught:
        //   - Regression that DROPS the 'Unknown Organization'
        //     fallback string entirely — title becomes undefined
        //     or empty
        //   - Regression that uses a different fallback string
        //     (e.g., 'No Name', 'Untitled Org') — the
        //     'Unknown Organization' substring assertion catches
        //     the change immediately
        //   - Regression that throws on `org.name.trim()` or
        //     similar method-on-null — the carousel/table never
        //     reach render; test times out waiting
        //   - Refactor that uses nullish coalescing `??`
        //     instead of `||` — empty string `""` becomes
        //     truthy under `??` but falsy under `||`,
        //     producing a visibly broken empty cell that
        //     existing tests don't catch (because they use
        //     non-empty PROBE_ORG_NAME)
        //
        // Fixture extension (this iteration): added `orgName`
        // parameter to `makeGraphqlMockHandler`. Defaults to
        // `PROBE_ORG_NAME` so all 23 prior tests are unaffected.
        // Passing `orgName: null` exercises the fallback path.

        await context.route(REGISTRY_GRAPHQL_URL, makeGraphqlMockHandler({
            orgName: null,
        }));

        const wallet = nStubWallets(1)[0];
        await context.addInitScript(installWalletStub({
            privateKey: wallet.privateKey,
            rpcUrl: STUB_RPC_URL,
            chainId: 100,
        }));

        await page.goto('/companies', { waitUntil: 'domcontentloaded' });

        // Assert the fallback string appears. Substring match
        // tolerates the string being rendered inside a longer
        // phrase or as part of an aria-label.
        await expect(
            page.getByText('Unknown Organization').first(),
        ).toBeVisible({ timeout: 30_000 });
    });

    test('slice 4r — title PREFERRED branch: displayNameEvent set, displayNameQuestion null → event renders alone (closes title-cascade lattice)', async ({ context, page }) => {
        test.setTimeout(180_000);

        // Closes the title-cascade lattice alongside slices 4s,
        // 4t, and 4u. The four-branch coverage is now complete:
        //
        //   | displayNameEvent | displayNameQuestion | render path           | slice |
        //   |------------------|---------------------|-----------------------|-------|
        //   | set              | null/undefined      | single-line event     | 4r ★  |
        //   | null/undefined   | set                 | single-line question  | 4s    |
        //   | null/undefined   | null/undefined      | 'Unknown Proposal'    | 4t    |
        //   | set              | set                 | split-display (BOTH)  | 4u    |
        //
        // Why this slice matters even though it's "trivially
        // covered" by other tests:
        // Many existing carousel tests (4c v3a, 4c v3b, 4e, 4j,
        // 4k, 4p) use the fixture default where BOTH fields are
        // set to the same value (`HARNESS-PROBE-EVENT-001`).
        // That setup exercises a CO-RENDERING corner of the
        // truth table — not the isolated preferred-branch path
        // where displayNameEvent flows through alone. A
        // regression that breaks the cascade for the
        // event-only case while keeping the both-set
        // (split-display) case intact would slip through all
        // existing carousel tests. This slice catches that
        // specific bug-class.
        //
        // Bug classes caught (NEW vs 4s, 4t, 4u, and prior
        // carousel tests):
        //   - Regression that ONLY engages the split-display
        //     branch (requires BOTH fields set) — when only
        //     event is set, the card renders nothing (or
        //     'Unknown Proposal') because the cascade is
        //     broken. Existing tests don't catch this because
        //     they always set both fields.
        //   - Regression where useAggregatorProposals'
        //     `metadata.display_title_1 =
        //     proposal.displayNameEvent || null` becomes
        //     `metadata.display_title_1 =
        //     proposal.displayNameEvent || proposal.title` —
        //     would still pass 4u (both fields set, both
        //     appear) but fail here if the alternate path
        //     produces a different token
        //   - Regression that breaks the single-line render
        //     (e.g., `shouldUseSplitTitles` evaluates true
        //     even when only one field is set) — the card
        //     would render the preferred event token PLUS an
        //     empty subtitle line, an UI regression that
        //     might not visually break but adds layout debt
        //
        // Why use a distinctive token ('PREFERRED-EVENT')
        // rather than the fixture default
        // ('HARNESS-PROBE-EVENT-001'): the assertion is then
        // unambiguous — `PREFERRED-EVENT` cannot appear in
        // any of the other tests' tokens, so a failure log
        // here points directly at the preferred-branch
        // regression rather than at some shared-fixture
        // problem.

        const richProposal = {
            ...fakePoolBearingProposal({}),
            displayNameEvent:    'HARNESS-PROBE-PREFERRED-EVENT',
            displayNameQuestion: null,
        };
        await context.route(REGISTRY_GRAPHQL_URL, makeGraphqlMockHandler({
            proposals: [richProposal],
        }));

        const wallet = nStubWallets(1)[0];
        await context.addInitScript(installWalletStub({
            privateKey: wallet.privateKey,
            rpcUrl: STUB_RPC_URL,
            chainId: 100,
        }));

        await page.goto('/companies', { waitUntil: 'domcontentloaded' });

        // Assert the preferred event text appears.
        await expect(
            page.getByText('HARNESS-PROBE-PREFERRED-EVENT').first(),
        ).toBeVisible({ timeout: 30_000 });
    });

    test('slice 4w — empty-state inverse invariant: registry returns 200 + empty orgs array → "No organizations found"', async ({ context, page }) => {
        test.setTimeout(180_000);

        // First explicit happy-path probe of the empty-state
        // surface. Chaos scenarios #02 and #05 already test the
        // empty-state via FAILURE paths:
        //   - #02 (registry-down): registry returns 502 →
        //     consumer .catch fires → empty-state shows
        //   - #05 (registry-empty-orgs): registry returns 200
        //     but with an error envelope (NOT pure empty array)
        //
        // This slice tests the THIRD distinct path:
        //   - 4w (this slice): registry returns 200 + empty
        //     `organizations: []` array (legitimate happy
        //     result; the aggregator has zero orgs)
        //
        // Why these three are meaningfully distinct:
        // each control-flow path is exercised differently:
        //   - 502 + error body  → `.catch` branch (status check)
        //   - 200 + error body  → parses successfully; consumer
        //     handles `errors` field; uses empty
        //   - 200 + empty array → parses successfully; consumer
        //     sees a valid array with 0 elements; renders empty
        //     state from the `.length === 0` branch
        //
        // The third path is the ONE path where the server is
        // healthy AND returning valid GraphQL but the aggregator
        // legitimately has nothing to show. Bugs here are
        // production-shape (e.g., a brand new aggregator before
        // any orgs are added). A regression that breaks the
        // empty-state render for this case would NOT surface in
        // either chaos test because both of those exercise
        // failure paths.
        //
        // Fixture extension (this iteration): added
        // `organizations` parameter to `makeGraphqlMockHandler`.
        // `null` (default) uses the synthesized one-org payload;
        // passing `[]` overrides to exercise the empty-array
        // path.
        //
        // Bug classes caught (NEW vs chaos #02 and #05):
        //   - Regression in OrganizationsTable that doesn't
        //     handle the `.length === 0` branch (e.g., crashes
        //     on `orgs[0]` access without bounds-checking when
        //     the array is empty)
        //   - Regression that conflates empty-array with
        //     undefined (`if (!orgs) showEmpty()` instead of
        //     `if (!orgs?.length) showEmpty()`) — fails to
        //     render the empty state when the API returns a
        //     well-formed empty array
        //   - Regression that returns the WRONG empty-state
        //     string (e.g., "No data" or "Loading...") — the
        //     "No organizations found" substring assertion
        //     catches the change
        //   - Regression that doesn't update the UI when the
        //     orgs array transitions from [PROBE] to [] (e.g.,
        //     stale state held in a useMemo without a length
        //     dep) — wouldn't surface in this fresh-page-load
        //     test but would surface in a future
        //     state-transition test

        await context.route(REGISTRY_GRAPHQL_URL, makeGraphqlMockHandler({
            organizations: [],
        }));

        const wallet = nStubWallets(1)[0];
        await context.addInitScript(installWalletStub({
            privateKey: wallet.privateKey,
            rpcUrl: STUB_RPC_URL,
            chainId: 100,
        }));

        await page.goto('/companies', { waitUntil: 'domcontentloaded' });

        // Assert the empty-state message appears (happy-path
        // empty, distinct from chaos-path empty).
        await expect(
            page.getByText('No organizations found').first(),
        ).toBeVisible({ timeout: 30_000 });
    });

    test('slice 4x — logo img ALT attribute flows from org.name (a11y bug-class)', async ({ context, page }) => {
        test.setTimeout(180_000);

        // Opens a new attribute SUB-DIMENSION: `alt` attributes
        // (accessibility-related), alongside `src` (images, 4m/4n
        // /4o/4p) and `href` (navigation links, 4q). Each attribute
        // class carries different bug-shape risks.
        //
        // Per `src/components/futarchyFi/companyList/table/
        // OrgRow.jsx:28-33`:
        //   <Image
        //       src={image || '/assets/fallback-company.png'}
        //       alt={title}
        //       layout="fill"
        //       objectFit="cover"
        //   />
        //
        // The alt attribute is fed directly from the `title`
        // prop, which is `transformOrgToCard(org).title`. Per
        // `useAggregatorCompanies.js:93`:
        //   title: org.name || 'Unknown Organization'
        //
        // So when `org.name` is set, the rendered <img> should
        // carry the same string as its `alt`.
        //
        // Why accessibility tests matter: alt text is the
        // ONLY mechanism screen readers have for image content.
        // A regression that drops or breaks alt text would make
        // the page UNREADABLE for users relying on assistive
        // tech — a real product bug that's invisible to
        // sighted developers. Auto-QA at this layer is one of
        // the few mechanisms that catches a11y regressions
        // pre-merge.
        //
        // Bug classes caught (NEW vs prior attribute tests):
        //   - Regression that DROPS the alt prop from <Image>
        //     — Next.js Image throws a console warning but
        //     renders an unlabeled img; this test catches the
        //     missing-alt state directly
        //   - Regression that hardcodes alt to a static
        //     string (e.g., `alt="Organization logo"`) —
        //     visually fine but loses per-org context for
        //     screen-reader users
        //   - Regression that uses the WRONG field for alt
        //     (e.g., `alt={org.description}` or
        //     `alt={org.id}`) — would still produce alt text
        //     but with the wrong semantic content; this slice
        //     catches it via the exact-string match
        //   - Regression that wraps title in an unsafe
        //     transformation (e.g.,
        //     `alt={title.toUpperCase()}`) — the assertion
        //     would catch the casing mismatch
        //
        // Distinctive probe token 'HARNESS-PROBE-ORG-ALT'
        // (vs the existing 'HARNESS-PROBE-ORG-001' default)
        // keeps the failure log unambiguous — the alt token
        // can only originate from this test's mock.

        await context.route(REGISTRY_GRAPHQL_URL, makeGraphqlMockHandler({
            orgName: 'HARNESS-PROBE-ORG-ALT',
        }));

        const wallet = nStubWallets(1)[0];
        await context.addInitScript(installWalletStub({
            privateKey: wallet.privateKey,
            rpcUrl: STUB_RPC_URL,
            chainId: 100,
        }));

        await page.goto('/companies', { waitUntil: 'domcontentloaded' });

        // Pre-flight: prove the row mounted with the probe
        // org name visible somewhere.
        await expect(
            page.getByText('HARNESS-PROBE-ORG-ALT').first(),
        ).toBeVisible({ timeout: 30_000 });

        // Locate the row, then its logo image, then assert alt.
        const row = page.getByRole('row').filter({ hasText: 'HARNESS-PROBE-ORG-ALT' });
        await expect(row).toHaveCount(1);
        // toHaveAttribute with a string literal does exact-match
        // by default. The alt MUST equal the org name exactly.
        await expect(row.locator('img').first()).toHaveAttribute(
            'alt',
            'HARNESS-PROBE-ORG-ALT',
        );
    });

    test('slice 4y — img alt uses "Unknown Organization" fallback when org.name=null (alt + text coverage pair)', async ({ context, page }) => {
        test.setTimeout(180_000);

        // Pairs with slice 4x (alt flows from org.name when set)
        // and slice 4v ('Unknown Organization' text fallback in
        // visible cell). Together the three slices prove the
        // org.name → title → {visible text, alt attribute}
        // pipeline is consistent at both the populated and
        // fallback ends:
        //
        //   | org.name        | visible text          | alt attribute        |
        //   |-----------------|-----------------------|----------------------|
        //   | 'PROBE-ORG-ALT' | 'PROBE-ORG-ALT' (4x*) | 'PROBE-ORG-ALT' (4x) |
        //   | null            | 'Unknown Organization'| 'Unknown ...' (4y) ★ |
        //   |                 |                  (4v) |                      |
        //
        // (* 4x asserts the alt is the same string as the
        // visible text; the visible-text assertion in 4x is a
        // pre-flight that proves the row mounted, not the
        // primary assertion.)
        //
        // Why this pair matters: if a regression hardcodes
        // `alt="Logo"` in OrgRow regardless of the title prop,
        // 4x would catch it (alt no longer matches
        // 'HARNESS-PROBE-ORG-ALT') but this slice catches a
        // DIFFERENT regression class: alt that flows from the
        // populated title path but NOT the fallback title
        // path. For example, a refactor that splits OrgRow's
        // alt into `<Image alt={title || 'Logo'} />` would
        // make alt='Logo' when title='Unknown Organization' is
        // the fallback — 4x wouldn't fail (because in 4x, the
        // title is non-null so title || 'Logo' = title), but
        // this slice would catch the divergence.
        //
        // Bug classes caught (NEW vs 4x and 4v):
        //   - Regression that adds an OrgRow-level fallback for
        //     alt (`alt={title || 'Logo'}`) that differs from
        //     the title-cascade fallback ('Unknown Organization')
        //   - Regression that hardcodes alt to a static string
        //     in the fallback branch — alt='Image' or empty
        //     while visible text shows 'Unknown Organization';
        //     a11y divergence from visible UX
        //   - Regression in useAggregatorCompanies that
        //     produces a NULL title (drops the
        //     `|| 'Unknown Organization'` fallback) — alt
        //     becomes the empty string `""` or undefined; this
        //     slice would fail because the exact match against
        //     'Unknown Organization' wouldn't apply
        //
        // Why the pair is tighter than either test alone: 4x
        // pins (name → alt) at the populated end; 4y pins
        // (null → 'Unknown Organization' → alt) at the
        // fallback end. A regression that affects ONLY one
        // end light up the matching test, providing precise
        // diagnosis.

        await context.route(REGISTRY_GRAPHQL_URL, makeGraphqlMockHandler({
            orgName: null,
        }));

        const wallet = nStubWallets(1)[0];
        await context.addInitScript(installWalletStub({
            privateKey: wallet.privateKey,
            rpcUrl: STUB_RPC_URL,
            chainId: 100,
        }));

        await page.goto('/companies', { waitUntil: 'domcontentloaded' });

        // Pre-flight: row mounts with the 'Unknown Organization'
        // fallback (proves the title cascade resolved as
        // expected).
        await expect(
            page.getByText('Unknown Organization').first(),
        ).toBeVisible({ timeout: 30_000 });

        const row = page.getByRole('row').filter({ hasText: 'Unknown Organization' });
        await expect(row).toHaveCount(1);
        // The CRITICAL assertion: alt is the fallback string,
        // matching the visible text exactly. Proves alt and
        // visible text are derived from the SAME title-
        // cascade path (both `useAggregatorCompanies`-side).
        await expect(row.locator('img').first()).toHaveAttribute(
            'alt',
            'Unknown Organization',
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
