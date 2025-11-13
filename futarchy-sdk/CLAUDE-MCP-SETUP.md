# Claude Code MCP Futarchy Server Setup Guide

## Installation & Testing Within Claude Code

### 1. Installation
```bash
# Install dependencies (already done)
npm install
```

### 2. Test the Server Standalone
```bash
# Test that the server starts correctly
node mcp-futarchy-server.js

# You should see initialization messages like:
# 🏗️  DataLayer initialized...
# 🔧 PoolDiscoveryFetcher initialized...
# Futarchy MCP Server running...
```

Press Ctrl+C to stop the server.

### 3. Configure Claude Code to Use the MCP Server

To use this MCP server with Claude Code, you need to add it to your Claude configuration file.

#### Windows Configuration
Edit `%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "futarchy": {
      "command": "node",
      "args": ["C:/Users/arthd/Documents/GitHub/futarchy-sdk/mcp-futarchy-server.js"],
      "env": {
        "DOTENV_CONFIG_PATH": "C:/Users/arthd/Documents/GitHub/futarchy-sdk/.env"
      }
    }
  }
}
```

#### macOS Configuration
Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "futarchy": {
      "command": "node",
      "args": ["/Users/YOUR_USERNAME/path/to/futarchy-sdk/mcp-futarchy-server.js"],
      "env": {
        "DOTENV_CONFIG_PATH": "/Users/YOUR_USERNAME/path/to/futarchy-sdk/.env"
      }
    }
  }
}
```

#### Linux Configuration
Edit `~/.config/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "futarchy": {
      "command": "node",
      "args": ["/home/YOUR_USERNAME/path/to/futarchy-sdk/mcp-futarchy-server.js"],
      "env": {
        "DOTENV_CONFIG_PATH": "/home/YOUR_USERNAME/path/to/futarchy-sdk/.env"
      }
    }
  }
}
```

### 4. Restart Claude Code

After updating the configuration:
1. Completely quit Claude Code (not just close the window)
2. Restart Claude Code
3. The MCP server should now be available

### 5. Test in Claude Code

Once configured, you can test the MCP tools in Claude by asking:

```
"Use the futarchy MCP tools to load proposal 0xaCf939B88647935799C7612809472bB29d5472e7"
```

Or:

```
"Use the loadProposal tool to load a futarchy proposal with ID 0xaCf939B88647935799C7612809472bB29d5472e7"
```

### 6. Available MCP Tools

The following tools are available through the MCP server:

- **loadProposal**: Load a futarchy proposal and discover its pools
- **getBalances**: Get all token balances (requires wallet)
- **getPrices**: Get current prices for all pools
- **splitPosition**: Split collateral into YES/NO tokens (requires wallet)
- **mergePositions**: Merge YES/NO tokens back to collateral (requires wallet)
- **swapTokens**: Execute swaps on markets (requires wallet)
- **getPositionAnalysis**: Analyze positions and get recommendations (requires wallet)
- **estimateSwap**: Get swap quotes without executing

### 7. Troubleshooting

#### Check if MCP Server is Recognized
In Claude, you can ask: "What MCP tools are available?" 

#### Server Not Starting
- Check that Node.js is installed: `node --version`
- Check that all dependencies are installed: `npm install`
- Check the .env file exists with proper configuration

#### Wallet Operations Not Working
- Ensure PRIVATE_KEY is set in .env file
- Ensure RPC_URL is correct (defaults to https://rpc.gnosischain.com)

#### Debug Mode
To see detailed logs, you can run the server manually and watch the output:
```bash
node mcp-futarchy-server.js
```

### 8. Example Usage Flows

#### Read-Only Operations (No Wallet Needed)
```
1. Load a proposal
2. Get current prices
3. View pool information
```

#### Trading Operations (Wallet Required)
```
1. Load a proposal
2. Check balances
3. Split 10 PNK into YES/NO tokens
4. Swap YES tokens for NO tokens
5. Merge YES/NO pairs back to collateral
```

### 9. Security Notes

- Never commit your .env file with private keys
- The MCP server runs locally and doesn't expose your keys
- All transactions require explicit confirmation through the MCP protocol

## Testing Without Claude

You can test the MCP server functionality directly:

```bash
# Run direct test (doesn't need Claude)
node test-mcp-direct.js
```

This will test basic server functionality without needing the full MCP client/server setup.