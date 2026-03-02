import { createPublicClient, http } from 'viem';
import { gnosis } from 'viem/chains';

const publicClient = createPublicClient({
    chain: gnosis,
    transport: http('https://rpc.gnosischain.com')
});

const AGGREGATOR = '0xC5eB43D53e2FE5FddE5faf400CC4167e5b5d4Fc1';

const owner = await publicClient.readContract({
    address: AGGREGATOR,
    abi: [{ "inputs": [], "name": "owner", "outputs": [{ "type": "address" }], "stateMutability": "view", "type": "function" }],
    functionName: 'owner'
});

console.log('Aggregator Owner:', owner);
console.log('Your Wallet:     0x645A3D9208523bbFEE980f7269ac72C61Dd3b552');
console.log('Match:', owner.toLowerCase() === '0x645A3D9208523bbFEE980f7269ac72C61Dd3b552'.toLowerCase());
