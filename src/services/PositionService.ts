// src/services/PositionService.ts
// SERVICE LAYER: Aggregates position data

import { PositionRepository, RawPositionDTO } from "../data/repositories/PositionRepository";

export interface PositionModel {
    id: string;
    marketName: string;
    side: 'YES' | 'NO';
    avgPrice: number;
    currentPrice: number;
    shares: number;
    value: number;
    pnl: number;
    pnlUsd: number;
    tokenSymbol: string;
}

export class PositionService {
    private repo: PositionRepository;

    constructor(repo: PositionRepository) {
        this.repo = repo;
    }

    async getUserPositions(userAddress: string): Promise<PositionModel[]> {
        const raw = await this.repo.fetchPositions(userAddress);

        // Filter for only Outcome Tokens for this view (mock logic)
        return raw.filter(p => p.tokenSymbol.includes('_')).map(this.transformToModel);
    }

    private transformToModel(dto: RawPositionDTO): PositionModel {
        const bal = parseFloat(dto.balance) / 1e18;
        const isYes = dto.tokenSymbol.startsWith('YES');

        // Mock Business Logic for PnL
        const avgPrice = isYes ? 0.55 : 0.45;
        const currentPrice = isYes ? 0.60 : 0.40;
        const value = bal * currentPrice;
        const cost = bal * avgPrice;

        return {
            id: dto.tokenAddress,
            marketName: "Will GNO price be >= 130 sDAI?", // Mock linkage
            side: isYes ? 'YES' : 'NO',
            avgPrice,
            currentPrice,
            shares: bal,
            value,
            pnl: ((value - cost) / cost) * 100,
            pnlUsd: value - cost,
            tokenSymbol: dto.tokenSymbol
        };
    }
}
