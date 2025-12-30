
import { createPublicClient, http, getAddress, erc20Abi, formatUnits } from 'viem';
import { gnosis } from 'viem/chains';
import { FUTARCHY_PROPOSAL_ABI } from '../src/data/abis/FutarchyProposal';

const PROPOSAL_ID = "0x3D076d5d12341226527241f8a489D4A8863B73e5";

const client = createPublicClient({
    chain: gnosis,
    transport: http('https://rpc.ankr.com/gnosis')
});

async function main() {
    console.log(`\n🔍 Verifying Market Data for Proposal: ${PROPOSAL_ID}\n`);

    try {
        const proposalAddress = getAddress(PROPOSAL_ID);

        // 1. Fetch Basic Proposal Data & Token Addresses
        const [
            marketName,
            collateral1,
            collateral2,
            wo0, wo1, wo2, wo3
        ] = await client.multicall({
            contracts: [
                { address: proposalAddress, abi: FUTARCHY_PROPOSAL_ABI, functionName: 'marketName' },
                { address: proposalAddress, abi: FUTARCHY_PROPOSAL_ABI, functionName: 'collateralToken1' },
                { address: proposalAddress, abi: FUTARCHY_PROPOSAL_ABI, functionName: 'collateralToken2' },
                { address: proposalAddress, abi: FUTARCHY_PROPOSAL_ABI, functionName: 'wrappedOutcome', args: [0n] },
                { address: proposalAddress, abi: FUTARCHY_PROPOSAL_ABI, functionName: 'wrappedOutcome', args: [1n] },
                { address: proposalAddress, abi: FUTARCHY_PROPOSAL_ABI, functionName: 'wrappedOutcome', args: [2n] },
                { address: proposalAddress, abi: FUTARCHY_PROPOSAL_ABI, functionName: 'wrappedOutcome', args: [3n] }
            ]
        });

        console.log(`📌 Market Name: "${marketName.result}"`);
        console.log(`--------------------------------------------------`);

        // Helper to fetch token details
        async function fetchTokenDetails(label: string, address: unknown) {
            const tokenAddr = address as string;
            if (!tokenAddr) {
                console.log(`❌ ${label}: Not found`);
                return;
            }

            try {
                const [symbol, decimals, name] = await client.multicall({
                    contracts: [
                        { address: tokenAddr, abi: erc20Abi, functionName: 'symbol' },
                        { address: tokenAddr, abi: erc20Abi, functionName: 'decimals' },
                        { address: tokenAddr, abi: erc20Abi, functionName: 'name' },
                    ]
                });

                console.log(`🏷️  ${label}:`);
                console.log(`    Address: ${tokenAddr}`);
                console.log(`    Name:    ${name.result}`);
                console.log(`    Symbol:  ${symbol.result}`);
                console.log(`    Decimal: ${decimals.result}`);
                console.log(``);
            } catch (e) {
                console.log(`⚠️  ${label}: Failed to fetch details for ${tokenAddr}`);
            }
        }

        // 2. Fetch Details for Collaterals
        await fetchTokenDetails("Collateral 1", collateral1.result);
        await fetchTokenDetails("Collateral 2", collateral2.result);

        // 3. Fetch Details for Wrapped Outcomes
        // wrappedOutcome returns [address, data]
        const getAddr = (res: any) => (res.result as any[])?.[0];

        await fetchTokenDetails("YES Company (Index 0)", getAddr(wo0));
        await fetchTokenDetails("NO Company (Index 1)", getAddr(wo1));
        await fetchTokenDetails("YES Currency (Index 2)", getAddr(wo2));
        await fetchTokenDetails("NO Currency (Index 3)", getAddr(wo3));

    } catch (error) {
        console.error("❌ Error fetching data:", error);
    }
}

main();
