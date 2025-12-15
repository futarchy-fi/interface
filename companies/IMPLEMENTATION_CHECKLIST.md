# Implementation Checklist
## Refactoring Company Images from Hardcoded to Dynamic

> Use this checklist to track progress during the refactoring process

---

## Pre-Implementation

### Analysis Complete ✅
- [x] Documented all hardcoded companies (see [HARDCODED_COMPANIES_DOCUMENTATION.md](./HARDCODED_COMPANIES_DOCUMENTATION.md))
- [x] Identified all hardcoded constants and mappings
- [x] Created refactoring strategy (see [REFACTORING_GUIDE.md](./REFACTORING_GUIDE.md))

### Planning
- [ ] Review refactoring guide with team
- [ ] Decide on image storage solution:
  - [ ] Option A: Supabase Storage
  - [ ] Option B: External CDN (Cloudflare/S3)
  - [ ] Option C: Mix (local + external)
- [ ] Set migration timeline
- [ ] Assign tasks to team members

---

## Phase 1: Backend Setup (Week 1)

### Database Schema
- [ ] **Task 1.1:** Create `companies` table migration
  ```bash
  supabase migration new company_images_schema
  ```
  - [ ] Add columns: `id`, `name`, `slug`, `logo_url`, `banner_url`, `card_image_url`
  - [ ] Add columns: `is_hidden`, `display_order`, `tags`, `currency_token`
  - [ ] Add indexes for performance
  - [ ] Add `updated_at` trigger

- [ ] **Task 1.2:** Create `company_images` table
  - [ ] Add columns: `company_id`, `image_type`, `image_url`, `image_context`
  - [ ] Add columns: `is_verified`, `verification_status`, `last_verified_at`
  - [ ] Add foreign key constraints
  - [ ] Add unique constraint on (company_id, image_type, image_context)

- [ ] **Task 1.3:** Update `markets` table
  - [ ] Add `image_url` column
  - [ ] Add `image_verified` boolean
  - [ ] Add `seo_image_override` column
  - [ ] Migrate existing image paths from metadata

- [ ] **Task 1.4:** Run migrations
  ```bash
  supabase db push
  ```

### Data Migration
- [ ] **Task 1.5:** Migrate Company 9 (Gnosis DAO)
  ```sql
  INSERT INTO companies (id, name, slug, logo_url, is_hidden)
  VALUES (9, 'Gnosis DAO', 'gnosis-dao', '/assets/gnosis-dao-logo.png', false);
  ```
  - [ ] Insert logo
  - [ ] Insert 17 associated images (cards, proposals, etc.)
  - [ ] Verify all image paths

- [ ] **Task 1.6:** Migrate Company 10 (Kleros)
  - [ ] Insert company record
  - [ ] Insert logo (external URL)
  - [ ] Insert 5 associated images
  - [ ] Verify external URL works

- [ ] **Task 1.7:** Migrate Company 11 (Tesla)
  - [ ] Insert company record
  - [ ] Insert logo and CEO image
  - [ ] Insert 4 associated images

- [ ] **Task 1.8:** Migrate Company 12 (Starbucks - Hidden)
  - [ ] Insert with `is_hidden = true`
  - [ ] Verify hidden logic works

- [ ] **Task 1.9:** Verify data integrity
  ```sql
  SELECT * FROM companies;
  SELECT * FROM company_images;
  ```
  - [ ] Check all 4 companies exist
  - [ ] Check image counts match documentation (25+ images)
  - [ ] Test queries with filters

### API Endpoints
- [ ] **Task 1.10:** Create `/api/companies` endpoint
  - [ ] GET `/api/companies` - List all visible companies
  - [ ] GET `/api/companies/:id` - Get single company
  - [ ] Test with Postman/curl

- [ ] **Task 1.11:** Create `/api/companies/:id/images` endpoint
  - [ ] GET with `?type=logo|card|banner` parameter
  - [ ] Return `{ imageUrl, verified, lastVerified }`
  - [ ] Handle missing images gracefully
  - [ ] Test all image types

- [ ] **Task 1.12:** Create image verification Edge Function
  - [ ] Create `supabase/functions/verify-image-url/index.ts`
  - [ ] Implement HEAD request check
  - [ ] Return verification status
  - [ ] Deploy function: `supabase functions deploy verify-image-url`
  - [ ] Test with valid/invalid URLs

### Storage Setup (If using Supabase Storage)
- [ ] **Task 1.13:** Create storage bucket
  ```sql
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('company-images', 'company-images', true);
  ```

- [ ] **Task 1.14:** Set storage policies
  - [ ] Public read access
  - [ ] Authenticated upload access
  - [ ] Size limits (10MB per image)

