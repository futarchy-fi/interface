# Interaction And Fork Harness

This subtree hosts the UI-side Playwright harness for browser interaction and
forked-chain scenarios.

## What Lives Here

- Playwright config and scenario discovery.
- Wallet stub helpers used by connect, signing, and transaction flows.
- API mock helpers for deterministic browser scenarios.
- Anvil fork helpers for local forked-chain reads and writes.
- Scenario catalog scripts that keep the scenario index and CI tier metadata in
  sync.

The harness is separate from `auto-qa/tests/` so root deterministic checks can
stay cheap while browser and fork tests run in their own explicit tiers.

## Install

From the repo root:

```bash
npm ci
npm --prefix auto-qa/harness ci
```

Root dependencies are required for browser tiers because Playwright starts the
local Next app. Harness dependencies are kept local to this directory.

## Commands

Fast harness-local checks:

```bash
npm run auto-qa:harness:unit
```

Browser interaction scenarios:

```bash
npm run auto-qa:harness:interaction
```

Forked-chain scenarios:

```bash
npm run auto-qa:harness:fork
```

Scenario metadata tools:

```bash
npm run auto-qa:harness:scenarios:by-tier
npm run auto-qa:harness:scenarios:catalog
```

## CI Model

- `auto-qa.yml` runs deterministic root checks and harness-local unit/catalog
  checks on pull requests and pushes to `main`.
- `auto-qa-interactions.yml` runs the interaction tier on pull requests and
  pushes to `main`.
- `auto-qa-fork.yml` runs forked-chain scenarios by manual dispatch or weekly
  schedule only.

The fork tier is intentionally not pull-request blocking because it depends on
external RPC availability and Anvil fork behavior.

## Scenario Tiers

Scenarios with `ciTiers: ['interaction']` run in the interaction workflow.
Scenarios with `ciTiers: ['fork']` run in the fork workflow and must also set
`requiresAnvil` or `useAnvilRpcProxy`. An Anvil requirement alone keeps a
scenario runnable manually, but does not promote it to scheduled CI.
Unassigned scenarios remain cataloged and runnable manually.

## Constraints

- Production code is never modified by the harness.
- Wallet stub behavior should remain close to injected-wallet behavior.
- Real network writes are not allowed. Fork write checks must use local Anvil.
- Live endpoint checks live in `auto-qa/live/`, not in this harness.
