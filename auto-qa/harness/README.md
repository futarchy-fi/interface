# Forked Replay Harness — interface side

UI-side scaffold for the end-to-end test harness. See
[`PROGRESS.md`](./PROGRESS.md) for the full architecture, phasing, and
invariant catalogue.

## What lives here

This subtree hosts the **UI-side** infrastructure of the harness:

- **Playwright config + browser drivers** (Phase 5)
- **Wallet stub** — programmatic MetaMask substitute for connect / sign
  flows (Phase 4-5)
- **Page-object models** — typed wrappers around futarchy UI views
  (Phase 5)
- **DOM ↔ API consistency assertions** — every visible price / volume /
  TVL number gets checked against the api response that produced it
- **Wallet-flow scenario scripts** — connect, swap, view trades, switch
  proposals, redeem (Phase 5+)

The **server side** of the harness (anvil fork, indexer, api, scenario
fixtures, chaos injection) lives in the sibling
[`futarchy-api/auto-qa/harness/`](https://github.com/futarchy-fi/futarchy-api/tree/auto-qa/auto-qa/harness)
directory.

## How to run

Install the harness-local dependencies first:

```bash
npm --prefix auto-qa/harness ci
```

Fast, deterministic harness checks:

```bash
npm --prefix auto-qa/harness test
```

Forked-chain checks that start or require Anvil and submit transactions against
a local fork:

```bash
npm --prefix auto-qa/harness run test:fork
```

The browser scenario suite is still heavier and should be run explicitly:

```bash
# From the repo root
npm run auto-qa:e2e             # print phase status (current)
npm run auto-qa:e2e:ui          # run Playwright suite against local stack (Phase 5+)
npm run auto-qa:e2e:replay      # full chain↔api↔ui replay (Phase 5+)
```

The UI side requires the server-side stack (anvil + indexer + api) to be
running first. Phase 7 will provide a single docker-compose up that
launches both halves.

## Directory layout (planned)

```
auto-qa/harness/
├── PROGRESS.md             ← phasing, status, invariant catalogue
├── README.md               ← this file
├── package.json            ← harness-local deps (playwright, etc.)
├── .gitignore              ← test artifacts, browser binaries, etc.
├── playwright.config.mjs   ← (Phase 5) browser config
├── fixtures/
│   ├── wallet-stub.mjs     ← (Phase 4) programmatic wallet substitute
│   ├── api-mocks.mjs       ← (Phase 5) optional API mocking helpers
│   └── extension-stub/     ← (Phase 4) browser-extension shim
├── pages/                  ← (Phase 5) page-object models
│   ├── ProposalPage.mjs
│   ├── SwapPage.mjs
│   ├── TradesPage.mjs
│   └── PortfolioPage.mjs
├── flows/                  ← (Phase 5) end-to-end user scripts
│   ├── connect-and-swap.spec.mjs
│   ├── multi-pool-arb.spec.mjs
│   └── full-lifecycle.spec.mjs
└── invariants/             ← (Phase 5) DOM↔API consistency assertions
    └── dom-vs-api.mjs
```

`fixtures/`, `pages/`, `flows/`, `invariants/` are intentionally
separate from `auto-qa/tests/` so that `npm run auto-qa:test` (fast
unit/source-text pins) does NOT pick up the heavyweight harness tests.
The harness has its own runner.

## Constraints

- **Production code is never modified** by the harness — same as the
  rest of `auto-qa`.
- **Wallet stub MUST behave like MetaMask** for the strategy pattern in
  `src/components/refactor/strategies/` — any divergence breaks the
  realism of the test.
- **No real writes** — fork/write checks must use a local Anvil fork and must
  stay out of the default `npm test` path.
- **CI execution model** is deferred to Phase 7 — until then, the
  harness is run manually.

## Phase tracking

See `PROGRESS.md` ↦ "Phasing" section. Currently in **Phase 0**.

## Owner

TBD — pick someone before Phase 5 (Playwright + DOM↔API assertions)
since UI-test brittleness lives there.
