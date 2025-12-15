# Company Image Refactoring Guide
## From Hardcoded to Dynamic Backend-Driven System

> **Goal:** Eliminate all hardcoded company mappings and images, making the system fully dynamic and backend-controlled with smart fallbacks.

---

## Table of Contents

1. [Current Problem](#current-problem)
2. [Proposed Solution](#proposed-solution)
3. [Backend Schema Changes](#backend-schema-changes)
4. [Image Handling Strategy](#image-handling-strategy)
5. [Frontend Refactoring](#frontend-refactoring)
6. [Migration Steps](#migration-steps)
7. [Fallback Strategy](#fallback-strategy)
8. [Testing Checklist](#testing-checklist)

---

## Current Problem

### Hardcoded Dependencies

**Location: `CompaniesDataTransformer.jsx`**
```javascript
const COMPANY_IMAGES = {
  "gnosis": "/assets/gnosis-dao-logo.png",
  "kleros": "https://encrypted-tbn0.gstatic.com/...",
  "11": "/assets/ceos/ceos-companies-logo/tesla.png",
  // ... hardcoded mappings
};

const HIDDEN_COMPANY_IDS = ["12"]; // Hardcoded hidden logic
```

**Location: `markets.js`**
```javascript
metadata: {
  companyId: 9,  // Hardcoded
  image: "/assets/gnosis-market-card-133.png" // Hardcoded path
}
```

**Problems:**
- Adding new companies requires code changes
- Image paths are scattered across codebase
- No single source of truth
- Company visibility hardcoded
- Can't update images without deployment

---

## Proposed Solution

### Core Principle: **Tags + Backend Verification**

Instead of hardcoding, use a **tag-based system** where:
1. Backend stores company data with image URLs
2. Frontend requests image from API
3. System verifies image exists before using
4. Smart fallbacks for missing images

---

## Backend Schema Changes

### 1. Enhanced Companies Table

```sql
CREATE TABLE companies (
  id INTEGER PRIMARY KEY,
  name VARCHAR NOT NULL,
  slug VARCHAR UNIQUE, -- URL-friendly: "gnosis-dao", "kleros"
  description TEXT,

  -- Image URLs (CDN or storage paths)
  logo_url VARCHAR,
  banner_url VARCHAR,
  card_image_url VARCHAR,

  -- Image metadata
  logo_verified BOOLEAN DEFAULT FALSE,
  logo_last_checked TIMESTAMP,

  -- Display settings
  is_hidden BOOLEAN DEFAULT FALSE,
  display_order INTEGER DEFAULT 0,

  -- Additional metadata
  website VARCHAR,
  currency_token VARCHAR,
  tags JSONB, -- ["DeFi", "Governance", "Infrastructure"]

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for performance
CREATE INDEX idx_companies_slug ON companies(slug);
CREATE INDEX idx_companies_hidden ON companies(is_hidden);
```

### 2. Company Images Table (Flexible)

```sql
CREATE TABLE company_images (
  id SERIAL PRIMARY KEY,
  company_id INTEGER REFERENCES companies(id),

  -- Image details
  image_type VARCHAR NOT NULL, -- 'logo', 'banner', 'card', 'proposal', 'market'
  image_url VARCHAR NOT NULL,
  image_context VARCHAR, -- 'GIP-133', 'KIP-78', etc.

  -- Verification
  is_verified BOOLEAN DEFAULT FALSE,
  last_verified_at TIMESTAMP,
  verification_status VARCHAR, -- 'pending', 'valid', 'broken', 'missing'

  -- Display settings
  display_order INTEGER DEFAULT 0,
  alt_text VARCHAR,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),

  -- Ensure one image per type per context
  UNIQUE(company_id, image_type, image_context)
);
```

### 3. Markets Table Updates

```sql
ALTER TABLE markets ADD COLUMN IF NOT EXISTS image_url VARCHAR;
ALTER TABLE markets ADD COLUMN IF NOT EXISTS image_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE markets ADD COLUMN IF NOT EXISTS seo_image_override VARCHAR;

-- For backward compatibility, keep metadata jsonb
-- but prioritize dedicated columns
```

---

## Image Handling Strategy

### Strategy 1: URL Verification System

**Backend Edge Function: `verify-image-url`**

```typescript
// Supabase Edge Function: verify-image-url.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  const { imageUrl } = await req.json();

  try {
    // Check if URL is accessible
    const response = await fetch(imageUrl, { method: 'HEAD' });

    return new Response(
      JSON.stringify({
        valid: response.ok,
        status: response.status,
        contentType: response.headers.get('content-type'),
        checkedAt: new Date().toISOString()
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ valid: false, error: error.message }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
```

### Strategy 2: Image Upload & CDN

**Option A: Supabase Storage**
```sql
-- Create storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-images', 'company-images', true);

-- Set policies
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
USING (bucket_id = 'company-images');

CREATE POLICY "Authenticated upload"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'company-images' AND auth.role() = 'authenticated');
```

**Image URL Format:**
```
https://{project}.supabase.co/storage/v1/object/public/company-images/
  ├── logos/
  │   ├── gnosis-dao.png
  │   ├── kleros.png
  │   └── tesla.png
  ├── cards/
  │   ├── gnosis-gip-133.png
  │   └── kleros-kip-81.png
  └── ceos/
      └── elon-musk.jpg
```

**Option B: External CDN (Cloudflare, AWS S3)**
- Store full URLs in database
- Use signed URLs for private images
- Implement cache invalidation

---

## Frontend Refactoring

### 1. Remove Hardcoded Mappings

**Before:**
```javascript
// ❌ CompaniesDataTransformer.jsx
const COMPANY_IMAGES = {
  "gnosis": "/assets/gnosis-dao-logo.png",
  "kleros": "https://encrypted-tbn0.gstatic.com/...",
};
```

**After:**
```javascript
// ✅ Dynamic image fetching
const imageUrl = companyData.logo_url ||
                companyData.logo ||
                generateFallbackImageUrl(companyData.name);
```

### 2. New Hook: `useCompanyImage`

**File: `src/components/refactor/hooks/useCompanyImage.js`**

```javascript
import { useState, useEffect } from 'react';

/**
 * Hook to fetch and verify company images with smart fallbacks
 */
export function useCompanyImage(companyId, imageType = 'logo') {
  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    async function fetchImage() {
      try {
        // 1. Fetch from API
        const response = await fetch(
          `/api/companies/${companyId}/images?type=${imageType}`
        );
        const data = await response.json();

        if (data.imageUrl && data.verified) {
          setImageUrl(data.imageUrl);
          setVerified(true);
        } else if (data.imageUrl) {
          // 2. Verify image exists (client-side check)
          const verified = await verifyImage(data.imageUrl);
          setImageUrl(verified ? data.imageUrl : null);
          setVerified(verified);
        } else {
          // 3. Use fallback
          setImageUrl(null);
          setVerified(false);
        }
      } catch (error) {
        console.error('Failed to fetch company image:', error);
        setImageUrl(null);
        setVerified(false);
      } finally {
        setLoading(false);
      }
    }

    fetchImage();
  }, [companyId, imageType]);

  return { imageUrl, loading, verified };
}

/**
 * Verify image URL is accessible
 */
async function verifyImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;

    // Timeout after 5 seconds
    setTimeout(() => resolve(false), 5000);
  });
}
```

### 3. Smart Image Component

**File: `src/components/refactor/ui/CompanyImage.jsx`**

```javascript
import { useCompanyImage } from '../hooks/useCompanyImage';
import { generateFallbackAvatar } from '../utils/imageUtils';

export function CompanyImage({
  companyId,
  companyName,
  imageType = 'logo',
  className = '',
  fallbackType = 'avatar' // 'avatar', 'placeholder', 'icon'
}) {
  const { imageUrl, loading, verified } = useCompanyImage(companyId, imageType);

  // Generate fallback based on company name
  const fallbackUrl = generateFallbackAvatar(companyName, {
    type: fallbackType,
    size: 200,
    bgColor: generateColorFromString(companyName)
  });

  if (loading) {
    return <div className={`animate-pulse bg-gray-200 ${className}`} />;
  }

  return (
    <img
      src={imageUrl || fallbackUrl}
      alt={`${companyName} ${imageType}`}
      className={className}
      onError={(e) => {
        // Final fallback if image fails to load
        e.target.src = fallbackUrl;
      }}
      data-verified={verified}
    />
  );
}
```

### 4. Fallback Image Generator

**File: `src/components/refactor/utils/imageUtils.js`**

```javascript
/**
 * Generate fallback avatar using initials and color
 */
export function generateFallbackAvatar(name, options = {}) {
  const { type = 'avatar', size = 200, bgColor } = options;

  if (type === 'avatar') {
    // Use a service like UI Avatars
    const initials = getInitials(name);
    const color = bgColor || generateColorFromString(name);
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&size=${size}&background=${color}&color=fff`;
  }

  if (type === 'placeholder') {
    // Use placeholder service
    return `https://placehold.co/${size}x${size}/e5e7eb/374151?text=${encodeURIComponent(name)}`;
  }

  // Default: local fallback
  return '/assets/default-company-logo.png';
}

/**
 * Get initials from company name
 */
function getInitials(name) {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Generate consistent color from string
 */
export function generateColorFromString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  const color = Math.abs(hash).toString(16).slice(0, 6).padStart(6, '0');
  return color;
}

/**
 * Get image URL with verification
 */
export async function getVerifiedImageUrl(companyId, imageType) {
  try {
    const response = await fetch(`/api/companies/${companyId}/images?type=${imageType}`);
    const data = await response.json();

    return data.verified ? data.imageUrl : null;
  } catch {
    return null;
  }
}
```

---

## Migration Steps

### Phase 1: Backend Setup (Week 1)

**Step 1.1: Create New Tables**
```bash
# Run migration
psql -h YOUR_SUPABASE_URL -U postgres -d postgres < migrations/001_company_images.sql
```

**Step 1.2: Migrate Existing Data**
```sql
-- Insert existing companies with current hardcoded data
INSERT INTO companies (id, name, slug, logo_url, is_hidden) VALUES
  (9, 'Gnosis DAO', 'gnosis-dao', '/assets/gnosis-dao-logo.png', false),
  (10, 'Kleros', 'kleros', 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQyIR2uIantnjRlVbeUGiDe35Pcg6ku-lgLcw&s', false),
  (11, 'Tesla', 'tesla', '/assets/ceos/ceos-companies-logo/tesla.png', false),
  (12, 'Starbucks', 'starbucks', '/assets/starbucks-logo.png', true); -- Hidden

-- Insert company images
INSERT INTO company_images (company_id, image_type, image_url, is_verified) VALUES
  -- Gnosis
  (9, 'logo', '/assets/gnosis-dao-logo.png', true),
  (9, 'card', '/assets/gnosis-market-card-133.png', true),
  (9, 'card', '/assets/gnosis-market-card-140.png', true),

  -- Kleros
  (10, 'logo', 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQyIR2uIantnjRlVbeUGiDe35Pcg6ku-lgLcw&s', false),
  (10, 'card', '/assets/kleros-market-card-78.png', true),

  -- Tesla
  (11, 'logo', '/assets/ceos/ceos-companies-logo/tesla.png', true),
  (11, 'card', '/assets/tesla-market-card-1.png', true);
```

**Step 1.3: Create API Endpoints**

**File: `pages/api/companies/[id]/images.js`**
```javascript
export default async function handler(req, res) {
  const { id } = req.query;
  const { type = 'logo' } = req.query;

  try {
    // Fetch from Supabase
    const { data, error } = await supabase
      .from('company_images')
      .select('*')
      .eq('company_id', id)
      .eq('image_type', type)
      .single();

    if (error || !data) {
      // Fallback to companies table
      const { data: companyData } = await supabase
        .from('companies')
        .select('logo_url')
        .eq('id', id)
        .single();

      return res.json({
        imageUrl: companyData?.logo_url || null,
        verified: false
      });
    }

    return res.json({
      imageUrl: data.image_url,
      verified: data.is_verified,
      lastVerified: data.last_verified_at
    });
  } catch (error) {
    console.error('Error fetching company image:', error);
    return res.status(500).json({ error: 'Failed to fetch image' });
  }
}
```

### Phase 2: Frontend Refactoring (Week 2)

**Step 2.1: Install New Hooks**
```bash
# Create new hook files
touch src/components/refactor/hooks/useCompanyImage.js
touch src/components/refactor/utils/imageUtils.js
touch src/components/refactor/ui/CompanyImage.jsx
```

**Step 2.2: Update CompaniesDataTransformer**

**File: `CompaniesDataTransformer.jsx`**
```javascript
// ❌ Remove this entire constant
// const COMPANY_IMAGES = { ... };

// ✅ Replace with dynamic fetching
export const fetchAndTransformCompanies = async () => {
  try {
    const availableCompanyIds = await getAvailableCompanies();

    const transformedCompanies = await Promise.all(
      availableCompanyIds.map(async (companyId) => {
        const companyData = await fetchCompanyData(companyId, false);

        // ✅ Use API-provided image or generate fallback
        const imageUrl = companyData.logo_url ||
                        generateFallbackAvatar(companyData.name);

        return {
          companyID: companyId.toString(),
          title: companyData.name,
          image: imageUrl, // ✅ Dynamic image
          // ... rest of data
        };
      })
    );

    return transformedCompanies;
  } catch (error) {
    console.error('Error:', error);
    return [];
  }
};
```

**Step 2.3: Update ProposalsCard**

**File: `ProposalsCard.jsx`**
```javascript
import { CompanyImage } from '../../refactor/ui/CompanyImage';

export function ProposalsCard({ proposal }) {
  return (
    <div className="proposal-card">
      {/* ❌ Old way */}
      {/* <img src={hardcodedImagePath} /> */}

      {/* ✅ New way */}
      <CompanyImage
        companyId={proposal.companyId}
        companyName={proposal.companyName}
        imageType="card"
        className="w-full h-48 object-cover"
        fallbackType="avatar"
      />
    </div>
  );
}
```

### Phase 3: Remove Hardcoded Constants (Week 3)

**Step 3.1: Remove from `markets.js`**
```javascript
// ❌ Remove hardcoded companyId from metadata
// metadata: { companyId: 9 }

// ✅ Fetch from backend
export async function getMarketConfig(address) {
  const { data } = await supabase
    .from('markets')
    .select(`
      *,
      companies (
        id,
        name,
        logo_url
      )
    `)
    .eq('address', address)
    .single();

  return {
    ...data,
    companyId: data.companies.id,
    companyLogo: data.companies.logo_url
  };
}
```

**Step 3.2: Remove `HIDDEN_COMPANY_IDS`**
```javascript
// ❌ Remove
// const HIDDEN_COMPANY_IDS = ["12"];

// ✅ Fetch from backend with filter
const { data } = await supabase
  .from('companies')
  .select('id')
  .eq('is_hidden', false);
```

**Step 3.3: Remove `DEFAULT_COMPANY_ID`**
```javascript
// ❌ src/components/refactor/constants/supabase.js
// export const DEFAULT_COMPANY_ID = 9;

// ✅ Fetch from user preferences or most active company
export async function getDefaultCompanyId() {
  const userPreference = localStorage.getItem('defaultCompanyId');
  if (userPreference) return parseInt(userPreference);

  // Fallback: Get most active company
  const { data } = await supabase
    .from('companies')
    .select('id, markets(count)')
    .eq('is_hidden', false)
    .order('markets.count', { ascending: false })
    .limit(1)
    .single();

  return data?.id || null;
}
```

---

## Fallback Strategy

### Fallback Priority Chain

```
1. API Image (verified) ✅
   ↓ (if null or 404)
2. API Image (unverified) ⚠️
   ↓ (if failed to load)
3. Generated Avatar (UI Avatars API) 🎨
   ↓ (if service down)
4. Local Placeholder (/assets/default-company-logo.png) 📁
   ↓ (if missing)
5. Inline SVG Placeholder 🔲
```

### Implementation

```javascript
// src/components/refactor/ui/CompanyImage.jsx
export function CompanyImage({ companyId, companyName, imageType = 'logo' }) {
  const [currentSrc, setCurrentSrc] = useState(null);
  const [fallbackLevel, setFallbackLevel] = useState(0);

  const fallbacks = [
    // Level 0: API image (verified)
    async () => {
      const { imageUrl, verified } = await getCompanyImage(companyId, imageType);
      return verified ? imageUrl : null;
    },
    // Level 1: API image (unverified)
    async () => {
      const { imageUrl } = await getCompanyImage(companyId, imageType);
      return imageUrl;
    },
    // Level 2: Generated avatar
    () => generateFallbackAvatar(companyName, { type: 'avatar' }),
    // Level 3: Local placeholder
    () => '/assets/default-company-logo.png',
    // Level 4: Inline SVG
    () => 'data:image/svg+xml,...'
  ];

  useEffect(() => {
    async function loadImage() {
      for (let i = fallbackLevel; i < fallbacks.length; i++) {
        const src = await fallbacks[i]();
        if (src && await verifyImage(src)) {
          setCurrentSrc(src);
          setFallbackLevel(i);
          return;
        }
      }
    }
    loadImage();
  }, [companyId, companyName, imageType, fallbackLevel]);

  return (
    <img
      src={currentSrc}
      alt={companyName}
      onError={() => setFallbackLevel(prev => prev + 1)}
    />
  );
}
```

---

## Testing Checklist

### Backend Tests

- [ ] Companies table has all existing data migrated
- [ ] Image URLs are accessible (run verification script)
- [ ] Hidden companies query works (`is_hidden = false`)
- [ ] API endpoint `/api/companies/[id]/images` returns correct data
- [ ] Edge function `verify-image-url` works for valid/invalid URLs

### Frontend Tests

- [ ] All companies render with images (no broken images)
- [ ] Fallback avatars display for missing images
- [ ] Loading states appear correctly
- [ ] Image verification works client-side
- [ ] No console errors about missing images
- [ ] `useCompanyImage` hook fetches and caches correctly

### Integration Tests

- [ ] Market cards display correct company images
- [ ] Company list page shows all visible companies
- [ ] Hidden companies don't appear in list
- [ ] Search/filter works with dynamic data
- [ ] Image lazy loading works
- [ ] Performance: No significant slowdown (<100ms per image)

### Regression Tests

- [ ] Existing markets still work
- [ ] All 20 markets render correctly
- [ ] GIP-133, KIP-81, etc. show correct images
- [ ] CEO profile images load
- [ ] No hardcoded dependencies remain

---

## Benefits of This Approach

✅ **No Code Changes for New Companies**
- Add via admin panel or API
- Images update instantly

✅ **Single Source of Truth**
- Database controls everything
- No scattered constants

✅ **Graceful Degradation**
- Multiple fallback levels
- Never show broken images

✅ **Performance**
- Image verification caching
- Lazy loading support
- CDN-ready

✅ **Flexibility**
- Support multiple image types
- Per-market image overrides
- Easy A/B testing

✅ **Maintainability**
- Remove ~200 lines of hardcoded data
- Self-documenting API
- Easy to debug

---

## Quick Start Commands

```bash
# 1. Setup backend
cd supabase
supabase migration new company_images
# Edit migration file, then:
supabase db push

# 2. Migrate data
npm run migrate-company-data

# 3. Create API endpoints
touch pages/api/companies/[id]/images.js

# 4. Create frontend utilities
mkdir -p src/components/refactor/{hooks,utils,ui}
touch src/components/refactor/hooks/useCompanyImage.js
touch src/components/refactor/utils/imageUtils.js
touch src/components/refactor/ui/CompanyImage.jsx

# 5. Update components
# Edit CompaniesDataTransformer.jsx
# Edit ProposalsCard.jsx

# 6. Test
npm run dev
# Visit http://localhost:3000/companies

# 7. Verify no hardcoded references remain
grep -r "COMPANY_IMAGES" src/
grep -r "companyId: [0-9]" src/
grep -r "HIDDEN_COMPANY_IDS" src/
```

---

## Example: Adding Company 13 (Uniswap)

### Old Way (Hardcoded) ❌
```javascript
// 1. Update CompaniesDataTransformer.jsx
const COMPANY_IMAGES = {
  // ... existing
  "13": "/assets/uniswap-logo.png",
  "uniswap": "/assets/uniswap-logo.png",
};

// 2. Add market in markets.js
metadata: { companyId: 13 }

// 3. Deploy code
// 4. Upload assets
// 5. Restart server
```

### New Way (Dynamic) ✅
```sql
-- 1. Single SQL insert
INSERT INTO companies (id, name, slug, logo_url, currency_token)
VALUES (13, 'Uniswap', 'uniswap',
  'https://your-cdn.com/company-images/logos/uniswap.png', 'UNI');

-- Done! No code changes, no deployment needed.
```

---

## Monitoring & Maintenance

### Scheduled Image Verification

```javascript
// scripts/verify-company-images.js
async function verifyAllImages() {
  const { data: images } = await supabase
    .from('company_images')
    .select('*');

  for (const img of images) {
    const valid = await verifyImageUrl(img.image_url);
    await supabase
      .from('company_images')
      .update({
        is_verified: valid,
        last_verified_at: new Date().toISOString(),
        verification_status: valid ? 'valid' : 'broken'
      })
      .eq('id', img.id);
  }
}

// Run daily via cron or GitHub Actions
```

---

**Document Version:** 1.0
**Last Updated:** 2025-11-12
**Estimated Implementation Time:** 3 weeks
**Complexity:** Medium
**Breaking Changes:** None (backward compatible during migration)

