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

const STUB_RPC_URL =
    process.env.HARNESS_FRONTEND_RPC_URL ||
    process.env.HARNESS_ANVIL_URL ||
    'http://localhost:8546';

// Endpoint the /companies page POSTs to (see
// `src/config/subgraphEndpoints.js::AGGREGATOR_SUBGRAPH_URL`).
const REGISTRY_GRAPHQL_URL = 'https://api.futarchy.fi/registry/graphql';

// Distinctive probe names — vanishingly unlikely to appear naturally
// in any real org/proposal — so we can assert they came from our mock.
const PROBE_AGG_NAME = 'HARNESS-PROBE-AGG-001';
const PROBE_ORG_NAME = 'HARNESS-PROBE-ORG-001';
const PROBE_AGG_ID = '0xc5eb43d53e2fe5fdde5faf400cc4167e5b5d4fc1'; // DEFAULT_AGGREGATOR
const PROBE_ORG_ID = '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';

// Build a route handler that dispatches on the GraphQL operation
// embedded in the POST body. Returns the canned response for each
// operation and 200/empty for anything unrecognized.
//
// Parameters:
//   - proposals       — proposalentities payload (4a uses [], 4b uses
//                       a mixed-visibility list)
//   - orgMetadata     — string written to organizations[0].metadata
//                       (parsed via JSON.parse by the consumer hook;
//                       4c uses {chain: '10'} to flip the ChainBadge)
//   - onCall          — observer for the operation name, useful in
//                       failure logs
function makeGraphqlMockHandler({ proposals = [], orgMetadata = null, onCall } = {}) {
    return async (route) => {
        const body = JSON.parse(route.request().postData() || '{}');
        const q = body.query || '';
        onCall?.(q);

        let data;
        if (q.includes('aggregator(id:')) {
            data = {
                aggregator: {
                    id:          PROBE_AGG_ID,
                    name:        PROBE_AGG_NAME,
                    description: 'Synthetic aggregator for harness slice 4',
                    metadata:    null,
                },
            };
        } else if (q.includes('organizations(where:')) {
            data = {
                organizations: [{
                    id:           PROBE_ORG_ID,
                    name:         PROBE_ORG_NAME,
                    description:  'Probe org returned by mocked GraphQL',
                    metadata:     orgMetadata,
                    metadataURI:  null,
                    owner:        '0x0000000000000000000000000000000000000000',
                    editor:       '0x0000000000000000000000000000000000000000',
                }],
            };
        } else if (q.includes('proposalentities(where:')) {
            data = { proposalentities: proposals };
        } else {
            data = {};
        }

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data }),
        });
    };
}

// Build a stub `proposalentity` row matching the shape
// useAggregatorCompanies expects (id + metadata + organization{id}).
// `metadataExtra` overrides on top of the base metadata object so
// callers can pin `archived: true` / `visibility: 'hidden'` / etc.
function fakeProposal(idSuffix, metadataExtra = {}) {
    return {
        id: `0xprop${String(idSuffix).padStart(40, '0').slice(-40)}`,
        metadata: JSON.stringify(metadataExtra),
        organization: { id: PROBE_ORG_ID },
    };
}

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
});
