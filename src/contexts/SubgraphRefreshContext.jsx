'use client';

import { createContext, useContext, useState, useCallback } from 'react';

/**
 * SubgraphRefreshContext
 * 
 * Allows any component to trigger a resync of SubgraphChart and/or SubgraphTradesDataLayer.
 * Components subscribe to refresh keys and react when they change.
 * 
 * If the components aren't mounted (not in subgraph mode), the triggers are no-ops naturally.
 */

// ============================================================================
// CONFIGURATION - Delay before refreshing after transaction completion
// This gives the subgraph time to index the new transaction
// ============================================================================
const REFRESH_DELAY_MS = 5000; // 5 seconds - adjust as needed

const SubgraphRefreshContext = createContext(null);

export function SubgraphRefreshProvider({ children }) {
    // Refresh counters - components watch these
    const [chartRefreshKey, setChartRefreshKey] = useState(0);
    const [tradesRefreshKey, setTradesRefreshKey] = useState(0);

    const refreshChart = useCallback(() => {
        console.log('[SubgraphRefresh] Triggering chart refresh');
        setChartRefreshKey(k => k + 1);
    }, []);

    const refreshTrades = useCallback(() => {
        console.log('[SubgraphRefresh] Triggering trades refresh');
        setTradesRefreshKey(k => k + 1);
    }, []);

    const refreshAll = useCallback(() => {
        console.log(`[SubgraphRefresh] Scheduling full refresh in ${REFRESH_DELAY_MS}ms...`);
        setTimeout(() => {
            console.log('[SubgraphRefresh] Triggering full refresh (chart + trades)');
            setChartRefreshKey(k => k + 1);
            setTradesRefreshKey(k => k + 1);
        }, REFRESH_DELAY_MS);
    }, []);

    return (
        <SubgraphRefreshContext.Provider value={{
            chartRefreshKey,
            tradesRefreshKey,
            refreshChart,
            refreshTrades,
            refreshAll
        }}>
            {children}
        </SubgraphRefreshContext.Provider>
    );
}

/**
 * Hook to trigger subgraph refreshes from any component
 * 
 * Usage:
 *   const { refreshAll } = useSubgraphRefresh();
 *   // On transaction success:
 *   refreshAll();
 */
export function useSubgraphRefresh() {
    const context = useContext(SubgraphRefreshContext);
    if (!context) {
        // Return no-op functions if used outside provider
        return {
            chartRefreshKey: 0,
            tradesRefreshKey: 0,
            refreshChart: () => { },
            refreshTrades: () => { },
            refreshAll: () => { }
        };
    }
    return context;
}

export default SubgraphRefreshContext;
