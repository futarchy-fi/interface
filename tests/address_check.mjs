
import { createPublicClient, http } from 'viem';
import { gnosis } from 'viem/chains';

const ADDR = "0x3D076d5d12341226527241f8a489D4A8863B73e5";

const client = createPublicClient({
    chain: gnosis,
    transport: http('https://rpc.gnosischain.com')
});

async function main() {
    console.log(`Checking ${ADDR}...`);
    try {
        const code = await client.getBytecode({ address: ADDR });
        console.log(`Code exists: ${!!code && code !== '0x'}`);
        console.log(`Length: ${code ? code.length : 0}`);
    } catch (e) {
        console.error("Error:", e.message);
    }
}

main();
