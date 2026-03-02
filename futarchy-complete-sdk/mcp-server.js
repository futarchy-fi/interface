#!/usr/bin/env node
/**
 * Futarchy Complete SDK - MCP Server
 * 
 * Model Context Protocol server exposing Futarchy v2 operations
 * for AI assistants to interact with prediction markets.
 * 
 * Usage:
 *   node mcp-server.js
 * 
 * Environment Variables:
 *   PRIVATE_KEY - Required for write operations (optional for read-only)
 *   RPC_URL     - Custom RPC URL (optional, defaults to public endpoints)
 */

// =============================================================================
// CRITICAL: Redirect all console output to stderr
// MCP protocol requires pure JSON on stdout - any extra output breaks it
// =============================================================================
const originalConsoleLog = console.log;
const originalConsoleInfo = console.info;
const originalConsoleWarn = console.warn;
console.log = (...args) => console.error('[LOG]', ...args);
console.info = (...args) => console.error('[INFO]', ...args);
console.warn = (...args) => console.error('[WARN]', ...args);

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    ListResourcesRequestSchema,
    ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

import dotenv from 'dotenv';
dotenv.config({ debug: false });

// Suppress any remaining stdout pollution from dependencies
process.stdout.write = (function (originalWrite) {
    return function (chunk, encoding, callback) {
        // Only allow JSON-RPC messages through (they start with "Content-Length" for MCP or are JSON)
        const str = chunk?.toString?.() || '';
        if (str.startsWith('{') || str.startsWith('Content-Length')) {
            return originalWrite.apply(process.stdout, arguments);
        }
        // Redirect everything else to stderr
        return process.stderr.write(chunk, encoding, callback);
    };
})(process.stdout.write.bind(process.stdout));

import { DataLayer } from './src/core/DataLayer.js';
import { ViemExecutor } from './src/executors/ViemExecutor.js';
import { FutarchyCompleteCartridge } from './src/cartridges/FutarchyCompleteCartridge.js';
import { fetchCandles, fetchTrades, fetchPools, fetchSpotCandles, gapFillCandles } from './src/core/ChartDataClient.js';
import { CONTRACT_ADDRESSES, CHAIN_CONFIG } from './src/config/contracts.js';
import { CANDLE_SUBGRAPHS, COMPLETE_SUBGRAPH, getCandleSubgraph, getCompleteSubgraph } from './src/config/subgraphEndpoints.js';

// =============================================================================
// SETUP: DataLayer and Executor
// =============================================================================

const dataLayer = new DataLayer();
const executor = new ViemExecutor();
const cartridge = new FutarchyCompleteCartridge();

executor.registerCartridge(cartridge);
dataLayer.registerExecutor(executor);

// Helper to execute operations and collect results
async function executeOperation(operationName, args = {}) {
    const results = [];
    try {
        for await (const update of dataLayer.execute(operationName, args)) {
            results.push(update);
            if (update.status === 'success' || update.status === 'error') {
                return update;
            }
        }
        return results[results.length - 1] || { status: 'error', message: 'No response' };
    } catch (e) {
        return { status: 'error', message: e.message };
    }
}

// =============================================================================
// MCP SERVER: Tool Definitions
// =============================================================================

