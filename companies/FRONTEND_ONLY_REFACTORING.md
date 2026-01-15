# Frontend-Only Refactoring Guide
## Remove Hardcoded Company Images (Backend Already Ready)

> **Assumption:** Backend already has `company.image` column with image URLs
> **Goal:** Remove all hardcoded image mappings and use API data

---

## Current State Analysis

### What Backend Already Has ✅
```sql
-- Assumed structure
companies table:
  - id (integer)
  - name (varchar)
  - image (varchar) -- ✅ This column exists!
  - is_hidden (boolean) -- Maybe exists?
```

### What Frontend Currently Does ❌
```javascript
// CompaniesDataTransformer.jsx - Lines 26-37
const COMPANY_IMAGES = {
  "gnosis": "/assets/gnosis-dao-logo.png",
  "kleros": "https://encrypted-tbn0.gstatic.com/...",
  "11": "/assets/ceos/ceos-companies-logo/tesla.png",
  // ... hardcoded mappings
};

// Later in code
const imageUrl = companyData.logo ||
                COMPANY_IMAGES[companyName] ||  // ❌ Remove this
                COMPANY_IMAGES[companyId.toString()] || // ❌ Remove this
                COMPANY_IMAGES.default;
```

---

## Step-by-Step Frontend Refactoring

### Step 1: Update CompaniesDataTransformer.jsx

**File:** `src/components/futarchyFi/companyList/page/CompaniesDataTransformer.jsx`

#### 1.1: Remove Hardcoded Constant (Lines 26-37)

**Before:**
```javascript
// Define company images mapping as fallback with absolute paths
const COMPANY_IMAGES = {
  "gnosis": "/assets/gnosis-dao-logo.png",
  "gnosis dao": "/assets/gnosis-dao-logo.png",
  "gnosisdao": "/assets/gnosis-dao-logo.png",
  "1": "/assets/gnosis-dao-logo.png",
  "2": "/assets/gnosis-dao-logo.png",
  "kleros": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQyIR2uIantnjRlVbeUGiDe35Pcg6ku-lgLcw&s",
  "10": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQyIR2uIantnjRlVbeUGiDe35Pcg6ku-lgLcw&s",
  "11": "/assets/ceos/ceos-companies-logo/tesla.png",
  "futarchyfi": "/assets/futarchy-logo.svg",
  "default": "/assets/gnosis-dao-logo.png"
};
```

**After:**
```javascript
// Remove entire constant, or keep minimal fallback
const DEFAULT_FALLBACK_IMAGE = "/assets/default-company-logo.png";
```

#### 1.2: Update Image URL Logic (Lines 89-93)

**Before:**
```javascript
// Get the base image path - prioritize company logo if it exists
const imageUrl = companyData.logo ||
                COMPANY_IMAGES[companyName] ||
                COMPANY_IMAGES[companyId.toString()] ||
                COMPANY_IMAGES.default;
```

**After:**
```javascript
// Use backend image or generate fallback
const imageUrl = companyData.image || // ✅ Use backend 'image' column
                companyData.logo ||   // Backup: maybe you have 'logo' too
                generateFallbackImage(companyData.name, companyId);
```

#### 1.3: Add Fallback Image Generator

**Add this function to the file:**

```javascript
/**
 * Generate fallback image for companies without images
 * Uses UI Avatars API to create dynamic placeholder
 */
function generateFallbackImage(companyName, companyId) {
  // Option 1: Use UI Avatars (generates initials-based image)
  const initials = companyName
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // Generate consistent color based on company ID
  const colors = ['4F46E5', '7C3AED', 'DB2777', 'DC2626', '059669', '2563EB'];
  const bgColor = colors[companyId % colors.length];

  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&size=200&background=${bgColor}&color=fff&bold=true`;

  // Option 2: Use local fallback (simple)
  // return DEFAULT_FALLBACK_IMAGE;

  // Option 3: Use placeholder service
  // return `https://placehold.co/200x200/e5e7eb/374151?text=${encodeURIComponent(companyName)}`;
}
```

#### 1.4: Remove Hidden Company Hardcode (Line 49)

**Before:**
```javascript
// Array of company IDs to hide from the companies list
const HIDDEN_COMPANY_IDS = ["12"];

