import { TransactionWorkflow, TransactionStep } from "../types";
import { checkTransactionPreflight } from "../../../../services/TransactionGuard";
import { parseUnits } from "viem";

// Mock Address Map for Prototype
const MOCK_ADDRESSES: Record<string, string> = {
    'sDAI': '0x83F20F44975D03b1b09e64809B757c47f942BEeA',
    'YES_sDAI': '0x0000000000000000000000000000000000000001',
    'NO_sDAI': '0x0000000000000000000000000000000000000002',
    'ROUTER': '0x7495a583ba85875d59407781b4958ED6e0E1228f' // Specific Router from user prompt
};

export const SwapWorkflow: TransactionWorkflow = {
    id: 'SWAP',

    getSteps: async (params: any, executor?: any): Promise<TransactionStep[]> => {
        const steps: TransactionStep[] = [];
        let tokenAddress = MOCK_ADDRESSES[params.payToken] || '0x0000000000000000000000000000000000000000';

        // Dynamic Token Resolution
        if (executor) {
            try {
                const tokens = await executor.run('market.getTokens');
                if (params.payToken === 'sDAI') tokenAddress = tokens.COLLATERAL_2;
                else if (params.payToken === 'YES_sDAI') tokenAddress = tokens.YES_COLLATERAL_2;
                else if (params.payToken === 'NO_sDAI') tokenAddress = tokens.NO_COLLATERAL_2;
            } catch (e) { console.warn("Failed to fetch tokens from executor", e); }
        }

        const userAddress = params.userAddress || '0x0000000000000000000000000000000000000000'; // Fallback

        // 1. Check Allowance for Pay Token
        // In a real app, we would get the decimals from metadata. Assuming 18 here.
        const amountBI = parseUnits(params.amount || '0', 18);

        // Intentionally skip check if amount is 0 (initial render)
        if (amountBI > BigInt(0)) {
            const check = await checkTransactionPreflight({
                from: userAddress,
                to: MOCK_ADDRESSES.ROUTER,
                token: tokenAddress,
                amount: amountBI
            });

            if (check.status === 'NEEDS_APPROVAL' || check.status === 'ERROR') {
                // If Error (e.g. invalid address), we might still show Approve for safety or handle gracefully
                // For now, always showing Approve if check fails or returns needs approval
                steps.push({
                    id: 'SWAP_APPROVE',
                    label: `Approve ${params.payToken}`,
                    description: `Allow Router to spend your ${params.payToken}`,
                    group: 1
                });
            }
        } else {
            // Default steps if amount is 0 (or just show structure)
            steps.push({ id: 'SWAP_APPROVE', label: 'Approve', description: 'Checking allowance...', group: 1 });
        }

        // 2. Execute Step
        steps.push({
            id: 'SWAP_EXECUTE',
            label: 'Swap Tokens',
            description: `Exchange ${params.payToken} for ${params.side}`,
            group: 2
        });

        return steps;
    },

    getSummary: (params: any) =>
        `Swapping ${params.amount} ${params.payToken} for ${params.side}.`,

    getSuccessMessage: (params: any) =>
        `Successfully swapped for ${params.side}.`,

    executeStep: async (stepId: string, params: any, executor?: any) => {
        console.log(`Executing ${stepId} with params`, params);
        // Mock Execution Delay
        return new Promise(resolve => setTimeout(resolve, 2000));
    }
};
