# Futarchy Complete SDK — Usage Guide

## Setup

```bash
cd futarchy-complete-sdk
npm install
cp .env.example .env  # or create .env manually
```

### `.env` Configuration

```env
# Required for write operations (create proposals, pools, metadata)
PRIVATE_KEY=0xYourPrivateKeyHere

# Optional — defaults to public RPCs
RPC_URL=https://rpc.gnosischain.com
```

---

## Three Ways to Use the SDK

### 1. CLI (Command Line)

```bash
node cli.js <command> [args]
```

| Command | Usage |
|---|---|
| `list-orgs` | `node cli.js list-orgs` |
| `list-proposals` | `node cli.js list-proposals <orgAddress>` |
| `add-proposal` | `node cli.js add-proposal <orgAddr> <proposalAddr> <question> <marketName>` |
| `create-pool` | `node cli.js create-pool <proposalAddr> <poolType> <initialPrice> [chainId]` |

### 2. MCP Server (for AI Assistants)

The MCP server exposes all SDK operations as tools that AI assistants (Claude, Gemini, etc.) can call:

```bash
node mcp-server.js
```

Configure in your AI assistant's MCP settings:
```json
{
  "futarchy": {
    "command": "node",
    "args": ["/path/to/futarchy-complete-sdk/mcp-server.js"],
    "env": {
      "PRIVATE_KEY": "0xYourKey"
    }
  }
}
```

**Available MCP Tools:**

| Tool | Type | Description |
|---|---|---|
| `get_organizations` | READ | List orgs in aggregator |
| `get_proposals` | READ | List proposals in org |
| `get_proposal_details` | READ | Full proposal with tokens, pools |
| `get_pool_prices` | READ | YES/NO probability prices |
| `export_candles` | READ | OHLCV candle data |
| `export_trades` | READ | Swap history |
| `create_actual_proposal` | WRITE | Create proposal via factory |
| `add_proposal_metadata` | WRITE | Link proposal to org |
| `create_pool` | WRITE | Create missing pool |
| `update_entity_metadata` | WRITE | Update metadata on any entity |
| `remove_proposal` | WRITE | Remove proposal from org |

### 3. Programmatic (JavaScript)

```javascript
import { DataLayer } from './src/core/DataLayer.js';
import { ViemExecutor } from './src/executors/ViemExecutor.js';
import { FutarchyCompleteCartridge } from './src/cartridges/FutarchyCompleteCartridge.js';
import dotenv from 'dotenv';
dotenv.config();

const dl = new DataLayer();
const ex = new ViemExecutor();
const cart = new FutarchyCompleteCartridge();
ex.registerCartridge(cart);
dl.registerExecutor(ex);

// All operations are async generators
for await (const update of dl.execute('futarchy.getProposalDetails', {
    proposalAddress: '0x47c80f5f701ebc5f25cab64e660f0577890729c2'
})) {
    if (update.status === 'success') {
        console.log(update.data);
    }
}
```

---

## Multi-Chain Support

The SDK supports **Gnosis (100)** and **Ethereum (1)** with different AMMs:

| | Gnosis (Chain 100) | Ethereum (Chain 1) |
|---|---|---|
| **AMM** | Algebra (Swapr) | Uniswap V3 |
| **Fee Tier** | Dynamic (none needed) | Fixed (default: 3000) |
| **Position Manager** | `0x91fd594c...` | `0xC36442b4...` |
| **Pool Factory** | Algebra internal | `0x1F984...` |
| **Default Company Token** | GNO | AAVE |
| **Default Currency Token** | sDAI | Currency |
| **Gas Limit** | ~16M (higher for Algebra) | ~5M |

The `chainId` parameter controls which chain is used. Default is `100` (Gnosis).

---

## Pool Creation

Proposals have **6 possible pools**. Each pairs different tokens:

