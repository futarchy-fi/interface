export interface Position {
    id: string;
    marketName: string;
    side: 'YES' | 'NO';
    avgPrice: number;
    currentPrice: number;
    shares: number;
    value: number; // Current Value
    pnl: number; // Profit/Loss %
    pnlUsd: number; // Profit/Loss in USD
}

export interface PortfolioPositionsProps {
    userAddress?: string; // Optional for now
}
