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
| Phase | 5 slices 1+2 landed. Slice 1: browser-injection smoke (Playwright + chromium, EIP-6963 announce, 6 tests). Slice 2: in-page signing via `setupSigningTunnel` exposeBinding — personal_sign / eth_signTypedData_v4 / eth_sendTransaction (live anvil) all working. 9/9 browser tests green in ~5.6s. Phase 4 slices 1+2+3 prior. Phase 5 slices 3/4 + Phase 4 slice 4 still pending. |
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

### Phase 4 — Synthetic wallet + first scripted swap (UI side)

- **slice 1** (this iteration) — wallet stub `createProvider` shipped
  + Spike-002 resolved + nStubWallets shipped + 8-case live-anvil
  test passes.

  - **Spike-002** (`docs/spike-002-eth-subscribe-shim.md`, by
    background agent): `eth_subscribe` over HTTP — anvil 1.5.0 returns
    -32601 directly. viem only emits eth_subscribe via WS/IPC
    transports, never EIP-1193. The futarchy app uses
    `fallback(http(...))` so its watchers already poll. viem's
    `useWaitForTransactionReceipt` hard-codes `poll: true`
    (`waitForTransactionReceipt.ts:200-208`). **Decision: reject
    eth_subscribe with -32601** (3 lines in stub). No shim
    infrastructure needed.

  - `fixtures/wallet-stub.mjs` REWRITTEN from placeholder:
    - `createProvider({privateKey, rpcUrl, chainId})` returns an
      EIP-1193 provider wrapping a viem account
    - 9 wallet-local methods handled in-stub: eth_accounts,
      eth_requestAccounts, eth_chainId, wallet_switchEthereumChain
      (emits chainChanged), wallet_addEthereumChain, personal_sign,
      eth_sign, eth_signTypedData_v4, eth_sendTransaction
    - 14 RPC passthrough methods → forwarded to anvil verbatim
    - 2 subscription methods → reject with -32601
    - `isMetaMask: true` so RainbowKit auto-discovers
    - `installWalletStub` (browser-injection) still throws — that's
      Phase 5
  - `nStubWallets(N)` derives canonical anvil dev addresses from
    foundry mnemonic via viem's `mnemonicToAccount` + HDKey:
    [0]=0xf39F…, [1]=0x7099…, [2]=0x3C44…
  - `tests/smoke-wallet-stub.test.mjs`: 8 cases, 5s runtime
    - 4 constructor-error cases (no config, missing fields, bad types)
    - 2 nStubWallets cases (canonical addresses, n validation)
    - 1 method-classification sanity (sets non-overlapping)
    - 1 LIVE-ANVIL end-to-end: spawns anvil, exercises eth_accounts,
      eth_chainId, wallet_switchEthereumChain (with chainChanged
      emission), eth_blockNumber passthrough, eth_sendTransaction
      (signed via viem, mined, receipt status 0x1, sender debited
      correctly), personal_sign, eth_subscribe rejection
  - npm scripts wired: `wallet:demo`, `smoke:wallet`, `test`;
    root `auto-qa:e2e:smoke:wallet`, `auto-qa:e2e:wallet:demo`

  **Real anvil-fork quirk caught** — pinned in test as a diagnostic:
  on a Gnosis fork, after a successful 1-ETH transfer between anvil
  dev addresses, recipient's `eth_getBalance` reads as 0 (not
  pre+1ETH) even though the tx receipt is `status: 0x1` and the
  sender is debited correctly. NOT a wallet-stub bug — surfaces
  some interaction between anvil's fork mode and pre-funded dev
  accounts. Tracked for follow-up; receipt-status + sender-debit
  are the load-bearing assertions.

