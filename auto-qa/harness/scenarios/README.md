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
    // Optional: timeout, wallet, etc.
};
```

A wrapper spec at `flows/scenarios.spec.mjs` (added in Phase 6 slice 2)
will auto-discover every file matching `*.scenario.mjs` and emit one
Playwright test per scenario, applying mocks before navigation and
running assertions in registration order.

## Adding a scenario

1. Pick the next free `<NN>` (zero-padded two digits).
2. Write a one-sentence `bugShape` that names the class (this becomes
   the catalog entry).
3. Reuse fixture helpers from `../fixtures/wallet-stub.mjs` and
   `../flows/dom-api-invariant.spec.mjs` (mock factories).
4. Run `npm run auto-qa:e2e:ui:full` — the scenario is picked up
   automatically; no test-list maintenance.

## Current scenarios

| #  | File                                | Bug shape                                                       | Notes |
|----|-------------------------------------|-----------------------------------------------------------------|-------|
| 01 | `01-stale-price-shape.scenario.mjs` | PR #64 stale-price-but-API-healthy                              | Lifted from Phase 5 slice 4c v3b. Mocks both registry + candles GraphQL; asserts "0.4200 SDAI" renders in the EventHighlightCard via the prefetched-price short-circuit. |
| 02 | `02-registry-down.scenario.mjs`     | hard-crash / hung-spinner / leaked-error on registry 5xx        | First Phase 7 chaos scenario. Mocks REGISTRY → 502; asserts /companies degrades gracefully to "No organizations found" instead of crashing. |
| 03 | `03-candles-down.scenario.mjs`      | price card hangs / crashes / shows fake number when candles down | Phase 7 slice 2. REGISTRY healthy + CANDLES → 502; asserts the carousel still renders our event but the price degrades to "0.00 SDAI" (per-pool fallback ALSO hits the dead candles endpoint). |
