# Organization Aggregators

## Overview

In the Futarchy Fi ecosystem, an **Aggregator** is a high-level entity (managed via a subgraph and smart contracts) that groups multiple **Organizations** (or "Companies"). 

This allows the interface to dynamically load a specific set of companies by providing a single aggregator address. For example, a DAO might have its own aggregator that white-lists specific organizations.

---

## Technical Implementation

### Subgraph

The aggregator hierarchy is indexed by the `futarchy-complete` subgraph.

- **Endpoint:** `https://api.studio.thegraph.com/query/1719045/futarchy-complete-new/version/latest`
- **Key Entity:** `aggregator(id: ID!)`
- **Relationship:** One Aggregator has many Organizations.

### React Hook: `useAggregatorCompanies`

The primary way to interact with aggregators in the frontend is the `useAggregatorCompanies` hook.

```javascript
import { useAggregatorCompanies } from '@/hooks/useAggregatorCompanies';

const { companies, aggregatorName, loading, error } = useAggregatorCompanies(aggregatorAddress);
```

**Location:** `src/hooks/useAggregatorCompanies.js`

---

## URL Integration

The `CompaniesPage` component supports loading a specific aggregator via a URL parameter.

### Usage

Add `?useAggregator=0x...` to the companies page URL:

```
/companies?useAggregator=0x7179836363d6f763...
```

**How it works:**
1. `CompaniesPage.jsx` detects the parameter.
2. It passes the address to `CompaniesListCarousel`.
3. The carousel uses `useAggregatorCompanies` to fetch organizations from the subgraph.
4. Organizations are displayed with a "Subgraph" badge.

---

## Data Structure

### Aggregator Entity
```graphql
type Aggregator {
  id: ID!               # Contract address
  name: String
  description: String
  organizations: [Organization!]
}
```

### Organization Metadata
Organizations stored in the aggregator subgraph often have a JSON `metadata` field containing:
- `coverImage` / `logo`
- `colors` (primary/secondary)
- `website`, `twitter`, `discord`

The hook automatically parses this metadata and transforms it into the standard `CompaniesCard` format used by the UI.

---

## Key Files

| File | Purpose |
|------|---------|
| `src/hooks/useAggregatorCompanies.js` | Main hook for fetching data |
| `src/config/subgraphEndpoints.js` | Subgraph URL configuration |
| `src/components/futarchyFi/companyList/page/CompaniesPage.jsx` | Page that handles `?useAggregator` param |
| `src/components/futarchyFi/companyList/components/CompaniesListCarousel.jsx` | Display component for aggregated companies |
