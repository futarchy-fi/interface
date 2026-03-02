# Futarchy Complete SDK

A modular SDK for interacting with Futarchy v2 smart contracts and subgraphs on Gnosis Chain.

## Quick Start

```bash
cd futarchy-complete-sdk
npm install
node cli.js
```

## Architecture

The SDK follows a **DataLayer → Executor → Cartridge** pattern:

```
┌─────────────────────────────────────────────────────────────┐
│                        DataLayer                            │
│   Orchestrates operations across multiple executors         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       ViemExecutor                          │
│   Handles blockchain interactions via viem                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  FutarchyCompleteCartridge                  │
│   Business logic for Futarchy operations                    │
└─────────────────────────────────────────────────────────────┘
```

## Operations

| Operation | Description |
|-----------|-------------|
| `futarchy.getOrganizations` | List organizations from an Aggregator |
| `futarchy.getProposals` | List proposals from an Organization |
| `futarchy.getProposalDetails` | Get full proposal details from dual subgraphs |
| `futarchy.addProposal` | Create and add proposal metadata |
| `futarchy.getLinkableProposals` | Search recent proposals for linking |

## Dual-Subgraph Architecture

The SDK fetches from **two subgraphs**:

### 1. Registry Subgraph (futarchy-complete-new v0.0.10)
- **URL**: `https://api.studio.thegraph.com/query/1719045/futarchy-complete-new/version/latest`
- **Purpose**: Organization hierarchy, ownership, metadata contracts
- **Key Fields**: `title`, `displayNameQuestion`, `displayNameEvent`, `description`, `owner`, `metadataURI`

### 2. Market Subgraph (algebra-proposals-candles)
- **URL**: `https://api.studio.thegraph.com/query/1718249/algebra-proposals-candles/version/latest`
- **Purpose**: Trading data, tokens, pools
- **Key Fields**: `companyToken`, `currencyToken`, `outcomeTokens`, `pools`

---

## ⚠️ Registry v0.0.10 Breaking Change (Jan 2026)

> **IMPORTANT**: The Registry Subgraph (`futarchy-complete-new`) schema changed in v0.0.10!

### Old Schema (Pre-v0.0.10)
```
ProposalEntity.id = Trading/Logic Contract Address
```

### New Schema (v0.0.10)
```
ProposalEntity.id = Metadata Contract Address
ProposalEntity.proposalAddress = Trading Contract Address
```

### How to Query

**To find a proposal by Trading Contract:**
```graphql
{
  proposalEntities(where: { proposalAddress: "0x3d076d5d..." }) {
    id                  # Metadata Contract (Registry ID)
    proposalAddress     # Trading Contract (what you searched for)
    title
    description
    organization { id name }
  }
}
```

**To find a proposal by Metadata Contract (direct lookup):**
```graphql
{
  proposalEntity(id: "0x3c109ec3...") {
    id
    proposalAddress
    title
  }
}
```

### Entity Hierarchy

```
Aggregator (0xC5eB...)
    └── Organization (0x818f...)
            └── ProposalEntity
                    ├── id: 0x3c109ec3...    (Metadata Contract)
                    └── proposalAddress: 0x3d076d5d...  (Trading Contract)
```

---

## Data Model

### Proposal Details Response

```json
{
  "address": "0x3d076d5d12341226527241f8a489d4a8863b73e5",
  "metadataContract": "0x3c109ec3c7eb7da835dd3b64f575efae7abfdf4e",
  "title": "Will GIP-145 be approved?",
  "question": "Will GIP-145 be approved?",
  "marketName": "GIP-145",
  "description": "Proposal to approve GIP-145...",
  "owner": "0x645a3d9208523bbfee980f7269ac72c61dd3b552",
  "chain": { "id": 100, "source": "default-100" },

  "baseTokens": {
    "company": { "symbol": "GNO", "address": "0x9c58bacc...", "decimals": "18" },
    "currency": { "symbol": "sDAI", "address": "0xaf204776...", "decimals": "18" }
  },

  "outcomeTokens": {
    "YES_COMPANY":  { "symbol": "YES_GNO",  "address": "0xfa759356..." },
    "NO_COMPANY":   { "symbol": "NO_GNO",   "address": "0x2c840672..." },
    "YES_CURRENCY": { "symbol": "YES_sDAI", "address": "0xf1dc3848..." },
    "NO_CURRENCY":  { "symbol": "NO_sDAI",  "address": "0x240c966c..." }
  },

  "pools": {
    "conditional": {
      "yes": { "address": "0xf738ad8c...", "token0": {...}, "token1": {...} },
      "no":  { "address": "0xfeabbe38...", "token0": {...}, "token1": {...} }
    },
    "prediction": {
      "yes": { "address": "0x94c85eda...", "token0": {...}, "token1": {...} },
      "no":  { "address": "0xc16f5c1e...", "token0": {...}, "token1": {...} }
    },
    "expectedValue": {
      "yes": { "address": "0x27f14942...", "token0": {...}, "token1": {...} },
      "no":  { "address": "0xd56131d3...", "token0": {...}, "token1": {...} }
    }
  },

  "poolCount": 6,

  "extra": {
    "metadataContract": "0x3c109ec3...",
    "organization": "Gnosis"
  }
}
```

