# LLM Context Summary: Futarchy TradePanel Refactoring

## Objective
Refactor the `TradePanel` to support a Uniswap-like explicit Swap experience, supporting bidirectional input (Exact Input / Exact Output), "Smart" balances for Futarchy split mechanics, and separate "Swap" vs "Split" execution modes.

## Key Components & Changes

### 1. Main UI Controller
**File**: `src/widgets/TradePanel/internal/ui/PanelUI.tsx`
- **State Changes**:
  - Replaced single `amountIn` with `inputValue` + `inputType` ('PAY' | 'RECEIVE') to support bidirectional calculation.
  - Added `action` state ('BUY' | 'SELL') which auto-updates based on the "Pay" token (sDAI = BUY, Outcome = SELL).
- **Logic**:
  - **Bidirectional Calculation**: `amountPay` and `amountReceive` are derived on-the-fly using `MOCK_PRICE`.
  - **Smart Balances**: Displays "Direct Balance (+ Collateral)" if user holds both Outcome tokens and sDAI.
  - **Split vs Swap**: Automatically detects if `amountPay > directBalance` and switches UI/Logic to "SPLIT" mode.
  - **Arrow Logic**: "Force Swap" logic allows clicking the arrow to instantly invert tokens and toggle Buy/Sell state without validation blocking.
  - **Layout**: Fixed Z-Index stacking contexts to ensure Dropdowns and Inputs don't overlap incorrectly.

### 2. Input Component
**File**: `src/widgets/TradePanel/internal/ui/SwapInput.tsx`
- **Changes**:
  - Added `readOnly` prop (default false) to support bidirectional typing.
  - Accepts `balance` string prop to display the "Smart Balance".

### 3. Positions Widget
**File**: `src/widgets/MarketPulse/index.tsx`
- **Changes**:
  - Updated to support a list of positions (Multi-Asset).
  - **Mock Data**:
    - `sDAI`: 103 YES / 100 NO -> Displays 3.00 YES Net Exposure.
    - `GNO`: 0 YES / 0.1 NO -> Displays 0.10 NO Net Exposure.
  - Iterates through positions to show a card for each active position.

### 4. Configuration
**File**: `src/config/messages.ts`
- **Purpose**: Centralized UI strings (Tooltips, Error messages, Button labels) to declutter component code.

## Current Logic Flow (PanelUI)

1.  **User Types**: Updates `inputValue` and sets `inputType`.
2.  **Render**:
    *   If `inputType === 'PAY'`, calculates `amountReceive = val * price`.
    *   If `inputType === 'RECEIVE'`, calculates `amountPay = val / price`.
3.  **Swap Click**:
    *   Swaps `payToken` and `receiveToken`.
    *   **Auto-Action**: If new Pay is sDAI -> `BUY`, else `SELL`.
    *   Preserves numerical value in the new Pay input.
4.  **Submit**:
    *   If `isSplitting` (Pay > Balance): Calls `onRequestTrade` with `mode: 'SPLIT'`.
    *   Else: Calls `onRequestTrade` with `mode: 'SWAP'` and `exactOutput` flag if applicable.

## Pending / Mock Items
- **Price Fetching**: Currently uses `MOCK_PRICE` (0.98 / 1.02). Needs integration with Real Router/Subgraph.
- **Balances**: Currently uses static `BALANCES` object in `PanelUI`. Needs connection to `useBalanceManager` or wagmi.
