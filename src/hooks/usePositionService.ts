"use client";
// src/hooks/usePositionService.ts
// CONTEXT/UI LAYER

import { useState, useEffect } from "react";
import { PositionService, PositionModel } from "../services/PositionService";
import { PositionRepository } from "../data/repositories/PositionRepository";

const repo = new PositionRepository();
const service = new PositionService(repo);

export function usePositionService(userAddress: string | null) {
    const [positions, setPositions] = useState<PositionModel[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!userAddress) return;

        setIsLoading(true);
        service.getUserPositions(userAddress)
            .then(setPositions)
            .catch(console.error)
            .finally(() => setIsLoading(false));
    }, [userAddress]);

    return { positions, isLoading };
}