- **slice 3** (this iteration) — RESOLVED the recipient-balance
  quirk from slice 1.

  - `scripts/debug-balance-quirk.mjs` (new): spawns anvil, runs the
    same 1-ETH-transfer scenario via RAW JSON-RPC (no viem, no
    wallet stub) across 4 recipient address kinds:
      1. anvil dev[1] (0x70997970…) — recipient credit = -10000 ETH ✗
      2. vanity 0xff…ffff — credit = +1 ETH ✓
      3. fresh random address — credit = +1 ETH ✓
      4. low non-zero 0x0…0001 — credit = +1 ETH ✓

  - **Diagnosis**: anvil's "10000 ETH" auto-funding for dev addresses
    on a fork is a LAZY view — the underlying fork state is whatever
    the address has on Gnosis (~0). On first incoming tx, the lazy
    10000 ETH vanishes and the true fork balance materializes.
    Sender behavior is unaffected. NOT a wallet stub bug; NOT a viem
    bug; pure anvil fork-mode behavior.

  - **Fix** in `tests/smoke-wallet-stub.test.mjs`: switched recipient
    from `wallets[1].address` (anvil dev[1]) to a freshly-generated
    address via `viem.generatePrivateKey() → privateKeyToAccount`.
    Recipient assertion now real: `delta === 1 ETH`. Quirk
    documented in test header for future contributors.

  - All 8 wallet-stub tests pass in ~4s with REAL recipient credit
    asserted (not the previous diagnostic-only stub).

  - `@noble/curves` + `@noble/hashes` were tentatively added during
    debug then dropped — the script uses viem's `generatePrivateKey`
    + `privateKeyToAccount` which already covers fresh-address
    generation. (deps remain in package.json — future cleanup if
    we never need them.)

- **slice 2** (this iteration) — `scripts/contracts.mjs` +
  `tests/smoke-contract-calls.test.mjs`. Foundation for scripted
  contract calls (read + write + event-decode). Reuses the existing
  Gnosis fork — no new contracts to deploy, since the real ones
  ARE already on the fork.

  - `scripts/contracts.mjs`: viem-based helpers (`readContract`,
    `writeContract`, `getReceipt`, `parseEventLogs`, `publicClient`).
    ABIs: `ERC20_ABI`, `WXDAI_ABI` (with WETH9-style Deposit/
    Withdrawal events), `RATE_PROVIDER_ABI`. Address constants for
    `sDAI` (0xaf2…701), `sDAI_RATE_PROVIDER` (0x89C…CeD), `WXDAI`
    (0xe91…97d) sourced from production code.

  - `tests/smoke-contract-calls.test.mjs` (new, 1 test, ~5.5s):
    * READ paths (4): sDAI symbol="sDAI", decimals=18,
      totalSupply=62.4M sDAI (real live state), sDAI rate=1.239
      (real live monotonically-increasing rate)
    * WRITE path: wallet deposits 1 ETH into WXDAI via
      `writeContract`, tx mines (status=0x1), parseEventLogs decodes
      the Deposit(dst, wad) event, balance check confirms +1 WXDAI
      on wallet

  - **Discovery during slice 2**: WXDAI follows the WETH9 pattern —
    `deposit()` emits `Deposit(dst, wad)`, NOT ERC20 `Transfer`.
    Topic hash `0xe1fffcc4923d04b559f4d29a8bfc6cda04eb5b0d3c460751c2402c5c5cc9109c`
    = `keccak256("Deposit(address,uint256)")`. Test initially
    expected `Transfer` and failed; pinpointed via diagnostic of the
    raw log topics. Updated `WXDAI_ABI` and the test header to pin
    the correct event shape. Production code grep confirmed no
    callers assume `Transfer` from WXDAI (no production bug).

  - npm scripts: `smoke:contracts`, `contracts:demo` in harness;
    `auto-qa:e2e:smoke:contracts`, `auto-qa:e2e:contracts:demo`
    at root.

**Smoke summary (UI side, post-Phase 4 slices 1+2+3):**

```
Phase 4 wallet-stub (8 cases)             ✓ ~4s
Phase 4 contract-calls (1 case, 4 reads + 1 write + event decode + bal check)
                                           ✓ ~5.5s
                                  TOTAL: 9 pass + 0 skip
```

**Phase 4 wrap-up — remaining:**

- slice 4 — End-to-end roundtrip test combining wallet stub +
  Phase 3 indexer: send tx via wallet → mine → indexer observes →
  api passthrough returns it. Gated on Docker Desktop start.
