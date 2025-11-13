# Futarchy JS

A vanilla JavaScript implementation of the Futarchy protocol, without React dependencies.

## Setup

1. Copy the `.env.example` file to create your own `.env` file:

```bash
cp .env.example .env
```

2. Edit the `.env` file with your private key and any contract addresses you want to customize:

```bash
# Authentication (Required)
PRIVATE_KEY=your_private_key_here
RPC_URL=https://rpc.gnosischain.com

# Base Tokens (Role-Based Configuration)
CURRENCY_ADDRESS=0xaf204776c7245bF4147c2612BF6e5972Ee483701
CURRENCY_NAME=SDAI
COMPANY_ADDRESS=0x9C58BAcC331c9aa871AFD802DB6379a98e80CEdb
COMPANY_NAME=GNO
NATIVE_ADDRESS=0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d
NATIVE_NAME=WXDAI

# Position Tokens
YES_SDAI_ADDRESS=0x493A0D1c776f8797297Aa8B34594fBd0A7F8968a
NO_SDAI_ADDRESS=0xE1133Ef862f3441880adADC2096AB67c63f6E102
YES_GNO_ADDRESS=0x177304d505eCA60E1aE0dAF1bba4A4c4181dB8Ad
NO_GNO_ADDRESS=0xf1B3E5Ffc0219A4F8C0ac69EC98C97709EdfB6c9

# Core Contracts
CURRENCY_RATE_PROVIDER=0x89C80A4540A00b5270347E02e2E144c71da2EceD
FUTARCHY_ROUTER=0x7495a583ba85875d59407781b4958ED6e0E1228f
MARKET_ADDRESS=0x6242AbA055957A63d682e9D3de3364ACB53D053A
CONDITIONAL_TOKENS=0xCeAfDD6bc0bEF976fdCd1112955828E00543c0Ce

# Uniswap V3 Pools
YES_POOL_ADDRESS=0x9a14d28909f42823ee29847f87a15fb3b6e8aed3
YES_POOL_TOKEN_COMPANY_SLOT=0
NO_POOL_ADDRESS=0x6E33153115Ab58dab0e0F1E3a2ccda6e67FA5cD7
NO_POOL_TOKEN_COMPANY_SLOT=1

# DEX Addresses
SUSHISWAP_V2_FACTORY=0xc35DADB65012eC5796536bD9864eD8773aBc74C4
SUSHISWAP_V2_ROUTER=0xf2614A233c7C3e7f08b1F887Ba133a13f1eb2c55
SUSHISWAP_V3_ROUTER=0x592abc3734cd0d458e6e44a2db2992a3d00283a4

# Optional Settings
TEST_MODE=false
USE_SUSHI_V3=true
AUTO_INITIALIZE=true
```

All addresses above are configured for a specific Futarchy market on Gnosis Chain. If you need to use different addresses, simply modify the values in your `.env` file without changing any code.

The role-based naming convention makes it easy to adapt the system to different tokens or markets without changing any code. For example, if you want to use USDC instead of SDAI, just change the `CURRENCY_ADDRESS` and `CURRENCY_NAME` values.

### Dynamic Token Loading (NEW!)

You can now use the futarchy system with only the market contract address. Token information (addresses, symbols, decimals) will be loaded dynamically from the market contract, eliminating the need for:

- `CURRENCY_ADDRESS`
- `CURRENCY_NAME`
- `COMPANY_ADDRESS`
- `COMPANY_NAME`
- `YES_CURRENCY_ADDRESS`
- `NO_CURRENCY_ADDRESS`
- `YES_COMPANY_ADDRESS`
- `NO_COMPANY_ADDRESS`

To use this feature:

1. Ensure you have the `MARKET_ADDRESS` variable set in your `.env` file
2. Configure the `MARKET_ADDRESS_COMPANY_SLOT` variable (0 or 1) to indicate which token is the company token:
   - `0` means collateralToken1 is the COMPANY token and collateralToken2 is the CURRENCY token
   - `1` means collateralToken1 is the CURRENCY token and collateralToken2 is the COMPANY token
3. Configure the `MARKET_OUTCOME_YES_SLOT` variable (0 or 1) to indicate which position represents the YES outcome:
   - `0` means position 0 is YES and position 1 is NO
   - `1` means position 0 is NO and position 1 is YES
4. The system will automatically read token information from the market contract on initialization

This allows the system to determine which index of the `wrappedOutcome` function corresponds to which position token:

| COMPANY_SLOT | YES_SLOT | index 0     | index 1     | index 2     | index 3     |
|--------------|----------|-------------|-------------|-------------|-------------|
| 0            | 0        | YES_COMPANY | NO_COMPANY  | YES_CURRENCY| NO_CURRENCY |
| 0            | 1        | NO_COMPANY  | YES_COMPANY | NO_CURRENCY | YES_CURRENCY|
| 1            | 0        | YES_CURRENCY| NO_CURRENCY | YES_COMPANY | NO_COMPANY  |
| 1            | 1        | NO_CURRENCY | YES_CURRENCY| NO_COMPANY  | YES_COMPANY |

Example of a minimal `.env` file using this feature:

