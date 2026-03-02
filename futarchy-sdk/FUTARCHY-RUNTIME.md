# Futarchy Runtime Guide (npm run futarchy)

This guide explains exactly what runs when you execute `npm run futarchy`, how the DataLayer routes work, and how fetchers, executors, channels, and cartridges fit together. It also documents how Swapr V3 is already integrated for exact input and exact output swaps, including the expected inputs and streamed outputs of each operation.

## What `npm run futarchy` does

- Script: `examples/futarchy-complete.js`
- Creates a FutarchyManager that wires together:
  - A `DataLayer` instance (router for fetch, execute, subscribe)
  - Viem clients (publicClient/walletClient) on Gnosis (chain id 100)
  - Fetchers: Pool discovery, Proposal, Market events, Futarchy (proposal/balances/positions), Tick spread, sDAI rate
  - Executor: `ViemExecutor` (with a `FutarchyCartridge` for router ops)
- It then runs various demos/commands that call the DataLayer by operation names like `futarchy.proposal`, `pools.discover`, `futarchy.positions`, etc.

Environment variables (in `.env`):
- `PRIVATE_KEY` (with 0x prefix recommended)
- `RPC_URL` (defaults to `https://rpc.gnosischain.com`)
- Optional Supabase vars if you use realtime channels: `SUPABASE_URL`, `SUPABASE_ANON_KEY`

## DataLayer: the router

- `fetch(dataPath, args)` routes to registered fetchers (pure reads)
- `execute(dataPath, args)` routes to executors (writes/transactions) and yields streamed progress events
- `subscribe(channelPath, args)` routes to channels (realtime streams) and yields events

You never call fetchers/executors directly; you call the DataLayer with a string key like `futarchy.proposal` or `swapr.swap` and it dispatches to the right module.

## Fetchers (reads)

Registered by `examples/futarchy-complete.js`:

- FutarchyFetcher (`fetchers/FutarchyFetcher.js`)
  - `futarchy.proposal`: { proposalAddress } → proposal info (collaterals, wrapped outcome tokens)
  - `futarchy.balances`: { proposalAddress, userAddress } → balances for YES/NO and base tokens
  - `futarchy.positions`: { proposalAddress, userAddress } → mergeable amounts and net positions
  - `futarchy.market`: { proposalAddress } → basic market view (type/lastUpdated)
  - `futarchy.complete`: { proposalAddress, userAddress? } → combined view

- PoolDiscoveryFetcher (`fetchers/PoolDiscoveryFetcher.js`) [Swapr/Algebra on Gnosis]
  - `pools.discover`: { proposalAddress } → 6 candidate pools, grouped
  - `pools.conditional`: { proposalAddress } → YES/NO for same collateral
  - `pools.probability`: { proposalAddress } → YES/YES, NO/NO, YES/NO cross pairs
  - `pools.details`: { poolAddress } → token0, token1, liquidity, tick, price snapshot
  - `pools.prices`: { proposalAddress } → map of poolname → sqrtPriceX96, tick, price, decimals-aware

- ProposalFetcher (`fetchers/ProposalFetcher.js`)
  - `proposal.basic`: { proposalAddress } → market metadata + question ids (Realitio)
  - `proposal.details`: { proposalAddress } → extended metadata (parent market, outcomes, tokens)

- MarketEventsFetcher (`fetchers/MarketEventsFetcher.js`)
  - Provides historical/progressive market events; see file for exact ops

- TickSpreadFetcher (`fetchers/TickSpreadFetcher.js`)
  - Utilities around tick math/spreads for reporting

- sDAI Rate Fetcher (`fetchers/SdaiRateFetcher.js`)
  - `sdai.rate`: {} → current sDAI rate (cached, with fallback RPCs)
  - `sdai.rate.cached`: {} → cached rate without refetch
  - `sdai.rate.refresh`: {} → force refresh

All fetchers return a plain object like `{ status: 'success'|'error'|'loading', data?, reason?, source?, cached? }`.

## Executors (writes) and cartridges