| Pool Type | Token0 | Token1 | Purpose |
|---|---|---|---|
| `CONDITIONAL_YES` | YES_Company | YES_Currency | Main YES trading pool |
| `CONDITIONAL_NO` | NO_Company | NO_Currency | Main NO trading pool |
| `PREDICTION_YES` | YES_Currency | Currency (sDAI) | YES probability price |
| `PREDICTION_NO` | NO_Currency | Currency (sDAI) | NO probability price |
| `EXPECTED_VALUE_YES` | YES_Company | Currency (sDAI) | YES expected value |
| `EXPECTED_VALUE_NO` | NO_Company | Currency (sDAI) | NO expected value |

### Creating Pools via CLI

```bash
# Create conditional YES pool at GNO spot price 100.70
node cli.js create-pool 0x47c80f5... CONDITIONAL_YES 100.70

# Create conditional NO pool (same spot price)
node cli.js create-pool 0x47c80f5... CONDITIONAL_NO 100.70

# Create on Ethereum (chain 1) with Uniswap V3
node cli.js create-pool 0xABC123... CONDITIONAL_YES 2500 1
```

### Creating Pools via MCP

```
create_pool(
  proposalAddress: "0x47c80f5...",
  poolType: "CONDITIONAL_YES",
  initialPrice: 100.70,
  chainId: 100
)
```

### What `initialPrice` Means

- For **CONDITIONAL** pools: the spot price of Company/Currency (e.g., GNO in sDAI terms — ~100-130)
- For **PREDICTION** pools: probability as a price (e.g., 0.5 = 50% chance)
- For **EXPECTED_VALUE** pools: expected value price of outcome token in currency

### How It Works Under the Hood

1. Fetches proposal details (tokens, existing pools) from subgraph
2. Determines token0/token1 based on pool type
3. Orders tokens by address (AMM requirement: lower address = token0)
4. Calculates `sqrtPriceX96` from price, adjusting for token reorder
5. Calls `positionManager.createAndInitializePoolIfNecessary()`
   - **Algebra** (Gnosis): `(token0, token1, sqrtPriceX96)` — no fee tier
   - **Uniswap V3** (Ethereum): `(token0, token1, fee, sqrtPriceX96)` — with fee tier
6. Extracts pool address from `Initialize(uint160,int24)` event in receipt

---

## Typical Workflow

### Create a new Futarchy market end-to-end:

```bash
# 1. Create the proposal (on-chain trading contract)
#    MCP: create_actual_proposal(chainId, marketName, companyToken, currencyToken, openingTime)
#    CLI: use interactive mode -> "Create Actual Proposal"

# 2. Link proposal to an organization with metadata
#    MCP: add_proposal_metadata(orgAddress, proposalAddress, question, eventName, metadata)

# 3. Create the conditional pools (YES and NO)
node cli.js create-pool <proposalAddr> CONDITIONAL_YES <spotPrice>
node cli.js create-pool <proposalAddr> CONDITIONAL_NO <spotPrice>

# 4. (Optional) Create prediction and expected value pools
node cli.js create-pool <proposalAddr> PREDICTION_YES 0.5
node cli.js create-pool <proposalAddr> PREDICTION_NO 0.5

# 5. Verify
#    MCP: get_proposal_details(proposalAddress) → check pools section
```

---

## Key Addresses

| Entity | Address |
|---|---|
| Default Aggregator | `0xC5eB43D53e2FE5FddE5faf400CC4167e5b5d4Fc1` |
| Gnosis DAO Org | `0x3Fd2e8E71f75eED4b5c507706c413E33e0661bBf` |
| Gnosis Proposal Factory | `0xa6cB18FCDC17a2B44E5cAd2d80a6D5942d30a345` |
| Ethereum Proposal Factory | `0xf9369c0F7a84CAC3b7Ef78c837cF7313309D3678` |
| Gnosis Position Manager (Algebra) | `0x91fd594c46d8b01e62dbdebed2401dde01817834` |
| Ethereum Position Manager (UniV3) | `0xC36442b4a4522E871399CD717aBDD847Ab11FE88` |

## Subgraph Endpoints

| Subgraph | Purpose |
|---|---|
| Registry (futarchy-complete-new-v3) | Organizations, proposals, metadata |
| Market (algebra-proposal-candles-v1) | Trading data, tokens, pools, candles |
