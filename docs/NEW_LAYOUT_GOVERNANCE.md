# New Governance Layout – UX & Technical Reference

This document describes the new table-based governance layout for the `/companies` page, focusing on UX decisions, data filtering, and how active proposals are determined.

---

## Overview

The new layout replaces the card carousel with a **scannable table** optimized for governance dashboards (inspired by Tally/Snapshot).

| Column | Description |
|--------|-------------|
| **Logo** | Organization logo from metadata |
| **Name** | Org name + "ACTIVE MARKET" badge if has public proposals |
| **Active** | Count of public (visible) proposals |
| **Proposals** | Total proposal count |
| **Chain** | Ethereum (1) or Gnosis (100) badge |

---

## Active Proposals Logic

### Visibility Metadata

Proposals can have a `visibility` metadata entry:
- `visibility: "public"` → **Active** (shown to everyone)
- `visibility: "hidden"` → **Hidden** (only shown to owner/editor)
- **No visibility set** → Defaults to **public** (active)

### Counting Active Proposals

```javascript
const activeProposals = proposals.filter(proposal => {
    // Check metadataEntries for visibility key
    const visibilityEntry = proposal.metadataEntries?.find(e => e.key === 'visibility');
    const visibility = visibilityEntry?.value || 'public'; // Default to public
    return visibility !== 'hidden';
});
```

---

## Data Query: Aggregator-Scoped Proposals

### Why Filter by Aggregator?

The subgraph contains many `ProposalMetadata` contracts. We only want proposals that are:
1. **Linked to an Organization** (via `proposals` array)
2. **Organization is under the Default Aggregator** (`0xC5eB43D53e2FE5FddE5faf400CC4167e5b5d4Fc1`)

This ensures we only display curated, relevant proposals.

### GraphQL Query

```graphql
query GetAggregatorCompanies($aggregatorId: ID!) {
  aggregator(id: $aggregatorId) {
    id
    name
    description
    organizations {
      id
      name
      description
      metadata
      metadataURI
      owner
      proposals {
        id
        proposalAddress
        metadata
        metadataEntries {
          key
          value
        }
      }
    }
  }
}
```

**Variables:**
```json
{
  "aggregatorId": "0xc5eb43d53e2fe5fdde5faf400cc4167e5b5d4fc1"
}
```

### Query Filtering Hierarchy

```
Aggregator (0xC5eB...4Fc1)
  └── Organizations[] (Gnosis DAO, Aave DAO, CoW DAO, etc.)
        └── Proposals[] (only those linked to this org)
              └── metadataEntries[] (includes visibility)
```

This structure guarantees:
- **No orphan proposals** – Only proposals explicitly linked to an org are returned
- **No cross-aggregator leakage** – Only orgs under the default aggregator appear
- **Visibility is per-proposal** – Each proposal's `metadataEntries` is checked individually

---

## Chain Detection

Chain is stored in **organization metadata** (not proposal metadata):

```json
{
  "chain": "1",      // Ethereum
  "chain": "100"     // Gnosis
}
```

### Extraction in Hook

```javascript
const meta = parseMetadata(org.metadata);
const chainId = meta.chain ? parseInt(meta.chain, 10) : 100; // Default to Gnosis
```

---

## Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `OrganizationsTable` | `companyList/table/` | Main table with search, sort |
| `OrgRow` | `companyList/table/` | Single row with badges |
| `ChainBadge` | `companyList/components/` | ETH/Gnosis badge |
| `useAggregatorCompanies` | `hooks/` | Fetches and transforms data |

---

## UX Decisions

1. **Table over Cards** – Better scanability for 5+ organizations
2. **Sortable Columns** – Click headers to sort by Active, Proposals, Name
3. **Search Filter** – Quick name-based filtering
4. **Active Badge** – Visual indicator for orgs with public proposals
5. **Chain Badges** – Color-coded (blue=ETH, green=Gnosis)
6. **Mobile Fallback** – Carousel still used on mobile (`md:hidden`)

---

## Related Files

- [`useAggregatorCompanies.js`](../src/hooks/useAggregatorCompanies.js) – Data fetching hook
- [`OrganizationsTable.jsx`](../src/components/futarchyFi/companyList/table/OrganizationsTable.jsx)
- [`OrgRow.jsx`](../src/components/futarchyFi/companyList/table/OrgRow.jsx)
- [`CompaniesPage.jsx`](../src/components/futarchyFi/companyList/page/CompaniesPage.jsx)
