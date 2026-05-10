# Spike-002: eth_subscribe shim for HTTP-only wallet stub

**Status:** Complete
**Date:** 2026-05-10
**Investigator:** Claude (spike agent)

Versions verified locally:
- anvil 1.5.0-stable (Foundry, build 2025-11-26)
- viem 2.44.4 (`/Users/kas/interface/node_modules/viem`)
- wagmi 2.19.2 / @wagmi/core 2.22.1
- futarchy interface: ethers v5.7.2 main app, RainbowKit + Wagmi v2

## Question 1 — Anvil HTTP eth_subscribe

**Confirmed: anvil rejects `eth_subscribe` over HTTP with `-32601 Method not found`.**

Test reproducer (against `anvil --port 8546 --no-mining --chain-id 100`):

```
$ curl -s -X POST -H 'Content-Type: application/json' \
    -d '{"jsonrpc":"2.0","method":"eth_subscribe","params":["newHeads"],"id":1}' \
    http://127.0.0.1:8546
{"jsonrpc":"2.0","id":1,"error":{"code":-32601,"message":"Method not found"}}
```

Same error for `params: ["logs", {}]` (id 2), `params: ["newPendingTransactions"]`
(id 3), and for `eth_unsubscribe` (id 4). Sanity-check: `eth_blockNumber` returns
`{"result":"0x0"}` — HTTP path is healthy; only the subscription methods are
disabled.

What DOES work over HTTP on anvil:
- `eth_newBlockFilter` -> filter id (e.g. `0x436a537a4570...`)
- `eth_newFilter` -> filter id
- `eth_newPendingTransactionFilter` -> filter id
- `eth_getFilterChanges` (paired with the above)

So the *polling* path (`eth_newFilter` + `eth_getFilterChanges`, or just
`eth_getLogs`/`eth_blockNumber`) is fully supported by anvil over HTTP. Only the
WebSocket-style push subscriptions are not.

This matches Foundry's documented stance: subscriptions are a
WebSocket/IPC-only feature and are not implemented on the HTTP server.

## Question 2 — viem usage of eth_subscribe

**Headline finding: viem ONLY ever calls `eth_subscribe` when the *transport* is
`webSocket` or `ipc` (or a `fallback` whose first child is one of those). For
`http` and `custom` (EIP-1193) transports, every watcher silently uses HTTP
polling.** It is not a fallback after a failure — viem decides up front based on
`client.transport.type`, never sends `eth_subscribe`, and chooses the polling
loop instead.

Evidence (paths are absolute under `/Users/kas/interface/node_modules/viem/`):

### `actions/public/watchBlockNumber.ts:94-108` — the gate

```ts
const enablePolling = (() => {
  if (typeof poll_ !== 'undefined') return poll_
  if (
    client.transport.type === 'webSocket' ||
    client.transport.type === 'ipc'
  )
    return false
  if (
    client.transport.type === 'fallback' &&
    (client.transport.transports[0].config.type === 'webSocket' ||
      client.transport.transports[0].config.type === 'ipc')
  )
    return false
  return true
})()
// ...
return enablePolling ? pollBlockNumber() : subscribeBlockNumber()
```

The `pollBlockNumber()` branch (lines 112-165) just calls `eth_blockNumber` on
an interval — no subscription, no `eth_subscribe`. The `subscribeBlockNumber()`
branch (167-213) calls `transport.subscribe({ params: ['newHeads'], ... })`,
and `transport.subscribe` is **only defined on the websocket/ipc transports**
(see `clients/transports/webSocket.ts`, `clients/transports/ipc.ts`). The HTTP
transport has no `.subscribe` method; the custom transport (`custom.ts`) has
none either.

### `actions/public/watchBlocks.ts:117-274` — same pattern

Same `enablePolling` gate at lines 117-130; `pollBlocks()` (137-) loops
`eth_getBlockByNumber`; `subscribeBlocks()` (207-) calls
`transport.subscribe({ params: ['newHeads'], ... })`.

### `actions/public/watchEvent.ts:176-191, 194-305, 307-388` — identical pattern