```bash
PRIVATE_KEY=your_private_key_here
RPC_URL=https://rpc.gnosischain.com

# Core Contract (required)
MARKET_ADDRESS=0x6242AbA055957A63d682e9D3de3364ACB53D053A
MARKET_ADDRESS_COMPANY_SLOT=0
MARKET_OUTCOME_YES_SLOT=0

# You still need:
# - NATIVE_ADDRESS and NATIVE_NAME 
# - Pool addresses and configurations
# - DEX addresses
# But base token and position token configs are now optional!
```

If you still provide the token configuration variables, the system will compare them with the values from the market contract and warn you of any discrepancies.

3. Install dependencies:

```bash
cd src/futarchyJS
npm install
```

## Running Tests

### Collateral Tests

Test the addCollateral and removeCollateral functionality:

```bash
npm run test:collateral
```

### Swap Tests

Test the swap functionality with and without collateral needed:

```bash
npm run test:swap
```

### Price Tests

Test price calculations and token valuations:

```bash
npm run test:price
```

To also check token balances for a specific wallet address:

```bash
# Replace with your actual wallet address
npm run test:price:wallet -- 0xYourActualWalletAddress
```

This will run price calculations, then check the token balances for the specified wallet.

### All Tests

Run all tests:

```bash
npm test
```

## Implementation Notes

This library implements the same functionality as the React hooks found in `src/hooks/useFutarchy.js` but without any React dependencies. This makes it suitable for use in server-side environments, tests, CLIs, and other non-React applications.

Key features:
- Token approvals
- Collateral management
- Smart swaps with automatic collateral addition
- Price fetching from Uniswap V3 pools
- Impact and market sentiment analysis
- Event-based callbacks for all operations

### Market Analysis Metrics

The library calculates several key metrics to analyze market sentiment and proposal impact:

#### Implied Probability

The prediction market's estimate of the probability that the event will happen:
```javascript
// The YES currency price directly represents the implied probability
impliedProbability = yesCurrency;
```

#### Impact Calculation

The relative impact of the proposal on company token value:
```javascript
// How much relative impact the proposal would have
const minCompanyPrice = Math.min(yesCompany, noCompany);
const impact = (yesCompany - noCompany) / minCompanyPrice;
const impactPercentage = impact * 100; // For display as percentage
```

A positive impact indicates the market expects the proposal to increase company value, while a negative impact suggests the proposal would decrease company value.

#### Conditional Average Price

The expected company token price, weighted by outcome probabilities:
```javascript
// Weighted average price considering both outcomes
conditionalAveragePrice = (yesCompany * yesCurrency) + (noCompany * noCurrency);
```

This calculation represents the market's overall expectation of the company token's value, considering the probabilities of both outcomes.

### Loading Environment Variables

Here's how to load the environment variables in your code using the role-based naming:

```javascript
import 'dotenv/config';
import { ethers } from 'ethers';

// Load environment variables with role-based naming
const config = {
  // Base configuration
  privateKey: process.env.PRIVATE_KEY,
  rpcUrl: process.env.RPC_URL || 'https://rpc.ankr.com/gnosis',
  
  // Base tokens with roles rather than specific tokens
  currencyAddress: process.env.CURRENCY_ADDRESS,
  currencyName: process.env.CURRENCY_NAME || 'SDAI',
  companyAddress: process.env.COMPANY_ADDRESS,
  companyName: process.env.COMPANY_NAME || 'GNO',
  nativeAddress: process.env.NATIVE_ADDRESS,
  nativeName: process.env.NATIVE_NAME || 'WXDAI',
  
  // Position tokens
  yesCurrencyAddress: process.env.YES_CURRENCY_ADDRESS,
  noCurrencyAddress: process.env.NO_CURRENCY_ADDRESS,
  yesCompanyAddress: process.env.YES_COMPANY_ADDRESS,
  noCompanyAddress: process.env.NO_COMPANY_ADDRESS,
  
  // Core contracts
  currencyRateProvider: process.env.CURRENCY_RATE_PROVIDER,
  futarchyRouter: process.env.FUTARCHY_ROUTER,
  marketAddress: process.env.MARKET_ADDRESS,
  conditionalTokens: process.env.CONDITIONAL_TOKENS,
  
  // Uniswap V3 pools
  yesPoolAddress: process.env.YES_POOL_ADDRESS,
  yesPoolTokenCompanySlot: parseInt(process.env.YES_POOL_TOKEN_COMPANY_SLOT || '0'),
  noPoolAddress: process.env.NO_POOL_ADDRESS,
  noPoolTokenCompanySlot: parseInt(process.env.NO_POOL_TOKEN_COMPANY_SLOT || '1'),
  
  // DEX addresses
  sushiswapV2Factory: process.env.SUSHISWAP_V2_FACTORY,
  sushiswapV2Router: process.env.SUSHISWAP_V2_ROUTER,
  sushiswapV3Router: process.env.SUSHISWAP_V3_ROUTER,
  
  // Optional settings
  testMode: process.env.TEST_MODE === 'true',
  useSushiV3: process.env.USE_SUSHI_V3 !== 'false',
  autoInitialize: process.env.AUTO_INITIALIZE !== 'false',
  testAmount: process.env.TEST_AMOUNT || '0.000001'
};

// Then pass this config to createFutarchy
import { createFutarchy } from './futarchy.js';
const futarchy = createFutarchy(config);
```

