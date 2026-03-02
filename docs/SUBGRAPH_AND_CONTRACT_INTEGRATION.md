# Subgraph & Contract Integration Documentation

## Overview

This document details the complete integration of the Futarchy v2 architecture, covering the **One-Stop Shop Subgraph**, **v2 Smart Contracts**, and the **Frontend Management UI**.

---

## 1. System Architecture

The system follows a hierarchical structure:

1.  **Aggregator** (Top Level): A registry of Organizations.
    *   *Contracts*: `AggregatorMetadata.sol`
    *   *Role*: Groups multiple DAOs/Companies under one interface (e.g., "Futarchy" aggregator containing "Gnosis", "DXdao", etc.).
2.  **Organization** (Mid Level): A company or DAO.
    *   *Contracts*: `OrganizationMetadata.sol`
    *   *Role*: Owns a list of Proposals.
3.  **Proposal** (Leaf Level): A specific market or decision event.
    *   *Contracts*: `ProposalMetadata.sol`
    *   *Role*: Links to the underlying prediction market (or "Pool").

### Default Configuration
*   **Chain**: Gnosis Chain (ID: 100)
*   **Default Aggregator**: `0xC5eB43D53e2FE5FddE5faf400CC4167e5b5d4Fc1`
    *   *Source*: `contracts.js`

---

## 2. Smart Contracts (v2)

All contract interactions are centralized in `src/components/futarchyFi/marketPage/constants/contracts.js`.

### Key Addresses (Gnosis Chain)
| Contract | Address |
| :--- | :--- |
| **Aggregator Factory** | `0xe7C27c932C80D30c9aaA30A856c0062208d269b4` |
| **Organization Factory** | `0xCF3d0A6d7d85639fb012fA711Fef7286e6Db2808` |
| **Proposal Factory** | `0x899c70C37E523C99Bd61993ca434F1c1A82c106d` |

### Key ABIs & Functions

#### Aggregator (`AGGREGATOR`)
*   `createAndAddOrganizationMetadata(name, desc, metadata, uri)`: **1-tx** creation of a new Organization and adding it to the list.
*   `removeOrganizationMetadata(index)`: Removes an organization by its index in the array.
*   `transferOwnership(newOwner)`: Transfers admin rights.
*   `setEditor(address)` / `revokeEditor()`: Manages operational permissions.

#### Organization (`ORGANIZATION`)
*   `createAndAddProposalMetadata(proposalAddr, question, event, desc, metadata, uri)`: **1-tx** creation of a new Proposal and adding it.
*   `removeProposalMetadata(index)`: Removes a proposal by its index.
*   `transferOwnership(newOwner)`: Transfers admin rights.

---

## 3. Subgraph Integration

The **Futarchy Complete New** subgraph indexes this entire hierarchy, enabling efficient querying without reading contract arrays iteratively.

### Endpoint
*   **URL**: `https://api.studio.thegraph.com/query/1719045/futarchy-complete-new/version/latest`
*   **File**: `src/config/subgraphEndpoints.js`

### Data Fetching Strategy (`OrganizationManagerModal.jsx`)

The frontend uses a precise GraphQL query to fetch the hierarchy. A critical optimization is fetching the `metadataContract` field for proposals to ensure reliable removal.

**Query (Organization Mode):**
```graphql
{
  organization(id: "0x...") {
    id
    name
    description
    metadata
    owner
    editor
    proposals {
      id              # The Market Address (what users see)
      metadataContract # The Metadata Contract Address (used for Logic/Removal)
    }
  }
}
```

### Why `metadataContract`?
*   **Display**: The UI shows the Market ID (`id`) for linking/sharing.
*   **Logic**: The `removeProposalMetadata` function works on the *Metadata Contract* itself. The subgraph maps these together, allowing the UI to say "Remove Market X" and look up "Metadata Contract Y" to find the correct on-chain index.

---

## 4. Frontend Management UI

The **Organization Manager Modal** (`OrganizationManagerModal.jsx`) is the central control panel.

### Features
1.  **Overview Tab**: View high-level details (Owner, Editor, raw Metadata JSON).
2.  **Content Tab**:
    *   **List View**: Shows all indexed items.
        *   *Removal*: Users click 'Trash'. The logic finds the item's on-chain index using the `metadataContract` (if available) or falls back to resolving names.
    *   **Create View**:
        *   *Aggregator Mode*: Create new Organization.
        *   *Organization Mode*: Link existing generic Proposal (searchable by name).
3.  **Settings Tab**:
    *   **Transfer Ownership**: Critical for handing off DAOs to client wallets.
    *   **Manage Editor**: Allows a distinct "Operator" wallet to manage content without full ownership risks.

### Flow: Adding a Proposal
1.  User opens Modal -> Content -> "Add Proposal".
2.  User searches for an existing market (e.g., "Will ETH hit 3k?").
3.  User selects it. The modal autofills the target address.
4.  User fills in metadata (Question, Event Name, Description).
5.  User clicks "Link Proposal (1-Tx)".
6.  **Contract Call**: `ORGANIZATION.createAndAddProposalMetadata(...)`
    *   Deploys `ProposalMetadata` contract.
    *   Adds it to the Organization's list.
    *   Emits `ProposalCreatedAndAdded` event.
7.  **Indexing**: Subgraph picks up the event and indexes the new Proposal under the Organization.
8.  **UI Update**: Modal auto-refreshes (via `useWaitForTransactionReceipt`) and shows the new item.

### Flow: Removing a Proposal
1.  User clicks "Remove" on an item.
2.  **Lookup**: Logic reads the Organization's `getProposals` array on-chain.
    *   It looks for the address matching `item.metadataContract` (from Subgraph).
3.  **Transaction**: Calls `ORGANIZATION.removeProposalMetadata(index)`.
4.  **Indexing**: Subgraph sees removal and deletes the entity link.
5.  **UI Update**: Item disappears from list.

---

## 5. Integration Points

*   **`CompaniesPage.jsx`**:
    *   Loads Aggregator data.
    *   Passes `aggregatorAddress` to the carousel.
    *   Button: "Manage Aggregator" (opens Modal in AGGREGATOR mode).
*   **`ProposalsPage.jsx`**:
    *   Loads Organization data.
    *   Checks if current user is Owner/Editor to show controls.
    *   Button: "Manage Organization" (opens Modal in ORGANIZATION mode).
