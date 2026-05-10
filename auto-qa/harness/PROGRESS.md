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
| Phase | 5 done + Phase 6 fully done + Phase 7 slices 1+2 done + Phase 7 slices **3a + 3c + 3d** STAGED on interface side + Phase 7 slice **3e** (smoke-tests CI) STAGED on api side + Phase 7 slices **4a-prep + 4a + 4b-plan + 4b-include + 4b-api-env + 4b-network-wire + 4c-prep + 4c-activate + 4d-prep + 4d-scenarios (scaffold) + 4d-activate + 4d-scenarios-more (apiCanReachCandles + registryDirect + candlesDirect + rateSanity + anvilBlockNumber + anvilChainId + apiWarmer + apiSpotCandlesValidates + registryHasProposalEntities + candlesHasPools + candlesHasSwaps + candlesHasCandles + registryHasOrganizations + registryHasAggregators + candleOHLCOrdering + candleVolumesNonNegative + swapAmountsPositive + swapTimestampSensible + candleTimeMonotonic + swapTimeMonotonicNonStrict + apiCandlesMatchesDirect + apiRegistryMatchesDirect + swapPoolReferentialIntegrity + candlePoolReferentialIntegrity + candleSwapTimeWindowConsistency + organizationAggregatorReferentialIntegrity + proposalEntityOrganizationReferentialIntegrity + apiSpotCandlesHappyPath + apiUnifiedChartShape + apiMarketEventsShape + anvilLatestBlockSensible + probabilityBounds + candlePricesNonNegative + chartCandleCountsBoundedByDirect + swapAmountsBoundedAbove + poolTypeIsValidEnum + registryHasFutarchyProdAggregator + apiUnifiedChartHasObservabilityHeaders + anvilClientVersionMentionsAnvil + chartCandlesAreSubsetOfDirect + anvilGasPricePresent + apiUnifiedChartXCacheTtlPresent + anvilNetworkVersionMatchesChainId + anvilImpersonationCapabilityPresent + anvilSnapshotCapabilityPresent + swapAmountsAllRowsPositive + apiHealthBodyShape)** on api side (`docker compose config --services` returns 8 — full stack STRUCTURALLY COMPLETE; orchestrator now ships with **49 invariants**: 13 api-internal + 27 indexer + 9 chain-layer; first body-shape probe on /health (catches LB string-match breakage + timestamp-format regressions invisible to status-code-only checks); 164 smoke tests green). CI workflows still await maintainer promotion. 30/30 browser tests green; drift check <1 min, scenarios suite ~5-10 min cold. |
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

- **slice 3a** (this iteration) — futarchy Next.js dev server in
  the loop. First slice that actually navigates to a real page
  served by the futarchy app, instead of `about:blank`. The goal:
  prove `addInitScript` runs early enough that `window.ethereum`
  is set BEFORE app code (React, Wagmi, RainbowKit) reads it.

  - **`flows/app-discovery.spec.mjs`** — single test that:
    1. Skips when `HARNESS_NO_WEBSERVER=1` (slice 1+2 mode)
    2. Installs the wallet stub via `addInitScript` BEFORE goto
    3. Navigates to `/` (futarchy homepage) — `domcontentloaded`
       wait
    4. Asserts `window.ethereum.{isMetaMask,isHarness,
       selectedAddress}` from the page context match what was
       configured in node

  - **Bug fix discovered along the way**: slice 1's webServer
    block had `npm --prefix ../../.. run dev` — but from
    `auto-qa/harness/` that resolves to `/Users/kas/`, not the
    interface root. We never noticed because slice 1 + 2 ran with
    `HARNESS_NO_WEBSERVER=1`. Corrected to `../../`. Bumped
    webServer timeout from 120s to 180s (cold Next.js compile
    can take 30-90s).

  - **New npm scripts**: `ui:full` (drops HARNESS_NO_WEBSERVER) and
    `ui:full:ui` (interactive) in harness; `auto-qa:e2e:ui:full`
    and `auto-qa:e2e:ui:full:ui` at root.

  - **Knob**: `HARNESS_FRONTEND_RPC_URL` overrides the dev
    server's `NEXT_PUBLIC_RPC_URL`. For this iteration, used
    `https://rpc.gnosischain.com` so the app can hydrate cleanly
    without needing a local anvil. Slice 3 onwards will swap to
    `http://localhost:<anvil>` once anvil is bundled into the
    full harness lifecycle.

  - **Validated end-to-end** — single run, cold Next.js compile,
    test passes:
    ```
    Phase 5 slice 3a app-discovery (1 case)              ✓ ~1.7s
    + cold Next.js compile + first navigation             ~17s
    Total wall-clock                                      ~20s
    ```

  - **Compile-time noise observed (pre-existing, not harness-
    introduced)**: MetaMask SDK warns about missing optional
    `@react-native-async-storage/async-storage`; Next.js warns
    about a `<script>` tag in `next/head`. Both are app issues
    that don't break hydration; flagged here for context.

- **slice 3b** (this iteration) — RainbowKit Connect modal
  assertion. The slice 1 EIP-6963 test verified the announce
  fires against a synthetic listener; slice 3b verifies it
  actually reaches RainbowKit's discovery in the real app and
  surfaces our wallet by name in the connect modal. Slim test:

    1. Install wallet stub (no signing tunnel — modal-listing
       doesn't require signing)
    2. Navigate to `/companies` (Header runs in `app` config
       there; `/` is landing-only with just "Launch App")
    3. Click the "Connect Wallet" button (text-based locator;
       `.first()` because Header renders both desktop + mobile)
    4. `expect(page.getByText('Futarchy Harness Wallet'))
       .toBeVisible({timeout: 15s})` — the EIP-6963 announce
       reaches RainbowKit's modal and our wallet is listed by
       name from the EIP-6963 `info.name`

  - **Validated end-to-end** — both slice 3a + 3b tests pass
    against the warm dev server in 14.3s wall-clock (3.4s for
    slice 3b alone, including modal open animation + wallet-
    list render).

  - **Stretch deferred**: clicking the wallet in the modal and
    asserting a successful connect (account address visible in
    the header). Skipped for now because the post-click selectors
    are RainbowKit-version-sensitive; revisit during Phase 6
    scenario work where we actually need a connected wallet to
    drive a real swap.

- **slice 4 v1** (this iteration) — DOM↔API invariant
  **mechanism** proven end-to-end against the real futarchy app.
  Slice 4 v1 deliberately scopes down to a non-numeric value
  (an org name) so the mechanism lands first; numeric-price
  sub-slices follow once we know which formatter to assert
  against.

  - **Path picked**: `/companies` → `useAggregatorCompanies` hook
    → 3 GraphQL POSTs to `https://api.futarchy.fi/registry/graphql`
    (aggregator → organizations → proposalentities) →
    `transformOrgToCard(org).title = org.name` → renders in both
    `<CompaniesListCarousel>` (card) and `<OrganizationsTable>`
    (row). Found by reading
    `src/hooks/useAggregatorCompanies.js` +
    `src/config/subgraphEndpoints.js`.

  - **`flows/dom-api-invariant.spec.mjs`**:
    - `context.route('https://api.futarchy.fi/registry/graphql')`
      with a handler that parses POST body, dispatches on
      whether `query` contains `aggregator(id:` /
      `organizations(where:` / `proposalentities(where:`, and
      returns the canned response for each (probe values for
      aggregator + org, empty list for proposalentities)
    - Records call sequence so a future failure where the page
      DIDN'T issue the expected query is easy to diagnose
    - Navigates to `/companies`, asserts probe name visible in
      the DOM within 30s
    - Bonus: asserts `count() >= 1` so a future regression that
      drops one of the rendering paths still surfaces here

  - **First-run gotcha resolved**: assertion failed initially
    with strict-mode "resolved to 2 elements" — the probe value
    rendered in BOTH the card AND the table row. That's a feature,
    not a bug (the mock propagated through two independent
    consumers); switched to `.first()` + `count >= 1` and the
    test passes.

  - **Validated end-to-end**: 1 test, 3.3s. Wall-clock with
    warm dev server: 12.6s.

- **slice 4b** (this iteration) — first NUMERIC value through
  the mock → DOM-cell pipeline. Uses the same
  `flows/dom-api-invariant.spec.mjs` test file and the same
  `/companies` data path as 4a, so we get pure numeric-vs-string
  isolation: only the proposalentities mock changes between the
  two tests.

  - **Refactor**: extracted `makeGraphqlMockHandler({proposals,
    onCall})` into a parameterized helper. Tests pass different
    proposal lists; the handler dispatches identically. Shared
    `fakeProposal(idSuffix, metadataExtra)` builds a stub row in
    the shape `useAggregatorCompanies` expects.

  - **Test setup**: 8 proposals with empty metadata + 3 with
    `metadata = JSON.stringify({visibility: 'hidden'})`. Per
    `transformOrgToCard`:
    * `nonArchived` = `proposals.filter(!archived)` → 11
    * `active` = `nonArchived.filter(!hidden && !resolved)` → 8
    So `org.activeProposals` = 8 and `org.proposalsCount` = 11.

  - **Assertion**: scope to the row containing PROBE_ORG_NAME
    (must be unique — `toHaveCount(1)`), then assert
    `td.nth(2)` (Active column) = "8" and `td.nth(3)` (Total) =
    "11". Column indices come from
    `OrganizationsTable.jsx::<thead>` (Logo | Name | Active |
    Proposals | Chain).

  - **Validated end-to-end**: 1 test, 2.3s. Both 4a + 4b
    together: 15s wall-clock with warm dev server.

  - **Bug-shape this catches**: a regression in
    `transformOrgToCard`'s visibility filter (e.g. flipping the
    `!hidden` predicate, or accidentally including resolved
    proposals in active count) would surface as the active-cell
    showing "11" instead of "8". A regression in the underlying
    `parseMetadata` (e.g. crashing on JSON-stringified metadata
    instead of treating the missing field as undefined) would
    surface as both cells showing "0".

- **slice 4c v1** (this iteration) — int → enum mapping
  formatter through the same `/companies` data path. 4a proved
  string passthrough, 4b proved integer toString through filter
  logic, 4c v1 proves int → enum lookup. The original 4c spec
  (currency-formatted price like "$0.42") is more complex and
  needs a different page; staged as 4c v2 so we can keep
  shipping per-iteration.

  - **Refactor**: extended `makeGraphqlMockHandler` to accept
    `orgMetadata` — the string written to
    `organizations[0].metadata`. Defaults to `null` (4a/4b
    behavior unchanged); 4c sets it to
    `JSON.stringify({chain: '10'})`.

  - **Data flow**: per `useAggregatorCompanies::transformOrgToCard`:
    ```
    const meta = parseMetadata(org.metadata);  // JSON.parse
    const chainId = meta.chain ? parseInt(meta.chain, 10) : 100;
    ```
    Per `ChainBadge::CHAIN_CONFIG`:
    ```
    1 → 'ETH', 10 → 'Optimism', 100 → 'Gnosis',
    137 → 'Polygon', 42161 → 'Arbitrum'
    ```

  - **Test setup**: mock `metadata = JSON.stringify({chain: '10'})`,
    assert the row's chain cell (`td.nth(4)`) shows
    "Optimism". Default chainId=100 would render "Gnosis", so
    a regression in any link of the chain
    (parseMetadata / parseInt / CHAIN_CONFIG entry / ChainBadge
    rendering) lights up here.

  - **Validated end-to-end**: 1 new test, 1.4s. All 3
    dom-api-invariant tests together (4a + 4b + 4c): 21s
    wall-clock with Next.js cold compile.

  - **Bug-shapes this catches**:
    * `parseInt(meta.chain, 10)` breaks if someone changes
      `meta.chain` to expect a number (would render "Chain NaN")
    * `CHAIN_CONFIG[10].shortName` → silent rename ("Op" instead
      of "Optimism") would surface
    * `transformOrgToCard` regression that drops the chainId
      derivation would default to 100 → "Gnosis" instead

- **slice 4c v2** (this iteration) — chain enum FALLBACK
  formatter (template-literal branch). Same data path as 4c v1
  but exercises the OTHER branch in `ChainBadge.jsx` —
  the dynamic-template formatter that runs when the chainId
  isn't in CHAIN_CONFIG.

  - **Data flow**: mock `metadata.chain = '999'` →
    `parseInt('999', 10) = 999` → CHAIN_CONFIG[999] is undefined
    → fallback `{shortName: \`Chain ${chainId}\`}` →
    `td[4]` shows "Chain 999".

  - **Why a separate test from 4c v1**: 4c v1 covers the
    lookup-table branch (chainId in CHAIN_CONFIG). 4c v2 covers
    the fallback branch — a different code path that catches a
    different bug shape. A regression that drops the fallback
    case (e.g., crashes on missing key, or renders empty when
    the key is missing) would surface here, not in 4c v1.

  - **Validated end-to-end**: 1 new test, 1.4s. All 4
    dom-api-invariant tests together: 20.3s wall-clock with
    Next.js cold compile.

  - **Why staging the original 4c (currency) as 4c v3**: real
    currency formatting (`(v).toFixed(2) + ' ' + baseTokenSymbol`,
    `(v * 100).toFixed(0) + '%'`) lives in `HighlightCards` /
    `EventHighlightCard`, fed by the `collectAndFetchPoolPrices`
    pipeline that hits `api.futarchy.fi/candles/graphql` (a
    DIFFERENT endpoint from the registry one we already mock).
    Mocking it requires seeding each proposal with valid
    `prediction_pools`/`pools` references AND mocking the candles
    endpoint with matching pool prices. Larger lift; staged for
    a dedicated iteration so we can keep shipping per-tick.

- **slice 4c v3a** (this iteration) — candles pipeline
  plumbing. Splits the original 4c v3 ambition into two
  iterations: v3a proves the network reaches the candles
  endpoint with the right inputs; v3b (next) asserts the
  formatted DOM string. Plumbing-first because the candles
  pipeline involves a SECOND fetcher path
  (`fetchProposalsFromAggregator` from `useAggregatorProposals.js`,
  not `useAggregatorCompanies` — they query the same registry
  endpoint with DIFFERENT field selections, then the carousel
  side calls `collectAndFetchPoolPrices` which is the new bit).

  - **New fixtures in the test file**:
    * `CANDLES_GRAPHQL_URL` constant
    * `PROBE_POOL_YES` / `PROBE_POOL_NO` /
      `PROBE_PROPOSAL_ADDRESS` — distinctive addresses so any
      candles request mentioning them is unambiguously ours
    * `fakePoolBearingProposal({...})` — builds a proposal row in
      the carousel-side shape (includes `displayNameEvent`,
      `displayNameQuestion`, `description`, `proposalAddress`,
      `owner`); embeds `metadata.conditional_pools.{yes,no}.address`
    * `makeCandlesMockHandler({prices, onCall})` — parses the
      bulk-fetcher's `pools(where: id_in: [...])` query, returns
      only the pools the test seeded prices for, optionally
      records each query's address list

  - **Test "slice 4c v3a"**:
    1. Mock REGISTRY with our pool-bearing proposal
    2. Mock CANDLES with prices for both probe pool addresses;
       record each call's address list
    3. Navigate to `/companies` (which renders the carousel)
    4. `expect.poll(() => candlesCalls.length).toBeGreaterThan(0)`
    5. Assert the flattened address list contains
       `PROBE_POOL_YES`

  - **Validated end-to-end**: the carousel hits the candles
    endpoint, the bulk fetcher's `id_in` query carries our
    probe address, and our mock returns the price.
    Test runtime: 1.7s (full dom-api-invariant suite: 24.4s).

  - **What v3a deliberately doesn't do**: assert the DOM. The
    carousel might render a card variant that doesn't display
    the YES price (e.g., the resolved-event renderer), or it
    might filter our proposal due to the placeholder
    `proposalAddress`. v3b will trace which card path renders
    and which formatter's output is the visible string.

- **slice 4c v3b** (this iteration) — **THE CANONICAL PHASE 5
  INVARIANT, WIRED.** Built directly on v3a's plumbing: the
  candles mock now returns a known YES price (0.42) for our
  probe pool, and we assert the formatter's exact output string
  appears in the visible DOM.

  - **Path traced** (registry → candles → carousel → card →
    formatter → DOM):
    1. `EventsHighlightCarousel` calls
       `fetchEventHighlightData('all', {connectedWallet})`
    2. → `fetchProposalsFromAggregator(DEFAULT_AGGREGATOR)` →
       hits REGISTRY → returns proposals (our mocked one,
       enriched via `transformProposalToEvent` which derives
       `poolAddresses: {yes, no}` from
       `metadata.conditional_pools`)
    3. → `collectAndFetchPoolPrices(events)` → groups pools by
       chain, hits CANDLES with `pools(where: id_in: [...])` →
       returns `priceMap`
    4. → `attachPrefetchedPrices(events, priceMap)` mutates
       each event: `event.prefetchedPrices = {yes, no, source}`
    5. carousel renders `<EventHighlightCard prefetchedPrices=…/>`
       (`useNewCard=false` is the CompaniesPage default — checked)
    6. `useLatestPoolPrices` short-circuits to prefetched
       values when present
    7. Formatter: `${prices.yes.toFixed(precision)} ${baseTokenSymbol}`
       — precision=4 because YES<1 triggers the high-precision
       branch; baseTokenSymbol='SDAI' because
       `metadata.currencyTokens.base.tokenSymbol` is unset →
       DOM string **"0.4200 SDAI"**

  - **Test "slice 4c v3b"**:
    1. Mock REGISTRY with `fakePoolBearingProposal({})`
       (proposalAddress / displayNames / conditional_pools all
       set to PROBE_* constants)
    2. Mock CANDLES with `prices: {[YES]: 0.42, [NO]: 0.58}`
    3. Navigate to `/companies`
    4. Pre-flight assertion: event title
       "HARNESS-PROBE-EVENT-001" visible (proves the proposal
       got past visibility/resolved/etc. filters)
    5. Canonical assertion: "0.4200 SDAI" visible (proves the
       full formatter chain renders the mocked price)

  - **Validated end-to-end** — passed first try. Test runtime:
    1.3s in parallel, 3.8s solo. Full 6-test
    dom-api-invariant suite: 22.6s wall-clock with cold compile.

  - **Bug-shapes this catches** (the load-bearing one):
    * Stale-price-but-API-healthy class (PR #64 shape from
      interface): if the prefetched-price path got short-
      circuited or `attachPrefetchedPrices` no-op'd, the card
      would fall back to its own per-pool fetch (which we DON'T
      mock here) and show "0.00 SDAI" or LoadingSpinner. The
      assert-on-"0.4200 SDAI" lights up that regression.
    * Formatter precision regression: dropping the
      `shouldUseHighPrecision` check would render "0.42 SDAI"
      instead of "0.4200 SDAI" → fails immediately.
    * baseTokenSymbol fallback regression: changing the default
      from 'SDAI' to e.g. 'XDAI' → fails immediately.