This role-based approach provides several benefits:
1. **Flexibility**: Easily switch between different tokens (SDAI, USDC, DAI) without changing code
2. **Clarity**: Configuration expresses the roles tokens play rather than specific implementations
3. **Portability**: Easily adapt the system to different markets or prediction scenarios
4. **Future-proofing**: If SDAI is replaced by a different token, only configuration changes needed

## Example Usage

```javascript
import { createFutarchy } from './futarchy.js';

// Create a futarchy instance
const futarchy = createFutarchy({
  // Optional custom provider/signer
  customProvider: provider,
  customSigner: wallet,
  // Disable auto-initialization (default: true)
  autoInitialize: false
});

// Initialize when ready
await futarchy.initialize();

// Add collateral
const result = await futarchy.addCollateral('currency', '0.1', {
  onStart: () => console.log('Starting...'),
  onApprove: (tx) => console.log('Approval sent:', tx.hash),
  onComplete: (receipt) => console.log('Completed:', receipt.blockNumber)
});

// Swap tokens
const swapResult = await futarchy.advancedSmartSwap({
  tokenType: 'currency',
  amount: '0.05',
  eventHappens: true,
  action: 'buy',
  onStart: () => console.log('Starting swap...'),
  onSwapComplete: (receipt) => console.log('Swap completed!')
});

// Clean up when done
futarchy.cleanup();
```

# Futarchy Terminal Interface

An interactive terminal interface for working with Futarchy on Gnosis Chain. This tool allows you to easily:

- Check token balances (both base and position tokens)
- Add collateral (currency or company)
- Remove collateral (currency or company)
- Swap tokens with all possible combinations (Buy/Sell, YES/NO)

## Features

- 🔍 **Balance Checking**: View all your token balances with clear formatting
- 💰 **Smart Collateral Management**: Shows maximum available amounts for all operations
- 🔄 **Intuitive Swap Interface**: Guides you through all swap options with proper constraints
- 📊 **Unpaired Amounts for Swaps**: Uses the new unpaired amount logic for maximum swap flexibility
- 🔒 **Paired Minimums for Removals**: Correctly uses paired minimums for removing collateral

## Setup

1. Create a `.env` file with your private key and RPC URL:
```
PRIVATE_KEY=your_private_key_here
RPC_URL=https://rpc.gnosischain.com  # or your preferred RPC
```

2. Install dependencies:
```bash
cd src/futarchyJS
npm install
```

## Usage

Run the terminal interface:
```bash
npm run terminal
```

Follow the interactive prompts to:
1. Select the operation you want to perform
2. Choose token types, sides (YES/NO), and amounts
3. Confirm and execute transactions

## Available Commands

- `npm run terminal`: Start the interactive terminal interface
- `npm run test:swap`: Run swap tests
- `npm run test:collateral`: Test adding collateral
- `npm run test:collateral:remove`: Test removing collateral
- `npm run test:price`: Test price calculations
- `npm run test:price:wallet 0xYourAddress`: Test price calculations with wallet check

## Contract Addresses & System Architecture

This section explains all the key contract addresses used in the futarchy system, their purpose, and how they interact with each other using the role-based naming convention.

### Base Tokens

These tokens represent the core assets used in the futarchy market:

#### **Currency Token (SDAI)**: `0xaf204776c7245bF4147c2612BF6e5972Ee483701`
- **Purpose**: The currency token used for trading (in this case SDAI, an interest-bearing version of DAI)
- **Used in**: Collateral for YES/NO position tokens, price calculation, swaps
- **Environment Variable**: `CURRENCY_ADDRESS`
- **Usage example**:
```javascript
// Adding currency as collateral
await futarchy.addCollateral('currency', '0.000001');

// Approval check
const baseToken = BASE_TOKENS_CONFIG.currency;  // Points to currency address
const allowance = await tokenContract.allowance(userAddress, FUTARCHY_ROUTER_ADDRESS);
```

#### **Company Token (GNO)**: `0x9C58BAcC331c9aa871AFD802DB6379a98e80CEdb`
- **Purpose**: The company/governance token that's being predicted
- **Used in**: Company token swaps, price calculations
- **Environment Variable**: `COMPANY_ADDRESS`
- **Usage example**:
```javascript
// Buying YES company tokens with YES currency tokens
await futarchy.advancedSmartSwap({
  tokenType: 'currency',
  amount: '0.000001',
  eventHappens: true,  // YES side
  action: 'buy'
});
```

#### **Native Token (WXDAI)**: `0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d`
- **Purpose**: Native token of the blockchain, wrapped (in this case WXDAI)
- **Used in**: Currency price calculations via Sushiswap V2 pools
- **Environment Variable**: `NATIVE_ADDRESS`
- **Usage example**:
```javascript
// DEPRECATED: In fetchCurrencyPricesInXdai
const yesPairAddress = await factory.getPair(
  process.env.NATIVE_ADDRESS,  // Using wrapped native token here
  process.env.YES_CURRENCY_ADDRESS
);

// RECOMMENDED: Using the new fetchCurrencyPrices with Uniswap V3 prediction pools
const { yesCurrencyPrice, noCurrencyPrice } = await fetchCurrencyPrices(provider);
// This uses YES_PREDICTION_POOL_ADDRESS and NO_PREDICTION_POOL_ADDRESS
// for more direct and accurate pricing
```