- ViemExecutor (`executors/ViemExecutor.js`)
  - Built‑in ops:
    - `web3.approve`: { tokenAddress, spenderAddress, amount }
    - `web3.transfer`: { tokenAddress?, to, amount }
    - `web3.connect`: {}
    - `web3.getBalance`: { address, tokenAddress? }
  - Cartridges extend the executor with domain operations:
    - FutarchyCartridge (`executors/FutarchyCartridge.js`)
    - SwaprAlgebraCartridge (`executors/SwaprAlgebraCartridge.js`)
    - CoWSwapCartridge (`executors/CoWSwapCartridge.js`)

Each `execute()` call is an async generator yielding structured progress events:
```
{
  status: 'pending' | 'success' | 'error',
  message: string,
  step: string,           // high-level step name (e.g., 'approve', 'execute', 'confirm')
  data?: { ... }          // tx hash, receipt, computed values, etc.
}
```

### FutarchyCartridge (Futarchy Router on Gnosis)

- Router address (default): `0x7495a583ba85875d59407781b4958ED6e0E1228f`
- Operations:
  - `futarchy.splitPosition`
    - Input: `{ proposal, collateralToken, amount }` (amount as string ether or bigint)
    - Effect: Approves if needed then `splitPosition` on the router
  - `futarchy.mergePositions`
    - Input: `{ proposal, collateralToken, amount }`
  - `futarchy.redeemPositions`
    - Input: `{ proposal, collateralToken, amount }`
  - `futarchy.redeemProposal`
    - Input: `{ proposal, amount1, amount2 }` (two collaterals)
  - Convenience flows (multi‑step):
    - `futarchy.checkApproval`: { collateralToken, amount? }
    - `futarchy.approveCollateral`: { collateralToken, amount: 'unlimited' | string }
    - `futarchy.completeSplit`: check approval → approve if needed → split
    - `futarchy.completeMerge`: check approval → approve if needed → merge
    - `futarchy.completeSplitSwap`: split to YES‑sDAI as needed → approve YES‑sDAI → call Swapr (see below)
    - `futarchy.completeRedeemOutcomes`: check balances → approve if needed → redeem outcomes

Note: `completeSplitSwap` instantiates `SwaprAlgebraCartridge` internally and calls its `completeSwap` to move from YES‑sDAI → YES‑<company>.

### SwaprAlgebraCartridge (Swapr V3 Router on Gnosis)

- Router address: `0xffb643e73f280b97809a8b41f7232ab401a04ee1`
- Ops and exact inputs/outputs:
  - `swapr.checkApproval`
    - Input: `{ tokenAddress }`
    - Output: `{ isApproved, allowance, balance, spender }`
  - `swapr.approve`
    - Input: `{ tokenAddress, amount }` (use `'unlimited'` for max)
  - `swapr.swap` (exact input single)
    - Input: `{ tokenIn, tokenOut, amount, slippageBps?, deadline? }`
    - Behavior: Calls `exactInputSingle({ tokenIn, tokenOut, recipient: account, deadline, amountIn, amountOutMinimum: 0, limitSqrtPrice: 0 })`
    - Output: Streamed events with `transactionHash`, `receipt`, `gasUsed`. Amount out is not decoded from logs in this impl.
  - `swapr.swapExactOut` (exact output single)
    - Input: `{ tokenIn, tokenOut, amountOut, amountInMaximum, slippageBps?, deadline?, fee? }`
    - Behavior: Calls `exactOutputSingle({ tokenIn, tokenOut, fee, recipient, deadline, amountOut, amountInMaximum, limitSqrtPrice: 0 })`
  - Composed flows:
    - `swapr.completeSwap`: check approval → approve if needed → exact input swap
    - `swapr.completeSwapExactOut`: check approval → approve if needed → exact output swap

Streaming output example (common to all ops):
```
{ status: 'pending', step: 'prepare', message: 'Preparing ...' }
{ status: 'pending', step: 'approve', message: 'Approving ...', data: { transactionHash } }
{ status: 'pending', step: 'confirm', message: 'Waiting confirmation...', data: { transactionHash } }
{ status: 'success', step: 'complete', message: 'Done!', data: { transactionHash, receipt, gasUsed } }
```

