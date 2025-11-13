# DEX Liquidity and Proposals: How It Works

This document explains how the refactored CLI creates proposals, prepares conditional tokens, and sets up Swapr/Uniswap V3 pools with correct token ordering, price targets, and liquidity. It also covers how prices are verified and how existing pools are handled.

## Components

- Position Manager: used for pool creation and liquidity minting
  - Address per chain from `config/chains.config.json` and exposed via constants
  - References:
    - `refactorCreateProposal/contracts/constants.js:27`
    - `refactorCreateProposal/modules/poolManager.js:11`

- Swap Router: configured, but not currently used by the orchestration
  - Present in config/constants for future swaps but unused in code paths documented here
  - References:
    - `refactorCreateProposal/contracts/constants.js:28`
    - `refactorCreateProposal/config/chains.config.json:9`

- Futarchy Factory and Adapter: proposal creation and split/merge of conditional tokens
  - Factory address fetched from chain config; adapter used to split/merge YES/NO tokens
  - References:
    - `refactorCreateProposal/contracts/constants.js:31`
    - `refactorCreateProposal/modules/proposalCreator.js:9`
    - `refactorCreateProposal/modules/futarchyAdapter.js:10`

- Orchestrator, Token Manager, Price Calculator, Logger: coordination and utilities
  - References:
    - `refactorCreateProposal/modules/liquidityOrchestrator.js:4`
    - `refactorCreateProposal/utils/tokens.js:4`
    - `refactorCreateProposal/utils/priceCalculations.js:3`
    - `refactorCreateProposal/utils/transactionLogger.js:1`

## Flow Overview

1) Create or load a proposal
- CLI entry loads config, selects chain, and either creates a proposal or uses an existing address.
- References:
  - CLI commands: `refactorCreateProposal/cli.js:200`
  - Create: `refactorCreateProposal/modules/proposalCreator.js:20`
  - Load: `refactorCreateProposal/modules/proposalCreator.js:100`

2) Compute pool targets and amounts
- Uses spot price, probability, impact to compute 6 pools' target prices and token amounts.
- References:
  - `refactorCreateProposal/modules/liquidityOrchestrator.js:81`
  - `refactorCreateProposal/utils/priceCalculations.js:115`

3) Ensure tokens and balances
- For conditional tokens (YES/NO), adapter splits base collateral as needed; balances and allowances are verified.
- References:
  - `refactorCreateProposal/modules/liquidityOrchestrator.js:334`
  - `refactorCreateProposal/modules/futarchyAdapter.js:120`
  - `refactorCreateProposal/utils/tokens.js:61`

4) Create pool (if needed) and mint position
- Position Manager `createAndInitializePoolIfNecessary` then `mint` with correct AMM token order and aligned ticks.
- References:
  - `refactorCreateProposal/modules/poolManager.js:111`
  - `refactorCreateProposal/modules/poolManager.js:171`
  - `refactorCreateProposal/modules/poolManager.js:232`
  - `refactorCreateProposal/modules/poolManager.js:111`

5) Verify and log
- Reads `sqrtPriceX96` to compute actual price, adjusts for logical vs AMM order when showing, verifies deviation, logs all transactions and exports CSV/JSON.
- References:
  - `refactorCreateProposal/modules/poolManager.js:95`
  - `refactorCreateProposal/modules/liquidityOrchestrator.js:300`
  - `refactorCreateProposal/utils/transactionLogger.js:1`

## Proposal Creation

- The CLI constructs `createProposal` params and submits to the factory with a generous gas limit.
- If the `ProposalCreated` event isn’t available (ABI minimal), it falls back to `marketsCount()` + `proposals(index)` to retrieve the last created address.
- References:
  - `refactorCreateProposal/modules/proposalCreator.js:41` (params assembly)
  - `refactorCreateProposal/modules/proposalCreator.js:51` (tx)
  - `refactorCreateProposal/modules/proposalCreator.js:63` (parse logs)
  - `refactorCreateProposal/modules/proposalCreator.js:79` (fallback fetch)

## Conditional Tokens: Split/Merge

- When a pool needs conditional tokens (YES/NO of a base token), the adapter is used:
  - Split: `splitPosition(proposal, collateral, amount)`
  - Merge: `mergePositions(proposal, collateral, amount)`