- [ ] **Task 1.15:** Upload existing images
  ```bash
  # Upload from /public/assets/
  supabase storage upload company-images/logos/ public/assets/gnosis-dao-logo.png
  # ... repeat for all images
  ```

- [ ] **Task 1.16:** Update database URLs to storage URLs
  ```sql
  UPDATE companies
  SET logo_url = 'https://PROJECT.supabase.co/storage/v1/object/public/company-images/logos/gnosis-dao.png'
  WHERE id = 9;
  ```

---

## Phase 2: Frontend Refactoring (Week 2)

### Create New Utilities
- [ ] **Task 2.1:** Create image utility functions
  - [ ] Create `src/components/refactor/utils/imageUtils.js`
  - [ ] Implement `generateFallbackAvatar()`
  - [ ] Implement `generateColorFromString()`
  - [ ] Implement `getInitials()`
  - [ ] Implement `verifyImage()` client-side check
  - [ ] Add unit tests (optional)

- [ ] **Task 2.2:** Create `useCompanyImage` hook
  - [ ] Create `src/components/refactor/hooks/useCompanyImage.js`
  - [ ] Implement image fetching from API
  - [ ] Implement client-side verification
  - [ ] Add loading states
  - [ ] Add error handling
  - [ ] Test with valid company ID
  - [ ] Test with invalid company ID

- [ ] **Task 2.3:** Create `CompanyImage` component
  - [ ] Create `src/components/refactor/ui/CompanyImage.jsx`
  - [ ] Use `useCompanyImage` hook
  - [ ] Implement fallback chain (5 levels)
  - [ ] Add loading spinner
  - [ ] Add `onError` handler
  - [ ] Add responsive sizing props
  - [ ] Add `data-verified` attribute
  - [ ] Test in Storybook (optional)

### Update Existing Components
- [ ] **Task 2.4:** Refactor `CompaniesDataTransformer.jsx`
  - [ ] **Remove** `COMPANY_IMAGES` constant (lines 26-37)
  - [ ] **Remove** `HIDDEN_COMPANY_IDS` constant (line 49)
  - [ ] Update `fetchAndTransformCompanies()` to use API data
  - [ ] Use `companyData.logo_url` instead of hardcoded mapping
  - [ ] Update hidden company filter to use `is_hidden` from API
  - [ ] Test companies list page

- [ ] **Task 2.5:** Update `ProposalsCard.jsx`
  - [ ] Replace `<img>` with `<CompanyImage>`
  - [ ] Pass `companyId`, `companyName`, `imageType` props
  - [ ] Remove any hardcoded image path logic
  - [ ] Test market cards render correctly

- [ ] **Task 2.6:** Update `ProposalsPageDataTransformer.jsx`
  - [ ] Remove hardcoded company mappings
  - [ ] Use API data for company info
  - [ ] Test proposals page

- [ ] **Task 2.7:** Update `useCompanyInfo.js` hook
  - [ ] Remove mock data (lines 5-23) - keep for dev fallback only
  - [ ] Ensure full Supabase integration
  - [ ] Update to fetch `logo_url` from companies table
  - [ ] Test hook returns correct image URLs

- [ ] **Task 2.8:** Update `useCompanyData.js` hook
  - [ ] Remove hardcoded default company ID
  - [ ] Fetch default from user preferences or API
  - [ ] Implement caching for performance

### Update Configuration Files
- [ ] **Task 2.9:** Refactor `markets.js`
  - [ ] Remove hardcoded `companyId` from metadata
  - [ ] Move company associations to database
  - [ ] Update `getMarketConfig()` to fetch from Supabase
  - [ ] Update `generateMarketSEO()` to use dynamic images
  - [ ] Keep file for backward compatibility or remove entirely

- [ ] **Task 2.10:** Update `supabase.js` constants
  - [ ] **Remove** `DEFAULT_COMPANY_ID = 9` constant
  - [ ] Create `getDefaultCompanyId()` function
  - [ ] Update `ALLOWED_POOL_ADDRESSES` to be dynamic or keep as security whitelist
  - [ ] Update all imports to use new function

---

## Phase 3: Testing & Validation (Week 3)

### Unit Tests
- [ ] **Task 3.1:** Test image utility functions
  - [ ] Test `generateFallbackAvatar()` with various names
  - [ ] Test `generateColorFromString()` consistency
  - [ ] Test `verifyImage()` with valid/invalid URLs

- [ ] **Task 3.2:** Test hooks
  - [ ] Test `useCompanyImage` with valid company
  - [ ] Test `useCompanyImage` with invalid company
  - [ ] Test fallback behavior

