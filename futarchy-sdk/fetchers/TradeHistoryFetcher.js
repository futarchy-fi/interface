// TradeHistoryFetcher.js - Fetcher for trade history data from Supabase

import { BaseFetcher } from '../DataLayer.js';
import { createClient } from '@supabase/supabase-js';
import { createERC20Fetcher } from './ERC20Fetcher.js';

// =============================================================================
// TRADE HISTORY FETCHER CLASS
// =============================================================================

class TradeHistoryFetcher extends BaseFetcher {
    constructor(supabaseClient, options = {}) {
        super();
        this.name = 'TradeHistoryFetcher';
        this.supabaseClient = supabaseClient;

        // Store chain ID for block explorer links
        this.chainId = options.chainId || 100;

        // Token info cache to minimize RPC calls
        this.tokenCache = new Map();
        this.tokenCacheTimeout = options.tokenCacheTimeout || 3600000; // 1 hour default

        // Initialize ERC20 fetcher for token info
        this.erc20Fetcher = options.erc20Fetcher || createERC20Fetcher(
            options.rpcUrl || 'https://rpc.gnosischain.com',
            this.chainId
        );

        // Register supported operations
        this.registerOperation('trades.history', this.getTradeHistory.bind(this));
        this.registerOperation('trades.user', this.getUserTrades.bind(this));
        this.registerOperation('trades.proposal', this.getProposalTrades.bind(this));
        this.registerOperation('trades.summary', this.getTradeSummary.bind(this));
        this.registerOperation('trades.recent', this.getRecentTrades.bind(this));

        console.log(`🔧 ${this.name} initialized with ${this.supportedOperations.length} operations (chain ${this.chainId})`);
    }

    async fetch(dataPath, args = {}) {
        console.log(`📡 ${this.name} handling '${dataPath}' with args:`, args);

        if (dataPath in this.operations) {
            try {
                return await this.operations[dataPath](args);
            } catch (error) {
                return {
                    status: 'error',
                    reason: error.message,
                    source: this.name
                };
            }
        } else {
            return {
                status: 'error',
                reason: `Operation '${dataPath}' not supported by ${this.name}`,
                supportedOperations: this.supportedOperations
            };
        }
    }

    /**
     * Get trade history with flexible filtering
     * @param {object} args - Filter parameters
     * @param {string} args.userAddress - User wallet address
     * @param {string} args.proposalId - Proposal ID/address
     * @param {number} args.limit - Number of records to return
     * @param {string} args.orderBy - Field to order by
     * @param {boolean} args.ascending - Sort order
     */
    async getTradeHistory(args) {
        const {
            userAddress,
            proposalId,
            limit = 100,
            orderBy = 'timestamp',
            ascending = false
        } = args;

        console.log(`🔍 Querying trade history from Supabase`);
        console.log(`  User: ${userAddress || 'all'}`);
        console.log(`  Proposal: ${proposalId || 'all'}`);

        // Build the query
        let query = this.supabaseClient
            .from('trade_history')
            .select('*');

        // Apply filters
        if (userAddress) {
            query = query.eq('user_address', userAddress.toLowerCase());
        }

        if (proposalId) {
            // DON'T lowercase proposal_id - use original case from database
            query = query.eq('proposal_id', proposalId);
        }

        // Apply ordering (map common field names to actual column names)
        const orderField = orderBy === 'timestamp' ? 'evt_block_time' : orderBy;
        query = query.order(orderField, { ascending });

        // Apply limit
        if (limit) {
            query = query.limit(limit);
        }

        const { data, error } = await query;

        if (error) {
            throw new Error(`Supabase query failed: ${error.message}`);
        }

        console.log(`✅ Successfully fetched ${data?.length || 0} trade records`);

        // Format trade data and enrich with token info
        const formattedData = await this.formatTradeDataWithTokenInfo(data || []);

        return {
            status: 'success',
            data: formattedData,
            source: this.name,
            count: data?.length || 0,
            filters: {
                userAddress,
                proposalId,
                limit,
                orderBy,
                ascending
            },
            timestamp: Date.now()
        };
    }

    /**
     * Get all trades for a specific user
     */
    async getUserTrades(args) {
        const { userAddress, limit = 50 } = args;

        if (!userAddress) {
            throw new Error('userAddress is required for trades.user operation');
        }

        return this.getTradeHistory({
            userAddress,
            limit,
            orderBy: 'timestamp',
            ascending: false
        });
    }

