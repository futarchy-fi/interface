# Futarchy Interface: Project Master Guide

## 1. Project Overview
**Name:** Futarchy Interface
**Goal:** A premium, "Award Winning" Event-Driven Modular Monolith for Futarchy trading.
**Tech Stack:** Next.js 16, Tailwind CSS, Zustand, Mitt (Event Bus).

---

## 2. Architecture: The "Hive" Pattern (Event-Driven Modular Monolith)

We treat widgets as isolated "micro-applications" that communicate strictly via a global Event Bus.

### The Rules
1.  **Widgets are Islands:** They do not import each other.
2.  **Events are Bridges:** Communication happens via `EventBus.emit('EVENT_NAME', payload)`.
3.  **Ports & Adapters:** Each widget has its own `adapters/` folder to normalize data (Supabase, Web3, etc.) into its required format.

### Directory Structure
```
src/
├── core/                     # The "Kernel"
│   ├── bus/                  # Type-Safe Event Bus (Zustand/Mitt)
│   ├── layouts/              # Drag-and-Drop Grid System
│   └── theme/                # Design System Tokens
│
├── widgets/                  # The "Micro-Apps"
│   ├── CompanyTable/         # <--- Completely Isolated Module
│   │   ├── internal/         # Private Implementation (Adapters, Logic, UI)
│   │   └── index.tsx         # The Public Interface
│   │
│   └── MarketChart/
│       └── ...
```

---

## 3. Implementation Checklist

### Phase 1: Setup & Foundation
- [x] **Project Init**: Initialize Next.js 16 app with Tailwind CSS.
- [x] **Docs**: Create this Master Guide.
- [x] **Git**: Configure `.gitignore` (ignore `integrated-datalayer`).
- [x] **Core**: Implement `src/core/bus` (Event Bus).
- [ ] **Core**: Implement `src/core/registry` (Widget Registry).

### Phase 2: Feature Implementation
- [ ] **Widget**: Create `CompanyTable` (Isolated Module).
- [ ] **Page**: Create Home Page Dashboard with Grid.
- [ ] **Widget**: Create `CompanyDetail` & `MarketChart`.

---

## 4. Development Standards
*   **Styling**: Use `clsx` and `tailwind-merge`. Zero custom CSS files if possible.
*   **State**: Local state uses `useState` or `useReducer`. Global state via Event Bus.
*   **Adapters**: Always wrap external data calls in an Adapter. Never call `fetch()` directly inside a component.
