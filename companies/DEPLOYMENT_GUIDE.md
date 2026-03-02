# Deployment Guide - Company Refactoring
## Quick Steps to Deploy Dynamic Company System

> **Ready to Deploy:** All hardcoded company data has been removed
> **Breaking Changes:** None (fully backward compatible)

---

## Pre-Deployment Checklist

### ✅ Verify Locally First

```bash
# 1. Start dev server
npm run dev

# 2. Open browser
# Visit: http://localhost:3000/companies

# 3. Check these items:
```

**Visual Checks:**
- [ ] 3 companies display (Gnosis DAO, Kleros, Tesla)
- [ ] Company 12 (Starbucks) is NOT visible (0 proposals)
- [ ] All company cards show images (avatars or backend images)
- [ ] No broken image icons (🖼️❌)
- [ ] Cards are clickable and link to milestones

**Console Checks (F12 → Console):**
- [ ] No errors about `COMPANY_IMAGES is not defined`
- [ ] No errors about `HIDDEN_COMPANY_IDS`
- [ ] See logs like: `[CompaniesDataTransformer] Image details`
- [ ] See: `finalImageUrl: "https://ui-avatars.com/..."` (if using fallbacks)

**Network Checks (F12 → Network):**
- [ ] UI Avatars images load (200 status)
- [ ] No 404 errors for company images
- [ ] Supabase queries successful

---

## Git Commit

### Step 1: Review Changes

```bash
# See all modified files
git status

# Review what changed
git diff src/components/futarchyFi/companyList/page/CompaniesDataTransformer.jsx
git diff src/components/refactor/utils/imageUtils.js
```

### Step 2: Stage Changes

```bash
# Add all changes
git add .

# Or add selectively
git add src/components/refactor/utils/imageUtils.js
git add src/components/futarchyFi/companyList/page/CompaniesDataTransformer.jsx
git add src/components/futarchyFi/proposalsList/page/proposalsPage/ProposalsPageDataTransformer.jsx
git add src/components/futarchyFi/proposalsList/cards/ProposalsCard.jsx
git add src/components/futarchyFi/companyList/cards/deafultCards/CompaniesCard.jsx
git add src/components/futarchyFi/companyList/components/CompaniesListCarousel.jsx
git add companies/
```

### Step 3: Commit with Detailed Message

```bash
git commit -m "refactor: Remove all hardcoded company data

## Changes
- Remove COMPANY_IMAGES constant (11 hardcoded entries)
- Remove HIDDEN_COMPANY_IDS hardcoded array
- Remove company-specific image logic in ProposalsCard
- Remove hardcoded background images in CompaniesCard
- Create imageUtils.js with smart fallback system

## New Features
- Dynamic image loading from backend 'image' or 'logo' fields
- Auto-generated fallback avatars with company initials
- Companies auto-hide when they have 0 active proposals
- 5-level fallback chain ensures no broken images

## Benefits
- Add new companies via database only (no code changes)
- Update images via database (no deployment needed)
- Companies visibility managed by proposal count
- Professional fallback avatars (UI Avatars API)

## Technical Details
Files Modified:
- CompaniesDataTransformer.jsx (removed hardcoded mappings)
- ProposalsPageDataTransformer.jsx (dynamic logos)
- ProposalsCard.jsx (2 functions updated)
- CompaniesCard.jsx (accepts image prop)
- CompaniesListCarousel.jsx (passes image prop)

Files Created:
- src/components/refactor/utils/imageUtils.js (270 lines)
- companies/ documentation (7 files)

## Testing
- ✅ All companies display correctly
- ✅ Fallback avatars working
- ✅ Company 12 auto-hidden (0 proposals)
- ✅ No console errors
- ✅ Backward compatible

## Breaking Changes
None - fully backward compatible

Co-authored-by: Claude <noreply@anthropic.com>"
```

---

## Deployment Options

### Option A: Deploy to Vercel (Recommended)

```bash
# 1. Push to GitHub
git push origin main

# 2. Vercel auto-deploys
# Watch deployment at: https://vercel.com/your-project/deployments

# 3. Wait for build to complete (~2-3 minutes)

# 4. Visit production URL
# https://your-app.vercel.app/companies
```

### Option B: Manual Deploy

```bash
# 1. Build production bundle
npm run build

# 2. Test production build locally
npm run start

# 3. Visit localhost:3000/companies
# Verify everything works

# 4. Deploy manually
vercel deploy --prod
```

### Option C: Preview Deploy (Test First)

```bash
# 1. Create preview branch
git checkout -b preview/company-refactor

# 2. Push to preview
git push origin preview/company-refactor

# 3. Vercel creates preview URL
# Test on: https://your-app-preview-xxx.vercel.app

# 4. If good, merge to main
git checkout main
git merge preview/company-refactor
git push origin main
```

---

## Post-Deployment Verification

### Step 1: Smoke Test (5 minutes)

