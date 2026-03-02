# 🚀 Claude Code MCP Integration - Futarchy SDK

This guide shows how to connect the Futarchy SDK to Claude Code using the Model Context Protocol (MCP).

## ✅ Installation Complete!

The MCP server has been successfully configured and connected to Claude Code.

## 📋 Quick Start

### 1. Verify Connection
```bash
claude mcp list
```

You should see:
```
futarchy: node mcp-futarchy-wrapper.js - ✓ Connected
```

### 2. Use in Claude Code

Simply ask Claude to use the futarchy tools:

- "Use the futarchy tools to load proposal 0xaCf939B88647935799C7612809472bB29d5472e7"
- "Split 10 PNK tokens into YES/NO tokens using the futarchy tools"
- "Show me the current prices using the futarchy MCP server"

## 🛠️ Available Tools

The futarchy MCP server provides these tools:

1. **loadProposal** - Load a futarchy proposal and discover pools
2. **getBalances** - Get all token balances for your account
3. **getPrices** - Get current prices across all pools
4. **splitPosition** - Split collateral (PNK/sDAI) into YES/NO tokens
5. **mergePositions** - Merge YES/NO pairs back to collateral
6. **swapTokens** - Execute swaps on conditional/prediction markets
7. **getPositionAnalysis** - Analyze your positions and get recommendations
8. **estimateSwap** - Get swap quotes without executing

## 📝 How It Was Set Up

### Step 1: Install MCP SDK
```bash
npm install @modelcontextprotocol/sdk
```

### Step 2: Create MCP Server
Created `mcp-futarchy-server.js` that exposes DataLayer operations via MCP protocol.

### Step 3: Create Wrapper
Created `mcp-futarchy-wrapper.js` to handle stdio cleanly (suppresses initialization logs).

### Step 4: Add to Claude
```bash
cd "C:/Users/arthd/Documents/GitHub/futarchy-sdk"
claude mcp add futarchy -- node mcp-futarchy-wrapper.js
```

### Step 5: Verify
```bash
claude mcp list
```

## 🔧 Configuration

### Environment Variables
The server uses the `.env` file in the futarchy-sdk directory:
```env
PRIVATE_KEY=your_private_key_here  # Optional - for wallet operations
RPC_URL=https://rpc.gnosischain.com  # Gnosis RPC endpoint
```

### Wallet Operations
- **Without PRIVATE_KEY**: Read-only operations (load proposals, get prices)
- **With PRIVATE_KEY**: Full operations (split, merge, swap)

## 📖 Example Usage Flows

### Read-Only Flow (No Wallet)
```
1. Load a proposal → View pools → Check current prices
```

### Trading Flow (Wallet Required)
```
1. Load proposal → Check balances → Split collateral → 
   Swap tokens → Merge positions back
```

## 🔍 Troubleshooting

### Server Not Connecting
```bash
# Check server directly
node mcp-futarchy-wrapper.js

# Should see: "Futarchy MCP Server running..."
```

### Remove and Re-add Server
```bash
claude mcp remove futarchy
claude mcp add futarchy -- node mcp-futarchy-wrapper.js
```

### Check Logs
The server logs to stderr, so errors will appear in Claude's developer console.

## 📁 Files Created

- `mcp-futarchy-server.js` - Main MCP server implementation
- `mcp-futarchy-wrapper.js` - Stdio wrapper for clean MCP communication
- `mcp-test-minimal.js` - Minimal test server (can be deleted)

## 🎯 Next Steps

1. **Test in Claude Code**: Ask Claude to use the futarchy tools
2. **Monitor Usage**: Check Claude's developer console for any errors
3. **Expand Tools**: Add more operations as needed

## 🔗 Architecture

```
Claude Code ←→ MCP Protocol ←→ Futarchy MCP Server
                                      ↓
                                 DataLayer
                                      ↓
                        Fetchers & Executors
                                      ↓
                              Gnosis Chain
```

The MCP server acts as a bridge between Claude's natural language interface and the complex DeFi operations of the Futarchy SDK.

## ✨ Success!

The Futarchy SDK is now fully integrated with Claude Code via MCP. You can use natural language to:
- Manage futarchy positions
- Execute complex DeFi operations
- Analyze market data
- All through simple conversation with Claude!

---

**Note**: Always ensure your private key is secure and never commit the `.env` file to version control.