# Futarchy SDK CLI Guide

Interactive command-line interface for managing Futarchy organizations, proposals, and metadata.

## Quick Start

```bash
cd futarchy-complete-sdk
npm install
node cli.js
```

## Main Menu

```
? What would you like to do?
❯ 🚀 Create Actual Proposal
  🏢 Manage Organizations
  ➕ Create Organization
  🗑️ Remove Organization
  ✏️ Edit Aggregator
  🔍 Explore Metadata
  ➕ Add Proposal Metadata
  ❌ Exit
```

---

## Organization Management

### Aggregator Selection
Enter the Aggregator contract address (default: `0xC5eB43D53e2FE5FddE5faf400CC4167e5b5d4Fc1`)

### Organization Actions

```
? Organization: Gnosis
❯ 📄 List Proposals    
  🔗 Link Existing Proposal (Subgraph)
  ▶️ Add Proposal (New)
  🗑️ Remove Proposal
  ✏️ Edit Organization
  🔙 Back
```

---

## Proposal Operations

### 📄 List Proposals

Displays all proposals linked to the organization with format:
```
metadataAddress(proposalAddress)
```

**Duplicate Detection**: If multiple metadata contracts point to the same proposal, a warning is shown:
```
⚠️  DUPLICATE METADATA DETECTED:
   0x45e10643... has 2 metadata contracts
   Each proposal should only have one metadata contract.
```

### Proposal Details View

When selecting a proposal, full details are displayed:

```
╭ Proposal Details ────────────────────────────────────────────╮
│   Name: What will the impact on GNO price be if GIP-145...   │
│   Proposal ID: 0x45e1064348fd8a407d6d1f59fc64b05f633b28fc    │
│   Metadata Contract: 0xa78a2d5844c653dac60da8a3f9ec958d09... │
│   Description: Will GIP-145...                               │
│   ----------------------------------------                   │
│   Chain ID: 100 (default-100)                                │
│   Owner: 0x645a3d9208523bbfee980f7269ac72c61dd3b552          │
│   Metadata URI: N/A                                          │
│   ----------------------------------------                   │
│   Base Tokens:                                               │
│   Company:  GNO  (0x9c58bacc...)                             │
│   Currency: sDAI (0xaf204776...)                             │
│   ----------------------------------------                   │
│   Outcome Tokens (by Role):                                  │
│   YES_COMPANY:  YES_GNO  (0x79832bef...)                     │
│   NO_COMPANY:   NO_GNO   (0xf44d9b29...)                     │
│   YES_CURRENCY: YES_sDAI (0xe014caac...)                     │
│   NO_CURRENCY:  NO_sDAI  (0xc1e894e6...)                     │
│   ----------------------------------------                   │
│   Pools (6 total):                                           │
│   COND_YES, COND_NO, PRED_YES, PRED_NO, EV_YES, EV_NO        │
╰──────────────────────────────────────────────────────────────╯
```

---

## Proposal Actions Menu

```
? Proposal Actions:
❯ ✏️ Edit Metadata
  📊 Export Candles & Trades
  🕯️ Export Candles Only
  💱 Export Trades Only
  🔙 Back
```

### ✏️ Edit Metadata

View current metadata values and options:
- **View Raw Metadata JSON**: Display full metadata object
- **Create New Metadata**: Opens the Add Proposal flow pre-filled with current values

> Note: Metadata is immutable on-chain. "Editing" creates a new metadata contract.

### 📊 Export Chart Data

Export candles and/or trades to JSON file:

```
? Start time (unix timestamp or leave empty for all): 
? Max candles to fetch: 500
? Max trades to fetch: 100
? Gap-fill missing candles? Yes
? Output filename: export_0x45e106_1769737939531.json
```

---

## Add Proposal Metadata

Create and link metadata for a proposal using ABI-aligned fields:

```
📝 Add Proposal Metadata
This links an existing proposal to the organization with display info.

? proposalAddress: 0x45e1064348fd8a407d6d1f59fc64b05f633b28fc
? displayNameQuestion: What will the impact on GNO price be
? displayNameEvent: if GIP-145 is approved?
? description: Will GIP-145 be approved...
? metadata (JSON): {"chain":"100"}
? metadataURI: 

╭──────────────────────────────────────
│ Metadata Summary
├──────────────────────────────────────
│ proposalAddress:      0x45e10643...
│ displayNameQuestion:  What will the impact on GNO price be
│ displayNameEvent:     if GIP-145 is approved?
│ description:          Will GIP-145...
│ metadata (JSON):      {"chain":"100"}
│ metadataURI:          
╰──────────────────────────────────────

? Save Proposal Metadata? Yes
⠋ Saving proposal metadata...
✔ Metadata saved successfully!
📋 Metadata Contract: 0xa78a2d5844c653dac60da8a3f9ec958d09a4ee6a
```

### ABI Field Mapping

| CLI Field | Smart Contract Field | Description |
|-----------|---------------------|-------------|
| `proposalAddress` | `proposalAddress` | Trading contract address |
| `displayNameQuestion` | `displayNameQuestion` | Full question text |
| `displayNameEvent` | `displayNameEvent` | Short event title |
| `description` | `description` | Optional description |
| `metadata` | `metadata` | JSON metadata string |
| `metadataURI` | `metadataURI` | IPFS or URL to external metadata |

---

## Create Organization

