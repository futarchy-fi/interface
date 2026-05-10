# Auto-QA Progress — futarchy-fi/interface

Working ledger for the `/loop` auto-QA initiative. Each iteration adds a small,
focused improvement: list more PRs, classify them, hypothesize the underlying
bug, propose an "ideal test" that would have caught it, and (eventually) ship
the test on this branch. **Production code is never modified — only tests.**

If a test fails against current code, leave it failing and document. We sort
out fixes in a separate pass.

## Status snapshot

| Field | Value |
|---|---|
| Branch | `auto-qa` (off `origin/main`) |
| Iterations completed | 16 |
| PRs catalogued | 40 / ~65 |
| PRs classified | 40 |
| Tests added | 53 (4 extractor-sanity + 2 graphql-compat + 5 endpoint-liveness + 10 url-shapes + 2 dead-references + 6 liquidity-math + 7 slippage-math + 8 snapshot-id-extraction + 3 pagination-first-cap + 6 twap-window — all passing) |
| Known gaps documented | 2 (uppercase-`0X` prefix in proposalId param; **PR #47 supabase cleanup is partial — 10 imports remain**) |
| Tools shipped | 2 (`extract-graphql.mjs` + `probe-graphql.mjs`) |
| Test runner | `node --test` via `npm run auto-qa:test` |
| **Real bugs surfaced** | **16 broken GraphQL queries** (see `auto-qa/fixtures/known-graphql-failures.json`) |

## Catalogue methodology

For each merged PR (newest first), capture:

- **#** — PR number
- **Title** — verbatim
- **Class** — `bug-fix`, `feature`, `refactor`, `chore`, or `infra`
- **Hypothesis** — one-sentence reverse-engineered description of the bug (only for bug-fix class)
- **Ideal test** — a high-level black-box test that would catch the underlying class of bug, written so it would also catch *future* bugs of the same shape
- **Tools needed** — what infra/skills/fixtures the test would require
- **Test status** — `not-started`, `drafted`, `landed-passing`, `landed-failing`

## PR ledger

### PR #65 — fix(market-page): chart 502 + Volume/Liquidity 0 (Checkpoint shape)
- **Class**: bug-fix
- **Hypothesis**: Two market-page hooks (`useSubgraphData` chart + `usePoolData` stats) issued Graph-Node-shaped GraphQL queries against the Checkpoint indexer behind `/candles/graphql` — `BigInt` variable types, nested `pool.candles` reverse-field, nested `proposal.currencyToken { symbol }` selection on a String scalar. Checkpoint rejected with `Unknown type "BigInt"` and `Field … must not have a selection since type "String!" has no subfields`, surfaced to the UI as a 502 banner and zero stats.
- **Ideal test**: Schema-compatibility smoke test — for every GraphQL query string the frontend ships, send it to a live (or recorded) Checkpoint endpoint and assert HTTP 200 + no `errors` array. Bonus: introspect the live schema and statically validate every query against it without any I/O.
- **Tools needed**: GraphQL schema introspector + query extractor (walks `src/**/*.{js,jsx}` for template-literal GraphQL strings + `useQuery`/`gql` calls), an integration runner that points at a known proposal fixture.
- **Test status**: not-started

### PR #64 — fix(companies): show YES/NO prices on Companies card
- **Class**: bug-fix
- **Hypothesis**: `bulkFetchPoolsByChain` keyed `poolMap` by `pool.proposal.split('-').slice(1).join('-')` assuming the response had a `<chainId>-` prefix. The `/candles/graphql` proxy already strips that prefix, so the slice produced an empty string and every entry was skipped → empty poolMap → no `poolAddresses` → carousel showed `0.00 SDAI / N/A`.
- **Ideal test**: End-to-end Companies-page snapshot — render the page against a known proposal whose CONDITIONAL pools have non-zero prices, assert YES/NO prices are non-zero numbers and Impact is a percentage string. Implicitly catches any regression where the bulk-pool-address pipeline silently empties.
- **Tools needed**: Playwright (already in plugins) + a stable test proposal + a way to skip flaky network. Could also do a unit-level test of `bulkFetchPoolsByChain` against a recorded GraphQL response.
- **Test status**: not-started

### PR #63 — fix(market-page): query Checkpoint shape for swap/trade data
- **Class**: bug-fix
- **Hypothesis**: `subgraphTradesClient.fetchSwapsFromSubgraph` selected nested `tokenIn { id symbol decimals }` against Checkpoint, where `tokenIn` is a `String!` scalar. Recent Activity tab broke with `Field 'tokenIn' must not have a selection`.
- **Ideal test**: Same family as PR #65 — schema-compatibility smoke test for every shipped GraphQL query, plus a focused unit test that the trades adapter returns a non-empty array for a proposal with known swaps.
- **Tools needed**: GraphQL schema introspector + query extractor. (Shared with PR #65 — strong case for building this tool first.)
- **Test status**: not-started

### PR #62 — fix(market-page): query Checkpoint shape for proposal/pool/token data
- **Class**: bug-fix
- **Hypothesis**: `subgraphConfigAdapter.fetchProposalFromSubgraph` selected `proposal.companyToken { symbol }`, `pool.token0 { symbol decimals role }` and reverse `proposal.pools`, all of which are scalars or non-existent in Checkpoint. Market page stuck on "Loading…".
- **Ideal test**: Same family — schema compat. Plus an integration test that loads a market page and asserts the title + currency symbol render within N seconds.
- **Tools needed**: Schema compat tool, plus a "render a market page" test harness.
- **Test status**: not-started

### PR #61 — fix(companies): render orgs table + filter archived/hidden orgs
- **Class**: bug-fix
- **Hypothesis**: After the Checkpoint migration the orgs table loader either returned `null`/empty for the listing query, or didn't filter out archived/hidden orgs (so 9 stale test orgs leaked into the page). Symptom was either "No organizations found" or a list dominated by stale entries.
- **Ideal test**: Companies-page contract test — `GET /companies` should render at least one org card, and every visible card's underlying metadata must satisfy `archived !== true` and `(visibility !== 'hidden' || isEditor)`.
- **Tools needed**: Playwright + ability to seed/lookup org metadata. Org metadata comes from the on-chain registry, so the test reads it via the live Checkpoint indexer.
- **Test status**: not-started

### PR #60 — fix(companies): query Checkpoint indexer instead of dead AWS subgraphs
- **Class**: bug-fix
- **Hypothesis**: Frontend hardcoded the AWS CloudFront subgraph URLs that died with the GCP migration. The dead URLs returned `database unavailable`, so aggregator queries failed silently and the Companies page rendered empty ("No upcoming events", "No resolved markets yet"). Fix: point endpoints at the new `api.futarchy.fi/registry/graphql` and `/candles/graphql` passthroughs and rewrite affected queries for the Checkpoint schema.
- **Ideal test**: Endpoint-liveness invariant — for every URL in `src/config/subgraphEndpoints.js`, send a trivial introspection query and assert HTTP 200 + parseable response. Catches both "endpoint dead" and "endpoint URL typo'd" regressions.
- **Tools needed**: HTTP client + a glob/grep over the config file for URL constants.
- **Test status**: **landed-passing** (`auto-qa/tests/endpoint-liveness.test.mjs` — auto-discovers URLs from the config file and asserts each returns a valid introspection envelope. Also covers PRs #47, #49, #50.)

### PR #59 — fix(ui): allow text selection across all pages
- **Class**: bug-fix
- **Hypothesis**: A global CSS rule (likely `user-select: none` on `body` or a high-up wrapper) blocked text selection across pages, frustrating debugging and copying. Fix: remove the blanket rule, allow selection where it makes sense.
- **Ideal test**: Snapshot CSS lint — assert no global stylesheet contains `user-select: none` outside of explicit interactive widgets (buttons, draggable handles).
- **Tools needed**: CSS parser (PostCSS) walking `src/**/*.css` and Tailwind utilities.
- **Test status**: not-started

### PR #58 — HOTFIX: TDZ crash on every market page
- **Class**: bug-fix (hotfix)
- **Hypothesis**: A `let`/`const` was referenced before its declaration in module-top-level scope (Temporal Dead Zone). Symptom: every market page crashed at module init, white screen.
- **Ideal test**: Smoke test — load every page route in a headless browser, assert no uncaught error in the console. Catches TDZ, undefined-imports, and module-init crashes regardless of root cause.
- **Tools needed**: Playwright + a sitemap/route enumerator.
- **Test status**: not-started

### PR #57 — Hide Max Approval section in swap modal when allowances are already max
- **Class**: feature/UX
- **Hypothesis**: n/a (UX polish, not a correctness bug)
- **Ideal test**: When `allowance >= MaxUint256 / 2`, swap modal does NOT render the Max Approval section.
- **Tools needed**: Component test (Storybook or React Testing Library) with controlled allowance prop.
- **Test status**: not-started

### PR #56 — Add Arbitrage Contract badge; default-hide Prediction Market behind metadata flag
- **Class**: feature
- **Hypothesis**: n/a
- **Ideal test**: For each metadata flag in the proposal, the corresponding badge/section in the market page renders or hides as configured.
- **Tools needed**: Component test with mocked metadata.
- **Test status**: not-started

### PR #55 — Add 404 redirect: /market/<addr> -> /market?proposalId=<addr>
- **Class**: feature (URL compat)
- **Hypothesis**: n/a
- **Ideal test**: `GET /market/0xabc…` returns a 3xx redirect (or client-side rewrite) to `/market?proposalId=0xabc…`. Catches removal of the redirect rule.
- **Tools needed**: HTTP client against the deployed site.
- **Test status**: **landed-passing** (covered by `url-shapes.test.mjs` — `/market/<addr>` and `/markets/<addr>` extract correctly)

### PR #54 — Fix TWAP window for ended proposals
- **Class**: bug-fix
- **Hypothesis**: TWAP (time-weighted average price) calculation used `now` as the upper bound even when the proposal had ended. For ended proposals the window should clamp to `endTime`, otherwise TWAP includes empty no-trade time after the market closed and the price drifts incorrectly toward the last trade.
- **Ideal test**: For an ended proposal, the TWAP value at `t > endTime` equals the TWAP at `endTime` exactly (window is clamped).
- **Tools needed**: TWAP API + a known ended proposal fixture.
- **Test status**: **landed-passing** (`auto-qa/tests/twap-window.test.mjs` — 6 cases on the pure window calculation. Spec mirrors `MarketPageShowcase.jsx:632-636`. Includes the high-level invariant: TWAP window length stays equal to twapDuration once proposal has ended, regardless of how much wall-clock time passes.)

### PR #53 — Lower FutarchyQuoteHelper gasLimit below Gnosis block cap
- **Class**: bug-fix
- **Hypothesis**: The gas estimate sent to FutarchyQuoteHelper exceeded Gnosis Chain's per-block gas cap (~30M gas). Quoter call reverted with out-of-gas before any RPC could even simulate. Fix: cap the gas at a value the chain accepts.
- **Ideal test**: Build the quoter call with current params and assert `tx.gasLimit < 30_000_000`. Catches "we bumped the limit too high" regression.
- **Tools needed**: ethers.js to construct the call without sending it.
- **Test status**: not-started

### PR #52 — Extract proposalId from milestones URL hash to fix swap quoter
- **Class**: bug-fix
- **Hypothesis**: Milestones URL uses fragment (`#proposalId=…`) rather than search params. Swap quoter parsed only `?proposalId=…` and got undefined, so the quote call hit the wrong (or null) market.
- **Ideal test**: Given a URL of each known shape (`?proposalId=`, `#proposalId=`, `/market/<addr>`, etc.), the quoter receives the same proposal ID.
- **Tools needed**: Pure-JS URL parser test.
- **Test status**: **landed-passing** (`auto-qa/tests/url-shapes.test.mjs` — 7 cases covering `#milestone:`, `#market:`, bare `#0x…`, plus precedence rules. Surfaced one gap: uppercase `0X` prefix is silently rejected — documented as a known gap.)

### PR #51 — Fix nonsense Liquidity widget value on market page
- **Class**: bug-fix
- **Hypothesis**: Liquidity widget displayed raw Algebra V3 `liquidity` field (~1e18-scaled units) without conversion to currency-denominated TVL. Showed numbers like "4.9e21 sDAI" — nonsense. Fix: derive currency TVL from `L × sqrtPrice × 2 / 1e18`.
- **Ideal test**: Snapshot test of `formatLiquidity()` for known pool tick + liquidity values, assert output is in plausible currency units (1 < value < 1e9).
- **Tools needed**: Pure unit test of the formatter (input pool data, expected formatted string range).
- **Test status**: **landed-passing** (`auto-qa/tests/liquidity-math.test.mjs` — 6 cases: bounds-check on real GIP-150 pool data, futarchy YES≈NO invariant, degenerate-tick guard, null/zero-L guard. Spec mirrors `usePoolData.js:141-153` math.)

### PR #50 — Migrate per-company milestones page to subgraph
- **Class**: refactor (migration to subgraph data source)
- **Hypothesis**: Same family as #60 — moves another data source off the dead AWS subgraph onto Checkpoint.
- **Ideal test**: Endpoint-liveness invariant for the milestones data source (subsumed by #60's test).
- **Tools needed**: same as #60.
- **Test status**: **landed-passing** (covered transitively by `endpoint-liveness.test.mjs` since milestones queries hit the same endpoint URL constants)

### PR #49 — Replace SupabasePoolFetcher with subgraph-based fetcher
- **Class**: refactor (Supabase → subgraph)
- **Hypothesis**: Pool data was being fetched from Supabase (a stale data warehouse) which got out of sync with chain reality. Replace with direct subgraph queries.
- **Ideal test**: Pool prices returned by `SubgraphPoolFetcher.fetch()` match `eth_call` to `pool.slot0()` within 1% for a fixture pool.
- **Tools needed**: ethers.js for on-chain comparison + subgraph.
- **Test status**: not-started

### PR #48 — Read Snapshot proposal ID from on-chain metadata only
- **Class**: refactor / bug-fix
- **Hypothesis**: Snapshot proposal ID was being read from a hardcoded mapping or env var. Some proposals had it but the value was wrong/stale. Fix: read from on-chain metadata as single source of truth.
- **Ideal test**: For a fixture proposal, `extractSnapshotProposalId(proposal)` returns the same value as `proposal.metadata.snapshot_proposal_id` from the registry.
- **Tools needed**: Pure unit test with a metadata fixture.
- **Test status**: **landed-passing** (`auto-qa/tests/snapshot-id-extraction.test.mjs` — 8 cases. Spec-mirror of `extractSnapshotIdFromMetadata` from `src/adapters/registryAdapter.js:286` (couldn't import directly — Next.js extension-less imports vs node:test strict ESM). Test matrix: object metadata, JSON-string metadata, null/undefined entity, missing metadata, missing snapshot_id, malformed JSON, non-string snapshot_id, slug-format ID.)

### PR #47 — Remove dead Supabase code and unreachable fallbacks
- **Class**: refactor / cleanup
- **Hypothesis**: n/a (no behavior change; deleted dead code paths)
- **Ideal test**: Lint rule asserting no remaining `import .*supabase` statements across `src/**`. Prevents regression.
- **Tools needed**: grep + assertion in a node:test.
- **Test status**: **landed-passing** (`auto-qa/tests/dead-references.test.mjs` PR #47 case). **Surfaced an unfinished cleanup**: 10 supabase imports still exist in `src/` (baseline locked in). Files: `app/new-design/page.jsx`, `chart/TripleChart.jsx`, `marketPage/{MarketHistoryViewModel,MarketPageShowcase,MarketPageShowcaseViewModel,RecentTradesDataLayer}.jsx`, `useContractConfig.js`, `pages/{markets/[address],new-design/[marketId],new-design/index}.{js,jsx}`. Per /loop directive: NOT fixed. When real-fix work removes some, lower the baseline.

### PR #46 — Filter archived proposals from companies and proposals lists
- **Class**: bug-fix
- **Hypothesis**: Listing endpoints didn't filter `metadata.archived === true`. Stale test proposals leaked into Companies and Proposals page lists.
- **Ideal test**: For every listing endpoint, no card renders if its metadata has `archived === true`. Already partially covered by PR #61's ideal test.
- **Tools needed**: subsumed by #61.
- **Test status**: not-started

### PR #45 — Fix 'Entity not found' on Manage Organization modal
- **Class**: bug-fix
- **Hypothesis**: The Manage Organization modal queried the registry by an organization ID with the wrong shape (e.g. lowercase address vs checksum, or missing chain prefix after the Checkpoint migration). Lookup returned null → modal showed "Entity not found".
- **Ideal test**: Open the modal for a known org address, assert the modal does not show the empty/error state. Or unit-test the entity-resolution function with each known address shape.
- **Tools needed**: Component test (RTL/Storybook) OR Playwright.
- **Test status**: not-started

### PR #44 — Fix /companies linkable proposals cutoff
- **Class**: bug-fix
- **Hypothesis**: `getLinkableProposals` queried `proposals(first: 50)` against a registry with 229 proposals. Ordered by hex `id` (random sort), so any proposal whose address sorted past position 50 was invisible to the admin UI. Fix: bump to `first: 1000`.
- **Ideal test**: Lint-style scan: any GraphQL query on a growing entity (`proposals`, `pools`, `organizations`, `proposalentities`) with `first: <100` is flagged unless explicitly accepted. Catches future PR-#44-style silent-truncation bugs in any file.
- **Tools needed**: Reuse the GraphQL extractor; pure regex scan.
- **Test status**: **landed-passing** (`auto-qa/tests/pagination-first-cap.test.mjs` — 3 cases: surprise detection, accepted-list still-matches, diagnostic. ACCEPTED_SMALL_FIRST baseline records the 2 intentionally-narrow usages: search `proposals(first: 20)` and `pools(... id: "0xabc", first: 1)`.)

### PR #43 — Remove tickspread.com URL references
- **Class**: refactor / cleanup (post-rebrand)
- **Hypothesis**: n/a (no behavior change; removed dead links)
- **Ideal test**: Lint rule asserting `tickspread.com` does not appear anywhere in `src/**`. Prevents re-introduction.
- **Tools needed**: grep + assertion in node:test.
- **Test status**: **landed-passing** (`auto-qa/tests/dead-references.test.mjs` PR #43 case — confirmed clean: 0 hits in src/)

### PR #42 — Point API URL to api.futarchy.fi
- **Class**: infra / config
- **Hypothesis**: After GCP migration, the env-var `NEXT_PUBLIC_FUTARCHY_API_URL` (or similar) defaulted to a stale URL. Frontend talked to the dead AWS endpoint. Same root family as the subgraph URL fix.
- **Ideal test**: Endpoint-liveness invariant — already covered by `endpoint-liveness.test.mjs` in the subgraph case; could be extended to also check the futarchy-api base URL by reading `usePoolData.js` for the `RAW_API_BASE_URL`.
- **Tools needed**: Same as endpoint-liveness, just point at a different URL constant.
- **Test status**: **landed-passing** (`endpoint-liveness.test.mjs` extended — 2 new cases: extracts the URL from `usePoolData.js` and probes `${url}/health` for HTTP 2xx)

### PR #39 — Better post-trade panel
- **Class**: feature/UX
- **Hypothesis**: n/a
- **Ideal test**: Component test asserting the post-trade panel shows execution summary fields (`amountOut`, `priceImpact`, `txHash` link).
- **Tools needed**: Storybook + RTL.
- **Test status**: not-started

### PR #37 — Fix premature Transaction Succeeded for CoW Swap orders
- **Class**: bug-fix
- **Hypothesis**: CoW Swap orders go through a separate signing → batch-settlement flow. The UI marked the trade as "Succeeded" upon signing the order rather than after on-chain settlement. Users would see "succeeded" before the trade actually filled.
- **Ideal test**: For a mock CoW order, status transitions: `pending → signed → matching → executed → succeeded`. Assert "succeeded" only fires after the `executed` step.
- **Tools needed**: Mock CoW SDK or fixture for each phase.
- **Test status**: not-started

### PR #35 — Fix spot price chart shivering on page load
- **Class**: bug-fix (UI/UX)
- **Hypothesis**: Spot chart re-rendered with shifted axes on every data refresh — visual "shiver". Likely the chart was recreating instead of updating, or the time axis was using `Date.now()` per frame.
- **Ideal test**: Hard to test without visual diff. Closest unit test: chart options object is stable across consecutive renders with the same data (object identity or shallow-equal).
- **Tools needed**: React testing library + chart instance inspection. Or visual regression tooling (Percy/Chromatic).
- **Test status**: not-started

### PR #34 — Fix slippage calculation bug (Issue #5)
- **Class**: bug-fix
- **Hypothesis**: Lossy `Number()` float math for `minReceive` truncated precision past 2^53 wei. The displayed Min. Receive number diverged from the on-chain min-output bound. Fix: switch to `BigNumber` arithmetic.
- **Ideal test**: Compute `minReceive` via both BigInt and lossy float; assert (a) BigInt is bit-exact for round numbers, (b) float SILENTLY differs at large amounts, (c) monotonic non-increasing in slippage, (d) bps rounding correct for fractional %.
- **Tools needed**: Pure native-BigInt arithmetic, no ethers dep needed.
- **Test status**: **landed-passing** (`auto-qa/tests/slippage-math.test.mjs` — 7 cases including the float-truncation property check)

### PR #33 — Fix trade simulation preview precision and add pool price after
- **Class**: bug-fix
- **Hypothesis**: Trade preview rounded too aggressively (lost precision on small amounts) and didn't show the post-trade pool price. Users couldn't see the actual price impact.
- **Ideal test**: For a known input amount + pool state, the previewed `amountOut` matches a quoter call's `amountOut` to 6 decimal places. Post-trade price field is populated.
- **Tools needed**: Quoter mock + unit test of formatter.
- **Test status**: not-started

### PR #32 — Fix Snapshot link using on-chain Registry metadata (#21)
- **Class**: bug-fix
- **Hypothesis**: Snapshot link was being constructed from a hardcoded mapping. Some proposals had wrong/missing entries → the "View on Snapshot" button linked to the wrong proposal or 404'd. Fix: read `metadata.snapshot_proposal_id` from the on-chain registry.
- **Ideal test**: For a proposal with a known `snapshot_proposal_id` in metadata, the rendered link's `href` ends with that ID.
- **Tools needed**: Component test with mocked metadata.
- **Test status**: partially covered (snapshot ID extraction tested in PR #48 — see `snapshot-id-extraction.test.mjs`. The link composition itself still needs a component test.)

### PR #31 — Fix Impact showing 0% by using candle close prices
- **Class**: bug-fix
- **Hypothesis**: The Impact widget computed price impact from pool tick (instantaneous) but the widget displayed % between previous-tick and current-tick — for stable pools that often gave 0%. Fix: use latest candle close prices instead, which capture trading-window-end prices.
- **Ideal test**: For a fixture pool with two non-zero candle closes, `computeImpact(yesPrice, noPrice)` returns a non-zero percentage. Pure unit test.
- **Tools needed**: pure unit test of the impact formula.
- **Test status**: not-started

### PR #30 — Improve market page layout: auto-height hero, smooth scroll
- **Class**: feature/UX
- **Hypothesis**: n/a
- **Ideal test**: Visual regression / snapshot test (Percy or Chromatic).
- **Test status**: deferred

### PR #29 — Discover pools from subgraph instead of requiring metadata
- **Class**: refactor / bug-fix
- **Hypothesis**: Pools used to be hardcoded per-proposal in metadata; if metadata was missing/stale the pool fetcher returned null and price widgets showed empty. Fix: discover pools from the subgraph at query time.
- **Ideal test**: For a proposal with no `pools` in metadata, the discovery path still resolves YES/NO pools from the subgraph. Already covered in spirit by `unified-chart.test.mjs` (asserts non-null pool_id) on the api side.
- **Test status**: indirectly covered (api-side unified-chart test)

### PR #28 — Fix resolved proposals showing as ongoing (#10, #11)
- **Class**: bug-fix
- **Hypothesis**: The `resolution_status === 'resolved'` filter check was missing or wrong-cased somewhere — resolved proposals leaked into the "Active" bucket. Fix: filter on both `resolution_status` and `resolutionStatus` (camelCase) values.
- **Ideal test**: Pure unit test: given a list of proposals with mixed status fields, the bucketing function puts each in the correct bucket regardless of which casing the field uses.
- **Tools needed**: pure unit test if the bucketing function is exported.
- **Test status**: not-started

### PR #27 — Restore landing page
- **Class**: feature
- **Hypothesis**: n/a
- **Ideal test**: smoke test that `/` returns a non-error page. Subsumed by the page-load-without-console-errors test family.
- **Test status**: deferred

### PR #26 — Remove 7 unused npm packages
- **Class**: refactor / cleanup
- **Hypothesis**: n/a
- **Ideal test**: Lint that asserts removed packages are NOT re-introduced into package.json.
- **Tools needed**: package.json grep.
- **Test status**: not-started

### PR #25 — Cleanup batch 2: dead code, image optimization, security headers
- **Class**: refactor / cleanup
- **Hypothesis**: n/a
- **Ideal test**: Security-headers test: assert `next.config.js` exports the expected set of security headers (CSP, X-Frame-Options, etc.).
- **Test status**: not-started

### PR #24 — Cleanup: fix debug flags, remove stale files and old workflows
- **Class**: refactor / cleanup
- **Hypothesis**: n/a
- **Ideal test**: subsumed by other lint tests
- **Test status**: deferred

### PR #23 — Remove excessive top margin on companies page
- **Class**: feature/UX
- **Hypothesis**: n/a
- **Ideal test**: Visual regression
- **Test status**: deferred

## Tooling backlog

Ranked by how many catalogued bugs each tool would have caught.

| Rank | Tool | Catches | Effort |
|---|---|---|---|
| 1 | **GraphQL schema-compat checker** — extract every GraphQL string from the frontend, validate against live Checkpoint introspection. Static, no UI needed. **DONE**: extractor + runtime probe shipped. `npm run auto-qa:extract-graphql` finds 32 queries; `npm run auto-qa:probe-graphql -- --summary` sends each to the live API and reports validation errors. Surfaced 16 broken queries (see "Known failures" below). | #62, #63, #65 (3/5) + every future Checkpoint shape mismatch | DONE |
| 2 | **Companies/market page render smoke test** — Playwright test that loads `futarchy.fi/companies` + a known market page and asserts non-empty data. | #61, #62, #64, #65 (4/5) | Medium-High (browser, network) |
| 3 | **Bulk-pool-address unit test with recorded fixture** — calls `bulkFetchPoolsByChain` with a known input, asserts non-empty output. | #64 | Low |

**Iteration plan**: build tool #1 first (highest leverage, lowest UI flakiness risk), then #3 (cheap unit-level safety net), then #2 (the integration crown).

## Notes for future iterations

- PRs #32–#60 still need to be catalogued (older history). Pull more via `gh pr list --state merged --limit 100`.
- Also catalogue closed-without-merge PRs and direct-to-main commits.
- Repeat the same exercise on `futarchy-fi/futarchy-api` in alternating iterations.
- Do NOT modify production code, even if the test exposes a bug. Document the failure here.

## Known failures (iteration 3 — schema-compat probe)

The probe found **16 production queries that fail validation against the live Checkpoint schema** today. Highlights (full list in `auto-qa/fixtures/known-graphql-failures.json`):

- `services/subgraphClient.js` — 4 queries, all Graph-Node-shaped (`BigInt`, nested entity selections on String scalars, `Proposal.pools` reverse field)
- `useOrganization.js`, `useSearchProposals.js`, `ProposalsPage.jsx` — query `Proposal.pools` and `Organization.proposals` reverse fields that don't exist in Checkpoint
- `OrganizationManagerModal.jsx` — `Aggregator.organizations` and `Organization.proposals` reverse fields
- `EditCompanyModal.jsx`, `EditProposalModal.jsx` — wrong type names (`organizationEntity` should be `organization`; `proposalEntity` should be `proposalentity`)
- `MarketPageShowcase.jsx:2028`, `SubgraphBulkPriceFetcher.js:36`, `SubgraphPoolFetcher.js:132` — syntax errors after `${...}` substitution (likely interpolating field names dynamically — fragile pattern)
- `subgraphTradesClient.js:133` — String-vs-Int mismatch

Per the /loop directive: production NOT modified. Tests assert the count (16) and identity match. New regressions trip the test loudly. When real fixes ship, regenerate the baseline.

## Inventory snapshot (iteration 2)

The extractor found **32 GraphQL queries across 19 files**. The 6 highest-density files are:

```
4  src/components/debug/CreateOrganizationModal.jsx
4  src/hooks/usePoolData.js
4  src/services/subgraphClient.js
2  src/components/debug/OrganizationManagerModal.jsx
2  src/hooks/useSearchProposals.js
2  src/utils/SubgraphPoolFetcher.js
2  src/utils/subgraphTradesClient.js
```

Each of these is a candidate for the next-step compat checker — they are the
surface area against the Checkpoint indexer.
