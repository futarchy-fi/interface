# AMM Differences, ABIs, and Contract Calls

This document explains how the refactored CLI selects chains/AMMs, what contracts it uses, which ABIs/signatures are called, and where behavior differs between Uniswap V3 and Swapr/Algebra V3. It also documents proposal creation, token splitting/merging, pool creation/minting, price reads, approvals/gas, and known limitations.

## Scope & Structure

- Chain/AMM selection mechanics and configuration
- Contracts and minimal ABIs used by the CLI
- End-to-end flows and where variants differ (Uniswap vs Algebra)
- Token ordering, price math, tick spacing
- Approvals, gas settings, and logging
- Verification tips and known limitations

---

## Chain and AMM Selection

- Configuration source: `config/chains.config.json` (loaded by `contracts/constants.js`).
- Chain selection order of precedence:
  1. CLI flag `--chain=<id>`
  2. Config file `chainId`
  3. Environment `CHAIN_ID`
  4. `defaultChain` in `chains.config.json`
- AMM selection:
  - From config `amm` (e.g., `"uniswap"` or `"swapr"`) or per‑chain `defaultAMM`.
  - Modules switch ABIs and call shapes at runtime based on active AMM.

References in code:
- Chain/AMM resolution: `contracts/constants.js`
- CLI flags + dynamic reload: `cli.js`

---

## Contracts and Minimal ABIs

Below are the minimal function/event signatures the CLI uses at runtime. Actual ABIs are assembled inline per AMM.

### ERC‑20
```
function symbol() view returns (string)
function decimals() view returns (uint8)
function balanceOf(address) view returns (uint256)
function allowance(address,address) view returns (uint256)
function approve(address,uint256) returns (bool)
```

### Uniswap V3

Factory:
```
function getPool(address token0, address token1, uint24 fee) view returns (address)
function createPool(address token0, address token1, uint24 fee) returns (address)   // fallback path
event PoolCreated(address token0,address token1,uint24 fee,int24 tickSpacing,address pool)
```

Pool:
```
function slot0() view returns (
  uint160 sqrtPriceX96,
  int24  tick,
  uint16 observationIndex,
  uint16 observationCardinality,
  uint16 observationCardinalityNext,
  uint8  feeProtocol,
  bool   unlocked
)
function token0() view returns (address)
function token1() view returns (address)
function tickSpacing() view returns (int24)
```

NonfungiblePositionManager (NFPM):
```
function createAndInitializePoolIfNecessary(
  address token0,
  address token1,
  uint24 fee,
  uint160 sqrtPriceX96
) returns (address)

function mint((
  address token0,
  address token1,
  uint24  fee,
  int24   tickLower,
  int24   tickUpper,
  uint256 amount0Desired,
  uint256 amount1Desired,
  uint256 amount0Min,
  uint256 amount1Min,
  address recipient,
  uint256 deadline
)) returns (
  uint256 tokenId,
  uint128 liquidity,
  uint256 amount0,
  uint256 amount1
)

function positions(uint256) view returns (...)
function factory() view returns (address)
```

### Swapr/Algebra V3

Factory:
```
function poolByPair(address token0, address token1) view returns (address)
```

Pool:
```
function globalState() view returns (
  uint160 sqrtPriceX96,
  int24  tick,
  uint16 feeZto,
  uint16 feeOtz,
  uint16 communityFeeLastTimestamp,
  bool   unlocked
)
function token0() view returns (address)
function token1() view returns (address)
function tickSpacing() view returns (int24)
```

PositionManager (Algebra clone of NFPM):
```
function createAndInitializePoolIfNecessary(
  address token0,
  address token1,
  uint160 sqrtPriceX96
) returns (address)

function mint((
  address token0,
  address token1,
  int24   tickLower,
  int24   tickUpper,
  uint256 amount0Desired,
  uint256 amount1Desired,
  uint256 amount0Min,
  uint256 amount1Min,
  address recipient,
  uint256 deadline
)) returns (
  uint256 tokenId,
  uint128 liquidity,
  uint256 amount0,
  uint256 amount1
)
```

### Futarchy Contracts

Factory:
```
function createProposal((
  string marketName,
  address companyToken,
  address currencyToken,
  string category,
  string language,
  uint256 minBond,
  uint32  openingTime
)) returns (address)
function proposals(uint256) view returns (address)
function marketsCount() view returns (uint256)
// Event: ProposalCreated(...)   // not included in minimal ABI; see limitations
```

Adapter (Router) for YES/NO splitting:
```
function splitPosition(address proposal, address collateral, uint256 amount)
function mergePositions(address proposal, address collateral, uint256 amount)
```

---

## End‑to‑End Flows

### 1) Proposal Creation

1. CLI composes the proposal tuple and calls `factory.createProposal(...)` using a buffered gas limit.
2. Attempts a `staticCall` to predict the new address; also tries to parse logs for a `ProposalCreated`-like event.
3. If not discoverable, it instructs the user to fetch the address from the explorer and set it in the config.

Notes:
- See `modules/proposalCreator.js` for logging, gas estimation, and resolution of the final address.

### 2) Ensuring Conditional Tokens (YES/NO)

1. For a pool that needs YES/NO conditional tokens, the adapter splits the base collateral as needed.
2. Balances and allowances are checked before splits; balances are refreshed afterward to confirm sufficiency.
3. `splitPosition(proposal, collateral, amount)` and `mergePositions(...)` are used; both support EIP‑1559 fee fields.

Notes:
- See `modules/futarchyAdapter.js` and `utils/tokens.js` for balance refresh and `ensureAllowance` logic.

### 3) Pool Existence Check