Create a new organization under an aggregator:

```
➕ Create Organization

? Aggregator Address: 0xC5eB43D53e2FE5FddE5faf400CC4167e5b5d4Fc1
? Company Name: My DAO
? Description: A new futarchy-enabled DAO
? Metadata JSON (optional): {"website": "https://example.com"}
? Metadata URI (optional): 
? Create organization "My DAO"? Yes
✔ Organization "My DAO" created!
📍 Organization Address: 0x1234567890abcdef...
🔗 https://gnosisscan.io/tx/0x...
```

---

## Remove Organization

Remove an organization from an aggregator:

```
🗑️ Remove Organization

⚠️  Warning: This will remove the organization from the aggregator.
The organization contract itself will still exist on-chain.

? Aggregator Address: 0xC5eB43D53e2FE5FddE5faf400CC4167e5b5d4Fc1
✔ Found 3 organizations
? Filter by name or address (0x...) or leave empty: 
? Select organization to remove:
❯ [0] Gnosis (0x818FdF72...)
  [1] Kleros Dao (0xcb9B0aEF...)
  🔙 Cancel
? ⚠️ REMOVE organization "Gnosis" at index 0? No
```

**Features:**
- Arrow-based selection (no manual index typing)
- Search filter by name or address
- Confirmation prompt defaults to No (safety)

---

## Remove Proposal

Remove a proposal from an organization (accessible from Organization menu):

```
🗑️ Remove Proposal

⚠️  Warning: This will remove the proposal from the organization.
The proposal contract itself will still exist on-chain.

✔ Found 6 proposals
? Filter by address (0x...) or leave empty to show all: 0xa84
  Filtered to 1 of 6
? Select proposal to remove:
❯ [4] 0xd121E954...(0xa84a931D...)
  🔙 Cancel
? ⚠️ REMOVE proposal at index 4? (0xd121E954a53E...) Yes
✔ ✅ Proposal removed from index 4
🔗 https://gnosisscan.io/tx/0x...
```

**Features:**
- Arrow-based selection
- Search filter by address or displayNameEvent
- Shows original index for transparency

---

## Edit Aggregator

Update the aggregator's name and description:

```
✏️ Edit Aggregator

? Aggregator Address: 0xC5eB43D53e2FE5FddE5faf400CC4167e5b5d4Fc1
? New Name: Futarchy Finance
? New Description: Main aggregator for prediction markets
? Update aggregator to "Futarchy Finance"? Yes
✔ ✅ Aggregator updated to "Futarchy Finance"
🔗 https://gnosisscan.io/tx/0x...
```

---

## Edit Organization

Update an organization's name and description (in Organization menu):

```
✏️ Edit Organization

Current Name: Gnosis
Address: 0x818FdF727aA4672c80bBFd47eE13975080AC40E5

? New Name: Gnosis DAO
? New Description: Gnosis governance proposals
? Update organization to "Gnosis DAO"? Yes
✔ ✅ Organization updated to "Gnosis DAO"
🔗 https://gnosisscan.io/tx/0x...
```

---

## Edit Proposal Info

Update a proposal's question, event name, and description (in Proposal Actions menu):

```
✏️ Edit Proposal Info

Current values:
  displayNameQuestion: What will the impact on GNO price be
  displayNameEvent: if GIP-145 is approved?
  description: Will GIP-145 be approved...

? displayNameQuestion: What will the impact on GNO price be
? displayNameEvent: if GIP-145 passes?
? description: Updated description for GIP-145
? Update proposal info? Yes
✔ ✅ Proposal metadata updated
🔗 https://gnosisscan.io/tx/0x...
```

> **Note:** This updates the on-chain metadata contract, not creating a new one.

---

## Link Existing Proposal (Subgraph)

Search and link proposals from the subgraph that aren't yet linked to the organization:

```
✔ Found 50 candidates
? Filter by keyword or 0x address: GIP-145
? Select Proposal to Link:
❯ 0x45e1064... - Will GIP-145 be approved?
  0x3d076d5... - Will GIP-146 be approved?
```

---

## Key Concepts

### Address Types

| Type | Description | Example |
|------|-------------|---------|
| **Proposal ID** | Trading/Logic Contract | `0x45e1064...` |
| **Metadata Contract** | Metadata storage contract | `0xa78a2d5...` |
| **Organization** | Organization contract | `0x818fdf7...` |
| **Aggregator** | Root aggregator contract | `0xC5eB43D...` |

### Data Sources

The CLI fetches from two subgraphs:

1. **Registry Subgraph** (`futarchy-complete-new-v3`)
   - Organization hierarchy
   - Metadata contracts
   - `displayNameQuestion`, `displayNameEvent`, `description`

2. **Market Subgraph** (`algebra-proposal-candles-v1`)
   - Trading data, tokens, pools
   - Candles and swap history

---

## Environment Variables

```env
PRIVATE_KEY=0x...  # Required for write operations (addProposal, etc.)
```

---

## Troubleshooting

### "proposalAddress is not defined"
This error may occur when navigating quickly. Restart the CLI.

### Candles/Trades show 0
- Check that start time is in the **past** (unix timestamp)
- Leave start time empty to fetch all data
- Verify the proposal has trading activity

### Duplicate Metadata Warning
If you see "DUPLICATE METADATA DETECTED", multiple metadata contracts exist for the same proposal. Only one should exist per proposal per organization.
