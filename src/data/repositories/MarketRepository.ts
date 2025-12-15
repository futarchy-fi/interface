// src/data/repositories/MarketRepository.ts
// DATA LAYER: Raw access to external systems
import { createPublicClient, http, getAddress, formatUnits } from 'viem';
import { gnosis } from 'viem/chains';
import { FUTARCHY_PROPOSAL_ABI } from '../abis/FutarchyProposal';

export interface RawMarketDTO {
    id: string;
    title: string;
    collateralToken: string; // This might be used for display, but we have multiple tokens now
    outcomeTokens: string[];
    // Extended Data
    marketName: string;
    tokens: {
        collateral1: string;
        collateral2: string;
        yesCompany: string; // wrappedOutcome(0)
        noCompany: string;  // wrappedOutcome(1)
        yesCurrency: string; // wrappedOutcome(2)
        noCurrency: string;  // wrappedOutcome(3)
    };
    rawStatus: number;
}

const client = createPublicClient({
    chain: gnosis,
    transport: http('https://rpc.gnosischain.com')
});

export class MarketRepository {
    async fetchMarkets(orgId: string): Promise<RawMarketDTO[]> {
        // Keeping fetchMarkets mock for now as we focus on single proposal detail
        console.log(`[Repo] Fetching markets for org: ${orgId}`);
        return [];
    }

    async fetchMarket(id: string): Promise<RawMarketDTO | null> {
        console.log(`[Repo] Fetching real market data for: ${id}`);
        try {
            const proposalAddress = getAddress(id);

            console.log(`[Repo] Proposal Address: ${proposalAddress}`);

            // Fetch using Multicall for efficiency
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

            console.log("[Repo] Multicall Results:", results);

            if (marketName.status !== 'success') {
                console.error("[Repo] Market Name fetch failed:", marketName);
                return null;
            }

            // Extract values (wrappedOutcome returns [address, data])
            const yesCompany = (wo0.result as unknown as any[])[0];
            const noCompany = (wo1.result as unknown as any[])[0];
            const yesCurrency = (wo2.result as unknown as any[])[0];
            const noCurrency = (wo3.result as unknown as any[])[0];

            return {
                id,
                title: marketName.result as string,
                collateralToken: collateral1.result as string, // Defaulting to col1 for legacy compat
                outcomeTokens: [yesCompany, noCompany], // Legacy compat
                marketName: marketName.result as string,
                tokens: {
                    collateral1: collateral1.result as string,
                    collateral2: collateral2.result as string,
                    yesCompany,
                    noCompany,
                    yesCurrency,
                    noCurrency
                },
                rawStatus: 1 // Assuming active for now
            };

        } catch (error) {
            console.error("Failed to fetch market from chain:", error);
            return null;
        }
    }
}
