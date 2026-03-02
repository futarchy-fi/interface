// TradeHistoryCartridge.js - Trade History Formatting Cartridge

class TradeHistoryCartridge {
    constructor(dataLayer) {
        this.name = 'TradeHistoryCartridge';
        this.version = '1.0.0';
        this.dataLayer = dataLayer;
        this.supportedOperations = [
            'trades.formatted',
            'trades.summary'
        ];
        this.metadata = null; // Store metadata for token identification
        this.tokenTypeCache = new Map(); // Cache token type lookups
    }

    // Set metadata from config
    setMetadata(metadata) {
        this.metadata = metadata;
        console.log('[TradeHistoryCartridge] Metadata set:', metadata);

        // Build token type cache from metadata
        if (metadata) {
            if (metadata.companyTokens) {
                const { yes, no, base } = metadata.companyTokens;
                if (yes?.wrappedCollateralTokenAddress) {
                    this.tokenTypeCache.set(yes.wrappedCollateralTokenAddress.toLowerCase(), 'company');
                }
                if (no?.wrappedCollateralTokenAddress) {
                    this.tokenTypeCache.set(no.wrappedCollateralTokenAddress.toLowerCase(), 'company');
                }
                if (base?.wrappedCollateralTokenAddress) {
                    this.tokenTypeCache.set(base.wrappedCollateralTokenAddress.toLowerCase(), 'base');
                }
            }
            if (metadata.currencyTokens) {
                const { yes, no, base } = metadata.currencyTokens;
                if (yes?.wrappedCollateralTokenAddress) {
                    this.tokenTypeCache.set(yes.wrappedCollateralTokenAddress.toLowerCase(), 'currency');
                }
                if (no?.wrappedCollateralTokenAddress) {
                    this.tokenTypeCache.set(no.wrappedCollateralTokenAddress.toLowerCase(), 'currency');
                }
                if (base?.wrappedCollateralTokenAddress) {
                    this.tokenTypeCache.set(base.wrappedCollateralTokenAddress.toLowerCase(), 'base');
                }
            }
        }

        console.log('[TradeHistoryCartridge] Token type cache built:', Object.fromEntries(this.tokenTypeCache));
    }

    // Get token type from cache
    getTokenType(tokenAddress) {
        if (!tokenAddress) return null;
        return this.tokenTypeCache.get(tokenAddress.toLowerCase()) || null;
    }

    getAvailableOperations() {
        return this.supportedOperations;
    }

    async* execute(operation, args) {
        console.log(`🎯 TradeHistoryCartridge executing: ${operation}`);

        yield { status: 'processing', message: `Starting ${operation}...` };

        try {
            let result;
            switch (operation) {
                case 'trades.formatted':
                    result = await this.getFormattedTrades(args, this.dataLayer);
                    break;
                case 'trades.summary':
                    result = await this.getTradeSummary(args, this.dataLayer);
                    break;
                default:
                    yield { status: 'error', message: `Unknown operation: ${operation}` };
                    return;
            }

            yield {
                status: 'success',
                data: result
            };
        } catch (error) {
            yield {
                status: 'error',
                message: error.message
            };
        }
    }

    async getFormattedTrades(args, dataLayer) {
        try {
            // Fetch raw trade data using the TradeHistoryFetcher
            const rawTrades = await dataLayer.fetch('trades.history', args);

            console.log('🔍 TradeHistoryCartridge: Raw trades response:', {
                hasRawTrades: !!rawTrades,
                status: rawTrades?.status,
                hasData: !!rawTrades?.data,
                hasTrades: !!rawTrades?.trades,
                dataLength: rawTrades?.data?.length,
                tradesLength: rawTrades?.trades?.length,
                count: rawTrades?.count
            });

            // The fetcher returns { status, data, count, ... }
            // where 'data' is the array of trades
            if (!rawTrades || rawTrades.status === 'error') {
                console.error('❌ TradeHistoryCartridge: Error in raw trades:', rawTrades?.reason);
                return { trades: [], count: 0 };
            }

            // Get the trades array - fetcher returns it in .data, not .trades
            const tradesArray = rawTrades.data || rawTrades.trades || [];

            if (tradesArray.length === 0) {
                console.log('📭 TradeHistoryCartridge: No trades found');
                return { trades: [], count: 0 };
            }

            console.log(`✅ TradeHistoryCartridge: Processing ${tradesArray.length} trades`);

            // Format each trade according to the specified structure
            const formattedTrades = tradesArray.map(trade => this.formatTrade(trade));

            return {
                trades: formattedTrades,
                count: formattedTrades.length,
                summary: this.generateSummary(formattedTrades)
            };
        } catch (error) {
            console.error('❌ Error formatting trades:', error);
            console.error('Error stack:', error.stack);
            throw error;
        }
    }

