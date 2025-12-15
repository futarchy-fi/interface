"use client";

// src/hooks/useMarketService.ts
// CONTEXT/UI LAYER: Wires Service to React State

import { useState, useEffect } from "react";
import { MarketService, MarketModel } from "../services/MarketService";
import { MarketRepository } from "../data/repositories/MarketRepository";

// Dependency Injection Root (could be a Context Provider in a larger app)
const repo = new MarketRepository();
const service = new MarketService(repo);

export function useMarketService(orgId: string) {
    const [markets, setMarkets] = useState<MarketModel[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const getMarkets = async (orgId: string) => {
        setIsLoading(true);
        try {
            const data = await service.getActiveMarkets(orgId);
            setMarkets(data);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const getMarket = async (id: string) => {
        setIsLoading(true);
        try {
            return await service.getMarket(id);
        } catch (err) {
            console.error(err);
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    const getMarketHistory = async (id: string) => {
        return await service.getMarketHistory(id);
    };

    useEffect(() => {
        getMarkets(orgId);
    }, [orgId]);

    return { markets, isLoading, getMarkets, getMarket, getMarketHistory };
}