const TOOLS = [
    // =========================================================================
    // READ OPERATIONS
    // =========================================================================
    {
        name: 'get_organizations',
        description: 'List all organizations registered under an aggregator contract. Returns org names, addresses, and metadata. Use the default aggregator (0xC5eB...4Fc1) to query the main Futarchy Finance registry.',
        inputSchema: {
            type: 'object',
            properties: {
                aggregatorAddress: {
                    type: 'string',
                    description: 'Aggregator contract address. Default: 0xC5eB43D53e2FE5FddE5faf400CC4167e5b5d4Fc1'
                }
            }
        }
    },
    {
        name: 'get_proposals',
        description: 'List all proposals (prediction markets) belonging to an organization. Each proposal has a metadata contract and trading contract address.',
        inputSchema: {
            type: 'object',
            properties: {
                organizationAddress: {
                    type: 'string',
                    description: 'Organization contract address (e.g., 0x818FdF727aA4672c80bBFd47eE13975080AC40E5 for Gnosis)'
                }
            },
            required: ['organizationAddress']
        }
    },
    {
        name: 'get_proposal_details',
        description: 'Get complete details for a proposal including: base tokens (company/currency), outcome tokens (YES/NO), all 6 pool addresses, chain info, and metadata. Essential for understanding market structure.',
        inputSchema: {
            type: 'object',
            properties: {
                proposalAddress: {
                    type: 'string',
                    description: 'Trading contract address (e.g., 0x45e1064348fd8a407d6d1f59fc64b05f633b28fc)'
                }
            },
            required: ['proposalAddress']
        }
    },
    {
        name: 'get_organization_metadata',
        description: 'Get organization details with all metadata entries (logo, banner, colors, etc.). Useful for branding and display information.',
        inputSchema: {
            type: 'object',
            properties: {
                organizationAddress: {
                    type: 'string',
                    description: 'Organization contract address'
                }
            },
            required: ['organizationAddress']
        }
    },
    {
        name: 'get_proposal_metadata',
        description: 'Get proposal metadata entries including chain, coingecko_ticker, closeTimestamp, and custom JSON fields.',
        inputSchema: {
            type: 'object',
            properties: {
                proposalAddress: {
                    type: 'string',
                    description: 'Proposal metadata contract address'
                }
            },
            required: ['proposalAddress']
        }
    },
    {
        name: 'get_aggregator_metadata',
        description: 'Get aggregator details including name, description, and metadata entries.',
        inputSchema: {
            type: 'object',
            properties: {
                aggregatorAddress: {
                    type: 'string',
                    description: 'Aggregator contract address. Default: 0xC5eB43D53e2FE5FddE5faf400CC4167e5b5d4Fc1'
                }
            }
        }
    },
    {
        name: 'get_linkable_proposals',
        description: 'Search recent proposals from the Market subgraph that can be linked to organizations. Returns up to 50 recent proposals with trading data.',
        inputSchema: {
            type: 'object',
            properties: {
                chainId: {
                    type: 'number',
                    description: 'Chain ID: 100 for Gnosis, 1 for Ethereum. Default: 100'
                },
                limit: {
                    type: 'number',
                    description: 'Max results to return. Default: 50'
                }
            }
        }
    },
    {
        name: 'get_organizations_by_owner',
        description: 'Find all organizations owned by a specific wallet address.',
        inputSchema: {
            type: 'object',
            properties: {
                ownerAddress: {
                    type: 'string',
                    description: 'Wallet address of the owner'
                }
            },
            required: ['ownerAddress']
        }
    },
    {
        name: 'verify_token',
        description: 'Verify an ERC20 token address by fetching its symbol, name, and decimals.',
        inputSchema: {
            type: 'object',
            properties: {
                tokenAddress: {
                    type: 'string',
                    description: 'ERC20 token address to verify'
                },
                chainId: {
                    type: 'number',
                    description: 'Chain ID: 100 for Gnosis, 1 for Ethereum. Default: 100'
                }
            },
            required: ['tokenAddress']
        }
    },
    {
        name: 'get_pool_prices',
        description: 'Get current YES/NO pool prices for a proposal. Returns probability estimates based on conditional pool prices.',
        inputSchema: {
            type: 'object',
            properties: {
                proposalAddress: {
                    type: 'string',
                    description: 'Trading contract address'
                },
                chainId: {
                    type: 'number',
                    description: 'Chain ID: 100 or 1. Default: 100'
                }
            },
            required: ['proposalAddress']
        }
    },
    {
        name: 'export_candles',
        description: 'Export OHLCV candle data for YES/NO pools. Supports gap-filling and optional SPOT price overlay from GeckoTerminal.',
        inputSchema: {
            type: 'object',
            properties: {
                proposalAddress: {
                    type: 'string',
                    description: 'Trading contract address'
                },
                chainId: {
                    type: 'number',
                    description: 'Chain ID: 100 or 1. Default: 100'
                },
                limit: {
                    type: 'number',
                    description: 'Max candles to fetch. Default: 500'
                },
                startTime: {
                    type: 'number',
                    description: 'Unix timestamp to start from. Default: all time'
                },
                gapFill: {
                    type: 'boolean',
                    description: 'Fill missing candles with previous close. Default: true'
                }
            },
            required: ['proposalAddress']
        }
    },
    {
        name: 'export_trades',
        description: 'Export swap/trade history for proposal pools. Returns individual trades with amounts, prices, and timestamps.',
        inputSchema: {
            type: 'object',
            properties: {
                proposalAddress: {
                    type: 'string',
                    description: 'Trading contract address'
                },
                chainId: {
                    type: 'number',
                    description: 'Chain ID: 100 or 1. Default: 100'
                },
                limit: {
                    type: 'number',
                    description: 'Max trades to fetch. Default: 100'
                },
                startTime: {
                    type: 'number',
                    description: 'Unix timestamp to start from. Default: all time'
                }
            },
            required: ['proposalAddress']
        }
    },

    // =========================================================================
    // WRITE OPERATIONS (require PRIVATE_KEY)
    // =========================================================================
    {
        name: 'add_proposal_metadata',
        description: '[WRITE] Create a ProposalMetadata contract linking a trading proposal to an organization. Requires PRIVATE_KEY env var.',
        inputSchema: {
            type: 'object',
            properties: {
                organizationAddress: {
                    type: 'string',
                    description: 'Organization to add proposal to'
                },
                proposalAddress: {
                    type: 'string',
                    description: 'Trading contract address to link'
                },
                displayNameQuestion: {
                    type: 'string',
                    description: 'Full question text (e.g., "What will the impact on GNO price be if GIP-145 is approved?")'
                },
                displayNameEvent: {
                    type: 'string',
                    description: 'Short event name (e.g., "GIP-145")'
                },
                description: {
                    type: 'string',
                    description: 'Optional description'
                },
                metadata: {
                    type: 'string',
                    description: 'JSON metadata string (e.g., {"chain":"100","closeTimestamp":"1735689600"})'
                },
                metadataURI: {
                    type: 'string',
                    description: 'Optional IPFS or URL for extended metadata'
                }
            },
            required: ['organizationAddress', 'proposalAddress', 'displayNameQuestion', 'displayNameEvent']
        }
    },
    {
        name: 'create_organization',
        description: '[WRITE] Create a new organization under an aggregator. Requires PRIVATE_KEY env var.',
        inputSchema: {
            type: 'object',
            properties: {
                aggregatorAddress: {
                    type: 'string',
                    description: 'Aggregator to add org to. Default: 0xC5eB43D53e2FE5FddE5faf400CC4167e5b5d4Fc1'
                },
                companyName: {
                    type: 'string',
                    description: 'Organization name'
                },
                description: {
                    type: 'string',
                    description: 'Organization description'
                },
                metadata: {
                    type: 'string',
                    description: 'JSON metadata string'
                },
                metadataURI: {
                    type: 'string',
                    description: 'IPFS or URL for extended metadata'
                }
            },
            required: ['companyName']
        }
    },
    {
        name: 'create_actual_proposal',
        description: '[WRITE] Create a new conditional market via the Proposal Factory. Creates YES/NO conditional token pools on Algebra/Uniswap. The marketName should be a YES/NO question for the Reality.eth oracle (e.g., "Will CIP-83: Renewing Team Grant be approved?"). Requires PRIVATE_KEY.',
        inputSchema: {
            type: 'object',
            properties: {
                chainId: {
                    type: 'number',
                    description: 'Chain ID: 100 for Gnosis, 1 for Ethereum'
                },
                marketName: {
                    type: 'string',
                    description: 'Reality.eth oracle question - must be a YES/NO question (e.g., "Will CIP-83: Renewing Team Grant Allocation be approved?", "Will GIP-150 pass?")'
                },
                companyTokenAddress: {
                    type: 'string',
                    description: 'Company token address (e.g., GNO on Gnosis, COW on Ethereum)'
                },
                currencyTokenAddress: {
                    type: 'string',
                    description: 'Currency token address (e.g., sDAI on Gnosis, WETH on Ethereum)'
                },
                category: {
                    type: 'string',
                    description: 'Category: crypto, governance, defi, other'
                },
                language: {
                    type: 'string',
                    description: 'Language code: en, es, fr, de'
                },
                minBond: {
                    type: 'string',
                    description: 'Minimum bond in wei (Reality.eth). Default: 1 ETH'
                },
                openingTime: {
                    type: 'number',
                    description: 'Unix timestamp for market resolution (when the YES/NO question can be answered)'
                }
            },
            required: ['chainId', 'marketName', 'companyTokenAddress', 'currencyTokenAddress', 'openingTime']
        }
    },
    {
        name: 'remove_organization',
        description: '[WRITE] Remove an organization from an aggregator by index. Requires PRIVATE_KEY and owner/editor permissions.',
        inputSchema: {
            type: 'object',
            properties: {
                aggregatorAddress: {
                    type: 'string',
                    description: 'Aggregator contract address'
                },
                organizationIndex: {
                    type: 'number',
                    description: 'Index of organization to remove (0-based)'
                }
            },
            required: ['aggregatorAddress', 'organizationIndex']
        }
    },
    {
        name: 'remove_proposal',
        description: '[WRITE] Remove a proposal from an organization by index. Requires PRIVATE_KEY and owner/editor permissions.',
        inputSchema: {
            type: 'object',
            properties: {
                organizationAddress: {
                    type: 'string',
                    description: 'Organization contract address'
                },
                proposalIndex: {
                    type: 'number',
                    description: 'Index of proposal to remove (0-based)'
                }
            },
            required: ['organizationAddress', 'proposalIndex']
        }
    },
    {
        name: 'update_entity_metadata',
        description: '[WRITE] Update metadata JSON on an entity (aggregator, organization, or proposal). Uses smart merge to preserve existing keys.',
        inputSchema: {
            type: 'object',
            properties: {
                entityType: {
                    type: 'string',
                    description: 'Entity type: aggregator, organization, or proposal'
                },
                entityAddress: {
                    type: 'string',
                    description: 'Contract address of the entity'
                },
                key: {
                    type: 'string',
                    description: 'Metadata key to set/update'
                },
                value: {
                    type: 'string',
                    description: 'Value for the key'
                }
            },
            required: ['entityType', 'entityAddress', 'key', 'value']
        }
    },
    {
        name: 'batch_update_entity_metadata',
        description: '[WRITE] Batch update metadata on an entity (aggregator, organization, or proposal). Updates multiple keys in a SINGLE transaction. More efficient than calling update_entity_metadata multiple times.',
        inputSchema: {
            type: 'object',
            properties: {
                entityType: {
                    type: 'string',
                    description: 'Entity type: aggregator, organization, or proposal'
                },
                entityAddress: {
                    type: 'string',
                    description: 'Contract address of the entity'
                },
                updates: {
                    type: 'string',
                    description: 'JSON string with key-value pairs to update, e.g. {"chain":"1","logo":"https://...","website":"https://..."}'
                }
            },
            required: ['entityType', 'entityAddress', 'updates']
        }
    },
    {
        name: 'update_organization_info',
        description: '[WRITE] Update organization name and description.',
        inputSchema: {
            type: 'object',
            properties: {
                organizationAddress: {
                    type: 'string',
                    description: 'Organization contract address'
                },
                newName: {
                    type: 'string',
                    description: 'New organization name'
                },
                newDescription: {
                    type: 'string',
                    description: 'New description'
                }
            },
            required: ['organizationAddress', 'newName']
        }
    },
    {
        name: 'update_aggregator_info',
        description: '[WRITE] Update aggregator name and description.',
        inputSchema: {
            type: 'object',
            properties: {
                aggregatorAddress: {
                    type: 'string',
                    description: 'Aggregator contract address'
                },
                newName: {
                    type: 'string',
                    description: 'New aggregator name'
                },
                newDescription: {
                    type: 'string',
                    description: 'New description'
                }
            },
            required: ['aggregatorAddress', 'newName']
        }
    },
    {
        name: 'update_proposal_info',
        description: '[WRITE] Update proposal displayNameQuestion, displayNameEvent, and description.',
        inputSchema: {
            type: 'object',
            properties: {
                proposalMetadataAddress: {
                    type: 'string',
                    description: 'ProposalMetadata contract address'
                },
                displayNameQuestion: {
                    type: 'string',
                    description: 'New question text'
                },
                displayNameEvent: {
                    type: 'string',
                    description: 'New event name'
                },
                description: {
                    type: 'string',
                    description: 'New description'
                }
            },
            required: ['proposalMetadataAddress']
        }
    },
    {
        name: 'add_existing_metadata',
        description: '[WRITE] Add an existing ProposalMetadata contract to an organization (without creating a new one).',
        inputSchema: {
            type: 'object',
            properties: {
                organizationAddress: {
                    type: 'string',
                    description: 'Organization to add metadata to'
                },
                metadataAddress: {
                    type: 'string',
                    description: 'Existing ProposalMetadata contract address'
                }
            },
            required: ['organizationAddress', 'metadataAddress']
        }
    },
    {
        name: 'create_pool',
        description: '[WRITE] Create a missing pool for a proposal. Pools are created on Swapr/Algebra (Gnosis, chain 100) or Uniswap V3 (Ethereum, chain 1). Auto-fetches token addresses from the proposal. Requires PRIVATE_KEY.',
        inputSchema: {
            type: 'object',
            properties: {
                proposalAddress: {
                    type: 'string',
                    description: 'Trading contract address of the proposal'
                },
                poolType: {
                    type: 'string',
                    description: 'Pool type to create: CONDITIONAL_YES, CONDITIONAL_NO, PREDICTION_YES, PREDICTION_NO, EXPECTED_VALUE_YES, EXPECTED_VALUE_NO'
                },
                initialPrice: {
                    type: 'number',
                    description: 'Initial price for the pool (e.g., 120 for GNO spot price in sDAI). This is token1/token0.'
                },
                chainId: {
                    type: 'number',
                    description: 'Chain ID: 100 for Gnosis (Algebra/Swapr), 1 for Ethereum (Uniswap V3). Default: 100'
                },
                feeTier: {
                    type: 'number',
                    description: 'Fee tier for Uniswap V3 pools (ignored for Algebra). Default: 3000'
                }
            },
            required: ['proposalAddress', 'poolType', 'initialPrice']
        }
    }
];

