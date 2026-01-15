import { TransactionWorkflow, TransactionStep } from "../types";
import { checkTransactionPreflight } from "../../../../services/TransactionGuard";
import { parseUnits } from "viem";

const MOCK_ADDRESSES: Record<string, string> = {
    'YES_sDAI': '0x0000000000000000000000000000000000000001',
    'NO_sDAI': '0x0000000000000000000000000000000000000002',
    'ROUTER': '0x7495a583ba85875d59407781b4958ED6e0E1228f'
};

export const MergeWorkflow: TransactionWorkflow = {
    id: 'MERGE',

    getSteps: async (params: any, executor?: any): Promise<TransactionStep[]> => {
        const steps: TransactionStep[] = [];
        const userAddress = params.userAddress || '0x0000000000000000000000000000000000000000';
        const amountBI = parseUnits(params.amount || '0', 18);

        let yesToken = MOCK_ADDRESSES['YES_sDAI'];
        let noToken = MOCK_ADDRESSES['NO_sDAI'];

        if (executor) {
            try {
                const tokens = await executor.run('market.getTokens');
                yesToken = tokens.YES_COLLATERAL_2;
                noToken = tokens.NO_COLLATERAL_2;
            } catch (e) { console.warn("Failed to fetch tokens from executor", e); }
        }

        if (amountBI > BigInt(0)) {
            // Check YES Allowance
            const checkYes = await checkTransactionPreflight({
                from: userAddress,
                to: MOCK_ADDRESSES.ROUTER,
                token: yesToken,
                amount: amountBI
            });

            if (checkYes.status === 'NEEDS_APPROVAL' || checkYes.status === 'ERROR') {
                steps.push({
                    id: 'SPLIT_APPROVE',
                    label: 'Approve YES',
                    description: 'Allow Router to spend YES tokens',
                    group: 1
                });
            }

            // Check NO Allowance
            const checkNo = await checkTransactionPreflight({
                from: userAddress,
                to: MOCK_ADDRESSES.ROUTER,
                token: noToken,
                amount: amountBI
            });

            if (checkNo.status === 'NEEDS_APPROVAL' || checkNo.status === 'ERROR') {
                steps.push({
                    id: 'SWAP_APPROVE',
                    label: 'Approve NO',
                    description: 'Allow Router to spend NO tokens',
                    group: 1
                });
            }

        } else {
            steps.push({ id: 'SPLIT_APPROVE', label: 'Approve YES', description: 'Checking...', group: 1 });
            steps.push({ id: 'SWAP_APPROVE', label: 'Approve NO', description: 'Checking...', group: 1 });
        }

        steps.push({
            id: 'SPLIT_EXECUTE',
            label: 'Merge Positions',
            description: 'Combine YES + NO to redeem sDAI',
            group: 2
        });

        return steps;
    },

    getSummary: (params: any) =>
        `Merging ${params.amount} YES + ${params.amount} NO into sDAI.`,

    getSuccessMessage: (params: any) =>
        `Successfully merged ${params.amount} pairs back to sDAI.`,

    executeStep: async (stepId: string, params: any, executor?: any) => {
        console.log(`Executing ${stepId} with params`, params);
        // Mock Execution Delay
        return new Promise(resolve => setTimeout(resolve, 2000));
    }
};