    formatTrade(trade) {
        // Get fetcher's token cache if available
        const fetcher = this.dataLayer?.fetchers?.get('trades.history');

        // Create token objects from fetcher format
        // Fetcher returns: token0 (address), token0Symbol, token0Name
        // For realtime trades, we need to fetch from cache
        let token0Symbol = trade.token0Symbol;
        let token0Name = trade.token0Name;
        let token1Symbol = trade.token1Symbol;
        let token1Name = trade.token1Name;

        // If symbols are missing, try to get from fetcher's token cache
        if (!token0Symbol && fetcher?.tokenCache && trade.token0) {
            const cached = fetcher.tokenCache.get(trade.token0.toLowerCase());
            if (cached?.data) {
                token0Symbol = cached.data.symbol;
                token0Name = cached.data.name;
                console.log('[TradeHistoryCartridge] Got token0 from cache:', { address: trade.token0, symbol: token0Symbol });
            }
        }

        if (!token1Symbol && fetcher?.tokenCache && trade.token1) {
            const cached = fetcher.tokenCache.get(trade.token1.toLowerCase());
            if (cached?.data) {
                token1Symbol = cached.data.symbol;
                token1Name = cached.data.name;
                console.log('[TradeHistoryCartridge] Got token1 from cache:', { address: trade.token1, symbol: token1Symbol });
            }
        }

        const token0Obj = {
            address: trade.token0,
            symbol: token0Symbol || trade.token0?.substring(0, 8) + '...',
            name: token0Name || 'Token'
        };

        const token1Obj = {
            address: trade.token1,
            symbol: token1Symbol || trade.token1?.substring(0, 8) + '...',
            name: token1Name || 'Token'
        };

        // amount0 > 0 means receiving token0, amount0 < 0 means giving token0
        const amount0 = parseFloat(trade.amount0);
        const amount1 = parseFloat(trade.amount1);

        // Determine which token is IN and which is OUT from USER's perspective
        // IN = what you're receiving (into your pocket)
        // OUT = what you're giving (out of your pocket)
        let tokenIn, tokenOut, amountIn, amountOut;

        if (amount0 > 0) {
            // Receiving token0, giving token1
            // USER perspective: token0 comes IN (to you), token1 goes OUT (from you)
            tokenIn = token0Obj;
            tokenOut = token1Obj;
            amountIn = Math.abs(amount0);
            amountOut = Math.abs(amount1);
        } else {
            // Giving token0, receiving token1
            // USER perspective: token1 comes IN (to you), token0 goes OUT (from you)
            tokenIn = token1Obj;
            tokenOut = token0Obj;
            amountIn = Math.abs(amount1);
            amountOut = Math.abs(amount0);
        }

        // Get token types from metadata cache (if available)
        const token0Type = this.getTokenType(token0Obj.address);
        const token1Type = this.getTokenType(token1Obj.address);

        // Now tokenIN is what you're RECEIVING (into pocket)
        // tokenOUT is what you're GIVING (out of pocket)
        const tokenInType = this.getTokenType(tokenIn.address);
        const tokenOutType = this.getTokenType(tokenOut.address);

        console.log('[TradeHistoryCartridge] Trade analysis:', {
            tokenIN: { symbol: tokenIn.symbol, address: tokenIn.address, type: tokenInType, amount: amountIn },
            tokenOUT: { symbol: tokenOut.symbol, address: tokenOut.address, type: tokenOutType, amount: amountOut },
            userPerspective: 'IN = receiving, OUT = giving'
        });

        // Buy/Sell logic from USER perspective:
        // BUY = receiving (IN) company/conditional tokens, giving (OUT) currency/base tokens
        // SELL = giving (OUT) company/conditional tokens, receiving (IN) currency/base tokens
        let isBuy;

        if (tokenInType === 'company' || tokenOutType === 'company') {
            // Company/Currency pair
            // Receiving company IN = BUY
            // Giving company OUT = SELL
            isBuy = (tokenInType === 'company');
        } else if (tokenInType === 'base' || tokenOutType === 'base') {
            // Base/Conditional pair
            // Receiving conditional IN (giving base OUT) = BUY
            // Giving conditional OUT (receiving base IN) = SELL
            isBuy = (tokenInType !== 'base');
        } else if (tokenInType === 'currency' || tokenOutType === 'currency') {
            // Currency/Conditional pair
            // Receiving conditional IN (giving currency OUT) = BUY
            // Giving conditional OUT (receiving currency IN) = SELL
            isBuy = (tokenInType !== 'currency');
        } else {
            // Fallback: use symbol-based detection
            const tokenInSymbol = tokenIn.symbol?.toUpperCase() || '';
            const tokenOutSymbol = tokenOut.symbol?.toUpperCase() || '';

            const tokenInIsConditional = /^(YES|NO)[_\s-]/.test(tokenInSymbol);

            // If receiving conditional token = BUY
            isBuy = tokenInIsConditional;
        }

        console.log('[TradeHistoryCartridge] Buy/Sell determination:', {
            isBuy: isBuy ? 'BUY' : 'SELL',
            reason: `Receiving ${tokenIn.symbol} (${tokenInType || 'unknown'}), Giving ${tokenOut.symbol} (${tokenOutType || 'unknown'})`
        });

        // Format amounts from 18 decimals
        const formattedAmountIn = this.formatAmount(amountIn);
        const formattedAmountOut = this.formatAmount(amountOut);

        // Calculate price based on token types
        // For company/currency pairs: price = company token / currency token
        // For base token pairs (e.g., YES_USDS/USDS): price = how much base token is worth the conditional token
        // Example: YES_USDS/USDS = 0.5 means 1 USDS is worth 0.5 YES_USDS
        const price = this.calculatePrice(tokenIn, tokenOut, formattedAmountIn, formattedAmountOut);

        // Determine outcome from token symbols
        const outcome = this.determineOutcome(tokenIn, tokenOut);

        // Build transaction link based on chain
        const transactionLink = this.getTransactionLink(
            trade.transactionHash || trade.evt_tx_hash,
            trade.chain || 'gnosis'
        );

        // Get timestamp from various possible fields
        const timestamp = trade.timestamp || trade.blockTime || trade.evt_block_time || trade.createdAt || trade.created_at;

        return {
            outcome: {
                eventSide: outcome.eventSide,
                operationSide: isBuy ? 'buy' : 'sell'
            },
            amount: {
                tokenIN: {
                    symbol: tokenIn.symbol || tokenIn.address?.substring(0, 8) + '...',
                    value: formattedAmountIn.toFixed(6),
                    address: tokenIn.address
                },
                tokenOUT: {
                    symbol: tokenOut.symbol || tokenOut.address?.substring(0, 8) + '...',
                    value: formattedAmountOut.toFixed(6),
                    address: tokenOut.address
                }
            },
            price: price.toFixed(4),
            date: timestamp ? new Date(timestamp).getTime() : Date.now(),
            transactionLink: transactionLink,
            poolAddress: trade.poolAddress || trade.pool_id,
            blockNumber: trade.blockNumber || trade.evt_block_number,
            userAddress: trade.user_address || trade.userAddress // Include user address for filtering
        };
    }

