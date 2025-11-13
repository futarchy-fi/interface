# Futarchy Data Layer and “Complete” Operations

This document explains the project’s Data Layer structure (fetchers and executors), how operations are named and routed, and how Futarchy “complete” flows orchestrate multi-step transactions.

## Architecture Overview

- **DataLayer:** Central router for reads and writes. Maps operation paths to a registered fetcher (`fetch`) or executor (`execute`).
- **Fetchers:** Read-only providers (blockchain, DB, or mock). Return plain results (`{ status, data, ... }`).
- **Executors:** Write/transaction handlers. Use async generators to yield progress updates during execution.
- **Cartridges:** Plug-ins for executors that register domain-specific operations (e.g., futarchy splits/merges) without changing the executor core.

## Key Modules

- `DataLayer.js`
  - `DataLayer`: registers and routes operations.
  - `BaseFetcher`: abstract base for fetchers (`supportedOperations`, `registerOperation`).
- `executors/BaseExecutor.js`
  - `BaseExecutor`: abstract base for executors (`async* execute`, `registerOperation`, `getStatus`).
- `executors/ViemExecutor.js`
  - Built-ins: `web3.connect`, `web3.approve`, `web3.getBalance`, `web3.transfer` (placeholder).
  - Cartridge system: `registerCartridge` to add futarchy ops.
- `executors/FutarchyCartridge.js`
  - Futarchy operations (see below), including “complete*” flows that compose multiple steps.
- Fetchers (`fetchers/*`)
  - `SupabasePoolFetcher.js`: DB reads like `pools.candle`, `markets.events`, `markets.event.hero`.
  - `ProposalFetcher.js`: On-chain proposal reads like `proposal.info`, `proposal.status`, `proposal.realitio`.
  - `MockFetcher.js`: Synthetic data for testing.

## Operation Naming

Operations follow dot-notation: `domain.action`.

- Fetchers (read):
  - `pools.candle`, `pools.info`, `markets.events`, `markets.event`, `markets.event.hero`, `proposal.status`, etc.
- Executors (write):
  - Core: `web3.connect`, `web3.approve`, `web3.getBalance`.
  - Futarchy cartridge: `futarchy.splitPosition`, `futarchy.mergePositions`, `futarchy.redeemPositions`, `futarchy.redeemProposal`, `futarchy.checkApproval`, `futarchy.approveCollateral`, and “complete” flows: `futarchy.completeSplit`, `futarchy.completeMerge`, `futarchy.completeSplitSwap`, `futarchy.completeRedeemOutcomes`.

## Wiring Example

```js
import { DataLayer } from './DataLayer.js';
import { MockFetcher } from './fetchers/MockFetcher.js';
import { SupabasePoolFetcher, createSupabasePoolFetcher } from './fetchers/SupabasePoolFetcher.js';
import { ProposalFetcher } from './fetchers/ProposalFetcher.js';
import { ViemExecutor } from './executors/ViemExecutor.js';
import { FutarchyCartridge } from './executors/FutarchyCartridge.js';

const dl = new DataLayer();

// Register fetchers (reads)
dl.registerFetcher(new MockFetcher());
dl.registerFetcher(createSupabasePoolFetcher(process.env.SUPABASE_URL, process.env.SUPABASE_KEY));
dl.registerFetcher(new ProposalFetcher());

// Register executor (writes) + cartridge
const viem = new ViemExecutor({ /* optional: chain, rpcUrl, account, clients */ });
viem.registerCartridge(new FutarchyCartridge(/* routerAddress? */));
dl.registerExecutor(viem);

// Read example
const candles = await dl.fetch('pools.candle', { id: '0xPool', limit: 10 });

// Write example (generator yields progress)
for await (const status of dl.execute('web3.approve', {
  tokenAddress: '0xToken',
  spenderAddress: '0xSpender',
  amount: '1000000000000000000'
})) {
  console.log(status.step, status.message);
}
```

## Futarchy “Complete” Flows

“Complete” flows orchestrate multiple steps into a single high-level operation, yielding granular progress updates for UI/CLI.

### completeSplit

Path: `futarchy.completeSplit`