### Position Tokens

These tokens represent conditional positions created when adding collateral:

#### **YES Currency Token (YES_SDAI)**: `0x493A0D1c776f8797297Aa8B34594fBd0A7F8968a`
- **Purpose**: Token representing "YES" outcome for the currency token
- **Used in**: Swaps, balance checks, price calculation
- **Environment Variable**: `YES_CURRENCY_ADDRESS`
- **Usage example**:
```javascript
// Checking YES currency token balance
const yesCurrencyContract = new ethers.Contract(process.env.YES_CURRENCY_ADDRESS, ERC20_ABI, provider);
const balance = await yesCurrencyContract.balanceOf(userAddress);
```

#### **NO Currency Token (NO_SDAI)**: `0xE1133Ef862f3441880adADC2096AB67c63f6E102`
- **Purpose**: Token representing "NO" outcome for the currency token
- **Used in**: Similar to YES currency token
- **Environment Variable**: `NO_CURRENCY_ADDRESS`
- **Usage example**:
```javascript
// Swapping NO currency to NO company tokens
await futarchy.advancedSmartSwap({
  tokenType: 'currency',
  amount: '0.000001',
  eventHappens: false,  // NO side
  action: 'buy'
});
```

#### **YES Company Token (YES_GNO)**: `0x177304d505eCA60E1aE0dAF1bba4A4c4181dB8Ad`
- **Purpose**: Token representing "YES" outcome for the company token
- **Used in**: Swaps and balance checks
- **Environment Variable**: `YES_COMPANY_ADDRESS`
- **Usage example**:
```javascript
// Selling YES company tokens
await futarchy.advancedSmartSwap({
  tokenType: 'company',
  amount: '0.000001',
  eventHappens: true,
  action: 'sell'
});
```

#### **NO Company Token (NO_GNO)**: `0xf1B3E5Ffc0219A4F8C0ac69EC98C97709EdfB6c9`
- **Purpose**: Token representing "NO" outcome for the company token
- **Used in**: Similar to YES company token
- **Environment Variable**: `NO_COMPANY_ADDRESS`
- **Usage example**: Same as YES_GNO but with `eventHappens: false`

### Key Contracts

These contracts form the core infrastructure of the futarchy system:

#### **Currency Rate Provider**: `0x89C80A4540A00b5270347E02e2E144c71da2EceD`
- **Purpose**: Provides the current exchange rate for the currency token
- **Used in**: Event probability calculation
- **Environment Variable**: `CURRENCY_RATE_PROVIDER`
- **Usage example**:
```javascript
// Fetching currency rate for probability calculation
const currencyRateContract = new ethers.Contract(
  process.env.CURRENCY_RATE_PROVIDER,
  ["function getRate() external view returns (uint256)"],
  provider
);
const currencyRate = await currencyRateContract.getRate();
const currencyPriceFloat = parseFloat(ethers.utils.formatUnits(currencyRate, 18));
```

#### **Futarchy Router**: `0x7495a583ba85875d59407781b4958ED6e0E1228f`
- **Purpose**: Main entry point for futarchy operations (splitting/merging collateral)
- **Used in**: Add/remove collateral operations
- **Environment Variable**: `FUTARCHY_ROUTER`
- **Usage example**:
```javascript
// Adding collateral (splitting tokens)
const routerContract = new ethers.Contract(
  process.env.FUTARCHY_ROUTER,
  FUTARCHY_ROUTER_ABI,
  signer
);
const tx = await routerContract.splitPosition(
  process.env.MARKET_ADDRESS,
  process.env.CURRENCY_ADDRESS,
  parsedAmount
);
```

#### **Market Address**: `0x6242AbA055957A63d682e9D3de3364ACB53D053A`
- **Purpose**: The specific futarchy market contract for this prediction
- **Used in**: Add/remove collateral as a parameter to the router
- **Usage example**:
```javascript
// Removing collateral (merging tokens)
const mergeTx = await futarchyContract.mergePositions(
  MARKET_ADDRESS,  // The specific market
  TOKEN_CONFIG[tokenType].address,
  parsedAmount
);
```

#### **Conditional Tokens**: `0xCeAfDD6bc0bEF976fdCd1112955828E00543c0Ce`
- **Purpose**: Base contract for conditional token functionality
- **Used in**: Used by the Futarchy Router (not directly called)

### Uniswap V3 Pools

These pools are used for price discovery of company token outcomes:

#### **YES Pool**: `0x9a14d28909f42823ee29847f87a15fb3b6e8aed3`
- **Purpose**: Uniswap V3 pool for YES GNO/YES SDAI
- **Used in**: Price calculations for YES outcome
- **Token Company Slot**: `0` (indicates position of the company token in the pool)
- **Usage example**:
```javascript
// Fetching YES pool price
const yesPoolContract = new ethers.Contract(
  POOL_CONFIG_YES.address,  // YES pool address
  UNISWAP_V3_POOL_ABI,
  provider
);
const yesSlot0 = await yesPoolContract.slot0();
const yesSqrtPriceX96 = yesSlot0.sqrtPriceX96;
const yesPrice = calculatePriceFromSqrtPriceX96(
  yesSqrtPriceX96, 
  POOL_CONFIG_YES.tokenCompanySlot  // 0
);
```

