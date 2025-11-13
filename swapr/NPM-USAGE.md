# NPM Scripts Usage Guide

This guide shows how to use the npm scripts for quick access to the Algebra CLI functionality.

## Quick Commands

### 🤖 Automatic Mode (Recommended)

```bash
# Create your config file first (copy from examples)
cp futarchy-config.example my-config.txt
# Edit the values in my-config.txt

# Run automatic setup
npm run futarchy:auto my-config.txt

# Or use JSON format
cp futarchy-config.example.json my-config.json
npm run futarchy:auto my-config.json
```

### 🆕 Create New Proposal + Setup Pools (One Command)

```bash
# Create new proposal and set up all pools automatically
npm run futarchy:auto:new

# Or customize the config first
cp futarchy-config-new-proposal.example.json my-new-proposal.json
# Edit my-new-proposal.json (leave proposalAddress empty)
npm run futarchy:auto my-new-proposal.json
```

### 📋 Test with Examples

```bash
# Test with example KEY=VALUE config
npm run futarchy:auto:example

# Test with example JSON config  
npm run futarchy:auto:json
```

### 👤 Interactive Mode

```bash
# Full interactive wizard
npm run interactive

# Interactive futarchy setup with specific proposal
npm run futarchy:interactive 0x1234...
```

### ➕ Create New Proposal

```bash
# Create a new futarchy proposal
npm run futarchy:create
```

### ❓ Help

```bash
# Show all available commands
npm run help
```

## Complete Workflow Example

1. **Set up environment**:
   ```bash
   # Make sure you have .env file with PRIVATE_KEY
   cp .env.example .env
   # Edit .env and add your PRIVATE_KEY
   ```

2. **Create config for your proposal**:
   ```bash
   cp futarchy-config.example my-proposal.txt
   # Edit my-proposal.txt with your values:
   # - PROPOSAL_ADDRESS=0x... (your deployed proposal)
   # - SPOT_PRICE=119.77 (current GNO price in sDAI) 
   # - EVENT_PROBABILITY=0.5 (50% chance)
   # - IMPACT=10 (10% price impact)
   # - LIQUIDITY_DEFAULT=1000 (1000 sDAI per pool)
   ```

3. **Run automatic setup**:
   ```bash
   npm run futarchy:auto my-proposal.txt
   ```

4. **Check results**:
   - View transaction links in console output
   - Check generated JSON summary file
   - Verify pools on Gnosisscan

## Configuration File Formats

### KEY=VALUE Format (`.txt` files)
```bash
PROPOSAL_ADDRESS=0x1234567890123456789012345678901234567890
SPOT_PRICE=119.77
EVENT_PROBABILITY=0.5
IMPACT=10
LIQUIDITY_DEFAULT=1000
```

### JSON Format (`.json` files)
```json
{
  "proposalAddress": "0x1234567890123456789012345678901234567890",
  "spotPrice": 119.77,
  "eventProbability": 0.5,
  "impact": 10,
  "liquidityDefault": 1000
}
```

Both formats work identically - choose whichever you prefer! 