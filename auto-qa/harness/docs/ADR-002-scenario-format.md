# ADR-002: Scenario format for the Forked Replay Harness

**Status:** Proposed
**Date:** 2026-05-10
**Deciders:** harness owners (futarchy-fi/interface + futarchy-fi/futarchy-api)
**Phase:** 6 — Scenario library
**Supersedes:** none (first scenario-format decision)

## Context

Phase 6's CHECKLIST gate calls for "scenario capture format decided
(JSON snapshot vs full state dump)". A *scenario*, in this harness,
is the smallest unit of replayable bug-shape coverage: it pins the
inputs (chain state and/or API responses), drives the system, and
asserts the end-state. Future iterations add scenarios; the ADR
fixes the *format* so they all look alike.

Two natural axes:

1. **What's captured** — pure frontend (API responses + DOM
   assertions) vs full-stack (anvil snapshot + tx list + cross-layer
   asserts).
2. **How it's stored** — pure data (JSON / YAML) vs executable
   module (`.mjs` exporting a `Scenario` object) vs Playwright spec
   files conventionally named.

## Options considered

### Option A — JSON snapshot only

Each scenario is a `<id>.scenario.json` file containing:

```json
{
  "name": "01-stale-price-shape",
  "route": "/companies",
  "mocks": [
    { "url": "https://api.futarchy.fi/registry/graphql",
      "match": { "operation": "organizations" },
      "response": { ... } }
  ],
  "assertions": [
    { "type": "visible", "selector": "text=0.4200 SDAI" }
  ]
}
```

**Pro:** Maximally declarative. Easy to diff / review. Easy to
auto-generate from a recording. No runtime imports.
**Con:** Limited expressiveness — anything dynamic (per-call
dispatch, computed assertions, conditionally-mocked second
response) needs a sidecar JS file or a rich mini-DSL. The DSL
ratchets up complexity quickly.

### Option B — Executable `.scenario.mjs` modules

Each scenario is a JS module:

```js
export default {
    name: '01-stale-price-shape',
    route: '/companies',
    mocks: {
        'https://api.futarchy.fi/registry/graphql': makeGraphqlMockHandler({...}),
        'https://api.futarchy.fi/candles/graphql':  makeCandlesMockHandler({...}),
    },
    assertions: [
        async (page) => expect(page.getByText('HARNESS-PROBE-EVENT-001').first()).toBeVisible(),
        async (page) => expect(page.getByText('0.4200 SDAI').first()).toBeVisible(),
    ],
};
```

A single Playwright wrapper spec auto-discovers + runs every
`scenarios/*.scenario.mjs`.

**Pro:** Reuses the existing fixture helpers
(`makeGraphqlMockHandler`, `fakePoolBearingProposal`, etc.) without
re-implementing them in JSON. Assertions can use the full Playwright
locator surface. Per-scenario one file, easy to find.
**Con:** Less declarative. Harder to auto-generate from a recording.
A scenario-author can do anything (no enforced schema) — discipline
needed.

### Option C — Convention over file format (just spec files)

Each scenario is a normal `*.spec.mjs` file under `scenarios/`,
following a naming convention. Effectively today's
`flows/*.spec.mjs` pattern, just relocated.

**Pro:** Zero new infrastructure. Works today.
**Con:** No structured metadata about what the scenario covers, no
auto-cataloguing, no separation between "infrastructure tests"
(`flows/`) and "captured bug shapes" (`scenarios/`). Future
RegResion-catalog tooling has nothing to read.

### Option D — Full-stack snapshot (chain state dump)

Each scenario carries an `anvil_dumpState`-format JSON capturing
the chain at block N, plus the tx list to replay, plus expected
end-state.

**Pro:** Truest fidelity — any cross-layer bug is reproducible.
**Con:** State dumps are large (megabytes), opaque, and tied to
specific anvil versions. Slow to load. Phase 6's first goal is
*replayability of a bug shape*, not faithful chain replay; Phase 7
chaos work is closer to where this becomes load-bearing.

## Decision

**Adopt Option B (`.scenario.mjs` modules in `auto-qa/harness/scenarios/`)
for Phase 6.** Defer Option D (full-stack snapshot) until Phase 7
or until a captured scenario actually needs anvil state that can't
be expressed via mocks.

**Rationale:**

- We already have the fixture vocabulary
  (`makeGraphqlMockHandler`, `makeCandlesMockHandler`,
  `fakePoolBearingProposal`, `installWalletStub`, `setupSigningTunnel`).
  Option B reuses it directly; A would require porting it into a
  JSON-interpreting shim.
- The Phase 6 stop-here value is "first real bug shape replayable" —
  achievable today with mocked API + DOM assertions, since slice 4c
  v3b's stale-price-but-API-healthy regression test already proves
  the pattern.
- Auto-generation from a real chain recording (the JSON-snapshot
  appeal of Option A) is not currently a Phase 6 deliverable. If it
  becomes one, Option A can wrap Option B (a JSON file would be
  parsed and turned into a `Scenario` object at load time).

**Format definition (binding for Phase 6):**

A scenario lives at `auto-qa/harness/scenarios/<NN>-<short-name>.scenario.mjs`
where `NN` is a zero-padded sequence and `<short-name>` is a slug.
The file's `default` export is a `Scenario` object:

```ts
type Scenario = {
    name:        string;            // "01-stale-price-shape"
    description: string;            // 1-2 sentences, what bug shape this guards
    bugShape:    string;            // human-readable bug class (e.g. "PR #64 stale price")
    route:       string;            // e.g. "/companies"
    mocks:       Record<string, RouteHandler>;   // url → Playwright handler
    assertions:  Array<(page: Page) => Promise<void>>;
    timeout?:    number;            // optional override (defaults to 180s)
};
```

A wrapper spec `flows/scenarios.spec.mjs` (added in Phase 6 slice 2)
auto-discovers every `*.scenario.mjs` and emits one Playwright test
per scenario, applying the mocks before navigation and running the
assertions in order.

## Open questions (deferred)

- **Per-scenario wallet state**: do we need per-scenario `nStubWallets`
  selection / signing-tunnel setup? Probably yes — add an optional
  `wallet` field. Pin in Phase 6 slice 2 when the first real
  scenario lands.
- **Cross-repo scenarios**: a scenario that needs both a real anvil
  AND a real api would live in `futarchy-api/auto-qa/harness/scenarios/`.
  The format-decision applies to BOTH sides (so the `Scenario` shape
  needs to be portable). Cross-repo execution model deferred to
  when the first cross-repo scenario is captured.
- **Catalog generation**: a `scenarios:catalog` script that reads
  every scenario's `bugShape` and emits a `SCENARIOS.md` index.
  Useful once we have ≥3 scenarios; not a Phase 6 slice 1 concern.