#### **NO Pool**: `0x6E33153115Ab58dab0e0F1E3a2ccda6e67FA5cD7`
- **Purpose**: Uniswap V3 pool for NO GNO/NO SDAI
- **Used in**: Price calculations for NO outcome
- **Token Company Slot**: `1` (indicates position of the company token in the pool)
- **Usage example**: Similar to YES Pool but using NO pool address and tokenCompanySlot: 1

### DEX Addresses

These contracts are used for integrating with decentralized exchanges:

#### **SushiSwap V2 Factory**: `0xc35DADB65012eC5796536bD9864eD8773aBc74C4`
- **Purpose**: Creates and finds token pairs on SushiSwap V2
- **Used in**: Finding YES_SDAI/WXDAI and NO_SDAI/WXDAI pairs for pricing
- **Usage example**:
```javascript
// Finding the YES_SDAI/WXDAI pair
const factory = new ethers.Contract(
  SUSHISWAP_V2_FACTORY,
  ["function getPair(address,address) external view returns (address)"],
  provider
);
const yesPairAddress = await factory.getPair(WXDAI_ADDRESS, CURRENCY_YES_TOKEN);
```

#### **SushiSwap V2 Router**: `0xf2614A233c7C3e7f08b1F887Ba133a13f1eb2c55`
- **Purpose**: Router for executing swaps on SushiSwap V2
- **Used in**: Not directly used in current implementation, but available for future swap implementations

#### **SushiSwap V3 Router**: `0x592abc3734cd0d458e6e44a2db2992a3d00283a4`
- **Purpose**: Router for executing swaps on SushiSwap V3
- **Used in**: Not directly used in current implementation, but available for future swap implementations

### Token Pair Addresses

These are the actual SushiSwap V2 pairs used for pricing:

#### **YES_SDAI/WXDAI Pair**: `0xd4A53EADEcb85DD3C5488efAa5F2b46630712Fb2`
- **Purpose**: SushiSwap V2 pair for YES_SDAI/WXDAI price discovery
- **Used in**: Calculating YES currency price in XDAI for event probability
- **Usage example**:
```javascript
// Getting reserves from the YES pair
const yesPair = new ethers.Contract(
  yesPairAddress,  // This is the YES_SDAI/WXDAI pair address
  SUSHISWAP_V2_PAIR_ABI,
  provider
);
const [yesReserve0, yesReserve1] = await yesPair.getReserves();
```

#### **NO_SDAI/WXDAI Pair**: `0x230Fa372C46d2BA7b44051d7DF81d536344d92B5`
- **Purpose**: SushiSwap V2 pair for NO_SDAI/WXDAI price discovery
- **Used in**: Calculating NO currency price in XDAI
- **Usage example**: Similar to YES pair but using NO pair address

### Notable Missing Addresses

These addresses might be involved in the system but aren't explicitly listed:

#### **Wrapper Service Address**
- **Purpose**: Handles wrapping of conditional tokens
- **Used in**: Complex operations around position tokens

#### **Oracle Address**
- **Purpose**: Provides final outcome resolution for the prediction market
- **Used in**: Market resolution (not implemented in current scripts)

### System Flow Diagram

The following outlines how these contracts interact in key operations:

1. **Adding Collateral**:  
   User → Futarchy Router → Conditional Tokens → (YES_SDAI + NO_SDAI) or (YES_GNO + NO_GNO)

2. **Removing Collateral**:  
   User → (YES_SDAI + NO_SDAI) → Futarchy Router → Conditional Tokens → SDAI

3. **Price Calculation**:  
   - Company Tokens: Uniswap V3 Pools (YES Pool + NO Pool)
   - Currency Tokens: SushiSwap V2 Pairs + SDAI Rate Provider
   - Event Probability: YES_SDAI_in_XDAI / SDAI_Rate

4. **Swapping**:  
   - Buy: YES_SDAI → YES_GNO or NO_SDAI → NO_GNO
   - Sell: YES_GNO → YES_SDAI or NO_GNO → NO_SDAI

## Important Notes

- **Safe Private Key Handling**: Never share your .env file or private key
- **Start Small**: When testing, use small amounts (like 0.000001) first
- **Balance Updates**: Balances are automatically refreshed after each operation
- **Colored Output**: The interface uses colors to highlight important information
  - Green: Success messages
  - Yellow: Warnings and transaction details
  - Red: Errors and failures
  - Blue: Status updates
  - Cyan: Menu headings

## Technical Details

The terminal interface properly handles:
- Checking paired vs unpaired amounts for different operations
- Potential collateral addition during buy operations
- Transaction approval workflows
- Error handling and state management 

## New Environment Variable Configuration

The futarchy system now supports a fully flexible environment variable-based configuration with role-based token naming. This allows you to:

1. **Configure once, run anywhere**: Set your configuration in the `.env` file and all parts of the system will automatically use it
2. **Override when needed**: Provide custom options when creating a Futarchy instance to override specific settings
3. **Access configuration programmatically**: Get the current configuration using utility functions

