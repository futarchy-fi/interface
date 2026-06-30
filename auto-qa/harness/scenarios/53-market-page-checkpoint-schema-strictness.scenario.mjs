/**
 * 53-market-page-checkpoint-schema-strictness.scenario.mjs — slice
 * 86. Market-page sibling of scenario 47. Uses the new
 * `makeStrictCandlesGraphqlMockHandler` to assert the market page's
 * pool / swap / proposal fetches all conform to the post-Checkpoint
 * shape.
 *
 * ── What KIND of bug this catches ───────────────────────────────────
 * Three merged fix-PRs share one bug shape:
 *
 *   - **PR #62** — `subgraphConfigAdapter.js` issued
 *     `proposal(id) { companyToken { id symbol decimals }
 *     currencyToken { ... } outcomeTokens { ... } pools { token0 {
 *     id symbol } } }`. Checkpoint exposes companyToken /
 *     currencyToken / outcomeTokens / token0 / token1 as scalar
 *     address strings — selecting subfields trips "Field 'X' must
 *     not have a selection since type 'String!' has no subfields".
 *
 *   - **PR #63** — `subgraphTradesClient.js` issued `swaps { tokenIn
 *     { id symbol } tokenOut { ... } pool { ... } }`. Same nested-
 *     on-scalar shape on the Swap entity.
 *
 *   - **PR #65** — `useSubgraphData.js` + `usePoolData.js` issued
 *     `$timestamp24hAgo: BigInt!` variables AND `proposal { pools {
 *     candles { ... } } }` (Proposal.pools + Pool.candles reverse
 *     relations). Checkpoint doesn't have BigInt scalar nor
 *     auto-generated reverse fields.
 *
 * ── Why a violation-tracking assertion ──────────────────────────────
 * The earlier "Trading Pair" DOM anchor was too lenient — the
 * ChartParameters component renders a hard-coded default trading
 * pair ('GNO/SDAI') REGARDLESS of whether the candles fetch
 * succeeded. So a PR #62 regression would trip the strict mock,
 * the consumer would swallow the GraphQL error (logged via
 * `console.error('[SubgraphAdapter] GraphQL errors:', ...)` and
 * `return null`), and the test would still see "Trading Pair" →
 * false negative.
 *
 * Instead, the strict mock now exposes an `onViolation` callback.
 * Every legacy-shape query that trips the mock is recorded into a
 * scenario-scoped array. The assertion asserts that array is
 * EMPTY. If ANY query the page issues hits any violation pattern,
 * the assertion fails with the offending field + query slice.
 *
 * This pattern is generic — any strict mock can use it to fail on
 * silently-swallowed errors. It scales as the violation catalog
 * grows.
 *
 * ── Empirical verification protocol ─────────────────────────────────
 *
 * Test current code passes → introduce ONE regression → assert
 * fails. Restore. Examples this catches:
 *
 *   (a) PR #62 — re-add `companyToken { id symbol decimals }` to
 *       the proposal query in `subgraphConfigAdapter.js`.
 *       Strict mock matches `\bcompanyToken\s*\{` → onViolation
 *       records → assertion FAILS with the matched field name.
 *
 *   (b) PR #63 — re-add `tokenIn { id symbol decimals }` to the
 *       swaps query in `subgraphTradesClient.js`. Same flow.
 *
 *   (c) PR #65 — re-add `$timestamp24hAgo: BigInt!` variable.
 *       BigInt regex trips → onViolation records → assertion FAILS.
 *
 *   (d) PR #65 reverse-relation — re-add `proposal(id) { pools { ...
 *       } }` nested pools selection. Proposal.pools regex trips.
 *
 * Each (a)/(b)/(c)/(d) is a separate PR regression class; all four
 * caught by the same scenario via one shared strict candles
 * handler.
 *
 * ── What this scenario DOESN'T catch ────────────────────────────────
 *
 *   - Wire-shape changes the indexer makes but doesn't break the
 *     consumer (e.g., a field renamed where the consumer happens
 *     to also rename in lockstep). The regex list catches concrete
 *     legacy patterns; future iterations could extend to AST-level
 *     diff vs a captured schema baseline.
 *
 *   - Bugs INSIDE the Checkpoint indexer or api proxy (harness
 *     mocks the wire; real indexer behavior is out of scope until
 *     full-stack docker compose lands).
 */

