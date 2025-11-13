# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a futarchy prediction market system built on Gnosis Chain, implementing decentralized governance mechanisms through token pairs and automated market makers. The system allows participants to trade on outcomes using conditional tokens split into YES/NO positions.

## Development Commands

### Main Application (Root Directory)
```bash
# Development
npm run dev               # Start Next.js development server (http://localhost:3000)

# Build & Production
npm run build            # Build for production
npm run start            # Start production server

# Code Quality
npm run lint             # Run Next.js linter

# Storybook
npm run storybook        # Start Storybook dev server (http://localhost:6006)
npm run build-storybook  # Build Storybook static site

# Utilities
npm run start-proposal   # Run proposal CLI in interactive mode
npm run send-to-supabase # Send data to Supabase
```

### Pool Automation (swapr/ Directory)
```bash
cd swapr/

# Interactive Operations
npm run interactive      # Interactive mode wizard
npm run futarchy:create  # Create new proposal
npm run view            # View all positions

# Automated Pool Setup
npm run futarchy:auto futarchy-config.json  # Automatic setup with config
npm run automate        # Full workflow: config → generate → call APIs
npm run automate-dry    # Preview full workflow (safe test)

# Pool API Operations
npm run generate-pools   # Generate API files from latest setup
npm run call-pool-apis   # Make ALL pool creation API calls
npm run call-pool-apis-dry  # Preview API calls

# Liquidity Management
npm run remove          # Remove liquidity (interactive)
npm run merge <proposalAddr>  # Merge conditional tokens back
```

## Code Architecture

### Tech Stack
- **Frontend**: Next.js 14 with React 18 (pages router)
- **Blockchain**: Ethers.js v5, Wagmi v2, RainbowKit
- **Styling**: Tailwind CSS, CSS Modules
- **State Management**: React Context API
- **Package Manager**: pnpm

### Key Directories

```
src/
├── pages/              # Next.js pages (routing)
├── components/         # React components
│   ├── futarchyFi/    # Main app components
│   └── refactor/      # New extensible swap system
├── hooks/             # Custom React hooks
├── contexts/          # React contexts
├── utils/             # Utility functions
└── futarchyJS/        # Core futarchy logic
```

### Critical Files

1. **Core Hook**: `src/hooks/useFutarchy.js`
   - Central hook managing all futarchy operations
   - Handles swaps, positions, collateral, and balances
   - Extensive callback system for UI updates

2. **Web3 Integration**: `src/contexts/Web3Context.js`
   - Manages wallet connections and blockchain providers
   - Multi-RPC fallback configuration for Gnosis Chain

3. **Swap Strategies**: `src/components/refactor/strategies/`
   - Extensible swap system using strategy pattern
   - Support for Algebra/Swapr, CoW Swap protocols
   - Factory pattern for strategy creation

4. **Pool Automation**: `swapr/algebra-cli.js`
   - CLI tool for automated pool creation
   - Supports both interactive and config-based operation
   - Handles liquidity management operations

### Important Patterns

1. **Strategy Pattern for Swaps**
   - Base classes: `BaseSwapStrategy.js`, `BaseRealtimeStrategy.js`
   - Implementations: `AlgebraSwapStrategy.js`, `CowSwapStrategy.js`
   - Factory: `SwapStrategyFactory.js`

2. **Hook Composition**
   - Complex operations broken into focused hooks
   - Extensive use of callbacks for UI state management
   - Error handling at hook level

3. **Token Management**
   - Conditional tokens (YES/NO pairs)
   - Automatic collateral management
   - ERC20 approval handling with security measures

### Smart Contract Addresses (Gnosis Chain)

Key contracts are configured in:
- `src/futarchyJS/futarchyConfig.js`
- `src/components/refactor/constants/addresses.js`

### Environment Configuration

The app supports multiple environments via `.env` files:
- Development RPC endpoints
- API keys for external services
- Contract addresses

### Testing Approach

Currently no automated tests are configured. The project relies on:
- Manual testing through the UI
- Storybook for component development
- CLI tools for operation verification

### Common Development Tasks

1. **Adding a New Swap Protocol**
   - Create new strategy in `src/components/refactor/strategies/`
   - Extend `BaseSwapStrategy` class
   - Register in `SwapStrategyFactory`

2. **Creating New Components**
   - Follow existing patterns in `src/components/futarchyFi/`
   - Use Tailwind for styling
   - Create stories for Storybook testing

3. **Working with Hooks**
   - Place new hooks in `src/hooks/`
   - Follow callback pattern for UI updates
   - Handle loading states and errors

4. **Blockchain Interactions**
   - Use ethers.js v5 (not v6)
   - Implement proper gas estimation
   - Handle transaction states comprehensively

### UI/UX Patterns

1. **Transaction Status**
   - Clear status messages with emojis
   - Transaction logs with timestamps
   - Approval flows with wallet guidance

2. **Error Handling**
   - User-friendly error messages
   - Recovery suggestions
   - Detailed logging for debugging

3. **Loading States**
   - Consistent loading indicators
   - Optimistic UI updates where appropriate
   - Progress tracking for multi-step operations

### Security Considerations

1. **Token Approvals**
   - Reset allowances before setting new ones
   - Use MaxUint256 for frequent operations
   - Clear approval state tracking

2. **Transaction Safety**
   - Slippage protection on swaps
   - Gas estimation with buffer
   - Deadline enforcement

3. **Error Recovery**
   - Graceful degradation
   - Transaction retry logic
   - State rollback on failures