### Implementation Details

We've implemented a modern configuration system with:

- **Role-based token naming**: Using generic token roles (currency, company, native) instead of specific tokens (SDAI, GNO, WXDAI)
- **Smart defaults**: All environment variables have sensible defaults so the system works without any configuration
- **Detailed warnings**: Missing required variables trigger warnings during initialization
- **Per-function overrides**: Override specific settings when creating a Futarchy instance

### New Files

1. `dotEnvConfig.js`: Loads environment variables and provides a configuration object
2. `usageExample.js`: Shows how to use the new environment variable configuration

### Usage Examples

#### Basic Usage with Environment Variables

```javascript
import { createFutarchy } from './futarchy.js';

// Create instance with configuration from .env
const futarchy = createFutarchy();

// Use the futarchy instance as normal
await futarchy.initialize();
await futarchy.addCollateral('currency', '0.1');
```

#### Overriding Specific Settings

```javascript
import { createFutarchy } from './futarchy.js';

// Create instance with custom overrides
const futarchy = createFutarchy({
  testMode: true,
  useSushiV3: false,
  autoInitialize: false
});

// Manual initialization when ready
await futarchy.initialize();
```

#### Accessing the Current Configuration

```javascript
import { environmentConfig, getEnvironmentConfig } from './futarchy.js';

// Access specific configuration values
console.log(`Using ${environmentConfig.baseTokens.currency.name} as currency token`);
console.log(`YES Pool address: ${environmentConfig.pools.yes.address}`);

// Get the complete configuration
const config = getEnvironmentConfig();
console.log('Full configuration:', config);
```

### Additional Benefits

This refactoring provides several key benefits:

1. **Decoupling from specific implementations**: The code no longer assumes specific tokens like SDAI or GNO
2. **Easier testing**: Test with different configurations without changing code
3. **Environment-specific settings**: Different settings for development, testing, and production
4. **Centralized configuration**: All settings in one place for easier maintenance
5. **Better security**: Private keys and sensitive data only in the `.env` file (not in code) 

## Environment Variable Requirements

The futarchy system now strictly requires all environment variables to be defined in your `.env` file:

### Strict Validation Policy

This system has been configured with a strict validation policy:

- **All variables must be defined in `.env`**
- **No default values will be used**
- **Initialization will fail if any variable is missing**

### Clear Error Messages

When missing variables are detected, you'll see:

```
❌ ERROR: Missing required environment variables in .env file:
   - PRIVATE_KEY
   - CURRENCY_ADDRESS
   - COMPANY_ADDRESS
   ...

All variables must be defined in your .env file.
This system does not use default values.
See the .env.example file for required variables.
```

### Complete Configuration Required

The system will not start unless your `.env` file includes ALL of these variables:

```
# Authentication
PRIVATE_KEY
RPC_URL

# Base Tokens
CURRENCY_ADDRESS
CURRENCY_NAME
COMPANY_ADDRESS
COMPANY_NAME
NATIVE_ADDRESS
NATIVE_NAME

# Position Tokens
YES_CURRENCY_ADDRESS
NO_CURRENCY_ADDRESS
YES_COMPANY_ADDRESS
NO_COMPANY_ADDRESS

# Core Contracts
CURRENCY_RATE_PROVIDER
FUTARCHY_ROUTER
MARKET_ADDRESS
CONDITIONAL_TOKENS

# Uniswap V3 Pools
YES_POOL_ADDRESS
YES_POOL_TOKEN_COMPANY_SLOT
NO_POOL_ADDRESS
NO_POOL_TOKEN_COMPANY_SLOT

# DEX Addresses
SUSHISWAP_V2_FACTORY
SUSHISWAP_V2_ROUTER
SUSHISWAP_V3_ROUTER

# Optional Settings
TEST_AMOUNT
```

The `TEST_MODE`, `USE_SUSHI_V3`, and `AUTO_INITIALIZE` variables have Boolean defaults, but all other variables must be explicitly set.

### Validation During Initialization

The system automatically validates all environment variables:

1. When the module is first loaded, it checks all required variables
2. The `initialize()` method will fail with clear error messages if variables are missing
3. No operations will be attempted until all variables are properly set

### Handling Validation Failures

You can handle environment errors in your code:

```javascript
import { createFutarchy, environmentConfig } from './futarchy.js';

// Create the Futarchy instance
const futarchy = createFutarchy();

// Initialize and check for errors
const initialized = await futarchy.initialize();
if (!initialized) {
  console.error("Cannot proceed - missing required .env variables");
  return;
}

// Check environment status directly
if (!environmentConfig.environment.isValid) {
  console.error("Missing required environment variables:");
  environmentConfig.environment.missingVars.forEach(v => {
    console.error(`- ${v}`);
  });
}
```

### Benefits

This warning system provides several benefits:

1. **Early Error Detection**: Problems are caught immediately, not during operations
2. **Clear Error Messages**: Users know exactly what they need to fix
3. **Graceful Degradation**: Non-critical missing variables use defaults
4. **Programmatic Access**: Environment status is available in code for custom handling 

# Futarchy Terminal Tools

A comprehensive set of JavaScript terminal tools for interacting with Futarchy contracts on Gnosis Chain.

