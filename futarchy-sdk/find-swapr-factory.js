import { createPublicClient, http, parseAbi } from 'viem';
import { gnosis } from 'viem/chains';

const SWAPR_POSITION_MGR = '0x91fd594c46d8b01e62dbdebed2401dde01817834';

const client = createPublicClient({
    chain: gnosis,
    transport: http('https://rpc.gnosischain.com')
});

console.log('Checking Swapr Position Manager at:', SWAPR_POSITION_MGR);

try {
    const factory = await client.readContract({
        address: SWAPR_POSITION_MGR,
        abi: parseAbi(['function factory() view returns (address)']),
        functionName: 'factory'
    });
    console.log('Factory address:', factory);
    
    // Check if it's a contract
    const code = await client.getBytecode({ address: factory });
    console.log('Is contract:', code ? 'YES' : 'NO');
    
    // If it's a contract, try to call poolByPair
    if (code) {
        console.log('\nTrying poolByPair on this factory...');
        const factoryAbi = parseAbi(['function poolByPair(address,address) view returns (address)']);
        
        // Test with sDAI/GNO pair
        const sdai = '0xaf204776c7245bF4147c2612BF6e5972Ee483701';
        const gno = '0x9C58BAcC331c9aa871AFD802DB6379a98e80CEdb';
        
        try {
            const pool = await client.readContract({
                address: factory,
                abi: factoryAbi,
                functionName: 'poolByPair',
                args: [sdai, gno]
            });
            console.log(`  sDAI/GNO pool: ${pool}`);
        } catch (e) {
            console.log(`  Error: ${e.message.split('\n')[0]}`);
        }
    }
} catch (error) {
    console.log('Error:', error.message.split('\n')[0]);
}