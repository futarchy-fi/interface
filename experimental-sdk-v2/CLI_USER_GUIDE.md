# Futarchy SDK v2 (CLI) - User Guide

## 🚀 Overview

The **Futarchy SDK v2 CLI** is a terminal-based "Headless Frontend" for the Futarchy v2 ecosystem. It allows DevOps, Developers, and Market Makers to interact with the full stack—**Contracts, Subgraphs, and External APIs**—without needing a browser.

It faithfully replicates the logic found in the [SUBGRAPH_* documentation](../docs/), ensuring that what you see here matches exactly what the React App sees.

---

## 🛠️ Setup

1.  **Install**:
    ```bash
    cd experimental-sdk-v2
    npm install
    ```
2.  **Configure** (Required for Write operations):
    Copy `.env.example` to `.env` and add your **Private Key** (Gnosis Chain).
    ```bash
    PRIVATE_KEY=your_key_here
    RPC_URL=https://rpc.gnosischain.com
    ```
3.  **Run**:
    ```bash
    node index.js
    ```

## 📖 CLI Arguments (Automation Mode)
The SDK supports "Headless" operation for scripts and CI/CD.

- **Interactive Mode**: `node index.js` (or `node index.js interactive`)
- **Health Check**: `node index.js check <PROPOSAL_ID>`
  - Runs "Smart Liquidity" and "Config Adapter" checks. Returns Exit Code 1 on failure.
- **JSON Dump**: `node index.js json <PROPOSAL_ID>`
  - Outputs purely JSON (useful for piping: `node index.js json 0x123 > config.json`).
- **Verify System**: `node index.js verify`
  - Crawls the Subgraph Hierarchy (Aggregator -> Orgs -> Proposals) to ensure connectivity.

---

## 📖 Usage Scenarios (DevOps Workflows)

### Scenario 1: The "System Health Check" (Hierarchy Verification)
**Goal:** Verify that the Governance hierarchy is intact (Aggregator -> Organizations -> Proposals).
*Mappings: `SUBGRAPH_AND_CONTRACT_INTEGRATION.md`*

1.  Select **`🔍 View Aggregator`**.
2.  Hit Enter (Defaults to the Main Futarchy Aggregator).
3.  **Output:**
    *   You will see the **Aggregator Name**, **Owner**, and a list of **Organizations**.
    *   *Check:* Does the "Gnosis" Org exist? Is the ID correct?
4.  Copy an **Organization ID** (e.g., `0xb5...`).
5.  *Note:* You can currently view Org details by querying the Subgraph directly or adding a View Org command (future). For now, you usually jump straight to Proposals.

---

### Scenario 2: The "Frontend Debugger" (Proposal Config)
**Goal:** A user says "My market isn't showing up correctly!". You need to see if the **Frontend Config Adapter** is generating the right data.
*Mappings: `SUBGRAPH_PROPOSAL_CONFIG.md`*

1.  Select **`🎫 Manage Proposal`**.
2.  Enter the **Proposal ID** (Market Address).
3.  Select **`📄 View Config (Frontend Adapter)`**.
4.  **Output:**
    *   You get a raw JSON object.
    *   *Check `contractInfos`:* Are `collateralToken` and `outcomeTokens` correct?
    *   *Check `conditional_pools`:* Are the pool addresses `null`? If so, the Frontend thinks the pool doesn't exist.

---

### Scenario 3: The "Market Maker" (Liquidity & Pools)
**Goal:** Analyze market depth and create missing pools.
*Mappings: `SUBGRAPH_VOLUME_LIQUIDITY.md`, `SUBGRAPH_CREATE_POOL.md`*

1.  Select **`🎫 Manage Proposal`** -> **ID**.
2.  Select **`🌊 Smart Liquidity Analysis`**.
3.  **Output:**
    *   Shows **YES** and **NO** side analysis.
    *   **"Best Pool ID"**: The pool the frontend *will* choose.
    *   **"Approx Price"**: Derived from tick data.
4.  **Action: Create Missing Pool**
    *   If you see "Missing" in red:
    *   Select **`➕ Create Missing Pool (Write)`**.
    *   Choose **Side** (YES/NO) and **Initial Price**.
    *   The SDK automatically sorts tokens and calls the **Algebra Position Manager** on-chain!

---

### Scenario 4: The "Data Analyst" (Trades & Candles)
**Goal:** Verify that indexing is working and users are trading.
*Mappings: `SUBGRAPH_SWAPS.md`, `SUBGRAPH_CHART.md`, `SUBGRAPH_SPOT.md`*

1.  Select **`🎫 Manage Proposal`** -> **ID**.
2.  **`🔄 View Recent Swaps`**:
    *   Lists recent Buy/Sell actions.
    *   *Check:* Are timestamps recent? Are the "Side" labels (YES/NO) correct?
3.  **`🕯️ View Candles`**:
    *   Shows OHLCV data.
    *   *Check:* Is `Vol USD` > 0?
4.  **`📈 External Spot Price`**:
    *   Paste a **GeckoTerminal Pool Address**.
    *   Confirms if the "Reference Price" API is up and returning valid data.

---

## 🧩 Architecture Reference

| CLI Feature | Source Code | Documentation |
| :--- | :--- | :--- |
| **Config Adapter** | `src/core/configAdapter.js` | `SUBGRAPH_PROPOSAL_CONFIG` |
| **Smart Liquidity** | `src/core/liquidity.js` | `SUBGRAPH_VOLUME_LIQUIDITY` |
| **Pool Creation** | `src/actions/poolWrite.js` | `SUBGRAPH_CREATE_POOL` |
| **Trades/Candles** | `src/core/subgraph.js` | `SUBGRAPH_SWAPS`, `CHART` |
| **Spot Prices** | `src/core/spotClient.js` | `SUBGRAPH_SPOT` |

---

## ⚠️ Notes
*   **Write Operations**: Cost real xDAI on Gnosis Chain. Ensure your wallet is funded.
*   **Read-Only**: If no private key is provided, Write commands will fail gracefully.
