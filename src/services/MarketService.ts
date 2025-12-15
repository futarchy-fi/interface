
// src/services/MarketService.ts
// SERVICE LAYER: Business Logic, Transformation, Coordination

import { MarketRepository, RawMarketDTO } from "../data/repositories/MarketRepository";

export interface MarketModel {
    id: string;
    name: string;
    description: string;
    endTime: number;
    tokens: { collateral: string, yes: string, no: string };
    isOpen: boolean;
}

export class MarketService {
    private repo: MarketRepository;

    constructor(repo: MarketRepository) {
        this.repo = repo;
    }

    async getActiveMarkets(orgId: string): Promise<MarketModel[]> {
        const rawMarkets = await this.repo.fetchMarkets(orgId);

        // Logic: Filter active, Transform DTO -> Domain Model
        return rawMarkets
            .filter(m => m.rawStatus === 1)
            .map(this.transformToModel);
    }

    async getMarket(id: string): Promise<MarketModel | null> {
        const raw = await this.repo.fetchMarket(id);
        if (!raw) return null;
        return this.transformToModel(raw);
    }

    async getMarketHistory(id: string): Promise<any[]> {
        // Mock History Data for now, ideally this comes from a HistoryRepository or Subgraph
        return [
            { timestamp: 1709251200000, yesPrice: 0.45, noPrice: 0.55 },
            { timestamp: 1709337600000, yesPrice: 0.48, noPrice: 0.52 },
            { timestamp: 1709424000000, yesPrice: 0.52, noPrice: 0.48 },
            { timestamp: 1709510400000, yesPrice: 0.60, noPrice: 0.40 },
            { timestamp: 1709596800000, yesPrice: 0.58, noPrice: 0.42 }
        ];
    }

    private transformToModel(dto: RawMarketDTO): MarketModel {
        return {
            id: dto.id,
            name: dto.marketName || dto.title,
            description: dto.title, // Using title/marketName as description for now
            endTime: Date.now() + 15 * 24 * 60 * 60 * 1000, // Mock +15 days until we fetch 'endTime'
            tokens: {
                collateral: dto.tokens?.collateral1 || dto.collateralToken,
                yes: dto.tokens?.yesCompany || dto.outcomeTokens[0],
                no: dto.tokens?.noCompany || dto.outcomeTokens[1]
            },
            isOpen: dto.rawStatus === 1
        };
    }
}
