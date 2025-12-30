export interface TradeInterface {
    proposalId: string;
    side: 'YES' | 'NO';
    amount: number;
}

export interface TradePanelProps {
    proposalId: string;
}