**Smoke summary (UI side, post-Phase 5 slice 4c v3b):**

```
Phase 4 wallet-stub (8 cases, node:test + live anvil)  ✓ ~4s
Phase 4 contract-calls (1 case, reads+write+event)     ✓ ~5.5s
Phase 5 wallet-injection (6 cases, chromium)           ✓ ~2.4s
Phase 5 wallet-signing (3 cases, chromium + anvil)     ✓ ~5.6s
Phase 5 app-discovery (2 cases, chromium + Next.js)    ✓ ~14s
Phase 5 dom-api-invariant (6 cases, chromium + Next.js) ✓ ~14s
                                       TOTAL: 26 pass + 0 skip
```

**Phase 5 status: substantively COMPLETE.** The CHECKLIST gate
("First DOM↔API check: navigate to a proposal page, scrape the
visible price, compare to the api response that produced it") is
met — slice 4c v3b is exactly that, and v3a/v2/v1/4b/4a are the
on-ramps to it.

**Remaining sub-slice (deferred, not Phase 5 acceptance-critical):**

- **4d** — cross-protocol price reconciliation: when multiple
  sources (Algebra / CoW / Sushi) should agree, mock each to
  slightly-different values and assert the UI either flags the
  divergence or picks the right canonical source. Catches the
  BUY/SELL inversion / multi-RPC silent breakage bug shapes.
  More advanced bug-probe; can land out-of-order with Phase 6.

### Phase 6 — Scenario library (UI side)

- **slice 1** (this iteration) — scenario format decided.
  CHECKLIST gate "Scenario capture format decided (JSON snapshot
  vs full state dump)" was originally framed in chain-snapshot
  terms. The actual design space turned out broader (4 options:
  pure JSON, executable `.scenario.mjs` modules, naming
  conventions on regular `.spec.mjs` files, full anvil state
  dump). The trade-offs are walked through in
  `interface/auto-qa/harness/docs/ADR-002-scenario-format.md`.

  - **Decision**: Option B — executable `.scenario.mjs` modules
    in `auto-qa/harness/scenarios/`, exporting a `Scenario` object
    with `{name, description, bugShape, route, mocks, assertions}`.

  - **Rationale**:
    * Reuses the existing fixture vocabulary
      (`makeGraphqlMockHandler`, `makeCandlesMockHandler`,
      `fakePoolBearingProposal`, `installWalletStub`,
      `setupSigningTunnel`) directly. JSON option would have
      required porting all of it into a JSON-interpreting shim.
    * Phase 6's stop-here value is "first real bug shape
      replayable" — achievable today via mocked-API + DOM
      assertions, since slice 4c v3b's stale-price-but-API-healthy
      regression already proves the pattern.
    * Auto-generation from a real chain recording (the JSON
      appeal) isn't a Phase 6 deliverable. If it becomes one,
      JSON can wrap `.scenario.mjs` (parser → `Scenario` object
      at load time).
    * Full-stack snapshot (Option D, the original CHECKLIST
      framing) deferred to Phase 7 chaos work or to the first
      scenario that genuinely needs anvil state inexpressible
      via mocks.

  - **Structure landed**:
    * `interface/auto-qa/harness/docs/ADR-002-scenario-format.md`
      (Status: Proposed)
    * `interface/auto-qa/harness/scenarios/` directory with
      `README.md` documenting the format + naming convention
      (`<NN>-<short-name>.scenario.mjs`)

  - **Format definition** (binding for Phase 6):
    ```ts
    type Scenario = {
        name:        string;            // "01-stale-price-shape"
        description: string;            // 1-2 sentences
        bugShape:    string;            // e.g. "PR #64 stale price"
        route:       string;            // e.g. "/companies"
        mocks:       Record<string, RouteHandler>;  // url → Playwright handler
        assertions:  Array<(page: Page) => Promise<void>>;
        timeout?:    number;
    };
    ```

  - **Open items deferred to slice 2+**:
    * Per-scenario wallet state (does the scenario need a
      `nStubWallets` selection / signing tunnel? probably yes —
      add an optional `wallet` field when first needed)
    * Cross-repo scenarios (a scenario needing both real anvil +
      real api would live on the api-side)
    * Catalog generation script (`SCENARIOS.md` index — pin
      when ≥3 scenarios exist)