    /**
     * Get all trades for a specific proposal
     */
    async getProposalTrades(args) {
        const { proposalId, limit = 100 } = args;

        if (!proposalId) {
            throw new Error('proposalId is required for trades.proposal operation');
        }

        return this.getTradeHistory({
            proposalId,
            limit,
            orderBy: 'timestamp',
            ascending: false
        });
    }

    /**
     * Get recent trades across all proposals
     */
    async getRecentTrades(args) {
        const { limit = 20 } = args;

        return this.getTradeHistory({
            limit,
            orderBy: 'timestamp',
            ascending: false
        });
    }

    /**
     * Get trade summary statistics for a user/proposal combination
     */
    async getTradeSummary(args) {
        const { userAddress, proposalId } = args;

        if (!userAddress && !proposalId) {
            throw new Error('Either userAddress or proposalId is required for trade summary');
        }

        // Get all trades for the given filters
        const result = await this.getTradeHistory({
            userAddress,
            proposalId,
            limit: null // Get all trades
        });

        if (result.status !== 'success') {
            return result;
        }

        const trades = result.data;

        // Calculate summary statistics
        const summary = {
            totalTrades: trades.length,
            uniqueTokens: new Set(trades.map(t => t.token0)).size,
            totalVolume: trades.reduce((sum, t) => sum + Math.abs(parseFloat(t.amount0 || 0)), 0),
            averagePrice: trades.length > 0
                ? trades.reduce((sum, t) => sum + (t.price || 0), 0) / trades.length
                : 0,
            firstTrade: trades.length > 0 ? trades[trades.length - 1] : null,
            lastTrade: trades.length > 0 ? trades[0] : null,
            tradesByType: this.groupTradesByType(trades),
            tradesByToken: this.groupTradesByToken(trades)
        };

        return {
            status: 'success',
            data: summary,
            source: this.name,
            filters: { userAddress, proposalId },
            timestamp: Date.now()
        };
    }


    /**
     * Determine trade type based on amounts
     */
    determineTradeType(trade) {
        // If amount0 is negative, it's a sell of token0
        // If amount0 is positive, it's a buy of token0
        const amount0 = parseFloat(trade.amount0 || 0);
        const amount1 = parseFloat(trade.amount1 || 0);

        if (amount0 < 0 && amount1 > 0) {
            return 'sell'; // Selling token0 for token1
        } else if (amount0 > 0 && amount1 < 0) {
            return 'buy'; // Buying token0 with token1
        } else {
            return 'swap'; // Generic swap
        }
    }

    /**
     * Determine trade side (buy/sell)
     */
    determineSide(trade) {
        const amount0 = parseFloat(trade.amount0 || 0);
        return amount0 > 0 ? 'buy' : 'sell';
    }

    /**
     * Format amount for display
     */
    formatAmount(amount) {
        if (!amount) return '0';

        const num = parseFloat(amount);
        if (num < 0.01) {
            return num.toExponential(2);
        } else if (num < 1) {
            return num.toFixed(4);
        } else if (num < 1000) {
            return num.toFixed(2);
        } else if (num < 1000000) {
            return `${(num / 1000).toFixed(1)}K`;
        } else {
            return `${(num / 1000000).toFixed(2)}M`;
        }
    }

    /**
     * Group trades by type
     */
    groupTradesByType(trades) {
        const groups = {};
        trades.forEach(trade => {
            const type = trade.tradeType || 'unknown';
            if (!groups[type]) {
                groups[type] = {
                    count: 0,
                    volume: 0,
                    trades: []
                };
            }
            groups[type].count++;
            groups[type].volume += Math.abs(parseFloat(trade.amount0 || 0));
            groups[type].trades.push(trade);
        });
        return groups;
    }

