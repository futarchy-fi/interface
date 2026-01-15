
import { createPublicClient, http, getAddress, isAddress } from 'viem';
import { gnosis } from 'viem/chains';
import { IMarketProvider, RawMarketDTO } from './IMarketProvider';
import { FUTARCHY_PROPOSAL_ABI } from '../abis/FutarchyProposal';
import { ALGEBRA_POOL_ABI, ALGEBRA_FACTORY_ABI, ALGEBRA_POSITION_MANAGER_ABI } from '../abis/Algebra';

import { MOCK_CONFIG } from '@/config/mocks';

const SWAPR_POSITION_MANAGER = '0x91fD594c46D8B01E62dBDeBed2401dde01817834';

const client = createPublicClient({
    chain: gnosis,
    transport: http(MOCK_CONFIG.MARKET.RPC_URL, {
        retryCount: 3,
        retryDelay: 1000
    })
});

export class RPCMarketProvider implements IMarketProvider {
    async fetchMarkets(orgId: string): Promise<RawMarketDTO[]> {
        return []; // Not implemented for RPC yet
    }

    async fetchMarket(id: string): Promise<RawMarketDTO | null> {
        if (id === 'prop-1') {
            return {
                id: 'prop-1',
                title: 'Mock Strategy Analysis',
                marketName: 'What will be the price of GNO if GIP-88 is approved?',
                tokens: {
                    collateral1: '0x0000000000000000000000000000000000000001',
                    collateral2: '0x0000000000000000000000000000000000000002',
                    yesCompany: '0x0000000000000000000000000000000000000003',
                    noCompany: '0x0000000000000000000000000000000000000004',
                    yesCurrency: '0x0000000000000000000000000000000000000005',
                    noCurrency: '0x0000000000000000000000000000000000000006',
                },
                rawStatus: 1,
                yesPoolAddress: '0xC8EbA45879f8428A980452967EE087761752969a',
                noPoolAddress: '0x0000000000000000000000000000000000000000',
                collateralToken: '0x0000000000000000000000000000000000000001',
                outcomeTokens: ['0x0000000000000000000000000000000000000003', '0x0000000000000000000000000000000000000004']
            };
        }

        if (!isAddress(id)) {
            console.warn(`[RPCMarketProvider] Invalid address ID: ${id}`);
            return null;
        }
        try {
            const proposalAddress = getAddress(id);

            const results = await client.multicall({
                contracts: [
                    { address: proposalAddress, abi: FUTARCHY_PROPOSAL_ABI, functionName: 'marketName' },
                    { address: proposalAddress, abi: FUTARCHY_PROPOSAL_ABI, functionName: 'collateralToken1' },
                    { address: proposalAddress, abi: FUTARCHY_PROPOSAL_ABI, functionName: 'collateralToken2' },
                    { address: proposalAddress, abi: FUTARCHY_PROPOSAL_ABI, functionName: 'wrappedOutcome', args: [BigInt(0)] },
                    { address: proposalAddress, abi: FUTARCHY_PROPOSAL_ABI, functionName: 'wrappedOutcome', args: [BigInt(1)] },
                    { address: proposalAddress, abi: FUTARCHY_PROPOSAL_ABI, functionName: 'wrappedOutcome', args: [BigInt(2)] },
                    { address: proposalAddress, abi: FUTARCHY_PROPOSAL_ABI, functionName: 'wrappedOutcome', args: [BigInt(3)] }
                ]
            });

            const [
                marketName,
                collateral1,
                collateral2,
                wo0, wo1, wo2, wo3
            ] = results;

            if (marketName.status !== 'success') return null;

            const yesCompany = (wo0.result as unknown as any[])[0];
            const noCompany = (wo1.result as unknown as any[])[0];
            const yesCurrency = (wo2.result as unknown as any[])[0];
            const noCurrency = (wo3.result as unknown as any[])[0];

            const col1 = collateral1.result as string;
            const col2 = collateral2.result as string;

            // Discovery: Get Factory from Position Manager
            const factoryResult = await client.readContract({
                address: SWAPR_POSITION_MANAGER,
                abi: ALGEBRA_POSITION_MANAGER_ABI,
                functionName: 'factory'
            });

            // Discovery: Get Pools from Factory
            const [yesPool, noPool] = await client.multicall({
                contracts: [
                    { address: factoryResult, abi: ALGEBRA_FACTORY_ABI, functionName: 'poolByPair', args: [yesCompany, yesCurrency] },
                    { address: factoryResult, abi: ALGEBRA_FACTORY_ABI, functionName: 'poolByPair', args: [noCompany, noCurrency] }
                ]
            });

            return {
                id,
                title: marketName.result as string,
                marketName: marketName.result as string,
                tokens: {
                    collateral1: col1,
                    collateral2: col2,
                    yesCompany,
                    noCompany,
                    yesCurrency,
                    noCurrency
                },
                rawStatus: 1,
                yesPoolAddress: yesPool.status === 'success' ? yesPool.result as string : undefined,
                noPoolAddress: noPool.status === 'success' ? noPool.result as string : undefined,
                collateralToken: col1,
                outcomeTokens: [yesCompany, noCompany]
            };
        } catch (error) {
            console.error("[RPCMarketProvider] Failed to fetch market:", error);
            return null;
        }
    }

    async fetchLatestPrice(poolAddress: string, tokenA?: string, tokenB?: string): Promise<number | null> {
        if (!poolAddress || !isAddress(poolAddress) || poolAddress === '0x0000000000000000000000000000000000000000') return null;

        try {
            const [globalState, t0, t1] = await client.multicall({
                contracts: [
                    { address: poolAddress as `0x${string}`, abi: ALGEBRA_POOL_ABI, functionName: 'globalState' },
                    { address: poolAddress as `0x${string}`, abi: ALGEBRA_POOL_ABI, functionName: 'token0' },
                    { address: poolAddress as `0x${string}`, abi: ALGEBRA_POOL_ABI, functionName: 'token1' },
                ]
            });

            if (globalState.status !== 'success') return null;

            const sqrtPriceX96 = globalState.result[0];
            // Price = (sqrtPrice / 2^96)^2
            const price = Number((BigInt(sqrtPriceX96) * BigInt(sqrtPriceX96) * BigInt(Math.pow(10, 18))) / (BigInt(2) ** BigInt(192))) / Math.pow(10, 18);

            // UNIV3 Price is always Token1 / Token0
            // If tokenA is token1, then Price = 1 / rawPrice
            if (t0.status === 'success' && tokenA) {
                const isTokenA0 = (t0.result as string).toLowerCase() === tokenA.toLowerCase();
                if (!isTokenA0) {
                    return price !== 0 ? 1 / price : 0;
                }
            }

            return price;
        } catch (err) {
            console.error(`[RPCMarketProvider] Failed to fetch price for ${poolAddress}:`, err);
            return null;
        }
    }

    async fetchHistory(poolAddress: string, limit?: number): Promise<any[]> {
        // RPC typically doesn't support historical candles directly without indexers
        return [];
    }

    async fetchTradeHistory(proposalId: string, limit?: number): Promise<any[]> {
        return [];
    }
}
