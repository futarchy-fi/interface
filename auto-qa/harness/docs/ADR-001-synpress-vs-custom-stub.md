# ADR-001: Synpress vs custom EIP-1193 stub for harness Playwright tests

**Status:** Proposed (Phase 0 slice 5)
**Date:** 2026-05-10
**Deciders:** TBD

## Context

The Forked Replay Harness drives the futarchy Next.js 14 / React 18 / Wagmi v2
/ RainbowKit interface from Playwright against a local anvil fork of Gnosis.
The harness needs a wallet that can connect through RainbowKit's modal, sign
approvals + EIP-712 typed data for CoW orders, send `eth_sendTransaction` to
anvil (using its preloaded dev keys via `anvil_setBalance`), and switch
networks — and it must do all of this for **N synthetic users in parallel**,
each with a distinct browser context, while staying realistic enough that
`useFutarchy` and the Algebra / CoW / Sushi swap strategies behave as they do
in production.

## Decision

**Use a custom EIP-1193 stub injected via Playwright `addInitScript`, exposed
as an EIP-6963 provider so RainbowKit's "Browser Wallet" entry picks it up.**

The harness is not testing MetaMask UX — it is testing the futarchy app's
behaviour against a chain. Synpress's value (driving the real MetaMask popup)
is exactly what we *don't* want: it adds a 200 MB+ extension binary to CI, a
second event loop (popup window + dApp), a per-context bootstrap cost in the
tens of seconds, and a hard cap on parallelism (one MetaMask instance per
browser context, with known parallel-mode bugs — see synpress-io/synpress#832).
A custom stub is ~300 lines of JS that delegates every method to either the
anvil HTTP RPC or a local `ethers.Wallet`, runs in-page with zero startup
cost, and forks-and-clones cleanly per browser context for multi-user tests.
Maintenance risk is bounded: the EIP-1193 surface we need is small (9
methods), stable, and the subset that `useFutarchy` actually calls is even
smaller — production already runs against an unmodified `window.ethereum`.

## Comparison

| Concern | Synpress | Custom EIP-1193 stub | Winner |
|---|---|---|---|
| Works with `useFutarchy` + custom strategy pattern | Yes — drives real MetaMask, so behaves identically to prod | Yes — the strategies call standard EIP-1193 methods (`eth_sendTransaction`, `eth_signTypedData_v4`); a faithful stub is indistinguishable from MetaMask at the JSON-RPC boundary | Tie |
| Shows up in RainbowKit connector list | Yes — appears as "MetaMask" via injected detection | Yes — register as EIP-6963 provider (`info.name = "Harness Wallet"`); RainbowKit auto-discovers EIP-6963 announcements | Tie |
| Multi-account / N synthetic users in parallel | Painful — one MetaMask popup per context, known parallel issues (synpress#832), accounts shared via env vars | Trivial — each browser context gets its own `addInitScript` with a different private key; N contexts = N independent wallets | **Custom** |
| Anvil dev keys via `anvil_setBalance` | Awkward — must `importPrivateKey` into MetaMask through the popup UI flow per account | Native — instantiate `new ethers.Wallet(devKey, provider)` inside the stub, no UI dance | **Custom** |
| CI footprint | ~200 MB MetaMask extension binary + Chromium + cache dir; `.cache-synpress/` warm-up step needed | ~0 MB (plain JS bundled with Playwright); reuses the Chromium Playwright already pins | **Custom** |
| Maintainability | Tracks Synpress + MetaMask release cadence; cache key invalidation breaks CI on extension version bumps; `synthetixio/synpress` ownership transferred to `synpress-io` mid-2025 — uncertain stewardship | Hand-rolled against a frozen 9-method surface; updates only when EIP-1193 itself changes (rare) or when futarchy adds a new RPC method | **Custom** |
| Speed (per-test) | Extension + popup boot ~5–15 s on cold context; cache helps but isolated mode still pays per test (per Synpress docs) | In-page provider injection: <50 ms; no popup, no second-window orchestration | **Custom** |
| EIP-1193 surface coverage | Complete (real wallet) | Need to implement 9 methods explicitly; `eth_subscribe` is the only non-trivial one (we'll polyfill via polling on anvil's HTTP) | **Synpress** (marginal — uncertain whether polling sub is sufficient for Wagmi v2's watcher loop; needs spike) |
| Browser compatibility | Chromium only (extension API limitation) | Chromium, Firefox, WebKit — pure JS in-page injection | **Custom** |
| Realism vs production wallet UX | High — real MetaMask popups fire, real consent dialogs | Lower — auto-approves everything; doesn't catch UX regressions in approval copy | **Synpress** |

Tally: **Custom 6, Synpress 2, Tie 2.**

## Consequences

- **Positive**
  - Linear scale-out for the N-synthetic-user scenarios that Phase 4 needs (a
    single test can spawn 10 wallets without 10 popup windows fighting for
    focus).
  - Zero binary cache in CI; the harness image stays small and reproducible.
  - Cross-browser path open if we ever want WebKit/Firefox parity.
  - In-page provider trivially supports anvil cheatcodes (`anvil_setBalance`,
    `evm_mine`) by piping through to the anvil RPC URL.

- **Negative**
  - We do not exercise the real MetaMask connection UX. Regressions in
    RainbowKit's MetaMask-specific code path or in MetaMask's deep-link
    handling won't be caught by this harness — they need a separate manual
    smoke or a thin Synpress-based smoke suite gated to nightly.
  - We must keep the stub current with whatever EIP-1193 method futarchy
    eventually starts calling (e.g. if the CoW strategy adds
    `wallet_grantPermissions`).

- **Risks**
  - **`eth_subscribe` on HTTP-only anvil:** Wagmi v2's `watchBlocks` /
    `watchAccount` may rely on subscriptions. Mitigation: implement
    `eth_subscribe` as a polling shim that yields synthetic notifications
    every block, and validate against a representative scenario before Phase
    5 closes. (Uncertain — needs a 1-day spike.)
  - **EIP-6963 vs legacy `window.ethereum` race:** RainbowKit prefers
    EIP-6963; if any code path reads `window.ethereum` directly we should
    *also* set it. The stub will do both.
  - **CoW EIP-712 typed-data quirks:** The CoW strategy signs orders with
    `eth_signTypedData_v4`. We rely on `ethers.Wallet._signTypedData` (v5)
    for parity; this is well-tested in ethers v5 but worth pinning a known
    digest in the harness to detect drift.

## Implementation sketch (chosen path)

```js
// auto-qa/harness/fixtures/wallet-stub.mjs
import { test as base } from '@playwright/test';
import { Wallet, providers, utils } from 'ethers'; // v5, matches main app

export const test = base.extend({
  walletPage: async ({ context }, use, testInfo) => {
    const pk = testInfo.project.use.privateKey;          // per-context dev key
    const rpcUrl = process.env.HARNESS_ANVIL_URL;        // forked Gnosis
    const chainId = 100;                                  // gnosis

    await context.addInitScript(({ pk, rpcUrl, chainId }) => {
      const provider = { /* EIP-1193 surface */
        request: async ({ method, params }) => {
          const w = window.__harnessWallet__ ||= new Wallet(pk);
          switch (method) {
            case 'eth_chainId':         return '0x' + chainId.toString(16);
            case 'eth_accounts':
            case 'eth_requestAccounts': return [w.address];
            case 'personal_sign':       return w.signMessage(utils.arrayify(params[0]));
            case 'eth_signTypedData_v4':return w._signTypedData(...JSON.parse(params[1]));
            case 'eth_sendTransaction': return w.connect(jsonRpc).sendTransaction(params[0]).then(t => t.hash);
            case 'wallet_switchEthereumChain':
            case 'wallet_addEthereumChain': return null;
            case 'eth_subscribe':       return startPolling(params);   // shim
            default:                    return jsonRpc.send(method, params); // anvil passthrough
          }
        },
        on: (ev, cb) => listeners[ev]?.add(cb),
        removeListener: (ev, cb) => listeners[ev]?.delete(cb),
      };
      // EIP-6963 announce → RainbowKit auto-discovers
      window.dispatchEvent(new CustomEvent('eip6963:announceProvider', {
        detail: { info: { uuid: crypto.randomUUID(), name: 'Harness Wallet',
                          icon: 'data:,', rdns: 'fi.futarchy.harness' }, provider }
      }));
      window.ethereum = provider;  // legacy fallback
    }, { pk, rpcUrl, chainId });

    await use(context.newPage());
  },
});
```

Wired into `playwright.config.mjs` projects so each project = one synthetic
user with its own `privateKey`. Anvil pre-funds the addresses via
`anvil_setBalance` in the harness orchestrator before the suite runs.

## Alternatives considered

- **`@johanneskares/wallet-mock`** — viem-native, EIP-6963 compliant, off-the-shelf headless wallet. Rejected because the main app is ethers v5 and we want signing parity with `useFutarchy`'s exact code path; pulling in viem-only signers risks subtle EIP-712 digest mismatches with the production strategies.
- **`cawabunga/headless-web3-provider`** — covers the EIP-1193 surface we need, but no documented EIP-6963 / RainbowKit support and uncertain maintenance — we'd own the integration anyway.
- **Wagmi v2 `mock` connector with private-key features** — clean but only valid in test builds of the app: it requires changing `providers.jsx` to register the mock connector. Violates the "production code is never modified by the harness" rule in `auto-qa/harness/README.md`.
- **ethers `Wallet` injected raw on `window.ethereum` (no EIP-6963)** — works for legacy detection but RainbowKit v2 prefers EIP-6963 announce; we'd lose the modal entry. The chosen sketch already does both.
- **Synpress nightly smoke (defer)** — keep on the table as a *separate* thin suite if/when we want to assert real MetaMask connection UX. Out of scope for Phases 0–6.