import { expect } from '@playwright/test';

import {
    REGISTRY_GRAPHQL_URL,
    CANDLES_GRAPHQL_URL,
    MARKET_PROBE_ADDRESS,
    fakeMarketProposalEntity,
    makeGraphqlMockHandler,
    makeStrictCandlesGraphqlMockHandler,
} from '../fixtures/api-mocks.mjs';

export default {
    name:        '53-market-page-checkpoint-schema-strictness',
    description: 'Market-page sibling of scenario 47. Strict candles handler rejects legacy GraphQL shapes that PR #62 / #63 / #65 fixed. Reverting any of those PRs trips the mock → onViolation fires → assertion fails with the offending field. One scenario covers four distinct regression classes (nested-on-scalar / BigInt / reverse-relation).',
    bugShape:    'Legacy GraphQL query against Checkpoint candles schema (nested-on-scalar / BigInt / reverse-relation) — KIND covers PRs #62, #63, #65',
    route:       `/markets/${MARKET_PROBE_ADDRESS}`,

    // Factory form: scenarios.spec.mjs invokes this with the per-
    // test ctx so the onViolation closure is fresh per test. The
    // closure shares state with the assertions below.
    mocks: (ctx) => {
        // Scenario-scoped violations list. Populated by the strict
        // mock's onViolation callback; drained by the assertion.
        ctx.strictSchemaViolations = [];
        return {
            // Registry side: permissive — strictness is on the
            // candles side this iteration. (Scenario 47 already
            // pins registry strictness for the orgs-list /
            // proposalentities flow.)
            [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({
                proposals: [fakeMarketProposalEntity()],
            }),
            // Candles side: STRICT. Any legacy shape (nested-on-
            // scalar, BigInt, Proposal.pools / Pool.candles
            // reverse) triggers onViolation.
            [CANDLES_GRAPHQL_URL]: makeStrictCandlesGraphqlMockHandler({
                onViolation: (v) => ctx.strictSchemaViolations.push(v),
            }),
        };
    },

    assertions: [
        // Wait for the market page to issue its candles queries.
        // Empirically the page fires 15+ candles requests within
        // ~5s under permissive mocks; 8s is generous slack.
        async (page) => {
            await page.waitForTimeout(8000);
        },
        // Core assertion: no candles query should have tripped a
        // strict-schema violation. The strict mock catalogs SEVEN
        // legacy shape patterns; matching ANY of them means the
        // consumer regressed to a pre-Checkpoint query.
        async (page, ctx) => {
            const violations = ctx.strictSchemaViolations ?? [];
            if (violations.length > 0) {
                const summary = violations
                    .slice(0, 5)
                    .map((v, i) => {
                        const field = v.match?.[1] ?? '(pattern matched globally)';
                        const queryPreview = v.query.slice(0, 200).replace(/\s+/g, ' ');
                        return `${i + 1}. [${v.message}]\n   matched field: ${field}\n   query: ${queryPreview}…`;
                    })
                    .join('\n');
                throw new Error(
                    `Scenario 53 found ${violations.length} Checkpoint-schema violation(s) ` +
                    `in candles queries:\n${summary}`,
                );
            }
            // Soft sanity check: at least one valid candles query
            // should have fired, otherwise the assertion above is
            // vacuously true (no queries → no violations).
            expect(ctx.callsTo(/candles\/graphql/).length).toBeGreaterThan(0);
        },
    ],

    timeout: 180_000,
};