## Overview

This package provides terminal-based tools for:

1. **Creating Futarchy Proposals** - Create governance proposals with prediction markets
2. **Managing Liquidity** - Add liquidity to proposal markets
3. **Configuration Management** - Save, load, and validate proposal configurations

## Getting Started

### Prerequisites

- Node.js 14.0.0 or higher
- An Ethereum private key with XDAI on Gnosis Chain
- The required contract addresses (see Configuration section)

### Installation

1. Clone the repository
2. Navigate to this directory
3. Install dependencies:

```bash
cd src/futarchyJS
npm install
```

### Configuration

Copy the example environment file and fill in your values:

```bash
cp .env.proposal.example .env
```

Required environment variables:

```
# RPC and Keys
PRIVATE_KEY=your_private_key_here
RPC_URL=https://rpc.gnosischain.com

# Contract Addresses
FUTARCHY_FACTORY=0x...your_factory_address...
FUTARCHY_ROUTER=0x...your_router_address... # Required for token splitting feature
WXDAI_ADDRESS=0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d
SDAI_ADDRESS=0xaf204776c7245bf4147c2612bf6e5972ee483701
GNO_ADDRESS=0x9c58bacc331c9aa871afd802db6379a98e80cedb
SUSHI_ROUTER=0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506
SUSHI_FACTORY=0xc35DADB65012eC5796536bD9864eD8773aBc74C4

# Default values (optional)
DEFAULT_WXDAI_AMOUNT=1000000000000000000
DEFAULT_TOKEN1_AMOUNT=1000000000000000000
DEFAULT_TOKEN2_AMOUNT=1000000000000000000
```

## Usage

### Creating a New Proposal

Run the terminal application:

```bash
node proposalTerminal.js
```

Or with npm:

```bash
npm run proposal
```

Follow the interactive prompts to create your proposal. The process includes:

1. Entering proposal details (name, question, etc.)
2. Selecting collateral tokens
3. Setting minimum bond and opening time
4. Configuring liquidity parameters (optional)
5. Confirming and submitting to the blockchain

### Adding Liquidity to Existing Proposals

You can add liquidity to a proposal in two ways:

#### Option 1: Using the proposal contract address directly

```bash
node proposalTerminal.js addLiquidity 0x3DaFd90339c840c9E7D4081C7Fa0B7B0865a94e8
```

Or with npm:

```bash
npm run add-liquidity 0x3DaFd90339c840c9E7D4081C7Fa0B7B0865a94e8
```

This approach is more convenient because:
- You don't need to have the original config file
- The contract address can be found on block explorers like Gnosisscan
- All necessary information is retrieved directly from the blockchain

#### Option 2: Using a configuration file from a previous proposal creation

```bash
node proposalTerminal.js addLiquidity your_config_file.json
```

Or with npm:

```bash
npm run add-liquidity your_config_file.json
```

Both methods allow you to:

1. View summary of the proposal
2. Check and approve token allowances
3. Create trading pools for outcome tokens
4. Add initial liquidity to pools

### Sample Configuration

Create a sample configuration to help you get started:

```bash
node proposalTerminal.js create-sample
```

## Features

### Proposal Terminal

- Interactive command-line interface
- Input validation for all parameters
- Transaction monitoring and gas estimation
- Configuration file generation and management
- Explorer links for created proposals and transactions

### Liquidity Manager

- Automatic token approval checking
- Pool creation with SushiSwap V2
- Interactive confirmation at each step
- Detailed transaction feedback
- Balance checking before submitting transactions

### Configuration Management

- Save and load proposal configurations
- Validate proposal parameters
- Sample configuration generation
- Type checking and validation

## New Feature: Automatic Token Splitting

The liquidity terminal now includes automatic token splitting functionality that ensures you have enough outcome tokens before adding liquidity. This is particularly useful when you have base tokens (like SDAI or GNO) but haven't yet split them into outcome tokens (like YES_SDAI, NO_SDAI).

### How It Works

When adding liquidity to a proposal:

1. **Balance Check**: The system automatically checks your balance of each outcome token
2. **Requirement Calculation**: Compares your balance with how much is needed for liquidity
3. **Deficit Determination**: Calculates exactly how much base token needs to be split
4. **Interactive Prompting**: Shows detailed information and asks if you want to split tokens
5. **Automatic Splitting**: Handles the entire process including approvals and splitting
6. **Balance Update**: Shows updated balances after splitting

### Example Workflow

```
Outcome tokens that will be used:
  0: YES_SDAI (0x493A0D1c776f8797297Aa8B34594fBd0A7F8968a) - Balance: 0.01
  1: NO_SDAI (0xE1133Ef862f3441880adADC2096AB67c63f6E102) - Balance: 0.01
  2: YES_GNO (0x177304d505eCA60E1aE0dAF1bba4A4c4181dB8Ad) - Balance: 0.0
  3: NO_GNO (0xf1B3E5Ffc0219A4F8C0ac69EC98C97709EdfB6c9) - Balance: 0.0

Checking if token splitting is needed before adding liquidity...

You need to split tokens to have enough for liquidity:
  YES_GNO: 0.0 available, need 0.1, missing 0.1
  NO_GNO: 0.0 available, need 0.1, missing 0.1

Total collateral needed for splitting:
  GNO: 0.2 (exact: 200000000000000000)

Do you want to split these tokens now? (y/n): y
```

