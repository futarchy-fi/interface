
import { createPublicClient, http, getAddress, parseAbi } from 'viem';
import { gnosis } from 'viem/chains';

const PROPOSAL_ID = "0x3D076d5d12341226527241f8a489D4A8863B73e5";

// Inline ABI for simplicity in debug script
const PROPOSAL_ABI = parseAbi([
    'function marketName() view returns (string)',
    'function collateralToken1() view returns (address)',
    'function collateralToken2() view returns (address)',
    'function wrappedOutcome(uint256) view returns (address, bytes)',
    // ERC20
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)',
    'function name() view returns (string)'
]);

const client = createPublicClient({
    chain: gnosis,
    transport: http('https://rpc.gnosischain.com')
});

async function main() {
    try {
        const proposalAddress = getAddress(PROPOSAL_ID);

        // 1. Fetch Basic Proposal Data
        const [
            marketName,
            collateral1,
            collateral2,
            wo0, wo1, wo2, wo3
        ] = await client.multicall({
            contracts: [
                { address: proposalAddress, abi: PROPOSAL_ABI, functionName: 'marketName' },
                { address: proposalAddress, abi: PROPOSAL_ABI, functionName: 'collateralToken1' },
                { address: proposalAddress, abi: PROPOSAL_ABI, functionName: 'collateralToken2' },
                { address: proposalAddress, abi: PROPOSAL_ABI, functionName: 'wrappedOutcome', args: [0n] },
                { address: proposalAddress, abi: PROPOSAL_ABI, functionName: 'wrappedOutcome', args: [1n] },
                { address: proposalAddress, abi: PROPOSAL_ABI, functionName: 'wrappedOutcome', args: [2n] },
                { address: proposalAddress, abi: PROPOSAL_ABI, functionName: 'wrappedOutcome', args: [3n] }
            ]
        });

        const getAddr = (res) => (res.result)?.[0];

        async function getToken(addr) {
            if (!addr) return null;
            try {
                const [sym, dec] = await client.multicall({
                    contracts: [
                        { address: addr, abi: PROPOSAL_ABI, functionName: 'symbol' },
                        { address: addr, abi: PROPOSAL_ABI, functionName: 'decimals' }
                    ]
                });
                return { address: addr, symbol: sym.result, decimals: dec.result };
            } catch { return { address: addr, error: 'fetch_failed' }; }
        }

        const result = {
            marketName: marketName.result,
            collateral1: await getToken(collateral1.result),
            collateral2: await getToken(collateral2.result),
            outcomes: {
                0: await getToken(getAddr(wo0)),
                1: await getToken(getAddr(wo1)),
                2: await getToken(getAddr(wo2)),
                3: await getToken(getAddr(wo3)),
            }
        };

        console.log("JSON_START");
        console.log(JSON.stringify(result, null, 2));
        console.log("JSON_END");

    } catch (error) {
        console.error("Error:", error);
    }
}

main();
