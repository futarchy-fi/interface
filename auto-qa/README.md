# Auto-QA

This directory is split into explicit CI tiers so each check has a clear
runtime and dependency profile.

## Deterministic Unit Tier

Run:

```sh
npm run auto-qa:test:unit
npm run auto-qa:harness:unit
```

Files live under `auto-qa/tests/` and `auto-qa/harness/tests/`. These tests must
not call live services, start browsers, start an Anvil fork, or submit
transactions. They inspect local source files, local fixtures, and generated
catalogs only.

GitHub runs this tier on pull requests and pushes to `main` in
`.github/workflows/auto-qa.yml`.

## Browser Interaction Tier

Run:

```sh
npm run auto-qa:harness:interaction
```

This tier runs Playwright against the local Next app with mocked network data
and the wallet stub. It is for real browser interactions such as keyboard
navigation, focus handling, and modal behavior. It does not start Anvil and does
not submit transactions.

Scenarios opt into this tier with `ciTiers: ['interaction']`. GitHub runs it on
pull requests and pushes to `main` in
`.github/workflows/auto-qa-interactions.yml`.

## Live Network Tier

Run:

```sh
npm run auto-qa:test:live
```

Files live under `auto-qa/live/`. These tests may call public Futarchy
endpoints and should skip when the network is unavailable. They catch endpoint
drift, but they are intentionally excluded from pull-request CI.

GitHub runs this tier only by manual dispatch or on the weekly Monday schedule
in `.github/workflows/auto-qa-live.yml`.

## Forked-Chain Tier

Run:

```sh
npm run auto-qa:harness:fork
```

This tier runs Playwright scenarios against a local Anvil fork. It may submit
transactions to that local fork, but it must not submit real network writes.
Scenarios join this tier with `ciTiers: ['fork']` and must also declare
`requiresAnvil` or `useAnvilRpcProxy`.

GitHub runs this tier only by manual dispatch or on the weekly Tuesday schedule
in `.github/workflows/auto-qa-fork.yml`. The workflow uses `FORK_URL` from the
manual input, `GNOSIS_FORK_URL`, or the public Gnosis RPC fallback.

## Promoting Scenarios

New scenarios should start unassigned unless they are intentionally part of a
CI tier. Before promotion, run:

```sh
npm run auto-qa:harness:scenarios:by-tier
npm run auto-qa:harness:scenarios:catalog
```

Promote stable browser-only scenarios with `ciTiers: ['interaction']`. Promote
stable forked scenarios with both `ciTiers: ['fork']` and an Anvil requirement
on the scenario itself. Keep live endpoint checks in `auto-qa/live/`; they
remain weekly/manual unless we explicitly decide to make a live check blocking.
