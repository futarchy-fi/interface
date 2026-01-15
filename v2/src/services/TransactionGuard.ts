
import { createPublicClient, http, getAddress, Hex, erc20Abi, Address } from 'viem';
import { gnosis } from 'viem/chains';
import { PreflightCheck } from './types';

// Default to Gnosis for this project
const CLIENT = createPublicClient({
    chain: gnosis,
    transport: http('https://rpc.gnosischain.com')
});

export async function checkTransactionPreflight({
    from,
    to, // The contract being called (Spender)
    token, // The token being moved
    amount,
    rpcUrl
}: {
    from: string;
    to: string;
    token: string;
    amount: bigint;
    rpcUrl?: string;
}): Promise<PreflightCheck> {
    const publicClient = rpcUrl ? createPublicClient({ chain: gnosis, transport: http(rpcUrl) }) : CLIENT;
    const userAddress = getAddress(from);
    const spenderAddress = getAddress(to);
    const tokenAddress = getAddress(token);

    try {
        // 1. Check Balance
        const balance = await publicClient.readContract({
            address: tokenAddress,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [userAddress]
        });

        if (balance < amount) {
            return {
                status: 'INSUFFICIENT_FUNDS',
                missingBalance: {
                    token: tokenAddress,
                    required: amount,
                    available: balance
                }
            };
        }

        // 2. Check Allowance
        const allowance = await publicClient.readContract({
            address: tokenAddress,
            abi: erc20Abi,
            functionName: 'allowance',
            args: [userAddress, spenderAddress]
        });

        if (allowance < amount) {
            return {
                status: 'NEEDS_APPROVAL',
                missingAllowance: {
                    token: tokenAddress,
                    spender: spenderAddress,
                    amount: amount
                }
            };
        }

        return { status: 'OK' };

    } catch (error: any) {
        return { status: 'ERROR', error: error.message };
    }
}