    formatAmount(amount) {
        // Convert from raw amount (18 decimals) to human-readable format
        // If amount is already a string with scientific notation, parse it
        if (typeof amount === 'string' && amount.includes('e')) {
            return parseFloat(amount);
        }

        // Otherwise, divide by 10^18
        return amount / Math.pow(10, 18);
    }

    calculatePrice(tokenIn, tokenOut, amountIn, amountOut) {
        // Get token types from metadata cache (if available)
        const tokenInType = this.getTokenType(tokenIn.address);
        const tokenOutType = this.getTokenType(tokenOut.address);

        // Identify token types based on metadata first, then fall back to symbol detection
        let isTokenInConditional, isTokenOutConditional, isTokenInBase, isTokenOutBase;

        if (tokenInType && tokenOutType) {
            // Use metadata to determine token types
            isTokenInConditional = (tokenInType === 'currency' || tokenInType === 'company');
            isTokenOutConditional = (tokenOutType === 'currency' || tokenOutType === 'company');
            isTokenInBase = (tokenInType === 'base');
            isTokenOutBase = (tokenOutType === 'base');
        } else {
            // Fall back to symbol-based detection
            isTokenInConditional = /^(YES|NO)[_\s-]/.test(tokenIn.symbol?.toUpperCase() || '');
            isTokenOutConditional = /^(YES|NO)[_\s-]/.test(tokenOut.symbol?.toUpperCase() || '');
            isTokenInBase = !isTokenInConditional && tokenIn.symbol?.toUpperCase().includes('USD');
            isTokenOutBase = !isTokenOutConditional && tokenOut.symbol?.toUpperCase().includes('USD');
        }

        console.log('[TradeHistoryCartridge] calculatePrice:', {
            tokenIn: { symbol: tokenIn.symbol, type: tokenInType, isConditional: isTokenInConditional, isBase: isTokenInBase },
            tokenOut: { symbol: tokenOut.symbol, type: tokenOutType, isConditional: isTokenOutConditional, isBase: isTokenOutBase },
            amountIn,
            amountOut
        });

        // Case 1: Both are conditional tokens (company/currency pair)
        // CRITICAL: For conditional pools, price should ALWAYS be "currency per company token"
        // Example: If trading NO_sDAI ↔ NO_PNK, show how much sDAI (currency) per 1 PNK (company)
        // This shows "how much does 1 company token cost in currency"
        if (isTokenInConditional && isTokenOutConditional) {
            // Use metadata to properly identify company vs currency tokens
            const tokenInIsCompany = tokenInType === 'company';
            const tokenOutIsCompany = tokenOutType === 'company';

            console.log('[TradeHistoryCartridge] Company/Currency pair detected:', {
                tokenIn: { symbol: tokenIn.symbol, type: tokenInType, isCompany: tokenInIsCompany },
                tokenOut: { symbol: tokenOut.symbol, type: tokenOutType, isCompany: tokenOutIsCompany }
            });

            if (tokenInIsCompany && !tokenOutIsCompany) {
                // tokenIn is company, tokenOut is currency
                // Price = currency amount / company amount
                const price = amountOut / amountIn;
                console.log('[TradeHistoryCartridge] Company IN, Currency OUT → price (currency/company) =', price);
                return price;
            } else if (tokenOutIsCompany && !tokenInIsCompany) {
                // tokenOut is company, tokenIn is currency
                // Price = currency amount / company amount
                const price = amountIn / amountOut;
                console.log('[TradeHistoryCartridge] Currency IN, Company OUT → price (currency/company) =', price);
                return price;
            }

            // Fallback: try to detect by symbol if metadata doesn't help
            const tokenInHasCompany = tokenIn.symbol?.includes('TSLAon') || tokenIn.symbol?.includes('GNO') || tokenIn.symbol?.includes('PNK');
            const tokenOutHasCompany = tokenOut.symbol?.includes('TSLAon') || tokenOut.symbol?.includes('GNO') || tokenOut.symbol?.includes('PNK');

            if (tokenOutHasCompany && !tokenInHasCompany) {
                // tokenOut is company, tokenIn is currency: price = amountIn / amountOut
                const price = amountIn / amountOut;
                console.log('[TradeHistoryCartridge] Symbol-based: Currency IN, Company OUT → price (currency/company) =', price);
                return price;
            } else if (tokenInHasCompany && !tokenOutHasCompany) {
                // tokenIn is company, tokenOut is currency: price = amountOut / amountIn
                const price = amountOut / amountIn;
                console.log('[TradeHistoryCartridge] Symbol-based: Company IN, Currency OUT → price (currency/company) =', price);
                return price;
            }
        }

        // Case 2: Conditional token vs base token (PREDICTION MARKET)
        // CRITICAL: Price must ALWAYS be "base per conditional" (e.g., $0.50 means 1 YES = $0.50)
        // This ensures prices match the pool probability display (50% = $0.50)
        if (isTokenInConditional && isTokenOutBase) {
            // User receives conditional IN, gives base OUT
            // Example: Buying YES - receive 7.96 YES, give 4 USDS
            // Price = base given / conditional received = 4 / 7.96 = 0.5024
            const price = amountOut / amountIn;
            console.log('[TradeHistoryCartridge] Conditional IN, Base OUT → price = amountOut / amountIn =', price);
            return price;
        } else if (isTokenInBase && isTokenOutConditional) {
            // User receives base IN, gives conditional OUT
            // Example: Selling YES - receive 4 USDS, give 7.96 YES
            // Price = base received / conditional given = 4 / 7.96 = 0.5024
            const price = amountIn / amountOut;
            console.log('[TradeHistoryCartridge] Base IN, Conditional OUT → price = amountIn / amountOut =', price);
            return price;
        }

        // Default: tokenOut per tokenIn (standard calculation)
        const price = amountOut / amountIn;
        console.log('[TradeHistoryCartridge] Default calculation → price = amountOut / amountIn =', price);
        return price;
    }