    /**
     * Group trades by token
     */
    groupTradesByToken(trades) {
        const groups = {};
        trades.forEach(trade => {
            // Group by token0 address
            const token = trade.token0 || 'unknown';
            if (!groups[token]) {
                groups[token] = {
                    count: 0,
                    volume: 0,
                    averagePrice: 0,
                    trades: []
                };
            }
            groups[token].count++;
            groups[token].volume += Math.abs(parseFloat(trade.amount0 || 0));
            groups[token].trades.push(trade);
        });

        // Calculate average prices
        Object.keys(groups).forEach(token => {
            const tokenTrades = groups[token].trades;
            const totalPrice = tokenTrades.reduce((sum, t) => sum + (t.price || 0), 0);
            groups[token].averagePrice = tokenTrades.length > 0
                ? totalPrice / tokenTrades.length
                : 0;
        });

        return groups;
    }

    /**
     * Get token info from cache or fetch if needed
     */
    async getTokenInfo(tokenAddress) {
        if (!tokenAddress || tokenAddress === '0x0000000000000000000000000000000000000000') {
            return { symbol: 'ETH', name: 'Ethereum', decimals: 18 };
        }

        // Check cache first
        const cacheKey = tokenAddress.toLowerCase();
        const cached = this.tokenCache.get(cacheKey);

        if (cached && cached.timestamp > Date.now() - this.tokenCacheTimeout) {
            return cached.data;
        }

        // Fetch token info using ERC20Fetcher
        try {
            const result = await this.erc20Fetcher.getTokenMetadata({
                tokenAddress
            });

            if (result.status === 'success') {
                const tokenInfo = {
                    symbol: result.data.symbol,
                    name: result.data.name,
                    decimals: result.data.decimals
                };

                // Cache the result
                this.tokenCache.set(cacheKey, {
                    data: tokenInfo,
                    timestamp: Date.now()
                });

                return tokenInfo;
            }
        } catch (error) {
            console.log(`⚠️ Failed to fetch token info for ${tokenAddress}: ${error.message}`);
        }

        // Return default if fetch failed
        return {
            symbol: tokenAddress.substring(0, 6) + '...',
            name: 'Unknown Token',
            decimals: 18
        };
    }

    /**
     * Batch fetch token info for multiple addresses
     */
    async batchFetchTokenInfo(tokenAddresses) {
        // Remove duplicates and filter out null/zero addresses
        const uniqueAddresses = [...new Set(tokenAddresses.filter(addr =>
            addr && addr !== '0x0000000000000000000000000000000000000000'
        ))];

        // Check what's not in cache
        const toFetch = uniqueAddresses.filter(addr => {
            const cached = this.tokenCache.get(addr.toLowerCase());
            return !cached || cached.timestamp < Date.now() - this.tokenCacheTimeout;
        });

        if (toFetch.length > 0) {
            console.log(`📊 ${toFetch.length} tokens not in cache. Skipping RPC calls - using fallback values.`);
            console.log('   Uncached tokens:', toFetch);

            // DON'T make RPC calls - just use fallback values
            // If you want to enable RPC calls, pre-populate the cache first from config
            toFetch.forEach(addr => {
                this.tokenCache.set(addr.toLowerCase(), {
                    data: {
                        symbol: addr.substring(0, 8) + '...',
                        name: 'Unknown Token',
                        decimals: 18
                    },
                    timestamp: Date.now()
                });
            });
        }

        // Return all token info from cache
        const tokenInfoMap = {};
        for (const addr of uniqueAddresses) {
            const cached = this.tokenCache.get(addr.toLowerCase());
            if (cached) {
                tokenInfoMap[addr.toLowerCase()] = cached.data;
            } else {
                // Fallback if not in cache
                tokenInfoMap[addr.toLowerCase()] = {
                    symbol: addr.substring(0, 8) + '...',
                    name: 'Unknown Token',
                    decimals: 18
                };
            }
        }

        return tokenInfoMap;
    }

