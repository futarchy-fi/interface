# Futarchy Complete SDK - MCP Server Guide

A comprehensive Model Context Protocol (MCP) server that exposes the Futarchy v2 prediction markets SDK to AI assistants.

## Table of Contents

1. [Installation](#installation)
2. [Configuration](#configuration)
3. [Quick Start](#quick-start)
4. [Tools Reference](#tools-reference)
   - [Read Operations](#read-operations)
   - [Write Operations](#write-operations)
5. [Resources Reference](#resources-reference)
6. [Example Workflows](#example-workflows)
7. [Chain Configuration](#chain-configuration)
8. [Contract Addresses](#contract-addresses)
9. [Troubleshooting](#troubleshooting)

---

## Installation

### 1. Install Dependencies

```bash
cd futarchy-complete-sdk
npm install
npm install @modelcontextprotocol/sdk
```

### 2. Configure Environment

Create a `.env` file:

```env
# Required for WRITE operations (optional for read-only)
PRIVATE_KEY=0x...your_private_key...

# Optional: Custom RPC URLs
RPC_URL_GNOSIS=https://rpc.gnosischain.com
RPC_URL_MAINNET=https://eth.llamarpc.com
```

### 3. Add to Claude Desktop

Edit `~/.config/claude-desktop/config.json`:

```json
{
  "mcpServers": {
    "futarchy": {
      "command": "node",
      "args": ["/path/to/futarchy-complete-sdk/mcp-server.js"],
      "env": {
        "PRIVATE_KEY": "0x..."
      }
    }
  }
}
```

### 4. Verify Installation

```bash
# Test the server directly
node mcp-server.js
```

---

## Configuration

### Default Aggregator

The main Futarchy Finance aggregator on Gnosis Chain:

```
0xC5eB43D53e2FE5FddE5faf400CC4167e5b5d4Fc1
```

### Supported Chains

| Chain ID | Name | DEX | Subgraph |
|----------|------|-----|----------|
| **100** | Gnosis | Algebra/Swapr | `algebra-proposal-candles-v1` |
| **1** | Ethereum | Uniswap V3 | `uniswap-proposal-candles-v1` |

### Subgraph Endpoints

```
# Market Candles (Gnosis)
https://d3ugkaojqkfud0.cloudfront.net/subgraphs/name/algebra-proposal-candles-v1

# Market Candles (Ethereum)  
https://d3ugkaojqkfud0.cloudfront.net/subgraphs/name/uniswap-proposal-candles-v1

# Registry (Organizations, Proposals metadata)
https://d3ugkaojqkfud0.cloudfront.net/subgraphs/name/futarchy-complete-new-v3
```

---

## Quick Start

### Example 1: List All Organizations

**Prompt to AI:**
> "List all organizations in Futarchy Finance"

**Tool Call:**
```json
{
  "tool": "get_organizations",
  "arguments": {}
}
```

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "address": "0x818FdF727aA4672c80bBFd47eE13975080AC40E5",
      "name": "Gnosis",
      "description": "Gnosis governance proposals"
    },
    {
      "address": "0xcb9B0aEFa9DE988E0Eb69C188D8C5b9CE0d9D61a",
      "name": "Kleros Dao",
      "description": "Kleros governance"
    }
  ]
}
```

### Example 2: Get Proposal Details

**Prompt to AI:**
> "Show me details for proposal 0x45e1064348fd8a407d6d1f59fc64b05f633b28fc"

**Tool Call:**
```json
{
  "tool": "get_proposal_details",
  "arguments": {
    "proposalAddress": "0x45e1064348fd8a407d6d1f59fc64b05f633b28fc"
  }
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "address": "0x45e1064348fd8a407d6d1f59fc64b05f633b28fc",
    "question": "What will the impact on GNO price be if GIP-145 is approved?",
    "marketName": "GIP-145",
    "chain": { "id": 100, "source": "metadata" },
    "baseTokens": {
      "company": { "symbol": "GNO", "address": "0x9c58bacc..." },
      "currency": { "symbol": "sDAI", "address": "0xaf204776..." }
    },
    "outcomeTokens": {
      "YES_COMPANY": { "symbol": "YES_GNO", "address": "0x79832bef..." },
      "NO_COMPANY": { "symbol": "NO_GNO", "address": "0xf44d9b29..." },
      "YES_CURRENCY": { "symbol": "YES_sDAI", "address": "0xe014caac..." },
      "NO_CURRENCY": { "symbol": "NO_sDAI", "address": "0xc1e894e6..." }
    },
    "pools": {
      "conditional": {
        "yes": { "address": "0xf738ad8c..." },
        "no": { "address": "0xfeabbe38..." }
      },
      "prediction": {
        "yes": { "address": "0x94c85eda..." },
        "no": { "address": "0xc16f5c1e..." }
      },
      "expectedValue": {
        "yes": { "address": "0x27f14942..." },
        "no": { "address": "0xd56131d3..." }
      }
    },
    "poolCount": 6
  }
}
```

---

## Tools Reference

### Read Operations

#### `get_organizations`

List all organizations from an aggregator.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `aggregatorAddress` | string | No | `0xC5eB...4Fc1` | Aggregator contract |

**Example:**
```json
{
  "tool": "get_organizations",
  "arguments": {
    "aggregatorAddress": "0xC5eB43D53e2FE5FddE5faf400CC4167e5b5d4Fc1"
  }
}
```

---

#### `get_proposals`

List proposals from an organization.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `organizationAddress` | string | **Yes** | Organization contract address |

**Example:**
```json
{
  "tool": "get_proposals",
  "arguments": {
    "organizationAddress": "0x818FdF727aA4672c80bBFd47eE13975080AC40E5"
  }
}
```

**Response includes:**
- `metadataAddress` - ProposalMetadata contract
- `proposalAddress` - Trading contract
- `displayNameQuestion` - Full question
- `displayNameEvent` - Short event name

---

#### `get_proposal_details`

Get complete proposal details including tokens and pools.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `proposalAddress` | string | **Yes** | Trading contract address |

**Returns:**
- Base tokens (company + currency)
- Outcome tokens (YES/NO for each)
- All 6 pool addresses (conditional, prediction, expectedValue)
- Chain information
- Metadata (description, owner, metadataURI)

---

#### `get_organization_metadata`

Get organization metadata entries.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `organizationAddress` | string | **Yes** | Organization contract |

**Common metadata keys:**
- `logo` - Organization logo URL
- `banner` - Banner image URL
- `primaryColor` - Brand color (hex)
- `secondaryColor` - Accent color
- `website` - Organization website

---

#### `get_proposal_metadata`

Get proposal metadata entries.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `proposalAddress` | string | **Yes** | ProposalMetadata contract |

**Common metadata keys:**
- `chain` - Chain ID ("100" or "1")
- `closeTimestamp` - Unix timestamp for market close
- `coingecko_ticker` - GeckoTerminal ticker for SPOT price
- `startCandleUnix` - Start time for chart data

---

#### `get_aggregator_metadata`

Get aggregator details.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `aggregatorAddress` | string | No | Default aggregator | Aggregator contract |

---

#### `get_linkable_proposals`

Search recent proposals from the Market subgraph.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `chainId` | number | No | 100 | Chain ID |
| `limit` | number | No | 50 | Max results |

**Use case:** Find proposals that need to be linked to organizations.

---

#### `get_organizations_by_owner`

Find organizations owned by a wallet.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `ownerAddress` | string | **Yes** | Wallet address |

---

#### `verify_token`

Verify an ERC20 token.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `tokenAddress` | string | **Yes** | - | Token contract |
| `chainId` | number | No | 100 | Chain ID |

**Returns:** symbol, name, decimals

---

#### `get_pool_prices`

Get current YES/NO prices.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `proposalAddress` | string | **Yes** | - | Trading contract |
| `chainId` | number | No | 100 | Chain ID |

**Example Response:**
```json
{
  "status": "success",
  "data": {
    "yesPrice": 0.65,
    "noPrice": 0.35,
    "yesProbability": "65.0%",
    "noProbability": "35.0%",
    "yesPool": "0xf738ad8c...",
    "noPool": "0xfeabbe38..."
  }
}
```

---

#### `export_candles`

Export OHLCV candle data.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `proposalAddress` | string | **Yes** | - | Trading contract |
| `chainId` | number | No | 100 | Chain ID |
| `limit` | number | No | 500 | Max candles |
| `startTime` | number | No | all | Unix timestamp start |
| `gapFill` | boolean | No | true | Fill missing candles |

**Example:**
```json
{
  "tool": "export_candles",
  "arguments": {
    "proposalAddress": "0x45e1064348fd8a407d6d1f59fc64b05f633b28fc",
    "chainId": 100,
    "limit": 200,
    "gapFill": true
  }
}
```

---

#### `export_trades`

Export swap/trade history.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `proposalAddress` | string | **Yes** | - | Trading contract |
| `chainId` | number | No | 100 | Chain ID |
| `limit` | number | No | 100 | Max trades |
| `startTime` | number | No | all | Unix timestamp start |

---

### Write Operations

> ⚠️ **All write operations require `PRIVATE_KEY` environment variable.**

#### `add_proposal_metadata`

Create and link a ProposalMetadata contract to an organization.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `organizationAddress` | string | **Yes** | Organization to add to |
| `proposalAddress` | string | **Yes** | Trading contract to link |
| `displayNameQuestion` | string | **Yes** | Full question text |
| `displayNameEvent` | string | **Yes** | Short event name |
| `description` | string | No | Description |
| `metadata` | string | No | JSON string |
| `metadataURI` | string | No | IPFS/URL |

**Example:**
```json
{
  "tool": "add_proposal_metadata",
  "arguments": {
    "organizationAddress": "0x818FdF727aA4672c80bBFd47eE13975080AC40E5",
    "proposalAddress": "0x45e1064348fd8a407d6d1f59fc64b05f633b28fc",
    "displayNameQuestion": "What will the impact on GNO price be if GIP-145 is approved?",
    "displayNameEvent": "GIP-145",
    "metadata": "{\"chain\":\"100\",\"closeTimestamp\":\"1735689600\"}"
  }
}
```

---

#### `create_organization`

Create a new organization under an aggregator.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `aggregatorAddress` | string | No | Default | Aggregator contract |
| `companyName` | string | **Yes** | - | Organization name |
| `description` | string | No | - | Description |
| `metadata` | string | No | - | JSON metadata |
| `metadataURI` | string | No | - | IPFS/URL |

**Example:**
```json
{
  "tool": "create_organization",
  "arguments": {
    "companyName": "My DAO",
    "description": "A new futarchy-enabled DAO",
    "metadata": "{\"website\":\"https://mydao.xyz\"}"
  }
}
```

---

#### `create_actual_proposal`

Create a new trading proposal (prediction market).

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `chainId` | number | **Yes** | - | 100 or 1 |
| `marketName` | string | **Yes** | - | Market name |
| `companyTokenAddress` | string | **Yes** | - | Company token |
| `currencyTokenAddress` | string | **Yes** | - | Currency token |
| `category` | string | No | governance | crypto, governance, defi, other |
| `language` | string | No | en | en, es, fr, de |
| `minBond` | string | No | 1 ETH | Reality.eth min bond (wei) |
| `openingTime` | number | **Yes** | - | Resolution timestamp |

**Example (Gnosis):**
```json
{
  "tool": "create_actual_proposal",
  "arguments": {
    "chainId": 100,
    "marketName": "GIP-150",
    "companyTokenAddress": "0x9C58BAcC331c9aa871AFD802DB6379a98e80CEdb",
    "currencyTokenAddress": "0xaf204776c7245bF4147c2612BF6e5972Ee483701",
    "category": "governance",
    "openingTime": 1735689600
  }
}
```

---

#### `remove_organization`

Remove an organization from an aggregator.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `aggregatorAddress` | string | **Yes** | Aggregator contract |
| `organizationIndex` | number | **Yes** | Index (0-based) |

---

#### `remove_proposal`

Remove a proposal from an organization.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `organizationAddress` | string | **Yes** | Organization contract |
| `proposalIndex` | number | **Yes** | Index (0-based) |

---

#### `update_entity_metadata`

Update metadata on any entity with smart merge.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `entityType` | string | **Yes** | aggregator, organization, or proposal |
| `entityAddress` | string | **Yes** | Contract address |
| `key` | string | **Yes** | Metadata key |
| `value` | string | **Yes** | New value |

**Example:**
```json
{
  "tool": "update_entity_metadata",
  "arguments": {
    "entityType": "organization",
    "entityAddress": "0x818FdF727aA4672c80bBFd47eE13975080AC40E5",
    "key": "logo",
    "value": "https://example.com/logo.png"
  }
}
```

---

#### `update_organization_info`

Update organization name and description.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `organizationAddress` | string | **Yes** | Organization contract |
| `newName` | string | **Yes** | New name |
| `newDescription` | string | No | New description |

---

#### `update_aggregator_info`

Update aggregator name and description.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `aggregatorAddress` | string | **Yes** | Aggregator contract |
| `newName` | string | **Yes** | New name |
| `newDescription` | string | No | New description |

---

#### `update_proposal_info`

Update proposal display fields.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `proposalMetadataAddress` | string | **Yes** | Metadata contract |
| `displayNameQuestion` | string | No | New question |
| `displayNameEvent` | string | No | New event name |
| `description` | string | No | New description |

---

#### `add_existing_metadata`

Link an existing ProposalMetadata contract to an organization.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `organizationAddress` | string | **Yes** | Organization contract |
| `metadataAddress` | string | **Yes** | Existing metadata contract |

---

## Resources Reference

Access configuration via MCP resources:

| URI | Description |
|-----|-------------|
| `futarchy://config/aggregator` | Default aggregator address and info |
| `futarchy://config/chains` | Chain configs (RPC, factories, tokens) |
| `futarchy://config/subgraphs` | Subgraph endpoint URLs |
| `futarchy://config/pool-types` | Pool type definitions |

---

## Example Workflows

### Workflow 1: Discover and Analyze a Market

```
1. User: "Show me all Gnosis proposals"
   → get_organizations → get_proposals (Gnosis org)

2. User: "What's the current prediction for GIP-145?"
   → get_pool_prices (proposal address)
   
3. User: "Show me the price history"
   → export_candles (with gapFill: true)
```

### Workflow 2: Link a New Proposal

```
1. User: "Find recent unlinked proposals"
   → get_linkable_proposals

2. User: "Link proposal 0x45e... to Gnosis"
   → add_proposal_metadata (with org and proposal addresses)

3. User: "Set the chain metadata to 100"
   → update_entity_metadata (key: "chain", value: "100")
```

### Workflow 3: Create a New Organization

```
1. User: "Create a new org called 'My DAO'"
   → create_organization

2. User: "Add a logo to the organization"
   → update_entity_metadata (key: "logo")

3. User: "Create a prediction market for 'Will MIP-1 pass?'"
   → create_actual_proposal
   → add_proposal_metadata
```

### Workflow 4: Export Data for Analysis

```
1. User: "Export all candles for proposal 0x45e..."
   → export_candles (limit: 1000, gapFill: true)

2. User: "Also get the trade history"
   → export_trades (limit: 500)

3. User: "What are the current prices?"
   → get_pool_prices
```

---

## Chain Configuration

### Gnosis Chain (100)

```javascript
{
  id: 100,
  name: 'Gnosis',
  rpcUrl: 'https://rpc.gnosischain.com',
  factoryAddress: '0xa6cB18FCDC17a2B44E5cAd2d80a6D5942d30a345',
  explorerUrl: 'https://gnosisscan.io',
  defaultTokens: {
    company: { address: '0x9C58BAcC331c9aa871AFD802DB6379a98e80CEdb', symbol: 'GNO' },
    currency: { address: '0xaf204776c7245bF4147c2612BF6e5972Ee483701', symbol: 'sDAI' }
  }
}
```

### Ethereum Mainnet (1)

```javascript
{
  id: 1,
  name: 'Ethereum',
  rpcUrl: 'https://ethereum.publicnode.com',
  factoryAddress: '0xf9369c0F7a84CAC3b7Ef78c837cF7313309D3678',
  explorerUrl: 'https://etherscan.io',
  defaultTokens: {
    company: { address: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9', symbol: 'AAVE' },
    currency: { address: '0xdC035D45d973E3EC169d2276DDab16f1e407384F', symbol: 'Currency' }
  }
}
```

---

## Contract Addresses

### Core Contracts (Gnosis)

| Contract | Address |
|----------|---------|
| Default Aggregator | `0xC5eB43D53e2FE5FddE5faf400CC4167e5b5d4Fc1` |
| Aggregator Factory | `0xe7C27c932C80D30c9aaA30A856c0062208d269b4` |
| Organization Factory | `0xCF3d0A6d7d85639fb012fA711Fef7286e6Db2808` |
| Proposal Metadata Factory | `0x899c70C37E523C99Bd61993ca434F1c1A82c106d` |
| Proposal Factory | `0xa6cB18FCDC17a2B44E5cAd2d80a6D5942d30a345` |

### Trading Contracts (Gnosis)

| Contract | Address |
|----------|---------|
| Algebra Quoter | `0xcBaD9FDf0D2814659Eb26f600EFDeAF005Eda0F7` |
| Swapr V3 Router | `0xffb643e73f280b97809a8b41f7232ab401a04ee1` |
| Futarchy Router | `0x7495a583ba85875d59407781b4958ED6e0E1228f` |

### Known Organizations

| Name | Address (Gnosis) |
|------|------------------|
| Gnosis | `0x818FdF727aA4672c80bBFd47eE13975080AC40E5` |
| Kleros Dao | `0xcb9B0aEFa9DE988E0Eb69C188D8C5b9CE0d9D61a` |

---

## Troubleshooting

### "No wallet connected"

Write operations require `PRIVATE_KEY` in environment:

```bash
PRIVATE_KEY=0x... node mcp-server.js
```

### "Operation not supported"

Check that the operation name matches exactly. Use `get_organizations` not `getOrganizations`.

### "Proposal not found"

- Ensure you're using the correct chain ID
- Trading contracts and metadata contracts have different addresses
- Try `get_linkable_proposals` to search by address

### "Transaction failed"

- Check that your wallet has sufficient gas (xDAI on Gnosis)
- Verify you have owner/editor permissions on the contract
- Check the explorer URL in the error response

### Empty candle data

- The proposal may not have any trading activity yet
- Check that `startTime` (if specified) is in the past
- Try without `startTime` to fetch all available data

### Subgraph errors

- CloudFront endpoints may have brief outages
- Try again after a few seconds
- Check The Graph Studio for subgraph health

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    MCP Server                           │
│                  (mcp-server.js)                        │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                     DataLayer                           │
│           Orchestrates all operations                   │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    ViemExecutor                         │
│    Handles blockchain interactions via viem            │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              FutarchyCompleteCartridge                  │
│     Business logic for all Futarchy operations         │
└─────────────────────────────────────────────────────────┘
                          │
          ┌───────────────┴───────────────┐
          ▼                               ▼
┌──────────────────────┐    ┌──────────────────────┐
│   Registry Subgraph  │    │   Market Subgraph    │
│  (futarchy-complete) │    │  (algebra/uniswap)   │
│                      │    │                      │
│  - Organizations     │    │  - Candles           │
│  - Proposals         │    │  - Trades            │
│  - Metadata          │    │  - Pools             │
└──────────────────────┘    └──────────────────────┘
```

---

## Version History

### v1.0.0 (Feb 2026)
- Initial MCP server release
- 22 tools covering read and write operations
- 4 configuration resources
- Support for Gnosis (100) and Ethereum (1) chains
- Integrated with futarchy-complete-sdk DataLayer pattern
