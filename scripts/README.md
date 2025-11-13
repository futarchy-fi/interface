# Scripts Documentation

## SEO Generation System

### `generate-seo.js`

Automatically generates SEO metadata for all markets from the Supabase database.

#### What it does:
1. **Fetches all markets** from `market_event` table in Supabase
2. **Generates SEO metadata** for each market:
   - Title (cleaned and optimized)
   - Description (meta description for social sharing)
   - Image (defaults or from market metadata)
   - Keywords (token-specific and category-based)
   - Open Graph and Twitter Card data
3. **Determines active status** based on resolution and visibility
4. **Updates `src/config/markets.js`** with the generated configuration

#### Usage:

```bash
# Generate SEO data manually
npm run generate-seo

# Build (automatically runs generate-seo first)
npm run build

# Build without SEO generation (if needed for testing)
npm run build-only
```

#### Environment Variables Required:
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon/public key

#### SEO Data Priority:

1. **Custom SEO metadata** - `market.metadata.seo.{title|description|image}`
2. **Display titles** - `market.metadata.display_title_0` + `display_title_1`
3. **Generated fallbacks** - Based on market title, tokens, and description

#### Market Status Logic:

Markets are marked as **active** (will be statically generated) if:
- `resolution_status !== 'resolved'`
- `visibility !== 'test'`
- `approval_status` is `'on_going'`, `'ongoing'`, or `'pending_review'`

#### Generated Files:

- **`src/config/markets.js`** - Complete markets configuration with SEO data

#### Build Integration:

The build process automatically runs:
1. `npm run generate-seo` - Fetches latest markets and generates SEO
2. `next build` - Builds static pages for all active markets

This ensures your market pages always have up-to-date SEO metadata and only active markets are included in the build.

#### Customizing SEO Data:

To customize SEO for specific markets, add to the market's metadata in Supabase:

```json
{
  "metadata": {
    "seo": {
      "title": "Custom Market Title",
      "description": "Custom description for social sharing",
      "image": "/assets/custom-market-image.png"
    }
  }
}
```

The script will prioritize these custom values over auto-generated ones. 