Same gate. The polling branch creates a filter with `eth_newFilter` and polls
with `eth_getFilterChanges`; if filter creation fails the inner code falls back
to `eth_getLogs` (see lines 246-270 — explicit comment "If the filter doesn't
exist, we will fall back to use `getLogs`"). The subscribe branch calls
`transport.subscribe({ params: ['logs', {...}], ... })`.

### `actions/public/waitForTransactionReceipt.ts:200-208` — forces polling

This is the path the swap UX cares about. It forwards to `watchBlockNumber`
with `poll: true` hard-coded:

```ts
_unwatch = getAction(
  client,
  watchBlockNumber,
  'watchBlockNumber',
)({
  emitMissed: true,
  emitOnBegin: true,
  poll: true,                // <-- hard-coded
  pollingInterval,
  async onBlockNumber(blockNumber_) { ... }
})
```

So even on a websocket transport, `waitForTransactionReceipt` deliberately
polls `eth_blockNumber`. It never calls `eth_subscribe`.

### Where viem actually emits `eth_subscribe`

Only here:

- `clients/transports/webSocket.ts` (transport implementation)
- `clients/transports/ipc.ts` (transport implementation)
- `utils/rpc/socket.ts:241` — the wire-level dispatch that recognises an
  `eth_subscribe` request and stashes the returned subscription id into the
  `subscriptions` Map so push messages from the socket can be routed back.

Both webSocket and ipc transports own the socket lifecycle directly. There is
no code path inside viem (or wagmi 2.22.1, or @rainbow-me/rainbowkit checked)
where `eth_subscribe` is dispatched through the EIP-1193 `provider.request`
surface of an injected/custom connector. Confirmed via:

```
$ grep -rn 'eth_subscribe' node_modules/@wagmi node_modules/wagmi node_modules/@rainbow-me
(no matches)
```

### What this means for our setup

The interface uses `fallback(http(rpcs.map(http)))` for both gnosis and
mainnet (verified in `/Users/kas/interface/src/providers/providers.jsx`,
lines 87-99). The fallback's first child is `http`, so the gate at
`watchBlockNumber.ts:101-106` evaluates to `false` and the `enablePolling`
ternary returns `true`. **Every viem watcher in the futarchy app already polls
HTTP today, in production.** The harness merely needs to point those polling
calls at anvil instead of gnosis.drpc.org.

The wallet stub is a separate transport: it is wired in via the **injected /
EIP-6963 connector**, not as the public client transport. Connectors invoke
only these RPC methods on the injected provider (per
`@wagmi/core/src/connectors/injected.ts`):
`wallet_requestPermissions`, `eth_requestAccounts`, `eth_accounts`,
`eth_chainId`, `wallet_switchEthereumChain`, `wallet_addEthereumChain`,
`wallet_revokePermissions`, `eth_sendTransaction` (via the wagmi wallet
client). Plus the listener surface (`accountsChanged`, `chainChanged`,
`connect`, `disconnect`). **`eth_subscribe` is not in that set, ever.**

## Question 3 — Shim approach comparison

| Approach | Pros | Cons | Viability |
|---|---|---|---|
| **(a) Polling shim** — start a `setInterval` on `eth_subscribe`, poll anvil's HTTP for `eth_blockNumber` / `eth_getLogs`, emit synthetic `message` events with the EIP-1193 subscription envelope | Looks like a real subscription; defensible if a future caller does request it; wallet stub gains genuine `eth_subscribe` capability | ~80 lines of careful code (subscription registry, unsubscribe, error fan-out, JSON-RPC envelope correctness — the `message` event payload must match `{ type: 'eth_subscription', data: { subscription: '0x...', result: {...} } }` per EIP-1193); duplicates work viem already does; can drift from viem expectations | Viable but **unnecessary** — nothing in the current wagmi/viem/RainbowKit stack routes subscriptions through the connector |
| **(b) Reject + force polling** — return `{ code: -32601, message: 'Method not found' }` from the stub for `eth_subscribe` / `eth_unsubscribe` (mirroring anvil HTTP) | Simplest possible; matches anvil's actual HTTP behaviour exactly so the stub stays "transparent"; viem already polls because the public client transport is `http`, so a rejection here is never observed in normal flows; trivial to log if some caller surprises us | Surfaces an error in browser devtools IF something does call it (today: nothing does); if a future RainbowKit/wagmi version adds connector-side subscriptions the stub fails gracefully but loudly | **Recommended** — minimal code, behaviour-faithful to anvil, fails closed |
| **(c) Full WS shim** — open a `new WebSocket('ws://localhost:8545')` from inside the page and proxy `eth_subscribe` calls | Real subscriptions; matches what MetaMask + a WS RPC would do | Requires running anvil with `--ws` (or a separate WS server); browser's mixed-content / CORS / origin-mismatch rules apply (anvil's WS server doesn't set CORS headers, but `ws://` from `http://localhost` is generally permitted; over `https://` test pages this becomes mixed-content and is blocked); adds a second connection to manage per browser context; adds reconnect/keepalive logic; defeats the "stub talks HTTP only" simplicity goal stated in the brief | Possible but high cost for zero functional gain over (b) given Q2 findings |

Notes on approach (a) implementation surface, in case we ever need it:
- EIP-1193 subscription notifications must be emitted via the provider's `on('message', cb)` listener, with the payload `{ type: 'eth_subscription', data: { subscription, result } }`. (See viem's WebSocket transport: it routes incoming messages by subscription id stashed in `socket.ts:241-248`.)
- The synthetic subscription id must be a unique hex string per `eth_subscribe` call.
- For `newHeads`: poll `eth_blockNumber`, when it advances call `eth_getBlockByNumber(n, false)` and emit the result.
- For `logs`: emulate by calling `eth_newFilter` against anvil HTTP at subscribe time, polling `eth_getFilterChanges` on the returned id, fanning out each log entry as a `message` event, and `eth_uninstallFilter` on unsubscribe.