    /**
     * Format trade data with token information
     */
    async formatTradeDataWithTokenInfo(trades) {
        if (!trades || trades.length === 0) {
            return [];
        }

        // Collect all unique token addresses
        const tokenAddresses = [];
        trades.forEach(trade => {
            if (trade.token0) tokenAddresses.push(trade.token0);
            if (trade.token1) tokenAddresses.push(trade.token1);
        });

        // Batch fetch all token info with error handling
        let tokenInfoMap = {};
        try {
            tokenInfoMap = await this.batchFetchTokenInfo(tokenAddresses);
        } catch (error) {
            console.error('⚠️ Error fetching token info, will use fallback values:', error.message);
            // Create fallback map
            tokenAddresses.forEach(addr => {
                if (addr) {
                    tokenInfoMap[addr.toLowerCase()] = {
                        symbol: addr.substring(0, 8) + '...',
                        name: 'Token',
                        decimals: 18
                    };
                }
            });
        }

        // Format trades with token info
        return trades.map(trade => {
            const token0Info = trade.token0 ?
                tokenInfoMap[trade.token0.toLowerCase()] || {} : {};
            const token1Info = trade.token1 ?
                tokenInfoMap[trade.token1.toLowerCase()] || {} : {};

            return {
                // Core fields
                id: trade.id,
                userAddress: trade.user_address,
                proposalId: trade.proposal_id,
                poolId: trade.pool_id,

                // Token 0 details with info
                token0: trade.token0,
                token0Symbol: token0Info.symbol || 'UNKNOWN',
                token0Name: token0Info.name || 'Unknown Token',
                token0Decimals: token0Info.decimals || 18,
                amount0: trade.amount0,
                amount0Formatted: this.formatAmount(trade.amount0),

                // Token 1 details with info
                token1: trade.token1,
                token1Symbol: token1Info.symbol || 'UNKNOWN',
                token1Name: token1Info.name || 'Unknown Token',
                token1Decimals: token1Info.decimals || 18,
                amount1: trade.amount1,
                amount1Formatted: this.formatAmount(trade.amount1),

                // Determine trade type based on amounts
                tradeType: this.determineTradeType(trade),
                side: this.determineSide(trade),

                // Transaction info
                transactionHash: trade.evt_tx_hash,
                blockNumber: trade.evt_block_number,
                blockTime: trade.evt_block_time,
                createdAt: trade.created_at,
                chain: this.chainId, // Add chainId for proper block explorer links

                // Formatted values for display
                timestampFormatted: trade.evt_block_time
                    ? new Date(trade.evt_block_time).toISOString()
                    : trade.created_at
                    ? new Date(trade.created_at).toISOString()
                    : null,

                // Calculate price if possible (amount1/amount0)
                price: trade.amount0 && trade.amount0 !== '0'
                    ? Math.abs(parseFloat(trade.amount1) / parseFloat(trade.amount0))
                    : null,
                priceFormatted: trade.amount0 && trade.amount0 !== '0'
                    ? `$${Math.abs(parseFloat(trade.amount1) / parseFloat(trade.amount0)).toFixed(4)}`
                    : 'N/A',

                // Trade summary for display
                tradeSummary: this.createTradeSummary(trade, token0Info, token1Info),

                // Determine outcome (YES/NO) from token symbols
                outcome: this.determineDominantOutcome(
                    token0Info.symbol,
                    token1Info.symbol,
                    trade.amount0,
                    trade.amount1
                ),
                token0Outcome: this.determineOutcome(token0Info.symbol),
                token1Outcome: this.determineOutcome(token1Info.symbol)
            };
        });
    }

    /**
     * Determine outcome (YES/NO) from token symbol
     */
    determineOutcome(tokenSymbol) {
        if (!tokenSymbol) return null;

        const symbolUpper = tokenSymbol.toUpperCase();

        // Check for YES pattern
        if (/^YES[_\s-]|^YES$|YES[_\s-]/.test(symbolUpper)) {
            return 'YES';
        }

        // Check for NO pattern
        if (/^NO[_\s-]|^NO$|NO[_\s-]/.test(symbolUpper)) {
            return 'NO';
        }

        return null;
    }

    /**
     * Determine dominant outcome from a trade
     */
    determineDominantOutcome(token0Symbol, token1Symbol, amount0, amount1) {
        const outcome0 = this.determineOutcome(token0Symbol);
        const outcome1 = this.determineOutcome(token1Symbol);

        // If both tokens have same outcome, return that outcome
        if (outcome0 === outcome1 && outcome0 !== null) {
            return outcome0;
        }

        // If only one token has outcome, return that
        if (outcome0 && !outcome1) return outcome0;
        if (outcome1 && !outcome0) return outcome1;

        // If different outcomes, determine based on what was bought/sold
        if (outcome0 && outcome1 && outcome0 !== outcome1) {
            const amt0 = parseFloat(amount0 || 0);
            const amt1 = parseFloat(amount1 || 0);

            // If buying token0 (amount0 positive), token0's outcome is dominant
            if (amt0 > 0 && amt1 < 0) {
                return outcome0;
            }
            // If buying token1 (amount1 positive), token1's outcome is dominant
            if (amt1 > 0 && amt0 < 0) {
                return outcome1;
            }
        }

        return null;
    }