// =============================================================================
// MCP SERVER: Resources (Static Configuration)
// =============================================================================

const RESOURCES = [
    {
        uri: 'futarchy://config/aggregator',
        name: 'Default Aggregator',
        description: 'Default Futarchy Finance aggregator contract address',
        mimeType: 'application/json'
    },
    {
        uri: 'futarchy://config/chains',
        name: 'Chain Configuration',
        description: 'Supported chains with RPC URLs, factories, and default tokens',
        mimeType: 'application/json'
    },
    {
        uri: 'futarchy://config/subgraphs',
        name: 'Subgraph Endpoints',
        description: 'GraphQL endpoints for market and registry data',
        mimeType: 'application/json'
    },
    {
        uri: 'futarchy://config/pool-types',
        name: 'Pool Types',
        description: 'Pool type definitions: CONDITIONAL, PREDICTION, EXPECTED_VALUE',
        mimeType: 'application/json'
    }
];

// =============================================================================
// MCP SERVER: Handler Implementation
// =============================================================================

async function handleToolCall(name, args) {
    const DEFAULT_AGGREGATOR = CONTRACT_ADDRESSES.DEFAULT_AGGREGATOR;

    switch (name) {
        // READ OPERATIONS
        case 'get_organizations': {
            const result = await executeOperation('futarchy.getOrganizations', {
                aggregatorAddress: args.aggregatorAddress || DEFAULT_AGGREGATOR
            });
            return result;
        }

        case 'get_proposals': {
            const result = await executeOperation('futarchy.getProposals', {
                organizationAddress: args.organizationAddress
            });
            return result;
        }

        case 'get_proposal_details': {
            const result = await executeOperation('futarchy.getProposalDetails', {
                proposalAddress: args.proposalAddress
            });
            return result;
        }

        case 'get_organization_metadata': {
            const result = await executeOperation('futarchy.getOrganizationMetadata', {
                organizationAddress: args.organizationAddress
            });
            return result;
        }

        case 'get_proposal_metadata': {
            const result = await executeOperation('futarchy.getProposalMetadata', {
                proposalAddress: args.proposalAddress
            });
            return result;
        }

        case 'get_aggregator_metadata': {
            const result = await executeOperation('futarchy.getAggregatorMetadata', {
                aggregatorAddress: args.aggregatorAddress || DEFAULT_AGGREGATOR
            });
            return result;
        }

        case 'get_linkable_proposals': {
            const result = await executeOperation('futarchy.getLinkableProposals', {
                chainId: args.chainId || 100,
                limit: args.limit || 50
            });
            return result;
        }

        case 'get_organizations_by_owner': {
            const result = await executeOperation('futarchy.getOrganizationsByOwner', {
                ownerAddress: args.ownerAddress
            });
            return result;
        }

        case 'verify_token': {
            const result = await executeOperation('futarchy.verifyToken', {
                tokenAddress: args.tokenAddress,
                chainId: args.chainId || 100
            });
            return result;
        }

        case 'get_pool_prices': {
            const chainId = args.chainId || 100;
            const { yesPool, noPool, error } = await fetchPools(chainId, args.proposalAddress);
            if (error) {
                return { status: 'error', message: error };
            }
            return {
                status: 'success',
                data: {
                    yesPrice: parseFloat(yesPool?.price) || 0,
                    noPrice: parseFloat(noPool?.price) || 0,
                    yesProbability: `${((parseFloat(yesPool?.price) || 0) * 100).toFixed(1)}%`,
                    noProbability: `${((parseFloat(noPool?.price) || 0) * 100).toFixed(1)}%`,
                    yesPool: yesPool?.id,
                    noPool: noPool?.id
                }
            };
        }

        case 'export_candles': {
            const chainId = args.chainId || 100;
            const limit = args.limit || 500;
            const startTime = args.startTime || null;
            const gapFill = args.gapFill !== false;

            const candleResult = await fetchCandles(chainId, args.proposalAddress, limit, startTime);

            if (candleResult.error) {
                return { status: 'error', message: candleResult.error };
            }

            let { yesData, noData } = candleResult;

            if (gapFill && yesData && noData) {
                yesData = gapFillCandles(yesData);
                noData = gapFillCandles(noData);

                // Sync to common time range
                if (yesData.length > 0 && noData.length > 0) {
                    const syncStart = Math.max(yesData[0].time, noData[0].time);
                    const syncEnd = Math.min(yesData[yesData.length - 1].time, noData[noData.length - 1].time);
                    yesData = yesData.filter(c => c.time >= syncStart && c.time <= syncEnd);
                    noData = noData.filter(c => c.time >= syncStart && c.time <= syncEnd);
                }
            }

            return {
                status: 'success',
                data: {
                    proposal: args.proposalAddress,
                    chainId,
                    candleCount: { yes: yesData?.length || 0, no: noData?.length || 0 },
                    candles: { yes: yesData, no: noData },
                    pools: { yes: candleResult.yesPool, no: candleResult.noPool }
                }
            };
        }

        case 'export_trades': {
            const chainId = args.chainId || 100;
            const limit = args.limit || 100;
            const startTime = args.startTime || null;

            // Get pools first
            const { yesPool, noPool, error: poolError } = await fetchPools(chainId, args.proposalAddress);
            if (poolError) {
                return { status: 'error', message: poolError };
            }

            const poolAddresses = [yesPool?.id, noPool?.id].filter(Boolean);
            const tradeResult = await fetchTrades(chainId, poolAddresses, limit, startTime);

            if (tradeResult.error) {
                return { status: 'error', message: tradeResult.error };
            }

            return {
                status: 'success',
                data: {
                    proposal: args.proposalAddress,
                    chainId,
                    tradeCount: tradeResult.trades?.length || 0,
                    trades: tradeResult.trades
                }
            };
        }

        // WRITE OPERATIONS
        case 'add_proposal_metadata': {
            const result = await executeOperation('futarchy.addProposal', {
                organizationAddress: args.organizationAddress,
                proposalAddress: args.proposalAddress,
                displayNameQuestion: args.displayNameQuestion,
                displayNameEvent: args.displayNameEvent,
                description: args.description || '',
                metadata: args.metadata || '',
                metadataURI: args.metadataURI || ''
            });
            return result;
        }

        case 'create_organization': {
            const result = await executeOperation('futarchy.createOrganization', {
                aggregatorAddress: args.aggregatorAddress || DEFAULT_AGGREGATOR,
                companyName: args.companyName,
                description: args.description || '',
                metadata: args.metadata || '',
                metadataURI: args.metadataURI || ''
            });
            return result;
        }

        case 'create_actual_proposal': {
            const result = await executeOperation('futarchy.createActualProposal', {
                chainId: args.chainId,
                marketName: args.marketName,
                companyToken: args.companyTokenAddress,
                currencyToken: args.currencyTokenAddress,
                category: args.category || 'governance',
                language: args.language || 'en',
                minBond: args.minBond || '1000000000000000000',
                openingTime: args.openingTime
            });
            return result;
        }

        case 'remove_organization': {
            const result = await executeOperation('futarchy.removeOrganization', {
                aggregatorAddress: args.aggregatorAddress,
                organizationIndex: args.organizationIndex
            });
            return result;
        }

        case 'remove_proposal': {
            const result = await executeOperation('futarchy.removeProposal', {
                organizationAddress: args.organizationAddress,
                proposalIndex: args.proposalIndex
            });
            return result;
        }

        case 'update_entity_metadata': {
            const result = await executeOperation('futarchy.updateEntityMetadata', {
                entityType: args.entityType,
                entityAddress: args.entityAddress,
                key: args.key,
                value: args.value
            });
            return result;
        }

        case 'batch_update_entity_metadata': {
            // Parse the updates JSON string
            let updatesObj;
            try {
                updatesObj = typeof args.updates === 'string' ? JSON.parse(args.updates) : args.updates;
            } catch (e) {
                return { status: 'error', message: `Invalid updates JSON: ${e.message}` };
            }

            const result = await executeOperation('futarchy.batchUpdateEntityMetadata', {
                entityType: args.entityType,
                entityAddress: args.entityAddress,
                updates: updatesObj
            });
            return result;
        }

        case 'update_organization_info': {
            const result = await executeOperation('futarchy.updateOrganizationInfo', {
                organizationAddress: args.organizationAddress,
                newName: args.newName,
                newDescription: args.newDescription || ''
            });
            return result;
        }

        case 'update_aggregator_info': {
            const result = await executeOperation('futarchy.updateAggregatorInfo', {
                aggregatorAddress: args.aggregatorAddress,
                newName: args.newName,
                newDescription: args.newDescription || ''
            });
            return result;
        }

        case 'update_proposal_info': {
            // SAFETY: Fetch existing values first to preserve fields not being updated
            const existingResult = await executeOperation('futarchy.getProposalMetadata', {
                proposalAddress: args.proposalMetadataAddress
            });

            let existingQuestion = '';
            let existingEvent = '';
            let existingDescription = '';

            if (existingResult.status === 'success' && existingResult.data) {
                existingQuestion = existingResult.data.displayNameQuestion || existingResult.data.question || '';
                existingEvent = existingResult.data.displayNameEvent || existingResult.data.marketName || '';
                existingDescription = existingResult.data.description || '';
            }

            // Only update fields that were explicitly provided (not undefined)
            const result = await executeOperation('futarchy.updateProposalInfo', {
                proposalMetadataAddress: args.proposalMetadataAddress,
                displayNameQuestion: args.displayNameQuestion !== undefined ? args.displayNameQuestion : existingQuestion,
                displayNameEvent: args.displayNameEvent !== undefined ? args.displayNameEvent : existingEvent,
                description: args.description !== undefined ? args.description : existingDescription
            });
            return result;
        }

        case 'add_existing_metadata': {
            const result = await executeOperation('futarchy.addExistingMetadata', {
                organizationAddress: args.organizationAddress,
                metadataAddress: args.metadataAddress
            });
            return result;
        }

        case 'create_pool': {
            const result = await executeOperation('futarchy.createPool', {
                proposalAddress: args.proposalAddress,
                poolType: args.poolType,
                initialPrice: args.initialPrice,
                chainId: args.chainId || 100,
                feeTier: args.feeTier || 3000
            });
            return result;
        }

        default:
            return { status: 'error', message: `Unknown tool: ${name}` };
    }
}