## Question 4 — Wagmi useWaitForTransactionReceipt

**Yes, it works without `eth_subscribe`. By design.** This is the most
important UX path for the harness, and the answer is unambiguous.

`useWaitForTransactionReceipt` (wagmi/query) -> `waitForTransactionReceipt`
(@wagmi/core, `actions/waitForTransactionReceipt.ts:43-58`) -> viem's
`waitForTransactionReceipt` (`viem/actions/public/waitForTransactionReceipt.ts`).

Inside viem, line 200-208 (cited above) calls `watchBlockNumber` with `poll:
true` hard-coded. That bypasses the `enablePolling` gate entirely and
guarantees the `eth_blockNumber` polling loop is used, even if the transport
were a websocket. It then calls `getTransactionReceipt` (i.e.
`eth_getTransactionReceipt`) on each new block tick until the receipt arrives
with the requested confirmations. All of these are HTTP-friendly, all are
supported by anvil HTTP.

Latency characteristic: receipt detection completes within one
`pollingInterval` after the block is mined. The default is 4 s in viem
(`createClient` default), but the futarchy app does not override it. With
`anvil --no-mining` driven by explicit `evm_mine` cheatcodes from the harness
orchestrator, the harness can set `pollingInterval` aggressively low (e.g.
250 ms) on the test public client without spamming a real RPC.

So: **the swap-and-wait UX path is fully exercised end-to-end with HTTP-only
anvil + a stub that does not implement `eth_subscribe`.**

## Recommendation

**Adopt approach (b): respond to `eth_subscribe` and `eth_unsubscribe` with
`{ code: -32601, message: 'Method not found' }`.**

Concrete reasoning:

1. The futarchy app's wagmi public client is already `fallback(http(...))`, so
   viem already polls in production. The harness inherits the same code path
   the moment `process.env.NEXT_PUBLIC_RPC_URL` (or equivalent) points at
   anvil. No subscription support is needed for `useWaitForTransactionReceipt`,
   `useBlockNumber`, `useWatchContractEvent`, or anything else that ships
   today.

2. The wagmi injected/EIP-6963 connector never invokes `eth_subscribe` on the
   provider. Verified by source-grepping `@wagmi/core`, `wagmi`,
   `@rainbow-me/rainbowkit`, and viem 2.44.4 — `eth_subscribe` only appears
   inside viem's webSocket/ipc transport implementations.

3. Mirroring anvil's actual HTTP behaviour (`-32601`) makes the stub
   indistinguishable from "wallet that happens to talk to an HTTP-only chain
   node" — which is the truthful description.

**Implementation surface (~3 lines in the stub):**

```js
case 'eth_subscribe':
case 'eth_unsubscribe':
  throw { code: -32601, message: 'Method not found' };
```

Replace the placeholder `case 'eth_subscribe': return startPolling(params);`
in the ADR-001 implementation sketch (lines 114 of
`ADR-001-synpress-vs-custom-stub.md`).

**Risks / blockers:**

- None blocking. ADR-001's "Risks" section flags `eth_subscribe` as
  uncertain — this spike resolves that uncertainty: the polling shim is not
  required, the WebSocket shim is not required, and the trivial rejection is
  the right answer for wagmi 2.x + viem 2.x as currently shipped.
- Future-proofing: if a future wagmi minor adds connector-side push
  subscriptions (none on the roadmap as of viem 2.44.4 / wagmi 2.22.1), our
  stub will throw `-32601` and surface clearly in test logs rather than
  failing silently. We can upgrade to approach (a) at that point — it is
  ~80 lines of bounded work and the design is sketched in the Q3 notes
  above.
- Update ADR-001's "Risks" section to record this resolution and replace the
  sketch's `startPolling(params)` placeholder.
