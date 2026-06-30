# Auto-QA

This directory is split into CI tiers by flakiness and external dependencies.

## Deterministic Unit Tier

Run:

```sh
npm run auto-qa:test:unit
```

Files live under `auto-qa/tests/`. These tests must not call live services,
start browsers, start an Anvil fork, or submit transactions. They are allowed
to inspect local source files and run local Node helper scripts. This tier is
safe for pull-request CI and is also what `npm run auto-qa:test` runs.

## Live Network Tier

Run:

```sh
npm run auto-qa:test:live
```

Files live under `auto-qa/live/`. These tests may call public Futarchy
endpoints and should skip when the network is unavailable. They are useful for
catching endpoint drift, but they are intentionally excluded from pull-request
CI. GitHub runs them only by manual dispatch or on the nightly schedule in
`.github/workflows/auto-qa-live.yml`.

## Forked Browser Harness

The larger Playwright and Anvil replay harness from the experimental
`auto-qa` branch is not part of this tier. Forked-chain reads, writes, browser
scenarios, and catalog drift checks need their own explicit workflow once they
are cleaned up and separated from live-write tests.
