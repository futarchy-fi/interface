
import { useState, useEffect, useCallback } from 'react';
import { MarketPriceService } from '@/services/MarketPriceService';
import { ProviderType, PriorityProfile } from '@/data/DiscoveryOrchestrator';

const marketPriceService = new MarketPriceService();

export interface MarketPriceConfig {
    yesPool?: string;
    noPool?: string;
    tokens?: { yesCompany?: string; noCompany?: string; yesCurrency?: string; noCurrency?: string };
    interval?: number; // ms
    enabled?: boolean;
    priority?: ProviderType[] | PriorityProfile;
}

export function useMarketPrice({ yesPool, noPool, tokens, interval = 15000, enabled = true, priority }: MarketPriceConfig) {
    const [prices, setPrices] = useState<{ yesPrice: number | null, noPrice: number | null, prediction: number | null }>({
        yesPrice: null,
        noPrice: null,
        prediction: null
    });
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const tokensKey = JSON.stringify(tokens);
    const refresh = useCallback(async () => {
        if (!yesPool && !noPool) {
            console.warn("[useMarketPrice] No pool addresses provided. Skipping fetch.");
            return;
        }
        console.log(`[useMarketPrice] Refreshing prices for Pools: YES=${yesPool}, NO=${noPool}`);
        setIsLoading(true);
        try {
            const latest = await marketPriceService.getLatestPrices(yesPool, noPool, tokens, priority as any);
            setPrices(latest);
            setLastUpdated(new Date());
        } catch (error) {
            console.error("[useMarketPrice] Failed to fetch prices:", error);
        } finally {
            setIsLoading(false);
        }
    }, [yesPool, noPool, tokensKey, priority]);

    useEffect(() => {
        if (!enabled) return;

        refresh();
        const id = setInterval(refresh, interval);
        return () => clearInterval(id);
    }, [refresh, interval, enabled]);

    return {
        ...prices,
        lastUpdated,
        isLoading,
        refresh
    };
}