// Later in code
const filteredCompanyIds = availableCompanyIds.filter(id =>
  !HIDDEN_COMPANY_IDS.includes(id.toString())
);
```

**After - Option A (If backend has `is_hidden`):**
```javascript
// No hardcoded constant needed!
// Filter happens in the backend query or in companyData check
const filteredCompanyIds = availableCompanyIds.filter(id => {
  const companyData = fetchCompanyData(id);
  return !companyData.is_hidden; // ✅ Use backend field
});
```

**After - Option B (If backend doesn't have `is_hidden` yet):**
```javascript
// Keep minimal array until backend updated
const HIDDEN_COMPANY_IDS = ["12"]; // TODO: Move to backend 'is_hidden' field

// Add comment to remove this later
const filteredCompanyIds = availableCompanyIds.filter(id =>
  !HIDDEN_COMPANY_IDS.includes(id.toString())
);
```

---

### Step 2: Update useCompanyInfo.js (Remove Mock Data)

**File:** `src/components/refactor/hooks/useCompanyInfo.js`

**Current Mock Data (Lines 1-23 aren't shown but exist):**

The file currently doesn't have hardcoded image mappings in the visible code, but ensure it fetches `image` from backend:

```javascript
// In the fetchCompanyInfo function, ensure you're fetching the image field
const rawData = await fetchCompanyInfoById(companyId);

// Make sure rawData includes the 'image' field from backend
console.log('Company data:', rawData); // Should show { id, name, image, ... }
```

**Verify the Edge Function returns image:**

Check `src/components/refactor/utils/supabaseEdgeFunctions.js` (or wherever `fetchCompanyInfoById` is defined):

```javascript
export async function fetchCompanyInfoById(id) {
  const { data, error } = await supabase
    .from('companies')
    .select('id, name, image, logo, description, website, currency_token') // ✅ Include 'image'
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}
```

---

### Step 3: Create Image Utility (Optional but Recommended)

**File:** `src/components/refactor/utils/imageUtils.js` (Create new file)

```javascript
/**
 * Utility functions for handling company images
 */

/**
 * Get company image with fallback
 * @param {Object} companyData - Company data from API
 * @returns {string} Image URL
 */
export function getCompanyImage(companyData) {
  // Priority 1: Backend 'image' field
  if (companyData.image) {
    return companyData.image;
  }

  // Priority 2: Backend 'logo' field (if exists)
  if (companyData.logo || companyData.logo_url) {
    return companyData.logo || companyData.logo_url;
  }

  // Priority 3: Generate fallback
  return generateFallbackImage(companyData.name, companyData.id);
}

/**
 * Generate fallback image using UI Avatars
 * @param {string} name - Company name
 * @param {number} id - Company ID
 * @returns {string} Fallback image URL
 */
