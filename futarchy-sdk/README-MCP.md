# Futarchy MCP Server

A Model Context Protocol (MCP) server that provides futarchy operations (split, merge, swap) to Claude and other MCP-compatible clients.

## Features

- **Split Position**: Split collateral tokens (PNK or sDAI) into YES/NO conditional tokens
- **Merge Positions**: Merge paired YES/NO tokens back to collateral
- **Swap Tokens**: Trade on conditional or prediction markets
- **Position Analysis**: Analyze current positions and get recommendations
- **Price Fetching**: Get current prices across all pools
- **Balance Management**: Track all token balances

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables in `.env`:
```env
PRIVATE_KEY=your_private_key_here
RPC_URL=https://rpc.gnosischain.com
```

3. Configure Claude to use the MCP server:

Add to your Claude configuration (usually in `~/.claude/config.json` or similar):

```json
{
  "mcpServers": {
    "futarchy": {
      "command": "node",
      "args": ["path/to/futarchy-sdk/mcp-futarchy-server.js"],
      "env": {
        "RPC_URL": "https://rpc.gnosischain.com"
      }
    }
  }
}
```

## Usage in Claude

Once configured, you can use the futarchy tools in Claude:

### Load a Proposal
```
Use the loadProposal tool with proposalId: 0x...
```

### Get Balances
```
Use the getBalances tool to see all token balances
```

### Split Collateral
```
Use the splitPosition tool with:
- collateralType: "company" or "currency"
- amount: "10" (in ether units)
```

### Merge Positions
```
Use the mergePositions tool with:
- collateralType: "company" or "currency"
- amount: optional (uses max mergeable if not specified)
```

### Swap Tokens
```
Use the swapTokens tool with:
- marketType: "conditional" or "prediction"
- direction: "BUY" or "SELL"
- outcome: "YES" or "NO"
- tokenType: "company" or "currency"
- amount: "10"
- slippage: 1 (optional, percentage)
```

### Analyze Positions
```
Use the getPositionAnalysis tool to get recommendations
```

## Architecture

The MCP server integrates with the existing DataLayer and executor system:

```
Claude <-> MCP Server <-> DataLayer <-> Fetchers/Executors
                            |
                            ├── PoolDiscoveryFetcher
                            ├── ProposalFetcher
                            ├── FutarchyFetcher
                            ├── SdaiRateFetcher
                            └── ViemExecutor + FutarchyCartridge
```

## Available Tools

1. **loadProposal** - Load a futarchy proposal and discover pools
2. **getBalances** - Get all token balances
3. **getPrices** - Get current prices for all pools
4. **splitPosition** - Split collateral into YES/NO tokens
5. **mergePositions** - Merge YES/NO tokens back to collateral
6. **swapTokens** - Execute swaps on markets
7. **getPositionAnalysis** - Analyze positions and get recommendations
8. **estimateSwap** - Get swap quotes without executing

## Running Standalone

You can also run the MCP server standalone:

```bash
npm run mcp
```

This will start the server listening on stdio for MCP connections.

## Development

The server is built on:
- `@modelcontextprotocol/sdk` - MCP protocol implementation
- `viem` - Ethereum interactions
- DataLayer system - Modular data fetching and execution
- FutarchyCartridge - Specialized futarchy operations

## Security

- Private keys are never exposed through the MCP interface
- All transactions require explicit confirmation
- Read-only mode available without private key