- Balances are refreshed before/after operations; allowances to the adapter are ensured.
- References:
  - `refactorCreateProposal/modules/futarchyAdapter.js:21` (split)
  - `refactorCreateProposal/modules/futarchyAdapter.js:66` (merge)
  - `refactorCreateProposal/modules/futarchyAdapter.js:134` (balance check and split flow)
  - `refactorCreateProposal/utils/tokens.js:61` (ensureAllowance)

## Token Ordering: Logical vs AMM

- AMM order is strictly address-sorted; the CLI preserves a logical token order for UX and pricing.
- The helper `getAMMOrder(token0, token1)` compares checksummed addresses and returns whether amounts need reordering.
- This ordering decision is applied consistently to pool initialization and minting.
- References:
  - `refactorCreateProposal/utils/tokens.js:91`
  - `refactorCreateProposal/modules/poolManager.js:111` (create flow uses `needsReorder` for price and addresses)
  - `refactorCreateProposal/modules/poolManager.js:162` (explanatory logs about inversion)
  - `refactorCreateProposal/modules/poolManager.js:197` (pool discovery fallback)

### Creating a Pool with Correct Price

- Initial price is supplied as `sqrtPriceX96` to `createAndInitializePoolIfNecessary`.
- The ratio used to compute `sqrtPriceX96` is determined by AMM order:
  - If needsReorder: `sqrtPriceX96(amount1, amount0)`
  - Else: `sqrtPriceX96(amount0, amount1)`
- References:
  - `refactorCreateProposal/utils/priceCalculations.js:4` (sqrtPriceX96)
  - `refactorCreateProposal/modules/poolManager.js:127` (ordering-aware calc)

Uniswap-specific notes:
- Pool creation requires a fee tier (e.g., 500, 3000, 10000): `createAndInitializePoolIfNecessary(token0,token1,fee,sqrtPriceX96)`.
- Provide `"feeTier": 3000` in your config (defaults to 3000 if omitted).

### Minting Liquidity with Correct Amounts

- In `mintPosition`, the desired amounts are reordered to match the AMM’s token0/token1 before calling `mint`.
- Ticks are aligned to pool tick spacing; mins are set low for minimal-amount tests.
- References:
  - `refactorCreateProposal/modules/poolManager.js:191` (reorder amounts for AMM)
  - `refactorCreateProposal/modules/poolManager.js:232` (tick spacing and alignment)
  - `refactorCreateProposal/modules/poolManager.js:262` (mint call)

Uniswap-specific notes:
- The mint struct includes `fee` in addition to the Uniswap V3 fields; we pass the configured `feeTier`.

## Price Calculation and Verification

- Target prices are computed from config:
  - Conditional prices from `spotPrice`, `eventProbability`, `impact`.
  - Prediction pools from probability and its complement.
- After pool creation/liquidity, price is read from the pool via `globalState().sqrtPriceX96` (Swapr/Algebra) or `slot0().sqrtPriceX96` (Uniswap):
  - `price = (sqrtPriceX96 / 2^96)^2`
  - If logical token0/1 do not match AMM order, the displayed logical price is `1 / ammPrice`.
- For existing pools, the orchestrator fetches the current pool price (logical), then adjusts provided amounts to maintain that ratio before adding liquidity.
- References:
  - Calculations: `refactorCreateProposal/utils/priceCalculations.js:32`, `:50`, `:115`
  - Pool price read: `refactorCreateProposal/modules/poolManager.js:95`
  - Existing pool handling: `refactorCreateProposal/modules/liquidityOrchestrator.js:168`, `:196`
  - Final verification logging: `refactorCreateProposal/modules/liquidityOrchestrator.js:300`

## Handling Existing Pools

- If a pool exists:
  - Automatic mode: skip unless `forceAddLiquidity` includes that pool number.
  - Semi/Manual: prompt and continue as chosen.
  - When adding liquidity, recompute amounts to exactly match the live pool price.
- References:
  - `refactorCreateProposal/modules/liquidityOrchestrator.js:187` (skip policy)
  - `refactorCreateProposal/modules/liquidityOrchestrator.js:201` (recalc amounts)

## Approvals and Balances

- All spenders are approved on-demand with optional reset-to-0 pattern.
- Approvals include: Position Manager (for mint), Futarchy Adapter (for split/merge).
- References:
  - `refactorCreateProposal/utils/tokens.js:61` (ensureAllowance)
  - `refactorCreateProposal/cli.js:236` (add-liquidity approvals)

