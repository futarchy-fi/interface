export interface MarketPoint {
    time: string; // e.g., "10:00"
    priceYes: number; // e.g., 0.65
    priceNo: number; // e.g., 0.35
    volume: number;
}

export interface MarketChartProps {
    proposalId: string;
}
