# Hardcoded Companies Documentation

> **Last Updated:** 2025-11-12
> **Purpose:** Comprehensive documentation of all hardcoded company data in the futarchy-web application

---

## Table of Contents

1. [Overview](#overview)
2. [Company Registry](#company-registry)
3. [Company Details](#company-details)
4. [Image Asset Mapping](#image-asset-mapping)
5. [Configuration Constants](#configuration-constants)
6. [Markets by Company](#markets-by-company)
7. [Technical Implementation](#technical-implementation)
8. [Migration Guide](#migration-guide)

---

## Overview

The futarchy-web application currently uses **4 hardcoded companies** (IDs: 9, 10, 11, 12) with associated prediction markets, governance proposals, and image assets. This document catalogs all hardcoded references for future migration to a fully database-driven system.

### Quick Reference

| Company ID | Name | Status | Markets | Primary Use Case |
|------------|------|--------|---------|------------------|
| **9** | Gnosis DAO | ✅ Active (Default) | 4+ | Governance proposals, GnosisPay predictions |
| **10** | Kleros | ✅ Active | 4 | Arbitration governance (KIPs) |
| **11** | Tesla | ✅ Active | 2 | CEO performance predictions |
| **12** | Starbucks | 🚫 Hidden | 1 | CEO exit prediction (test market) |

---

## Company Registry

### Company 9: Gnosis DAO

**Status:** Active (Default Company)
**Token:** GNO
**Primary Focus:** DAO Governance & Ecosystem Predictions

#### Hardcoded Locations
- **Default ID**: `src/components/refactor/constants/supabase.js`
  ```javascript
  export const DEFAULT_COMPANY_ID = 9;
  ```

#### Associated Markets
1. **GIP-128** - Safe Governance Token Migration
   - Address: `0xDaD620a1c99FEf1a3580EbE27d726C50C658E2cd`
   - Status: Active

2. **GIP-133** - GnosisVC Portfolio Company Investment
   - Address: `0xe3bf67BA5501e5F92CCE06D1Aa72C72eF8734c12`
   - Card Image: `/assets/gnosis-market-card-133.png`

3. **GIP-139** - Balancer Strategy Approval
   - Address: `0x7Aed02c85bF63b042b4E14698B44F6c0E112fBfE`
   - Proposal Image: `/assets/gnosis-proposal-139.png`

4. **GIP-140** - DeFi Ecosystem Growth Incentives
   - Address: `0xf22D8c89c2933A7F7c6Fe43EC7C65B2e7BeEFE2d`
   - Card Image: `/assets/gnosis-market-card-140.png`

5. **GnosisPay Volume Prediction**
   - Question: "Will GnosisPay reach €2M monthly volume by end of 2024?"
   - Market: "gnosis-pay-2m-volume"

#### Mock Data
Located in `src/components/refactor/hooks/useCompanyInfo.js`:
```javascript
{
  name: 'Gnosis DAO',
  description: 'Gnosis builds innovative projects in payments, identity, and internet freedom',
  logo: '/assets/gnosis-dao-logo.png',
  website: 'https://gnosis.io',
  currency: 'GNO'
}
```

#### Conditional Token Pools
**Hardcoded in `supabase.js`:**
- YES Pool: `0xF336F812Db1ad142F22A9A4dd43D40e64B478361`
- NO Pool: `0xfbf1BE5CE2f9056dAaB1C368EC241ad7Be3507A8`

#### Image Assets (17 files)
```
/public/assets/
├── gnosis-dao-logo.png
├── gnosis-dao-logo.svg
├── gnosis-company-bg.png
├── gnosis-market-card-1-bg.png
├── gnosis-market-card-6-bg.png
├── gnosis-market-card-7-bg.png
├── gnosis-market-card-133.png
├── gnosis-market-card-140.png
├── gnosis-proposal-1.png
├── gnosis-proposal-139.png
├── gnosis-pay.png
├── gnosis-sdai-130.png
└── ... (5 more)
```

---

### Company 10: Kleros

**Status:** Active
**Token:** PNK (Pinakion)
**Primary Focus:** Decentralized Arbitration Governance

#### Associated Markets
1. **KIP-76** - Court System Upgrade
   - Status: Proposed

2. **KIP-77** - Fee Structure Adjustment
   - Status: Proposed

3. **KIP-78** - Juror Incentive Program
   - Address: `0x456...` (check markets.js)
   - Card Image: `/assets/kleros-market-card-78.png`

4. **KIP-81** - Cross-Chain Arbitration
   - Card Image: `/assets/kleros-market-card-81.png`

#### Mock Data
Located in `src/components/refactor/hooks/useCompanyInfo.js`:
```javascript
{
  name: 'Kleros',
  description: 'Decentralized dispute resolution protocol',
  logo: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQyIR2uIantnjRlVbeUGiDe35Pcg6ku-lgLcw&s',
  website: 'https://kleros.io',
  currency: 'PNK'
}
```

#### Image Assets (5 files)
```
/public/assets/
├── kleros-market-card-1-bg.png
├── kleros-market-card-2-bg.png
├── kleros-market-card-78.png
└── kleros-market-card-81.png

External:
└── Logo: https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQyIR2uIantnjRlVbeUGiDe35Pcg6ku-lgLcw&s
```

---

### Company 11: Tesla

**Status:** Active
**Token:** TSLAON (synthetic)
**Primary Focus:** CEO Performance & Corporate Governance

#### Associated Markets
1. **CEO Award 2025**
   - Question: "Will Tesla shareholders approve Elon Musk's 2025 CEO Performance Award?"
   - Market ID: "tesla-ceo-award-2025"
   - Address: `0x6B7f87279982d919Bbf85182DDeAB179B366D8f2`
   - Collateral: USDS
   - Status: Active

2. **Additional Tesla Markets**
   - Reference in `markets.js` configuration

#### Image Assets (4 files)
```
/public/assets/
├── tesla_company.webp
├── tesla-market-card-1.png
└── ceos/
    ├── ceos-companies-logo/tesla.png
    └── elon-musk.jpg
```

---

### Company 12: Starbucks (HIDDEN)

**Status:** 🚫 Hidden from UI
**Purpose:** Test/Development Market
**Token:** N/A

#### Hidden Configuration
Located in `src/components/futarchyFi/companyList/page/CompaniesDataTransformer.jsx`:
```javascript
const HIDDEN_COMPANY_IDS = ["12"];
```

#### Associated Markets
1. **CEO Exit Prediction**
   - Question: "Will Starbucks CEO Brian Niccol be terminated or resign before 2026-01-01?"
   - Market ID: "starbucks-ceo-exit-2026"
   - Address: `0x1F54f0312E85c5AFACe2bDF15AA2514BeFDB844F`
   - Status: Hidden/Inactive

#### Image Assets
```
/public/assets/
└── starbucks-market-card-1.png (referenced, may not exist)
```

**Note:** This company is intentionally hidden from the companies list but remains in the codebase for development/testing purposes.

---

## Image Asset Mapping

### Company Image Mapping Logic
**Source:** `src/components/futarchyFi/companyList/page/CompaniesDataTransformer.jsx`

```javascript
const COMPANY_IMAGES = {
  // Gnosis DAO (multiple aliases)
  "gnosis": "/assets/gnosis-dao-logo.png",
  "gnosis dao": "/assets/gnosis-dao-logo.png",
  "gnosisdao": "/assets/gnosis-dao-logo.png",
  "1": "/assets/gnosis-dao-logo.png",
  "2": "/assets/gnosis-dao-logo.png",

  // Kleros (external URL)
  "kleros": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQyIR2uIantnjRlVbeUGiDe35Pcg6ku-lgLcw&s",
  "10": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQyIR2uIantnjRlVbeUGiDe35Pcg6ku-lgLcw&s",

  // Tesla
  "11": "/assets/ceos/ceos-companies-logo/tesla.png",

  // FutarchyFi branding
  "futarchyfi": "/assets/futarchy-logo.svg",

  // Fallback
  "default": "/assets/gnosis-dao-logo.png"
};
```

### Image Assets by Type

#### Company Logos
- Gnosis: `/assets/gnosis-dao-logo.png`, `.svg`
- Kleros: External URL (Google CDN)
- Tesla: `/assets/ceos/ceos-companies-logo/tesla.png`

#### Market Card Images
Format: `{company}-market-card-{number}.png`
- Gnosis: 1, 6, 7, 133, 140
- Kleros: 1, 2, 78, 81
- Tesla: 1
- Starbucks: 1

#### CEO Profile Images
Located in `/public/assets/ceos/`:
```
elon-musk.jpg (Tesla)
brian-armstrong.jpg
jensen-huang.jpg
sundar-pichai.jpg
... (additional CEO profiles)
```

#### Background Images
- `gnosis-company-bg.png`
- `{company}-market-card-{id}-bg.png`

---

## Configuration Constants

### Supabase Configuration
**File:** `src/components/refactor/constants/supabase.js`

```javascript
// Default company for all operations
export const DEFAULT_COMPANY_ID = 9;

// Allowed pool addresses for Gnosis DAO conditional tokens
export const ALLOWED_POOL_ADDRESSES = [
  '0xF336F812Db1ad142F22A9A4dd43D40e64B478361', // YES token pool
  '0xfbf1BE5CE2f9056dAaB1C368EC241ad7Be3507A8'  // NO token pool
];
```

### Hidden Companies
**File:** `src/components/futarchyFi/companyList/page/CompaniesDataTransformer.jsx`

```javascript
const HIDDEN_COMPANY_IDS = ["12"]; // Starbucks
```

### Mock Company Data
**File:** `src/components/refactor/hooks/useCompanyInfo.js`

Provides fallback data when Supabase is unavailable or for development:
- Company 9: Full Gnosis DAO profile
- Company 10: Full Kleros profile

---

## Markets by Company

### Market Configuration Structure
**File:** `src/config/markets.js`

Total Markets: **20 configured** (7 active)

#### Gnosis DAO Markets (4)
```javascript
{
  id: "gnosis-gip-128",
  companyId: 9,
  address: "0xDaD620a1c99FEf1a3580EbE27d726C50C658E2cd",
  question: "Should Safe (formerly Gnosis Safe) migrate to its own governance token?",
  image: "/assets/gnosis-market-card-1-bg.png"
}
// + GIP-133, GIP-139, GIP-140, GnosisPay prediction
```

#### Kleros Markets (4)
```javascript
{
  id: "kleros-kip-76",
  companyId: 10,
  question: "KIP-76: Upgrade to Kleros Court System",
  image: "/assets/kleros-market-card-1-bg.png"
}
// + KIP-77, KIP-78, KIP-81
```

#### Tesla Markets (2)
```javascript
{
  id: "tesla-ceo-award-2025",
  companyId: 11,
  address: "0x6B7f87279982d919Bbf85182DDeAB179B366D8f2",
  question: "Will Tesla shareholders approve Elon Musk's 2025 CEO Performance Award?",
  image: "/assets/tesla-market-card-1.png"
}
```

#### Starbucks Markets (1 - Hidden)
```javascript
{
  id: "starbucks-ceo-exit-2026",
  companyId: 12,
  address: "0x1F54f0312E85c5AFACe2bDF15AA2514BeFDB844F",
  question: "Will Starbucks CEO Brian Niccol be terminated or resign before 2026-01-01?",
  isActive: false
}
```

---

## Technical Implementation

### Key Files Containing Hardcoded Data

1. **`src/config/markets.js`**
   - Complete market configurations
   - Company ID associations
   - 20 market definitions

2. **`src/components/refactor/constants/supabase.js`**
   - Default company ID (9)
   - Allowed pool addresses
   - Blockchain constants

3. **`src/components/futarchyFi/companyList/page/CompaniesDataTransformer.jsx`**
   - Image mapping logic
   - Hidden company IDs
   - Display transformation rules

4. **`src/components/refactor/hooks/useCompanyInfo.js`**
   - Mock company data for dev/fallback
   - Company metadata structure

5. **`src/components/refactor/hooks/useCompanyData.js`**
   - Company data fetching logic
   - Integration with markets config

6. **`src/components/futarchyFi/proposalsList/cards/ProposalsCard.jsx`**
   - Company-specific rendering logic
   - Image path resolution

7. **`src/components/futarchyFi/proposalsList/page/proposalsPage/ProposalsPageDataTransformer.jsx`**
   - Proposal display transformation
   - Company filtering

### Data Flow

```
markets.js (config)
    ↓
useCompanyData.js (hook)
    ↓
CompaniesDataTransformer.jsx (UI transformation)
    ↓
ProposalsCard.jsx (render)
```

### Image Resolution Priority

1. Check `COMPANY_IMAGES` mapping by company name
2. Check by company ID
3. Use market-specific image from config
4. Fallback to default Gnosis logo

---

## Migration Guide

### To Fully Database-Driven System

#### Phase 1: Data Migration
1. **Export hardcoded data to Supabase tables:**
   - `companies` table: 4 company records
   - `markets` table: 20 market records
   - `company_images` table: Image path mappings

2. **Create database schema:**
```sql
CREATE TABLE companies (
  id INTEGER PRIMARY KEY,
  name VARCHAR NOT NULL,
  description TEXT,
  logo_url VARCHAR,
  website VARCHAR,
  currency_token VARCHAR,
  is_hidden BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE company_images (
  company_id INTEGER REFERENCES companies(id),
  image_type VARCHAR, -- 'logo', 'card', 'background'
  image_path VARCHAR NOT NULL,
  display_order INTEGER
);
```

#### Phase 2: Code Refactoring
1. **Remove hardcoded constants:**
   - `DEFAULT_COMPANY_ID` → User preference or context
   - `HIDDEN_COMPANY_IDS` → Database field `is_hidden`
   - `COMPANY_IMAGES` → Database query

2. **Update hooks:**
   - `useCompanyInfo.js`: Remove mock data, full Supabase integration
   - `useCompanyData.js`: Add caching layer

3. **Update transformers:**
   - Remove static mappings
   - Implement dynamic image resolution

#### Phase 3: Asset Management
1. **Image assets:**
   - Move to CDN or object storage
   - Update paths in database
   - Implement lazy loading

2. **Backwards compatibility:**
   - Keep existing image paths as fallbacks
   - Gradual migration of external dependencies

#### Phase 4: Testing & Validation
1. Verify all 20 markets render correctly
2. Test hidden company logic
3. Validate image loading performance
4. Check pool address references

---

## Additional Notes

### External Dependencies
- **Kleros Logo:** Uses Google CDN (potential SPOF)
  - Consider hosting locally or using IPFS
  - URL: `https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQyIR2uIantnjRlVbeUGiDe35Pcg6ku-lgLcw&s`

### Naming Conventions
- Market cards: `{company}-market-card-{id}.png`
- Proposals: `{company}-proposal-{id}.png`
- Company logos: `{company}-dao-logo.{ext}`
- Company backgrounds: `{company}-company-bg.png`

### Blockchain Addresses (Gnosis Chain)
All pool and market addresses are deployed on **Gnosis Chain (Chain ID: 100)**

### Security Considerations
- Pool addresses are whitelisted in `ALLOWED_POOL_ADDRESSES`
- Company ID validation needed to prevent unauthorized access
- Image paths should be sanitized before rendering

---

## Quick Reference Commands

### Find All Company References
```bash
# Search for company IDs
grep -r "company.*[9-12]" src/

# Find image references
grep -r "gnosis\|kleros\|tesla\|starbucks" src/

# List all company assets
ls public/assets/*-{company,market,dao}*.{png,jpg,webp,svg}
```

### Verify Markets Config
```bash
# Count markets by company
grep -o "companyId: [0-9]*" src/config/markets.js | sort | uniq -c
```

---

## Maintenance Checklist

- [ ] All 4 companies documented
- [ ] 20 markets cataloged
- [ ] 25+ image assets mapped
- [ ] Configuration constants identified
- [ ] Mock data locations noted
- [ ] Hidden company logic documented
- [ ] Pool addresses recorded
- [ ] Migration path outlined

---

**Document Version:** 1.0
**Contributors:** Claude Code Analysis
**Next Review:** When adding Company 13+

