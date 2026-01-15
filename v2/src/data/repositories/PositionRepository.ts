import { createPublicClient, http, getAddress, isAddress } from 'viem';
import { gnosis } from 'viem/chains';
import { MOCK_CONFIG } from '@/config/mocks';
import { ERC20_ABI } from '../abis/ERC20';

export interface RawPositionDTO {
    tokenSymbol: string;
    balance: string; // Raw BigInt string
    tokenAddress: string;
    marketId?: string;
}

const client = createPublicClient({
    chain: gnosis,
    transport: http(MOCK_CONFIG.MARKET.RPC_URL)
});

export class PositionRepository {
    async fetchPositions(userAddress: string): Promise<RawPositionDTO[]> {
        // This would traditionally scan an indexer. 
        // For specific markets, we use fetchTokenBalances instead.
        return [];
    }

    async fetchTokenBalances(userAddress: string, tokenAddresses: string[]): Promise<RawPositionDTO[]> {
        if (!userAddress || !isAddress(userAddress)) return [];

        const validTokens = tokenAddresses.filter(a => a && isAddress(a)).map(a => getAddress(a));
        if (validTokens.length === 0) return [];

        try {
            const results = await client.multicall({
                contracts: validTokens.flatMap(token => [
                    { address: token, abi: ERC20_ABI, functionName: 'balanceOf', args: [getAddress(userAddress)] },
                    { address: token, abi: ERC20_ABI, functionName: 'symbol' }
                ])
            });

            const positions: RawPositionDTO[] = [];
            for (let i = 0; i < validTokens.length; i++) {
                const balanceRes = results[i * 2];
                const symbolRes = results[i * 2 + 1];

                if (balanceRes.status === 'success') {
                    positions.push({
                        tokenAddress: validTokens[i],
                        tokenSymbol: symbolRes.status === 'success' ? symbolRes.result as string : '???',
                        balance: (BigInt(balanceRes.result as any)).toString()
                    });
                }
            }
            return positions;
        } catch (error) {
            console.error("[PositionRepository] Failed to fetch balances:", error);
            return [];
        }
    }
}