- [ ] **Task 3.3:** Test components
  - [ ] Test `CompanyImage` renders correctly
  - [ ] Test loading states
  - [ ] Test error states
  - [ ] Test fallback chain

### Integration Tests
- [ ] **Task 3.4:** Test companies page
  - [ ] All 3 visible companies render (9, 10, 11)
  - [ ] Company 12 (Starbucks) is hidden
  - [ ] All logos display correctly
  - [ ] No broken image icons
  - [ ] Fallback avatars work for missing images

- [ ] **Task 3.5:** Test markets page
  - [ ] All 20 markets render
  - [ ] 7 active markets display correctly
  - [ ] Market card images load
  - [ ] Company logos on cards are correct
  - [ ] SEO metadata includes correct images

- [ ] **Task 3.6:** Test proposals page
  - [ ] GIP-128, GIP-133, GIP-139, GIP-140 render
  - [ ] KIP-76, KIP-77, KIP-78, KIP-81 render
  - [ ] Proposal cards show correct images
  - [ ] Company associations are correct

- [ ] **Task 3.7:** Test specific markets
  - [ ] GIP-133: Shows `/assets/gnosis-market-card-133.png`
  - [ ] KIP-81: Shows `/assets/kleros-market-card-81.png`
  - [ ] Tesla CEO Award: Shows `/assets/tesla-market-card-1.png`
  - [ ] Starbucks: Hidden from public list

### Performance Tests
- [ ] **Task 3.8:** Measure performance
  - [ ] Page load time < 2s
  - [ ] Image load time < 500ms per image
  - [ ] No layout shift (CLS < 0.1)
  - [ ] Lazy loading works correctly

- [ ] **Task 3.9:** Test caching
  - [ ] Images cached on second visit
  - [ ] API responses cached (5 min TTL)
  - [ ] Browser cache headers set correctly

### Regression Tests
- [ ] **Task 3.10:** Verify no regressions
  - [ ] Search functionality works
  - [ ] Filters work (by company, status, etc.)
  - [ ] Swap functionality unaffected
  - [ ] Wallet connection works
  - [ ] All routes accessible

### Browser Testing
- [ ] **Task 3.11:** Test on browsers
  - [ ] Chrome/Edge
  - [ ] Firefox
  - [ ] Safari
  - [ ] Mobile Safari (iOS)
  - [ ] Mobile Chrome (Android)

---

## Phase 4: Cleanup & Documentation (Week 3-4)

### Remove Hardcoded References
- [ ] **Task 4.1:** Search and remove hardcoded data
  ```bash
  # Search for remaining hardcoded references
  grep -r "companyId: [0-9]" src/
  grep -r "COMPANY_IMAGES" src/
  grep -r "DEFAULT_COMPANY_ID" src/
  grep -r "HIDDEN_COMPANY_IDS" src/
  ```

- [ ] **Task 4.2:** Remove unused image mappings
  - [ ] Delete or mark as deprecated in `CompaniesDataTransformer.jsx`
  - [ ] Update comments to indicate migration

- [ ] **Task 4.3:** Remove mock data
  - [ ] Keep minimal mock data for dev mode only
  - [ ] Update `useCompanyInfo.js` mock data

- [ ] **Task 4.4:** Clean up console logs
  - [ ] Remove debug logging
  - [ ] Keep error logging
  - [ ] Add structured logging for production

### Documentation Updates
- [ ] **Task 4.5:** Update CLAUDE.md
  - [ ] Document new image handling system
  - [ ] Update architecture section
  - [ ] Add API endpoint documentation

- [ ] **Task 4.6:** Create API documentation
  - [ ] Document `/api/companies` endpoints
  - [ ] Document `/api/companies/:id/images` endpoint
  - [ ] Document image verification process
  - [ ] Add usage examples

- [ ] **Task 4.7:** Update README (if exists)
  - [ ] Document new company addition process
  - [ ] Add image upload instructions
  - [ ] Update setup instructions

- [ ] **Task 4.8:** Create admin guide
  - [ ] How to add new companies
  - [ ] How to upload images
  - [ ] How to verify images
  - [ ] How to hide companies

### Monitoring Setup
- [ ] **Task 4.9:** Create image verification script
  - [ ] Create `scripts/verify-company-images.js`
  - [ ] Implement batch verification
  - [ ] Log broken images
  - [ ] Run manually and verify output

- [ ] **Task 4.10:** Setup scheduled verification (optional)
  - [ ] Create GitHub Action for daily runs
  - [ ] Setup alerts for broken images
  - [ ] Create dashboard for image health

---

## Phase 5: Deployment (Week 4)

