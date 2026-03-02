#!/usr/bin/env node

// MCP Futarchy Server - Model Context Protocol server for futarchy operations
// Provides split, merge, swap, and redeem operations via MCP for Claude

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
    ListToolsRequestSchema,
    CallToolRequestSchema 
} from '@modelcontextprotocol/sdk/types.js';
import { createPublicClient, createWalletClient, http, formatEther, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { gnosis } from 'viem/chains';
import { DataLayer } from './DataLayer.js';
import { createPoolDiscoveryFetcher } from './fetchers/PoolDiscoveryFetcher.js';
import { createProposalFetcher } from './fetchers/ProposalFetcher.js';
import MarketEventsFetcher from './fetchers/MarketEventsFetcher.js';
import { FutarchyFetcher } from './fetchers/FutarchyFetcher.js';
import { createTickSpreadFetcher } from './fetchers/TickSpreadFetcher.js';
import { SdaiRateFetcher } from './fetchers/SdaiRateFetcher.js';
import { ViemExecutor } from './executors/ViemExecutor.js';
import { FutarchyCartridge } from './executors/FutarchyCartridge.js';
import dotenv from 'dotenv';

// Redirect console.log to console.error BEFORE loading anything else
const originalLog = console.log;
console.log = console.error;

dotenv.config();

// Constants
const ROUTER_ADDRESS = '0x7495a583ba85875d59407781b4958ED6e0E1228f';
const CONDITIONAL_TOKENS = '0xCeAfDD6bc0bEF976fdCd1112955828E00543c0Ce';

class FutarchyMCPServer {
    constructor() {
        this.dataLayer = new DataLayer();
        this.proposal = null;
        this.pools = null;
        this.tokens = null;
        this.account = null;
        
        // Initialize viem clients
        if (process.env.PRIVATE_KEY) {
            const privateKey = process.env.PRIVATE_KEY.startsWith('0x') 
                ? process.env.PRIVATE_KEY 
                : `0x${process.env.PRIVATE_KEY}`;
            this.account = privateKeyToAccount(privateKey);
        }
        
        this.publicClient = createPublicClient({
            chain: gnosis,
            transport: http(process.env.RPC_URL || 'https://rpc.gnosischain.com')
        });
        
        if (this.account) {
            this.walletClient = createWalletClient({
                account: this.account,
                chain: gnosis,
                transport: http(process.env.RPC_URL || 'https://rpc.gnosischain.com')
            });
        }
        
        // Register fetchers
        this.poolFetcher = createPoolDiscoveryFetcher();
        this.proposalFetcher = createProposalFetcher();
        this.marketEventsFetcher = new MarketEventsFetcher();
        this.futarchyFetcher = new FutarchyFetcher(this.publicClient);
        this.tickSpreadFetcher = createTickSpreadFetcher();
        this.sdaiRateFetcher = new SdaiRateFetcher({ publicClient: this.publicClient });
        
        this.dataLayer.registerFetcher(this.poolFetcher);
        this.dataLayer.registerFetcher(this.proposalFetcher);
        this.dataLayer.registerFetcher(this.marketEventsFetcher);
        this.dataLayer.registerFetcher(this.futarchyFetcher);
        this.dataLayer.registerFetcher(this.tickSpreadFetcher);
        this.dataLayer.registerFetcher(this.sdaiRateFetcher);
        
        // Register executor if wallet available
        if (this.walletClient) {
            this.executor = new ViemExecutor({
                publicClient: this.publicClient,
                walletClient: this.walletClient,
                account: this.account
            });
            
            const cartridge = new FutarchyCartridge();
            this.executor.registerCartridge(cartridge);
            this.dataLayer.registerExecutor(this.executor);
        }
        
        // Create MCP server
        this.server = new Server({
            name: 'futarchy-mcp',
            version: '1.0.0'
        }, {
            capabilities: {
                tools: {}
            }
        });
        
        this.setupTools();
        this.setupHandlers();
    }
    
    setupTools() {
        // Tool: Load Proposal
        this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: [
                {
                    name: 'loadProposal',
                    description: 'Load a futarchy proposal and discover its pools',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            proposalId: {
                                type: 'string',
                                description: 'The proposal address or ID to load'
                            }
                        },
                        required: ['proposalId']
                    }
                },
                {
                    name: 'getBalances',
                    description: 'Get all token balances for the current account',
                    inputSchema: {
                        type: 'object',
                        properties: {}
                    }
                },
                {
                    name: 'getPrices',
                    description: 'Get current prices for all pools',
                    inputSchema: {
                        type: 'object',
                        properties: {}
                    }
                },
                {
                    name: 'splitPosition',
                    description: 'Split collateral tokens into YES/NO conditional tokens',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            collateralType: {
                                type: 'string',
                                enum: ['company', 'currency'],
                                description: 'Which collateral to split (company=PNK or currency=sDAI)'
                            },
                            amount: {
                                type: 'string',
                                description: 'Amount of collateral to split (in ether units)'
                            }
                        },
                        required: ['collateralType', 'amount']
                    }
                },
                {
                    name: 'mergePositions',
                    description: 'Merge YES/NO conditional tokens back to collateral',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            collateralType: {
                                type: 'string',
                                enum: ['company', 'currency'],
                                description: 'Which collateral type to merge back to'
                            },
                            amount: {
                                type: 'string',
                                description: 'Amount of tokens to merge (in ether units). Will use minimum of YES/NO balances if not specified.'
                            }
                        },
                        required: ['collateralType']
                    }
                },
                {
                    name: 'swapTokens',
                    description: 'Swap tokens via conditional or prediction markets',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            marketType: {
                                type: 'string',
                                enum: ['conditional', 'prediction'],
                                description: 'Market type to use for swap'
                            },
                            direction: {
                                type: 'string',
                                enum: ['BUY', 'SELL'],
                                description: 'Trade direction'
                            },
                            outcome: {
                                type: 'string',
                                enum: ['YES', 'NO'],
                                description: 'Which outcome to trade'
                            },
                            tokenType: {
                                type: 'string',
                                enum: ['company', 'currency'],
                                description: 'Token type (company or currency)'
                            },
                            amount: {
                                type: 'string',
                                description: 'Amount to trade (in ether units)'
                            },
                            slippage: {
                                type: 'number',
                                description: 'Slippage tolerance percentage (default: 1)',
                                default: 1
                            }
                        },
                        required: ['marketType', 'direction', 'outcome', 'amount']
                    }
                },
                {
                    name: 'getPositionAnalysis',
                    description: 'Analyze current positions and suggest actions',
                    inputSchema: {
                        type: 'object',
                        properties: {}
                    }
                },
                {
                    name: 'estimateSwap',
                    description: 'Get quote for a swap without executing',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            marketType: {
                                type: 'string',
                                enum: ['conditional', 'prediction']
                            },
                            direction: {
                                type: 'string',
                                enum: ['BUY', 'SELL']
                            },
                            outcome: {
                                type: 'string',
                                enum: ['YES', 'NO']
                            },
                            tokenType: {
                                type: 'string',
                                enum: ['company', 'currency']
                            },
                            amount: {
                                type: 'string'
                            }
                        },
                        required: ['marketType', 'direction', 'outcome', 'amount']
                    }
                }
            ]
        }));
    }
    
    setupHandlers() {
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            
            try {
                switch (name) {
                    case 'loadProposal':
                        return await this.handleLoadProposal(args);
                    
                    case 'getBalances':
                        return await this.handleGetBalances();
                    
                    case 'getPrices':
                        return await this.handleGetPrices();
                    
                    case 'splitPosition':
                        return await this.handleSplitPosition(args);
                    
                    case 'mergePositions':
                        return await this.handleMergePositions(args);
                    
                    case 'swapTokens':
                        return await this.handleSwapTokens(args);
                    
                    case 'getPositionAnalysis':
                        return await this.handlePositionAnalysis();
                    
                    case 'estimateSwap':
                        return await this.handleEstimateSwap(args);
                    
                    default:
                        throw new Error(`Unknown tool: ${name}`);
                }
            } catch (error) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Error: ${error.message}`
                        }
                    ]
                };
            }
        });
    }
    
    async handleLoadProposal(args) {
        const { proposalId } = args;
        
        // Fetch proposal data
        const proposalResult = await this.dataLayer.fetch('proposal.details', { 
            proposalAddress: proposalId 
        });
        
        if (proposalResult.status !== 'success') {
            throw new Error(`Failed to load proposal: ${proposalResult.message}`);
        }
        
        this.proposal = {
            address: proposalResult.data.proposalAddress,
            title: proposalResult.data.marketName,
            description: proposalResult.data.encodedQuestion,
            oracle: proposalResult.data.realityProxy,
            companyToken: proposalResult.data.collateralToken1,
            currencyToken: proposalResult.data.collateralToken2,
            conditionId: proposalResult.data.conditionId,
            questionId: proposalResult.data.questionId,
            ...proposalResult.data
        };
        
        // Discover pools
        const poolsResult = await this.dataLayer.fetch('pools.discover', {
            oracle: this.proposal.oracle,
            companyToken: this.proposal.companyToken,
            currencyToken: this.proposal.currencyToken
        });
        
        if (poolsResult.status === 'success') {
            this.pools = poolsResult.data.pools;
            this.tokens = poolsResult.data.tokens;
        }
        
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({
                        proposal: {
                            address: this.proposal.address,
                            title: this.proposal.title,
                            description: this.proposal.description,
                            oracle: this.proposal.oracle,
                            companyToken: this.proposal.companyToken,
                            currencyToken: this.proposal.currencyToken
                        },
                        pools: this.pools ? {
                            conditional: this.pools.conditional?.length || 0,
                            prediction: this.pools.prediction?.length || 0
                        } : null,
                        tokens: this.tokens
                    }, null, 2)
                }
            ]
        };
    }
    
    async handleGetBalances() {
        if (!this.account) {
            throw new Error('No wallet connected');
        }
        
        if (!this.proposal) {
            throw new Error('No proposal loaded. Use loadProposal first.');
        }
        
        const balancesResult = await this.dataLayer.fetch('futarchy.getBalances', {
            account: this.account.address,
            proposalAddress: this.proposal.address,
            includeAllTokens: true
        });
        
        if (balancesResult.status !== 'success') {
            throw new Error(`Failed to get balances: ${balancesResult.message}`);
        }
        
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(balancesResult.data, null, 2)
                }
            ]
        };
    }
    
    async handleGetPrices() {
        const prices = {};
        
        // Get prices for each pool if pools are available
        if (this.pools) {
            for (const pool of [...(this.pools.conditional || []), ...(this.pools.prediction || [])]) {
                const priceResult = await this.dataLayer.fetch('futarchy.poolPrice', {
                    poolAddress: pool.address
                });
                
                if (priceResult.status === 'success') {
                    prices[pool.name] = priceResult.data;
                }
            }
        }
        
        // Always try to get sDAI rate as it doesn't require pools
        try {
            const sdaiResult = await this.dataLayer.fetch('sdai.rate');
            if (sdaiResult.status === 'success') {
                prices.sdaiRate = sdaiResult.data.rate;
            }
        } catch (error) {
            prices.sdaiRate = { error: error.message };
        }
        
        // If no pools and no sDAI rate, provide helpful message
        if (Object.keys(prices).length === 0) {
            prices.message = "No pools loaded and no price data available. Use loadProposal first to discover pools.";
        }
        
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(prices, null, 2)
                }
            ]
        };
    }
    
    async handleSplitPosition(args) {
        if (!this.executor) {
            throw new Error('No wallet connected');
        }
        
        if (!this.proposal) {
            throw new Error('No proposal loaded. Use loadProposal first.');
        }
        
        const { collateralType, amount } = args;
        const amountWei = parseEther(amount);
        
        const collateralToken = collateralType === 'company' 
            ? this.proposal.companyToken 
            : this.proposal.currencyToken;
        
        const results = [];
        for await (const status of this.dataLayer.execute('futarchy.splitPosition', {
            proposal: this.proposal.address,
            amount: amountWei,
            collateralToken: collateralToken
        })) {
            results.push(status);
            if (status.status === 'success') {
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({
                                success: true,
                                transactionHash: status.data.transactionHash,
                                amount: amount,
                                collateralType: collateralType,
                                message: `Successfully split ${amount} ${collateralType} tokens into YES/NO tokens`
                            }, null, 2)
                        }
                    ]
                };
            } else if (status.status === 'error') {
                throw new Error(status.message);
            }
        }
    }
    
    async handleMergePositions(args) {
        if (!this.executor) {
            throw new Error('No wallet connected');
        }
        
        if (!this.proposal) {
            throw new Error('No proposal loaded. Use loadProposal first.');
        }
        
        const { collateralType, amount } = args;
        
        // Get the wrapped token data to find YES/NO token addresses
        const wrappedResult = await this.dataLayer.fetch('proposal.wrapped', {
            proposalAddress: this.proposal.address
        });
        
        if (wrappedResult.status !== 'success') {
            throw new Error('Failed to get wrapped token data');
        }
        
        const wrapped = wrappedResult.data;
        const isCompany = collateralType === 'company';
        
        // Get YES and NO token addresses
        const yesToken = isCompany ? wrapped.yesCompany : wrapped.yesCurrency;
        const noToken = isCompany ? wrapped.noCompany : wrapped.noCurrency;
        
        if (!yesToken || !noToken) {
            throw new Error('Failed to get YES/NO token addresses');
        }
        
        // If amount not specified, get balances to find mergeable amount
        let amountWei;
        if (!amount) {
            const balancesResult = await this.dataLayer.fetch('futarchy.getBalances', {
                account: this.account.address,
                proposalAddress: this.proposal.address,
                includeAllTokens: true
            });
            
            if (balancesResult.status !== 'success') {
                throw new Error('Failed to get balances');
            }
            
            const balances = balancesResult.data.balances;
            const yesTokenLabel = collateralType === 'company' ? 'YES_COMPANY' : 'YES_CURRENCY';
            const noTokenLabel = collateralType === 'company' ? 'NO_COMPANY' : 'NO_CURRENCY';
            
            const yesBalance = balances.find(b => b.label === yesTokenLabel)?.balance || 0n;
            const noBalance = balances.find(b => b.label === noTokenLabel)?.balance || 0n;
            
            amountWei = yesBalance < noBalance ? yesBalance : noBalance;
            
            if (amountWei === 0n) {
                throw new Error(`No mergeable ${collateralType} positions`);
            }
        } else {
            amountWei = parseEther(amount);
        }
        
        const collateralToken = collateralType === 'company' 
            ? this.proposal.companyToken 
            : this.proposal.currencyToken;
        
        const results = [];
        // Use completeMerge instead of mergePositions to include approvals
        for await (const status of this.dataLayer.execute('futarchy.completeMerge', {
            proposal: this.proposal.address,
            collateralToken: collateralToken,
            amount: amountWei,
            yesToken: yesToken,
            noToken: noToken
        })) {
            results.push(status);
            if (status.status === 'success') {
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({
                                success: true,
                                transactionHash: status.data.transactionHash,
                                amount: formatEther(amountWei),
                                collateralType: collateralType,
                                message: `Successfully merged ${formatEther(amountWei)} YES/NO tokens back to ${collateralType}`
                            }, null, 2)
                        }
                    ]
                };
            } else if (status.status === 'error') {
                throw new Error(status.message);
            }
        }
    }
    
    async handleSwapTokens(args) {
        if (!this.executor) {
            throw new Error('No wallet connected');
        }
        
        if (!this.pools) {
            throw new Error('No pools loaded. Use loadProposal first.');
        }
        
        const { marketType, direction, outcome, tokenType, amount, slippage = 1 } = args;
        const amountWei = parseEther(amount);
        
        // Determine the pool to use
        const poolType = marketType === 'conditional' 
            ? (tokenType === 'company' ? 'CONDITIONAL_COMPANY' : 'CONDITIONAL_CURRENCY')
            : 'PREDICTION';
        
        const pool = this.pools[marketType === 'conditional' ? 'conditional' : 'prediction']
            ?.find(p => p.name.includes(poolType));
        
        if (!pool) {
            throw new Error(`No ${marketType} pool found`);
        }
        
        // TODO: Implement actual swap execution using pool contracts
        // This would involve:
        // 1. Getting quote from the pool
        // 2. Checking/setting approvals
        // 3. Executing the swap transaction
        
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({
                        warning: 'Swap execution not fully implemented yet',
                        parameters: {
                            marketType,
                            direction,
                            outcome,
                            tokenType,
                            amount,
                            slippage,
                            pool: pool.address
                        }
                    }, null, 2)
                }
            ]
        };
    }
    
    async handlePositionAnalysis() {
        if (!this.account) {
            throw new Error('No wallet connected');
        }
        
        if (!this.proposal) {
            throw new Error('No proposal loaded. Use loadProposal first.');
        }
        
        const analysisResult = await this.dataLayer.fetch('futarchy.analyzePositions', {
            account: this.account.address,
            proposalAddress: this.proposal.address
        });
        
        if (analysisResult.status !== 'success') {
            throw new Error(`Failed to analyze positions: ${analysisResult.message}`);
        }
        
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(analysisResult.data, null, 2)
                }
            ]
        };
    }
    
    async handleEstimateSwap(args) {
        // TODO: Implement swap estimation
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({
                        warning: 'Swap estimation not implemented yet',
                        parameters: args
                    }, null, 2)
                }
            ]
        };
    }
    
    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        // Use stderr for logging so it doesn't interfere with stdio protocol
        console.error('Futarchy MCP Server running...');
    }
}

// Export for testing
export { FutarchyMCPServer };

// Start the server if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const server = new FutarchyMCPServer();
    server.run().catch(console.error);
}