### Outcome Token Roles

| Role | Description | Example Symbol |
|------|-------------|----------------|
| `YES_COMPANY` | Company token for YES outcome | `YES_GNO` |
| `NO_COMPANY` | Company token for NO outcome | `NO_GNO` |
| `YES_CURRENCY` | Currency token for YES outcome | `YES_sDAI` |
| `NO_CURRENCY` | Currency token for NO outcome | `NO_sDAI` |

### Pool Types

| Type | Description | Trading Pair |
|------|-------------|--------------|
| `CONDITIONAL` | YES/NO outcome pools | YES_sDAI ↔ YES_GNO, NO_sDAI ↔ NO_GNO |
| `PREDICTION` | Outcome probability pools | sDAI ↔ YES_sDAI, sDAI ↔ NO_sDAI |
| `EXPECTED_VALUE` | Expected value pools | sDAI ↔ YES_GNO, sDAI ↔ NO_GNO |

## Project Structure

```
futarchy-complete-sdk/
├── cli.js                     # Entry point
├── src/
│   ├── core/
│   │   ├── DataLayer.js       # Orchestration layer
│   │   └── BaseExecutor.js    # Executor base class
│   ├── executors/
│   │   └── ViemExecutor.js    # Blockchain executor (viem)
│   ├── cartridges/
│   │   └── FutarchyCompleteCartridge.js  # Business logic
│   ├── cli/
│   │   └── interactive.js     # Interactive CLI
│   └── config/
│       └── contracts.js       # Contract addresses & ABIs
└── tests/
    ├── debug_complete_config.js    # Full config test
    └── debug_outcome_tokens.js     # Role parsing test
```

## Environment Variables

```env
PRIVATE_KEY=0x...           # Optional: For write operations
RPC_URL=https://rpc.gnosischain.com  # Optional: Custom RPC
```

## Contract Addresses (Gnosis Chain)

| Contract | Address |
|----------|---------|
| Default Aggregator | `0xC5eB43D53e2FE5FddE5faf400CC4167e5b5d4Fc1` |
| Aggregator Factory | `0xe7C27c932C80D30c9aaA30A856c0062208d269b4` |
| Organization Factory | `0xCF3d0A6d7d85639fb012fA711Fef7286e6Db2808` |
| Proposal Factory | `0x899c70C37E523C99Bd61993ca434F1c1A82c106d` |

## CLI Usage

```bash
# Interactive mode (recommended)
node cli.js

# Direct commands
node cli.js list-orgs
node cli.js list-proposals <orgAddress>
node cli.js add-proposal <orgAddr> <propAddr> <question> <marketName>
```

## Integration with Frontend

The SDK's data model is compatible with `useContractConfig` hook. Use `subgraph-100` or `subgraph-1` as URL parameter:

```
/market?proposalId=0x3d076d5d...&useContractSource=subgraph-100
```

---

## Changelog

### v0.0.10 (Jan 2026)
- **BREAKING**: Registry Subgraph schema changed
  - `ProposalEntity.id` is now **Metadata Contract** address
  - `ProposalEntity.proposalAddress` is now **Trading Contract** address
- Updated SDK to query using `proposalEntities(where: { proposalAddress: ... })`
- Added `title`, `displayNameQuestion`, `displayNameEvent` fields from Registry
- Improved merge logic to prefer Registry metadata over on-chain JSON
