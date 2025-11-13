# 🏊 Pool Automation - Self-Contained Edition

This `swapr` folder now contains everything you need for futarchy pool automation! No external dependencies required.

## 📁 New Files Added

- `generate-pool-files.js` - Generate API-ready pool files from futarchy setup JSONs
- `call-pool-apis.js` - Make API calls to create pools automatically  
- `env.example` - Environment configuration template
- This README file

## 🚀 Quick Start

### 1. Install Dependencies (First Time Only)
```bash
cd swapr
npm install
```

### 2. Configure Environment (Optional)
```bash
# Copy the example environment file
cp env.example .env

# Edit with your API settings
nano .env
```

### 3. Generate Pool Files
```bash
# Generate from the latest futarchy-pool-setup file
npm run generate-pools

# Or from a specific file
npm run generate-pools-from futarchy-pool-setup-2025-06-23T20-35-46-777Z.json
```

### 4. Test API Calls (Recommended)
```bash
# Dry run - shows what would be called (SAFE)
npm run call-pool-apis-dry
```

### 5. Make Real API Calls
```bash
# Actually create the pools via API
npm run call-pool-apis
```

## 🔧 Environment Configuration

Create a `.env` file in the `swapr` folder:

```env
# Required: Your pool creation API endpoint
POOL_CREATION_URL=http://localhost:8000/api/v1/pools/create_pool

# Optional: Bearer token for authentication
BEARER_TOKEN=your_token_here
```

## 📊 What Happens

### Input: Futarchy Setup File
```json
{
  "proposalAddress": "0x8931595B426B9404CbF1E4804DE3A5897ea9cce4",
  "marketName": "Will futarchy exist in 2025?",
  "createdPools": [
    // ... 6 pools data
  ]
}
```

### Output: 6 API-Ready Pool Files
```
swapr/output/
├── futarchy-0x8931-pool-1.json  # YES_GNO / YES_sDAI
├── futarchy-0x8931-pool-2.json  # NO_GNO / NO_sDAI  
├── futarchy-0x8931-pool-3.json  # YES_GNO / sDAI
├── futarchy-0x8931-pool-4.json  # NO_GNO / sDAI
├── futarchy-0x8931-pool-5.json  # YES_sDAI / sDAI
└── futarchy-0x8931-pool-6.json  # NO_sDAI / sDAI
```

## 🎯 All Available Commands

### Pool Automation
```bash
npm run generate-pools            # Generate from latest setup file
npm run generate-pools-from <file>  # Generate from specific file
npm run call-pool-apis-dry        # Preview API calls (safe)
npm run call-pool-apis            # Make actual API calls
```

### Existing Futarchy Commands
```bash
npm run futarchy:auto             # Auto setup with config
npm run futarchy:auto:config      # Use futarchy-config.json
npm run interactive               # Interactive wizard
# ... all other existing commands work the same
```

### Help
```bash
npm run help                      # Show all available commands
```

## 🔄 Complete Workflow Example

```bash
# 1. Navigate to swapr folder
cd swapr

# 2. Set up environment (first time)
cp env.example .env
# Edit .env with your API details

# 3. Generate pools from latest futarchy setup
npm run generate-pools

# 4. Test what would be called
npm run call-pool-apis-dry

# Output shows:
# 🚀 Pool API Caller
# ==================
# 📡 API URL: http://localhost:8000/api/v1/pools/create_pool
# 🔐 Bearer Token: ***configured***
# 
# Found 6 pool files to process:
#   1. futarchy-0x8931-pool-1.json
#   2. futarchy-0x8931-pool-2.json
#   ...

# 5. Make the actual API calls
npm run call-pool-apis

# Output shows progress and results:
# ────────────────────────────────
# POOL 1 – YES_GNO / YES_sDAI
# ────────────────────────────────
# ✅ SUCCESS: Pool created successfully
# ...
```

## 💡 Pro Tips

### Working with Different Environments
```bash
# Development
POOL_CREATION_URL=http://localhost:8000/api/v1/pools/create_pool

# Staging  
POOL_CREATION_URL=https://staging-api.example.com/api/v1/pools/create_pool
BEARER_TOKEN=staging_token

# Production
POOL_CREATION_URL=https://api.example.com/api/v1/pools/create_pool  
BEARER_TOKEN=production_token
```

### Error Handling
- Script automatically retries with 1-second delays
- Comprehensive error reporting with status codes
- Dry run mode to test without side effects
- Summary report shows success/failure counts

### File Management
- Generated files go to `swapr/output/` 
- Automatic directory creation
- Handles missing `depositedLiquidity` gracefully (defaults to "0")
- Converts decimal amounts to wei automatically

## 🎉 Self-Contained Benefits

✅ **No external files needed** - Everything is in `swapr/`  
✅ **Own package.json** - Independent dependency management  
✅ **Local environment** - `.env` file in same directory  
✅ **Organized output** - All generated files in `swapr/output/`  
✅ **All commands available** - Both new and existing futarchy features  
✅ **Easy deployment** - Just zip the `swapr/` folder and go!

Now you can use the `swapr` folder as a complete standalone toolkit for all futarchy operations! 🚀 