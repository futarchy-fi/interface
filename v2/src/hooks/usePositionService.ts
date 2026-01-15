"use client";
// src/hooks/usePositionService.ts
// CONTEXT/UI LAYER

import { useState, useEffect } from "react";
import { useAccount } from 'wagmi';
import { PositionService, PositionModel } from "../services/PositionService";
import { PositionRepository } from "../data/repositories/PositionRepository";

const repo = new PositionRepository();
const service = new PositionService(repo);

export function usePositionService(overrideAddress?: string | null) {
    const { address: connectedAddress } = useAccount();
    const [positions, setPositions] = useState<PositionModel[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const userAddress = overrideAddress || connectedAddress;

    useEffect(() => {
        if (!userAddress) {
            setPositions([]);
            return;
        }

        setIsLoading(true);
        service.getUserPositions(userAddress)
            .then(setPositions)
            .catch(console.error)
            .finally(() => setIsLoading(false));
    }, [userAddress]);

    return { positions, isLoading, positionService: service, userAddress };
}
