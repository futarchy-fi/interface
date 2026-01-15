export type StepStatus = 'IDLE' | 'WAITING_WALLET' | 'PENDING_TX' | 'SUCCESS' | 'ERROR';

export interface TransactionStep {
    id: string;
    label: string;
    description: string;
    group: number;
}

export interface TransactionWorkflow {
    id: string;
    // Returns the steps for this specific transaction instance
    getSteps(params: any, executor?: any): Promise<TransactionStep[]>;

    // Returns the current step index based on state (optional, or just managed by runner)
    // executeStep should return a promise that resolves when the step is done
    executeStep(stepId: string, params: any, executor?: any): Promise<void>;

    // Helper to get formatted summary
    getSummary(params: any): string;

    // Helper to get success message
    getSuccessMessage(params: any): string;
}
