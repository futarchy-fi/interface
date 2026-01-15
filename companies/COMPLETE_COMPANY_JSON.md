# Complete Company Data - Copy & Paste Ready

> **Quick Guide:** Complete JSON for each company to test
> **Table:** `company` (singular)
> **Test Results:** Based on `test-market-events.js` output

---

## Current Database State

From test results:
- **Company 9 (Gnosis)**: Has logo ✅, Missing background_image ❌
- **Company 10 (Kleros)**: Missing logo ❌, Missing background_image ❌
- **Company 11 (Tesla)**: Has logo ✅ (but it's .svg now), Missing background_image ❌
- **Company 12 (Starbucks)**: Not tested (0 proposals)

---

## Company 9: Gnosis DAO

### Current Values in DB:
- ID: `9`
- Name: `Gnosis DAO`
- Logo: `/assets/gnosis-dao-logo.png` ✅
- Metadata: `{}` (empty)
- Active Proposals: **4**

### Update SQL:

```sql
-- Update metadata for Gnosis DAO
UPDATE company
SET metadata = '{
  "background_image": "/assets/gnosis-company-bg.png",
  "website": "https://gnosis.io",
  "colors": {
    "primary": "#4F46E5"
  }
}'::jsonb
WHERE id = 9;
```

### Copy-Paste for Supabase UI (metadata column):
```json
{
  "background_image": "/assets/gnosis-company-bg.png",
  "website": "https://gnosis.io",
  "colors": {
    "primary": "#4F46E5"
  }
}
```

### Verification Query:
```sql
SELECT id, name, logo, metadata FROM company WHERE id = 9;
```

---

## Company 10: Kleros DAO

### Current Values in DB:
- ID: `10`
- Name: `Kleros DAO`
- Logo: `null` ❌
- Metadata: `{}` (empty)
- Active Proposals: **4** (including KIP-81!)

### Update SQL (Logo + Metadata):

```sql
-- Update logo AND metadata for Kleros DAO
UPDATE company
SET
  logo = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQyIR2uIantnjRlVbeUGiDe35Pcg6ku-lgLcw&s',
  metadata = '{
    "background_image": "https://kleros.io/static/open-graph-card-1200x630.png",
    "website": "https://kleros.io",
    "colors": {
      "primary": "#9013FE"
    }
  }'::jsonb
WHERE id = 10;
```

### Copy-Paste for Supabase UI:

**Logo column:**
```
https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQyIR2uIantnjRlVbeUGiDe35Pcg6ku-lgLcw&s
```

**Metadata column:**
```json
{
  "background_image": "https://kleros.io/static/open-graph-card-1200x630.png",
  "website": "https://kleros.io",
  "colors": {
    "primary": "#9013FE"
  }
}
```

### Verification Query:
```sql
SELECT id, name, logo, metadata FROM company WHERE id = 10;
```

---

## Company 11: Tesla (Ondo TSLAon)

### Current Values in DB:
- ID: `11`
- Name: `Tesla (Ondo TSLAon)`
- Logo: `https://futarchy-assets.s3.eu-north-1.amazonaws.com/tesla.svg` ✅
- Metadata: `{}` (empty)
- Active Proposals: **1**

### Update SQL:

```sql
-- Update logo (to PNG version) and metadata for Tesla
UPDATE company
SET
  logo = '/assets/ceos/ceos-companies-logo/tesla.png',
  metadata = '{
    "background_image": "/assets/tesla_company.webp",
    "website": "https://tesla.com",
    "colors": {
      "primary": "#E31937"
    }
  }'::jsonb
WHERE id = 11;
```

### Copy-Paste for Supabase UI:

**Logo column (if you want to change from SVG to PNG):**
```
/assets/ceos/ceos-companies-logo/tesla.png
```

**Or keep SVG:**
```
https://futarchy-assets.s3.eu-north-1.amazonaws.com/tesla.svg
```

**Metadata column:**
```json
{
  "background_image": "/assets/tesla_company.webp",
  "website": "https://tesla.com",
  "colors": {
    "primary": "#E31937"
  }
}
```

### Verification Query:
```sql
SELECT id, name, logo, metadata FROM company WHERE id = 11;
```

---

## Company 12: Starbucks (Ondo SBUXon)

### Current Values in DB:
- ID: `12`
- Name: `Starbucks(Ondo SBUXon)`
- Logo: Unknown (not in test results)
- Metadata: `{}` (empty)
- Active Proposals: **0** (hidden)

### Update SQL:

```sql
-- Update logo and metadata for Starbucks
UPDATE company
SET
  logo = 'https://futarchy-assets.s3.eu-north-1.amazonaws.com/Starbucks_logo.svg',
  metadata = '{
    "background_image": "https://worktheater.com/wp-content/uploads/2024/07/Starbucks.jpg",
    "website": "https://starbucks.com",
    "colors": {
      "primary": "#00704A"
    },
    "note": "Currently hidden - no active proposals"
  }'::jsonb
WHERE id = 12;
```

### Copy-Paste for Supabase UI:

**Logo column:**
```
https://futarchy-assets.s3.eu-north-1.amazonaws.com/Starbucks_logo.svg
```

**Metadata column:**
```json
{
  "background_image": "https://worktheater.com/wp-content/uploads/2024/07/Starbucks.jpg",
  "website": "https://starbucks.com",
  "colors": {
    "primary": "#00704A"
  },
  "note": "Currently hidden - no active proposals"
}
```

### Verification Query:
```sql
SELECT id, name, logo, metadata FROM company WHERE id = 12;
```

---

## All Companies at Once (SQL Script)

Run this in Supabase SQL Editor to update all companies:

```sql
-- Update Company 9 (Gnosis DAO) - Only metadata (logo already exists)
UPDATE company
SET metadata = '{
  "background_image": "/assets/gnosis-company-bg.png",
  "website": "https://gnosis.io",
  "colors": {"primary": "#4F46E5"}
}'::jsonb
WHERE id = 9;

-- Update Company 10 (Kleros DAO) - Logo + Metadata
UPDATE company
SET
  logo = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQyIR2uIantnjRlVbeUGiDe35Pcg6ku-lgLcw&s',
  metadata = '{
    "background_image": "https://kleros.io/static/open-graph-card-1200x630.png",
    "website": "https://kleros.io",
    "colors": {"primary": "#9013FE"}
  }'::jsonb
WHERE id = 10;

-- Update Company 11 (Tesla) - Logo + Metadata
UPDATE company
SET
  logo = '/assets/ceos/ceos-companies-logo/tesla.png',
  metadata = '{
    "background_image": "/assets/tesla_company.webp",
    "website": "https://tesla.com",
    "colors": {"primary": "#E31937"}
  }'::jsonb
WHERE id = 11;

-- Update Company 12 (Starbucks) - Logo + Metadata
UPDATE company
SET
  logo = 'https://futarchy-assets.s3.eu-north-1.amazonaws.com/Starbucks_logo.svg',
  metadata = '{
    "background_image": "https://worktheater.com/wp-content/uploads/2024/07/Starbucks.jpg",
    "website": "https://starbucks.com",
    "colors": {"primary": "#00704A"}
  }'::jsonb
WHERE id = 12;
```

---

## Verification: Check All Companies

```sql
-- See all companies with logos and background images
SELECT
  id,
  name,
  logo,
  metadata->>'background_image' as background_image,
  metadata->>'website' as website,
  metadata->'colors'->>'primary' as primary_color
FROM company
WHERE id IN (9, 10, 11, 12)
ORDER BY id;
```

**Expected Output:**
```
id | name        | logo                              | background_image                      | website              | primary_color
---|-------------|-----------------------------------|---------------------------------------|---------------------|---------------
9  | Gnosis DAO  | /assets/gnosis-dao-logo.png       | /assets/gnosis-company-bg.png        | https://gnosis.io   | #4F46E5
10 | Kleros DAO  | https://encrypted-tbn0...         | https://kleros.io/static/...         | https://kleros.io   | #9013FE
11 | Tesla...    | /assets/ceos/.../tesla.png        | /assets/tesla_company.webp           | https://tesla.com   | #E31937
12 | Starbucks   | https://futarchy-assets...        | https://worktheater.com/...          | https://starbucks.com| #00704A
```

---

## Test Each Company After Update

### Test Company 9 (Gnosis)
```bash
npm run dev
# Visit: http://localhost:3000/?company_id=9
```

**Expected:**
- Active Milestones: Gnosis logo in circular avatar ✅
- Companies section: Gnosis background image ✅
- 4 active proposals showing

---

### Test Company 10 (Kleros) - THIS IS THE KIP-81 FIX!
```bash
npm run dev
# Visit: http://localhost:3000/?company_id=10
```

**Expected:**
- Active Milestones: Kleros logo in circular avatar ✅ (was showing Gnosis before!)
- Companies section: Kleros background image ✅
- 4 active proposals including KIP-81

**Console should show:**
```
[ProposalsPageDataTransformer] Fetching company data...
[ProposalsPageDataTransformer] Cached companies: 9,10,11,12,1000
```

---

### Test Company 11 (Tesla)
```bash
npm run dev
# Visit: http://localhost:3000/?company_id=11
```

**Expected:**
- Active Milestones: Tesla logo in circular avatar ✅
- Companies section: Tesla background image ✅
- 1 active proposal showing

---

### Test Company 12 (Starbucks)
```bash
npm run dev
# Visit: http://localhost:3000/?company_id=12
```

**Expected:**
- Company should be **hidden** (0 active proposals)
- Should not appear in companies list

---

## Quick Reference: What Goes Where

```
company table structure:
┌────────────────────────────────────────────────┐
│ id  | name       | logo        | metadata      │
├────────────────────────────────────────────────┤
│ 9   | Gnosis DAO | /assets/... | {background...}│
│ 10  | Kleros DAO | https://... | {background...}│
│ 11  | Tesla      | /assets/... | {background...}│
│ 12  | Starbucks  | https://... | {background...}│
└────────────────────────────────────────────────┘

Frontend usage:
┌─────────────────────────────────────────────────┐
│ Active Milestones (proposals)                   │
│   Uses: company.logo (small circular)           │
│                                                  │
│ Companies Section                                │
│   Uses: company.metadata.background_image        │
│          (large hero background)                 │
└─────────────────────────────────────────────────┘
```

---

## Priority Fix for KIP-81 Issue

**The KIP-81 proposal is showing Gnosis logo instead of Kleros logo!**

**Root Cause:** Company 10 (Kleros) has `logo = null` in database

**Fix:** Run this ONE command:

```sql
UPDATE company
SET logo = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQyIR2uIantnjRlVbeUGiDe35Pcg6ku-lgLcw&s'
WHERE id = 10;
```

Then refresh browser → KIP-81 should show Kleros logo! 🎯

---

**Document Version:** 1.0
**Last Updated:** 2025-11-12 (after test-market-events.js)
**Status:** Ready to Copy-Paste 📋
