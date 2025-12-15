# Quick Start: Company Table Integration
## Using the `company` Table (Already Exists!)

> **Great News:** The `company` table already exists with IDs that match `market_event.company_id`!
> **No metadata needed** - the table already has a `logo` column with images!

---

## Current Database Structure

```sql
-- ✅ ALREADY EXISTS
company (
  id INTEGER PRIMARY KEY,           -- 9, 10, 11, 12, 1000
  name VARCHAR,                     -- "Gnosis DAO", "Kleros DAO", etc.
  description TEXT,
  logo VARCHAR,                     -- "/assets/gnosis-dao-logo.png"
  currency_token VARCHAR,           -- "GNO", "PNK", "TSLA", "SBUX"
  status VARCHAR,
  metadata JSONB,                   -- Currently empty {}
  created_at TIMESTAMP,
  inserted_at TIMESTAMP
)
```

**Key Discovery:**
- `company.id` = integer (9, 10, 11, 12)
- `market_event.company_id` = integer (9, 10, 11, 12)
- **They match directly!** No mapping needed.

---

## Current Companies in Database

| ID | Name | Logo | Token |
|----|------|------|-------|
| 9 | Gnosis DAO | `/assets/gnosis-dao-logo.png` | GNO |
| 10 | Kleros DAO | null | null |
| 11 | Tesla (Ondo TSLAon) | null | null |
| 12 | Starbucks(Ondo SBUXon) | null | null |
| 1000 | Futarchy | null | null |

---

## What Needs to be Done

### Option 1: Use Existing `logo` Column (Recommended)

**Update missing logos in Supabase Table Editor:**

1. Go to Table Editor → `company` table
2. Update row where `id = 10` (Kleros):
   ```
   logo: https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQyIR2uIantnjRlVbeUGiDe35Pcg6ku-lgLcw&s
   ```

3. Update row where `id = 11` (Tesla):
   ```
   logo: /assets/ceos/ceos-companies-logo/tesla.png
   ```

4. Update row where `id = 12` (Starbucks):
   ```
   logo: https://futarchy-assets.s3.eu-north-1.amazonaws.com/Starbucks_logo.svg
   ```

**That's it! No metadata JSON needed.**

---

### Option 2: Use Metadata JSON (More Flexible)

If you want to store additional fields like banner images, colors, etc:

**SQL Update for Company 9 (Gnosis DAO):**
```sql
UPDATE company
SET metadata = '{
  "banner": "/assets/gnosis-company-bg.png",
  "logo_svg": "/assets/gnosis-dao-logo.svg",
  "website": "https://gnosis.io",
  "colors": {
    "primary": "#4F46E5"
  }
}'::jsonb
WHERE id = 9;
```

**SQL Update for Company 10 (Kleros):**
```sql
UPDATE company
SET
  logo = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQyIR2uIantnjRlVbeUGiDe35Pcg6ku-lgLcw&s',
  metadata = '{
    "website": "https://kleros.io"
  }'::jsonb
WHERE id = 10;
```

**SQL Update for Company 11 (Tesla):**
```sql
UPDATE company
SET
  logo = '/assets/ceos/ceos-companies-logo/tesla.png',
  metadata = '{
    "banner": "/assets/tesla_company.webp",
    "website": "https://tesla.com"
  }'::jsonb
WHERE id = 11;
```

**SQL Update for Company 12 (Starbucks):**
```sql
UPDATE company
SET
  logo = 'https://futarchy-assets.s3.eu-north-1.amazonaws.com/Starbucks_logo.svg',
  metadata = '{
    "is_hidden": true
  }'::jsonb
WHERE id = 12;
```

---

## Frontend Changes Needed

### Update `CompaniesDataTransformer.jsx`

Change table name from `companies` (plural) to `company` (singular):

