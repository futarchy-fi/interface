
import { createPublicClient, http, parseAbi } from 'viem';
import { gnosis } from 'viem/chains';

const METADATA_ADDR = '0x3C109eC3c7eB7dA835Dd3B64F575EFAE7aBfDf4E';
const EXPECTED_LOGIC = '0x3D076d5d12341226527241f8a489D4A8863B73e5';

// Minimal ABI for the function we want to test
const ABI = parseAbi([
    'function proposalAddress() view returns (address)',
    'function proposal() view returns (address)'
]);

async function run() {
    console.log(`Testing resolution for ${METADATA_ADDR} on Gnosis (100)`);

    const client = createPublicClient({
        chain: gnosis,
        transport: http()
    });

    // Try 'proposalAddress'
    try {
        console.log("Attempting 'proposalAddress()'...");
        const result = await client.readContract({
            address: METADATA_ADDR,
            abi: ABI,
            functionName: 'proposalAddress'
        });
        console.log(`✅ proposalAddress() success: ${result}`);
        if (result.toLowerCase() === EXPECTED_LOGIC.toLowerCase()) {
            console.log("MATCHES EXPECTED LOGIC ADDRESS!");
        } else {
            console.log("does NOT match expected logic address.");
        }
    } catch (e) {
        console.log(`❌ proposalAddress() failed: ${e.message}`);
    }

    // Try 'proposal' (just in case)
    try {
        console.log("Attempting 'proposal()'...");
        const result = await client.readContract({
            address: METADATA_ADDR,
            abi: ABI,
            functionName: 'proposal'
        });
        console.log(`✅ proposal() success: ${result}`);
    } catch (e) {
        console.log(`❌ proposal() failed:`); // Short error to avoid clutter if expected
    }
}

run();