## Chain and Gas Configuration

- Chain selection: `--chain=`, or `chainId` in config, or `.env CHAIN_ID`, fallback to `defaultChain`.
- Gas: limits per action from chain config; optional `GAS_PRICE_GWEI` (default from chain config).
- References:
  - `refactorCreateProposal/config/chains.config.json:1`
- `refactorCreateProposal/contracts/constants.js:17`
- `refactorCreateProposal/cli.js:1` (chain arg parsing)

### AMM Selection (swapr vs uniswap)

- Add `"amm"` to your config to choose the DEX implementation per chain.
- Supported values: `"swapr"` (default on Gnosis 100) or `"uniswap"` (default on Ethereum 1).
- Example:
  - `{"chainId": 100, "amm": "swapr", ... }`
  - `{"chainId": 1, "amm": "uniswap", ... }`
- The CLI prints the active AMM and contract addresses after loading config.
- Contracts are resolved from `contractsByAMM[amm]` for the selected chain, or fall back to `contracts` if not present.

### Polygon (137) Support

- Default AMM: `uniswap`
- Contracts (per config):
  - Position Manager: `0xC36442b4a4522E871399CD717aBDD847Ab11FE88`
  - Swap Router: `0xE592427A0AEce92De3Edee1F18E0157C05861564`
  - Futarchy Factory: `0xF869237A00937eC7c497620d64e7cbEBdFdB3804`
  - Default Adapter (FutarchyRouter): `0x11a1EA07a47519d9900242e1b30a529ECD65588a`
- USDC (native): `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359` (6 decimals)
- Example configs:
  - Minimal-liquidity new proposal: `config/test-minimal-liquidity-polygon-uniswapv3.json`
  - Use existing proposal: `config/test-existing-polygon.json`

Note on decimals: USDC on Polygon uses 6 decimals. The orchestrator automatically detects token decimals (via on-chain `decimals()`) and passes them into pricing and amount calculations for all pools, including conditional YES/NO currency tokens.

## CLI Commands and Modes

- create-proposal: `node cli.js create-proposal [config.json]`
- setup-pools: `node cli.js setup-pools <config.json> [manual|automatic|semi-automatic]`
- setup-auto: `node cli.js setup-auto <config.json>`
- setup-semi: `node cli.js setup-semi <config.json>`
- add-liquidity: `node cli.js add-liquidity <token0> <token1> <amount0> <amount1>`
- References:
  - `refactorCreateProposal/cli.js:200`

## Notes and Limitations

- Swap Router is configured but not used in current flows; all liquidity provisioning uses the Position Manager directly.
- `getPoolPrice` computes a floating price for display and verification. It does not handle token decimals explicitly because all pools use 18 decimals in the provided configs and minimal-liquidity tests. If integrating tokens with different decimals, price normalization should be revisited.
- The factory event ABI is minimal; log parsing may not find `ProposalCreated`. Fallback fetching is implemented.

## What Changed And Why It Works

- AMM selector: The CLI now reads `amm` from config (or chain defaults) and switches ABIs and call-shapes accordingly. This enables Uniswap V3 (Ethereum/Polygon) and Swapr/Algebra V3 (Gnosis) without code changes by the user.
  - Selector source: `refactorCreateProposal/contracts/constants.js:18`
  - Runtime switch: `refactorCreateProposal/modules/poolManager.js:6`
- Uniswap V3 support: Pool lookup, pool creation, minting, and price reads use Uniswap-specific functions and structs when `amm: "uniswap"`.
  - Factory lookup: `getPool(token0,token1,fee)`
  - Pool creation: `createAndInitializePoolIfNecessary(token0,token1,fee,sqrtPriceX96)`
  - Minting: includes `fee` in the mint params struct
  - Price read: `slot0().sqrtPriceX96`
- Decimals detection: The orchestrator now loads actual on-chain decimals for company/currency tokens, so USDC (6 decimals) is handled correctly.
  - `refactorCreateProposal/modules/liquidityOrchestrator.js:68`
- Fee tier: Configurable via `feeTier` (default 3000) and passed to pool lookup, creation, and mint for Uniswap.
  - `refactorCreateProposal/modules/liquidityOrchestrator.js:275`
  - `refactorCreateProposal/modules/poolManager.js:140, 206, 305, 343`