function handleResourceRead(uri) {
    switch (uri) {
        case 'futarchy://config/aggregator':
            return JSON.stringify({
                address: CONTRACT_ADDRESSES.DEFAULT_AGGREGATOR,
                name: 'Futarchy Finance',
                chain: 100,
                description: 'Main aggregator for Futarchy prediction markets'
            }, null, 2);

        case 'futarchy://config/chains':
            return JSON.stringify(CHAIN_CONFIG, null, 2);

        case 'futarchy://config/subgraphs':
            return JSON.stringify({
                candles: CANDLE_SUBGRAPHS,
                complete: COMPLETE_SUBGRAPH,
                helpers: {
                    getCandleSubgraph: 'getCandleSubgraph(chainId)',
                    getCompleteSubgraph: 'getCompleteSubgraph(chainId)'
                }
            }, null, 2);

        case 'futarchy://config/pool-types':
            return JSON.stringify({
                CONDITIONAL: {
                    description: 'YES/NO outcome pools',
                    pairs: ['YES_sDAI ↔ YES_GNO', 'NO_sDAI ↔ NO_GNO']
                },
                PREDICTION: {
                    description: 'Outcome probability pools',
                    pairs: ['sDAI ↔ YES_sDAI', 'sDAI ↔ NO_sDAI']
                },
                EXPECTED_VALUE: {
                    description: 'Expected value pools',
                    pairs: ['sDAI ↔ YES_GNO', 'sDAI ↔ NO_GNO']
                }
            }, null, 2);

        default:
            return JSON.stringify({ error: `Unknown resource: ${uri}` });
    }
}

// =============================================================================
// MCP SERVER: Main Entry Point
// =============================================================================

async function main() {
    const server = new Server(
        {
            name: 'futarchy-complete-sdk',
            version: '1.0.0'
        },
        {
            capabilities: {
                tools: {},
                resources: {}
            }
        }
    );

    // List Tools Handler
    server.setRequestHandler(ListToolsRequestSchema, async () => {
        return { tools: TOOLS };
    });

    // Call Tool Handler
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;

        try {
            const result = await handleToolCall(name, args || {});
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(result, null, 2)
                    }
                ]
            };
        } catch (error) {
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({ status: 'error', message: error.message }, null, 2)
                    }
                ],
                isError: true
            };
        }
    });

    // List Resources Handler
    server.setRequestHandler(ListResourcesRequestSchema, async () => {
        return { resources: RESOURCES };
    });

    // Read Resource Handler
    server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
        const { uri } = request.params;
        const content = handleResourceRead(uri);
        return {
            contents: [
                {
                    uri,
                    mimeType: 'application/json',
                    text: content
                }
            ]
        };
    });

    // Connect via stdio
    const transport = new StdioServerTransport();
    await server.connect(transport);

    console.error('Futarchy Complete SDK MCP Server running on stdio');
}

main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