    determineOutcome(tokenIn, tokenOut) {
        // Check both tokens for YES/NO patterns
        const checkToken = (token) => {
            if (!token || !token.symbol) return null;
            const symbol = token.symbol.toUpperCase();

            if (/^YES[_\s-]|^YES$|YES[_\s-]/.test(symbol)) return 'yes';
            if (/^NO[_\s-]|^NO$|NO[_\s-]/.test(symbol)) return 'no';
            return null;
        };

        const inOutcome = checkToken(tokenIn);
        const outOutcome = checkToken(tokenOut);

        // Determine dominant outcome
        const eventSide = inOutcome || outOutcome || 'neutral';

        return {
            eventSide: eventSide,
            tokenInSide: inOutcome,
            tokenOutSide: outOutcome
        };
    }

    getTransactionLink(txHash, chain = 'gnosis') {
        if (!txHash) return null;

        // Remove log index suffix if present (e.g., "_121" from "0xabc...def_121")
        const actualTxHash = txHash.split('_')[0];

        // Map chainId to chain name
        const chainIdMap = {
            1: 'ethereum',
            100: 'gnosis',
            137: 'polygon',
            42161: 'arbitrum',
            10: 'optimism'
        };

        // If chain is a number (chainId), convert to chain name
        const chainName = typeof chain === 'number' ? (chainIdMap[chain] || 'gnosis') : chain;

        const explorers = {
            'gnosis': 'https://gnosisscan.io/tx/',
            'ethereum': 'https://etherscan.io/tx/',
            'polygon': 'https://polygonscan.com/tx/',
            'arbitrum': 'https://arbiscan.io/tx/',
            'optimism': 'https://optimistic.etherscan.io/tx/'
        };

        const baseUrl = explorers[chainName] || explorers['gnosis'];
        return `${baseUrl}${actualTxHash}`;
    }

