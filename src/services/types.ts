
import { Address, Hex } from 'viem';

export type MethodInference =
    | { ok: true; functionName: string; args: unknown[]; abiSource: 'verified' | 'proxy' | 'ERC20' }
    | { ok: true; selector: Hex; candidates: string[]; abiSource: '4byte' }
    | { ok: false; reason: string };

export type SafetyReport = {
    eth: { deltaWei: string };
    erc20: Array<{ token: Address; symbol?: string; decimals?: number; delta: string }>;
    approvals: Array<{ token: Address; spender: Address; amount: string; type: "approve" | "permit" }>;
    risks: string[];
};

export type PreflightCheck = {
    status: 'OK' | 'NEEDS_APPROVAL' | 'INSUFFICIENT_FUNDS' | 'ERROR';
    missingAllowance?: {
        token: Address;
        spender: Address;
        amount: bigint;
    };
    missingBalance?: {
        token: Address;
        required: bigint;
        available: bigint;
    };
    error?: string;
};
