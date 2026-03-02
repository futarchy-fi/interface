# Multi-Chain Runtime Plan for `npm run futarchy`

Goal: Add `--chain=<id>` to `npm run futarchy` so examples/futarchy-complete.js picks the right RPC, contracts (Futarchy Router/Adapter), AMM (Swapr vs Uniswap) for pool discovery and swaps, and executes split/merge/redeem accordingly.

Assumptions
- Chain 100 (Gnosis): Swapr/Algebra V3 for pools + swaps; Futarchy Router deployed (0x7495…E1228f).
- Chain 137 (Polygon): Uniswap V3 for pools + swaps; Futarchy Factory/Router present in chain config; do not use Swapr.
- Chain 1 (Ethereum): Uniswap V3 for pools + swaps; addresses from config (future-ready).
- Use per-chain RPC from config (fallback to env `RPC_URL`).

High-Level Design
- Parse `--chain=<id>` in `examples/futarchy-complete.js`.
- Load a small “runtime chain config” that maps chainId → { rpc, amm, addresses }.
- Instantiate viem clients with the selected chain + rpc.
- Register fetchers/executors conditionally:
  - Discovery: Algebra on Gnosis; Uniswap on Polygon/Ethereum.
  - Swaps: Swapr cartridge on Gnosis; Uniswap V3 cartridge on Polygon/Ethereum (new).
  - Futarchy cartridge: pass router from chain config.

Implementation Steps (with checkpoints)

1) Parse `--chain` and select RPC/AMM [ ]
- Update `examples/futarchy-complete.js` to parse `--chain=<id>`.
- Build `runtimeChain` from either `refactorCreateProposal/config/chains.config.json` or a new `chains.runtime.json` (lean mapping: chainId, rpcUrl, defaultAMM, router/adapter addresses, factories).
- Default to 100 if not provided; allow env override `CHAIN_ID`.

2) Wire viem clients to selected chain [ ]
- Create `publicClient` and `walletClient` using the selected chain definition from `viem/chains` (gnosis, polygon, mainnet). If chain not in viem preset, use a custom chain object.
- Prefer `runtimeChain.rpcUrl` over `RPC_URL` when `--chain` provided.

3) Futarchy Router/Adapter per chain [ ]
- Pass `routerAddress` (adapter) to `new FutarchyCartridge(routerAddr)` instead of hardcoding.
- Use addresses from runtime config (e.g., `DEFAULT_ADAPTER` per chain). Polygon config shows `0x11a1EA07…`.

4) Pool discovery per chain [ ]
- Enhance `PoolDiscoveryFetcher` to accept a mode:
  - Algebra (current behavior, uses Algebra factory on Gnosis), or
  - Uniswap (new): use Uniswap V3 factory address + ABI and `getPool(token0,token1,fee)`; read pool price via `slot0()`.
- Inject this mode during registration in `futarchy-complete.js` based on chain.

5) Swaps per chain [ ]
- Keep `SwaprAlgebraCartridge` on Gnosis (chainId 100).
- Implement `UniswapV3Cartridge` (new) for Polygon/Ethereum using SwapRouter `exactInputSingle`/`exactOutputSingle` calls; similar structure to Swapr cartridge:
  - `uniswap.checkApproval`, `uniswap.approve`, `uniswap.swap`, `uniswap.swapExactOut`, `uniswap.completeSwap`, `uniswap.completeSwapExactOut`.
  - Router address from chain config (e.g., `0xE59242…`).
- In Futarchy flows that currently call `SwaprAlgebraCartridge` internally (`completeSplitSwap`), branch by chain to use the Uniswap cartridge.

6) sDAI Rate fetcher behavior [ ]
- On non-Gnosis chains, either:
  - Skip sDAI rate fetch gracefully (return warning), or
  - Use a stablecoin of interest per chain (optional future work).
- Ensure the UI formatting handles missing `sdaiRate` (already does).

7) Env + UX output [ ]
- On startup, log: selected chain, RPC, AMM, router address, factory used for discovery.
- Provide usage in console if chain unsupported.

8) Tests & Debugging [ ]
- Dry-run fetch-only on Polygon (proposal info, discovery); verify Uniswap path resolves pools and prices.
- Gnosis end-to-end: split → swap via Swapr; verify streamed statuses and receipts.
- Polygon end-to-end (after Uniswap cartridge): approve + swap exact input and exact output.

9) Docs & Scripts [ ]
- Update `FUTARCHY-RUNTIME.md` with `--chain` usage examples.
- Add `npm run futarchy -- --chain=100` and `--chain=137` examples.
- If we create a `chains.runtime.json`, document its fields.

Planned File Changes
- examples/futarchy-complete.js: parse `--chain`, build runtime config, conditional registration, pass router address.
- fetchers/PoolDiscoveryFetcher.js: add Uniswap discovery mode + price read via `slot0()`; parametrize factory address per chain.
- executors/FutarchyCartridge.js: accept router address in ctor; branch for chain in `completeSplitSwap` to use Swapr or Uniswap cartridge.
- executors/UniswapV3Cartridge.js: NEW – mirror of Swapr cartridge but for Uniswap SwapRouter.
- FUTARCHY-RUNTIME.md: extend with examples.

Checkpoints
- [x] Analyzed current runtime, fetchers/executors, channels
- [x] Wrote plan (this document)
- [x] Added runtime chain config (runtime-chains.config.json) and loader
- [x] examples/futarchy-complete.js now reads router/RPC from config; logs selected chain/AMM
- [x] Parse `--chain` (Gnosis + Polygon) and route clients to chain RPC
- [x] Inject router address per chain into FutarchyCartridge
- [x] PoolDiscoveryFetcher: add Uniswap path and factory injection
- [x] Implement UniswapV3Cartridge
- [ ] Branch Futarchy flows to use the right cartridge
- [ ] Test on Gnosis (end-to-end) and Polygon (discovery, then swaps)
- [ ] Update docs and examples

Quick Test (Gnosis default)
- Run: `npm run futarchy` (no flags) — should behave as before, now printing chain/AMM/RPC from config.
- Optional: `npm run futarchy -- --chain=100` — same as default.

Notes
- Current change is non-breaking: defaults remain Gnosis/Swapr, and the hardcoded addresses were moved to config.

Notes / Risks
- Uniswap cartridge is the largest net-new code; if time constrained, we can initially support Polygon discovery only and gate swaps behind CoWSwap until Uniswap path lands.
- Some fetchers (sDAI Rate) are Gnosis-specific; ensure graceful degradation on other chains.
- Use chain-config addresses from `refactorCreateProposal/config/chains.config.json` where possible to avoid duplication.

---

We can proceed iteratively and tick the boxes as we land each step.