export function generateFallbackImage(name, id) {
  const initials = name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // Generate consistent color from ID
  const colors = ['4F46E5', '7C3AED', 'DB2777', 'DC2626', '059669', '2563EB'];
  const bgColor = colors[id % colors.length];

  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&size=200&background=${bgColor}&color=fff&bold=true`;
}

/**
 * Verify if image URL is accessible (client-side)
 * @param {string} url - Image URL to verify
 * @returns {Promise<boolean>}
 */
export async function verifyImageUrl(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;

    // Timeout after 5 seconds
    setTimeout(() => resolve(false), 5000);
  });
}

/**
 * Get image with verification
 * @param {Object} companyData - Company data
 * @returns {Promise<string>} Verified image URL or fallback
 */
export async function getVerifiedCompanyImage(companyData) {
  const imageUrl = getCompanyImage(companyData);

  // Try to verify the image
  const isValid = await verifyImageUrl(imageUrl);

  if (isValid) {
    return imageUrl;
  }

  // If verification failed, return generated fallback
  return generateFallbackImage(companyData.name, companyData.id);
}
```

**Then update CompaniesDataTransformer.jsx to use this:**

```javascript
import { getCompanyImage } from '../../refactor/utils/imageUtils';

// In fetchAndTransformCompanies function
const imageUrl = getCompanyImage(companyData); // ✅ Clean!
```

---

### Step 4: Update ProposalsCard.jsx (Use Dynamic Images)

**File:** `src/components/futarchyFi/proposalsList/cards/ProposalsCard.jsx`

**Before (if it has hardcoded logic):**
```javascript
// Some hardcoded image logic might exist
<img src="/assets/gnosis-market-card-133.png" />
```

**After:**
```javascript
import { getCompanyImage } from '../../refactor/utils/imageUtils';

export function ProposalsCard({ proposal }) {
  // Get company image from proposal data
  const companyImage = proposal.company?.image ||
                      getCompanyImage(proposal.company);

  return (
    <div className="proposal-card">
      <img
        src={companyImage}
        alt={proposal.company?.name}
        onError={(e) => {
          // Fallback if image fails to load
          e.target.src = generateFallbackImage(proposal.company?.name, proposal.company?.id);
        }}
      />
      {/* Rest of card */}
    </div>
  );
}
```

---

### Step 5: Update supabase.js Constants (Optional)

**File:** `src/components/refactor/constants/supabase.js`

If you have `DEFAULT_COMPANY_ID = 9`, you can either:

**Option A: Keep it (simplest):**
```javascript
// Keep for now, it's just a default
export const DEFAULT_COMPANY_ID = 9;
```

**Option B: Make it dynamic:**
```javascript
// Remove hardcoded default, get from user preference or most active company
export async function getDefaultCompanyId() {
  // Check localStorage first
  const savedDefault = localStorage.getItem('defaultCompanyId');
  if (savedDefault) return parseInt(savedDefault);

  // Fallback to most active company or first visible company
  const { data } = await supabase
    .from('companies')
    .select('id')
    .eq('is_hidden', false)
    .order('id', { ascending: true })
    .limit(1)
    .single();

  return data?.id || 9; // Fallback to 9 if query fails
}
```

---

## Complete Code Changes Summary

### Files to Modify

1. **CompaniesDataTransformer.jsx** (Main changes)
   - Remove `COMPANY_IMAGES` constant
   - Update image URL logic
   - Add `generateFallbackImage()` function
   - (Optional) Remove `HIDDEN_COMPANY_IDS`

2. **Create imageUtils.js** (New file)
   - `getCompanyImage()`
   - `generateFallbackImage()`
   - `verifyImageUrl()`

3. **Update ProposalsCard.jsx** (If needed)
   - Use dynamic images from company data
   - Add error fallback

4. **Verify supabaseEdgeFunctions.js**
   - Ensure `fetchCompanyInfoById()` fetches `image` field

---

## Testing Checklist

### Manual Tests

- [ ] **Test 1: Companies Page**
  ```bash
  npm run dev
  # Visit http://localhost:3000/companies
  ```
  - [ ] All companies show images
  - [ ] Company 9 (Gnosis) shows correct logo
  - [ ] Company 10 (Kleros) shows correct logo
  - [ ] Company 11 (Tesla) shows correct logo
  - [ ] Company 12 (Starbucks) is hidden OR shows if is_hidden=false

- [ ] **Test 2: Fallback Images**
  - [ ] Temporarily break an image URL in backend
  - [ ] Check that fallback avatar appears
  - [ ] Verify initials are correct (e.g., "GD" for Gnosis DAO)

- [ ] **Test 3: Markets/Proposals**
  - [ ] Visit markets page
  - [ ] All market cards show company images
  - [ ] No broken image icons

- [ ] **Test 4: Console**
  - [ ] No errors in browser console
  - [ ] No warnings about missing images

### Verify Removal

Run these commands to ensure hardcoded references are gone:

```bash
# Check for hardcoded image mappings
grep -n "COMPANY_IMAGES" src/components/futarchyFi/companyList/page/CompaniesDataTransformer.jsx

# Should return: (nothing or just comments)

# Check for hardcoded company IDs in image logic
grep -n "gnosis.*png\|kleros.*png\|tesla.*png" src/

# Should return: Only the actual local image files in /public/assets, not in JS
```

---

## Migration Script (Optional)

If you want to migrate all existing images to the backend in one go:

**File:** `scripts/migrate-images-to-backend.js`

```javascript
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // Use service key for admin access
);

// Hardcoded mappings (one last time!)
const COMPANY_IMAGE_MAPPINGS = {
  9: '/assets/gnosis-dao-logo.png',
  10: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQyIR2uIantnjRlVbeUGiDe35Pcg6ku-lgLcw&s',
  11: '/assets/ceos/ceos-companies-logo/tesla.png',
  12: '/assets/starbucks-logo.png', // If exists
};

async function migrateImages() {
  for (const [companyId, imageUrl] of Object.entries(COMPANY_IMAGE_MAPPINGS)) {
    console.log(`Migrating company ${companyId}: ${imageUrl}`);

    const { error } = await supabase
      .from('companies')
      .update({ image: imageUrl })
      .eq('id', parseInt(companyId));

    if (error) {
      console.error(`Failed to update company ${companyId}:`, error);
    } else {
      console.log(`✅ Updated company ${companyId}`);
    }
  }

  console.log('Migration complete!');
}

migrateImages();
```

**Run it once:**
```bash
node scripts/migrate-images-to-backend.js
```

---

## Rollback Plan

If something breaks:

### Quick Rollback (< 5 min)

```bash
# Restore the old file
git checkout HEAD~1 src/components/futarchyFi/companyList/page/CompaniesDataTransformer.jsx

# Rebuild
npm run dev
```

### Keep Both Systems Temporarily

```javascript
// In CompaniesDataTransformer.jsx
const USE_LEGACY_IMAGES = process.env.NEXT_PUBLIC_USE_LEGACY_IMAGES === 'true';

const imageUrl = USE_LEGACY_IMAGES
  ? (COMPANY_IMAGES[companyName] || COMPANY_IMAGES.default) // Old way
  : (companyData.image || generateFallbackImage(companyData.name, companyId)); // New way
```

Then toggle in `.env`:
```bash
NEXT_PUBLIC_USE_LEGACY_IMAGES=false  # Use new system
# or
NEXT_PUBLIC_USE_LEGACY_IMAGES=true   # Use old system
```

---

## Expected Results

### Before Refactoring ❌
- **Hardcoded mappings:** 11 entries in `COMPANY_IMAGES`
- **Hardcoded hidden IDs:** 1 entry in `HIDDEN_COMPANY_IDS`
- **Lines of code:** ~37 lines just for mappings
- **To add new company:** Edit code + deploy

### After Refactoring ✅
- **Hardcoded mappings:** 0 (or 1 minimal fallback)
- **Hardcoded hidden IDs:** 0 (use backend)
- **Lines of code:** ~10 lines (just fallback function)
- **To add new company:** Update database only!

### Code Diff

```diff
- const COMPANY_IMAGES = {
-   "gnosis": "/assets/gnosis-dao-logo.png",
-   "kleros": "https://...",
-   // ... 11 entries
- };

+ const DEFAULT_FALLBACK_IMAGE = "/assets/default-company-logo.png";
+ function generateFallbackImage(name, id) { /* ... */ }

- const imageUrl = companyData.logo ||
-                 COMPANY_IMAGES[companyName] ||
-                 COMPANY_IMAGES[companyId.toString()] ||
-                 COMPANY_IMAGES.default;

+ const imageUrl = companyData.image ||
+                 generateFallbackImage(companyData.name, companyId);
```

---

## Timeline

| Task | Duration | Status |
|------|----------|--------|
| 1. Update CompaniesDataTransformer.jsx | 30 min | ⬜ |
| 2. Create imageUtils.js | 20 min | ⬜ |
| 3. Update ProposalsCard.jsx | 15 min | ⬜ |
| 4. Verify supabaseEdgeFunctions.js | 10 min | ⬜ |
| 5. Test companies page | 15 min | ⬜ |
| 6. Test markets/proposals | 15 min | ⬜ |
| 7. Test fallbacks | 10 min | ⬜ |
| 8. Remove console logs | 5 min | ⬜ |
| **Total** | **~2 hours** | |

---

## Next Steps

1. **Start with Step 1:** Update `CompaniesDataTransformer.jsx`
2. **Test immediately:** Run `npm run dev` after each step
3. **Verify in browser:** Check companies page
4. **Commit changes:** Git commit after successful test
5. **Deploy:** Push to staging first, then production

---

**Document Version:** 1.0
**Last Updated:** 2025-11-12
**Complexity:** Low (frontend only)
**Risk:** Low (backend already ready)
**Time Estimate:** 2-3 hours

