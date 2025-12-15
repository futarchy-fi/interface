export interface TradeRequest {
    proposalId: string;
    amountIn: string;
    amountOutMin: string;
    path: string[]; // e.g. [USDC, YES]
    userAddress: string;
}

export interface TradeResult {
    txHash: string;
    status: 'success' | 'failed';
    error?: string;
}

export interface ITradeExecutor {
    // Check allowancce
    checkAllowance(token: string, owner: string, spender: string): Promise<string>;

    // Approve
    approve(token: string, spender: string, amount: string): Promise<TradeResult>;

    // Execute Split/Swap
    executeTrade(request: TradeRequest): Promise<TradeResult>;
}
