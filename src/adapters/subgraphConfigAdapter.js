/**
 * Subgraph Data Adapter
 * 
 * Fetches proposal data from The Graph subgraph and transforms it 
 * to match the Supabase market_event format for seamless consumption.
 */

import { SUBGRAPH_ENDPOINTS } from '../config/subgraphEndpoints';

// Re-export for backward compatibility
export { SUBGRAPH_ENDPOINTS };

// Chain-specific contract addresses
const CHAIN_CONFIG = {
    1: {
        factoryAddress: '0xf9369c0F7a84CAC3b7Ef78c837cF7313309D3678',
        routerAddress: '0xAc9Bf8EbA6Bd31f8E8c76f8E8B2AAd0BD93f98Dc',
        futarchyAdapter: '0xAc9Bf8EbA6Bd31f8E8c76f8E8B2AAd0BD93f98Dc',
        conditionalTokens: '0xC59b0e4De5F1248C1140964E0fF287B192407E0C',
        wrapperService: '0x...' // TODO: Add mainnet wrapper
    },
    100: {
        factoryAddress: '0xa6cB18FCDC17a2B44E5cAd2d80a6D5942d30a345',
        routerAddress: '0x7495a583ba85875d59407781b4958ED6e0E1228f',
        futarchyAdapter: '0x7495a583ba85875d59407781b4958ED6e0E1228f',
        conditionalTokens: '0xCeAfDD6bc0bEF976fdCd1112955828E00543c0Ce',
        wrapperService: '0xc14f5d2B9d6945EF1BA93f8dB20294b90FA5b5b1'
    }
};

/**
 * Strip a "<chainId>-" prefix from a Checkpoint ID. Defensive — the
 * api.futarchy.fi passthrough already strips these from response IDs,
 * but this is harmless if the prefix isn't present.
 */
function stripChainPrefix(id) {
    if (typeof id !== 'string') return id;
    const m = id.match(/^\d+-(.+)$/);
    return m ? m[1] : id;
}

/**
 * Fetch proposal data from the candles indexer.
 *
 * Checkpoint exposes `companyToken` / `currencyToken` / `outcomeTokens`
 * as scalar string addresses (not nested objects), so we issue 3 flat
 * queries and assemble a Graph-Node-shape object that matches what
 * `transformSubgraphToSupabaseFormat` expects.
 *
 * @param {string} proposalAddress - The proposal contract address (plain)
 * @param {number} chainId - The chain ID (1 or 100)
 * @returns {Promise<Object|null>} - Assembled proposal data
 */
export async function fetchProposalFromSubgraph(proposalAddress, chainId) {
    const endpoint = SUBGRAPH_ENDPOINTS[chainId];
    if (!endpoint) {
        console.error(`[SubgraphAdapter] No endpoint for chain ${chainId}`);
        return null;
    }

    const proposalId = proposalAddress.toLowerCase();

    // Single query batches three top-level lookups against the Checkpoint
    // indexer. The api.futarchy.fi /candles/graphql passthrough handles
    // chain-prefix translation in both directions.
    const query = `{
        proposal(id: "${proposalId}") {
            id
            marketName
            companyToken
            currencyToken
        }
        whitelistedtokens(where: { proposal: "${proposalId}" }, first: 100) {
            id
            address
            symbol
            decimals
            role
        }
        pools(where: { proposal: "${proposalId}" }, first: 100) {
            id
            name
            type
            outcomeSide
            price
        }
    }`;

    try {
        console.log(`[SubgraphAdapter] Fetching from chain ${chainId}: ${proposalId}`);

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query }),
        });

        const result = await response.json();
        if (result.errors) {
            console.error('[SubgraphAdapter] GraphQL errors:', result.errors);
            return null;
        }

        const proposal = result.data?.proposal;
        if (!proposal) return null;

        const wls = result.data?.whitelistedtokens || [];
        const pools = result.data?.pools || [];

        // Derive the underlying COMPANY/CURRENCY symbol by stripping the
        // YES_/NO_ prefix from the corresponding outcome-token symbol.
        // role values: "YES_COMPANY" | "NO_COMPANY" | "YES_CURRENCY" | "NO_CURRENCY"
        const findRole = role => wls.find(t => t.role === role);
        const yesCompany = findRole('YES_COMPANY');
        const noCompany = findRole('NO_COMPANY');
        const yesCurrency = findRole('YES_CURRENCY');
        const noCurrency = findRole('NO_CURRENCY');

        const stripPrefix = (sym) => {
            if (!sym) return null;
            return sym.replace(/^(YES|NO)_/i, '') || null;
        };

        const companySymbol  = stripPrefix(yesCompany?.symbol)  || stripPrefix(noCompany?.symbol);
        const currencySymbol = stripPrefix(yesCurrency?.symbol) || stripPrefix(noCurrency?.symbol);

        const companyAddr  = stripChainPrefix(proposal.companyToken);
        const currencyAddr = stripChainPrefix(proposal.currencyToken);

        // Default decimals to 18 (true for all current tokens; if a future token
        // differs we'll add an on-chain fallback). Outcome tokens carry their own.
        const decimalsDefault = yesCompany?.decimals ?? 18;

        // Assemble a Graph-Node-style object so transformSubgraphToSupabaseFormat
        // doesn't need to know about the schema difference.
        const outcomeTokens = wls.map(t => ({
            id: stripChainPrefix(t.id) || t.address,
            symbol: t.symbol,
            decimals: t.decimals,
        }));

        return {
            id: proposal.id,
            marketName: proposal.marketName,
            companyToken: companySymbol
                ? { id: companyAddr, symbol: companySymbol, decimals: decimalsDefault }
                : null,
            currencyToken: currencySymbol
                ? { id: currencyAddr, symbol: currencySymbol, decimals: decimalsDefault }
                : null,
            outcomeTokens,
            pools: pools.map(p => ({
                id: stripChainPrefix(p.id),
                name: p.name,
                type: p.type,
                outcomeSide: p.outcomeSide,
                price: p.price,
            })),
        };
    } catch (error) {
        console.error('[SubgraphAdapter] Fetch error:', error);
        return null;
    }
}

