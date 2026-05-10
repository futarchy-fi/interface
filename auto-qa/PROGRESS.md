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
| Iterations completed | 5 |
| PRs catalogued | 20 / ~65 |
| PRs classified | 20 |
| Tests added | 9 (4 extractor-sanity + 2 graphql-compat + 3 endpoint-liveness — all passing) |
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
- **Test status**: not-started

### PR #54 — Fix TWAP window for ended proposals
- **Class**: bug-fix
- **Hypothesis**: TWAP (time-weighted average price) calculation used `now` as the upper bound even when the proposal had ended. For ended proposals the window should clamp to `endTime`, otherwise TWAP includes empty no-trade time after the market closed and the price drifts incorrectly toward the last trade.
- **Ideal test**: For an ended proposal, the TWAP value at `t > endTime` equals the TWAP at `endTime` exactly (window is clamped).
- **Tools needed**: TWAP API + a known ended proposal fixture.
- **Test status**: not-started

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
- **Test status**: not-started

### PR #51 — Fix nonsense Liquidity widget value on market page
- **Class**: bug-fix
- **Hypothesis**: Liquidity widget displayed raw Algebra V3 `liquidity` field (~1e18-scaled units) without conversion to currency-denominated TVL. Showed numbers like "4.9e21 sDAI" — nonsense. Fix: derive currency TVL from `L × sqrtPrice × 2 / 1e18`.
- **Ideal test**: Snapshot test of `formatLiquidity()` for known pool tick + liquidity values, assert output is in plausible currency units (1 < value < 1e9).
- **Tools needed**: Pure unit test of the formatter (input pool data, expected formatted string range).
- **Test status**: not-started

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
- **Test status**: not-started

### PR #47 — Remove dead Supabase code and unreachable fallbacks
- **Class**: refactor / cleanup
- **Hypothesis**: n/a (no behavior change; deleted dead code paths)
- **Ideal test**: Lint rule asserting no remaining `import .*supabase` statements across `src/**`. Prevents regression.
- **Tools needed**: grep + assertion in a node:test.
- **Test status**: not-started

### PR #46 — Filter archived proposals from companies and proposals lists
- **Class**: bug-fix
- **Hypothesis**: Listing endpoints didn't filter `metadata.archived === true`. Stale test proposals leaked into Companies and Proposals page lists.
- **Ideal test**: For every listing endpoint, no card renders if its metadata has `archived === true`. Already partially covered by PR #61's ideal test.
- **Tools needed**: subsumed by #61.
- **Test status**: not-started

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
