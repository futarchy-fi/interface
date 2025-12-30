
import { createPublicClient, http, decodeFunctionData, getAddress, Hex, erc20Abi } from 'viem';
import { mainnet } from 'viem/chains';
import { MethodInference } from './types';

// TODO: Make this configurable
const CLIENT_CHAIN = mainnet;

const COMMON_ABIS = [
    erc20Abi
    // Add other common ABIs here (e.g. Router, Factory)
];

export async function inferMethodName({
    rpcUrl = 'https://rpc.ankr.com/gnosis',
    to,
    data
}: { rpcUrl?: string; to: string; data: Hex }): Promise<MethodInference> {
    if (!data || data === '0x') return { ok: false, reason: 'Native transfer (no calldata).' };

    const selector = (data.slice(0, 10) as Hex);

    // 1. Try Common ABIs (Fastest)
    for (const abi of COMMON_ABIS) {
        try {
            const { functionName, args } = decodeFunctionData({ abi, data });
            return { ok: true, functionName, args: args as unknown as unknown[], abiSource: 'ERC20' }; // or generic
        } catch (_) {
            // Check next ABI
        }
    }

    // 2. Try Explorer/Proxy Logic (Mocked for now)
    // In a real implementation, you would fetch the ABI from Etherscan/Blockscout here.
    // const abi = await fetchAbiFromExplorer(to);

    // 3. Fallback: 4-byte selector (Static map or API)
    // For this prototype, we'll return the selector
    return {
        ok: true,
        selector,
        candidates: [],
        abiSource: '4byte'
    };
}