/**
 * Transform subgraph data to Supabase market_event format
 * @param {Object} subgraphData - Raw data from subgraph
 * @param {string} proposalAddress - The original proposal address (for casing)
 * @param {number} chainId - The chain ID
 * @returns {Object} - Data in Supabase market_event format
 */
export function transformSubgraphToSupabaseFormat(subgraphData, proposalAddress, chainId) {
    if (!subgraphData) {
        return null;
    }

    const config = CHAIN_CONFIG[chainId];
    const { marketName, companyToken, currencyToken, outcomeTokens, pools } = subgraphData;

    // Find outcome tokens by matching with base token symbols
    // Handle various naming conventions (YES_GNO, YES_sDAI, etc.)
    const findToken = (prefix, baseSymbol) => {
        if (!outcomeTokens || !baseSymbol) return null;
        return outcomeTokens.find(t =>
            t.symbol === `${prefix}_${baseSymbol}` ||
            t.symbol.toLowerCase() === `${prefix.toLowerCase()}_${baseSymbol.toLowerCase()}`
        );
    };

    const yesCompany = findToken('YES', companyToken?.symbol);
    const noCompany = findToken('NO', companyToken?.symbol);
    const yesCurrency = findToken('YES', currencyToken?.symbol);
    const noCurrency = findToken('NO', currencyToken?.symbol);

    // Find pools by type and outcome side
    const findPool = (type, side) => {
        if (!pools) return null;
        return pools.find(p =>
            p.type === type &&
            p.outcomeSide?.toUpperCase() === side.toUpperCase()
        );
    };

    const conditionalYes = findPool('CONDITIONAL', 'YES');
    const conditionalNo = findPool('CONDITIONAL', 'NO');
    const predictionYes = findPool('PREDICTION', 'YES');
    const predictionNo = findPool('PREDICTION', 'NO');
    const evYes = findPool('EXPECTED_VALUE', 'YES');
    const evNo = findPool('EXPECTED_VALUE', 'NO');

    // Build the Supabase-compatible format
    return {
        id: proposalAddress, // Keep original casing
        title: marketName,
        type: 'proposal',
        proposal_markdown: marketName,

        // This is the key: metadata in exact Supabase format
        metadata: {
            chain: chainId,
            title: marketName,
            marketName: marketName,

            // Contract infos (for router, conditional tokens, etc.)
            contractInfos: {
                conditionalTokens: config.conditionalTokens,
                wrapperService: config.wrapperService,
                futarchy: {
                    router: config.routerAddress
                },
                sushiswap: {
                    routerV2: '0xf2614A233c7C3e7f08b1F887Ba133a13f1eb2c55',
                    routerV3: '0x592abc3734cd0d458e6e44a2db2992a3d00283a4',
                    factory: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4'
                }
            },

            // Token configurations
            companyTokens: {
                base: companyToken ? {
                    tokenName: companyToken.symbol,
                    tokenSymbol: companyToken.symbol,
                    wrappedCollateralTokenAddress: companyToken.id
                } : null,
                yes: yesCompany ? {
                    tokenName: yesCompany.symbol,
                    tokenSymbol: yesCompany.symbol,
                    wrappedCollateralTokenAddress: yesCompany.id
                } : null,
                no: noCompany ? {
                    tokenName: noCompany.symbol,
                    tokenSymbol: noCompany.symbol,
                    wrappedCollateralTokenAddress: noCompany.id
                } : null
            },

            currencyTokens: {
                base: currencyToken ? {
                    tokenName: currencyToken.symbol,
                    tokenSymbol: currencyToken.symbol,
                    wrappedCollateralTokenAddress: currencyToken.id
                } : null,
                yes: yesCurrency ? {
                    tokenName: yesCurrency.symbol,
                    tokenSymbol: yesCurrency.symbol,
                    wrappedCollateralTokenAddress: yesCurrency.id
                } : null,
                no: noCurrency ? {
                    tokenName: noCurrency.symbol,
                    tokenSymbol: noCurrency.symbol,
                    wrappedCollateralTokenAddress: noCurrency.id
                } : null
            },

            // Pool configurations
            conditional_pools: {
                yes: conditionalYes ? {
                    address: conditionalYes.id,
                    tokenCompanySlot: 1 // Default, may need to be computed
                } : null,
                no: conditionalNo ? {
                    address: conditionalNo.id,
                    tokenCompanySlot: 0
                } : null
            },

            prediction_pools: {
                yes: predictionYes ? {
                    address: predictionYes.id,
                    tokenBaseSlot: 0
                } : null,
                no: predictionNo ? {
                    address: predictionNo.id,
                    tokenBaseSlot: 0
                } : null
            },

            expected_value_pools: {
                yes: evYes ? { address: evYes.id } : null,
                no: evNo ? { address: evNo.id } : null
            },

            // Contract addresses
            factoryAddress: config.factoryAddress,
            routerAddress: config.routerAddress,
            futarchyAdapter: config.futarchyAdapter,
            proposalAddress: proposalAddress,

            // Source indicator
            _source: 'subgraph',
            _chainId: chainId
        },

        // Standard fields
        event_status: 'open',
        visibility: 'public',
        resolution_status: null,  // Not available from market subgraph; useContractConfig falls back to _registryMetadata
        resolution_outcome: null,
        expiration_time: null
    };
}