    /**
     * Create a human-readable trade summary
     */
    createTradeSummary(trade, token0Info, token1Info) {
        const amount0 = parseFloat(trade.amount0 || 0);
        const amount1 = parseFloat(trade.amount1 || 0);
        const token0Symbol = token0Info.symbol || 'TOKEN0';
        const token1Symbol = token1Info.symbol || 'TOKEN1';

        if (amount0 < 0 && amount1 > 0) {
            return `Sold ${this.formatAmount(Math.abs(amount0))} ${token0Symbol} for ${this.formatAmount(amount1)} ${token1Symbol}`;
        } else if (amount0 > 0 && amount1 < 0) {
            return `Bought ${this.formatAmount(amount0)} ${token0Symbol} with ${this.formatAmount(Math.abs(amount1))} ${token1Symbol}`;
        } else {
            return `Swapped ${token0Symbol} ⇄ ${token1Symbol}`;
        }
    }

    /**
     * Clear the token cache
     */
    clearTokenCache() {
        this.tokenCache.clear();
        console.log('🗑️ Token cache cleared');
    }

    /**
     * Original formatTradeData method (kept for backward compatibility)
     */
    formatTradeData(trades) {
        // This is now a simple wrapper that calls the async version synchronously
        // For backward compatibility with existing code
        console.warn('⚠️ Using deprecated formatTradeData, use formatTradeDataWithTokenInfo instead');
        return this.formatTradeDataSync(trades);
    }

    /**
     * Synchronous format without token info (for backward compatibility)
     */
    formatTradeDataSync(trades) {
        return trades.map(trade => ({
            // Core fields
            id: trade.id,
            userAddress: trade.user_address,
            proposalId: trade.proposal_id,
            poolId: trade.pool_id,

            // Trade details (using actual column names)
            amount0: trade.amount0,
            amount1: trade.amount1,
            token0: trade.token0,
            token1: trade.token1,

            // Determine trade type based on amounts
            tradeType: this.determineTradeType(trade),
            side: this.determineSide(trade),

            // Transaction info
            transactionHash: trade.evt_tx_hash,
            blockNumber: trade.evt_block_number,
            blockTime: trade.evt_block_time,
            createdAt: trade.created_at,

            // Formatted values for display
            timestampFormatted: trade.evt_block_time
                ? new Date(trade.evt_block_time).toISOString()
                : trade.created_at
                ? new Date(trade.created_at).toISOString()
                : null,
            amount0Formatted: this.formatAmount(trade.amount0),
            amount1Formatted: this.formatAmount(trade.amount1),

            // Calculate price if possible (amount1/amount0)
            price: trade.amount0 && trade.amount0 !== '0'
                ? Math.abs(parseFloat(trade.amount1) / parseFloat(trade.amount0))
                : null,
            priceFormatted: trade.amount0 && trade.amount0 !== '0'
                ? `$${Math.abs(parseFloat(trade.amount1) / parseFloat(trade.amount0)).toFixed(4)}`
                : 'N/A',

            // Use amount0 as primary amount for display
            amountFormatted: this.formatAmount(Math.abs(trade.amount0))
        }));
    }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create a TradeHistoryFetcher instance with Supabase client
 * @param {string} supabaseUrl - Supabase project URL
 * @param {string} supabaseKey - Supabase anon key
 * @param {object} options - Optional configuration
 * @param {string} options.rpcUrl - RPC URL for token info fetching
 * @param {number} options.chainId - Chain ID for token info fetching
 * @param {number} options.tokenCacheTimeout - Cache timeout in ms (default: 3600000)
 * @param {object} options.erc20Fetcher - Custom ERC20Fetcher instance
 */
function createTradeHistoryFetcher(supabaseUrl, supabaseKey, options = {}) {
    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase URL and key are required for TradeHistoryFetcher');
    }

    console.log('🔧 Creating Supabase client for trade history...');
    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    return new TradeHistoryFetcher(supabaseClient, options);
}

// =============================================================================
// EXPORTS
// =============================================================================

export { TradeHistoryFetcher, createTradeHistoryFetcher };