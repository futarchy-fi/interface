
import { createPublicClient, http, getAddress } from 'viem';
import { gnosis } from 'viem/chains';

const PROPOSAL_ID = "0x3D076d5d12341226527241f8a489D4A8863B73e5";

const client = createPublicClient({
    chain: gnosis,
    transport: http('https://rpc.ankr.com/gnosis')
});

async function main() {
    console.log(`Checking bytecode for ${PROPOSAL_ID}...`);
    const code = await client.getBytecode({ address: getAddress(PROPOSAL_ID) });
    console.log(`Bytecode length: ${code ? code.length : 0}`);
}

main();
