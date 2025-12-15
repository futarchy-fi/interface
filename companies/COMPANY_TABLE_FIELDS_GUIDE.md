# Company Table Fields Guide

> **Important:** The `company` table has TWO different image fields for different purposes

---

## Image Field Usage

### 1. `logo` Column (VARCHAR)
**Purpose:** Small circular company logo
**Used in:**
- Active Milestones/Proposals cards (circular avatar)
- Proposal detail pages
- Company dropdown selectors

**Examples:**
```
Company 9 (Gnosis):   /assets/gnosis-dao-logo.png
Company 10 (Kleros):  https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQyIR2uIantnjRlVbeUGiDe35Pcg6ku-lgLcw&s
Company 11 (Tesla):   /assets/ceos/ceos-companies-logo/tesla.png
Company 12 (Starbucks): https://futarchy-assets.s3.eu-north-1.amazonaws.com/Starbucks_logo.svg
```

---

### 2. `metadata.background_image` (JSONB)
**Purpose:** Large background image for company cards
**Used in:**
- Companies section cards (large background hero image)
- Company detail pages

**Examples:**
```json
Company 9 (Gnosis):
{
  "background_image": "/assets/gnosis-company-bg.png"
}

Company 10 (Kleros):
{
  "background_image": "https://kleros.io/static/open-graph-card-1200x630.png"
}

Company 11 (Tesla):
{
  "background_image": "/assets/tesla_company.webp"
}

Company 12 (Starbucks):
{
  "background_image": "https://worktheater.com/wp-content/uploads/2024/07/Starbucks.jpg"
}
```

---

## Quick Setup: Copy-Paste Values

### Company 9 (Gnosis DAO)

**Logo column:**
```
/assets/gnosis-dao-logo.png
```

**Metadata column:**
```json
{
  "background_image": "/assets/gnosis-company-bg.png"
}
```

---

### Company 10 (Kleros DAO)

**Logo column:**
```
https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQyIR2uIantnjRlVbeUGiDe35Pcg6ku-lgLcw&s
```

**Metadata column:**
```json
{
  "background_image": "https://kleros.io/static/open-graph-card-1200x630.png"
}
```

---

### Company 11 (Tesla)

**Logo column:**
```
/assets/ceos/ceos-companies-logo/tesla.png
```

**Metadata column:**
```json
{
  "background_image": "/assets/tesla_company.webp"
}
```

---

### Company 12 (Starbucks)

**Logo column:**
```
https://futarchy-assets.s3.eu-north-1.amazonaws.com/Starbucks_logo.svg
```

**Metadata column:**
```json
{
  "background_image": "https://worktheater.com/wp-content/uploads/2024/07/Starbucks.jpg"
}
```

---

## SQL Update Script (All at Once)

```sql
-- Update logos (for circular avatars in proposals)
UPDATE company SET logo = '/assets/gnosis-dao-logo.png' WHERE id = 9;
UPDATE company SET logo = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQyIR2uIantnjRlVbeUGiDe35Pcg6ku-lgLcw&s' WHERE id = 10;
UPDATE company SET logo = '/assets/ceos/ceos-companies-logo/tesla.png' WHERE id = 11;
UPDATE company SET logo = 'https://futarchy-assets.s3.eu-north-1.amazonaws.com/Starbucks_logo.svg' WHERE id = 12;

-- Update metadata with background images (for company cards)
UPDATE company
SET metadata = '{"background_image": "/assets/gnosis-company-bg.png"}'::jsonb
WHERE id = 9;

UPDATE company
SET metadata = '{"background_image": "https://kleros.io/static/open-graph-card-1200x630.png"}'::jsonb
WHERE id = 10;

UPDATE company
SET metadata = '{"background_image": "/assets/tesla_company.webp"}'::jsonb
WHERE id = 11;

UPDATE company
SET metadata = '{"background_image": "https://worktheater.com/wp-content/uploads/2024/07/Starbucks.jpg"}'::jsonb
WHERE id = 12;
```

---

## Visual Reference

```
┌─────────────────────────────────────────┐
│   Active Milestones (Proposals)         │
│                                          │
│   ┌───┐  ┌───┐  ┌───┐                  │
│   │ K │  │GD │  │ T │   <- Uses `logo` │
│   └───┘  └───┘  └───┘      (circular)  │
│                                          │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│   Companies                              │
│                                          │
│   ┌──────────┐  ┌──────────┐           │
│   │   BIG    │  │   BIG    │           │
│   │ BACKGROUND│ │BACKGROUND│           │
│   │  IMAGE   │  │  IMAGE   │           │
│   └──────────┘  └──────────┘           │
│        ^              ^                  │
│        └──────────────┘                  │
│    Uses `metadata.background_image`     │
│                                          │
└─────────────────────────────────────────┘
```

---

## Frontend Implementation

### CompaniesCard.jsx
```javascript
// Uses metadata.background_image for large background
const displayImage = company.metadata?.background_image || image;
```

### ProposalsCard.jsx
```javascript
// Uses logo for small circular company avatar
const companyLogo = company.logo;
```

---

## Summary

| Field | Type | Purpose | Size | Used In |
|-------|------|---------|------|---------|
| `logo` | VARCHAR | Company logo | Small (icon) | Proposals, avatars |
| `metadata.background_image` | JSONB | Background image | Large (hero) | Company cards |

**Key Point:** These are DIFFERENT images for DIFFERENT purposes!

- **Logo** = Kleros icon, Tesla icon, etc. (small, square/circular)
- **Background** = Full company background image (large, wide)

---

**Document Version:** 1.0
**Last Updated:** 2025-11-12
**Status:** Ready to Use 📋