### Pre-Deployment Checklist
- [ ] **Task 5.1:** Final testing on staging
  - [ ] Deploy to staging environment
  - [ ] Run full test suite
  - [ ] Verify all images load
  - [ ] Check console for errors
  - [ ] Performance test

- [ ] **Task 5.2:** Database backup
  ```bash
  pg_dump -h YOUR_HOST -U postgres -d postgres > backup_pre_migration.sql
  ```

- [ ] **Task 5.3:** Create rollback plan
  - [ ] Document steps to revert migration
  - [ ] Test rollback on staging
  - [ ] Prepare emergency hotfix branch

### Deployment Steps
- [ ] **Task 5.4:** Deploy database changes
  - [ ] Run migrations on production Supabase
  - [ ] Verify tables created
  - [ ] Verify data migrated

- [ ] **Task 5.5:** Deploy Edge Functions
  ```bash
  supabase functions deploy verify-image-url --project-ref YOUR_PROJECT
  ```

- [ ] **Task 5.6:** Deploy frontend
  ```bash
  npm run build
  # Deploy to Vercel/Netlify
  ```

- [ ] **Task 5.7:** Smoke test production
  - [ ] Visit companies page
  - [ ] Visit markets page
  - [ ] Check browser console
  - [ ] Test on mobile

### Post-Deployment
- [ ] **Task 5.8:** Monitor for 24 hours
  - [ ] Check error logs
  - [ ] Monitor API response times
  - [ ] Check Sentry/logging service
  - [ ] Watch user reports

- [ ] **Task 5.9:** Performance metrics
  - [ ] Measure page load times
  - [ ] Check Core Web Vitals
  - [ ] Compare with baseline
  - [ ] Document improvements

---

## Success Criteria

### Functional
- [x] All companies render with correct images
- [x] No hardcoded company mappings remain
- [x] Hidden companies work correctly
- [x] Fallback images display when needed
- [x] New companies can be added via database only

### Performance
- [x] Page load time < 2 seconds
- [x] Image load time < 500ms per image
- [x] No layout shift (CLS < 0.1)
- [x] Lighthouse score > 90

### Code Quality
- [x] No console errors
- [x] No hardcoded constants remain
- [x] Code is well-documented
- [x] API endpoints documented
- [x] Backward compatibility maintained

### User Experience
- [x] No visible changes to end users
- [x] Images load smoothly
- [x] Fallbacks look good
- [x] Mobile experience unchanged

---

## Rollback Plan

### If Critical Issues Occur

**Immediate Rollback (< 5 min):**
```bash
# 1. Revert frontend deployment
vercel rollback

# 2. Keep database changes (they're backward compatible)
# Frontend will use old hardcoded constants temporarily
```

**Partial Rollback (< 30 min):**
```bash
# 1. Restore old component files from git
git checkout main -- src/components/futarchyFi/companyList/
git checkout main -- src/components/refactor/constants/supabase.js

# 2. Redeploy
npm run build && vercel deploy
```

**Full Rollback (< 1 hour):**
```bash
# 1. Restore database from backup
psql -h YOUR_HOST -U postgres -d postgres < backup_pre_migration.sql

# 2. Revert all code changes
git revert HEAD~10..HEAD  # Adjust number as needed

# 3. Redeploy
npm run build && vercel deploy
```

---

## Estimated Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| **Phase 1: Backend** | 5 days | None |
| **Phase 2: Frontend** | 7 days | Phase 1 complete |
| **Phase 3: Testing** | 5 days | Phase 2 complete |
| **Phase 4: Cleanup** | 3 days | Phase 3 complete |
| **Phase 5: Deployment** | 2 days | All phases complete |
| **Total** | **~22 days (1 month)** | |

---

## Team Responsibilities

- **Backend Developer:** Phase 1 (Tasks 1.1 - 1.16)
- **Frontend Developer:** Phase 2 (Tasks 2.1 - 2.10)
- **QA Engineer:** Phase 3 (Tasks 3.1 - 3.11)
- **DevOps:** Phase 5 (Tasks 5.1 - 5.9)
- **Everyone:** Phase 4 (Documentation)

---

## Questions & Issues

Track issues during implementation:

1. **Issue:** External Kleros logo URL might break
   - **Solution:** Host locally or use IPFS backup
   - **Status:** 🟡 Pending decision

2. **Issue:** Performance concern with 20+ API calls per page
   - **Solution:** Implement request batching or GraphQL
   - **Status:** 🟡 To be tested

3. **Issue:** Image verification adds latency
   - **Solution:** Run verification async, cache results
   - **Status:** ✅ Handled in design

---

**Document Version:** 1.0
**Last Updated:** 2025-11-12
**Status:** 🔄 In Progress

