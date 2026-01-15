# Copy-Paste Metadata for Each Company

> **Quick Guide:** Copy the JSON for each company and paste into Supabase Table Editor
> **Table:** `company` (singular)
> **Column:** `metadata` (JSONB type)

---

## How to Update in Supabase

1. Go to Supabase Dashboard
2. Click **Table Editor**
3. Select **`company`** table
4. Find the row by `id`
5. Click the `metadata` cell
6. Paste the JSON
7. Save

---

## Company 9: Gnosis DAO

**Row ID:** `9`

### Logo Column (Paste in `logo` field):
```
/assets/gnosis-dao-logo.png
```

### Metadata Column (Optional - for banner/extras):
```json
{
  "banner": "/assets/gnosis-company-bg.png",
  "website": "https://gnosis.io",
  "colors": {
    "primary": "#4F46E5"
  }
}
```

---

## Company 10: Kleros DAO

**Row ID:** `10`

### Logo Column (Paste in `logo` field):
```
https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQyIR2uIantnjRlVbeUGiDe35Pcg6ku-lgLcw&s
```

### Metadata Column (Optional):
```json
{
  "banner": "https://kleros.io/static/open-graph-card-1200x630.png",
  "website": "https://kleros.io",
  "colors": {
    "primary": "#9013FE"
  }
}
```

---

## Company 11: Tesla (Ondo TSLAon)

**Row ID:** `11`

### Logo Column (Paste in `logo` field):
```
/assets/ceos/ceos-companies-logo/tesla.png
```

### Metadata Column (Optional):
```json
{
  "banner": "/assets/tesla_company.webp",
  "website": "https://tesla.com",
  "colors": {
    "primary": "#E31937"
  }
}
```

---

## Company 12: Starbucks (Ondo SBUXon)

**Row ID:** `12`

### Logo Column (Paste in `logo` field):
```
https://futarchy-assets.s3.eu-north-1.amazonaws.com/Starbucks_logo.svg
```

### Metadata Column (Optional):
```json
{
  "banner": "https://worktheater.com/wp-content/uploads/2024/07/Starbucks.jpg",
  "website": "https://starbucks.com",
  "colors": {
    "primary": "#00704A"
  },
  "note": "Currently hidden - no active proposals"
}
```

---

## Quick SQL Option (All at Once)

If you prefer SQL, run this in Supabase SQL Editor:

```sql
-- Update logos (required)
UPDATE company SET logo = '/assets/gnosis-dao-logo.png' WHERE id = 9;
UPDATE company SET logo = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQyIR2uIantnjRlVbeUGiDe35Pcg6ku-lgLcw&s' WHERE id = 10;
UPDATE company SET logo = '/assets/ceos/ceos-companies-logo/tesla.png' WHERE id = 11;
UPDATE company SET logo = 'https://futarchy-assets.s3.eu-north-1.amazonaws.com/Starbucks_logo.svg' WHERE id = 12;

-- Update metadata (optional - for banners/colors)
UPDATE company
SET metadata = '{"banner": "/assets/gnosis-company-bg.png", "website": "https://gnosis.io", "colors": {"primary": "#4F46E5"}}'::jsonb
WHERE id = 9;

UPDATE company
SET metadata = '{"banner": "https://kleros.io/static/open-graph-card-1200x630.png", "website": "https://kleros.io", "colors": {"primary": "#9013FE"}}'::jsonb
WHERE id = 10;

UPDATE company
SET metadata = '{"banner": "/assets/tesla_company.webp", "website": "https://tesla.com", "colors": {"primary": "#E31937"}}'::jsonb
WHERE id = 11;

UPDATE company
SET metadata = '{"banner": "https://worktheater.com/wp-content/uploads/2024/07/Starbucks.jpg", "website": "https://starbucks.com", "colors": {"primary": "#00704A"}}'::jsonb
WHERE id = 12;
```

---

## Summary Table

| ID | Company | Logo Source | Banner | Currency |
|----|---------|-------------|--------|----------|
| 9 | Gnosis DAO | `/assets/gnosis-dao-logo.png` | `/assets/gnosis-company-bg.png` | GNO |
| 10 | Kleros DAO | `https://encrypted-tbn0...` | `https://kleros.io/static/...` | PNK |
| 11 | Tesla | `/assets/ceos/.../tesla.png` | `/assets/tesla_company.webp` | TSLA |
| 12 | Starbucks | `https://futarchy-assets...Starbucks_logo.svg` | `https://worktheater.com/...Starbucks.jpg` | SBUX |

---

## What Was Previously Hardcoded

### From `COMPANY_IMAGES` Constant (REMOVED):
```javascript
// ❌ OLD HARDCODED:
const COMPANY_IMAGES = {
  "gnosis": "/assets/gnosis-dao-logo.png",
  "gnosisdao": "/assets/gnosis-dao-logo.png",
  "9": "/assets/gnosis-dao-logo.png",
  "kleros": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQyIR2uIantnjRlVbeUGiDe35Pcg6ku-lgLcw&s",
  "10": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQyIR2uIantnjRlVbeUGiDe35Pcg6ku-lgLcw&s",
  "11": "/assets/ceos/ceos-companies-logo/tesla.png",
};
```

### From Background Images in Cards (REMOVED):
```javascript
// ❌ OLD HARDCODED:
numericCompanyId === 10
  ? "https://kleros.io/static/open-graph-card-1200x630.png"
  : numericCompanyId === 11
  ? "https://worktheater.com/wp-content/uploads/2024/07/Starbucks.jpg"
  : "/assets/gnosis-company-bg.png"
```

**✅ NOW:** All images come from `company.logo` column or `metadata.banner` field

---

## Verification

After updating, verify with this SQL:

```sql
SELECT
  id,
  name,
  logo,
  metadata,
  currency_token
FROM company
WHERE id IN (9, 10, 11, 12)
ORDER BY id;
```

**Expected Result:**
- All 4 companies have `logo` values
- Metadata contains banner/website/colors (if you added them)
- `currency_token` shows GNO/PNK/TSLA/SBUX (if set)

---

## Testing in Frontend

```bash
npm run dev
# Visit: http://localhost:3000/companies
```

**Check Browser Console:**
```
[CompaniesDataTransformer] Fetching from 'company' table...
[CompaniesDataTransformer] Image for Gnosis DAO: /assets/gnosis-dao-logo.png
[CompaniesDataTransformer] Image for Kleros DAO: https://encrypted-tbn0...
[CompaniesDataTransformer] Image for Tesla: /assets/ceos/.../tesla.png
```

**Visual Check:**
- ✅ All 3 companies show real logos (not avatars)
- ✅ Starbucks hidden (0 proposals)
- ✅ No console errors

---

**Document Version:** 1.0
**Last Updated:** 2025-11-12
**Status:** Ready to Copy-Paste 📋
