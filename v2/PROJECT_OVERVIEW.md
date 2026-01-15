# Project Overview: Futarchy Interface

## 1. Project Description
This project is a **Next.js-based Frontend Interface** for a Futarchy Prediction Market system. It allows users to view DAOs, analyze proposals, and trade on conditional markets (Yes/No outcomes based on proposal success) using a visually rich, professional "Pro" interface.

## 2. Key Documentation (Artifacts)
Refer to these files for detailed tracking of the development process:
- **[task.md](task.md)**: The master checklist of all tasks, broken down by phases (Planning -> Execution -> Polish). Tracks what is done and what is next.
- **[implementation_plan.md](implementation_plan.md)**: Technical design documents for specific features (e.g., "Pro" UI upgrades), detailing file changes and architecture decisions.
- **[walkthrough.md](walkthrough.md)**: A log of completed work, including verification steps and visual proof (screenshots/descriptions) of the implemented features.
- **[architecture_design.md](architecture_design.md)**: High-level architectural view (Widgets, Data Flow, Atomic Design).

## 3. Key Source Files
To understand the codebase, focusing on these files is essential:

### Core Pages
- **`src/app/page.tsx`**: The **Main Dashboard**. Displays the list of DAOs and active markets.
- **`src/app/markets/[proposalId]/page.tsx`**: The **Market Detail Page**. The core trading interface featuring the Price Chart, Order Book (Stats), Activity Logs, and Trade Panel.
- **`src/app/companies/[id]/page.tsx`**: The **Company/DAO Detail Page**. Shows DAO stats, treasury info, and a list of proposals.

### Key Widgets (Components)
The application is built using a "Widget" architecture for modularity:
- **`src/widgets/MarketHero/`**: The high-fidelity top header on the Market Page (Title, Impact, Volume, Status).
- **`src/widgets/MarketChart/`**: Handles the main price chart (`ChartUI`), Statistics bar (`StatsUI`), and Activity tabs (`ActivityUI`).
- **`src/widgets/TradePanel/`**: The swap/trade interface user interaction.
- **`src/widgets/CompanyDetail/`**: The complex layout for the DAO detail view (Header, Stats, Proposal List).
- **`src/widgets/MarketPulse/`**: The sidebar widget showing trending markets.

### Configuration
- **`tailwind.config.ts`**: Contains the custom color palette (Futarchy Theme) and font configurations (`Oxanium`).

## 4. Development Iterations (Summary of Work)
The project has evolved through the following distinct phases:

### Phase 1: Foundation & "Lite" Version
- **Goal**: rapid prototype.
- **Result**: Basic functional pages using mock data. Simple "Company Page" and "Market Page" with standard UI.

### Phase 2: Architectural Refactor
- **Goal**: Clean code and modularity.
- **Result**: Introduced the **Widget System**. Refactored monolithic pages into reusable widgets (`CompanyTable`, `TradePanel`, `MarketChart`).

### Phase 3: "Pro" UI Upgrade (Current State)
- **Goal**: High-fidelity, professional trading look & feel.
- **Result**:
    - **Dashboard**: Dark mode, gradients, polished tables.
    - **Company Page**: "Tally-like" layout with banner, stats grid, and rich proposal cards.
    - **Market Page**: Complete overhaul. Added **Market Hero** section, 3-column stats, advanced charts, and a dense "Bloomberg Terminal" style layout for trading activity.
    - **Styling**: Enforced a unifying Dark Mode theme with specific color palettes (Teals, Violets) and the Oxanium font.

## 5. Next Steps
- **Data Integration**: Replace mock data adapters with real data fetching (Web3/Supabase).
- **Wallet Connection**: Implement real Wagmi/Viem wallet hooks.
- **Interaction**: Enable actual trading execution.