### CoWSwapCartridge (CoW Protocol on Gnosis)

- Vault Relayer: `0xC92E8bdf79f0507f65a392b0ab4667716BFE0110`
- Operations:
  - `cowswap.checkApproval`, `cowswap.approve`, `cowswap.swap`, `cowswap.completeSwap`
- Enables order‑based swaps (quotes via API step, then order submission)

## Channels (realtime streams)

- Supabase channel (`channels/SupabaseCandlesChannel.js`)
  - Topic: `pools.candle.realtime`
  - Subscribe via DataLayer:
    - `for await (const evt of dl.subscribe('pools.candle.realtime', { id, interval })) { ... }`
  - Emits:
    - `{ status: 'success', step: 'subscribed', data: { id, interval } }` once subscribed
    - Then `{ status: 'pending', step: 'update', data: { address, interval, timestamp, price } }` on each INSERT

Configure Supabase via `.env`:
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`

## Using Swapr in your code (quickstart)

```js
import { DataLayer } from './DataLayer.js';
import { ViemExecutor } from './executors/ViemExecutor.js';
import SwaprAlgebraCartridge from './executors/SwaprAlgebraCartridge.js';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { gnosis } from 'viem/chains';

const account = privateKeyToAccount(process.env.PRIVATE_KEY);
const publicClient = createPublicClient({ chain: gnosis, transport: http(process.env.RPC_URL) });
const walletClient = createWalletClient({ account, chain: gnosis, transport: http(process.env.RPC_URL) });

const dl = new DataLayer();
const exec = new ViemExecutor({ publicClient, walletClient, account });
exec.registerCartridge(new SwaprAlgebraCartridge());
dl.registerExecutor(exec);

// Approve + swap exact input
for await (const s of dl.execute('swapr.completeSwap', {
  tokenIn: '0xTokenIn',
  tokenOut: '0xTokenOut',
  amount: '1.0', // 1 tokenIn
  slippageBps: 50, // 0.50%
})) {
  console.log(s);
}

// Exact output swap
for await (const s of dl.execute('swapr.completeSwapExactOut', {
  tokenIn: '0xTokenIn',
  tokenOut: '0xTokenOut',
  amountOut: '10.0',       // want exactly 10 tokenOut
  amountInMaximum: '12.0', // will spend at most 12 tokenIn
  slippageBps: 50,
})) {
  console.log(s);
}
```

## How `examples/futarchy-complete.js` uses all of this

- Builds `DataLayer`, registers fetchers and SdaiRateFetcher so USD equivalents can be displayed.
- If `PRIVATE_KEY` is present, registers `ViemExecutor` + `FutarchyCartridge` so it can split/merge/redeem via the Futarchy Router.
- Uses DataLayer.fetch to get proposal, balances, and positions, and can orchestrate split → swap via the cartridge.
- For Swapr, either:
  - Use `futarchy.completeSplitSwap` (internally constructs a `SwaprAlgebraCartridge` and runs approval+swap), or
  - Register `SwaprAlgebraCartridge` yourself and call `swapr.*` operations directly as shown above.

## Tips and caveats

- Chain: all write operations are wired for Gnosis (100) by default in these examples.
- Approvals: use `'unlimited'` for convenience when appropriate; otherwise pass a string amount in token units.
- Slippage: `slippageBps` is advisory; the current `exactInputSingle` call uses `amountOutMinimum = 0` and `limitSqrtPrice = 0`. Consider hardening for production.
- Decimals: fetchers handle formatting with `formatEther` (18 decimals). Non‑18 tokens will need conversions in your UI/business logic.
- Streaming: always iterate executors with `for await ... of ...` to capture all status updates and final receipts.

---

If you want this integrated into a CLI flow of your own, copy patterns from `examples/futarchy-complete.js` and register the cartridges you need on the same `ViemExecutor`.

