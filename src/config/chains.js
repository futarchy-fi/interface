/**
 * Per-chain configuration (single source of truth for chain-specific
 * addresses, RPCs and AMM flavour).
 *
 * Plain data + helpers only: no viem/wagmi imports, so this module can be
 * loaded from node scripts and tests as well as from the app.
 *
 * amm: 'uniswap' => Uniswap V3 pools (slot0/observe, QuoterV2, Universal Router)
 *      'algebra' => Algebra/Swapr pools (globalState/getTimepoints, Swapr router)
 */

export const ETHEREUM_CHAIN_ID = 1;
export const GNOSIS_CHAIN_ID = 100;
export const ROBINHOOD_CHAIN_ID = 4663;

export const CHAINS = {
    [ETHEREUM_CHAIN_ID]: {
        id: ETHEREUM_CHAIN_ID,
        name: 'Ethereum Mainnet',
        shortName: 'Ethereum',
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: [
            'https://ethereum-rpc.publicnode.com',
            'https://eth.llamarpc.com',
            'https://eth-mainnet.public.blastapi.io',
            'https://1rpc.io/eth',
        ],
        explorer: 'https://etherscan.io',
        explorerName: 'Etherscan',
        amm: 'uniswap',
        uniswapAppChain: 'ethereum',
        defaultCurrencySymbol: 'USDS',
        uniswap: {
            factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
            quoterV2: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
            universalRouter: '0x66a9893cc07d91d95644aedd05d03f95e1dba8af',
            permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
            nfpm: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
            swapRouter02: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
        },
        futarchy: {
            factory: '0xf9369c0F7a84CAC3b7Ef78c837cF7313309D3678',
            router: '0xAc9Bf8EbA6Bd31f8E8c76f8E8B2AAd0BD93f98Dc',
            conditionalTokens: '0xC59b0e4De5F1248C1140964E0fF287B192407E0C',
            wrapped1155Factory: '0xD194319D1804C1051DD21Ba1Dc931cA72410B79f',
        },
    },
    [GNOSIS_CHAIN_ID]: {
        id: GNOSIS_CHAIN_ID,
        name: 'Gnosis Chain',
        shortName: 'Gnosis',
        nativeCurrency: { name: 'xDAI', symbol: 'xDAI', decimals: 18 },
        rpcUrls: [
            'https://rpc.gnosischain.com',
            'https://gnosis-rpc.publicnode.com',
            'https://1rpc.io/gnosis',
            'https://rpc.ankr.com/gnosis',
        ],
        explorer: 'https://gnosisscan.io',
        explorerName: 'GnosisScan',
        amm: 'algebra',
        defaultCurrencySymbol: 'sDAI',
        uniswap: null,
        futarchy: {
            factory: '0xa6cB18FCDC17a2B44E5cAd2d80a6D5942d30a345',
            router: '0x7495a583ba85875d59407781b4958ED6e0E1228f',
            conditionalTokens: '0xCeAfDD6bc0bEF976fdCd1112955828E00543c0Ce',
            wrapped1155Factory: '0xc14f5d2B9d6945EF1BA93f8dB20294b90FA5b5b1',
        },
    },
    [ROBINHOOD_CHAIN_ID]: {
        id: ROBINHOOD_CHAIN_ID,
        name: 'Robinhood Chain',
        shortName: 'Robinhood',
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: [
            'https://rpc.mainnet.chain.robinhood.com',
            'https://robinhood-rpc.publicnode.com',
        ],
        explorer: 'https://robinhoodchain.blockscout.com',
        explorerName: 'Blockscout',
        amm: 'uniswap',
        // Chain slug for app.uniswap.org deep links (unverified for Robinhood Chain)
        uniswapAppChain: 'robinhood',
        defaultCurrencySymbol: 'USDG',
        // Uniswap V3 on Robinhood Chain is NOT at the canonical addresses.
        uniswap: {
            factory: '0x1f7d7550B1b028f7571E69A784071F0205FD2EfA',
            quoterV2: '0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7',
            universalRouter: '0x8876789976decbfcbbbe364623c63652db8c0904',
            permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
            nfpm: '0x73991a25c818bf1f1128deaab1492d45638de0d3',
            swapRouter02: '0xcaf681a66d020601342297493863e78c959e5cb2',
        },
        futarchy: {
            factory: '0x9b93fdcc9380a7e3df4978d856eaca4f7ee36fa2',
            router: '0x7834bb7f4724393043701b2a944feae0496e00ad',
            conditionalTokens: '0x3aee58842a1d76c50f36eb5a34e79ef958d082c7',
            wrapped1155Factory: '0x9d0bb3418b1834e40bd106c0dbb9318cdc847468',
            realityEth: '0x13279f59e694369e1d591e95b08a3107b8520ed3',
        },
    },
};

