import { Position } from "../../types";

export const MockPortfolioAdapter = {
    fetchPositions: async (): Promise<Position[]> => {
        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, 600));

        return [
            {
                id: "pos-1",
                marketName: "AIP-4: Incentivize Liquidity",
                side: "YES",
                avgPrice: 0.45,
                currentPrice: 0.65,
                shares: 1000,
                value: 650,
                pnl: 44.4,
                pnlUsd: 200
            },
            {
                id: "pos-2",
                marketName: "Arbitrum Grant Program",
                side: "NO",
                avgPrice: 0.80,
                currentPrice: 0.20,
                shares: 500,
                value: 100,
                pnl: -75.0,
                pnlUsd: -300
            },
            {
                id: "pos-3",
                marketName: "Uniswap Fee Switch",
                side: "YES",
                avgPrice: 0.10,
                currentPrice: 0.12,
                shares: 10000,
                value: 1200,
                pnl: 20.0,
                pnlUsd: 200
            }
        ];
    }
};
