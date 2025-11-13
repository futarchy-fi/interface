# Dynamic Markets with Build-Time SEO

This system enables dynamic market routes with optimized SEO metadata that's generated at build time.

## How It Works

### 1. Configuration File (`markets.js`)
- Contains SEO metadata for each market address
- Defines which markets should be statically generated
- Provides helper functions for accessing market data

### 2. Dynamic Route (`pages/markets/[address].js`)
- Handles all market addresses dynamically
- Uses `getStaticPaths` to generate pages at build time
- Uses `getStaticProps` to fetch SEO data and market information
- Includes full SEO optimization and structured data

### 3. Build Process
When you run `npm run build`:
1. Next.js reads all active markets from the configuration
2. Generates static HTML files for each market address
3. Each page includes optimized SEO metadata
4. Pages are cached and served quickly

## Adding New Markets

1. **Add to Configuration** (`src/config/markets.js`):
```javascript
"0xYourMarketAddress": {
  title: "Your Market Title",
  description: "Your market description...",
  image: "/assets/your-image.png",
  // ... other SEO fields
  isActive: true
}
```

2. **Add Image** (if using custom image):
Place your image in `public/assets/your-image.png`

3. **Build**:
```bash
npm run build
```

4. **Access**:
Your market will be available at `/markets/0xYourMarketAddress`

## SEO Features

✅ **Static Generation**: Pages generated at build time for fast loading  
✅ **Open Graph**: Optimized for social media sharing  
✅ **Twitter Cards**: Rich previews on Twitter  
✅ **Structured Data**: JSON-LD for search engines  
✅ **Meta Tags**: Title, description, keywords  
✅ **ISR Support**: Pages can be updated without full rebuild  

## Route Structure

- `/markets/[address]` - Dynamic market pages
- `/markets/` - Markets listing page
- `/market` - Legacy single market page (still supported)

## Benefits

1. **Fast Loading**: Static generation means instant page loads
2. **SEO Optimized**: Each market has custom metadata
3. **Social Sharing**: Rich previews on all platforms
4. **Scalable**: Easy to add new markets
5. **Flexible**: Configuration-driven approach

## Advanced Features

- **ISR (Incremental Static Regeneration)**: Pages update automatically
- **Fallback Handling**: New markets can be added without full rebuild
- **Error Handling**: Graceful 404s for unconfigured markets
- **Dynamic SEO**: Can override SEO data with live market data 