# 🏊 Futarchy Pool Automation Toolkit

**Complete self-contained toolkit for creating and managing Futarchy prediction markets on Gnosis Chain.**

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D16.0.0-green.svg)
![License](https://img.shields.io/badge/license-MIT-yellow.svg)

## 🚀 Quick Start

### Installation
```bash
npm install
```

### Basic Usage
```bash
# 1. Generate pool files from latest futarchy setup
npm run generate-pools

# 2. Test API calls (safe preview)
npm run call-pool-apis-dry

# 3. Make actual pool creation calls
npm run call-pool-apis
```

## 🔧 Configuration

Create a `.env` file:
```env
POOL_CREATION_URL=http://localhost:8000/api/v1/pools/create_pool
BEARER_TOKEN=your_bearer_token_here
```

Copy from example:
```bash
cp env.example .env
```

## 📊 Features

### 🏗️ Pool Automation
- **Auto-generate** API-ready pool files from futarchy setup data
- **Batch create** up to 6 pools per proposal with one command
- **Environment configuration** for different API endpoints
- **Bearer token authentication** support
- **Dry run mode** for safe testing

### 🎯 Futarchy Operations
- **Interactive setup** for new proposals
- **Automatic pool creation** with config files
- **Liquidity management** (add/remove/view)
- **Token merging** after proposal resolution
- **Position tracking** and analytics

### 🔒 Error Handling
- Comprehensive error reporting
- Automatic retry logic with delays
- Progress tracking for batch operations
- Detailed success/failure summaries

## 📋 Available Commands

### Pool Automation
```bash
npm run generate-pools            # Generate from latest setup file
npm run generate-pools-from <file> # Generate from specific file
npm run call-pool-apis-dry        # Preview API calls (safe)
npm run call-pool-apis            # Make actual API calls
```

### Futarchy Management
```bash
npm run interactive               # Interactive mode wizard
npm run futarchy:auto:config      # Auto setup with config
npm run futarchy:create           # Create new proposal
```

### Liquidity Operations
```bash
npm run remove                    # Remove liquidity (interactive)
npm run view                     # View positions
npm run merge <proposalAddr>     # Merge conditional tokens
```

### Help
```bash
npm run help                     # Show all commands
```

## 🔄 Workflow

### 1. Create Pools
```bash
# Generate pool files
npm run generate-pools

# Preview what will be called
npm run call-pool-apis-dry

# Execute pool creation
npm run call-pool-apis
```

### 2. Manage Liquidity
```bash
# View current positions
npm run view

# Remove liquidity when needed
npm run remove
```

### 3. Resolve Markets
```bash
# After proposal resolution, merge tokens
npm run merge 0xYourProposalAddress
```

## 📁 File Structure

```
futarchy-pool-automation/
├── 📄 generate-pool-files.js     # Pool file generator
├── 📄 call-pool-apis.js          # API caller with auth
├── 📄 algebra-cli.js             # Main CLI interface
├── 🔧 package.json               # Dependencies & scripts
├── 🔧 env.example                # Environment template
├── 📁 output/                    # Generated pool files
├── 📁 node_modules/              # Dependencies
└── 📚 README.md                  # This file
```

## 🌐 Environment Configuration

### Development
```env
POOL_CREATION_URL=http://localhost:8000/api/v1/pools/create_pool
```

### Production
```env
POOL_CREATION_URL=https://api.yourservice.com/api/v1/pools/create_pool
BEARER_TOKEN=your_production_token
```

## 💡 Usage Examples

### Generate pools from specific file
```bash
npm run generate-pools-from futarchy-pool-setup-2025-06-23T20-35-46-777Z.json
```

### Test with custom API endpoint
```bash
POOL_CREATION_URL=https://staging-api.com/pools npm run call-pool-apis-dry
```

### Create proposal with custom config
```bash
npm run futarchy:auto:config
```

## 🎯 Output

Each futarchy setup generates 6 pool files:
- `futarchy-0xABCD-pool-1.json` - YES_GNO / YES_sDAI
- `futarchy-0xABCD-pool-2.json` - NO_GNO / NO_sDAI  
- `futarchy-0xABCD-pool-3.json` - YES_GNO / sDAI (Expected Value)
- `futarchy-0xABCD-pool-4.json` - NO_GNO / sDAI (Expected Value)
- `futarchy-0xABCD-pool-5.json` - YES_sDAI / sDAI (Prediction Market)
- `futarchy-0xABCD-pool-6.json` - NO_sDAI / sDAI (Prediction Market)

## 🛠️ Dependencies

- **Node.js** >= 16.0.0
- **axios** - HTTP client for API calls
- **dotenv** - Environment configuration
- **ethers** - Ethereum interactions
- **express** - Web server functionality

## 📄 License

MIT License - feel free to use this toolkit for your own futarchy implementations!

## 🤝 Contributing

This is a self-contained toolkit. For issues or improvements, please create an issue or submit a pull request.

---

**🎉 Happy Futarchy Trading! 🎉** 