# scenarios/

Captured bug shapes, replayable as Playwright tests. Each `*.scenario.mjs`
file pins one bug class with a known mock setup + assertion. Format is
defined by [ADR-002](../docs/ADR-002-scenario-format.md).

## Why a separate dir from `flows/`?

`flows/` holds infrastructure tests — they prove the harness's
**mechanism** works (wallet stub injection, signing tunnel, GraphQL
mock dispatch, etc.). Each test there exercises a piece of the
testing stack itself.

`scenarios/` holds bug-shape regressions — each file pins a
**specific bug class** the harness must keep catching. A scenario
might internally use the same fixtures as a `flows/` test, but the
intent is different: a scenario's job is to fail loudly the moment
its bug shape returns.

If the harness's mechanism breaks, `flows/` tests fail.
If the futarchy app regresses on a known bug shape, `scenarios/`
tests fail.

## Format (binding)

Per ADR-002, every scenario is `<NN>-<short-name>.scenario.mjs`
exporting:

```js
export default {
    name:        '01-stale-price-shape',
    description: '...',
    bugShape:    'PR #64 stale price (frontend stale, API healthy)',
    route:       '/companies',
    mocks: {
        'https://api.futarchy.fi/registry/graphql': makeGraphqlMockHandler({...}),
        'https://api.futarchy.fi/candles/graphql':  makeCandlesMockHandler({...}),
    },
    assertions: [
        async (page) => expect(page.getByText('0.4200 SDAI').first()).toBeVisible(),
    ],
    // Optional: timeout, wallet, ciTiers, requiresAnvil, etc.
};
```

A wrapper spec at `flows/scenarios.spec.mjs` auto-discovers every file matching
`*.scenario.mjs` and emits one Playwright test per selected scenario, applying
mocks before navigation and running assertions in registration order.

## Adding a scenario

1. Pick the next free `<NN>` (zero-padded two digits).
2. Write a one-sentence `bugShape` that names the class (this becomes
   the catalog entry).
3. Reuse fixture helpers from `../fixtures/wallet-stub.mjs` and
   `../flows/dom-api-invariant.spec.mjs` (mock factories).
4. Decide whether the scenario should enter CI now:
   - Add `ciTiers: ['interaction']` for stable browser-only interaction
     coverage.
   - Add `ciTiers: ['fork']` plus `requiresAnvil` or `useAnvilRpcProxy` for
     stable forked-chain coverage.
   - Leave it unassigned if it should stay manual while it stabilizes.
5. Run `npm run auto-qa:harness:scenarios:by-tier` to confirm tier placement.
6. Run `npm run auto-qa:harness:scenarios:catalog` and commit the regenerated
   catalog.

## Current scenarios

The full bug-shape index is in [SCENARIOS.md](./SCENARIOS.md), which
is auto-generated from each scenario's `bugShape` field by
`scripts/scenarios-catalog.mjs` (run via
`npm run auto-qa:harness:scenarios:catalog`). Regenerate after adding or
changing a scenario; the file is committed so PRs surface catalog drift.

Below: per-file authoring notes (the why-this-scenario-exists
context that doesn't fit in a one-cell description).

| #  | File                                | Authoring notes |
|----|-------------------------------------|-----------------|
| 01 | `01-stale-price-shape.scenario.mjs` | Lifted from Phase 5 slice 4c v3b. The first scenario; proves the format end-to-end against the real futarchy app. |
| 02 | `02-registry-down.scenario.mjs`     | First Phase 7 chaos primitive — REGISTRY out, carousel renders nothing. |
| 03 | `03-candles-down.scenario.mjs`      | Phase 7 slice 2 — REGISTRY healthy, CANDLES out. Surfaced a harness-level finding: per-pool fallback hits the SAME endpoint as the bulk prefetcher, so a CANDLES outage takes both layers down at once. |
| 04 | `04-candles-partial.scenario.mjs`   | Phase 7 slice 2 partial-branch — CANDLES is up but only returns prices for one of two events. Asserts the priced card renders "0.4200 SDAI" while the unpriced card falls back to "0.00 SDAI" — guards against partial-data shapes (one missing price corrupting all, card disappearing, prices swapping between cards). |
