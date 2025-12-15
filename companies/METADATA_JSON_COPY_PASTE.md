# Company Metadata JSON - Copy & Paste Ready

> **Simple guide:** Just copy the JSON for each company and paste into Supabase `companies` table → `metadata` column

---

## Company 9: Gnosis DAO

**Copy this JSON:**

```json
{
  "company_id": 9,
  "image": "/assets/gnosis-dao-logo.png",
  "logo": "/assets/gnosis-dao-logo.svg",
  "banner": "/assets/gnosis-company-bg.png",
  "currency_token": "GNO",
  "website": "https://gnosis.io"
}
```

**Where to paste:**
- Supabase → Table Editor → `companies` table
- Find row where `name = 'Gnosis'`
- Click on `metadata` column
- Paste the JSON above
- Click checkmark to save

---

## Company 10: Kleros

**Copy this JSON:**

```json
{
  "company_id": 10,
  "image": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQyIR2uIantnjRlVbeUGiDe35Pcg6ku-lgLcw&s",
  "currency_token": "PNK",
  "website": "https://kleros.io"
}
```

**Where to paste:**
- Same as above, find `name = 'Kleros'` row
- If row doesn't exist, click **Insert** → **Insert row** first:
  - `name`: Kleros
  - `slug`: kleros
  - `description`: Decentralized dispute resolution platform
  - `metadata`: (paste JSON above)

---

## Company 11: Tesla

**Copy this JSON:**

```json
{
  "company_id": 11,
  "image": "/assets/ceos/ceos-companies-logo/tesla.png",
  "banner": "/assets/tesla_company.webp",
  "currency_token": "TSLA",
  "website": "https://tesla.com"
}
```

**Where to paste:**
- Find `name = 'Tesla'` row
- If row doesn't exist, click **Insert** → **Insert row**:
  - `name`: Tesla
  - `slug`: tesla
  - `description`: Electric vehicle and clean energy company
  - `metadata`: (paste JSON above)

---

## Company 12: Starbucks (Hidden)

**Copy this JSON:**

```json
{
  "company_id": 12,
  "image": "https://futarchy-assets.s3.eu-north-1.amazonaws.com/Starbucks_logo.svg",
  "currency_token": "SBUX",
  "website": "https://starbucks.com"
}
```

**Where to paste:**
- Find `name = 'Starbucks'` row
- If row doesn't exist, you can skip it (it's hidden with 0 proposals anyway)

---

## Minimal Version (If you just want images)

### Gnosis (Minimal)
```json
{"company_id": 9, "image": "/assets/gnosis-dao-logo.png"}
```

### Kleros (Minimal)
```json
{"company_id": 10, "image": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQyIR2uIantnjRlVbeUGiDe35Pcg6ku-lgLcw&s"}
```

### Tesla (Minimal)
```json
{"company_id": 11, "image": "/assets/ceos/ceos-companies-logo/tesla.png"}
```

---

## SQL Version (Run in SQL Editor)

**Copy and run this in Supabase SQL Editor:**

```sql
-- Update Gnosis
UPDATE companies
SET metadata = '{
  "company_id": 9,
  "image": "/assets/gnosis-dao-logo.png",
  "logo": "/assets/gnosis-dao-logo.svg",
  "banner": "/assets/gnosis-company-bg.png",
  "currency_token": "GNO",
  "website": "https://gnosis.io"
}'::jsonb
WHERE name = 'Gnosis' OR slug = 'gnosis';

-- Update/Insert Kleros
INSERT INTO companies (name, slug, description, metadata)
VALUES (
  'Kleros',
  'kleros',
  'Decentralized dispute resolution platform',
  '{
    "company_id": 10,
    "image": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQyIR2uIantnjRlVbeUGiDe35Pcg6ku-lgLcw&s",
    "currency_token": "PNK",
    "website": "https://kleros.io"
  }'::jsonb
)
ON CONFLICT (name) DO UPDATE
SET metadata = EXCLUDED.metadata;

-- Update/Insert Tesla
INSERT INTO companies (name, slug, description, metadata)
VALUES (
  'Tesla',
  'tesla',
  'Electric vehicle and clean energy company',
  '{
    "company_id": 11,
    "image": "/assets/ceos/ceos-companies-logo/tesla.png",
    "banner": "/assets/tesla_company.webp",
    "currency_token": "TSLA",
    "website": "https://tesla.com"
  }'::jsonb
)
ON CONFLICT (name) DO UPDATE
SET metadata = EXCLUDED.metadata;
```

**How to run:**
1. Go to Supabase → SQL Editor
2. Paste the SQL above
3. Click **Run**
4. Done!

---

## Verify It Worked

**Run this in SQL Editor:**

```sql
SELECT
  name,
  metadata->>'company_id' as company_id,
  metadata->>'image' as image
FROM companies
ORDER BY name;
```

**Expected output:**

| name   | company_id | image                              |
|--------|------------|------------------------------------|
| Gnosis | 9          | /assets/gnosis-dao-logo.png       |
| Kleros | 10         | https://encrypted-tbn0...          |
| Tesla  | 11         | /assets/ceos/.../tesla.png        |

---

## Test Frontend

```bash
npm run dev
# Visit: http://localhost:3000/companies
```

**You should see:**
- 3 companies (Gnosis, Kleros, Tesla)
- Images from metadata
- Or fallback avatars if metadata missing

---

**That's it! Just copy-paste the JSON and you're done!** 🎉
