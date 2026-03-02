# Companies Table Setup Guide
## Using Supabase `companies` Table Instead of market_event

> **Goal:** Store company data in dedicated `companies` table with images in metadata JSON

---

## Current Table Structure

Based on Supabase schema:

```sql
companies (
  id UUID PRIMARY KEY,
  name TEXT,
  slug TEXT,
  description TEXT,
  metadata JSONB,  -- ✅ Store images and other data here
  is_hidden BOOLEAN (if exists)
)
```

---

## Metadata JSON Structure

### Recommended Format

```json
{
  "image": "https://cdn.example.com/gnosis-logo.png",
  "logo": "/assets/gnosis-dao-logo.png",
  "banner": "/assets/gnosis-company-bg.png",
  "colors": {
    "primary": "#4F46E5",
    "secondary": "#7C3AED"
  },
  "currency_token": "GNO",
  "website": "https://gnosis.io",
  "social": {
    "twitter": "@gnosisDAO",
    "discord": "https://discord.gg/gnosis"
  },
  "stats": {
    "founded": "2015",
    "employees": "50-100"
  }
}
```

### Minimal Format (Just Images)

```json
{
  "image": "/assets/gnosis-dao-logo.png"
}
```

---

## Insert Data for Current Companies

### Company ID Mapping

First, we need to map the integer company IDs (9, 10, 11, 12) to UUIDs in the companies table.

Let me check what IDs exist:

```sql
-- Check existing companies
SELECT id, name, slug, metadata FROM companies;
```

### Insert Company 9 (Gnosis DAO)

```sql
-- If using UUID from screenshot: 125c1bc5-24ac-40a8-9b12-012c16ad980a
UPDATE companies
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{image}',
  '"/assets/gnosis-dao-logo.png"'::jsonb
)
WHERE id = '125c1bc5-24ac-40a8-9b12-012c16ad980a';

-- Or set full metadata:
UPDATE companies
SET metadata = '{
  "image": "/assets/gnosis-dao-logo.png",
  "logo": "/assets/gnosis-dao-logo.svg",
  "banner": "/assets/gnosis-company-bg.png",
  "currency_token": "GNO",
  "website": "https://gnosis.io"
}'::jsonb
WHERE name = 'Gnosis';
```

### Insert Company 10 (Kleros)

```sql
UPDATE companies
SET metadata = '{
  "image": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQyIR2uIantnjRlVbeUGiDe35Pcg6ku-lgLcw&s",
  "currency_token": "PNK",
  "website": "https://kleros.io"
}'::jsonb
WHERE name = 'Kleros';
```

### Insert Company 11 (Tesla)

```sql
UPDATE companies
SET metadata = '{
  "image": "/assets/ceos/ceos-companies-logo/tesla.png",
  "banner": "/assets/tesla_company.webp",
  "currency_token": "TSLA",
  "website": "https://tesla.com"
}'::jsonb
WHERE name = 'Tesla';
```

### Insert Company 12 (Starbucks)

```sql
UPDATE companies
SET
  metadata = '{
    "image": "https://futarchy-assets.s3.eu-north-1.amazonaws.com/Starbucks_logo.svg",
    "currency_token": "SBUX",
    "website": "https://starbucks.com"
  }'::jsonb,
  is_hidden = true  -- Mark as hidden if column exists
WHERE name = 'Starbucks';
```

---

## Map Integer IDs to UUIDs

We need a mapping from old integer IDs (9, 10, 11, 12) to new UUIDs.

### Option 1: Add `company_number` Field

```sql
-- Add column to store integer ID for backward compatibility
ALTER TABLE companies ADD COLUMN company_number INTEGER UNIQUE;

-- Set values
UPDATE companies SET company_number = 9 WHERE name = 'Gnosis';
UPDATE companies SET company_number = 10 WHERE name = 'Kleros';
UPDATE companies SET company_number = 11 WHERE name = 'Tesla';
UPDATE companies SET company_number = 12 WHERE name = 'Starbucks';
```

### Option 2: Store in Metadata

```sql
UPDATE companies
SET metadata = jsonb_set(
  metadata,
  '{company_id}',
  '9'::jsonb
)
WHERE name = 'Gnosis';

UPDATE companies
SET metadata = jsonb_set(
  metadata,
  '{company_id}',
  '10'::jsonb
)
WHERE name = 'Kleros';

UPDATE companies
SET metadata = jsonb_set(
  metadata,
  '{company_id}',
  '11'::jsonb
)
WHERE name = 'Tesla';

UPDATE companies
SET metadata = jsonb_set(
  metadata,
  '{company_id}',
  '12'::jsonb
)
WHERE name = 'Starbucks';
```

---

## Example: Complete Company Entry

```json
{
  "id": "125c1bc5-24ac-40a8-9b12-012c16ad980a",
  "name": "Gnosis",
  "slug": "gnosis",
  "description": "Gnosis blockchain company",
  "metadata": {
    "company_id": 9,
    "image": "/assets/gnosis-dao-logo.png",
    "logo": "/assets/gnosis-dao-logo.svg",
    "banner": "/assets/gnosis-company-bg.png",
    "currency_token": "GNO",
    "website": "https://gnosis.io",
    "colors": {
      "primary": "#4F46E5"
    }
  }
}
```

---

## Frontend Changes Needed

### 1. Create New Hook: `useCompaniesTable`

**File:** `src/hooks/useCompaniesTable.js`

```javascript
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export function useCompaniesTable() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchCompanies() {
      try {
        const { data, error } = await supabase
          .from('companies')
          .select('*')
          .order('name', { ascending: true });

        if (error) throw error;

        console.log('[useCompaniesTable] Fetched companies:', data);
        setCompanies(data);
      } catch (err) {
        console.error('[useCompaniesTable] Error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchCompanies();
  }, []);

  return { companies, loading, error };
}
```