```javascript
export const fetchFromCompaniesTable = async () => {
  try {
    console.log('[CompaniesDataTransformer] Fetching from "company" table...');

    const { data: companies, error } = await supabase
      .from('company')  // ✅ CHANGED: singular
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('[CompaniesDataTransformer] Error fetching companies:', error);
      return null;
    }

    console.log('[CompaniesDataTransformer] Company table data:', companies);

    // Transform each company
    const transformedCompanies = await Promise.all(
      companies.map(async (company) => {
        console.log(`[CompaniesDataTransformer] Processing company: ${company.name} (ID: ${company.id})`);

        const metadata = company.metadata || {};

        // ✅ Use logo column first, then metadata.image as fallback
        const imageUrl = company.logo ||  // From logo column
                        metadata.image ||
                        metadata.logo ||
                        getCompanyImage({
                          name: company.name,
                          id: company.id  // ✅ Use company.id directly (integer)
                        });

        console.log(`[CompaniesDataTransformer] Image for ${company.name}:`, imageUrl);

        // Get proposal count - company.id matches market_event.company_id
        const { count: proposalCount } = await supabase
          .from('market_event')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', company.id)  // ✅ Direct match!
          .in('approval_status', ['ongoing', 'on_going']);

        console.log(`[CompaniesDataTransformer] ${company.name} has ${proposalCount} proposals`);

        return {
          companyID: company.id,  // ✅ Integer ID
          title: company.name,
          description: company.description,
          image: imageUrl,
          proposals: proposalCount || 0,
          slug: company.name.toLowerCase().replace(/\s+/g, '-'),

          // Additional data
          currency_token: company.currency_token || metadata.currency_token,
          website: metadata.website,
          colors: metadata.colors,
          banner: metadata.banner,
        };
      })
    );

    // Filter out companies with 0 proposals
    const visibleCompanies = transformedCompanies.filter(c => {
      if (c.proposals === 0) {
        console.log(`[CompaniesDataTransformer] Hiding company ${c.title} - no active proposals`);
        return false;
      }
      return true;
    });

    console.log('[CompaniesDataTransformer] Final companies from table:', visibleCompanies);
    return visibleCompanies;

  } catch (error) {
    console.error('[CompaniesDataTransformer] Exception:', error);
    return null;
  }
};
```

---

## Testing

### 1. Test in SQL Editor

```sql
-- See all companies
SELECT id, name, logo, currency_token FROM company ORDER BY id;

-- Check which have proposals
SELECT
  c.id,
  c.name,
  c.logo,
  COUNT(m.id) as proposal_count
FROM company c
LEFT JOIN market_event m ON c.id = m.company_id
WHERE m.approval_status IN ('ongoing', 'on_going')
GROUP BY c.id, c.name, c.logo
ORDER BY c.id;
```

**Expected Output:**
```
id | name       | logo                                  | proposal_count
---|------------|---------------------------------------|---------------
9  | Gnosis DAO | /assets/gnosis-dao-logo.png          | 4
10 | Kleros DAO | https://encrypted-tbn0...            | 4
11 | Tesla...   | /assets/ceos/...tesla.png            | 1
12 | Starbucks  | https://futarchy-assets...           | 0
```

### 2. Test in Frontend

```bash
npm run dev
# Visit: http://localhost:3000/companies
```

**Check Console (F12):**
```
[CompaniesDataTransformer] Fetching from "company" table...
[CompaniesDataTransformer] Company table data: [...]
[CompaniesDataTransformer] Processing company: Gnosis DAO (ID: 9)
[CompaniesDataTransformer] Image for Gnosis DAO: /assets/gnosis-dao-logo.png
[CompaniesDataTransformer] Gnosis DAO has 4 proposals
...
[CompaniesDataTransformer] Hiding company Starbucks(Ondo SBUXon) - no active proposals
[CompaniesDataTransformer] Final companies from table: [3 companies]
```

**You Should See:**
- ✅ 3 companies displayed (9, 10, 11)
- ✅ Company 12 (Starbucks) hidden (0 proposals)
- ✅ Images from `logo` column
- ✅ No errors in console

---

## Summary

### What We Discovered

✅ Table name: `company` (singular)
✅ IDs are integers: 9, 10, 11, 12, 1000
✅ IDs directly match `market_event.company_id`
✅ Already has `logo` column with images
✅ No mapping needed!

### What Changed from Original Plan

❌ **Old Plan:** Use `companies` table with UUID, need `company_id` in metadata
✅ **New Reality:** Use `company` table with integer IDs that match directly

### Simplest Path Forward

**Just update the 3 missing logos:**

```sql
-- Kleros
UPDATE company SET logo = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQyIR2uIantnjRlVbeUGiDe35Pcg6ku-lgLcw&s' WHERE id = 10;

-- Tesla
UPDATE company SET logo = '/assets/ceos/ceos-companies-logo/tesla.png' WHERE id = 11;

-- Starbucks
UPDATE company SET logo = 'https://futarchy-assets.s3.eu-north-1.amazonaws.com/Starbucks_logo.svg' WHERE id = 12;
```

**Then update the frontend to use `company` table instead of `companies`.**

Done! 🎉

---

**Document Version:** 2.0 (Test Results Integrated)
**Last Updated:** 2025-11-12
**Status:** Ready to Implement