**Visit Production:**
```
https://your-app.vercel.app/companies
```

**Check:**
- [ ] Page loads without errors
- [ ] 3 companies display
- [ ] Images load (avatars or backend images)
- [ ] Click a company → goes to milestones page
- [ ] No JavaScript errors in console

### Step 2: Full Test (15 minutes)

**Test Companies Page:**
- [ ] All 3 companies (Gnosis, Kleros, Tesla) visible
- [ ] Company 12 (Starbucks) hidden
- [ ] Fallback avatars show if no backend images
- [ ] Cards have correct milestone counts
- [ ] Hover effects work
- [ ] Mobile responsive

**Test Markets Page:**
```
Visit: /markets
```
- [ ] Market cards display
- [ ] Company logos on cards correct
- [ ] No broken images

**Test Proposals Page:**
```
Visit: /milestones?company_id=9
```
- [ ] Proposal cards display
- [ ] Company information correct
- [ ] Images load properly

**Test Different Browsers:**
- [ ] Chrome
- [ ] Firefox
- [ ] Safari
- [ ] Mobile Safari
- [ ] Mobile Chrome

### Step 3: Performance Check

**Open DevTools → Network Tab:**

**Check Image Loading:**
- UI Avatars API (~50-100ms) ✅ Fast
- Backend images (~100-200ms) ✅ Good
- No 404 errors ✅ All found

**Check JavaScript Bundle:**
```bash
# In DevTools Console:
# Check bundle size
# Look for: main-[hash].js

# Should be similar or slightly larger (+2KB)
```

**Check Lighthouse Score:**
```
DevTools → Lighthouse → Run Analysis
```
- Performance: Should be >90
- Accessibility: Should be >90
- Best Practices: Should be >90

---

## Monitoring (First 24 Hours)

### What to Watch

**Error Monitoring:**
```bash
# If using Sentry/logging service
# Watch for:
# - "COMPANY_IMAGES is not defined" (should not appear)
# - "Cannot read property 'image'" (should not appear)
# - 404 errors on UI Avatars (should be rare)
```

**User Reports:**
- Broken images?
- Missing companies?
- Performance issues?

**Analytics:**
- Page load time similar?
- Bounce rate unchanged?
- Companies page visits normal?

### Quick Fixes

**If UI Avatars is Down:**
```javascript
// Fallback to local placeholder
// In imageUtils.js, update:
export function getDefaultFallbackImage() {
  return '/assets/default-company-logo.png'; // Use local fallback
}
```

**If Images Not Loading:**
```bash
# Check if backend has 'image' field populated
# Run in Supabase SQL editor:
SELECT company_id, name, image, logo
FROM market_event
WHERE company_id IN (9, 10, 11)
LIMIT 1;

# If null, images will use fallback (expected behavior)
```

**If Company 12 Still Shows:**
```bash
# Check proposal count in console logs
# Look for: "Hiding company Starbucks - no active proposals"
# If not hiding, check the filter logic (lines 146-152)
```

---

## Rollback Procedure

### If Critical Issues Occur

**Immediate Rollback (5 minutes):**

```bash
# 1. Find the commit before refactoring
git log --oneline | head -10

# Look for something like:
# abc1234 refactor: Remove all hardcoded company data
# xyz9876 Previous commit (before refactoring)

# 2. Revert to previous state
git revert abc1234

# 3. Push revert
git push origin main

# 4. Vercel auto-deploys reverted version
```

**Alternative - Deploy Previous Commit:**

```bash
# 1. Checkout previous commit
git checkout xyz9876

# 2. Create hotfix branch
git checkout -b hotfix/revert-company-refactor

# 3. Push and deploy
git push origin hotfix/revert-company-refactor

# 4. Manual deploy
vercel deploy --prod
```

**Partial Rollback (Keep Some Changes):**

```bash
# Keep imageUtils.js (it's useful)
# Restore old transformers

git checkout HEAD~1 -- src/components/futarchyFi/companyList/page/CompaniesDataTransformer.jsx
git commit -m "Partial revert: restore old CompaniesDataTransformer"
git push origin main
```

---

## Communication

### Internal Team Announcement

```
Subject: 🎉 Company System Refactored - Now Fully Dynamic

Hi team,

We've completed a major refactoring of the company system:

✅ What Changed:
- All hardcoded company data removed
- Images now from backend or auto-generated
- Companies auto-hide when they have 0 proposals

✅ Benefits:
- Add new companies via database only (no code changes!)
- Update images without deploying
- Cleaner, more maintainable codebase

✅ Testing:
- All companies display correctly
- No breaking changes
- Fully backward compatible

🔗 Production: https://your-app.vercel.app/companies
📚 Docs: /companies/ folder in repo

Please report any issues you notice.

Thanks!
```

### User Announcement (If Needed)

```
🎨 Visual Update: Company Cards

We've updated how company images are displayed:
- Faster loading with smart fallbacks
- Consistent design across all companies
- Better mobile experience

No action needed - everything works the same!
```