- **slice 2** (this iteration) — first scenario captured +
  wrapper spec runner. **Phase 6's "first real bug shape
  replayable" gate is now MET.**

  - **Mock-helper extraction**: moved
    `makeGraphqlMockHandler`, `makeCandlesMockHandler`,
    `fakeProposal`, `fakePoolBearingProposal`, and the PROBE_*
    constants out of `flows/dom-api-invariant.spec.mjs` into a
    new shared module `fixtures/api-mocks.mjs`. The spec file
    now imports from there. Rationale: scenarios need the same
    helpers and importing from a spec file is awkward.

  - **First scenario** —
    `scenarios/01-stale-price-shape.scenario.mjs`. Lifts slice 4c
    v3b's exact mock setup + assertions into the Scenario format
    defined by ADR-002. Guards the PR #64 stale-price-but-API-
    healthy bug shape (mocked candles GraphQL → "0.4200 SDAI" via
    EventHighlightCard's prefetched-price short-circuit).

  - **Wrapper spec** — `flows/scenarios.spec.mjs`:
    * Top-level `await` discovers `scenarios/*.scenario.mjs`
      and dynamically imports each (Playwright sees the full test
      list at collection time).
    * For each scenario, emits one
      `test('<name> — <bugShape>', …)` that:
      1. Skips if `HARNESS_NO_WEBSERVER=1` (scenarios always need
         the dev server)
      2. Installs the default wallet stub (every scenario needs
         `window.ethereum` for wagmi/RainbowKit hydration)
      3. Applies each entry of `scenario.mocks` via `context.route`
      4. Navigates to `scenario.route`
      5. Runs `scenario.assertions[i](page)` in order

  - **Validated end-to-end** — 7 tests pass when run together
    (6 dom-api-invariant + 1 scenario): the extracted helpers
    work in both contexts; the scenario format produces a
    correct test from a pure data structure. Wall-clock 22.6s
    with cold compile.

  - **`scenarios/README.md`** updated with a "Current scenarios"
    table indexing the captured scenarios. Becomes the human-
    readable bug-shape catalog as scenarios accumulate.

- **slice 3** (back-fill, this iteration's primary work) —
  `scripts/scenarios-catalog.mjs` (~70 lines) auto-generates
  `scenarios/SCENARIOS.md` from each scenario's `bugShape`
  field. Sliced 3 was originally deferred ("worth doing once
  we have ≥3 scenarios"); landing 03-candles-down in Phase 7
  slice 2 unblocked it. Looped back to ship.

  - **What the script does**:
    1. `readdirSync(scenarios/)` filter `*.scenario.mjs`, sort
    2. `await Promise.all(files.map(...))` — dynamic-import
       each scenario module
    3. Validate required fields (`name` / `description` /
       `bugShape` / `route`); throw with file context if any
       are missing
    4. Build a markdown table; escape `|` in bugShape /
       description so the table layout survives content with
       pipes
    5. `writeFileSync(scenarios/SCENARIOS.md, ...)`

  - **npm scripts**: `scenarios:catalog` in harness;
    `auto-qa:e2e:scenarios:catalog` at root. Both forms work.

  - **README.md slimmed**: the per-file notes table is now
    "authoring notes" (one cell per file: why-this-scenario-
    exists context). The canonical bug-shape index lives in
    the auto-generated `SCENARIOS.md` so PRs that add scenarios
    don't have to update two files.

  - **Drift gate**: future CI step can `npm run auto-qa:e2e:scenarios:catalog`
    then `git diff --exit-code scenarios/SCENARIOS.md` to fail
    builds where the catalog is out of date with the scenarios
    directory. Pinned in CHECKLIST as a Phase 7 slice 3 (CI
    integration) item.

  - **Validated end-to-end**: ran the script, got
    `✓ Wrote /Users/kas/interface/auto-qa/harness/scenarios/SCENARIOS.md (3 scenarios)`,
    inspected the output — all 3 scenarios indexed correctly
    with the right bug-shape strings, routes, descriptions.

**Phase 6 status: COMPLETE.** All three CHECKLIST gates met
(format decided, first scenario captured, wrapper-spec replay +
catalog generator both in place).

**Smoke summary (UI side, post-Phase 6 slice 3):**

```
Phase 4 wallet-stub (8 cases, node:test + live anvil)  ✓ ~4s
Phase 4 contract-calls (1 case, reads+write+event)     ✓ ~5.5s
Phase 5 wallet-injection (6 cases, chromium)           ✓ ~2.4s
Phase 5 wallet-signing (3 cases, chromium + anvil)     ✓ ~5.6s
Phase 5 app-discovery (2 cases, chromium + Next.js)    ✓ ~14s
Phase 5 dom-api-invariant (6 cases, chromium + Next.js) ✓ ~14s
Phase 6+7 scenarios (3 cases, chromium + Next.js)      ✓ ~5s
+ scenarios:catalog script (1 run, no test runner)      ✓ <1s
                                       TOTAL: 29 pass + 0 skip
```

### Phase 7 — Chaos injection + nightly CI (UI side)

- **slice 1** (this iteration) — first chaos primitive landed
  via the Phase 6 scenario format. Validates the design choice
  in ADR-002: "executable `.scenario.mjs` modules" composes with
  chaos because mock handlers can return any HTTP status, not
  just 200. No format change needed.

  - **`scenarios/02-registry-down.scenario.mjs`**: mocks
    REGISTRY GraphQL → `route.fulfill({status: 502, body:
    {errors:[{message:'Bad Gateway (chaos: registry-down)'}]}})`,
    asserts `/companies` shows "No organizations found" within
    30s. The empty-state branch lives in
    `OrganizationsTable.jsx::filteredOrgs.length === 0` — it
    fires when both `useAggregatorCompanies` AND the carousel-
    side `fetchProposalsFromAggregator` return empty results
    after their `.catch` branches handle the 502.

  - **Bug-shapes guarded**:
    * Hard-crash on REGISTRY 5xx (page becomes unusable)
    * Hung loading spinner with no terminal state
    * Raw error envelope leaked to UI ("Bad Gateway: …" text)
    * Silent broken state that fakes success

  - **Composability proof**: the wrapper spec from Phase 6
    slice 2 auto-discovered the new scenario without ANY code
    change — adding a future bug-shape regression is a single
    new file. This is the "scenario library" working as
    intended.

  - **Validated end-to-end**: the wrapper spec ran both 01
    (happy-path) AND 02 (chaos) and both pass. 02 alone: 2.4s.
    Both together: 20s wall-clock with cold compile.

  - **Phase 7 — staging the rest**: slice 2 = more chaos
    primitives (CANDLES timeout, WALLET RPC failure, mid-flight
    failure); slice 3 = CI integration (nightly cron + artifact
    upload); slice 4 = full-stack docker-compose. Per
    CHECKLIST.md.

**Smoke summary (UI side, post-Phase 7 slice 1):**

```
Phase 4 wallet-stub (8 cases, node:test + live anvil)  ✓ ~4s
Phase 4 contract-calls (1 case, reads+write+event)     ✓ ~5.5s
Phase 5 wallet-injection (6 cases, chromium)           ✓ ~2.4s
Phase 5 wallet-signing (3 cases, chromium + anvil)     ✓ ~5.6s
Phase 5 app-discovery (2 cases, chromium + Next.js)    ✓ ~14s
Phase 5 dom-api-invariant (6 cases, chromium + Next.js) ✓ ~14s
Phase 6+7 scenarios (2 cases, chromium + Next.js)      ✓ ~5s
                                       TOTAL: 28 pass + 0 skip
```

- **slice 2** (this iteration) — CANDLES-down branch added.
  Companion to slice 1's REGISTRY-down: where 02 takes the
  carousel-source out so nothing renders, 03 keeps the carousel
  source healthy so a card mounts, then takes the SECOND-tier
  pricing source out.

  - **`scenarios/03-candles-down.scenario.mjs`**: mocks
    REGISTRY → success (carousel renders our event card),
    CANDLES → 502 (both bulk prefetch AND per-pool fallback
    fail). Asserts event title visible AND "0.00 SDAI" visible.

  - **Discovery while wiring this** (worth pinning): per
    `src/utils/SubgraphPoolFetcher.js`, the per-pool fetcher
    used by `useLatestPoolPrices` calls
    `getSubgraphEndpoint(chainId)` → CANDLES — the SAME
    endpoint `collectAndFetchPoolPrices` hits in the bulk-
    prefetch step. So a CANDLES outage takes BOTH layers down
    in one shot. There is no third-tier fallback; the formatter
    eventually settles on its `prices.yes !== null ? … : '0.00 SDAI'`
    branch and renders the literal "0.00 SDAI" string. This is
    actually a **harness-level architecture finding**: any
    future work that wants to test the per-pool fallback in
    isolation will need to make the bulk and per-pool fetchers
    hit different endpoints first.

  - **Bug-shapes guarded**:
    * Card hangs on LoadingSpinner when CANDLES is dead
      (loading state not unwound on fetch error)
    * Card crashes when prices come back null (formatter
      assumes non-null without the fallback branch)
    * Card shows stale or fake numbers (silent drift to a
      different pricing source that's not visibly distinguishable)

  - **Negative-companion benefit**: 03 also tightens the
    DOM↔API invariant on scenario 01. If someone later adds a
    silent default-price source ("if candles fails, use X
    instead"), scenario 01 might still pass spuriously, but
    scenario 03 fails because "0.00 SDAI" wouldn't appear
    anymore. The pair pins both the happy path AND the explicit
    failure path.

  - **Validated end-to-end**: 03 passes in 1.4s; all 3
    scenarios together: 20.3s wall-clock with cold compile.
    UI-side smoke now 29 pass + 0 skip.

  - **Phase 6 slice 3 unblocked**: with 3 scenarios in place,
    the `scenarios:catalog` script (originally deferred until
    ≥3 scenarios) is now worth writing. Re-tagged in CHECKLIST
    as "UNBLOCKED".

**Smoke summary (UI side, post-Phase 7 slice 2 candles-branch):**

```
Phase 4 wallet-stub (8 cases, node:test + live anvil)  ✓ ~4s
Phase 4 contract-calls (1 case, reads+write+event)     ✓ ~5.5s
Phase 5 wallet-injection (6 cases, chromium)           ✓ ~2.4s
Phase 5 wallet-signing (3 cases, chromium + anvil)     ✓ ~5.6s
Phase 5 app-discovery (2 cases, chromium + Next.js)    ✓ ~14s
Phase 5 dom-api-invariant (6 cases, chromium + Next.js) ✓ ~14s
Phase 6+7 scenarios (3 cases, chromium + Next.js)      ✓ ~5s
                                       TOTAL: 29 pass + 0 skip
```

- **slice 2 partial branch** (this iteration) — `04-candles-partial`
  scenario. The "API is up but my data isn't in the answer" shape,
  distinct from 03's "API didn't answer at all".

  - **`scenarios/04-candles-partial.scenario.mjs`**: mocks
    REGISTRY with TWO `fakePoolBearingProposal` rows (different
    pool addresses). CANDLES returns prices ONLY for the first
    pair; the second pair is omitted from the response (the
    `makeCandlesMockHandler` filters by `Object.prototype.hasOwnProperty.call(prices, addr)`,
    so an absent address is simply not in the returned `pools`
    list — same shape as a real candles endpoint that hasn't
    indexed those pools yet). Asserts the priced card renders
    "0.4200 SDAI" while the unpriced card falls back to
    "0.00 SDAI" AND both cards remain visible.

  - **Bug-shapes guarded**:
    * One missing price corrupting all (shared cache or
      last-write-wins applies wrong price to multiple cards)
    * Card disappearing when its price is missing (overzealous
      filter hides events with null prices)
    * Formatter crashes on null prices for unpriced card while
      priced card renders fine (defensive-coding regression)
    * Prices swapping between cards (cache-key /
      address-comparison bug in `attachPrefetchedPrices`)

  - **Two slice-2 sub-slices deprioritized after investigation**:
    * **WALLET RPC failure**: the wallet stub handles
      `eth_chainId` / `eth_accounts` /
      `wallet_switchEthereumChain` LOCALLY (not via
      `rpcPassthrough`), so wagmi/RainbowKit's auto-probe
      surface doesn't actually hit `rpcUrl`. On `/companies`
      (no swap, no message-sign) the wallet's RPC URL has
      near-zero blast radius. Revisit when a scenario needs
      to drive a real swap.
    * **Mid-flight failure on /companies**: traced through
      `useAggregatorCompanies` + `CompaniesPage.jsx` —
      consumer drops the hook's `error` field, so partial-
      success on REGISTRY's three-query pipeline lands at the
      same DOM state as full failure ("No organizations found").
      Indistinguishable from scenario 02; no new bug shape
      captured. Re-evaluate on a market detail page.

  - **Validated end-to-end**: 04 passes in 1.4s; all 4
    scenarios together: 20.6s wall-clock with cold compile.
    UI-side smoke now 30 pass + 0 skip.

  - **Catalog regenerated**: `scripts/scenarios-catalog.mjs`
    re-ran cleanly, `SCENARIOS.md` now indexes 4 scenarios.

  - **Transient gotcha worth noting**: first run failed with
    "Playwright Test did not expect test.describe() to be called
    here" — turned out to be a stale dev-server / test-results
    interaction, not a real problem with scenario 04. Killing
    port 3000 and clearing `test-results/` fixed it. Adding to
    the harness operational notes for future debugging.

**Smoke summary (UI side, post-Phase 7 slice 2 partial-branch):**

```
Phase 4 wallet-stub (8 cases, node:test + live anvil)  ✓ ~4s
Phase 4 contract-calls (1 case, reads+write+event)     ✓ ~5.5s
Phase 5 wallet-injection (6 cases, chromium)           ✓ ~2.4s
Phase 5 wallet-signing (3 cases, chromium + anvil)     ✓ ~5.6s
Phase 5 app-discovery (2 cases, chromium + Next.js)    ✓ ~14s
Phase 5 dom-api-invariant (6 cases, chromium + Next.js) ✓ ~14s
Phase 6+7 scenarios (4 cases, chromium + Next.js)      ✓ ~5s
                                       TOTAL: 30 pass + 0 skip
```

- **slice 3a** (this iteration) — **CI workflow STAGED** for
  promotion to `.github/workflows/`. The harness has been usable
  locally for many iterations; slice 3a starts the path to it
  catching regressions IN CI without requiring a developer to
  manually run anything.

  - **What landed**:
    * `auto-qa/harness/ci/auto-qa-harness.yml.staged` (NEW) —
      the workflow YAML in version control under a `.staged`
      extension so GitHub Actions doesn't try to run it from
      this location.
    * `auto-qa/harness/ci/README.md` (NEW) — explains the
      staging dance + the promote command.

  - **The workflow**: trigger is `workflow_dispatch` ONLY for
    v1 (manual fire from GitHub Actions UI) — landing the
    first workflow file can't unexpectedly red-light
    unrelated PRs. Job:
    ```
    scenarios-catalog-drift:
      - actions/checkout@v4
      - actions/setup-node@v4 (Node 22, npm cache keyed on
        auto-qa/harness/package-lock.json)
      - working-directory: auto-qa/harness; npm ci
      - working-directory: auto-qa/harness; npm run scenarios:catalog
      - git diff --exit-code auto-qa/harness/scenarios/SCENARIOS.md
    ```
    Total runtime expected <1 min (no browser, no Next.js
    dev server, just the lightweight catalog regenerator + diff).

  - **Why staged not live**: GitHub blocks OAuth Apps without
    `workflow` scope from creating/modifying `.github/workflows/*`
    files. The bot's token is push-scoped only. The first
    iteration of slice 3a tried to commit the workflow directly
    and the push got rejected:
    ```
    ! [remote rejected] auto-qa -> auto-qa
    (refusing to allow an OAuth App to create or update
     workflow `.github/workflows/auto-qa-harness.yml`
     without `workflow` scope)
    ```
    Recovered by:
    1. `git reset --soft HEAD~1` to undo the rejected commit
    2. `mv .github/workflows/auto-qa-harness.yml
        auto-qa/harness/ci/auto-qa-harness.yml.staged`
    3. `rm -rf .github` (was empty after the move)
    4. Added `auto-qa/harness/ci/README.md` documenting the
       promote command
    The staging dance puts the content under code review +
    version control without needing the workflow scope, then
    a maintainer (or anyone with the right token) promotes
    by copying the file into `.github/workflows/`.

  - **Local validation** of the workflow's logic: re-ran the
    equivalent steps manually — `npm ci` in auto-qa/harness/
    succeeded with `found 0 vulnerabilities`; `npm run
    scenarios:catalog` regenerated SCENARIOS.md cleanly;
    `git diff --exit-code` returned 0 (catalog already in sync).

  - **Drift-check value-add** (once promoted): the CI step
    ensures any PR adding/changing a scenario also re-runs the
    catalog generator. SCENARIOS.md is the human-readable
    bug-shape index; without the drift check, it silently goes
    stale.

  - **Promote command** (one-time maintainer task):
    ```bash
    mkdir -p .github/workflows
    cp auto-qa/harness/ci/auto-qa-harness.yml.staged \
       .github/workflows/auto-qa-harness.yml
    git add .github/workflows/auto-qa-harness.yml
    git commit -m "ci: promote auto-qa harness scenarios-catalog-drift"
    git push
    ```
    Pushes from a workflow-scoped token (or via the GitHub
    web UI's "Add file" action) succeed where the bot's token
    can't.

  - **Next slices in CI staging**:
    * 3b — once 3a is promoted + smoke-tested, broaden
      triggers (`schedule: '0 4 * * *'` for nightly drift
      sweep + `pull_request: paths: ['auto-qa/harness/**']`
      for harness-touching PRs). Edit the staged file, commit,
      maintainer re-promotes.
    * 3c — separate job that runs the actual Playwright
      scenarios suite (heavier; needs browser install + dev
      server)
    * 3d — `actions/upload-artifact@v4` block conditional on
      failure (Playwright traces / screenshots / videos)

- **slice 3c** (this iteration) — **second CI workflow STAGED**:
  the heavier Playwright-scenarios runner. Kept as a SEPARATE
  workflow file from slice 3a's drift check so the maintainer
  can promote each independently and gate them differently.

  - **What landed**:
    * `auto-qa/harness/ci/auto-qa-harness-scenarios.yml.staged`
      (NEW) — second workflow YAML.
    * `auto-qa/harness/ci/README.md` updated to list both staged
      files + recommended promote order.

  - **The workflow** (`auto-qa-harness-scenarios.yml`):
    ```
    scenarios-suite:
      - actions/checkout@v4
      - actions/setup-node@v4 (Node 22, npm cache on
        BOTH lockfiles — root + auto-qa/harness)
      - npm ci at root (Next.js dev server)
      - npm ci in auto-qa/harness (Playwright + viem)
      - actions/cache@v4 ~/.cache/ms-playwright keyed on
        harness lockfile hash
      - cache miss: npx playwright install --with-deps chromium
        cache hit:  npx playwright install-deps chromium
      - npm run ui:full in auto-qa/harness, env
        HARNESS_FRONTEND_RPC_URL=https://rpc.gnosischain.com
    ```
    Trigger is `workflow_dispatch` ONLY for v1 (mirroring slice
    3a's conservative roll-out — second workflow file landing
    can't unexpectedly red-light unrelated PRs either). Timeout
    20 min; expected wall-clock ~5-10 min cold (~2-3 min once
    the browser cache hits).

  - **Why a SEPARATE file (not a second job in slice 3a's
    workflow)**:
    * Different cost profile: drift check <1 min vs scenarios
      suite ~5-10 min — different cadence sensible (drift could
      run on every PR; scenarios maybe nightly + manual)
    * Atomic promote-per-slice: maintainer can promote drift
      check first, smoke-test, then promote scenarios separately
    * Reduced blast radius: misconfigured scenarios YAML can't
      red-light the drift check
    * Different cache-dep paths: drift check only needs the
      harness lockfile; scenarios needs both root + harness

  - **Why `HARNESS_FRONTEND_RPC_URL=https://rpc.gnosischain.com`
    instead of localhost:8546**: there's no anvil in the GitHub
    runner. The wallet-signing eth_sendTransaction case
    auto-skips when `whichAnvil()` returns null; the other tests
    just need a working JSON-RPC endpoint for Wagmi to bootstrap
    (chain ID lookup, etc).

  - **Browser-cache pattern** (the trickiest piece): Playwright
    caches its browser binaries in `~/.cache/ms-playwright`,
    which `actions/cache@v4` can persist across runs. But the
    apt-level system deps (e.g. libnss3) aren't cached and must
    be reinstalled each run. The two-step pattern is:
    * cache miss → `playwright install --with-deps chromium`
      (binary + deps in one command)
    * cache hit → `playwright install-deps chromium`
      (apt-only, ~10-30s)
    Reduces warm-cache install time from ~60s to ~10s without
    risking missing system deps.

  - **Promote command** (one-time maintainer task on interface
    side, AFTER smoke-testing slice 3a):
    ```bash
    cp auto-qa/harness/ci/auto-qa-harness-scenarios.yml.staged \
       .github/workflows/auto-qa-harness-scenarios.yml
    git add .github/workflows/auto-qa-harness-scenarios.yml
    git commit -m "ci: promote auto-qa harness scenarios-suite"
    git push
    ```

  - **Local validation**: harness `npm ci` succeeded; `npm run
    ui:full` was last run end-to-end during slice 3a iteration
    (30 tests, all green); YAML parses cleanly via
    `python3 -c 'import yaml; yaml.safe_load(open(...))'`.

**Smoke summary (UI side, post-Phase 7 slice 3c):**

```
Phase 4 wallet-stub (8 cases, node:test + live anvil)  ✓ ~4s
Phase 4 contract-calls (1 case, reads+write+event)     ✓ ~5.5s
Phase 5 wallet-injection (6 cases, chromium)           ✓ ~2.4s
Phase 5 wallet-signing (3 cases, chromium + anvil)     ✓ ~5.6s
Phase 5 app-discovery (2 cases, chromium + Next.js)    ✓ ~14s
Phase 5 dom-api-invariant (6 cases, chromium + Next.js) ✓ ~14s
Phase 6+7 scenarios (4 cases, chromium + Next.js)      ✓ ~5s
+ scenarios:catalog drift check (CI workflow + local)  ✓ <1s
+ scenarios suite CI workflow (STAGED, awaits promote)  ⏳
+ on-failure artifact upload (slice 3d, same staged file) ⏳
                                       TOTAL: 30 pass + 0 skip
```

- **slice 3d** (this iteration) — **on-failure artifact upload
  STAGED**. Single new step appended to slice 3c's staged
  scenarios workflow (not a new file — same workflow, one more
  step). When the scenarios suite fails in CI, you NEED the
  trace/screenshots/video to debug; without this step, that
  payload would die in the runner's ephemeral filesystem.

  - **What landed**: edit to
    `auto-qa/harness/ci/auto-qa-harness-scenarios.yml.staged`
    appending one `actions/upload-artifact@v4` step after the
    `npm run ui:full` step.

  - **The step shape**:
    ```yaml
    - name: Upload Playwright artifacts on failure
      if: failure()
      uses: actions/upload-artifact@v4
      with:
        name: playwright-scenarios-results-${{ github.run_attempt }}
        path: |
          auto-qa/harness/playwright-report/
          auto-qa/harness/test-results/
        retention-days: 14
        if-no-files-found: ignore
    ```

  - **Why these two paths**: `playwright.config.mjs` already
    configures the on-failure capture (`trace: retain-on-failure`,
    `screenshot: only-on-failure`, `video: retain-on-failure`)
    plus the HTML report (`outputFolder: 'playwright-report'`).
    All the bot needs to do is hoist them out of the runner's
    `/__w/...` workspace before it gets torn down.

  - **Why `${{ github.run_attempt }}` in the name**: the
    Playwright config sets `retries: 2` in CI mode. Without the
    suffix, retry #2 would clobber retry #1's artifacts (or
    fail with "name already exists"). With it, you get
    `playwright-scenarios-results-1`, `-2`, `-3` for a
    fully-retried failed run — all visible in the workflow's
    Artifacts tab.

  - **Why `if-no-files-found: ignore`**: covers a corner case
    where the workflow fails BEFORE Playwright produces any
    output (e.g. `npm ci` fails). Without it, the upload step
    itself would fail, masking the real error in the run log.

  - **Why STAGED together with 3c (not as a separate file)**:
    3d is one more step in 3c's job — same workflow file, same
    runtime, same trigger. Splitting them would require a second
    promote and a second smoke-test for what's effectively a
    feature flag on 3c's debugging output. Promoted together,
    they form one coherent "run scenarios + capture failures"
    workflow.

  - **Local validation**: js-yaml parses the file cleanly
    (`npx js-yaml@4 ...`); upload-artifact step shows up at the
    right point in the parsed structure with `if: failure()`
    and the two correct paths.

  - **What's left in Phase 7 slice 3** (per CHECKLIST):
    * 3b — broaden triggers (schedule + paths gate). Gated on
      slice 3a being smoke-tested live. Bot can stage a v2 of
      the drift-check workflow but the smoke-test step is
      human.
    * Maintainer-only: 3a-promote + 3c-promote (which now
      includes 3d's step automatically).
    * Then slice 4 — full-stack docker-compose (the big one).

- **slice 4a-prep** (this iteration, on the api side) — slice 4
  (full-stack docker-compose) starts with prep work laying the
  groundwork for activating the futarchy-api service in
  `auto-qa/harness/docker-compose.yml`. The compose file has
  had an api block stubbed (commented out) since Phase 0
  slice 2; this iteration tracks the prerequisites so the block
  can be uncommented in slice 4a proper.

  - **What landed (api repo)**:
    * `Dockerfile` (NEW, tracked) — 12-line node:22-alpine
      image, runs `npm ci --omit=dev`, `EXPOSE 3031`,
      `CMD ["node", "src/index.js"]`. File was sitting
      untracked at api repo root from a prior iteration; this
      commit just tracks it.
    * `.dockerignore` (NEW, tracked) — excludes node_modules,
      .env*, test-*.js + test-*.mjs, example-test-*.js, docs,
      *.md, lambda-deploy, test-checkpoint-vs-graph-node. Same
      "untracked → tracked" story as Dockerfile.
    * `auto-qa/harness/docker-compose.yml` (modified) — api
      block's port assumptions corrected. Was: `PORT: 3000`
      env + commented `ports: - "3000:3000"`. Now:
      `PORT: 3031` (informational only) + commented
      `ports: - "3031:3031"`.

  - **Real bug surfaced**: `src/index.js:25` (api repo)
    hardcodes `const PORT = 3031` and never reads
    `process.env.PORT`. The original compose comment block
    expected `PORT: 3000` to be honored at runtime, but it
    would have been silently ignored (the api would still
    bind to 3031 inside the container, the compose's
    `ports: - "3000:3000"` would map to nothing, and a "why
    isn't the api responding?" debugging session would
    follow). Compose comment now documents the constraint
    so future contributors see it before activating the block.

  - **Why fix the compose, not src/index.js**: the cross-cutting
    acceptance gate says "Production code in `src/` (both
    repos) is NEVER modified by harness work". src/index.js
    IS production code. The harness adapts to its reality,
    not the other way around.

  - Block REMAINS COMMENTED OUT — uncommenting + verifying
    `docker compose build api` is slice 4a proper, not 4a-prep.

  - CHECKLIST slice 4 expanded: 4a-prep DONE; 4a (uncomment +
    build), 4b (indexer), 4c (interface-dev mount), 4d
    (orchestrator), 4e (full `up -d` acceptance gate) sketched.

  - Validation: `npx js-yaml@4
    auto-qa/harness/docker-compose.yml` parses cleanly; the
    named-service tree shows `anvil` as the only active service
    (api block stays a YAML comment).

- **slice 4a** (this iteration, on the api side) — the api
  block in `auto-qa/harness/docker-compose.yml` is now
  UNCOMMENTED + structurally validated. `docker compose config`
  parses cleanly with both `anvil` + `api` services active.

  - **Real bug surfaced**: the original Phase 0 scaffold had
    `context: ../../..` which resolved to `/Users/kas/` (the
    parent of the api repo, NOT the repo root). Three levels
    up from `auto-qa/harness/` is one too many — should be
    `context: ../..` (api repo root, where Dockerfile +
    package.json live). This is the SECOND port/path bug
    surfaced by activating the api service (the first being
    the PORT discovery in 4a-prep). Fixed in this slice;
    comment block above the field documents the gotcha.

  - **Why indexer dependency stays commented out**: the
    original api block had `depends_on: indexer:` but indexer
    doesn't exist in compose yet (slice 4b). With it
    uncommented, `docker compose up api` would fail with
    `service "indexer" is not defined`. Dropping the dep
    means api can start without indexer — request-time
    endpoints proxying to CHECKPOINT_URL will fail until 4b,
    but `docker compose build api` and `up api` themselves
    succeed. Re-added in slice 4b alongside the indexer
    service.

  - **Why ports comment stays commented out**:
    compose-internal traffic uses the service name
    (`api:3031` from inside the network), so host port
    mapping isn't needed for the in-network case. The
    comment block tells future contributors how to flip it
    on for local debugging.

  - **What WAS validated**: `docker compose config --quiet`
    succeeds; `docker compose config --services` returns
    `anvil` + `api`; build context resolves to
    `/Users/kas/futarchy-api` (correct).

  - **What WASN'T validated** (out of bot scope this
    iteration): the actual `docker compose build api`. The
    Docker daemon isn't running on the bot's machine
    (`Cannot connect to the Docker daemon at
    unix:///Users/kas/.docker/run/docker.sock`). Pinned as
    4a-verify in CHECKLIST — small human step (start Docker
    Desktop, then `docker compose -f
    auto-qa/harness/docker-compose.yml build api`).

  - Slice 4 progress: ~17% done (4a-prep + 4a out of
    4a-prep / 4a / 4b / 4c / 4d / 4e). Next bot-doable:
    slice 4b (add Phase 3 indexer service to compose) — bigger
    lift, decisions to make about Checkpoint image source.

- **slice 4b-plan** (this iteration, on the api side) — the
  big architectural finding pre-empts implementation: the
  Phase 0 indexer stub assumed ONE service `indexer` with
  `image: TODO`. Reality, per ADR-002 + Phase 3
  implementation, is TWO indexers (registry + candles), each
  with its own postgres, each built from the sibling
  `futarchy-indexers` clone. The Phase 0 stub also used
  `CHECKPOINT_URL` as the api env var, but
  `src/config/endpoints.js` actually reads `REGISTRY_URL` +
  `CANDLES_URL` (third path/port bug surfaced by working
  through compose).

  - **What landed (api side)**:
    * `auto-qa/harness/docs/ADR-002-indexer-bootstrap.md` —
      Status: Proposed → Accepted. Added a 2026-05 revisit
      note explaining how the decision held up through
      Phase 3 and what slice 4b-include/network-wire will do
      for Phase 7.
    * `auto-qa/harness/docker-compose.yml` — Phase 0 indexer
      stub block (`image: TODO` single-service one) rewritten
      to point at ADR-002 and explain the four real services
      (registry-checkpoint + registry-postgres + candles-
      checkpoint + candles-postgres). New top-level `include:`
      block staged COMMENTED OUT, referencing both sibling
      indexer compose files.
    * `auto-qa/harness/CHECKLIST.md` — slice 4b expanded into
      5 sub-slices: 4b-plan (DONE), 4b-include, 4b-network-
      wire, 4b-api-env, 4b-verify.

  - **Why staged not active**: uncommenting `include:` brings
    in the four indexer services AND their networks (registry-
    net, candles-net) AND defaults RPC_URL to real Gnosis.
    Without the network bridging + env override done
    atomically, the indexers would either fail to reach anvil
    OR happily ingest from real Gnosis (defeating the harness
    purpose). 4b-include + 4b-network-wire are sequential, not
    parallel. 4b-plan stages the structure so the next two
    slices have a clear target.

  - **Why ADR-002 wasn't already Accepted**: the ADR was
    written during Phase 3 slice 1 with status "Proposed
    (Phase 3 slice 1)" assuming a future review session.
    That review never happened, but the implementation went
    ahead and has 25 smoke tests behind it. Slice 4b-plan
    retroactively closes the loop.

  - **Validation**: `docker compose config --quiet` succeeds;
    `--services` still returns just `anvil` + `api` (the
    include block is a YAML comment, no runtime delta).

  - Slice 4 progress: ~25% done (4a-prep + 4a + 4b-plan out of
    ~12 sub-slices total — slice 4b alone now decomposes into
    5). Next bot-doable: 4b-include (uncomment include block +
    add cross-network bridging) AND/OR 4b-network-wire
    (RPC_URL override).

- **slice 4b-include + 4b-api-env** (this iteration, on the
  api side) — uncommented the top-level `include:` block;
  `docker compose config --services` now returns 6 services
  (anvil + api + 4 indexer services). Also corrected the api
  service env from the wrong Phase 0 `CHECKPOINT_URL` to the
  real `REGISTRY_URL` + `CANDLES_URL` + `FUTARCHY_MODE` env
  vars per `src/config/endpoints.js`.

  - **Service-name reality vs Phase 0 stub assumptions**:
    registry compose uses `registry-checkpoint` +
    `registry-postgres` (prefixed); candles compose uses bare
    `checkpoint` + `postgres` (NOT `candles-checkpoint` /
    `candles-postgres` as the Phase 0 stub assumed). The
    container_names ARE prefixed
    (`futarchy-candles-checkpoint-1`) but the service names
    aren't. Also: candles uses `GNOSIS_RPC_URL`, registry
    uses `RPC_URL` — different env contracts.

  - **Why depends_on on indexers NOT added yet**: the indexers
    and api are on different networks (registry-net /
    checkpoint-net vs harness-net), so the api can't actually
    reach them via compose-internal name resolution yet.
    Adding the depends_on would have compose wait forever for
    cross-network healthchecks. Slice 4b-network-wire fixes
    this; only then can the depends_on be added.

  - **4b-network-wire BLOCKED**: naive override attempt
    failed. Tried declaring same-name service blocks
    (`registry-checkpoint:`, `checkpoint:`) in the parent
    compose to extend the included services with `networks:
    [registry-net, harness-net]` + RPC env override. Compose
    rejected: `services.registry-checkpoint conflicts with
    imported resource`. Compose v2.34's `include:` does NOT
    allow same-name service redefinition in the parent file.
    Three alternatives surfaced + documented:
    (a) Override-list form: `include: - path: [base.yml,
        overrides.yml]`. Compose merges base + overrides
        BEFORE include.
    (b) Per-service `extends:` (drop `include:`). Each
        indexer service declared here with `extends: { file:
        ..., service: ... }` plus harness overrides. Closest
        fit for ADR-002's wrapper leg.
    (c) Multi-file `docker compose -f base.yml -f
        overrides.yml`. Rejected: breaks the single-compose
        acceptance gate.
    Decision deferred to slice 4b-network-wire next
    iteration; approach (b) is the lead candidate.

  - **What was learned**: compose v2's `include:` is for
    IMPORTING, not OVERRIDING. The conflict error is
    structurally equivalent to a TypeScript "duplicate
    identifier" — there's no compose-level "override modifier"
    for included services.

  - Slice 4 progress: ~33% done (4a-prep + 4a + 4b-plan +
    4b-include + 4b-api-env / ~12 sub-slices). Next:
    4b-network-wire approach (b).

- **slice 4b-network-wire** (this iteration, on the api side)
  — indexers wired into the harness compose via per-service
  `extends:` (approach b from prior iteration's options list,
  ADR-002's "wrapper" leg).

  - **What changed in compose**:
    * `include:` block REMOVED (it rejected same-name overrides)
    * Top-level `networks:` expanded with `registry-net` +
      `checkpoint-net`
    * Top-level `volumes:` declared with
      `registry-postgres-data` + `candles-postgres-data`
    * 4 new service blocks: `registry-checkpoint`,
      `registry-postgres`, `checkpoint`, `postgres` — each
      uses `extends: { file:
      ../../../futarchy-indexers/.../docker-compose.yml,
      service: <bare name> }` to pull in the indexer's full
      definition
    * Two checkpoint services get harness overrides:
      RPC_URL / GNOSIS_RPC_URL = http://anvil:8545; RESET=true;
      networks dual-homed; depends_on anvil + their postgres
    * api depends_on now safely declares registry-checkpoint
      + checkpoint (service_started since indexers have no
      healthcheck)

  - **Compose extends merge confirmed via test**:
    * Maps merge (env override layered on included defaults)
    * Sequences replace (must repeat original network)
    * Build context resolves to extended file's directory
      (registry → /Users/kas/futarchy-indexers/futarchy-complete/checkpoint;
      candles → /Users/kas/futarchy-indexers/proposals-candles/checkpoint)

  - **Validation**: `docker compose config --quiet` succeeds;
    `--services` returns 6; merged config shows
    RPC_URL=http://anvil:8545 on registry, GNOSIS_RPC_URL on
    candles, api depends_on lists all three.

  - **Pinned for slice 4b-verify** (Docker daemon required,
    mostly human work): actual `docker compose up -d`; indexers
    can reach anvil over harness-net; api can resolve
    registry-checkpoint:3000 + checkpoint:3000 GraphQL;
    postgres healthchecks.

  - Slice 4 progress: ~42% done (6 of ~12 sub-slices). Next:
    slice 4b-verify (daemon smoke) OR slice 4c (interface-dev
    block in compose).

- **slice 4c-prep** (this iteration, on the api side) — fixed
  FIVE bugs in the Phase 0 `interface-dev` stub. Same pattern
  as slice 4a-prep: stub couldn't be activated as-is; prep
  fixes the stub in place (still commented) so 4c-activate
  becomes a one-step uncomment.

  - **Bug catalog** (interface-dev block):

    (i) **Path bug**: stub had
        `${INTERFACE_PATH:-../../../../interface}`. From
        `auto-qa/harness/`, four levels up = `/`. Bind mount
        would have failed at compose-up. Corrected to
        `../../../interface` (= /Users/kas/interface). Same
        "one too many ..s" issue as slice 4a's
        `context: ../../..` bug.

    (ii) **Port bug**: stub had `NEXT_PUBLIC_API_URL:
        http://api:3000`. Api binds to 3031 (slice 4a-prep
        finding). Corrected to `http://api:3031`.

    (iii) **Missing anvil dep**: stub only had `depends_on:
        api`. But Wagmi reads NEXT_PUBLIC_RPC_URL →
        http://anvil:8545; needs anvil reachable too.
        Added `depends_on: anvil` alongside the api dep.

    (iv) **Bare `npm run dev` won't work in fresh container**:
        bind mount has source but no node_modules. Replaced
        with `sh -c` script: conditional `npm install` if
        node_modules empty, then
        `exec npx next dev --hostname 0.0.0.0 --port 3000`.
        The `--hostname 0.0.0.0` is critical — `next dev`
        defaults to localhost-only binding which isn't
        reachable from outside the container.

    (v) **Node version mismatch**: stub had
        `image: node:20-bookworm-slim`. Harness convention
        is node 22. Standardized on `node:22-alpine`.

  - **Top-level addition**: `interface-node-modules` named
    volume to keep container's Linux node_modules separate
    from host's macOS-binary tree.

  - **Why STAGED not active**: Next.js dev-in-container has
    known caveats (file-watching across bind mounts can be
    unreliable; HMR over docker network has quirks; first-
    run npm install of ~1000+ deps takes minutes). Worth a
    careful 4c-verify smoke after activation.

  - **Validation**: `docker compose config --quiet` succeeds;
    `--services` still returns 6 (interface-dev remains a
    YAML comment). Top-level `interface-node-modules` volume
    declared eagerly so 4c-activate is purely a service-block
    uncomment.

  - Slice 4 progress: ~50% done (7 of ~12+ sub-slices —
    slice 4c now decomposes into 4c-prep + 4c-activate +
    potentially 4c-verify). Next: 4c-activate (one-step
    uncomment) OR return to 4b-verify (daemon-required
    smoke).

- **slice 4c-activate** (this iteration, on the api side) —
  the interface-dev block is UNCOMMENTED.
  `docker compose config --services` returns 7. Atomic
  one-step uncomment per slice 4c-prep; no edits to the
  block itself.

  - **Merged config verified via `docker compose config`**:
    depends_on (anvil healthy + api started); env
    (NEXT_PUBLIC_RPC_URL=http://anvil:8545,
    NEXT_PUBLIC_API_URL=http://api:3031); image
    (node:22-alpine); command (sh -c conditional npm install
    + `exec npx next dev --hostname 0.0.0.0 --port 3000`);
    bind mount of `${INTERFACE_PATH:-../../../interface}` +
    named volume `interface-node-modules` for Linux-isolated
    node_modules.

  - **What's still pending in slice 4**:
    * 4c-verify (Docker daemon required, mostly human):
      bring up the stack and curl http://localhost:3010 to
      confirm next dev is reachable. CHOKIDAR_USEPOLLING=true
      if HMR doesn't fire on host edits.
    * 4d (orchestrator service): the Phase 0 stub has the
      same kinds of bugs as 4c's stub, AND a deeper scope
      issue — ARCHITECTURE.md envisions an orchestrator that
      drives anvil's clock + sends txs + runs cross-layer
      assertions, but the assertion scripts (orchestrator/
      invariants.mjs) don't exist yet. Slice 4d will need
      both compose wiring AND scenario script development.
    * 4e (`docker compose up -d` acceptance gate): trivial
      after 4c-verify + 4d.

  - Slice 4 progress: ~58% done (8 of ~13+ sub-slices total).

- **slice 4d-prep** (this iteration, on the api side) — fixed
  FIVE bugs in the Phase 0 orchestrator stub + decomposed
  slice 4d into 3 sub-slices (the original "orchestrator
  service" was a single line in CHECKLIST; reality is bigger).

  - **Bug catalog**:
    (i) Path bug: `../../../auto-qa/harness` resolves to
        `/Users/kas/auto-qa/harness/` (doesn't exist);
        corrected to `.` (the harness dir IS the compose
        file's directory).
    (ii) Port bug: `API_URL: http://api:3000` → 3031.
    (iii) Wrong env vars: `CHECKPOINT_URL: http://indexer:3001/graphql`
        → `REGISTRY_URL: http://registry-checkpoint:3000/graphql`
        + `CANDLES_URL: http://checkpoint:3000/graphql`
        (per src/config/endpoints.js).
    (iv) Node version: 20-bookworm → 22-alpine.
    (v) `npm run test` won't work in fresh container;
        replaced with conditional install + exec pattern.

  - **Top-level addition**: `orchestrator-node-modules`
    named volume.

  - **DEEPER SCOPE FINDING**: ARCHITECTURE.md envisions
    orchestrator/invariants.mjs (cross-layer assertion lib)
    + scenario-runner. NEITHER EXISTS YET. The existing
    orchestrator/services.mjs assumes native-anvil + script
    indexers (Phase 3 topology) — would conflict with the
    compose stack. Slice 4d split into 4d-prep (this),
    4d-scenarios (build invariants.mjs + decide between
    HARNESS_COMPOSE-gated unified runner vs defer compose
    orchestrator), 4d-activate (atomic uncomment after
    4d-scenarios).

  - **Why command is `tail -f /dev/null`**: even with bugs
    fixed, orchestrator container needs SOME command. No-op
    placeholder lets it start cleanly without doing anything
    until 4d-scenarios builds the real runner.

  - **Validation**: `docker compose config --quiet` succeeds;
    `--services` still returns 7 (orchestrator block remains
    commented).

  - Slice 4 progress: ~62% done (9 of ~14+ sub-slices total —
    slice 4d now decomposes into 3). Next bot-doable: slice
    4d-scenarios (NEW CODE — build the assertion library) OR
    slice 4e (acceptance gate, blocked on 4b-verify +
    4c-verify + 4d-activate).

- **slice 4d-scenarios (scaffold)** (this iteration, on the
  api side) — the FIRST meaningful new code in slice 4 (not
  just compose wiring or stub fixes). Picked path (a): a
  HARNESS_COMPOSE=1-gated unified runner. Same binary works
  in compose mode (hits already-running endpoints) and
  eventually in native mode (will delegate to services.mjs).

  - **What landed (api side)**:
    * `auto-qa/harness/orchestrator/invariants.mjs` — the
      assertion library. Exports `INVARIANTS` array and
      `runAllInvariants(ctx)` aggregator. First 2 invariants:
      `apiHealth` (api/health 200) and `apiCanReachRegistry`
      (api/registry/graphql proxies __typename probe).
      Aggregator runs all checks without short-circuiting so
      one broken layer doesn't hide downstream failures.
    * `auto-qa/harness/orchestrator/scenario-runner.mjs` —
      CLI entry point. Reads service URLs from env
      (API_URL, REGISTRY_URL, CANDLES_URL, RPC_URL); gates
      on HARNESS_COMPOSE=1; supports HARNESS_DRY_RUN=1 for
      offline catalog dump; exits 2 in native mode with a
      pointer to start-indexers.mjs + tests/.
    * `auto-qa/harness/tests/smoke-scenario-runner.test.mjs`
      — 6 tests against an in-process node:http fixture
      mimicking api response shapes. INVARIANTS shape;
      happy path; 2 failure paths (verifying no
      short-circuit); CLI dry-run; CLI native-mode
      rejection. All 6 green.
    * `auto-qa/harness/package.json` — 3 new scripts:
      `scenarios:dry`, `scenarios:run`, `smoke:scenarios`.

  - **What this enables**:
    * Slice 4d-activate: replace the placeholder
      `tail -f /dev/null` command in the orchestrator
      compose block with `npm run scenarios:run`. Atomic
      uncomment now that the runner exists.
    * Future iterations ADD invariants to the array
      without touching scenario-runner.mjs — clean
      separation between assertion library (data) and
      runner (control flow).

  - **Validation**:
    * `npm run smoke:scenarios` → 6/6 pass (155ms)
    * `npm run scenarios:dry` → exits 0; prints catalog
    * Native-mode rejection prints clear pointer + exits 2

  - Slice 4 progress: ~67% done (10 of ~15+ sub-slices —
    4d-scenarios decomposes further into per-invariant
    sub-slices over time). Next bot-doable: slice
    4d-activate (atomic uncomment + replace placeholder
    command) OR 4d-scenarios-more (next invariant —
    apiCanReachCandles, mirroring the registry pattern).

- **slice 4d-activate** (this iteration, on the api side) —
  the orchestrator block is UNCOMMENTED. The placeholder
  `tail -f /dev/null` (kept through 4d-prep so the service
  could exist structurally before the runner did) is replaced
  with the real entry point: `node
  orchestrator/scenario-runner.mjs`.

  - **`docker compose config --services` returns 8** — the
    full stack is now structurally complete: anvil, api,
    registry-checkpoint, registry-postgres, checkpoint,
    postgres, interface-dev, orchestrator.

  - **Lifecycle**: orchestrator is one-shot. Container starts
    → runs every invariant → exits 0 (all-pass) or 1
    (any-fail). Other services keep running so you can
    re-run with `docker compose run --rm orchestrator`
    without bringing the stack down. Matches the eventual
    CI workflow pattern (workflow checks orchestrator's
    exit code).

  - **Simplified vs prep**: the prep slice staged a
    conditional `npm install` in the command. Unnecessary —
    harness has zero deps; scenario-runner only uses Node 22
    builtins. Replaced multi-line `sh -c` with clean
    `["node", "orchestrator/scenario-runner.mjs"]`.
    `orchestrator-node-modules` named volume kept (currently
    empty) for future invariants that need viem etc.

  - **What's left for slice 4 acceptance gate (4e)**:
    * 4b-verify, 4c-verify, 4d-verify (Docker daemon
      required, mostly human): bring up subsets of the
      stack, verify each layer talks to the next.
    * 4e (acceptance gate): single `docker compose up -d`
      works on a fresh checkout. Trivial after the verifies.

  - Slice 4 progress: ~73% done (11 of ~15+ sub-slices). All
    bot-doable structural work in slice 4 is now complete
    except slice 4d-scenarios-more (incremental: add more
    invariants). Remaining sub-slices need Docker daemon
    and are mostly human work.

- **slice 4d-scenarios-more (apiCanReachCandles)** (this
  iteration, on the api side) — one new invariant added.
  Mirrors the registry-probe pattern: POST `__typename` query
  to api `/candles/graphql`, assert
  `data.__typename === 'Query'`. Trace: api endpoint →
  proxyCandlesQuery → candles-adapter → upstream Checkpoint
  indexer. The bare `__typename` flows through cleanly
  (doesn't trigger any of the adapter's schema-translation
  branches).

  - **Demonstrates the additive pattern** that slice
    4d-scenarios established: new invariants are pure-
    additive edits to the INVARIANTS array. Zero changes
    to scenario-runner.mjs. Each new invariant ships with
    smoke-test coverage.

  - **Validation**: 7/7 smoke tests pass (147ms);
    `npm run scenarios:dry` lists all 3 invariants;
    `docker compose config --quiet` still passes.

  - Slice 4 progress: ~75% (12 of ~16+ sub-slices). Next
    bot-doable: another invariant — rateSanity (needs RPC
    + ABI; meatier) OR registryDirect/candlesDirect (probe
    indexers without going through api — validates the
    network bridging from slice 4b-network-wire is correct
    end-to-end).

- **slice 4d-scenarios-more (registryDirect + candlesDirect)**
  (this iteration, on the api side) — TWO new invariants in
  one iteration; small, symmetrical, naturally paired.

  - **What they do**: probe the indexer GraphQL endpoints
    directly (`ctx.registryUrl`, `ctx.candlesUrl`) without
    going through the api passthrough. Validates that the
    orchestrator container can reach the indexers over
    harness-net.

  - **Why pair them with the api-passthrough invariants**:
    if api↔registry passes but registryDirect fails (or
    vice versa), it's a useful debug signal — the api is
    reaching the indexer by some route the orchestrator
    can't (DNS cache, connection pool, cached response).
    Compose stack expects both routes to work.

  - **Validates slice 4b-network-wire end-to-end** (or
    will, once daemon-required smoke is human-run): the
    orchestrator container is single-homed on harness-net,
    indexers are dual-homed (registry-net + harness-net via
    per-service `extends:` blocks). These two invariants
    are the first to EXERCISE the bridging from the
    orchestrator's vantage point.

  - **What landed**:
    * `orchestrator/invariants.mjs` — added registryDirect
      + candlesDirect after apiCanReachCandles; both use
      the now-stable invariant shape; both probe
      `ctx.registryUrl` / `ctx.candlesUrl` directly.
    * `tests/smoke-scenario-runner.test.mjs` — fixture
      extended with `/registry-direct/graphql` +
      `/candles-direct/graphql` paths (distinguished from
      api-passthrough versions); new `fullCtx(fxUrl)`
      helper bundles all the URLs cleanly; 2 new
      failure-path tests verify direct-probe failures
      don't short-circuit api-passthrough ones; CLI
      dry-run test extended to assert all 5 invariants
      appear in stdout.

  - **Validation**: 9/9 smoke tests pass (167ms);
    `npm run scenarios:dry` lists all 5 invariants;
    `docker compose config --quiet` still passes.

  - Slice 4 progress: ~80% (13 of ~16+ sub-slices) —
    4d-scenarios-more is roughly half-way through the
    planned per-invariant additions.

- **slice 4d-scenarios-more (rateSanity)** (this iteration,
  on the api side) — first chain-layer invariant. Up to now
  all 5 invariants probed HTTP layers (api or indexer
  GraphQL); this one issues a raw JSON-RPC `eth_call` to
  the sDAI contract on Gnosis and asserts the result is
  sane.

  - **What it does**: eth_call to sDAI
    (0x89C80A4540A00b5270347E02e2E144c71da2EceD) with
    `getRate()` selector (0x679aefce); parses uint256 via
    BigInt; asserts ≥ 10n ** 18n (rate ≥ 1.0). Mirrors
    `src/services/rate-provider.js` (same address +
    selector + parse).

  - **Why ≥ 1.0**: sDAI is ERC-4626; rate at launch was
    1.0 and grows over time as savings accrue. A rate < 1
    implies broken contract / corrupt fork / wrong
    contract address.

  - **Future enhancement**: cross-run monotonicity (needs
    persistent state — orchestrator is one-shot, so within
    a run monotonicity is trivially "≥ 1 sample").

  - **What was added**:
    * Constants: SDAI_GNOSIS_ADDRESS, GET_RATE_SELECTOR,
      ONE_E18 (BigInt literal 10n ** 18n)
    * Helper: ethCall(rpcUrl, to, data, timeoutMs)
    * The invariant itself (orchestrator↔chain layer)
    * Fixture extended with /rpc POST handler + sDAIRateRaw
      / rpcError options; fullCtx() helper sets rpcUrl
    * 3 new test cases (happy 1.2, fail < 1.0, RPC error)

  - **Validation**: 12/12 smoke tests pass (171ms — was
    9/9); `npm run scenarios:dry` lists all 6 invariants;
    `docker compose config --quiet` still passes.

  - Slice 4 progress: ~83% (14 of ~17 sub-slices). Next
    bot-doable: probabilityBounds (price ∈ [0, 1]) or
    candlesAggregation or chartShape — meaningful new
    invariants on the now-stable RPC + GraphQL plumbing.

- **slice 4d-scenarios-more (anvilBlockNumber + anvilChainId)**
  (this iteration, on the api side) — two new chain-process
  probes complement `rateSanity` (contract STATE) with chain-
  PROCESS health checks. Naturally paired:
  * `anvilBlockNumber` — eth_blockNumber > 0 (chain has
    state, fork loaded a real starting point)
  * `anvilChainId` — eth_chainId == 0x64 (chain 100 =
    Gnosis; catches "fork wrong chain" + "running bare
    anvil at default 31337")

  - **Why split into 3 chain-layer invariants**: separation
    of concerns lets failures point at the right layer.
    BlockNumber=0 means anvil isn't producing blocks /
    fork didn't load. ChainId mismatch means forking the
    wrong chain. Rate < 1 means chain is alive but
    contract state isn't right. Each failure mode is a
    different bug; bundling would obscure which fired.

  - **Refactor of fixture's /rpc handler**: was
    eth_call-only (returned rate-shaped response for any
    method). Now parses the request body, branches on
    method, returns method-appropriate responses (eth_call
    → rate hex, eth_blockNumber → blockNumberHex,
    eth_chainId → chainIdHex; method-not-mocked +
    JSON-parse-error fallbacks). Two new options:
    blockNumberHex / chainIdHex.

  - **Refactor of invariants.mjs**: introduced
    `rpcRequest(rpcUrl, method, params)` as the generic
    JSON-RPC helper. ethCall(...) now delegates to it.
    Both new invariants use rpcRequest directly with
    method name + empty params.

  - **Smoke test coverage**: 4 new tests (happy + failure
    for each new invariant). All 16 tests pass (was 12).

  - **Validation**: 16/16 smoke tests pass (199ms);
    `npm run scenarios:dry` lists all 8 invariants;
    `docker compose config --quiet` still passes.

  - Slice 4 progress: ~88% (15 of ~17 sub-slices).
    4d-scenarios-more is now well past half-way. Remaining
    bot-doable invariants (probabilityBounds,
    candlesAggregation, chartShape, conservation) all need
    real pool data or multiple contract calls — meatier
    than the simple GraphQL/RPC probes shipped so far.

- **slice 4d-scenarios-more (apiWarmer + apiSpotCandlesValidates)**
  (this iteration, on the api side) — two new api-internal
  invariants cover the previously-unmonitored `/warmer`
  endpoint and add a validation-regression check that
  doesn't need real data:
  * `apiWarmer` — GET `/warmer`, assert 200 + JSON. Doesn't
    peek at body shape (over-coupling would make it fragile).
  * `apiSpotCandlesValidates` — GET `/api/v1/spot-candles`
    WITHOUT ticker, assert 400 + JSON `{error: ...}`.
    Catches three failure modes in one check: validation
    removed (200 with garbage), validation crashes (5xx),
    route disconnected (404).

  - **Why these two**: existing 8 invariants covered one
    api endpoint (/health), 2 GraphQL passthroughs, 2
    direct-indexer probes, 3 chain-layer RPC. They don't
    exercise other api endpoints OR input-validation paths.
    This slice picks off two — the warmer endpoint
    (lowest-risk: pure liveness) and the validation
    behavior (interesting bug class: 400→200 silently
    breaks downstream consumers).

  - **Smoke fixture extensions**: `/warmer` + 
    `/api/v1/spot-candles` GET routes added with toggles
    (`warmerOk`, `warmerContentType`,
    `spotCandlesNoTickerStatus`, `spotCandlesNoTickerBody`).

  - **Smoke test coverage**: 5 new tests (happy + failures
    for each); 21/21 pass (was 16). Now 10 invariants in
    catalog.

  - Slice 4 progress: ~88% (16 of ~18 sub-slices —
    4d-scenarios-more keeps absorbing one or two
    invariants per iteration). The api-internal/RPC/GraphQL
    layers are now well covered (10 invariants); meaningful
    next additions step into data-shape validation (real
    pool data, cross-layer reconciliation).

- **slice 4d-scenarios-more (registryHasProposalEntities +
  candlesHasPools)** (this iteration, on the api side) —
  first DATA-AWARE indexer probes, one level deeper than
  the bare `__typename` checks:
  * `registryHasProposalEntities` — query
    `{ proposalEntities(first: 1) { id } }`, assert array
    non-empty
  * `candlesHasPools` — query `{ pools(first: 1) { id } }`,
    same shape

  - **Bug class caught**: "indexer reachable but empty".
    Concrete failure modes: sync didn't complete; fork
    started after all proposal/pool deployment events;
    schema-migration cold-start failure (per Phase 3
    effort notes).

  - **Schema reality verification** (worth pinning):
    Registry has Aggregator/Organization/ProposalEntity/
    MetadataEntry types — auto-gen plurals make the field
    `proposalEntities` (NOT `proposals`). Candles has
    WhitelistedToken/Proposal/Pool/Candle/Swap → the
    naming collision (registry's `ProposalEntity` vs
    candles' `Proposal`) is real: registry tracks
    proposal METADATA, candles tracks the AMM-pool
    wrapper for conditional tokens.

  - **Fixture extension**: existing direct endpoints now
    return SUPERSET response (both `__typename` and the
    relevant data array) so each invariant just looks at
    its specific field; no GraphQL parsing in the fixture.
    Two new options:
    `registryProposalEntitiesCount`, `candlesPoolsCount`.

  - **Smoke tests**: 4 new (happy + empty for each); 25/25
    pass (was 21). 12 invariants total now: 5 api-internal
    + 4 indexer + 3 chain-layer.

  - Slice 4 progress: ~89% (17 of ~19 sub-slices). Each
    iteration is now 1-2 invariants; the slice keeps
    expanding as new bug classes surface.

- **slice 4d-scenarios-more (candlesHasSwaps + candlesHasCandles)**
  (this iteration, on the api side) — completes the
  candles-pipeline triplet alongside `candlesHasPools`. Each
  catches a DISTINCT stage of sync:
  * `candlesHasPools` (existing) — pool-deployment events
  * `candlesHasSwaps` (new) — per-trade Swap events
  * `candlesHasCandles` (new) — period-aggregator output

  - **Why these matter as a triplet**: each represents a
    different async failure mode. Pool exists w/o swaps =
    no trades or sync caught up to deployment but not past;
    swaps exist w/o candles = aggregator broken or behind.
    Together the triplet fingerprints which stage is
    unhealthy — better than a single "candles indexer
    empty" check.

  - **Concrete bug classes distinguished**:
    * Indexer not started → all 3 fail
    * Caught up to pool deployment but not past → pools=ok,
      swaps+candles=fail
    * Trades arriving but Checkpoint @aggregate job dead →
      pools+swaps=ok, candles=fail (real bug; aggregate
      jobs can silently die)

  - **Fixture extension**: candles-direct response now
    returns pools + swaps + candles arrays in one superset
    payload. Two new options: candlesSwapsCount,
    candlesCandlesCount.

  - **Smoke tests**: 4 new (happy + cross-stage failure
    modes); 29/29 pass (was 25). Now 14 invariants: 5
    api-internal + 6 indexer + 3 chain-layer.

  - Slice 4 progress: ~89% (18 of ~20 sub-slices —
    4d-scenarios-more keeps expanding the invariant set).
    Next bot-doable: candlesAggregation (cross-layer
    reconciliation, the natural next step after the
    per-stage probes), chartShape, probabilityBounds,
    conservation, cross-run rateSanity monotonicity.

- **slice 4d-scenarios-more (registryHasOrganizations +
  registryHasAggregators)** (this iteration, on the api
  side) — completes the registry-entity triplet alongside
  `registryHasProposalEntities`, mirroring the structural
  symmetry of the candles-pipeline triplet:
  * `registryHasProposalEntities` (existing) — proposal
    metadata indexed
  * `registryHasOrganizations` (new) — organization
    metadata indexed
  * `registryHasAggregators` (new) — root-tree entity
    indexed

  - **Why these matter**: the registry schema has 3
    hierarchically-nested entity types (Aggregator →
    Organization → ProposalEntity), each populated from a
    separate event handler. Each can independently fail to
    sync. Concrete bug classes:
    * Aggregator handler broken → no orgs/proposals can
      resolve their parent (api joins fail silently)
    * Organization handler broken → proposals exist but
      lack org-level metadata
    * ProposalEntity handler broken → no proposals visible

  - **Production hint pinned**: `registryHasAggregators`'s
    body comment notes futarchy.fi production has exactly
    one Aggregator at
    `0xc5eb43d53e2fe5fdde5faf400cc4167e5b5d4fc1` (per
    src/routes/unified-chart.js); harness fork inherits it.

  - **Symmetry with candles**: harness now has full
    data-aware coverage of BOTH indexers' schema-discoverable
    entities. 6 data-aware indexer invariants total (3 per
    indexer, mirroring each other structurally).

  - **Fixture extension**: registry-direct response now
    returns proposalEntities + organizations + aggregators
    in superset payload. Two new options:
    registryOrganizationsCount, registryAggregatorsCount.

  - **Smoke tests**: 4 new (happy + cross-entity failure
    modes); 33/33 pass (was 29). Now 16 invariants: 5
    api-internal + 8 indexer + 3 chain-layer.

  - Slice 4 progress: ~90% (19 of ~21 sub-slices). Both
    indexers now have full data-aware triplet coverage
    (3 entities each). Next bot-doable invariants are
    cross-layer reconciliations (candlesAggregation,
    chartShape, probabilityBounds, conservation) — meatier
    than the additive per-entity probes.

- **slice 4d-scenarios-more (candleOHLCOrdering +
  candleVolumesNonNegative)** (this iteration, on the api
  side) — first DATA-SHAPE invariants. Up to now all 16
  indexer invariants checked existence (does the row
  exist?). These two check VALUES (does the row's content
  make sense?). Both query the latest candle:
  * `candleOHLCOrdering` — `low ≤ open, close ≤ high`
    (and `low ≤ high`)
  * `candleVolumesNonNegative` — `volumeToken0 ≥ 0` AND
    `volumeToken1 ≥ 0`

  - **Bug classes caught**:
    * OHLC failure: aggregator min/max accumulator broken
      (signedness error, swap-direction misclassification,
      uninitialized-min-equals-max edge case). `high < low`
      is impossible by definition; `close > high` means the
      close-of-period update path missed a max() call.
    * Volume failure: signed-amount bug — probably
      subtracting outgoing from incoming when it should
      take Math.abs(). Negative volumes nonsensical.

  - **Vacuously true when no candles**: both return ok if
    candles[] is empty. That's candlesHasCandles's concern,
    not these. Cleanly separates "no data" from "data is
    wrong" — important during compose startup.

  - **Schema details pinned**: open/high/low/close/
    volumeToken0/volumeToken1 all `String!` per
    `futarchy-indexers/proposals-candles/checkpoint/src/schema.gql`.
    parseFloat() tolerates either decimal or scientific.

  - **Fixture extension**: 6 new options for the 6 latest-
    candle fields. The first candle row in the response
    array carries the OHLC + volume fields; subsequent
    rows just have id.

  - **Smoke tests**: 6 new (happy + 5 specific failure
    modes); 39/39 pass (was 33). Now 18 invariants: 5
    api-internal + 10 indexer + 3 chain-layer.

  - Slice 4 progress: ~90% (20 of ~22 sub-slices). The
    harness now has 18 invariants distinguishing many
    distinct failure modes — existence vs shape vs
    cross-layer reconciliation. Remaining: cross-layer
    reconciliations + cross-run monotonicity.

- **slice 4d-scenarios-more (apiHealthBodyShape)**
  (this iteration, on the api side) — first body-shape
  probe on /health:

  * STRENGTHENS the existing apiHealth (status-code-only)
    into a body validation. Production /health emits
    `{ status: 'ok', timestamp: <ISO 8601> }` — both
    fields matter to downstream ops.

  * Why both invariants exist:
    - apiHealth (status-code-only) — catches "endpoint
      dead" outright
    - this one (body shape) — catches refactors that
      keep the endpoint serving 200 but change body
      shape, silently breaking downstream consumers

  * Bug shapes caught (NOT caught by apiHealth):
    refactor returns just the string 'ok' (not JSON);
    status field renamed to 'state'; status value changed
    ('healthy' instead of 'ok' — LB string-match silently
    fails); timestamp dropped (dashboards parsing 'last-
    fresh' age silently break); timestamp emitted as Unix
    epoch number instead of ISO 8601 string (every ISO
    parser breaks); timestamp string but malformed.

  * ISO 8601 validation strategy: Date.parse() — robust
    enough to accept canonical new Date().toISOString()
    format and reject malformed inputs. Stricter regex
    would be brittle (variant ISO formats are valid).

  * Fixture extension: /health handler now defaults to
    production shape (was `{ ok: true }`). New knobs:
    healthStatus, healthTimestamp, healthBody (full-body
    override).

  * 49 invariants now: 13 api-internal (was 12) + 27
    indexer + 9 chain-layer. Smoke tests: 4 new (default
    happy; status renamed — sister apiHealth STILL passes;
    timestamp dropped; timestamp as Unix epoch number).
    164/164 pass. Api commit: `73a029e`.

- **slice 4d-scenarios-more (swapAmountsAllRowsPositive)**
  (previous iteration, on the api side) — first iterate-all-
  rows extension on the swap side:

  * Strengthens swapAmountsPositive (latest-only) into a
    per-row check across the first 50 swaps. Mirrors the
    poolTypeIsValidEnum pattern (iterate-all-rows enum
    check at the indexer layer).

  * Why both invariants exist:
    - swapAmountsPositive (LATEST only) — cheap probe;
      catches event-decoder bugs uniform across ALL swaps
    - this one (UP-TO-50 rows) — catches bugs that affect
      SUBSETS of swaps without affecting the latest

  * Bug shapes caught (NOT caught by latest-only):
    indexer reorg re-processed historical blocks (latest
    fine, old rows wrong); block-context-dependent decoder
    bug (reads "decimals" from pool's CURRENT state instead
    of swap's block, corrupting historical swaps from
    before a decimals change); partial-rewrite bug (fix
    re-emitted only swaps from a specific block range with
    corrupted shape); pool-specific decoder bug (only swaps
    for one pool affected; latest happens to be a different
    pool).

  * The 50-row cap: keep query cheap. If the indexer has
    thousands of swaps and 49/50 are wrong, that's already
    a strong signal; full-table iteration would bloat
    smoke-test runtime without proportional signal gain.

  * Fixture extension: buildSwaps now defaults amountIn/
    amountOut to '1.0' for non-zero indices (index 0 still
    uses latestSwap* for back-compat). New per-row override
    knobs: swapAmountIns, swapAmountOuts arrays.

  * 48 invariants now: 12 api-internal + 27 indexer +
    9 chain-layer (was 9 chain). Smoke tests: 4 new.
    160/160 pass. Api commit: `af23083`.

- **slice 4d-scenarios-more (anvilSnapshotCapabilityPresent)**
  (previous iteration, on the api side) — second chain-
  CAPABILITY probe (ninth chain-layer invariant):

  * Sister to anvilImpersonationCapabilityPresent. Together
    they form the MINIMAL CAPABILITY SET scenarios depend
    on: impersonate (call as arbitrary account) +
    snapshot/revert (roll back state between tests).
    Without either, scenarios silently fail in
    qualitatively different ways.

  * Distinct from impersonation: evm_snapshot is part of
    the GANACHE LINEAGE — supported by both anvil AND
    hardhat-compatible clients, but NOT by go-ethereum,
    erigon, reth. Failure modes are complementary:
    `anvil_*` missing → wrong dev client (hardhat instead
    of anvil); `evm_*` missing → real client (geth/erigon/
    reth). Both ok → minimal scenario capability satisfied.

  * Why we check non-empty hex: spec says evm_snapshot
    returns a quantity (hex string) identifying the
    snapshot. A null/non-hex response means method is
    REGISTERED but subsystem is broken — calling
    evm_revert with that silently fails. The non-hex
    check distinguishes "registered but broken" from
    "not registered at all".

  * Bug shapes caught (NOT caught by impersonation probe):
    --no-snapshot or similar flag disabling the snapshot
    subsystem; RPC method-allowlisting blocking evm_*
    while allowing anvil_*; wrong-fork client (geth/
    erigon) lacking ganache extensions entirely; anvil
    version regression where snapshot subsystem returns
    null.

  * 47 invariants now: 12 api-internal + 26 indexer +
    9 chain-layer (was 8). Smoke tests: 4 new + 1
    fixture knob (snapshotResult: '0x1' | false | null
    | 'rpc-error') + 1 RPC dispatch case (evm_snapshot).
    156/156 pass. Api commit: `530fade`.

  * Chain layer now has NINE coverage points; the final
    two are CAPABILITY probes that test "does the RPC
    method WORK" rather than "what does the chain SAY".
    The minimal scenario primitive set (impersonate +
    snapshot) is now fully sentinel-protected.

- **slice 4d-scenarios-more (anvilImpersonationCapabilityPresent)**
  (previous iteration, on the api side) — chain-CAPABILITY
  probe (eighth chain-layer invariant):

  * First invariant in the catalog that exercises an
    ANVIL-SPECIFIC RPC method (anvil_impersonateAccount)
    rather than a standard JSON-RPC method. Asserts the
    method is actually callable, not just that the client
    *claims* to be anvil.

  * Distinct from anvilClientVersionMentionsAnvil (which
    checks the version string only). With
    `anvilImpersonationSupported: false`, the capability
    probe FAILS while the identity probe STILL passes —
    proving the two checks are orthogonal. Several
    "hardhat-compatible" forks and patched-anvil builds
    emit "anvil" in web3_clientVersion but lack the
    impersonation extension.

  * Why this matters for scenarios: every futarchy flow
    that mutates state requires impersonating an account
    (proposer, trader, resolver). Without this method,
    EVERY scenario silently fails to produce state
    changes.

  * Bug shapes caught (NOT caught by other chain probes):
    hardhat-compatible third-party RPC reports anvil/X
    but lacks the method; anvil version regression
    removed the method; RPC layer with method-allowlisting
    excludes anvil_*; forked anvil disabled impersonation
    for "production safety".

  * 46 invariants now: 12 api-internal + 26 indexer +
    8 chain-layer (was 7). Smoke tests: 4 new + 1
    fixture knob (anvilImpersonationSupported: true |
    false | 'rpc-error') + 1 RPC dispatch case
    (anvil_impersonateAccount). 152/152 pass. Api
    commit: `43bb543`.

  * Chain layer now has EIGHT coverage points:
    existence, identity-network-expected, identity-
    client, block shape, fee market, RPC-method-
    consistency, CAPABILITY (NEW), economic anchor.
    The capability layer is qualitatively new — it
    tests "does the RPC method WORK" rather than
    "what does the chain SAY".

- **slice 4d-scenarios-more (anvilNetworkVersionMatchesChainId)**
  (previous iteration, on the api side) — chain-RPC-CONSISTENCY
  check (seventh chain-layer invariant):

  * Asserts net_version (decimal string) and eth_chainId
    (hex) numerically agree. The two methods should report
    the same chain ID by spec — net_version is the legacy
    method, eth_chainId is the EIP-695 modern one.
    Divergence silently breaks any consumer that picks
    one or the other.

  * Orthogonal to anvilChainId: that asserts eth_chainId
    === 0x64 (the EXPECTED Gnosis value); this asserts
    net_version === eth_chainId (CONSISTENCY regardless
    of WHAT they equal). Demonstrated by the bare-anvil-
    31337 test: both methods report 31337, this passes
    (consistency intact), anvilChainId fails (wrong
    network).

  * Bug shapes caught (NOT caught by anvilChainId alone):
    fork rebase updates one method but not the other;
    reverse-proxy misconfig routes them to different
    upstreams; mock fixture hardcodes one but not the
    other; anvil version regression where one method
    reads a stale cached config.

  * 45 invariants now: 12 api-internal + 26 indexer +
    7 chain-layer (was 6). Smoke tests: 5 new + 1
    fixture knob (netVersion) + 1 RPC dispatch case
    (net_version). 149/149 pass. Api commit: `af4fa09`.

  * Chain layer now has SEVEN coverage points: existence
    (anvilBlockNumber), identity-network-expected
    (anvilChainId), identity-client (anvilClientVersionMentionsAnvil),
    block shape (anvilLatestBlockSensible), fee market
    (anvilGasPricePresent), RPC-method-consistency
    (anvilNetworkVersionMatchesChainId — NEW), economic
    anchor (rateSanity).

- **slice 4d-scenarios-more (apiUnifiedChartXCacheTtlPresent)**
  (previous iteration, on the api side) — second response-
  HEADER probe in the catalog:

  * Sister to apiUnifiedChartHasObservabilityHeaders
    (X-Cache + X-Response-Time); this one covers
    X-Cache-TTL. Split into a separate invariant for
    single-responsibility per probe — ops dashboards
    filter on TTL independently of hit/miss.

  * Scope correction: the original X-Cache+X-Response-Time
    invariant's comment said TTL was HIT-only. Inspection
    of `src/routes/unified-chart.js` shows it's set on
    BOTH paths (line 74 HIT + line 278 MISS), so this
    asserts unconditionally rather than as a conditional
    WHEN-HIT check. The old comment was updated in the
    same commit.

  * Format asserted: positive integer string, no unit
    suffix. Catches refactor dropping TTL from one path
    but not the other (sister probe STILL passes —
    demonstrates per-header-split value), 'NaN'/'-1'
    from timing/env-var bugs, accidental unit suffix
    ('300s' silently wrong since parseInt returns 300
    by coincidence), header dropped entirely.

  * 44 invariants now: 12 api-internal (was 11) + 26
    indexer + 6 chain-layer. Smoke tests: 5 new + 1
    fixture knob (unifiedChartXCacheTtl). 144/144 pass.
    Api commit: `df81b39`.

  * Unified-chart endpoint now has FOUR coverage layers:
    shape (apiUnifiedChartShape), count-bound
    (chartCandleCountsBoundedByDirect), per-time-pair
    membership (chartCandlesAreSubsetOfDirect), AND TWO
    observability-header probes (apiUnifiedChartHasObservabilityHeaders
    for X-Cache+X-Response-Time, apiUnifiedChartXCacheTtlPresent
    for X-Cache-TTL — NEW).

- **slice 4d-scenarios-more (anvilGasPricePresent)**
  (previous iteration, on the api side) — chain-FEE-MARKET
  probe (sixth chain-layer invariant):

  * Companion to anvilLatestBlockSensible + anvilChainId.
    Those pin "chain reachable + right network", this
    pins the FEE-MARKET state, which can be independently
    broken.

  * Three named failure modes: null → "EIP-1559-only mode
    disabled legacy gas pricing"; 0x0 → "broken fee
    market — anvil --gas-price 0 misconfig — masks gas
    accounting bugs in scenarios"; non-hex → "RPC-layer
    regression breaks downstream BigInt parsing".

  * Why this matters for scenarios: most futarchy flows
    submit transactions (impersonateAccount + send) which
    need a working gas price for estimation. Without
    this probe, a scenario reports "transaction failed
    at step N" with no breadcrumb pointing to the fee-
    market issue.

  * 43 invariants now: 11 api-internal + 26 indexer +
    6 chain-layer (was 5). Smoke tests: 5 new + 1
    fixture knob (gasPriceHex) + 1 RPC dispatch case
    (eth_gasPrice). 139/139 pass. Api commit: `4b22692`.

  * Chain layer now has SIX coverage points: existence
    (anvilBlockNumber), identity-network (anvilChainId),
    identity-client (anvilClientVersionMentionsAnvil),
    block shape (anvilLatestBlockSensible), fee market
    (anvilGasPricePresent — NEW), economic anchor
    (rateSanity). Defense-in-depth ring around the chain
    layer that scenarios depend on.

- **slice 4d-scenarios-more (chartCandlesAreSubsetOfDirect)**
  (previous iteration, on the api side) — first cross-layer
  per-row TIME-PAIR check for the unified-chart endpoint:

  * STRENGTHENS the existing chartCandleCountsBoundedByDirect
    (count-bound) into a per-row time-membership check.
    Every candle time the api unified-chart endpoint
    surfaces must correspond to a real candle the indexer
    actually emitted; otherwise the api is fabricating
    data (or mixing in another proposal's periods).

  * Why time, not id: applyRateToCandles reshapes raw
    indexer candles into {time, close, ...} and does not
    expose the original ID. Both layers agree on `time`
    (period-start unix timestamp) so we use that as the
    matching key.

  * Bug classes caught (NOT caught by count bound):
    transform fills gaps with synthetic period-start
    timestamps; cache key mismatch returns a different
    proposal's candles where count happens to be ≤ direct;
    time-bucket calculation off-by-one shifts every api
    time by N seconds/hours; SPOT bleeds into yes/no
    arrays (spot uses different time alignment).

  * 42 invariants now: 11 api-internal (was 10) + 26
    indexer + 5 chain-layer. Smoke tests: 4 new + 2
    existing tests tweaked to align candleTimes with
    api response (and reordered descending so
    candleTimeMonotonic stays happy). 134/134 pass.
    Api commit: `d927fc5`.

  * Unified-chart endpoint now has THREE coverage layers:
    shape (apiUnifiedChartShape — yes/no/spot are arrays),
    count-bound (chartCandleCountsBoundedByDirect — api
    total ≤ direct total), per-time-pair membership
    (chartCandlesAreSubsetOfDirect — every api time
    exists in direct set). Each catches a distinct bug
    class; each alone would let the others slip.

- **slice 3e (smoke-tests CI workflow STAGED on api side)**
  (previous iteration — docs-only mirror on interface side):

  - **Per maintainer's CI question**: api-side smoke-test
    workflow now staged in version control on the api repo
    (`futarchy-api/auto-qa/harness/ci/auto-qa-harness-smoke.yml.staged`).
    First staged workflow on the api side; all prior
    staged workflows (3a, 3c, 3d) live here on interface
    for the Playwright suite. 4 total CI workflows now
    awaiting promotion (1 api + 3 interface).

  - **What runs**: `npm run smoke:scenarios` (130+ tests
    against in-process node:http fixture, ~1.5s test time
    + Node setup, no docker, no real services). Plus a
    second step verifying `HARNESS_DRY_RUN=1` catalog
    listing works at the workflow level. Trigger:
    `workflow_dispatch` only for v1, matching slices 3a +
    3c. Total runtime <1 min.

  - **Why this is the right next CI step**: cheapest of
    the 4 staged workflows to promote (no docker, no
    Playwright, no GH Actions secrets). Recommended
    FIRST promotion target for the maintainer.

  - **Why it lives on api side, not here**: the smoke-
    test runner + fixture + 41 invariants all live in
    `futarchy-api/auto-qa/harness/`. This repo's CI
    staging area (`auto-qa/harness/ci/`) hosts only the
    Playwright workflows that need browser deps. See
    `auto-qa/harness/ci/README.md` here vs the new
    one over on api side — they document the same
    staging-dance pattern for their respective
    workflow tracks.

  - **Validation**: no code changes — just staged YAML
    + README on api side. 130/130 smoke tests still
    green. 41 invariants still in catalog. Doc mirror
    here (status line + this entry). Api commit:
    `10ab868`.

- **slice 4d-scenarios-more (anvilClientVersionMentionsAnvil)**
  (previous iteration, on the api side) — chain-CLIENT
  identity pin:
  * `anvilClientVersionMentionsAnvil` — calls
    web3_clientVersion, asserts response contains
    "anvil" (case-insensitive).

  - **Distinct from anvilChainId**: chain ID 0x64 can
    match across multiple client implementations (anvil,
    geth, erigon forks). Harness depends on Anvil-
    specific RPC extensions (anvil_impersonateAccount,
    anvil_setBalance, evm_snapshot/revert,
    evm_setNextBlockTimestamp). Wrong client lets all
    chain probes pass but breaks scenario state changes.

  - **Smoke tests**: 4 new (default anvil happy,
    case-insensitive "Anvil 1.5.0-stable", failure
    with geth — verifies anvilChainId STILL passes,
    failure with non-string response); 130/130 pass
    (was 126). 41 invariants now: 10 api-internal +
    26 indexer + 5 chain-layer (was 4).

- **slice 4d-scenarios-more (apiUnifiedChartHasObservabilityHeaders)**
  (previous iteration, on the api side) — **40-invariant
  milestone reached**. First response-HEADER validation
  in the catalog:
  * `apiUnifiedChartHasObservabilityHeaders` — calls
    `/api/v2/proposals/:id/chart`, asserts response
    has `X-Cache: HIT|MISS` AND `X-Response-Time:
    Nms` headers.

  - **Why this is a distinct probe class**: every
    prior api invariant probed status code or body
    shape. The unified-chart handler emits
    observability headers on every code path (cached
    HIT + fresh MISS); ops dashboards consume them
    for cache-hit rate and p50/p95 latency. A
    regression that drops them is INVISIBLE to body
    checks — body still parses fine.

  - **Bug shapes caught**: removal of cache layer
    instrumentation; addition of third state
    ('STALE', 'BYPASS') without telling ops; format
    regressions emitting 'NaN ms' or raw integer.

  - **Test 3 demonstrates the gap closure**: drop the
    X-Cache header. apiUnifiedChartShape STILL passes
    since body shape is unchanged; only this header
    probe catches the broken instrumentation.

  - **Fixture extension**: chart handler now emits
    `x-cache` and `x-response-time` headers
    unconditionally (matching production); new
    `unifiedChartXCache` / `unifiedChartXResponseTime`
    knobs (set to null to drop).

  - **Smoke tests**: 5 new (happy MISS, happy HIT,
    X-Cache dropped — verifies apiUnifiedChartShape
    STILL passes, X-Cache='STALE' invalid value,
    X-Response-Time wrong format); 126/126 pass
    (was 121). **40 invariants** total: 10 api-
    internal + 26 indexer + 4 chain-layer.

  - Slice 4 progress: 40-invariant milestone. Catalog
    composition by KIND of correctness: existence,
    validation, data-plane shape, single-row data
    shape, multi-row data shape, cross-layer match,
    cross-entity FK, cross-entity time coherence,
    chain-layer, passthrough liveness, economic,
    magnitude bounds, enum validation, pinning,
    AND now response headers (NEW). Remaining
    bot-doable: candlesAggregation, full chartShape
    match, conservation, monotonicity (TWAP),
    cross-run rate monotonicity.

- **slice 4d-scenarios-more (registryHasFutarchyProdAggregator)**
  (previous iteration, on the api side) — high-value
  PINNING check at the registry layer:
  * `registryHasFutarchyProdAggregator` — asserts the
    indexer has the production futarchy aggregator at
    `0xc5eb43d53e2fe5fdde5faf400cc4167e5b5d4fc1`
    (hardcoded in 3 api source files:
    registry-adapter.js, unified-chart.js,
    market-events.js).

  - **Registry-side analog of anvilChainId**: chain
    pin proves we forked Gnosis (not bare anvil);
    registry pin proves the indexer was bootstrapped
    with the right chain + start_block + contract
    config. Together they pin "this is the right
    environment, not some lookalike".

  - **Why this catches what other invariants miss**:
    A wrong-block bootstrap might produce ghost
    aggregators — registryHasAggregators (existence)
    PASSES because some aggregators exist; only this
    invariant catches that the SPECIFIC prod one is
    missing. Test 4 verifies this explicitly:
    registryAggregatorsCount=3 + prod absent →
    existence pass + this fail.

  - **Bug shapes caught**: indexer started against
    wrong block (before aggregator deployment);
    indexer pointed at wrong chain; data wipe missed
    re-sync.

  - **Fixture extension**: new `includeFutarchyProdAggregator`
    knob (default true) APPENDS prod address to the
    aggregators list. Append (not prepend) keeps
    existing tests that assert `mock-agg-0` at
    index 0 unchanged. 2 existing tests updated to
    set knob=false where they assert exact aggregator
    counts.

  - **Smoke tests**: 3 new (happy with prod present
    + 2 total, vacuous-no-aggregators, prod missing
    despite 3 aggregators existing — verifies
    registryHasAggregators STILL passes); 121/121
    pass (was 118). Now 39 invariants: 9 api-internal
    + 26 indexer + 4 chain-layer.

  - Slice 4 progress: hardcoded-address pinning is
    now SYMMETRIC across chain + registry layers.
    Both prove "right environment". Remaining bot-
    doable: candlesAggregation, full chartShape
    match, conservation, monotonicity (TWAP),
    cross-run rate monotonicity.

- **slice 4d-scenarios-more (poolTypeIsValidEnum)**
  (previous iteration, on the api side) — first
  indexer-side enum validation:
  * `poolTypeIsValidEnum` — for all pools (first 50),
    asserts type ∈ {CONDITIONAL, PREDICTION,
    EXPECTED_VALUE} (the set sourced from
    unified-chart.js's findPoolByOutcome()).

  - **Why this catches what other invariants miss**:
    A typo'd type like "PRDICTION":
    * candlesHasPools: PASSES (existence is fine)
    * swap/candlePoolReferentialIntegrity: PASSES
      (FK resolves)
    * probabilityBounds: PASSES (vacuous on
      non-PREDICTION; "PRDICTION" ≠ "PREDICTION",
      so skipped)
    * api adapter: SILENTLY DROPS the pool → blank
      UI for that proposal
    Test 4 verifies this exact scenario.

  - **New pattern: iterate-all-rows enum check**.
    Most existing indexer checks look at `first 1`
    or use COUNT. This one iterates all returned
    rows and validates each. Useful template for
    future per-row field-validation invariants
    (outcomeSide ∈ {YES, NO}, address fields, etc.).

  - **Bug shapes caught**: schema migration adds 4th
    type (e.g., 'AMM_V2'); indexer regression
    returns null type; typo'd type values;
    string-vs-int encoding regression.

  - **No new fixture knobs**: existing `poolType`
    knob covers all cases.

  - **Smoke tests**: 5 new (PREDICTION default,
    CONDITIONAL, vacuous-no-pools, typo "PRDICTION"
    — verifies candlesHasPools + probabilityBounds
    STILL pass, null type / handler regression);
    118/118 pass (was 113). Now 38 invariants:
    9 api-internal + 25 indexer + 4 chain-layer.

  - Slice 4 progress: pool-entity coverage now spans
    existence (candlesHasPools) + FK from child
    entities (swap/candle FK) + per-pool field
    validation (poolTypeIsValidEnum). Three layers
    of pool checking.

- **slice 4d-scenarios-more (swapAmountsBoundedAbove)**
  (previous iteration, on the api side) — closes the
  swap-side magnitude gap:
  * `swapAmountsBoundedAbove` — for the latest swap,
    asserts amountIn AND amountOut < 1e15.

  - **Why this closes a real gap**: catalog had
    asymmetric magnitude coverage —
    * Candle side: `probabilityBounds` (close ≤ 1
      for PREDICTION) + `candlePricesNonNegative`
      (OHLC ≥ 0 universal)
    * Swap side: only sign (swapAmountsPositive
      checks > 0) + time range (swapTimestampSensible)
    No upper-bound check on swap amounts existed —
    a raw uint256 leak (amountIn = "1000000000000000000"
    instead of decimal "1.0") would pass every
    existing swap probe.

  - **Threshold choice (1e15)**: even huge real
    swaps ($1M sDAI = "1000000.0") are far below
    1e15. Raw uint256 of any 18-decimal token is
    ≥ 1e18, so the bound cleanly separates real
    values from raw-int leaks with 3-orders-of-
    magnitude margin.

  - **Bug shapes caught**: raw uint256 leak (parseFloat
    returns 1e18 for "1000000000000000000"); parseFloat
    overflow / scientific-notation misformatting;
    token-decimal misalignment (USDC's 6 decimals
    applied to 18-decimal sDAI, scaling values by
    1e12).

  - **swapAmountsPositive STILL passes when this
    fails**: test 3 verifies a raw-int-leak scenario
    where amountIn=1e18. Sign check passes (1e18 > 0);
    distinguishes magnitude bug from sign bug.
    Same separation pattern as candlePricesNonNegative
    + candleOHLCOrdering on the candle side.

  - **No fixture changes**: existing knobs cover all
    cases.

  - **Smoke tests**: 4 new (happy with small decimals,
    vacuous, raw uint256 leak amountIn=1e18 — verifies
    swapAmountsPositive STILL passes, huge amountOut
    from token-decimal misalignment); 113/113 pass
    (was 109). Now 37 invariants: 9 api-internal +
    24 indexer + 4 chain-layer.

  - Slice 4 progress: magnitude-sanity family is now
    SYMMETRIC across candle and swap sides — each
    has lower-bound + upper-bound coverage.

- **slice 4d-scenarios-more (chartCandleCountsBoundedByDirect)**
  (previous iteration, on the api side) — first true
  cross-layer count check for unified-chart endpoint:
  * `chartCandleCountsBoundedByDirect` — issues
    parallel calls to api `/api/v2/proposals/:id/
    chart` AND direct candles indexer; asserts
    `sum(api.candles.{yes,no}.length) ≤ direct
    candles count`.

  - **Why ≤ rather than =**: api candles ⊆ direct
    candles. The api FILTERS direct candles by the
    proposal's YES + NO pools; direct query returns
    ALL candles in the indexer. So api count is a
    strict subset.

  - **Bug shapes caught**:
    * api fabricates extra candles (transform
      regression duplicates rows)
    * Filter regression — api returns ALL candles
      instead of just the proposal's pools
    * Cache-key mismatch returns a different (larger)
      proposal's candles

  - **What this is NOT** (deferred to future
    candlesAggregation): the full per-id pair-wise
    compare (requires modeling pool-filtering logic
    in the test) and sum-of-volumes reconciliation.
    This is the COUNT-bounded version (lower-cost
    first step toward documented chartShape match).

  - **Spot exclusion**: api.candles.spot comes from
    a DIFFERENT source (CoinGecko or spot-candles
    indexer), not the candles indexer — excluded
    from comparison. Yes + no only.

  - **Smoke tests**: 4 new (happy default 0+0 ≤ 1,
    vacuous both 0, happy subset 1+1 ≤ 5, failure
    filter regression 5+5 > 1 — verifies
    apiUnifiedChartShape STILL passes since shape
    is fine, only the count relationship catches
    it). Test fix: bumped candlesCandlesCount to 3
    in the previously-passing apiUnifiedChartShape
    happy-with-data test (which had yes=2 + no=1 = 3
    but default direct had 1). 109/109 pass (was
    105). Now 36 invariants: 9 api-internal + 23
    indexer + 4 chain-layer.

  - Slice 4 progress: cross-layer match family now
    spans 3 patterns (passthrough match, multi-
    entity passthrough match, filtered subset).
    Remaining: full chartShape ID-pair match,
    candlesAggregation, conservation, monotonicity
    (TWAP), cross-run rate monotonicity.

- **slice 4d-scenarios-more (candlePricesNonNegative)**
  (previous iteration, on the api side) — universal
  price-sanity probe:
  * `candlePricesNonNegative` — for ALL pool types,
    asserts latest candle's open/high/low/close ≥ 0.

  - **Closes a gap left by candleOHLCOrdering +
    probabilityBounds**:
    * Ordering check passes when low and high are
      both negative (low ≤ high holds for negatives)
      or mixed-sign with ordering preserved.
    * probabilityBounds catches close < 0 ONLY for
      PREDICTION-type pools, and ONLY checks the
      close field — non-PREDICTION pools and
      negative open/high/low slip through.

  - **Bug shapes caught**: sign-bug leak in price
    derivation for non-PREDICTION pools (CONDITIONAL
    + EXPECTED_VALUE); all-OHLC-negative aggregator
    bug; mixed-sign OHLC where close is positive
    but open/high/low aren't.

  - **No fixture changes needed** — existing knobs
    cover all OHLC fields; tests just override with
    negative values.

  - **Smoke tests**: 4 new (happy with all ≥ 0,
    vacuous, all-negative for CONDITIONAL pool —
    verifies BOTH candleOHLCOrdering AND
    probabilityBounds STILL pass proving the gap
    was real, mixed-sign for PREDICTION pool with
    positive close — verifies probabilityBounds
    STILL passes since close is fine, only the
    universal check catches it); 105/105 pass (was
    101). Now 35 invariants: 8 api-internal + 23
    indexer + 4 chain-layer.

  - Slice 4 progress: single-row data-shape coverage
    for candle entities now spans 5 complementary
    checks (ordering, volumes ≥ 0, time-monotonic
    cross-row, prices ≥ 0, probability bounds for
    PREDICTION). Each catches distinct bug classes.
    Remaining: candlesAggregation, full chartShape
    match cross-layer, conservation, monotonicity
    (TWAP), cross-run rate monotonicity.

- **slice 4d-scenarios-more (probabilityBounds)**
  (previous iteration, on the api side) — FIRST
  ECONOMIC INVARIANT in the catalog:
  * `probabilityBounds` — for PREDICTION-type pools
    (filtered via `candle.pool.type`), asserts
    `latestCandle.close ∈ [0, 1]`. The close IS the
    probability of YES outcome; values outside this
    range are bugs.

  - **Why economic invariants are a distinct
    category**: Existing invariants validate
    STRUCTURAL correctness ("data exists", "shape
    matches", "FK resolves"). Economic invariants
    validate ECONOMIC truths ("this number can only
    be in this range because of how AMMs work").
    Distinct value because a STRUCTURAL-only check
    passes when raw uint256 values leak into the
    response (close=1e18 has the right shape but is
    wildly out of range).

  - **Type-aware filtering**: only PREDICTION pools
    have prices that are probabilities. CONDITIONAL
    pools (YES_TOKEN/YES_CURRENCY ratios) and
    EXPECTED_VALUE pools (projected token values)
    have prices that CAN exceed 1 legitimately. The
    invariant filters via candle.pool.type from the
    indexer schema; vacuous when type is not
    PREDICTION OR field is missing (older indexer /
    schema migration in progress).

  - **Bug shapes caught (distinct from
    candleOHLCOrdering)**:
    * Indexer raw uint256 leak — close=1e18 satisfies
      "low ≤ high" if all four fields are 1e18, but
      is wildly out of range. Test 3 verifies
      candleOHLCOrdering STILL passes — distinguishes
      magnitude bug from ordering bug.
    * Sustained close > 1 — UI/AMM math bug
    * close < 0 — sign bug

  - **Fixture extension**: pools now carry `type`
    field (default `PREDICTION` — most common futarchy
    market type, makes invariant active in happy
    path); candle.pool object also carries type;
    new `poolType` knob lets tests override.

  - **Smoke tests**: 4 new (happy with PREDICTION
    pool, vacuous with CONDITIONAL pool, raw uint256
    leak — verifies candleOHLCOrdering STILL passes,
    negative close); 101/101 pass (was 97 — crossed
    the 100-test mark). Now 34 invariants: 8
    api-internal + 22 indexer + 4 chain-layer.

  - Slice 4 progress: economic invariants column now
    non-empty (1-of-5 documented economic invariants
    covered). Remaining: candlesAggregation,
    conservation, monotonicity (TWAP), no-phantom-
    mints. Plus full chartShape match cross-layer.

- **slice 4d-scenarios-more (anvilLatestBlockSensible)**
  (previous iteration, on the api side) — first chain-
  layer TIME-SHAPE probe:
  * `anvilLatestBlockSensible` — calls
    `eth_getBlockByNumber('latest', false)`, asserts
    block.hash is a valid 0x + 64-hex string AND
    block.timestamp ∈ [2020-01-01, now+1d].

  - **Why count-only block-number probe isn't
    enough**: anvilBlockNumber asserts `eth_blockNumber
    > 0`. That passes when the chain's time source
    is broken (year 2099, year 1970), when the fork
    is pinned at a frozen block, or when an anvil bug
    returns a block with structurally-invalid hash.
    All three would let downstream invariants pass
    silently while the fork is structurally compromised.

  - **Mirrors indexer-layer time-shape pattern**:
    swapTimestampSensible + candleTimeMonotonic
    already cover indexer-side time fields; this
    closes the same shape at the chain layer. Catalog
    now has consistent "sensible time" coverage
    across all three layers.

  - **Bug shapes caught**: stuck clock; wrong fork era
    (pre-2020 OR skewed forward); garbage block (hash
    invalid — anvil bug or misconfigured RPC);
    genesis-only state.

  - **Range choice [2020-01-01, now+1d]**: same as
    swapTimestampSensible — keeps "sensible time"
    bounds consistent across layers. 2020-01-01 is
    well before any Gnosis activity we care about
    (Gnosis Chain launched Dec 2018); +1d clock-skew
    bound matches NTP expectations.

  - **Fixture extension**: RPC mock now responds to
    `eth_getBlockByNumber` with `{hash, timestamp,
    number, parentHash}`; new `latestBlockHash` /
    `latestBlockTimestampHex` knobs default to
    valid 32-byte hash + "1 minute ago" timestamp.

  - **Smoke tests**: 4 new (happy with recent ts +
    valid hash, stuck-clock — verifies anvilBlockNumber
    STILL passes distinguishing block existence from
    sensible time, clock-skewed-to-2099, garbage
    hash); 97/97 pass (was 93). Now 33 invariants:
    8 api-internal + 21 indexer + 4 chain-layer.

  - Slice 4 progress: chain-layer coverage now spans
    count + identity + structural+time + contract
    state — each addresses a distinct chain failure
    mode. Next: deeper semantic invariants
    (probabilityBounds, candlesAggregation, full
    chartShape match, conservation, cross-run rate
    monotonicity).

- **slice 4d-scenarios-more (apiMarketEventsShape)**
  (previous iteration, on the api side) — closes the
  api-endpoint-shape arc:
  * `apiMarketEventsShape` — calls
    `/api/v1/market-events/proposals/harness-probe-
    proposal/prices`, asserts 200 + JSON content-type
    + the minimal contract every consumer in
    interface/ depends on: status='ok',
    conditional_yes/no.{price_usd, pool_id},
    spot.price_usd, timeline.{start, end}.

  - **Three-iteration arc complete**: the three
    documented /api/v* endpoints now each have a
    shape probe, picked to span the data-path
    weight spectrum:
    * `/api/v1/spot-candles?ticker=…` — light path
      (1 indexer touch, candles only)
    * `/api/v1/market-events/proposals/:id/prices`
      — middle path (registry resolve + pool fetch
      + currency rate, no candle aggregation)
    * `/api/v2/proposals/:id/chart` — heavy path
      (all 3 layers + parallel candle fetch +
      transform)

  - **Bug shapes caught**:
    * Pool resolve returned null + error path emits
      wrong shape (missing conditional_* keys → UI
      dashboard crashes)
    * status field renamed silently (the 'ok'
      literal is the consumer branch point — every
      "if (response.status === 'ok')" check breaks
      without a single throw)
    * Per-endpoint failure mode (test 2 verifies
      apiUnifiedChartShape STILL passes when this
      one fails)
    * Status code regression

  - **Fixture extension**: route `/api/v1/market-
    events/proposals/<id>/prices` (regex match)
    returns 200 + the minimal valid response by
    default; new marketEventsStatus / marketEventsBody
    knobs for drift simulation. Default body uses
    representative numeric values (yes=0.55, no=0.45,
    spot=1.05).

  - **Smoke tests**: 4 new (happy with full shape,
    data-plane error 500, status field renamed,
    conditional_yes missing); 93/93 pass (was 89).
    Now 32 invariants: 8 api-internal + 21 indexer +
    3 chain-layer.

  - Slice 4 progress: api-endpoint-shape arc COMPLETE
    — every public /api/v* route has at least a
    200-and-shape-correct check. Next focus: deeper
    semantic invariants (probabilityBounds,
    candlesAggregation, full chartShape match,
    conservation, cross-run rate monotonicity).
    Each addresses a different correctness dimension.

- **slice 4d-scenarios-more (apiUnifiedChartShape)**
  (previous iteration, on the api side) — second api
  data-PLANE check, paired with the iteration before's
  apiSpotCandlesHappyPath:
  * `apiUnifiedChartShape` — calls
    `/api/v2/proposals/harness-probe-proposal/chart`,
    asserts 200 + JSON content-type + body has
    `candles.{yes, no, spot}` all arrays.

  - **Both api data-plane probes follow the same
    template but exercise dramatically different code
    paths**:
    * apiSpotCandlesHappyPath: light path (validate
      ticker → fetchSpotCandles → spotCache →
      transform). 1 indexer touch.
    * apiUnifiedChartShape: heavy path (proposal
      resolve via registry → pool fetch via candles →
      currency rate via chain → parallel YES/NO/SPOT
      candle fetch → response transform with
      applyRateToCandles). 3 layer touches.

  - **Why this is high-value coverage**: unified-
    chart is the single API consumed by every
    proposal page in the futarchy.fi UI. Yes/no/spot
    price history all goes through it. A regression
    in any of resolve, pool-fetch, rate-lookup, or
    response-transform breaks the primary user-
    visible chart. The shape probe catches the WHOLE
    "endpoint up but data plane broken" class with
    a single check.

  - **Bug shapes caught (distinct from
    apiSpotCandlesHappyPath)**:
    * Proposal resolve returns null pools → yes/no
      arrays missing → frontend crashes destructuring
    * applyRateToCandles regression returns wrong
      shape (Promise instead of array)
    * Refactor that renames `spot` to `spotCandles`
      (the field name diverged once already with
      the sister endpoint — easy to confuse)
    * Cache layer returns stale/wrong-shape (X-Cache:
      HIT path differs from MISS path)

  - **First step toward documented chartShape
    invariant**: PROGRESS.md's cross-layer invariants
    table calls for `api /v2/.../chart vs indexer raw`
    match. This iteration ships the shape half;
    future iteration adds cross-check (api candle
    counts vs candles.{yes,no} direct queries) by
    reusing the cross-layer match template.

  - **Fixture extension**: route `/api/v2/proposals/
    <id>/chart` (regex match because proposalId is a
    path param) returns 200 + minimal-shape body by
    default; new unifiedChartStatus / unifiedChartBody
    knobs for drift simulation.

  - **Smoke tests**: 4 new (happy-empty, happy-with-
    data, data-plane error / 500 — verifies apiHealth
    STILL passes distinguishing endpoint-broken from
    api-down, missing yes array / refactor that drops
    a side); 89/89 pass (was 85). Now 31 invariants:
    7 api-internal + 21 indexer + 3 chain-layer.

  - Slice 4 progress: 2-of-3 documented /api/v*
    endpoints now have happy-path data-plane coverage.
    Cross-layer invariants table from PROGRESS.md is
    now ~50% covered.

- **slice 4d-scenarios-more (apiSpotCandlesHappyPath)**
  (previous iteration, on the api side) — first api
  data-PLANE check in the catalog:
  * `apiSpotCandlesHappyPath` — calls
    `/api/v1/spot-candles?ticker=harness-probe-ticker`,
    asserts 200 + JSON content-type + body has
    `spotCandles` array.

  - **Why this is a distinct coverage class**: all
    prior api-side invariants probed liveness
    (apiHealth, apiWarmer), validation paths
    (apiSpotCandlesValidates — 400 branch only),
    raw passthroughs (apiCanReachRegistry/Candles),
    or cross-layer match (apiCandlesMatchesDirect /
    apiRegistryMatchesDirect). NONE exercised the
    api's full data plane: request → validation →
    downstream call → response transform → JSON write.
    This closes that gap.

  - **Bug shapes caught (distinct from the 400-path
    probe)**:
    * Validation passes but downstream throws → 500
      (the 400-path probe keeps passing because it
      tests a different request)
    * Response transform regression — code returns
      raw spotData instead of `{spotCandles: …}`,
      OR field renamed/dropped
    * Status-code regression — endpoint silently
      returns 204/202

  - **Empty-array semantics**: `spotCandles: []` is
    the documented happy-path empty case (api wraps
    in `{spotCandles: []}` even when upstream returns
    nothing). So `length === 0` is PASSING, not
    vacuous.

  - **Fixture extension**: /api/v1/spot-candles
    handler now dispatches on `?ticker=` presence;
    new spotCandlesWithTickerStatus / Body knobs for
    drift simulation. URL match relaxed from `===`
    to `startsWith` to handle the query string.

  - **Smoke tests**: 4 new (happy-empty, happy-with-
    data, data-plane error / 500 — verifies
    apiSpotCandlesValidates STILL passes
    distinguishing 400-path from data-plane bugs,
    response-shape regression / wrong key); 85/85
    pass (was 81). Now 30 invariants: 6 api-internal
    + 21 indexer (2 liveness + 6 data-aware coverage
    + 4 single-row data-shape + 2 multi-row data-shape
    + 2 cross-layer match + 4 cross-entity FK + 1
    cross-entity time-coherence) + 3 chain-layer.

  - Slice 4 progress: api-side coverage now spans ALL
    three modes (validation, data-plane, cross-layer)
    — completes the api-internal arc. Next:
    candlesAggregation, conservation, probabilityBounds,
    chartShape.

- **slice 4d-scenarios-more (proposalEntityOrganizationReferentialIntegrity)**
  (previous iteration, on the api side) — closes the
  registry FK chain coverage:
  * `proposalEntityOrganizationReferentialIntegrity`
    — single GraphQL query reads `proposalEntities
    (first: 1) { id organization { id } } organizations
    (first: 50) { id }`; asserts
    `proposal.organization.id ∈ organizations`.

  - **All 4 documented FK relationships now covered**:
    * Pool ← Swap (swapPoolReferentialIntegrity)
    * Pool ← Candle (candlePoolReferentialIntegrity)
    * Aggregator ← Organization
      (organizationAggregatorReferentialIntegrity)
    * Organization ← ProposalEntity (THIS)

  - **Bug shapes caught (lower-link specific)**:
    proposal-event handler derives org id wrong (every
    new proposal becomes orphan if FK reads wrong
    topic slot); org deleted but proposals weren't
    GC'd (orphan proposals — distinct from orphan
    orgs because proposal sync may run independently
    of org sync); schema migration that renamed
    Organization without updating ProposalEntity FK.

  - **Symmetric FK build-out is now complete** within
    the indexer layer: candles indexer has 2 FK checks
    (covering both entity-emit paths); registry
    indexer has 2 FK checks (covering the full FK
    chain).

  - **Fixture extension**: each proposalEntity row now
    gets `organization: {id}` (default mock-org-0);
    new `proposalEntityOrganizationIds` array option
    for tests to override per-proposal FK.

  - **Smoke tests**: 4 new (happy with FK intact,
    vacuous-no-proposals, orphan proposal — verifies
    organizationAggregatorRefIntegrity STILL passes,
    distinguishing proposal-handler vs org-handler FK
    bugs, orphan-storm); 81/81 pass (was 77). Now 29
    invariants: 5 api-internal + 21 indexer (2
    liveness + 6 data-aware coverage + 4 single-row
    data-shape + 2 multi-row data-shape + 2 cross-layer
    match + 4 cross-entity FK + 1 cross-entity time-
    coherence) + 3 chain-layer.

  - Slice 4 progress: ~99% (29 of ~30 sub-slices).
    Full FK chain coverage across both indexers
    closes a natural arc that started 4 iterations
    ago. Next arcs: candlesAggregation (sum
    reconciliation), conservation, probabilityBounds,
    chartShape — each exercises a different
    correctness dimension.

- **slice 4d-scenarios-more (organizationAggregatorReferentialIntegrity)**
  (previous iteration, on the api side) — cross-entity FK
  pattern now extends to the registry indexer:
  * `organizationAggregatorReferentialIntegrity` —
    single GraphQL query reads `organizations(first: 1)
    { id aggregator { id } } aggregators(first: 50)
    { id }`; asserts `org.aggregator.id ∈ aggregators`.

  - **Pins the upper link of the registry FK chain**:
    Aggregator ← Organization ← ProposalEntity. This
    invariant covers Organization → Aggregator. The
    remaining ProposalEntity → Organization link is
    next iteration (parallel pattern).

  - **Bug shapes caught**: org-event handler derives
    aggregator id wrong; aggregator deleted but
    organizations weren't garbage-collected; schema
    migration that renamed Aggregator without updating
    Organization.aggregator FK; handler dropped FK.

  - **Fixture extension**: each org row now gets
    `aggregator: {id}` (default mock-agg-0); new
    `organizationAggregatorIds` array for per-org FK
    override (mirrors swapPoolIds / candlePoolIds).

  - **Smoke tests**: 4 new (happy with FK intact,
    vacuous-no-orgs, orphan org from FK derivation
    bug — verifies existence checks STILL pass,
    distinguishing entity existence from relationship
    integrity, orphan-storm from all aggregators
    deleted); 77/77 pass (was 73). Now 28 invariants:
    5 api-internal + 20 indexer (2 liveness + 6
    data-aware coverage + 4 single-row data-shape +
    2 multi-row data-shape + 2 cross-layer match +
    3 cross-entity FK + 1 cross-entity time-coherence)
    + 3 chain-layer.

  - Slice 4 progress: ~98% (28 of ~30 sub-slices).
    Three of four documented FK relationships covered
    (Swap→Pool, Candle→Pool, Organization→Aggregator);
    ProposalEntity→Organization remaining.

- **slice 4d-scenarios-more (candleSwapTimeWindowConsistency)**
  (previous iteration, on the api side) — first cross-
  entity TIME-COHERENCE check in the catalog:
  * `candleSwapTimeWindowConsistency` — single GraphQL
    query reads latest swap (orderBy timestamp desc)
    AND latest candle (orderBy time desc); asserts
    `latestSwap.timestamp ≥ latestCandle.time`.

  - **Why this is a real invariant**: candles
    aggregate swaps. A swap at time T causes a candle
    at floor(T/period)*period. So the latest candle's
    time should NEVER exceed the latest swap's
    timestamp. If it does, a candle exists for a
    period that has no contained swap — clock-skew,
    stale swap stream, or aggregator pulling time
    from a different source than swap-handler.

  - **Distinct from per-row time-shape probes**:
    swapTimestampSensible and candleTimeMonotonic
    validate each entity's time field on its own
    terms. This validates that the TWO entities' time
    fields are MUTUALLY consistent. Test 4
    demonstrates the distinction — failure mode
    (candle 1 day in future) leaves swapTimestampSensible
    passing because the swap timestamp is fine; only
    the cross-entity relationship is broken.

  - **Multi-entity-in-one-query pattern unlocks
    candlesAggregation**: this is the template the
    next quantitative invariant will reuse with sum
    reconciliation (∑ swap amounts in period =
    candle.volume). Query-shape (multiple collections
    in one POST), parsing (extract each from `data`),
    vacuous-handling (when either side empty) all
    generalize.

  - **Fixture default change**: `candleTimeAnchor`
    shifted from `now` to `now - 7200` (2h ago) so
    the new invariant passes naturally with default
    fixtures (latestSwapTimestamp default is `now -
    3600`). All other tests unaffected (relative
    comparisons preserved).

  - **Smoke tests**: 4 new (happy with default
    fixture, vacuous-no-swaps, vacuous-no-candles,
    failure with candle-in-future / swapTimestampSensible
    STILL passing); 73/73 pass (was 69). Now 27
    invariants: 5 api-internal + 19 indexer (2
    liveness + 6 data-aware coverage + 4 single-row
    data-shape + 2 multi-row data-shape + 2 cross-layer
    match + 2 cross-entity FK + 1 cross-entity time-
    coherence) + 3 chain-layer.

  - Slice 4 progress: ~97% (27 of ~28 sub-slices).
    Cross-entity coverage now spans both REFERENTIAL
    (FK) and QUANTITATIVE (time-window) consistency.
    Next: candlesAggregation (sum-of-swaps =
    candle.volume), conservation, probabilityBounds.

- **slice 4d-scenarios-more (candlePoolReferentialIntegrity)**
  (previous iteration, on the api side) — candle analog of
  the iteration before's swapPoolReferentialIntegrity:
  * `candlePoolReferentialIntegrity` — single GraphQL
    query reads `candles(first: 1, ..., orderBy: time)
    { id pool { id } } pools(first: 50) { id }`;
    asserts `candle.pool.id ∈ Set(pools.map(p => p.id))`.

  - **Why TWO FK checks (swap + candle) vs one
    generic check**: the FK on swaps and the FK on
    candles are set by DIFFERENT code paths in the
    indexer:
    * Swap.pool: set by the swap-event handler, one
      derivation per Swap event
    * Candle.pool: set by the period-aggregator, one
      derivation per Candle bucket
    An indexer with correct swap-handler FK derivation
    but broken period-aggregator FK derivation passes
    swapPoolReferentialIntegrity and FAILS this one.
    The two together pin the FK contract on both
    entity-emit paths.

  - **Bug shapes caught (in addition to the swap-side
    ones)**:
    * Period-aggregator picks wrong pool when bucketing
      swaps (uses last-seen pool ref instead of each
      swap's own pool — would also light up
      candlesAggregation when that lands)
    * Pool deleted but candle aggregates weren't
      garbage-collected (orphan candles — distinct from
      orphan swaps because aggregators may emit
      independently of swap ingestion)
    * Aggregator handler returns null pool

  - **Fixture extension**: every candle row now gets
    `pool: {id}` field (default `mock-pool-0`); new
    `candlePoolIds` array option for tests to override
    per-candle FK and simulate orphan-candle scenarios
    (mirrors `swapPoolIds` from previous slice).

  - **Smoke tests**: 4 new (happy with FK intact,
    vacuous when 0 candles, orphan candle from
    aggregator FK bug — verifies SWAP FK STILL passes,
    distinguishing aggregator vs swap-handler FK bug,
    orphan-storm from all pools deleted); 69/69 pass
    (was 65). Now 26 invariants: 5 api-internal + 18
    indexer (2 liveness + 6 data-aware coverage + 4
    single-row data-shape + 2 multi-row data-shape +
    2 cross-layer match + 2 cross-entity FK) + 3
    chain-layer.

  - Slice 4 progress: ~96% (26 of ~27 sub-slices).
    Symmetric build-out continues: cross-layer match
    has both candles + registry; cross-entity FK now
    has both swap + candle. Both entity-emit paths
    covered. Next: candlesAggregation (Candle.volume =
    sum of contained Swap amounts within period —
    combines THE FK we just verified with quantitative
    reconciliation).

- **slice 4d-scenarios-more (swapPoolReferentialIntegrity)**
  (previous iteration, on the api side) — first cross-entity
  FK check in the catalog:
  * `swapPoolReferentialIntegrity` — single GraphQL
    query reads `swaps(first: 1, ...) { id pool { id } }
    pools(first: 50) { id }` in one round-trip; asserts
    `swap.pool.id ∈ Set(pools.map(p => p.id))`.

  - **Why FK integrity is its own failure class**:
    previous indexer probes were either single-entity
    (existence/data-shape) or cross-layer (api↔direct
    match). Both can pass while entities have BROKEN
    relationships:
    * candlesHasPools + candlesHasSwaps both pass →
      entities exist independently
    * apiCandlesMatchesDirect passes → api↔indexer
      agree on each entity, independently
    * BUT swap.pool.id can still point at nothing
    This is the first invariant that detects the
    relationship break.

  - **Bug shapes caught**: handler derives pool id
    wrong (wrong topic slot, mangled transform), pool
    deleted but swaps weren't garbage-collected
    (orphan rows), schema migration that renamed Pool
    without updating Swap.pool, handler dropped FK.

  - **Vacuous case nuance**: vacuous when SWAPS=0
    (no FK to check); DISTINCT from "pools=0 but
    swaps>0" — that's an integrity FAIL (every swap
    is orphan), not vacuous. Test 4 verifies this.

  - **Fixture extension**: every swap row gets
    `pool: {id}` field (default `mock-pool-0`); new
    `swapPoolIds` array option for tests to override
    per-swap and simulate orphan-swap bugs.

  - **Smoke tests**: 4 new (happy with FK intact,
    vacuous when 0 swaps, orphan from FK derivation
    bug — verifies existence checks STILL pass,
    distinguishing "entities exist independently"
    from "entities consistent with each other",
    orphan-storm from all pools deleted); 65/65 pass
    (was 61). Now 25 invariants: 5 api-internal + 17
    indexer (2 liveness + 6 data-aware coverage + 4
    single-row data-shape + 2 multi-row data-shape +
    2 cross-layer match + 1 cross-entity FK) + 3
    chain-layer.

  - Slice 4 progress: ~95% (25 of ~27 sub-slices).
    New cross-entity pattern unlocks invariants the
    catalog didn't have before — relationships
    between entities, not just per-entity correctness.
    Next steps: candlesAggregation (Candle.volume =
    sum of contained Swap amounts within period —
    combines cross-entity FK with quantitative
    reconciliation), conservation (∑YES + ∑NO = ∑sDAI).

- **slice 4d-scenarios-more (apiRegistryMatchesDirect)**
  (previous iteration, on the api side) — registry analog
  of the iteration before's apiCandlesMatchesDirect:
  * `apiRegistryMatchesDirect` — single GraphQL query
    touches all THREE registry entity types
    (proposalEntities + organizations + aggregators) in
    one round-trip, then per-entity length + per-entity
    pair-wise id check.

  - **Why a single 3-entity query (vs three single-entity
    invariants)**: per-entity-type cache granularity is
    a real failure mode — api may cache proposalEntities
    while keeping organizations fresh. Single multi-
    entity query catches the inconsistency in one probe
    AND attributes the failure to the SPECIFIC entity
    that drifted (error message names "organizations" or
    "aggregators[0].id" rather than "registry mismatch").

  - **Bug classes caught (in addition to the
    candles-side ones from previous iteration)**:
    * Per-entity cache granularity: api caches
      proposalEntities but not organizations (any subset
      combination). Wholesale-cache or wholesale-fresh
      passes; selective caching fails.
    * Adapter rewriting per-entity: a regression that
      only mutates aggregators (e.g., metadata
      transformer applied to wrong entity type) lights
      up specifically.
    * Whole-row swap: same length, different rows.
      Length-only check would miss this; pair-wise id
      check catches it.

  - **Fixture refactor**: extracted `buildRegistry()`
    alongside the buildPools / buildSwaps / buildCandles
    builders. /registry/graphql now returns full
    registry data by default (was just `{__typename}`);
    routed through new `apiRegistryDriftFn` hook for
    drift simulation. /registry-direct/graphql
    simplified to use the same builder. Existing
    apiCanReachRegistry invariant still passes (only
    checks `__typename === 'Query'`, which the richer
    response still includes).

  - **Smoke tests**: 5 new (happy match, all-empty
    vacuous, organizations length mismatch / per-entity
    drift, aggregator id rewrite / adapter mutation,
    proposalEntities WHOLE-row swap / same length but
    different rows); 61/61 pass (was 56). Now 24
    invariants: 5 api-internal + 16 indexer (2
    liveness + 6 data-aware coverage + 4 single-row
    data-shape + 2 multi-row data-shape + 2 cross-layer
    MATCH) + 3 chain-layer.

  - Slice 4 progress: ~94% (24 of ~26 sub-slices). Both
    candles AND registry now have api↔direct match
    coverage (parity with existence + data-aware
    probes). Symmetric build-out continues — as candles
    got apiCandlesMatchesDirect last iteration,
    registry now gets the analog. Next natural moves
    are cross-entity invariants like candlesAggregation
    that combine multiple entity types from a single
    endpoint.

- **slice 4d-scenarios-more (apiCandlesMatchesDirect)**
  (previous iteration, on the api side) — first true
  api↔indexer MATCH check in the catalog:
  * `apiCandlesMatchesDirect` — issues the same GraphQL
    query against `apiUrl/candles/graphql` AND the
    direct `candlesUrl` IN PARALLEL, then compares
    lengths + ids + times pair-wise.

  - **Closes a gap no other invariant covers**: previous
    api↔* probes only assert "api can reach indexer"
    via __typename; previous candles* probes only assert
    "indexer has data". This is the first to assert
    they AGREE on the data — strictly stronger than
    either alone.

  - **Bug classes caught**:
    * api-side caching gone stale (api serves old
      snapshot while direct shows fresh data — every
      existing invariant passes, user sees wrong nums)
    * adapter rewriting (candles-adapter mutates output)
    * schema-mismatch (api expects schema X, indexer
      emits Y)
    * partial-rewrite (id matches but time drifted —
      caught by the secondary pair-wise time check)

  - **New pattern unlocks the rest of the cross-layer
    table**: PARALLEL queries to two endpoints + row-by-
    row compare. Future cross-layer invariants
    (apiRegistryMatchesDirect, candlesAggregation,
    chartShape) all reuse this template.

  - **Fixture refactor**: extracted shared
    buildPools / buildSwaps / buildCandles row builders
    so the api passthrough endpoint and the direct
    indexer endpoint return IDENTICAL data by default
    (modeling reality — api literally forwards). New
    `apiCandlesDriftFn` hook lets tests rewrite api-side
    response to simulate drift; default identity = no-op.

  - **Smoke tests**: 5 new (happy match, both-empty
    vacuous, length mismatch / cache stale, id drift /
    adapter rewrote, time drift / partial-rewrite);
    56/56 pass (was 51). Now 23 invariants: 5
    api-internal + 15 indexer (2 liveness + 6 data-aware
    coverage + 4 single-row data-shape + 2 multi-row
    data-shape + 1 cross-layer MATCH) + 3 chain-layer.

  - Slice 4 progress: ~93% (23 of ~25 sub-slices).
    Cross-layer match pattern is now wired; the rest
    of the documented "Cross-layer invariants" table
    (candlesAggregation, chartShape, registry analog)
    becomes incremental work on top of this.

- **slice 4d-scenarios-more (candleTimeMonotonic +
  swapTimeMonotonicNonStrict)** (previous iteration, on
  the api side) — first MULTI-ROW data-shape invariants
  in the catalog. Previous data-shape probes all looked at
  a single row; these compare adjacent rows in a series:
  * `candleTimeMonotonic` — query last 5 candles ordered
    `time desc`, assert STRICTLY decreasing. Each candle
    covers a unique period; same `time` across two rows
    is a period-aggregator bug.
  * `swapTimeMonotonicNonStrict` — query last 5 swaps
    ordered `timestamp desc`, assert NON-STRICTLY
    decreasing. Multiple swaps per block legally share
    a block timestamp; the bug is going BACKWARDS.

  - **Strict-vs-non-strict encodes real semantics**:
    candles emit one row per period (strict by
    construction); swaps emit per-event (non-strict
    because block.ts is the source). A future change
    that lets candle aggregator emit duplicate rows OR
    that reorders swap events backwards lights up here.

  - **Bug classes caught (distinct from single-row
    probes)**:
    * Candles: period-aggregator upsert-as-insert,
      bucket-key off-by-one collisions, broken orderBy.
      Single-row OHLC/volume probes can't see these.
    * Swaps: orderBy returning insertion-order instead
      of timestamp; off-by-one wrong-block context on
      a swap. swapTimestampSensible is single-row range;
      this is cross-row drift inside that range.

  - **Multi-row pattern unlocks future cross-row
    invariants**: TWAP-window monotonicity (PR #54
    shape from the invariants table), conservation
    sums, candlesAggregation. This slice establishes
    the access pattern (`first: 5, orderBy: X,
    orderDirection: desc` + iterate adjacent pairs).

  - **Fixture extension**: 4 new options
    (`candleTimes`, `candleTimeStep`, `swapTimestamps`,
    `swapTimestampStep`). Every row now gets a `time`/
    `timestamp` field (auto-generated descending series
    OR explicit array for failure-mode tests). Defaults
    keep the existing single-row tests green via the
    "vacuous when count < 2" escape.

  - **Smoke tests**: 6 new (candle happy/vacuous/
    duplicate/out-of-order, swap happy with same-block
    timestamps, swap backwards-bug); 51/51 pass (was 45).
    Now 22 invariants: 5 api-internal + 14 indexer (2
    liveness + 6 data-aware coverage + 4 single-row
    data-shape + 2 multi-row data-shape) + 3 chain-layer.

  - Slice 4 progress: ~92% (22 of ~24 sub-slices). First
    multi-row pattern in the catalog opens the door to
    true cross-row invariants in upcoming slices.

- **slice 4d-scenarios-more (swapAmountsPositive +
  swapTimestampSensible)** (previous iteration, on the api
  side) — extends data-shape pattern from Candle to Swap:
  * `swapAmountsPositive` — amountIn > 0 AND amountOut > 0
  * `swapTimestampSensible` — timestamp ∈ [2020-01-01,
    now + 1 day]

  - **Bug classes caught**:
    * Amounts: Algebra Swap event has SIGNED amount0/1
      (from-token negative). Indexer must Math.abs() into
      unsigned amountIn/Out. If handler assigns signed
      directly, one is ≤ 0. Distinct from candle-volume
      aggregator bug (per-swap event-decoder bug).
    * Timestamp: indexer reads from block context. Wrong
      topic slot (off-by-one decoder) → 0 or garbage from
      hash slot.

  - **Vacuously true when no swaps**: same pattern as
    candle-shape probes.

  - **Fixture extension**: 3 new options
    (latestSwapAmountIn/AmountOut/Timestamp); first swap
    in response carries the field values.

  - **Smoke tests**: 6 new (happy + various failure modes,
    including a far-future-timestamp test for the garbage-
    from-wrong-topic-slot case); 45/45 pass (was 39).
    Now 20 invariants: 5 api-internal + 12 indexer (2
    liveness + 6 data-aware coverage + 4 data-shape) + 3
    chain-layer.

  - Slice 4 progress: ~91% (21 of ~23 sub-slices).
    Both Candle and Swap entities have data-shape coverage
    (2 invariants each). Pool entity could get the same
    treatment but indexer produces minimal Pool data so
    value-add is lower.