/**
 * Parse the useContractSource query parameter
 * @param {string} sourceParam - e.g., "subgraph-1" or "subgraph-100"
 * @returns {{ type: 'supabase' | 'subgraph', chainId?: number }}
 */
export function parseContractSource(sourceParam) {
    if (!sourceParam) {
        return { type: 'supabase' };
    }

    const match = sourceParam.match(/^subgraph-(\d+)$/);
    if (match) {
        const chainId = parseInt(match[1], 10);
        if (SUBGRAPH_ENDPOINTS[chainId]) {
            return { type: 'subgraph', chainId };
        }
    }

    return { type: 'supabase' };
}

/**
 * Main function: Fetch market event data from either Supabase or Subgraph
 * based on the useContractSource parameter
 * 
 * @param {string} proposalId - The proposal address
 * @param {string|null} sourceParam - The useContractSource query param value
 * @returns {Promise<Object>} - Market event data in Supabase format
 */
export async function fetchMarketEventData(proposalId, sourceParam = null) {
    const source = parseContractSource(sourceParam);

    console.log(`[SubgraphAdapter] Source: ${source.type}, Chain: ${source.chainId || 'N/A'}`);

    if (source.type === 'subgraph') {
        const subgraphData = await fetchProposalFromSubgraph(proposalId, source.chainId);

        if (subgraphData) {
            return transformSubgraphToSupabaseFormat(subgraphData, proposalId, source.chainId);
        } else {
            console.warn(`[SubgraphAdapter] Proposal not found in subgraph, falling back to null`);
            return null;
        }
    }

    // For 'supabase' type, return null to indicate Supabase should be used
    return null;
}

export default {
    fetchProposalFromSubgraph,
    transformSubgraphToSupabaseFormat,
    parseContractSource,
    fetchMarketEventData,
    SUBGRAPH_ENDPOINTS
};
