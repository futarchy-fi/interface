
import { createPublicClient, http } from 'viem';
import { gnosis } from 'viem/chains';
import 'dotenv/config';

// Full Proposal Metadata ABI (copied from contracts.js for isolation)
const PROPOSAL_ABI = [{ "inputs": [], "name": "owner", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "proposalAddress", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }];

// Address from user
const METADATA_ADDRESS = '0x3C109eC3c7eB7dA835Dd3B64F575EFAE7aBfDf4E';
const LOGIC_ADDRESS = '0x3D076d5d12341226527241f8a489D4A8863B73e5';

async function main() {
    const client = createPublicClient({
        chain: gnosis,
        transport: http('https://rpc.gnosischain.com')
    });

    console.log(`Checking Metadata Address: ${METADATA_ADDRESS}`);
    try {
        const owner = await client.readContract({
            address: METADATA_ADDRESS,
            abi: PROPOSAL_ABI,
            functionName: 'owner'
        });
        console.log(`✅ Owner on Metadata Contract: ${owner}`);
    } catch (e) {
        console.log(`❌ Failed to read owner on Metadata: ${e.message}`);
    }

    console.log(`Checking Logic Address: ${LOGIC_ADDRESS}`);
    try {
        const owner = await client.readContract({
            address: LOGIC_ADDRESS,
            abi: PROPOSAL_ABI,
            functionName: 'owner'
        });
        console.log(`✅ Owner on Logic Contract: ${owner}`);
    } catch (e) {
        console.log(`❌ Failed to read owner on Logic: ${e.message}`);
    }
}

main();
