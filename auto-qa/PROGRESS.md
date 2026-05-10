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
| Iterations completed | 1 |
| PRs catalogued | 5 / ~65 |
| PRs classified | 5 |
| Tests added | 0 |
| Tools needed but not installed | (TBD — see "Tooling backlog" below) |

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

## Tooling backlog

Ranked by how many catalogued bugs each tool would have caught.

| Rank | Tool | Catches | Effort |
|---|---|---|---|
| 1 | **GraphQL schema-compat checker** — extract every GraphQL string from the frontend, validate against live Checkpoint introspection. Static, no UI needed. | #62, #63, #65 (3/5) + every future Checkpoint shape mismatch | Medium |
| 2 | **Companies/market page render smoke test** — Playwright test that loads `futarchy.fi/companies` + a known market page and asserts non-empty data. | #61, #62, #64, #65 (4/5) | Medium-High (browser, network) |
| 3 | **Bulk-pool-address unit test with recorded fixture** — calls `bulkFetchPoolsByChain` with a known input, asserts non-empty output. | #64 | Low |

**Iteration plan**: build tool #1 first (highest leverage, lowest UI flakiness risk), then #3 (cheap unit-level safety net), then #2 (the integration crown).

## Notes for future iterations

- PRs #32–#60 still need to be catalogued (older history). Pull more via `gh pr list --state merged --limit 100`.
- Also catalogue closed-without-merge PRs and direct-to-main commits.
- Repeat the same exercise on `futarchy-fi/futarchy-api` in alternating iterations.
- Do NOT modify production code, even if the test exposes a bug. Document the failure here.
