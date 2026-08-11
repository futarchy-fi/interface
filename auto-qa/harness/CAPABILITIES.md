# Harness Capabilities — Discovery Index

Quick lookup for what the harness can already catch and what fixtures
already exist. **Read this before authoring a new scenario** — odds
are good that the capability you need is already here.

Full slice-by-slice history lives in `PROGRESS.md`. This file is the
flat reference.

---

## The 12 KINDs of bugs the harness catches

A "KIND" is a class of regression with its own assertion mechanism.
The catalog of 96 scenarios (3 pinned-skipped) is a composition of these.

| # | KIND | What it pins | Example scenarios |
|---|---|---|---|
| 1 | **DOM text** | rendered text (presence, absence, exact value) | 01 (stale price), 10-15 (market-page happy), 55 (PR #46 archived-proposal absence), 60 (PR #56 Prediction Market badge gated) |
| 2 | **GraphQL shape** | request body + response classification (strict schema, body-level field match) | 47 + 53 (PRs #45/#60/#61/#62/#63/#65 schema strictness), 63 (PR #50 `organization(id:)` body match) |
| 3 | **Page errors** | `pageerror` + console.error capture | 48 (/companies), 10-23 (markets opt-in), 69 (/milestones) — 3-surface grid closed |
| 4 | **URL state** | history mutations, query param transitions, nav-infrastructure shape | 5 scenarios across 4 sub-shapes: 49 (post-mount hash → query rewrite via useEffect on /milestones), 54 (`/market` singular redirect via routing config), 88 (event-card outbound href on /companies), 90 + 91 (Header back-nav anchor on /milestones + /markets — 2/2 natural ceiling closed slice 322; /companies n/a as it's the destination) |
| 5 | **Network requests** | URL pattern presence/absence, request count, request body | 50 (/companies), 66 (/markets), 71 (/milestones) — 3-surface grid closed; 57+61 (negative Supabase), 63 (positive + body match) |
| 6 | **Visual / Computed CSS** | `getComputedStyle` queries on cascading CSS properties | 15 scenarios across 3 surfaces × 7 properties via slice-310 helper. **4 properties at full 3-surface coverage** (pointer-events: 80+83+84; cursor: 81+85+86; text-transform: 82+93+94; user-select: 62+95+96). Other 3 at 1-surface (87 direction:rtl, 89 visibility:hidden, 92 opacity:0 — all /companies). Matrix table below; `assertPageLayoutCascadeStyleIsNot` makes any new cascade catch a 1-liner |
| 7 | **a11y heuristics (static DOM)** | img alt, button accessible-name, input labels via inline DOM walk | 52 (/companies), 67 (/markets), 70 (/milestones) — 3-surface grid closed; refinement landed slice 289 (skip aria-hidden, accept title); fixture extracted slice 293 |
| 8 | **Build-mode runtime** | minified-bundle catches (TDZ, dead-code elim) | 54 (PR #55, `prodModeOnly` flag) |
| 9 | **TIME-EVOLUTION** | chain-side mutations + RPC interception with decoded params | 59 (PR #54 TWAP window, function args), 64 (PR #53 gas param), 65 (PR #57 modal-walkthrough with multicall3) |
| 10 | **Keyboard navigation** | Tab walk + `document.activeElement` chain inspection | 73 (/companies), 74 (/markets), 75 (/milestones) — 3-surface grid closed; fixture extracted slice 300 |
| 11 | **Modal focus-trap** | Tab walk after modal opens; assert focus does NOT escape modal subtree | 76 (RainbowKit modal, active), 77 (ConfirmSwapModal, pinned-latent: 4th latent bug); fixture extended slice 306 with inverted-direction helper |
| 12 | **ARIA-state inspection** | runtime ARIA attributes (aria-selected, aria-current, etc.) on interactive widgets | 78 (outcome tabs, pinned-latent: 4th latent bug), 79 (aria-current, pinned-latent: 5th latent bug + systemic gap confirmed) |

**Sister-pattern KINDs at 3-surface coverage**: **6 of 12** (page-error, network shape, a11y heuristics, user-CSS interactive, keyboard-nav, **Visual/Computed CSS** — joined slice 313 via the `pointer-events` sub-grid 80+83+84). Per-surface chaos matrix structurally complete for these.

### KIND 6 sub-grid matrix (slice 319 snapshot)

KIND 6 introduced a **sub-grid framework** at slice 316 — a single KIND can host multiple properties each independently at 3-surface coverage via the slice-310 helper. The matrix grows on two independent axes (property + surface), each combination a 1-liner.

```
                /companies  /markets  /milestones
user-select         62          95         96        (3/3 ✓)
pointer-events      80          83         84        (3/3 ✓)
cursor              81          85         86        (3/3 ✓)
text-transform      82          93         94        (3/3 ✓)
direction           87          —          —         (1/3)
visibility          89          —          —         (1/3)
opacity             92          —          —         (1/3)
```

Snapshot evolution:
- Slice 313: 1 sub-grid (pointer-events) at 3-surface.
- Slice 316: 2 sub-grids (+cursor).
- Slice 326: 3 sub-grids (+text-transform).
- **Slice 328: 4 sub-grids (+user-select).**
- 3 properties remain single-surface (direction, visibility, opacity); ~6 more slices to fill 7×3 matrix at the established 2-slice-per-property cadence.

Filling a cell is a 1-liner: `assertPageLayoutCascadeStyleIsNot(page, { propertyName, expectedNot, scenarioLabel })`. Helper validated route-agnostic AND property-agnostic across 10 catches with ZERO helper edits.

---

## Fixture capabilities — what already exists

### `fixtures/api-mocks.mjs`

GraphQL endpoint mocks + probe data.

| Export | Use when |
|---|---|
| `REGISTRY_GRAPHQL_URL`, `CANDLES_GRAPHQL_URL` | Routing mocks |
| `PROBE_*` (org/agg/pool/proposal addresses) | /companies-side probe data |
| `MARKET_PROBE_*` (address/title/currency/company/pool) | /markets-side probe data |
| `makeGraphqlMockHandler({ proposals, orgMetadata, orgName, organizations, onCall })` | Registry GraphQL with operation dispatch. **`onCall(query, body)`** signature — pass a 2-arg callback if you need to inspect `variables` (the address is in `body.variables.id`, not in the query string — see scenario 63). |
| `makeStrictCheckpointGraphqlMockHandler` / `makeStrictCandlesGraphqlMockHandler` | Registry/candles mocks that REJECT legacy schema shapes (matches `CHECKPOINT_SCHEMA_VIOLATIONS` list). Use when catching schema regressions (scenarios 47, 53). |
| `CHECKPOINT_SCHEMA_VIOLATIONS` | Catalog of 7 legacy GraphQL patterns Checkpoint indexer rejects. Add a new pattern + verbatim error string here to light up every consumer at once. |
| `fakeProposal`, `fakePoolBearingProposal({ idSuffix, poolYes, poolNo, metadataExtra, organizationId })` | /companies-side proposal stubs. Use `metadataExtra` for `archived: true`, `chain: '10'`, etc. |
| `fakeMarketProposalEntity({ proposalAddress, title, metadataExtra })` | /markets-side proposalentity stub in the format `fetchProposalMetadataFromRegistry` expects. |
| `makeCandlesMockHandler({ prices, onCall })` | /companies-side candles handler (handles `pools(where: id_in:...)` bulk-fetch query). Pass `prices: {}` (empty) to disable bulk prefetch and force per-card fetches — used by scenario 61 for the negative-network catch. |
| `makeMarketCandlesMockHandler(opts)` | /markets-side candles handler (handles `proposal(...) + whitelistedtokens(...)` discovery + per-pool detail + swaps + candles + pool-batch + token-list refresh). |
| `makeSubgraphAwareCandlesHandler({ marketName })` | **OPT-IN** wrapper that enriches the discovery response with `pools[]` + role-tagged whitelistedtokens (`YES_COMPANY`, `NO_CURRENCY`, etc.) so the subgraph adapter populates POOL_CONFIG_YES/NO + MERGE_CONFIG + BASE_TOKENS_CONFIG. **Required** for any scenario that reads from `config.MERGE_CONFIG` or `POOL_CONFIG_YES.address`. Used by 59, 60, 64, 65. |
| `PUBLIC_GNOSIS_RPC_URLS` (6 URLs) | wagmi rotates through these. Any RPC interceptor should route ALL of them + `http://localhost:8546/` to ensure capture. |
| `makeAnvilRpcProxyHandler` + `installAnvilRpcProxy` | Proxy public Gnosis RPCs to local anvil fork so balance reads see fork-funded state. Opt in via `useAnvilRpcProxy: true` on the scenario. |

### `fixtures/eth-call-inspector.mjs`

eth_call request/response parsing + Multicall3 helpers.

| Export | Use when |
|---|---|
| `parseEthCallParams(body)` | Extract `{ to, data }` from a JSON-RPC eth_call body. Returns null for non-eth_call or batched requests. |
| `decodeEthCallData(data, abi)` | Generic: decode any function call's args. Returns `{ functionName, args }` or null. |
| `sameAddress(a, b)` | Case-insensitive address compare (handles checksum vs lowercase). |
| `ALGEBRA_POOL_TIMEPOINTS_ABI` + `ALGEBRA_POOL_TIMEPOINTS_SELECTOR` + `decodeGetTimepointsArgs(data)` | Decode the `getTimepoints(uint32[])` args. Used by scenario 59 to catch PR #54's TWAP window. |
| `MULTICALL3_ADDRESS` + `MULTICALL3_AGGREGATE3_SELECTOR` | wagmi auto-batches reads through multicall3. Any RPC interceptor for `readContract` calls MUST handle this — see slice 103 for the cautionary tale. |
| `decodeMulticall3Aggregate3(data)` | Parse the inner `Call3[]` array from an aggregate3 call. Returns `[{ target, allowFailure, callData }]`. |
| `encodeMulticall3Returns(results)` | Encode a `Result[]` aggregate3 return. Each result is `{ success: bool, returnData: bytes }`. **The returnData length matters** — return 32 bytes of zero for unknown selectors (NOT shorter, viem decodes the outer array and the position assertion trips). |

### `fixtures/fork-state.mjs`

Chain-side mutations + time control via anvil RPCs.

| Export | Use when |
|---|---|
| `anvilRpc(rpcUrl, method, params, timeoutMs)` | Raw anvil RPC client with retry. Use this if your custom mutation isn't covered by a higher-level helper. |
| `setEthBalance` / `getEthBalance` | ETH balance state. |
| `setErc20Balance(rpcUrl, token, holder, amount, slot)` | ERC20 balance via `setStorageAt`. Known flake on cold anvil — wrap with `withProxyPaused` + drain windows (see scenarios 15/17/18 for the documented pattern). |
| `getErc20Balance` | Read ERC20 balance. |
| `fundWalletWithSDAI(rpcUrl, holder, amountWei)` | Convenience: set sDAI balance to a specific wei amount. Defaults to 1000 sDAI. |
| `setErc1155Balance` / `getErc1155Balance` | ERC1155 (Conditional Tokens) state. Uses nested mapping storage layout. |
| `setConditionalPosition` / `getConditionalPosition` | Higher-level helper for ConditionalTokens position state. |
| `setNextBlockTimestamp` / `mineBlock` / `advanceTime(rpcUrl, seconds)` | TIME-EVOLUTION primitives (slice 90). Anvil's `evm_setNextBlockTimestamp` pins exactly — no wall-clock slop. |
| `getBlockTimestamp(rpcUrl)` | Read current chain time. |
| `warmContractCache(rpcUrl, addresses)` / `warmErc20Balances(rpcUrl, tokens, holder)` | Pre-warm anvil's contract/balance cache to reduce cold-call latency. |
| `impersonateAndSend(rpcUrl, fromAddress, tx)` | Send a tx as another address (no signing required). |
| `ctGetCollectionId` / `ctGetPositionId` / `ctDerivePositionId` | ConditionalTokens collection/position ID derivation. |
| `mappingStorageKey` / `nestedMappingStorageKey` | Solidity storage slot computation for mappings. |
| `PAGE_CONTRACT_ADDRESSES`, `PAGE_ERC20_ADDRESSES` | Lists of contracts the page typically touches. Useful for cache-warming or RPC traffic budgeting. |

### `fixtures/wallet-stub.mjs`

EIP-1193 wallet stub for Playwright via EIP-6963.

| Export | Use when |
|---|---|
| `installWalletStub(config)` | Install the synthetic wallet (auto-applied by `scenarios.spec.mjs` beforeEach). |
| `nStubWallets(n, mnemonic)` | Derive N wallets from a mnemonic for multi-account scenarios. |
| `setupSigningTunnel(context, cfg)` | Wire up `__harnessSign` exposeBinding so SIGNING_METHODS route to viem in node (privateKey never enters the page). |
| `WALLET_LOCAL_METHODS` / `RPC_PASSTHROUGH_METHODS` / `SUBSCRIPTION_METHODS` | EIP-1193 method classification (which the stub handles vs forwards). |
| `ANVIL_DEV_MNEMONIC` | Standard anvil dev mnemonic. |

### `fixtures/a11y-heuristics.mjs`

Static-DOM a11y heuristics evaluated inside the browser via `page.evaluate(A11Y_HEURISTICS)`. Slice 293 extraction; back-ports slice 289 refinements (skip aria-hidden ancestors, accept `title` as accessible-name) to scenario 52 retroactively.

| Export | Use when |
|---|---|
| `A11Y_HEURISTICS` | The heuristic function to pass into `page.evaluate(...)`. Returns `Array<{kind, html, ...}>`. Three rule classes: `img-no-alt`, `button-no-name`, `input-no-label`. Skips elements whose ancestor chain has `aria-hidden="true"` or that aren't visible. |
| `isKnownViolation(violation, knownBaseline)` | Filter helper for KNOWN_BASELINE matching. Each rule is `{kind, match}` where `match` is a substring or RegExp tested against the violation's `html` field. |

Used by scenarios 52 (/companies), 67 (/markets), 70 (/milestones).

### `fixtures/text-selection.mjs`

User-CSS interactive KIND helper — triple-click + `getSelection` for catching CSS regressions that block `user-select` cascade. Slice 296 extraction (after 3 inline copies in scenarios 51, 68, 72).

| Export | Use when |
|---|---|
| `assertTripleClickSelects(page, locator, expectedSubstring)` | Triple-click the locator, read `window.getSelection().toString()`, assert it contains `expectedSubstring`. Clears any inherited selection first. Choose a heading/span/paragraph (NOT a button — buttons commonly have `user-select: none` by default in CSS resets/Tailwind, which would mask the catch direction). |

### `fixtures/keyboard-nav.mjs`

Keyboard-navigation simulation — Tab walk + focus-chain inspection. Slice 300 extraction (after 3 inline copies in scenarios 73-75); slice 306 added the inverted-direction sister for modal focus-trap catches.

| Export | Use when |
|---|---|
| `walkTabOrder(page, { depth })` | Press Tab `depth` times from `document.body`, return the ordered chain `Array<{tag, text, ariaLabel, href}>`. Build custom catches against the chain. |
| `assertTabReachesAnyOf(page, { depth, anchors, minDistinctTags })` | Two-catch shape: (1) ≥ `minDistinctTags` distinct tag names appear (rules out collapsed tab order); (2) at least one of `anchors` (RegExp[]) matches the text or aria-label of some focused element (proves an expected element is keyboard-reachable). |
| `assertTabDoesNotReachAnyOf(page, { depth, anchors })` | Inverted-direction catch (slice 306). After a modal opens, Tab must cycle INSIDE the modal subtree — none of `anchors` (typically background-Header anchors like `/chain selector/i`) may appear in the focus chain. |

Used by scenarios 73 (/companies), 74 (/markets), 75 (/milestones), 76 (RainbowKit modal — passes), 77 (ConfirmSwapModal — pinned-latent: focus trap absent).

### `fixtures/cascading-css.mjs`

Visual / Computed-CSS cascade catches at the PageLayout `<main>` element. Slice 310 extraction (after 3 inline copies in scenarios 62, 80, 81). Validates that any cascading CSS property regressing on a layout-level wrapper is surfaced via `getComputedStyle`.

| Export | Use when |
|---|---|
| `assertPageLayoutCascadeStyleIsNot(page, { propertyName, expectedNot, scenarioLabel? })` | Read a cascading CSS property at PageLayout's `<main>` element and assert it has NOT regressed to the marker value. `propertyName` is camelCase (e.g., `'userSelect'`, `'pointerEvents'`, `'cursor'`, `'textTransform'`). `expectedNot` is the regression marker (e.g., `'none'`, `'not-allowed'`, `'uppercase'`). On failure, dumps the ancestor chain so the cascade source is obvious. Selection logic (Tailwind `mt-20 bg-white` signature with fallback to last `<main>` in DOM order) lives ONCE in this fixture; battle-tested across /companies, /markets, /milestones (slice 313). |

Used by 15 scenarios across 3 surfaces × 7 properties — see KIND 6 matrix table above. Sub-grid framework introduced slice 316: a single KIND scales independently on property + surface axes; each combination is a 1-liner. Helper is route-agnostic AND property-agnostic for any PageLayout consumer (battle-tested across /companies, /markets, /milestones with 7 distinct cascading properties — userSelect, pointerEvents, cursor, textTransform, direction, visibility, opacity). Non-PageLayout pages would need a `targetSelector` parameter (deferred until that scenario lands).

---

## The scenario ctx — what assertions can access

Every scenario assertion is called with `(page, ctx)`. The ctx contains:

| Field | Source | Use |
|---|---|---|
| `wallet` | beforeEach | The connected wallet (address, signer) |
| `anvilUrl` | beforeEach | Local anvil URL — pass to fork-state helpers |
| `pageErrors[]` | slice 80 monitor | `{ kind: 'pageerror' \| 'console.error', message }` |
| `networkRequests[]` | slice 82 monitor | `{ url, method, resourceType, timestamp }` for every fetch |
| `callsTo(pattern)` | slice 82 helper | Filter networkRequests by URL regex or substring |
| `withProxyPaused(fn, { drainMs })` | slice 17 helper | Pause the page proxy + drain before a mutation. Required for `setStorageAt` on cold anvil. |
| **Scenario-scoped state** | `mocks` factory form | If `mocks` is a function `(ctx) => ({ ... })`, the factory can attach arbitrary state to ctx and assertions read it. Used by scenarios 53 (`onViolation`), 59 (`timepointsCalls`), 60, 63, 64, 65. |

---

## Scenario flags (declarative opt-ins)

| Flag | What it does | Example |
|---|---|---|
| `requiresAnvil: true` | Skip scenario when `HARNESS_NO_ANVIL=1` (no chain side). Use when reading chain state or calling fork-state helpers. | 58, 59, 64, 65 |
| `prodModeOnly: true` | Skip when `HARNESS_PROD_MODE!=1`. Run via `npm run ui:prod` — uses the minified production bundle. Catches build-mode runtime regressions. | 54 (PR #55 + PR #58 family) |
| `useAnvilRpcProxy: true` | Install the Public Gnosis RPC → local anvil proxy. Required when wallet balance reads should see fork-funded state. | 11, 12 |
| `mocks: (ctx) => ({...})` | Factory form — ctx is shared with assertions. Use when interceptors need to push state for later assertion. | 53, 59, 60, 63, 64, 65 |
| `pinnedLatentBug: '<description>'` | Runner skips the scenario cleanly with the description as the skip reason. Use when a scenario was authored with the correct catch direction, runs, and exposes a real latent bug — preserve it as a future-catch (regression detector once the bug is fixed). Remove the flag when the underlying bug is fixed; the scenario will then catch regressions. | 77 (ConfirmSwapModal focus-trap absent), 78 (outcome tabs missing ARIA state), 79 (app-wide nav missing aria-current) |

---

## Common assertion shapes

### Positive DOM text
```js
await expect(page.getByText('HARNESS-PROBE-EVENT-001').first())
    .toBeVisible({ timeout: 30_000 });
```

### Negative DOM text (regression catch via absence)
```js
await expect(page.getByText('Max Approval')).toHaveCount(0);
```

### Computed CSS property
```js
const userSelect = await page.evaluate(() => {
    const main = document.querySelector('main.bg-white'); // pick the right one
    return getComputedStyle(main).userSelect;
});
expect(userSelect).not.toBe('none');
```

### Negative network shape
```js
const deprecated = ctx.callsTo(/pool_candles/);
if (deprecated.length > 0) {
    throw new Error(`Found ${deprecated.length} calls to the deprecated table: ${deprecated.slice(0,3).map(r => r.url).join(' | ')}`);
}
```

### GraphQL request-body match (variables-aware)
```js
makeGraphqlMockHandler({
    onCall: (query, body) => {
        if (query.includes('organization(id:') &&
            body?.variables?.id?.toLowerCase() === GNOSIS_DAO_ORG_ADDR) {
            ctx.orgQueries.push({ query, variables: body.variables });
        }
    },
});
```

### eth_call function-arg inspection (TIME-EVOLUTION)
```js
const call = parseEthCallParams(body);
if (call && sameAddress(call.to, MARKET_PROBE_YES_POOL)) {
    const decoded = decodeGetTimepointsArgs(call.data);
    if (decoded) ctx.timepointsCalls.push({ secondsAgos: decoded });
}
```

### eth_call gas-field inspection (slice 100 shape)
```js
const gasHex = body?.params?.[0]?.gas;
const gasDec = parseInt(gasHex, 16);
if (gasDec > GNOSIS_BLOCK_CAP) throw new Error(`gas=${gasDec} > cap`);
```

### Multicall3-aware response synthesis (slice 103 shape)
```js
if (sameAddress(call.to, MULTICALL3_ADDRESS) &&
    data.startsWith(MULTICALL3_AGGREGATE3_SELECTOR)) {
    const innerCalls = decodeMulticall3Aggregate3(call.data);
    const results = innerCalls.map(c => ({
        success: true,
        returnData: c.callData.startsWith(ALLOWANCE_SELECTOR)
            ? MAX_UINT256_BYTES32
            : ZERO_BYTES32,
    }));
    return route.fulfill({ ..., result: encodeMulticall3Returns(results) });
}
```

### Modal walkthrough (slice 103 click-through pattern)
```js
// 1. Wait for button to enable (quote completed)
await expect(page.getByRole('button', { name: /^Confirm Swap$/ }))
    .toBeEnabled({ timeout: 30_000 });
// 2. Click to open modal
await page.getByRole('button', { name: /^Confirm Swap$/ }).click();
// 3. Wait for modal heading
await expect(page.getByRole('heading', { name: /^Confirm Buy$/ }).first())
    .toBeVisible({ timeout: 15_000 });
// 4. Now assert against modal-internal state
```

---

## "Where do I start if my scenario needs to..."

| ...catch a... | start by reading |
|---|---|
| Text presence/absence regression | scenarios 10, 55, 60 |
| URL/route regression | scenarios 49, 54 |
| GraphQL schema regression | scenarios 47, 53 (strict-schema catalog) |
| Network-URL regression (positive or negative) | scenarios 50, 57, 61, 63 |
| Computed-CSS cascade regression (user-select, pointer-events, cursor, text-transform, direction, visibility, opacity, etc.) | 15 scenarios — see KIND 6 matrix in section above + `fixtures/cascading-css.mjs` (`assertPageLayoutCascadeStyleIsNot`). Property axis × surface axis = N×M cells, each a 1-liner. 4 of 7 properties at full 3-surface coverage (slice 328 milestone) |
| URL state regression (history mutation, redirect, nav-infrastructure shape) | 5 scenarios across 4 sub-shapes: 49 (post-mount hash → query rewrite), 54 (`/market` redirect), 88 (outbound event-card href on /companies), 90 + 91 (Header back-nav anchor on /milestones + /markets — 2/2 natural ceiling). Click-mediated nav still uncovered — slice 318 attempt failed in harness setup; slice 321 milestone-card-rendering attempt also failed; both need investigation |
| Build-minification regression | scenario 54 + `playwright.prod.config.mjs` |
| eth_call function-arg regression | scenarios 58, 59 + slice 94 |
| eth_call parameter (gas, etc.) regression | scenario 64 |
| Modal-state regression (Confirm/etc.) | scenario 65 |
| Multicall3-batched regression | scenario 65 + `eth-call-inspector.mjs` helpers |
| Chain-state mutation flow | scenarios 15, 17, 18 + `fork-state.mjs` |
| Time-evolution (block timestamp) | scenarios 58, 59 + slice 90 primitives |
| a11y heuristic regression (img alt, button name, input label) | scenarios 52, 67, 70 + `fixtures/a11y-heuristics.mjs` |
| User-CSS interactive regression (`user-select`, etc.) | scenarios 51, 68, 72 + `fixtures/text-selection.mjs` |
| Keyboard-navigation regression (Tab order reaches/skips an anchor) | scenarios 73, 74, 75 + `fixtures/keyboard-nav.mjs` (`assertTabReachesAnyOf`) |
| Modal focus-trap regression (Tab escapes back to background) | scenarios 76, 77 + `fixtures/keyboard-nav.mjs` (`assertTabDoesNotReachAnyOf`) |
| ARIA-state regression (aria-selected, aria-current, etc.) on interactive widgets | scenarios 78 (tabs), 79 (active nav link) — both pinned-latent; pattern is `page.evaluate` reading the runtime ARIA attribute |
| Latent-bug pinning (scenario passes today AND exposes a bug) | scenarios 77, 78, 79 + `pinnedLatentBug` flag |

---

## Pitfalls documented across slices (avoid re-encountering)

- **Cold-anvil setStorageAt 30s timeout** — wrap mutations in `withProxyPaused({ drainMs: 5000 })`. Even then, ~3% of full-catalog runs hit it on scenarios 15/18 (slice 21+ remediation).
- **HMR cache during regression-verification** — `lsof -i :3000 -t | xargs kill` before flipping the regression direction (slice 88 lesson).
- **`document.querySelector('main')` ambiguity** — multiple `<main>` elements on the page (`_app.js`, `RootLayout`, `PageLayout`). For computed-style queries pin via class signature (slice 98).
- **wagmi multicall batching** — `publicClient.readContract` auto-batches through Multicall3. An interceptor matching INNER selectors misses the OUTER aggregate3 call. See slice 103 — use `decodeMulticall3Aggregate3` + `encodeMulticall3Returns`.
- **Bulk-prefetched prices short-circuit per-card fetches** — to surface a regression in `useLatestPoolPrices`, set `makeCandlesMockHandler({ prices: {} })` so `attachPrefetchedPrices` skips and the per-card fetch actually runs (slice 97).
- **Subgraph adapter requires `YES_COMPANY`/`NO_CURRENCY` role tagging** — bare `YES`/`NO` token roles in the candles mock leave pool/token configs null. Use `makeSubgraphAwareCandlesHandler` (slice 95) for anything that reads pool config.
- **Real 20-byte addresses required** when addresses flow to viem-backed `readContract` — 1-byte dummies (`0x10`) fail pre-flight (slice 102/103 lesson). Slice 103 fixed the shared fixture to use full 20-byte forms.

---

## Where the boundary is

The harness covers **the interface app's UI surface**. As of slice 329:
- **96 scenarios authored**, 3 pinned-skipped via `pinnedLatentBug` (each pinned scenario corresponds to a real latent bug in the app — see ledger below).
- **12 KINDs of bugs** realized — **6 of them at 3-surface coverage** (page-error, network shape, a11y heuristics, user-CSS interactive, keyboard-nav, Visual/Computed CSS via 4 sub-grids). The per-surface chaos matrix is structurally complete for those 6 KINDs. KIND 6 sub-grid framework (slice 316): single KIND scales on property × surface axes, each combination a 1-liner via slice-310 helper. KIND 6 currently has **4 sub-grids at 3-surface** (pointer-events, cursor, text-transform, user-select) and **3 properties at 1-surface** (direction, visibility, opacity). Surface-fill phase (initiated slice 325) closes one sub-grid per ~2 slices.
- **8 shared fixture modules** (`api-mocks`, `eth-call-inspector`, `fork-state`, `wallet-stub`, `a11y-heuristics`, `text-selection`, `keyboard-nav`, `cascading-css`). All extracted at the N=3-inline-copies threshold (slice 289 doctrine), or N=2 for symmetric pairs (slice 306).
- **KIND 4 (URL state)** grew 2 → 5 scenarios across slices 318-322, covering 4 distinct sub-shapes (post-mount mutation, routing redirect, outbound static-href, back-nav static-href). Back-nav sub-shape structurally complete at 2/2 surfaces (/companies is the destination — back-nav from it is n/a).
- **Backup-catch synergy fully realized for `user-select`** (slice 328): both KIND 6 (computed-CSS read via 62+95+96) AND text-selection KIND (interactive triple-click via 51+68+72) cover the same regression at full 3-surface coverage. Maximum robustness against either mechanism path failing.
- **20 of 22 recent PRs (91%)** are mechanically caught. **PR #44** (SDK-only `getLinkableProposals`) has no UI consumer in src/, so it's out of scope without an SDK-side test harness. **PR #47** (dead-code removal) has nothing in src/ to assert against; partially guarded by proxy via scenarios 57+61 (catch any Supabase re-introduction on `market_event_proposal_links` / `pool_candles`).

If the next round of PRs needs catches that don't fit the existing 12 KINDs, the slice should propose a 13th KIND with its mechanism and minimum-viable assertion shape before writing the scenario.

---

## Latent-bug ledger

Real bugs the harness discovered while authoring scenarios. Each entry pairs a `pinnedLatentBug` scenario (or, for older finds, a documented commit) with the symptom. When a bug is fixed, remove the `pinnedLatentBug` flag — the scenario becomes a regression catch.

| # | Bug | Surfaced by | Symptom | Status |
|---|---|---|---|---|
| 1 | `fallback-company.png` 404 | slice 80 (page-error monitor) | Missing static asset triggers `console.error`. Initial baseline added it to the no-page-errors exclusion list so it doesn't blanket-fail page-error scenarios. | Open (latent, excluded from baseline) |
| 2 | React update-in-render warning | slice 80 + 48 (page-error scenarios) | One component calls `setState` during render — surfaces as a React warning the page-error monitor would otherwise blanket-catch. Excluded as a known artifact. | Open (latent, excluded from baseline) |
| 3 | ConfirmSwapModal lacks focus trap | scenario 77 (slice 302) | Tab from inside the open modal walks back to background within ~5 presses (lands on "Companies" link, then "Chain Selector"). Total a11y break for keyboard users while the modal is visible. | Pinned-latent in scenario 77 |
| 4 | Outcome tabs missing ARIA state | scenario 78 (slice 304) | Tab `<button>` elements have no `aria-selected`, `aria-pressed`, `aria-current`, or `role="tab"` — neither before nor after a click. Screen readers can't announce which outcome (Yes/No, etc.) is selected. | Pinned-latent in scenario 78 |
| 5 | App-wide nav missing aria-current | scenario 79 (slice 305) | `document.querySelectorAll('[aria-current]')` returns `[]` on /companies (and very likely all other surfaces). Active-route highlighting must be CSS-only — screen readers don't get a "current page" announcement. | Pinned-latent in scenario 79 |

---

## Systemic findings (cross-scenario meta)

Patterns the harness discovered that span multiple bugs, not single regressions. Worth keeping visible so future scenarios know what to expect.

- **No runtime ARIA state in the futarchy interface** (slices 304 + 305). Two independent probes — outcome tabs (78) and app-wide active-nav link (79) — both came up empty for runtime ARIA attributes. The interface uses Tailwind classes for active/selected styling but doesn't emit the corresponding ARIA. Future ARIA-state scenarios on this codebase should **expect to fail and pin** until the underlying interaction patterns are upgraded.
- **Wallet-state heterogeneity across routes** (slice 298 diagnostic). The wallet stub auto-connects on /markets but NOT on /companies. Scenarios that assert Header content must pick a wallet-state-agnostic anchor (e.g., `[/chain selector/i, /connect wallet/i]`) or pre-walk into a known wallet state. `Chain Selector` is the safest cross-route anchor: it appears regardless of connect state.
- **Sister-pattern saturation at 3-surface coverage**: KINDs 3, 5, 7, "user-CSS interactive", 10, and **6 (via `pointer-events` AND `cursor` sub-grids)** each have at least one set of 3 sister scenarios (/companies + /markets + /milestones). **6 of 12 KINDs** are now structurally complete at the KIND level. KIND 6 specifically has **2 sub-grids at 3-surface** (pointer-events 80+83+84 since slice 313; cursor 81+85+86 since slice 316) and **5 properties at 1-surface** (user-select, text-transform, direction, visibility, opacity — all /companies-only). Each 1-surface property is one `assertPageLayoutCascadeStyleIsNot` call away from 2-surface or 3-surface coverage. KIND 4's back-nav sub-shape (90+91 since slice 322) is structurally complete at its natural ceiling of 2/2 surfaces (/companies is the back-nav destination). Subsequent surfaces (e.g., a future /proposal/[id] page) should add sisters into the 6 KIND-level grids before introducing new KINDs.