- Uniswap: `factory.getPool(token0, token1, feeTier)`
- Algebra: `factory.poolByPair(token0, token1)`

Factory Source:
- Prefer `POOL_FACTORY` from chain config; fallback to `NFPM.factory()` when available.
- If factory is unknown, existence checks are disabled and the code proceeds to creation.

### 4) Pool Creation and Initialization Price

Token Ordering:
- AMM token order is address‑sorted; the CLI maintains a logical order for UX/pricing.
- Helper decides if amounts need reordering; price is converted to AMM space accordingly.

Initial Price:
```
ammPrice = needsReorder ? 1 / logicalPrice : logicalPrice
sqrtPriceX96 = floor( sqrt(ammPrice) * 2^96 )
```

Create/Initialize:
- Uniswap: `NFPM.createAndInitializePoolIfNecessary(token0,token1,feeTier,sqrtPriceX96)`
- Algebra: `NFPM.createAndInitializePoolIfNecessary(token0,token1,sqrtPriceX96)`

Fallback for Uniswap only:
1. `factory.createPool(token0,token1,feeTier)`
2. `pool.initialize(sqrtPriceX96)`
3. Discover pool address via logs (`Initialize(uint160,int24)` or `PoolCreated(...)`) or by querying factory again.

### 5) Minting Liquidity

Amounts:
- Reordered to AMM order if needed.
- Approvals ensured for both tokens to the Position Manager.

Ticks:
- Uniswap: centers a tight range around current tick using `tickSpacing()` and `tickWidthSteps`.
- Algebra: uses configured full‑range defaults by aligning to `tickSpacing()` limits.

Mint Struct:
- Uniswap includes `fee` in mint params; Algebra does not.

### 6) Reading and Verifying Price

Read:
- Uniswap: `slot0().sqrtPriceX96`
- Algebra: `globalState().sqrtPriceX96`

Convert:
```
ammPrice = (sqrtPriceX96 / 2^96)^2
logicalDisplayedPrice = needsReorder ? 1 / ammPrice : ammPrice
```

Existing Pools:
- If a pool exists, fetch live price and adjust provided amounts to match the current ratio before minting.

---

## AMM Differences (At a Glance)

- Factory lookup:
  - Uniswap: `getPool(token0, token1, feeTier)`
  - Algebra: `poolByPair(token0, token1)`
- Slot/State:
  - Uniswap: `slot0().sqrtPriceX96`
  - Algebra: `globalState().sqrtPriceX96`
- Create/init:
  - Uniswap: `createAndInitializePoolIfNecessary(..., feeTier, sqrtPriceX96)`
  - Algebra: `createAndInitializePoolIfNecessary(..., sqrtPriceX96)`
- Mint struct:
  - Uniswap includes `fee` in params
  - Algebra does not include `fee`
- Fallback factory create:
  - Implemented for Uniswap; Algebra flow differs and is not included in fallback path

---

## Approvals, Gas, and Logging

Approvals:
- If `allowance < amount`, optionally reset to 0, then approve `amount`.
- Spenders: Position Manager (mint), Futarchy Adapter (split/merge).

Gas:
- Chain‑specific `gasLimit` defaults per action from `chains.config.json`.
- EIP‑1559 fields used when available; minimum tip floor (e.g., 25 gwei on Polygon) to avoid underpriced txs.

Logging:
- Per‑operation transactions and details are appended to `logs/transactions_<session>.log`.
- JSON and CSV exports include explorer links (based on active chain) and grouped summaries.

---

## Verification Tips

Uniswap V3:
- Factory `getPool()` should return non‑zero for existing pools.
- Confirm NFPM calls decode as `createAndInitializePoolIfNecessary(address,address,uint24,uint160)` and `mint((...),uint24 fee,...)`.
- Read `slot0()` on the pool; compute `(sqrtPriceX96 / 2^96)^2` for price.

Algebra V3:
- Use `poolByPair()` to find pools.
- Init/mint signatures do not include `fee`.
- Read `globalState()` to fetch `sqrtPriceX96` and price.

Proposal & Adapter:
- Confirm Futarchy Factory and Adapter addresses match your chain config.
- Splits/merges should show approvals then adapter transactions.

---

## Known Limitations / Notes

- Proposal event ABI not included:
  - The minimal ABI doesn’t include `ProposalCreated(...)`, so reliable on‑chain parsing of the created address may fail on some chains. The CLI will guide to fetch the address from the explorer.
- Algebra factory fallback not implemented:
  - The manual fallback path (`factory.createPool` → `pool.initialize`) is Uniswap‑specific. Algebra’s create/init differs and is not invoked when NFPM create fails.
- Price decimals normalization:
  - `getPoolPrice()` computes a unitless AMM price. When tokens have different decimals (e.g., USDC 6 decimals), displayed “logical” price may need normalization if used outside AMM context.
- Numeric precision:
  - Conversions via `Number(...)` can lose precision for very large values. For production‑grade analytics, prefer full BigInt/fixed‑point math for price reporting.
- Gas tip floor:
  - A 25 gwei min priority tip is applied broadly to avoid underpriced txs on Polygon. This may be higher than necessary on other chains.

---

## Where to Look in Code

- Chain/AMM constants: `contracts/constants.js`
- CLI entry and dynamic module reload: `cli.js`
- Pool management (create/mint/price): `modules/poolManager.js`
- Orchestration & existing pool handling: `modules/liquidityOrchestrator.js`
- Proposal creation: `modules/proposalCreator.js`
- Token splitting/merging (adapter): `modules/futarchyAdapter.js`
- ERC‑20 utils, balances, approvals: `utils/tokens.js`
- Price math helpers: `utils/priceCalculations.js`
- Logging and exports: `utils/transactionLogger.js`

