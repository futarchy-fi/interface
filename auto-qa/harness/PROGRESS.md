# Forked Replay Harness — Progress

End-to-end test harness that forks Gnosis at a past block, replays a futarchy
proposal lifecycle with synthetic users, and asserts cross-layer agreement
(chain ↔ indexer ↔ api ↔ frontend) at every block.

The harness spans both `futarchy-fi/futarchy-api` and `futarchy-fi/interface`.
This file is mirrored across both repos. UI infra (Playwright fixtures,
page-object models, wallet stubs) is hosted here; server-side infra (anvil,
indexer, api) lives in `futarchy-api/auto-qa/harness/`.

## Status

| Field | Value |
|---|---|
| Phase | 3 — slices 1-5 in futarchy-api: roundtrip invariant test ships (anvil mines → indexer follows via bootstrapAfterStart). 25 smoke tests pass + 4 skips (all docker-up-gated). UI side waits for Phase 4-5. |
| Branch | `auto-qa` (both repos) |
| Location | `auto-qa/harness/` in both `interface` and `futarchy-api` |
| Runner | `npm run auto-qa:e2e` (separate from `npm run auto-qa:test`) |
| Owner | TBD |
| First-pass deadline | TBD |

## Effort breakdown (rough, per component)

| Component | Effort | Notes |
|---|---|---|
| Anvil fork + block clock + tx replay | S (1 wk) | Foundry already does this |
| Synthetic wallet stub for Playwright | M (2 wk) | Synpress mostly works; futarchy custom auth flows are the gotcha |
| Local Checkpoint indexer in CI | L (3 wk) | Schema migrations + warm-up time make this brittle |
| Cross-layer invariant DSL + assertion library | M (2 wk) | Has to be readable enough to debug failures |
| Scenario library (5-10 historical replays) | L (3 wk) | Each historical proposal needs careful state capture |
| OCR / DOM-equivalent price extraction | M (2 wk) | Brittle without good test IDs in the UI |
| Chaos injection + RPC fault library | S (1 wk) | tc/iptables wrapper |
| CI infra (compose, artifact capture, video on fail) | M (2 wk) | Probably the biggest day-2 cost |
| **Total** | **~3-4 months for one engineer** | |

## Phasing

Each phase is independently useful — we can stop at any phase boundary and
still have value.

| # | Phase | Effort | Stop-here value |
|---|---|---|---|
| 0 | Scaffold | 1-2 hrs | `harness/` dirs, deps, README, npm script skeleton, PROGRESS entries |
| 1 | Anvil fork + block clock | ~1 wk | Deterministic time control over a forked Gnosis chain |
| 2 | Chain ↔ api agreement (1 invariant) | ~1 wk | First cross-layer check working end-to-end |
| 3 | Local Checkpoint indexer in-loop | ~3 wks | Indexer reconciles with chain after each block |
| 4 | Synthetic wallet + first scripted swap | ~2 wks | Real on-chain mutation, full chain↔indexer↔api check |
| 5 | Playwright + DOM↔API assertions | ~3 wks | Frontend in the loop; UI consistency catches |
| 6 | Scenario library (replay 1 historical proposal) | ~2 wks | First "real bug shape" replayable |
| 7 | Chaos injection + nightly CI | ~2 wks | Production-shape resilience signal |

## Architecture

```
                ┌───────────────────────────────────────────────┐
                │  Orchestrator (Node test runner)              │
                │  - block clock, scenario script, assertions   │
                └─────┬──────────────┬───────────────┬──────────┘
                      │              │               │
              ┌───────▼──────┐  ┌────▼──────┐   ┌────▼──────┐
              │ Anvil fork   │  │ Local     │   │ Playwright│
              │ Gnosis @ N   │◄─┤ Checkpoint│   │ + N tabs  │
              │ JSON-RPC     │  │ indexer   │   │ (wallets) │
              └───┬──────────┘  └────┬──────┘   └────┬──────┘
                  │                  │               │
                  │             ┌────▼─────┐    ┌────▼──────┐
                  └────────────►│ futarchy │◄───┤ Next.js   │
                                │   -api   │    │ (frontend)│
                                └──────────┘    └───────────┘
```

Single docker-compose starts all four services. Orchestrator owns the clock.

## Cross-layer invariants

| Layer A | vs | Layer B | Invariant |
|---|---|---|---|
| chain | vs | indexer | every Swap event present, same token amounts, same sqrtPrice |
| indexer | vs | api `/candles/graphql` | candle aggregates match raw swaps |
| api `/spot-candles` | vs | api `/candles/graphql` | rate-applied prices reconcile |
| api `/v2/.../chart` | vs | indexer raw | unified-chart shape consistent |
| frontend DOM | vs | api response | every visible price/volume/TVL matches the API call that produced it |
| playwright wallet swap | vs | chain receipt | tx mined, balance delta correct, conditional tokens minted |

## Economic invariants (always-on)

- **Conservation**: ∑(YES + NO conditional tokens) = ∑(sDAI deposited) at every block
- **Monotonicity**: TWAP window endpoints respect contract's `min(now, twapEnd)` clamp
- **Probability**: price ∈ [0, 1] for PREDICTION pools
- **No phantom mints**: `balanceOfBatch` sums match historical + synthetic deposits
- **Rate sanity**: sDAI rate from on-chain `getRate()` ≥ 1 and monotonically increasing

## Bug shapes this catches that nothing else can