Arguments:
- `proposal`: Futarchy proposal address
- `collateralToken`: ERC20 to use as collateral
- `amount`: amount (string in ether or bigint wei)

Sequence (yielded `step` values map to these stages):
1. **start:** Begin operation.
2. **check_approval:** Call `futarchy.checkApproval` to read allowance and balance.
3. If not approved:
   - **approve_*:** Call `futarchy.approveCollateral` (unlimited). Yields sub-steps like `approve_approval_prep`, `approve_approval_confirmation`, `approve_approval_submitted`, `approve_complete`.
   - Otherwise: **already_approved.**
4. **splitting:** Call `futarchy.splitPosition` to submit the split tx. Yields sub-steps like `split_split`, `split_confirm`, `split_complete`.
5. **complete:** Success data includes `transactionHash`, `blockNumber`, `gasUsed`.

Example:
```js
for await (const s of dl.execute('futarchy.completeSplit', {
  proposal: '0xProposal',
  collateralToken: '0xToken',
  amount: '10' // 10 units (parseEther inside)
})) {
  // s = { status: 'pending'|'success'|'error', step, message, data }
  renderStatus(s.step, s.message);
}
```

### completeMerge

Path: `futarchy.completeMerge`

Arguments:
- `proposal`: proposal address
- `collateralToken`: base collateral
- `amount`: amount to merge
- `yesToken`, `noToken`: wrapped outcome tokens that must be approved

Sequence:
1. **start**
2. **check_yes_approval** → approve if needed (yields `approve_yes_*`).
3. **check_no_approval** → approve if needed (yields `approve_no_*`).
4. **merging** via `futarchy.mergePositions` (yields `merge_confirm`, `merge_complete`).
5. **complete** on success.

### Other Complete Flows

- `futarchy.completeSplitSwap`: Combines splitting with follow-on swap steps (if implemented in the cartridge). 
- `futarchy.completeRedeemOutcomes`: Automates redeeming after resolution (read winning outcomes, then redeem).

Note: Each yields consistent status envelopes `{ status, step, message, data }` for UX.

## How Fetchers Fit In

Fetchers provide the read-side context for UX and pre-checks:
- **SupabasePoolFetcher:** Market and pool data to display charts, events, and hero cards (`markets.events`, `markets.event.hero`, `pools.candle`).
- **ProposalFetcher:** On-chain facts used to show proposal details and Realitio status (`proposal.details`, `proposal.realitio`, `proposal.status`).
- **MockFetcher:** Fast local data for dev/testing (`pools.candle`, `market.stats`).

Typical UI flow:
- Fetch event hero and proposal status to show current market state.
- When user proceeds, call a “complete” executor operation.
- Stream and render generator updates to guide the user through confirmation and settlement.

## Error Handling & Statuses

- Fetchers return a single result object:
  - `{ status: 'success'|'error', data?, reason?, source }`
- Executors yield multiple updates:
  - `{ status: 'pending'|'success'|'error', step, message, data? }`
- On unsupported operation:
  - DataLayer returns/yeilds an error with `availableOperations`/`getAvailableOperations()` to guide users.

## CLI Helpers

- `basefetch.js` (inspect and test fetchers)
  - `node basefetch.js --list`
  - `node basefetch.js --info supabasepoolfetcher`
  - `node basefetch.js supabasepoolfetcher markets.event.hero --id <uuid>`
- `baseexec.js` (inspect and test executors)
  - `node baseexec.js --list`
  - `node baseexec.js --info viemexecutor`
  - `node baseexec.js --test viemexecutor`

These CLIs discover modules and show their operations without needing to wire a UI.

## Why This Pattern

- **Separation of concerns:** Reads vs. writes are isolated.
- **Extensibility:** Add new fetchers/executors or plug-in cartridges.
- **Great UX for writes:** Async generators surface granular progress and errors.
- **Consistency:** Dot-path operation names organize the surface area.

## Quick Reference

- Reads: `await dl.fetch('<domain.action>', args)`
- Writes: `for await (const s of dl.execute('<domain.action>', args)) { ... }`
- Futarchy complete ops are available after: `viem.registerCartridge(new FutarchyCartridge())` and `dl.registerExecutor(viem)`.