- slice 5 (post-Phase 4) — Futarchy-specific contract surface:
  add ABIs for FutarchyProposalFactory, AlgebraPool, sDAI deposit/
  withdraw. Once Phase 3 indexer is live, deposit sDAI then verify
  the futarchy events flow into the indexer + api.

### Phase 5 — Playwright + DOM↔API assertions (UI side)

- **slice 1** (this iteration) — browser-injection smoke. The
  goal: prove the wallet stub installed via Playwright actually
  takes hold in a real chromium page, before we wire it to the
  futarchy app. Kept the slice deliberately narrow: connection +
  read paths only, no signing, no Next.js dev server.

  - **Tooling:**
    - `@playwright/test ^1.59.1` added to harness devDependencies
    - chromium browser binary provisioned via
      `npx playwright install chromium` (~92 MiB headless shell +
      ffmpeg)
    - `playwright.config.mjs` REWRITTEN from placeholder to use
      real `defineConfig({...})`. Single `chromium` project (firefox
      + webkit deferred to Phase 7). `webServer` block auto-launches
      Next.js dev unless `HARNESS_NO_WEBSERVER=1` (slice 1 opts out
      since we're testing pure injection, not the app).

  - **`installWalletStub` browser wrapper** (in
    `fixtures/wallet-stub.mjs`) — was a placeholder that threw, now
    returns a self-executing JS source string suitable for
    `context.addInitScript`. The script:
    * Sets `window.ethereum` with `isMetaMask: true`,
      `isHarness: true`, `selectedAddress`, `chainId`
    * Implements eth_accounts/eth_requestAccounts/eth_chainId/
      wallet_switchEthereumChain (with chainChanged emission) /
      wallet_addEthereumChain in-page
    * Rejects signing methods with -32601 (slice 2 will inline
      @noble/secp256k1 to enable in-page signing)
    * Rejects subscription methods with -32601 per Spike-002
    * Forwards all other methods (eth_blockNumber, eth_call, etc.)
      via `fetch` to the configured RPC URL
    * Announces itself via EIP-6963 `announceProvider` event +
      listens for `requestProvider` to re-announce (lets
      RainbowKit's discovery mechanism find it even if Wagmi
      hydrates before injection finishes)
    * Dispatches `ethereum#initialized` for late-hydrating dApps
    * Address is derived in node from privateKey (no viem
      bundled into the page)

  - **`flows/wallet-injection.spec.mjs`** — first browser-context
    test file. 6 cases against `about:blank`, all green in 2.4s:
    1. window.ethereum exposes the configured address + chain
       (hasEth, isMetaMask, isHarness, accounts, chainId,
       selectedAddress)
    2. wallet_switchEthereumChain emits chainChanged + new
       eth_chainId reflects the switch
    3. eth_subscribe rejected with -32601 (per Spike-002)
    4. Signing methods (personal_sign, eth_signTypedData_v4,
       eth_sendTransaction) all rejected with -32601 (slice 2
       will enable)
    5. EIP-6963 announcement fires — listener registered before
       requestProvider dispatch catches the replay
    6. eth_blockNumber forwards to the configured RPC

  - **CORS / null-origin gotcha resolved**: First attempt at the
    eth_blockNumber test ran a real http server and made the page
    fetch it cross-origin. Failed with "TypeError: Failed to fetch"
    even after adding permissive CORS headers + OPTIONS preflight.
    Root cause: chromium drops fetches from `about:blank` (null
    origin) to local addresses regardless of CORS. **Fix**: switched
    to `context.route(MOCK_RPC_URL, ...)` — Playwright intercepts
    at the network layer before chromium's null-origin check, so the
    fetch never has to leave the browser. Pinned in the test header
    so future contributors don't re-litigate.

  - **npm scripts wired**: `ui` / `ui:ui` / `ui:report` in
    harness `package.json`; `auto-qa:e2e:ui` and `auto-qa:e2e:ui:ui`
    at interface root.

**Smoke summary (UI side, post-Phase 5 slice 1):**

```
Phase 4 wallet-stub (8 cases, node:test + live anvil)  ✓ ~4s
Phase 4 contract-calls (1 case, reads+write+event)     ✓ ~5.5s
Phase 5 wallet-injection (6 cases, chromium)           ✓ ~2.4s
                                       TOTAL: 15 pass + 0 skip
```

- **slice 2** (this iteration) — in-page signing via tunnel.
  Original plan said "inline @noble/secp256k1 in the page"; took
  a sharply better path: use Playwright's `exposeBinding` to
  register a node-side handler that the in-page stub calls for
  any SIGNING_METHODS request. The privateKey lives in node, the
  page only sees the signature/hash result, and we reuse viem's
  well-tested `signMessage` / `signTypedData` / `sendTransaction`
  helpers — ~30 lines of fixture code instead of bundling and
  embedding ~30 KB of ESM crypto + EIP-712 hashing + EIP-1559
  serialization as a string blob in `addInitScript`.

  - **`setupSigningTunnel(context, {privateKey, rpcUrl, chainId})`**
    in `fixtures/wallet-stub.mjs`:
    * Validates inputs, builds a viem `walletClient` with
      `account = privateKeyToAccount(privateKey)` + `chain` +
      `transport: http(rpcUrl)`
    * Calls `context.exposeBinding('__harnessSign', handler)` so
      every page in the context gets `window.__harnessSign`
    * Handler dispatches on method:
        - `personal_sign` / `eth_sign` →
          `walletClient.signMessage`
        - `eth_signTypedData_v4` → parses JSON, calls
          `walletClient.signTypedData`
        - `eth_sendTransaction` → `walletClient.sendTransaction`
          (viem fetches nonce/chainId/gas + signs + broadcasts +
          returns tx hash)
    * Address mismatches throw with a clear message; viem-level
      errors propagate

  - **In-page stub change** (`installWalletStub` in same file):
    when a SIGNING_METHODS request comes in, check
    `typeof window.__harnessSign === 'function'`. If yes, forward
    via the binding and re-shape the result/error so EIP-1193's
    `.code` field is preserved. If no, keep slice-1 behavior and
    reject -32601. This means slice-1's "signing methods rejected"
    test STILL passes unchanged (no tunnel installed = no
    signing = -32601). Confirmed in the green re-run.

  - **`flows/wallet-signing.spec.mjs`** — 3 browser tests, all
    green in ~5s combined:
    1. `personal_sign` — page calls
       `eth_accounts` then `personal_sign("Hello, harness! …")`,
       node uses `viem.recoverMessageAddress({message, signature})`
       and asserts equality with `wallet.address`
    2. `eth_signTypedData_v4` — minimal `Greeting{from,message}`
       EIP-712 payload; page signs; node uses
       `viem.recoverTypedDataAddress({...payload, signature})`;
       asserts equality
    3. `eth_sendTransaction` — spawns local anvil (skips when
       missing) and sends 0.5 XDAI from the wallet to a freshly-
       generated recipient (the dev-account lazy-funding quirk
       from Phase 4 slice 3 still applies, so recipient must be
       fresh). Polls `eth_getTransactionReceipt` because viem
       returns the hash before anvil's auto-mine settles.
       Asserts `receipt.status === '0x1'` and recipient balance
       == 0.5 XDAI

**Smoke summary (UI side, post-Phase 5 slice 2):**

```
Phase 4 wallet-stub (8 cases, node:test + live anvil)  ✓ ~4s
Phase 4 contract-calls (1 case, reads+write+event)     ✓ ~5.5s
Phase 5 wallet-injection (6 cases, chromium)           ✓ ~2.4s
Phase 5 wallet-signing (3 cases, chromium + anvil)     ✓ ~5.6s
                                       TOTAL: 18 pass + 0 skip
```

**Phase 5 — remaining slices:**

- slice 3 — drop `HARNESS_NO_WEBSERVER`, let Playwright launch the
  Next.js dev server, navigate to a real page, and confirm
  Wagmi/RainbowKit auto-discovers the harness wallet via the
  EIP-6963 announcement.
- slice 4 — the canonical Phase 5 invariant: navigate to a
  proposal page, scrape the visible price, compare to the api
  response that produced it.