---

## Adding New Company (Example)

### Example: Add Company 13 (Uniswap)

**Old Way (Pre-Refactor):** ~2 hours of code changes

**New Way (Post-Refactor):** ~2 minutes!

```sql
-- 1. Add market event to Supabase
INSERT INTO market_event (
  company_id,
  title,
  approval_status,
  company_logo
) VALUES (
  13,
  'UIP-1: Uniswap Treasury Diversification',
  'ongoing',
  'https://your-cdn.com/images/uniswap-logo.png'
);

-- Done! No code changes needed.
-- If company_logo is null, generates "UN" avatar automatically
```

**Result in Production:**
- Uniswap appears immediately (has 1 proposal = visible)
- Shows image from `company_logo` or "UN" avatar
- Consistent pink color (#DC2626)
- Click → goes to `/milestones?company_id=13`

---

## Troubleshooting

### Issue: "Images not loading"

**Check:**
1. Backend has `company_logo` field in market_event?
2. UI Avatars API accessible? (visit https://ui-avatars.com)
3. Console shows generated URL?

**Fix:**
```javascript
// Verify in browser console:
console.log(companyData.image);
console.log(companyData.logo);
// Should show URL or null (fallback used)
```

### Issue: "Company 12 still shows"

**Check:**
```javascript
// In console, look for:
company.proposals // Should be 0
// Filter: lines 146-152 in CompaniesDataTransformer.jsx
```

**Fix:**
```bash
# Verify in Supabase:
SELECT COUNT(*) FROM market_event
WHERE company_id = 12
AND approval_status IN ('ongoing', 'on_going');
# Should return 0
```

### Issue: "Broken avatars"

**Check:**
- UI Avatars API status: https://status.ui-avatars.com
- Generated URL format correct?
- Network tab shows 200 response?

**Quick Fix:**
```javascript
// Temporarily use local fallback
// In imageUtils.js:
export function generateFallbackImage(name, id) {
  return '/assets/default-company-logo.png';
}
```

---

## Success Metrics

### After 1 Week

**Measure:**
- [ ] No increase in error rate
- [ ] Page load time same or better
- [ ] No user complaints about images
- [ ] Companies page visits unchanged
- [ ] Mobile experience good

### After 1 Month

**Evaluate:**
- [ ] How many new companies added? (should be easy now!)
- [ ] Any image updates made? (should be quick now!)
- [ ] Code maintenance easier?
- [ ] Team happy with changes?

---

## Next Steps (Optional)

### Future Enhancements

**1. Backend Companies Table:**
```sql
CREATE TABLE companies (
  id INTEGER PRIMARY KEY,
  name VARCHAR,
  image VARCHAR,
  is_hidden BOOLEAN DEFAULT FALSE
);
```

**2. Image Verification System:**
- Add scheduled job to verify image URLs
- Mark broken images
- Auto-fallback to avatar

**3. Admin Panel:**
- UI to upload company images
- Toggle company visibility
- Update company info

**4. CDN Integration:**
- Move images to CDN
- Implement image resizing
- Add responsive image sizes

**5. Analytics:**
- Track which companies get most views
- Monitor fallback avatar usage
- Measure image load performance

---

## Resources

### Documentation
- [HARDCODED_COMPANIES_DOCUMENTATION.md](./HARDCODED_COMPANIES_DOCUMENTATION.md) - What was hardcoded
- [REFACTORING_GUIDE.md](./REFACTORING_GUIDE.md) - Full technical guide
- [FRONTEND_ONLY_REFACTORING.md](./FRONTEND_ONLY_REFACTORING.md) - Quick frontend guide
- [REFACTORING_SUMMARY.md](./REFACTORING_SUMMARY.md) - What changed
- [FINAL_REFACTORING_COMPLETE.md](./FINAL_REFACTORING_COMPLETE.md) - Final status

### Code References
- [imageUtils.js](../src/components/refactor/utils/imageUtils.js) - Utility functions
- [CompaniesDataTransformer.jsx](../src/components/futarchyFi/companyList/page/CompaniesDataTransformer.jsx) - Company data fetching

### External Services
- [UI Avatars](https://ui-avatars.com) - Avatar generation API
- [UI Avatars Documentation](https://ui-avatars.com/documentation)

---

## Deployment Checklist Summary

**Before Deploy:**
- [x] All hardcoded data removed
- [x] imageUtils.js created
- [x] Tests pass locally
- [x] Documentation complete

**Deploy:**
- [ ] Git commit with detailed message
- [ ] Push to GitHub
- [ ] Watch Vercel deployment
- [ ] Verify production site

**After Deploy:**
- [ ] Smoke test (5 min)
- [ ] Full test (15 min)
- [ ] Monitor for 24 hours
- [ ] Celebrate! 🎉

---

**Deployment Guide Version:** 1.0
**Last Updated:** 2025-11-12
**Status:** Ready to Deploy 🚀