/** Chain IDs that the app can serve markets on. */
export const SUPPORTED_CHAIN_IDS = Object.keys(CHAINS).map(Number);

function toChainId(chainId) {
    if (typeof chainId === 'bigint') return Number(chainId);
    if (typeof chainId === 'string') return parseInt(chainId, 10);
    return chainId;
}

export function getChainInfo(chainId) {
    return CHAINS[toChainId(chainId)] || null;
}

export function isSupportedChain(chainId) {
    return !!getChainInfo(chainId);
}

/** True when the chain's futarchy pools are Uniswap V3 (Ethereum, Robinhood Chain). */
export function isUniswapChain(chainId) {
    return getChainInfo(chainId)?.amm === 'uniswap';
}

export function getChainRpcUrls(chainId) {
    return getChainInfo(chainId)?.rpcUrls || [];
}

export function getChainRpcUrl(chainId) {
    return getChainRpcUrls(chainId)[0] || null;
}

export function getUniswapAddresses(chainId) {
    return getChainInfo(chainId)?.uniswap || null;
}

export function getFutarchyAddresses(chainId) {
    return getChainInfo(chainId)?.futarchy || null;
}

export function getFutarchyRouterAddress(chainId, fallback = null) {
    return getChainInfo(chainId)?.futarchy?.router || fallback;
}

/**
 * app.uniswap.org swap deep link for a Uniswap chain. Ethereum keeps the
 * historical URL (no chain param); other chains append their slug.
 */
export function getUniswapSwapUrl(chainId, inputToken, outputToken) {
    const base = `https://app.uniswap.org/swap?inputCurrency=${inputToken}&outputCurrency=${outputToken}`;
    const slug = getChainInfo(chainId)?.uniswapAppChain;
    return toChainId(chainId) === ETHEREUM_CHAIN_ID || !slug ? base : `${base}&chain=${slug}`;
}

export function getChainName(chainId) {
    return getChainInfo(chainId)?.name || `Chain ${chainId}`;
}

export function getExplorerUrl(chainId, fallback = 'https://gnosisscan.io') {
    return getChainInfo(chainId)?.explorer || fallback;
}

export function getExplorerTxUrl(chainId, txHash) {
    return `${getExplorerUrl(chainId)}/tx/${txHash}`;
}

export function getExplorerAddressUrl(chainId, address) {
    return `${getExplorerUrl(chainId)}/address/${address}`;
}

export function getNativeSymbol(chainId, fallback = 'xDAI') {
    return getChainInfo(chainId)?.nativeCurrency?.symbol || fallback;
}

/** Currency-token symbol to show when token metadata is missing. */
export function getDefaultCurrencySymbol(chainId, fallback = 'sDAI') {
    return getChainInfo(chainId)?.defaultCurrencySymbol || fallback;
}

/**
 * viem/wagmi chain definition object for Robinhood Chain (plain object; pass
 * to viem's defineChain or use directly — defineChain is an identity helper).
 */
export const robinhoodChain = {
    id: ROBINHOOD_CHAIN_ID,
    name: 'Robinhood Chain',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: {
        default: { http: CHAINS[ROBINHOOD_CHAIN_ID].rpcUrls },
        public: { http: CHAINS[ROBINHOOD_CHAIN_ID].rpcUrls },
    },
    blockExplorers: {
        default: { name: 'Blockscout', url: CHAINS[ROBINHOOD_CHAIN_ID].explorer },
    },
    contracts: {
        multicall3: { address: '0xcA11bde05977b3631167028862bE2a173976CA11' },
    },
    testnet: false,
    // RainbowKit network icon
    iconUrl: '/assets/robinhood-chain.png',
    iconBackground: '#CCFF00',
};
