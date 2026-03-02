
import { createPublicClient, http } from 'viem';
import { gnosis } from 'viem/chains';
import { FutarchyCompleteCartridge } from '../src/cartridges/FutarchyCompleteCartridge.js';

async function main() {
    const publicClient = createPublicClient({
        chain: gnosis,
        transport: http('https://rpc.gnosischain.com')
    });

    const cartridge = new FutarchyCompleteCartridge();
    const PROPOSAL_ADDR = "0x3C109eC3c7eB7dA835Dd3B64F575EFAE7aBfDf4E"; // Metadata

    console.log(`Running getProposalDetails for ${PROPOSAL_ADDR}...`);

    const generator = cartridge.getProposalDetails({ proposalAddress: PROPOSAL_ADDR }, { publicClient });

    try {
        for await (const update of generator) {
            console.log(`[STATUS] ${update.status}: ${update.message}`);
            if (update.data) {
                // console.log("[DATA]", JSON.stringify(update.data, null, 2));
            }
            if (update.status === 'success') {
                console.log("FINAL DATA:", JSON.stringify(update.data, null, 2));
            }
            if (update.status === 'error') {
                console.error("ERROR:", update.message);
            }
        }
    } catch (e) {
        console.error("CRITICAL ERROR:", e);
    }
}

main();
