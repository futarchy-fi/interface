import { ITradeExecutor, TradeRequest, TradeResult } from "./types";

export class MockTradeAdapter implements ITradeExecutor {

    async checkAllowance(token: string, owner: string, spender: string): Promise<string> {
        // Mock infinite allowance or 0
        return "0";
    }

    async approve(token: string, spender: string, amount: string): Promise<TradeResult> {
        await new Promise(r => setTimeout(r, 1000));
        return { txHash: "0xMockApprovalHash", status: 'success' };
    }

    async executeTrade(request: TradeRequest): Promise<TradeResult> {
        await new Promise(r => setTimeout(r, 2000));
        console.log(`[MockExecutor] Swapping ${request.amountIn} via path ${request.path}`);

        return {
            txHash: "0x" + Math.random().toString(16).substr(2, 40),
            status: "success"
        };
    }
}