## ABI Differences: Uniswap V3 vs Swapr/Algebra V3

Uniswap V3
- Factory: `getPool(address token0,address token1,uint24 fee) view returns (address)`
- Pool: `slot0() view returns (uint160 sqrtPriceX96, int24 tick, ...)`
- NonfungiblePositionManager:
  - `createAndInitializePoolIfNecessary(address token0,address token1,uint24 fee,uint160 sqrtPriceX96) returns (address)`
  - `mint((address token0,address token1,uint24 fee,int24 tickLower,int24 tickUpper,uint256 amount0Desired,uint256 amount1Desired,uint256 amount0Min,uint256 amount1Min,address recipient,uint256 deadline)) returns (uint256 tokenId,uint128 liquidity,uint256 amount0,uint256 amount1)`

Swapr/Algebra V3
- Factory: `poolByPair(address token0,address token1) view returns (address)`
- Pool: `globalState() view returns (uint160 sqrtPriceX96, int24 tick, ...)`
- NonfungiblePositionManager:
  - `createAndInitializePoolIfNecessary(address token0,address token1,uint160 sqrtPriceX96) returns (address)`
  - `mint((address token0,address token1,int24 tickLower,int24 tickUpper,uint256 amount0Desired,uint256 amount1Desired,uint256 amount0Min,uint256 amount1Min,address recipient,uint256 deadline)) returns (uint256 tokenId,uint128 liquidity,uint256 amount0,uint256 amount1)`

The code paths select the correct variant at runtime based on `amm`.
- Factory lookup: `refactorCreateProposal/modules/poolManager.js:79`
- Pool price read: `refactorCreateProposal/modules/poolManager.js:112`
- Pool creation: `refactorCreateProposal/modules/poolManager.js:141`
- Mint struct: `refactorCreateProposal/modules/poolManager.js:250`

## Polygon (137) — Addresses To Verify On Polygonscan

- Uniswap V3 NonfungiblePositionManager: `0xC36442b4a4522E871399CD717aBDD847Ab11FE88`
- Uniswap V3 SwapRouter: `0xE592427A0AEce92De3Edee1F18E0157C05861564`
- FutarchyFactory: `0xF869237A00937eC7c497620d64e7cbEBdFdB3804`
- FutarchyRouter (Default Adapter): `0x11a1EA07a47519d9900242e1b30a529ECD65588a`
- USDC: `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174` (6 decimals)
- WETH: `0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619`

Where used in code
- Constants resolution: `refactorCreateProposal/contracts/constants.js:26`
- CLI prints active addresses: `refactorCreateProposal/cli.js:52`

## How Minting And Price Verification Work (Uniswap)

1) Pool existence check
- Calls `getPool(token0, token1, feeTier)` on Uniswap V3 factory.
- Code: `refactorCreateProposal/modules/poolManager.js:90`

2) Pool creation (if missing)
- Calls `createAndInitializePoolIfNecessary(token0, token1, feeTier, sqrtPriceX96)` on NFPM.
- Code: `refactorCreateProposal/modules/poolManager.js:151`

3) Minting liquidity
- Builds a mint struct including `fee: feeTier` and reordered amounts per AMM token order; then calls `mint`.
- Code: `refactorCreateProposal/modules/poolManager.js:250`

4) Price verification
- Reads `slot0().sqrtPriceX96`, converts to price `(sqrtPriceX96 / 2^96)^2`, adjusts for logical vs AMM order if needed.
- Code: `refactorCreateProposal/modules/poolManager.js:118`

## Polygonscan Verification Tips

- Transactions
  - Ensure function selectors match Uniswap V3: `createAndInitializePoolIfNecessary(address,address,uint24,uint160)` and `mint((...),uint24 fee,...)` in the input data (decoded on Polygonscan).
  - You should see Position Manager = `0xC364...` and Router = `0xE592...` when relevant.
- Pool
  - Read Contract → `slot0()` to get `sqrtPriceX96` and verify pricing math.
  - Check `token0()`/`token1()` addresses vs your logical order; if inverted, the CLI prints the logical price by inverting the AMM price.
- Futarchy
  - Verify Factory and FutarchyRouter addresses match: `0xF869...` and `0x11a1...`.
