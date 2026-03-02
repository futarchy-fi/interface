# Complete Understanding Guide of Futarchy

This guide provides a holistic view of the Futarchy v2 system, explaining how **Smart Contracts**, **Subgraphs**, and the **Frontend** work together to create the application.

---

## 1. System Hierarchy (The "Aggregator" Model)

The system is built on a 3-tier hierarchy that allows for infinite scaling of organizations and markets.

| Tier | Concept | Contract | Responsibility |
| :--- | :--- | :--- | :--- |
| **1** | **Aggregator** | `AggregatorMetadata.sol` | The "Root" registry. It holds a list of **Organizations** (e.g., "Futarchy", "Gnosis DAO"). |
| **2** | **Organization** | `OrganizationMetadata.sol` | Represents a Company or DAO. It holds a list of **Proposals**. |
| **3** | **Proposal** | `ProposalMetadata.sol` | A specific market/decision. It links to the underlying trading pools (YES/NO). |

### How It Works
*   The **Factories** (`AggregatorFactory`, `OrganizationFactory`) deploy these metadata contracts.
*   **1-Transaction Actions**: We use specific functions to Deploy & Link in one go.
    *   `createAndAddOrganizationMetadata`
    *   `createAndAddProposalMetadata`

---

## 2. The Data Layer (Subgraph & Indexing)

The **"Futarchy Complete"** subgraph is the unified backend. It indexes everything from the hierarchy to the minute-by-minute trading data.

### A. Candle Data (The Chart)
*   **Source**: `AlgebraPool` events (`Swap`).
*   **Structure**:
    ```graphql
    type Candle {
      periodStartUnix: Int!  # e.g., 1700000000 (Start of the hour)
      open: BigDecimal!
      high: BigDecimal!
      low: BigDecimal!
      close: BigDecimal!     # The price at the end of the period
      volumeUSD: BigDecimal! # Total volume in dollars
    }
    ```
*   **Logic**: The subgraph listens to every `Swap`. It updates the "Current Candle". When the time period rolls over (e.g., a new hour starts), it "closes" the old candle and starts a new one.

### B. Liquidity (The Value)
Liquidity is tricky because the blockchain only gives us a raw number ($L$). The subgraph acts smart to give us real dollar values.

*   **The Formula**:
    $$ \text{Liquid Value ($)} = L \times \sqrt{Price} $$
*   **Role-Based Logic**:
    *   The subgraph identifies which token is the **Currency** (e.g., sDAI) via `token0.role` / `token1.role`.
    *   It ensures we only count the stablecoin side for meaningful "TVL" charts.

### C. Trades
*   indexed from the `Swap` event.
*   Used to populate the **"Recent Trades"** list in the UI.

---

## 3. The Frontend (Website Architecture)

The website consumes this data in two main places.

### A. Market Page Showcase (`MarketPageShowcase.jsx`)
This is the main view for a single proposal.
1.  **Config**: It calls `useContractConfig` to get the metadata.
2.  **Smart Pool Selection**: It queries the subgraph to find the **Best Pool** (highest liquidity).
    *   *Why?* Sometimes a market has old, empty pools. This logic ensures we always show the active one.
3.  **Visualization**:
    *   **Chart**: `SubgraphChart` fetches `candles` to draw the line.
    *   **Stats**: It calculates **Impact** (Difference between YES/NO) and **Probability** live.

### B. Active Milestones (`CompaniesPage.jsx`)
This is the Homepage carousel.
1.  **Source**: Fetches from Supabase `market_event` table.
2.  **Filter**: Shows only proposals with `approval_status = "ongoing"`.
3.  **Enrichment**:
    *   The `EventHighlightCard` independently fetches **live prices** from the blockchain for the specific item it displays.
    *   This ensures the "Active" markets on the home page always show real-time prices, even if the database is slightly behind.

---

## 4. Proposal Lifecycle (Management)

How do admins manage the content? via the **Organization Manager Modal**.

### Adding a Proposal (The "1-Tx" Flow)
1.  User fills in details (Question, Description).
2.  Frontend calls `createAndAddProposalMetadata`.
3.  **Blockchain**: Deploys `ProposalMetadata` contract & adds it to the Organization's array.
4.  **Subgraph**: Detects `ProposalCreatedAndAdded` event. Indexes the new proposal under the Organization.
5.  **UI**: Auto-updates to show the new market.

### Removing a Proposal
1.  Frontend looks up the `metadataContract` address from the Subgraph.
2.  It calls `removeProposalMetadata(index)` on the Organization contract.
    *   *Note*: It removes the **Link**, not the contract itself (blockchain is immutable).
3.  **Subgraph**: Detects removal and unlinks it. The proposal disappears from the UI.

---

## 5. Key Configuration Files

| File | Purpose |
| :--- | :--- |
| `src/config/subgraphEndpoints.js` | Defines the Subgraph URLs for Chain 100/1. |
| `constants/contracts.js` | Defines the Factory and Default Aggregator addresses. |
| `futarchy-complete/subgraph.yaml` | The blueprint for how the subgraph indexes data. |