### 2. Transform Data for UI

```javascript
function transformCompanyData(companyRow) {
  const metadata = companyRow.metadata || {};

  return {
    companyID: metadata.company_id || companyRow.id,
    id: companyRow.id, // UUID
    name: companyRow.name,
    title: companyRow.name,
    description: companyRow.description,
    slug: companyRow.slug,

    // Images from metadata
    image: metadata.image || metadata.logo,
    logo: metadata.logo || metadata.image,
    banner: metadata.banner,

    // Other data
    currency_token: metadata.currency_token,
    website: metadata.website,
    colors: metadata.colors,

    // For backward compatibility
    stats: {
      proposals: 0, // Will be fetched separately
    }
  };
}
```

### 3. Update CompaniesDataTransformer

**File:** `CompaniesDataTransformer.jsx`

```javascript
import { createClient } from '@supabase/supabase-js';
import { getCompanyImage } from '../../../refactor/utils/imageUtils';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export const fetchAndTransformCompanies = async () => {
  try {
    // ✅ NEW: Fetch from companies table
    const { data: companies, error } = await supabase
      .from('companies')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;

    console.log('[CompaniesDataTransformer] Fetched from companies table:', companies);

    // Transform each company
    const transformedCompanies = await Promise.all(
      companies.map(async (company) => {
        const metadata = company.metadata || {};

        // Get image from metadata or generate fallback
        const imageUrl = metadata.image ||
                        metadata.logo ||
                        getCompanyImage({
                          name: company.name,
                          id: metadata.company_id
                        });

        // Get proposal count for this company
        const { count: proposalCount } = await supabase
          .from('market_event')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', metadata.company_id)
          .in('approval_status', ['ongoing', 'on_going']);

        return {
          companyID: metadata.company_id || company.id,
          title: company.name,
          description: company.description,
          image: imageUrl,
          proposals: proposalCount || 0,
          slug: company.slug,

          // Additional data from metadata
          currency_token: metadata.currency_token,
          website: metadata.website,
          colors: metadata.colors,
        };
      })
    );

    // Filter out companies with 0 proposals (auto-hide)
    const visibleCompanies = transformedCompanies.filter(c => c.proposals > 0);

    console.log('[CompaniesDataTransformer] Visible companies:', visibleCompanies);
    return visibleCompanies;

  } catch (error) {
    console.error('[CompaniesDataTransformer] Error:', error);
    return [];
  }
};
```

---

## Testing Steps

### 1. Insert Test Data

```sql
-- Add metadata to Gnosis company
UPDATE companies
SET metadata = '{
  "company_id": 9,
  "image": "/assets/gnosis-dao-logo.png",
  "currency_token": "GNO"
}'::jsonb
WHERE name = 'Gnosis';
```

### 2. Test Query

```sql
-- Verify data is correct
SELECT
  id,
  name,
  metadata->>'image' as image,
  metadata->>'company_id' as company_id
FROM companies;
```

**Expected Output:**
```
id                                   | name   | image                          | company_id
-------------------------------------|--------|--------------------------------|------------
125c1bc5-24ac-40a8-9b12-012c16ad980a | Gnosis | /assets/gnosis-dao-logo.png   | 9
```

### 3. Test in Frontend

```bash
npm run dev
# Visit: http://localhost:3000/companies
```

---

## Benefits of This Approach

### ✅ Pros
- **Dedicated companies table** (clean separation)
- **Flexible metadata** (add fields without migrations)
- **Easy to manage** (update images via Supabase UI)
- **Proper data model** (companies are separate from events)

### 🟡 Considerations
- **Need to map IDs** (integer company_id → UUID)
- **Two queries** (companies + proposal counts)
- **Migration needed** (populate metadata)

---

## Migration Script

Create this file to help populate data:

**File:** `scripts/migrate-companies-metadata.js`

```javascript
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // Use service key for admin access
);

const COMPANY_DATA = {
  'Gnosis': {
    company_id: 9,
    image: '/assets/gnosis-dao-logo.png',
    logo: '/assets/gnosis-dao-logo.svg',
    banner: '/assets/gnosis-company-bg.png',
    currency_token: 'GNO',
    website: 'https://gnosis.io'
  },
  'Kleros': {
    company_id: 10,
    image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQyIR2uIantnjRlVbeUGiDe35Pcg6ku-lgLcw&s',
    currency_token: 'PNK',
    website: 'https://kleros.io'
  },
  'Tesla': {
    company_id: 11,
    image: '/assets/ceos/ceos-companies-logo/tesla.png',
    banner: '/assets/tesla_company.webp',
    currency_token: 'TSLA',
    website: 'https://tesla.com'
  }
};

async function migrateMetadata() {
  for (const [companyName, metadata] of Object.entries(COMPANY_DATA)) {
    console.log(`Updating ${companyName}...`);

    const { error } = await supabase
      .from('companies')
      .update({ metadata })
      .eq('name', companyName);

    if (error) {
      console.error(`Error updating ${companyName}:`, error);
    } else {
      console.log(`✅ Updated ${companyName}`);
    }
  }
}

migrateMetadata();
```

**Run it:**
```bash
node scripts/migrate-companies-metadata.js
```

---

## Next Steps

1. ✅ Add metadata to companies in Supabase UI (manual for now)
2. ✅ Update CompaniesDataTransformer to fetch from companies table
3. ✅ Test locally
4. ✅ Deploy

---

**Document Version:** 1.0
**Last Updated:** 2025-11-12
**Status:** Ready to Implement