    generateSummary(formattedTrades) {
        if (!formattedTrades || formattedTrades.length === 0) {
            return {
                totalTrades: 0,
                outcomes: { yes: 0, no: 0, neutral: 0 },
                operations: { buy: 0, sell: 0 }
            };
        }

        const summary = {
            totalTrades: formattedTrades.length,
            outcomes: {
                yes: 0,
                no: 0,
                neutral: 0
            },
            operations: {
                buy: 0,
                sell: 0
            },
            dateRange: {
                start: null,
                end: null
            },
            uniqueTokens: new Set(),
            uniquePools: new Set()
        };

        formattedTrades.forEach(trade => {
            // Count outcomes
            summary.outcomes[trade.outcome.eventSide]++;

            // Count operations
            summary.operations[trade.outcome.operationSide]++;

            // Track date range
            if (!summary.dateRange.start || trade.date < summary.dateRange.start) {
                summary.dateRange.start = trade.date;
            }
            if (!summary.dateRange.end || trade.date > summary.dateRange.end) {
                summary.dateRange.end = trade.date;
            }

            // Track unique tokens and pools
            summary.uniqueTokens.add(trade.amount.tokenIN.symbol);
            summary.uniqueTokens.add(trade.amount.tokenOUT.symbol);
            summary.uniquePools.add(trade.poolAddress);
        });

        // Convert sets to arrays for JSON serialization
        summary.uniqueTokens = Array.from(summary.uniqueTokens);
        summary.uniquePools = Array.from(summary.uniquePools);

        return summary;
    }

    async getTradeSummary(args, dataLayer) {
        const formattedData = await this.getFormattedTrades(args, dataLayer);
        return formattedData.summary;
    }
}

export default TradeHistoryCartridge;