
import { createPublicClient, http, getAddress, parseAbi } from 'viem';
import { gnosis } from 'viem/chains';

const PROPOSAL_ID = "0x3D076d5d12341226527241f8a489D4A8863B73e5";
const ABI = parseAbi(['function marketName() view returns (string)']);

const client = createPublicClient({
    chain: gnosis,
    transport: http('https://rpc.gnosischain.com')
});

async function main() {
    const name = await client.readContract({
        address: getAddress(PROPOSAL_ID),
        abi: ABI,
        functionName: 'marketName'
    });
    console.log("MARKET_NAME_START");
    console.log(name);
    console.log("MARKET_NAME_END");
}

main();
