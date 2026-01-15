# LLM Project Context & Architecture

**Use this context to understand the project structure, patterns, and recent refactoring decisions.**

## 1. Core Architecture (3-Layer)
We enforce a strict separation of concerns to avoid spaghetti code and ensure testability.

1.  **Repository Layer (`src/data/repositories`)**
    *   **Responsibility**: Raw data access (Blockchain/RPC, API, Supabase).
    *   **Tech**: `viem` (publicClient), `fetch`.
    *   **Output**: `RawDTO` (Data Transfer Objects).
    *   **Rule**: NO business logic. Just fetch and return. Handle connectivity errors here.

2.  **Service Layer (`src/services`)**
    *   **Responsibility**: Business logic, transformation, caching.
    *   **Input**: `RawDTO` from Repositories.
    *   **Output**: `DomainModel` (Clean, UI-ready objects).
    *   **Rule**: Transform raw data (e.g., `0n` => `0`, `0x...` => `ValidAddress`). Match business requirements.

3.  **Presentation Layer (`src/widgets`, `src/hooks`)**
    *   **Responsibility**: React Views, State Management.
    *   **Tech**: Next.js, Tailwind, Hooks (`useExecutor`, `useMarketService`).
    *   **Rule**: Never fetch data directly. Ask the Service or Executor.

---

## 2. The Executor & Cartridge Pattern (Web3 abstraction)
To decouple the UI from specific smart contract interfaces, we use an **Executor** (kernel) and **Cartridges** (plugins).

*   **Executor (`src/services/Executor.ts`)**:
    *   The single "engine" available to the UI via `useExecutor`.
    *   Manages "Services": `rpc` (PublicClient), `wallet` (WalletClient), `signer`.
    *   Exposes a universal `run(command, args)` method.
    *   **Crucial**: The UI does NOT know about contracts. It only knows commands like `market.getQuote` or `market.getBalance`.

*   **Cartridges (`src/services/cartridges/FutarchyCartridge.ts`)**:
    *   **Definition**: A plugin class that implements `install(executor)`.
    *   **Role**:
        1.  Holds specific Contract Addresses and ABIs.
        2.  Performs "Discovery" on install (e.g., fetching immutable token addresses from the market contract).
        3.  **Registers Commands**: Maps generic commands (`market.getBalance`) to specific contract calls.
    *   **Dynamic Discovery**: The cartridge fetches `collateralToken1`, `wrappedOutcome`, etc., and maps them to semantic names ("NVDA", "YES_NVDA") for the UI to use.

---

## 3. Configuration & Reliability Best Practices
Recent refactors focused on removing hardcoded values and improving reliability.

1.  **No Hardcoded Addresses**:
    *   **Bad**: `const MARKET = "0x123..."` inside a component.
    *   **Good**: Import from `src/config/mocks.ts` (or `src/config/contracts.ts`).
    *   **Why**: Easier to switch between Dev/Test/Prod (Mock vs. Real).

2.  **Separate ABIs**:
    *   Store ABIs in `src/data/abis/`. Do not inline giant JSON arrays in TypeScript files.

3.  **Robust RPC Calls (`viem`)**:
    *   **Avoid**: `getContract({ ... })` if you suspect wrapper issues or need raw control.
    *   **Preferred**: `rpc.readContract({ ... })` for direct, safer calls.
    *   **Validation**: Always check if `rpc` client exists before usage in Cartridges.

## 4. Example: How to Fix "Undefined Contract" Errors
If `contract.read.methodName` throws "undefined":
1.  **Check Initialization**: Is the RPC client valid?
2.  **Switch to Direct Read**: Use `rpc.readContract` to bypass proxy/wrapper overhead.
3.  **Verify ABI**: Does the ABI exactly match the function signature?

---
*Created by Antigravity (Google DeepMind) - Dec 2025*