### Advantages of Automatic Splitting

1. **No Manual Calculations**: No need to calculate how much to split yourself
2. **Exact Amounts**: Shows raw (unrounded) values for precise splitting
3. **Complete Process**: Handles the entire workflow including approvals and transactions
4. **Transparent**: Shows your current balance, required amount, and deficit for each token
5. **Integrated**: Seamlessly integrates with the liquidity addition process

### Requirements

To use this feature, you must set the `FUTARCHY_ROUTER` address in your `.env` file. This is the contract address that enables splitting base tokens into outcome tokens.

## How It Works

The tools interact with the Futarchy contracts deployed on Gnosis Chain:

1. The proposal creation process calls the `createProposal` function on the Factory contract
2. The outcome tokens representing YES/NO predictions are automatically created
3. The liquidity management creates SushiSwap V2 pools for these outcome tokens
4. Initial liquidity is added to enable trading

## Troubleshooting

If you encounter issues:

- Ensure your private key has enough XDAI for transactions
- Verify all contract addresses are correct
- Check token allowances if liquidity addition fails
- Look for detailed error messages in the console output

### Contract Compatibility

The tool supports two different Futarchy proposal contract interfaces:

1. **Interface 1**: Using `name()`, `question()`, `collateral1()`, `collateral2()`
2. **Interface 2**: Using `marketName()`, `encodedQuestion()`, `collateralToken1()`, `collateralToken2()`

If you encounter errors like:
```
Error fetching proposal information: missing revert data in call exception
```

Make sure you're using a valid Futarchy proposal contract address. You can verify this by checking on Gnosisscan that the contract implements functions like `marketName()`, `collateralToken1()`, `numOutcomes()`, etc.

## Additional Resources

For more information about Futarchy:
- [Futarchy Documentation](https://gnosis.io/futarchy)
- [SushiSwap V2 Documentation](https://docs.sushi.com/docs/Products/SushiSwap/Liquidity%20Pools)
- [Gnosis Chain Explorer](https://gnosisscan.io)

## License

This project is licensed under the MIT License - see the LICENSE file for details.

# New Feature: Per-Pool Liquidity Configuration

The liquidity terminal now allows you to set **individual WXDAI amounts for each outcome token pool**, providing complete control over the initial price ratios. This is particularly useful for:

1. **Price Discovery**: Set different initial prices to reflect your market expectations
2. **Custom Probabilities**: Create pools with implied probabilities other than 50/50
3. **Strategic Liquidity**: Allocate more liquidity to pools you expect to see more trading activity

## How It Works

When adding liquidity to a proposal, you'll now be asked to specify:

1. **WXDAI amount for each outcome token pool** separately
2. **Outcome token amount for that pool**

For each pool configuration, you'll immediately see:
- The initial price ratio (how many WXDAI per outcome token)
- The initial price in both directions (WXDAI→Token and Token→WXDAI)
- The implied probability derived from the YES/NO pool prices

### Example Configuration Flow

```
Pool 1: WXDAI <> YES_sDAI
WXDAI amount for YES_sDAI pool (default: 1.0): 0.06
YES_sDAI amount (default: 1.0): 0.04
  Initial price: 1 YES_sDAI = 1.5000 WXDAI
  Initial price: 1 WXDAI = 0.6667 YES_sDAI

Pool 2: WXDAI <> NO_sDAI
WXDAI amount for NO_sDAI pool (default: 1.0): 0.04
NO_sDAI amount (default: 1.0): 0.04
  Initial price: 1 NO_sDAI = 1.0000 WXDAI
  Initial price: 1 WXDAI = 1.0000 NO_sDAI
  Implied probability: 40.00%

Pool 3: WXDAI <> YES_GNO
...
```

## Pool Configuration Summary

After configuring all pools, you'll see a summary showing all your configured pools:

```
--- Pool Configuration Summary ---
Pool 1: 0.06 WXDAI <> 0.04 YES_sDAI (Ratio: 1.5000)
Pool 2: 0.04 WXDAI <> 0.04 NO_sDAI (Ratio: 1.0000)
Pool 3: 0.05 WXDAI <> 0.05 YES_GNO (Ratio: 1.0000)
Pool 4: 0.05 WXDAI <> 0.05 NO_GNO (Ratio: 1.0000)
```

## Understanding Price Ratios and Implied Probability

The price ratio between WXDAI and outcome tokens determines the initial market sentiment:

- **Equal Amounts** (e.g., 1 WXDAI : 1 YES_TOKEN): Implies a 50% probability
- **More WXDAI than YES_TOKEN** (e.g., 1.5 WXDAI : 1 YES_TOKEN): Higher implied probability for YES
- **Less WXDAI than YES_TOKEN** (e.g., 0.5 WXDAI : 1 YES_TOKEN): Lower implied probability for YES

The tool automatically calculates the implied probability based on the ratios you set:

```
Implied probability = YES_Price / (YES_Price + NO_Price)
```

Where `YES_Price` and `NO_Price` are the prices of 1 WXDAI in terms of YES_TOKEN and NO_TOKEN. 