- Indexer/chain divergence after a reorg or schema change
- Frontend showing stale numbers when the API is healthy (PR #64 shape)
- Conservation breaks from new merge/split paths
- TWAP window off-by-one at the resolution boundary (PR #54 shape)
- BUY/SELL inversion regressions in `subgraphTradesClient.js`
- Multi-RPC fallback being silently broken
- Wallet-flow regressions in `useFutarchy`
- Cross-protocol price drift between Algebra / CoW / Sushi quoters

## Open decisions (deferred to per-phase work)

- **Foundry vs Hardhat** for the fork — leaning Foundry/anvil (faster, simpler RPC)
- **Local Checkpoint vs subgraph** — Checkpoint matches production but harder to bootstrap
- **Synpress vs custom wallet stub** for Playwright — Synpress is canonical but futarchy's custom flows may need extension
- **Scenario capture format** — JSON snapshot of (block range, tx list, expected end-state) vs full state-dump replay
- **CI execution model** — nightly cron vs manually-triggered workflow vs PR-gated

## Iteration log

### Phase 0 — Scaffold

- **slice 1** — README, harness package.json with stub scripts,
  .gitignore, root `npm run auto-qa:e2e` wired through
  `npm --prefix auto-qa/harness run phase-status`. Verified the stub
  prints the phase status from the repo root. No deps installed yet.

- **slice 2** — `playwright.config.mjs` skeleton committed as PLAIN JS
  (NOT importing `@playwright/test` since it's not installed yet).
  Documents the eventual config: testDir → flows/, browser matrix
  (chromium-first, firefox/webkit deferred to Phase 7), trace/screenshot/
  video on failure, baseURL from `HARNESS_FRONTEND_URL` env, webServer
  block to auto-launch local Next.js dev server, viewport 1440x900,
  120s test timeout. Self-test mode prints the planned shape.

- **slice 3** — `fixtures/wallet-stub.mjs` placeholder. Exports
  `REQUIRED_METHODS` (18 EIP-1193 methods derived from grep across the
  futarchy interface — eth_accounts, eth_requestAccounts, eth_chainId,
  wallet_switchEthereumChain, wallet_addEthereumChain, personal_sign,
  eth_signTypedData_v4, eth_sendTransaction, eth_estimateGas,
  eth_gasPrice, eth_getTransactionReceipt, eth_getTransactionByHash,
  eth_call, eth_getBalance, eth_blockNumber, eth_getCode, eth_subscribe,
  eth_unsubscribe) and `REQUIRED_EVENTS` (5 events).
  `installWalletStub` + `nStubWallets` throw "not implemented" with
  pointers to ADR-001.

- **slice 4** — `ARCHITECTURE.md` cross-repo handshake doc. Identical
  copy lives in `futarchy-api/auto-qa/harness/ARCHITECTURE.md`.
  Documents the 5-service topology, repo split table, boot sequence,
  invariant catalogue, sibling-clone instructions, and 5 deferred
  open questions.

- **slice 5** — `docs/ADR-001-synpress-vs-custom-stub.md` written by
  background agent. **Decision: custom EIP-1193 stub.** Injected via
  Playwright `addInitScript`, announced as an EIP-6963 provider for
  RainbowKit auto-discovery, wraps an `ethers.Wallet` (v5, matching the
  main app), proxies non-signing methods to anvil. Wins on multi-account
  parallelism, anvil dev-key handling, ~0 MB CI footprint, sub-50 ms
  per-context boot, cross-browser reach, and a stable 9-method
  maintenance surface. Synpress only wins on real-MetaMask UX realism
  + complete EIP-1193 coverage; both addressed later via a separate
  nightly smoke. Risk to address before Phase 5: 1-day spike on
  `eth_subscribe` shim.

- **slice 6** — `npm install` ran cleanly in `auto-qa/harness/`,
  generating `package-lock.json` (304 bytes — empty deps tree, but
  reproducible for future additions). Verified no pollution of root
  `package.json` install.

- **slice 7** — `docker compose config` validation handled on the
  futarchy-api side (the compose file lives there); on this side
  Phase 0 has no compose surface to validate. Verified that the npm
  scripts in `auto-qa/harness/package.json` resolve cleanly via
  `npm run` from the harness dir.

- **slice 8** — `CHECKLIST.md` mirrored across both repos. Enumerates
  Phase 0 → Phase 7 readiness gates plus 3 cross-cutting acceptance
  gates (no production code mods, no real mainnet RPC during runs,
  harness deps isolated from root). All Phase 0 mechanical items
  checked; 2 human-gated items remain (ADR human review + full
  sister-link clone verification on a clean machine).

**Phase 0 status: code-complete.** Two human-gated items in
`CHECKLIST.md` remain before declaring Phase 0 done and starting
Phase 1:

  1. Both ADRs reviewed by a human + status changed from "Proposed"
     to "Accepted"
  2. Sister-link verified: a fresh `git clone` of both repos in
     `~/code/futarchy-fi/` runs `docker compose config` cleanly
     (the snippet in `ARCHITECTURE.md` is correct as written, but
     hasn't been exercised on a clean machine yet)

**UI-side Phase 4-5 starting work (queued for after Phase 1-3):**

- `eth_subscribe` shim spike (1-day, per ADR-001 risk)
- `npm i -D @playwright/test` in `auto-qa/harness/`
- Browser binary install via `npx playwright install chromium`
- Replace TODO in `installWalletStub` with EIP-6963 announcement +
  ethers.Wallet wrapping
- `nStubWallets(N)` derive deterministic addresses from anvil mnemonic
