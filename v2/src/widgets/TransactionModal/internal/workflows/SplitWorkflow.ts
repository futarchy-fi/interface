import { TransactionWorkflow, TransactionStep } from "../types";
import { checkTransactionPreflight } from "../../../../services/TransactionGuard";
import { parseUnits } from "viem";

const MOCK_ADDRESSES: Record<string, string> = {
    'sDAI': '0x83F20F44975D03b1b09e64809B757c47f942BEeA',
    'ROUTER': '0x7495a583ba85875d59407781b4958ED6e0E1228f'
};

export const SplitWorkflow: TransactionWorkflow = {
    id: 'SPLIT',

    getSteps: async (params: any, executor?: any): Promise<TransactionStep[]> => {
        const steps: TransactionStep[] = [];
        const payToken = params.payToken || 'sDAI';
        let tokenAddress = MOCK_ADDRESSES[payToken] || '0x0000000000000000000000000000000000000000';

        if (executor) {
            try {
                const tokens = await executor.run('market.getTokens');
                if (payToken === 'sDAI') tokenAddress = tokens.COLLATERAL_2;
            } catch (e) { console.warn("Failed to fetch tokens from executor", e); }
        }

        const userAddress = params.userAddress || '0x0000000000000000000000000000000000000000';

        const amountBI = parseUnits(params.amount || '0', 18);

        if (amountBI > BigInt(0)) {
            const check = await checkTransactionPreflight({
                from: userAddress,
                to: MOCK_ADDRESSES.ROUTER,
                token: tokenAddress,
                amount: amountBI
            });

            if (check.status === 'NEEDS_APPROVAL' || check.status === 'ERROR') {
                steps.push({
                    id: 'SPLIT_APPROVE',
                    label: `Approve ${payToken}`,
                    description: `Allow Router to spend your ${payToken}`,
                    group: 1
                });
            }
        } else {
            steps.push({ id: 'SPLIT_APPROVE', label: 'Approve', description: 'Checking allowance...', group: 1 });
        }

        steps.push({
            id: 'SPLIT_EXECUTE',
            label: 'Split Collateral',
            description: `Split ${payToken} into YES/NO tokens`,
            group: 2
        });

        return steps;
    },

    getSummary: (params: any) =>
        `Splitting ${params.amount} ${params.payToken || 'sDAI'} into YES and NO tokens.`,

    getSuccessMessage: (params: any) =>
        `Successfully minted ${params.amount} YES and ${params.amount} NO tokens.`,

    executeStep: async (stepId: string, params: any, executor?: any) => {
        console.log(`Executing ${stepId} with params`, params);
        return new Promise(resolve => setTimeout(resolve, 2000));
    }
};
