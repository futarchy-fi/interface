import { createPublicClient, http, parseAbi } from 'viem';
import { gnosis } from 'viem/chains';

const POSITION_MANAGER = '0x7495a583ba85875d59407781b4958ED6e0E1228f';

const client = createPublicClient({
    chain: gnosis,
    transport: http('https://rpc.gnosischain.com')
});

// First, let's check if the position manager even has a factory() function
console.log('Checking Position Manager at:', POSITION_MANAGER);

// Try different possible function signatures
const possibleAbis = [
    parseAbi(['function factory() view returns (address)']),
    parseAbi(['function poolFactory() view returns (address)']),
    parseAbi(['function algebraFactory() view returns (address)']),
];

for (const abi of possibleAbis) {
    const funcName = abi[0].name;
    console.log(`\nTrying function: ${funcName}()`);
    try {
        const result = await client.readContract({
            address: POSITION_MANAGER,
            abi: abi,
            functionName: funcName
        });
        console.log(`  Success! Result: ${result}`);
    } catch (error) {
        console.log(`  Failed: ${error.message.split('\n')[0]}`);
    }
}

// Let's also try reading storage slots directly to find the factory
console.log('\n\nChecking storage slots for potential factory addresses:');
for (let i = 0; i < 10; i++) {
    try {
        const value = await client.getStorageAt({
            address: POSITION_MANAGER,
            slot: `0x${i.toString(16).padStart(64, '0')}`
        });
        if (value && value !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
            // Check if it looks like an address (20 bytes with leading zeros)
            if (value.startsWith('0x000000000000000000000000')) {
                const addr = '0x' + value.slice(26);
                console.log(`  Slot ${i}: ${addr} (potential address)`);
            }
        }
    } catch (error) {
        console.log(`  Slot ${i}: Error reading`);
    }
}

// Also, let's check what's actually at the factory addresses we've been trying
const factoriesToCheck = [
    '0x30c4e9D7deCed8511AE1Fae9d93deDE2b427343d',
    '0xA7F069E8767C73838294393AeA58D88EF11a8c70'
];

console.log('\n\nChecking if these addresses are contracts:');
for (const addr of factoriesToCheck) {
    const code = await client.getBytecode({ address: addr });
    console.log(`  ${addr}: ${code ? 'IS a contract' : 'NOT a contract'}`);
}