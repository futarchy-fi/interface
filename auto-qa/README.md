# auto-qa

Branch-local testing harness for `futarchy-fi/interface`. Lives entirely on
the `auto-qa` branch — **never merge into `main`**. The point is to add
coverage *without touching production code*; if a test fails because
production is broken, leave it failing and document.

## Run

```sh
npm run auto-qa:test            # all tests
node --test auto-qa/tests/<x>.test.mjs   # one file

npm run auto-qa:extract-graphql --summary   # list every shipped GraphQL query
npm run auto-qa:probe-graphql -- --summary  # send each to live API + report errors
```

Tests skip cleanly when offline (probe + endpoint-liveness rely on
`api.futarchy.fi`); other tests are pure JS and always run.

## Layout

```
auto-qa/
├── README.md                ← you are here
├── PROGRESS.md              ← per-PR ledger (hypothesis + ideal test + status)
├── tools/
│   ├── extract-graphql.mjs  ← walks src/ for GraphQL strings
│   └── probe-graphql.mjs    ← sends each extracted query to live API
├── fixtures/
│   └── known-graphql-failures.json   ← baseline for the schema-compat probe
└── tests/
    ├── extractor-sanity.test.mjs    ← guards the extractor itself
    ├── graphql-compat.test.mjs      ← runs probe + asserts count == baseline
    ├── endpoint-liveness.test.mjs   ← probes URLs from src/config/* + usePoolData.js
    ├── url-shapes.test.mjs          ← URL parsing matrix (PRs #52, #55)
    ├── dead-references.test.mjs     ← grep guards (tickspread, supabase)
    ├── liquidity-math.test.mjs      ← tick → TVL math (PR #51)
    ├── slippage-math.test.mjs       ← BigInt minReceive (PR #34)
    └── snapshot-id-extraction.test.mjs   ← metadata parsing (PR #48)
```

## Baselines

Two baselines exist; both ratchet in **both directions** so you can't
silently regress *or* silently improve:

| Baseline | What it pins | When it fires |
|---|---|---|
| `fixtures/known-graphql-failures.json` | 16 production GraphQL queries that fail validation against live Checkpoint | Count rises (NEW failures) **or** count falls (a real fix landed — update the baseline) |
| `dead-references.test.mjs` SUPABASE_IMPORT_BASELINE = 10 | Number of `@supabase/supabase-js` imports in `src/` (PR #47 cleanup is partial) | Count changes either direction |

When a real-fix PR lands and lowers a baseline, regenerate:

```sh
npm run auto-qa:probe-graphql > auto-qa/fixtures/known-graphql-failures.json
# … and edit the SUPABASE_IMPORT_BASELINE constant by hand
```

## Adding a test

1. Pick a PR (or class of bugs) from `PROGRESS.md` with `Test status: not-started`.
2. Write `auto-qa/tests/<short-name>.test.mjs` using `node:test` + `assert/strict`.
3. If you need to touch production code: don't. Inline the function as a
   spec-mirror with a `// from src/foo/bar.js:LL` comment (Next.js's
   extension-less imports don't load through node:test's strict ESM).
4. If the test surfaces a real bug, lock it in with a baseline rather
   than fixing the code. Document the gap in `PROGRESS.md`.
5. Run `npm run auto-qa:test`. Update `PROGRESS.md` to flip the PR's
   status to `landed-passing`.

## Conventions

- One test file per PR or per cross-cutting invariant.
- `test('PR #N — <invariant>', …)` for PR-targeted tests.
- Always provide a `t.skip` path for tests that need network access.
- Pin a stable fixture for live-API tests. The current canonical
  fixture is **GIP-150 v2** at `0x1a0f209fa9730a4668ce43ce18982cb0010a972a`.

## Cross-repo

The sister harness lives at `futarchy-fi/futarchy-api` on its own
`auto-qa` branch. Some bugs span both — e.g. PR #65 (interface) and PR #9
(api) were the same root cause — and the ideal test sometimes ships on
the more authoritative side. See `PROGRESS.md` cross-repo notes.
