# 🚀 Futarchy CLI - Beautiful Command Line Interface

A powerful and beautiful CLI for interacting with the Futarchy SDK, featuring full integration of fetchers, executors, and cartridges with automated transaction support.

## ✨ Features

- 🎨 **Beautiful Terminal UI** - Rich, colorful interface with ASCII art logo
- 📊 **Market Data Fetching** - Real-time pool data from Supabase or mock sources
- 💰 **Balance Checking** - View xDAI and sDAI balances
- ✅ **Token Approvals** - Automated ERC20 token approvals
- 🔄 **Position Management** - Split and redeem futarchy positions
- 🔐 **Private Key Support** - Automated transactions using environment variables
- 🧪 **Test Mode** - Test all operations without real transactions
- 📦 **Modular Architecture** - Clean separation of fetchers and executors

## 📋 Prerequisites

- Node.js v16 or higher
- npm or yarn
- Gnosis Chain wallet with xDAI for transactions (optional)

## 🛠️ Installation

1. **Clone the repository:**
```bash
git clone https://github.com/your-repo/futarchy-sdk.git
cd futarchy-sdk
```

2. **Install dependencies:**
```bash
npm install
```

3. **Setup environment variables:**
```bash
cp .env.example .env
```

4. **Configure your .env file:**
```env
# Add your private key (without 0x prefix)
PRIVATE_KEY=your_private_key_here

# Configure Supabase (optional)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key

# Enable auto-confirm for transactions
AUTO_CONFIRM=false
```

## 🚀 Usage

### Run the CLI

```bash
npm run futarchy-cli
# or
npm run cli
```

### CLI Features

The CLI presents an interactive menu with the following options:

#### 📊 View Market Data
- Fetch real-time pool candle data
- Display price and volume information
- Beautiful table formatting

#### 💰 Check Balances
- View xDAI balance
- View sDAI balance
- Requires wallet connection

#### ✅ Approve Tokens
- Approve tokens for spending
- Default to sDAI and Futarchy Router
- Customizable amounts

#### 🔄 Split Position
- Split sDAI into YES/NO tokens
- Specify proposal address
- Automated transaction execution

#### 🔍 Test Operations
- View all available operations
- Test fetchers and executors
- Verify system integration

## 🏗️ Architecture

The CLI integrates three main components:

### 1. DataLayer
Central orchestrator that routes operations to appropriate handlers.

### 2. Fetchers
- **MockFetcher**: Provides test data
- **SupabasePoolFetcher**: Fetches real pool data from Supabase

### 3. Executors
- **ViemExecutor**: Handles Web3 transactions
- **FutarchyCartridge**: Adds futarchy-specific operations

## 🔐 Security

### Private Key Management
- Store private keys in `.env` file only
- Never commit `.env` to version control
- Use different keys for mainnet/testnet
- Consider hardware wallets for production

### Environment Variables
```env
# Required for transactions
PRIVATE_KEY=your_key_without_0x

# Optional settings
AUTO_CONFIRM=false  # Require manual confirmation
USE_MOCK=false      # Use real data
DEBUG=false         # Debug logging
```

## 🎨 UI Components

### Beautiful Terminal Display
- ASCII art logo with gradient colors
- Colored status indicators
- Interactive menus with arrow navigation
- Loading spinners for async operations
- Formatted tables for data display

### Status Indicators
- ✅ Success (green)
- ❌ Error (red)
- ⚠️ Warning (yellow)
- 📊 Info (cyan)
- 🔗 Connected/Disconnected status

## 🧪 Testing

### Test without private key (read-only mode):
```bash
# Remove PRIVATE_KEY from .env
npm run cli
```

### Test with mock data:
```bash
# Set USE_MOCK=true in .env
npm run cli
```

### Test individual components:
```bash
# Test fetchers
npm run basefetch -- --list

# Test executors
npm run baseexec -- --list
```

## 📝 Commands Reference

### Main Menu Options

| Option | Description | Requires Wallet |
|--------|-------------|-----------------|
| View Market Data | Fetch and display pool data | No |
| Check Balances | View token balances | Yes |
| View Proposals | Browse futarchy proposals | No |
| Approve Tokens | Approve ERC20 spending | Yes |
| Split Position | Split sDAI into YES/NO | Yes |
| Redeem Position | Redeem tokens | Yes |
| Test Operations | Test system components | No |

## 🔧 Configuration

### Contract Addresses (Gnosis Chain)
```javascript
SDAI: 0xaf204776c7245bF4147c2612BF6e5972Ee483701
FUTARCHY_ROUTER: 0x7495a583ba85875d59407781b4958ED6e0E1228f
DEFAULT_PROPOSAL: 0xDA36a35CA4Fe6214C37a452159C0C9EAd45D5919
```

### Default Pools
```javascript
YES_POOL: 0xF336F812Db1ad142F22A9A4dd43D40e64B478361
NO_POOL: 0xfbf1BE5CE2f9056dAaB1C368EC241ad7Be3507A8
BASE_POOL: 0x88A8ABD96A2e7ceF3B15cB42c11BE862312BA5Da
```

## 🐛 Troubleshooting

### Common Issues

1. **"Wallet not connected"**
   - Ensure PRIVATE_KEY is set in .env
   - Check key format (no 0x prefix)

2. **"Supabase not configured"**
   - Add SUPABASE_URL and SUPABASE_ANON_KEY to .env
   - CLI will use mock data if not configured

3. **"Transaction failed"**
   - Check account has sufficient xDAI
   - Verify contract addresses
   - Check token approvals

4. **Dependencies not found**
   - Run `npm install` to install all packages
   - Check Node.js version (v16+)

## 📚 Examples

### Approve tokens programmatically:
```javascript
const cli = new FutarchyCLI();
await cli.initialize();
await cli.handleApprove({
    tokenAddress: SDAI_ADDRESS,
    spenderAddress: ROUTER_ADDRESS,
    amount: '100'
});
```

### Fetch market data:
```javascript
const result = await dataLayer.fetch('pools.candle', {
    id: '0xF336...',
    limit: 10
});
```

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

MIT License - See LICENSE file for details

## 🔗 Links

- [Futarchy SDK Documentation](./DATA_LAYER_PATTERN.md)
- [Gnosis Chain Explorer](https://gnosisscan.io)
- [Supabase Dashboard](https://app.supabase.com)

## 💡 Tips

- Use `AUTO_CONFIRM=true` for automated testing
- Set `DEBUG=true` for verbose logging
- Use mock data for development without spending gas
- Keep private keys secure and never share them
- Test on testnet before mainnet deployment

---

Built with ❤️ using the Futarchy SDK Data Layer Pattern