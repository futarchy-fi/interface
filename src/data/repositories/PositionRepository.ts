// src/data/repositories/PositionRepository.ts
// DATA LAYER: Fetches user positions from Chain/Subgraph

export interface RawPositionDTO {
    tokenSymbol: string;
    balance: string; // Raw BigInt string
    tokenAddress: string;
    marketId?: string;
}

export class PositionRepository {
    async fetchPositions(userAddress: string): Promise<RawPositionDTO[]> {
        console.log(`[Repo] Fetching positions for user: ${userAddress}`);

        // Mock Data for now - eventually use Executor or Subgraph
        return [
            { tokenSymbol: "sDAI", balance: "100000000000000000000", tokenAddress: "0xSDAI" },
            { tokenSymbol: "YES_sDAI", balance: "50000000000000000000", tokenAddress: "0xYES" },
            { tokenSymbol: "NO_sDAI", balance: "0", tokenAddress: "0xNO" }
        ];
    }
}
