import { TransactionWorkflow, TransactionStep } from "../types";

const STEPS: TransactionStep[] = [
    { id: 'SPLIT_APPROVE', label: 'Approve USDC', description: 'Allow the Splitter contract to spend your USDC', group: 1 },
    { id: 'SPLIT_EXECUTE', label: 'Split Collateral', description: 'Split USDC into YES and NO tokens', group: 1 },
    { id: 'SWAP_APPROVE', label: 'Approve Outcome', description: 'Allow the Router to access your tokens', group: 2 },
    { id: 'SWAP_EXECUTE', label: 'Swap Tokens', description: 'Exchange your tokens for the desired outcome', group: 2 },
];

export const BuySellWorkflow: TransactionWorkflow = {
    id: 'BUY_SELL',

    getSteps: async (params: any, executor?: any) => STEPS,

    getSummary: (params: any) =>
        `You are splitting ${params.amount} USDC into NO_USDC and YES_USDC.`,

    getSuccessMessage: (params: any) =>
        `You successfully traded ${params.amount} USDC for ${params.side} tokens.`,

    executeStep: async (stepId: string, params: any, executor?: any) => {
        // Mock Execution Delay
        return new Promise(resolve => setTimeout(resolve, 2000));
    }
};
