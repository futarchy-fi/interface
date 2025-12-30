"use client";

// src/hooks/useMarketService.ts
// CONTEXT/UI LAYER: Wires Service to React State

import { useState, useEffect, useCallback } from "react";
import { MarketService, MarketModel } from "../services/MarketService";
import { MarketRepository } from "../data/repositories/MarketRepository";
import { ProviderType, PriorityProfile } from "../data/DiscoveryOrchestrator";

// Dependency Injection Root (could be a Context Provider in a larger app)
const repo = new MarketRepository();
const service = new MarketService(repo);

export function useMarketService(orgId: string) {
    const [markets, setMarkets] = useState<MarketModel[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const getMarkets = useCallback(async (orgId: string, priority?: ProviderType[] | PriorityProfile) => {
        setIsLoading(true);
        try {
            const data = await service.getActiveMarkets(orgId, priority);
            setMarkets(data);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const getMarket = useCallback(async (id: string, priority?: ProviderType[] | PriorityProfile) => {
        setIsLoading(true);
        try {
            return await service.getMarket(id, priority);
        } catch (err) {
            console.error(err);
            return null;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const getMarketHistory = useCallback(async (id: string, priority?: ProviderType[] | PriorityProfile) => {
        return await service.getMarketHistory(id, priority);
    }, []);

    const getTradeHistory = useCallback(async (id: string, priority?: ProviderType[] | PriorityProfile, userAddress?: string) => {
        return await service.getTradeHistory(id, priority, userAddress);
    }, []);

    const getMarketPositions = useCallback(async (id: string, userAddress: string, positionService: any) => {
        return await service.getMarketPositions(id, userAddress, positionService);
    }, []);

    useEffect(() => {
        getMarkets(orgId);
    }, [orgId, getMarkets]);

    return { markets, isLoading, getMarkets, getMarket, getMarketHistory, getTradeHistory, getMarketPositions };
}

