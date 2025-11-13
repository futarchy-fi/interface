import { createClient } from '@supabase/supabase-js';
import { BaseFetcher } from '../DataLayer.js';

class MarketEventsFetcher extends BaseFetcher {
    constructor(options = {}) {
        // Initialize BaseFetcher with operations
        const operations = {
            'market.events': async (params) => await this.fetchMarketEvents(params),
            'market.active': async () => await this.fetchActiveProposals(),
            'market.proposal': async (params) => await this.fetchProposalById(params.proposalId),
            'market.choices': async (params) => await this.getProposalChoices(params.includeCustom),
            'market.eventsWithPrices': async (params) => await this.fetchMarketEventsWithPrices(params)
        };
        
        super(operations);
        
        // Try environment variables first, then use the market_events API
        this.supabaseUrl = options.supabaseUrl || process.env.SUPABASE_URL || 'https://nvhqdqtlsdboctqjcelq.supabase.co';
        this.supabaseKey = options.supabaseKey || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52aHFkcXRsc2Rib2N0cWpjZWxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIxNDU3ODEsImV4cCI6MjA1NzcyMTc4MX0.6kjpxGVqSQNMz3DqycuNPv_ug8sdBNKeJsN0Z3X7oLg';
        
        this.supabase = createClient(this.supabaseUrl, this.supabaseKey);
        this.cache = new Map();
        this.cacheExpiry = options.cacheExpiry || 60000; // 1 minute default
    }

    async fetchMarketEvents(filters = {}) {
        const cacheKey = JSON.stringify(filters);
        const cached = this.cache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
            return cached.data;
        }

        try {
            let query = this.supabase
                .from('market_event')
                .select('*')
                .order('created_at', { ascending: false });

            // Apply filters
            if (filters.companyId) {
                query = query.eq('company_id', filters.companyId);
            }
            if (filters.eventStatus) {
                query = query.eq('event_status', filters.eventStatus);
            }
            if (filters.visibility) {
                query = query.eq('visibility', filters.visibility);
            }
            if (filters.limit) {
                query = query.limit(filters.limit);
            } else {
                // Default to 100 if no limit specified
                query = query.limit(100);
            }

            const { data, error } = await query;

            if (error) {
                throw new Error(`Supabase query failed: ${error.message}`);
            }

            // Cache the result
            this.cache.set(cacheKey, {
                data,
                timestamp: Date.now()
            });

            return data;
        } catch (error) {
            console.error('Error fetching market events:', error);
            throw error;
        }
    }

    async fetchProposalById(proposalId) {
        const cacheKey = `proposal-${proposalId}`;
        const cached = this.cache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
            return cached.data;
        }

        try {
            const { data, error } = await this.supabase
                .from('market_event')
                .select('*')
                .eq('id', proposalId)
                .single();

            if (error) {
                throw new Error(`Failed to fetch proposal: ${error.message}`);
            }

            this.cache.set(cacheKey, {
                data,
                timestamp: Date.now()
            });

            return data;
        } catch (error) {
            console.error('Error fetching proposal:', error);
            throw error;
        }
    }

    async fetchActiveProposals(includeAll = false) {
        if (includeAll) {
            // Show ALL proposals with NO filters at all
            return this.fetchMarketEvents({});
        }
        
        // Default: show open proposals (both public and private/test)
        return this.fetchMarketEvents({
            eventStatus: 'open'
        });
    }

    formatPrice(price, metadata = {}) {
        if (price === null || price === undefined) return 'N/A';
        
        // Determine precision based on metadata or price magnitude
        let precision = metadata?.precision || metadata?.pricePrecision;
        
        if (!precision) {
            // Auto-determine precision based on price magnitude
            if (price < 0.01) {
                precision = 6;  // Very small prices need more decimals
            } else if (price < 1) {
                precision = 4;  // Small prices
            } else if (price < 100) {
                precision = 2;  // Normal prices
            } else {
                precision = 0;  // Large prices don't need decimals
            }
        }
        
        return `$${price.toFixed(precision)}`;
    }

    formatProposalForDisplay(proposal) {
        const endDate = new Date(proposal.end_date);
        const now = new Date();
        const daysRemaining = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
        
        return {
            id: proposal.id,
            title: proposal.title.substring(0, 80) + (proposal.title.length > 80 ? '...' : ''),
            tokens: proposal.tokens,
            status: proposal.approval_status,
            daysRemaining: daysRemaining > 0 ? daysRemaining : 'Ended',
            approvalPrice: proposal.approval_price,
            refusalPrice: proposal.refusal_price,
            visibility: proposal.visibility,
            companyTokens: proposal.metadata?.companyTokens,
            currencyTokens: proposal.metadata?.currencyTokens,
            pools: {
                yes: proposal.pool_yes,
                no: proposal.pool_no
            },
            conditionId: proposal.condition_id,
            questionId: proposal.question_id
        };
    }

    async fetchLatestCandlePrice(poolAddress, interval = '3600000') {
        if (!poolAddress) return null;
        
        try {
            const { data, error } = await this.supabase
                .from('pool_candles')
                .select('timestamp, price')
                .eq('address', poolAddress)
                .eq('interval', interval)
                .order('timestamp', { ascending: false })
                .limit(1);
            
            if (error || !data || data.length === 0) {
                return null;
            }
            
            return data[0].price;
        } catch (error) {
            console.error(`Error fetching candle price for ${poolAddress}:`, error);
            return null;
        }
    }
    
    async fetchMarketEventsWithPrices(filters = {}) {
        // First fetch the market events
        const events = await this.fetchMarketEvents(filters);
        
        // Then fetch latest prices for each event's conditional pools
        const eventsWithPrices = await Promise.all(events.map(async (event) => {
            let yesPrice = null;
            let noPrice = null;
            
            // Try to get prices from conditional pools
            if (event.metadata?.conditional_pools) {
                const yesPoolAddress = event.metadata.conditional_pools.yes?.address;
                const noPoolAddress = event.metadata.conditional_pools.no?.address;
                
                [yesPrice, noPrice] = await Promise.all([
                    this.fetchLatestCandlePrice(yesPoolAddress),
                    this.fetchLatestCandlePrice(noPoolAddress)
                ]);
            }
            
            // If no conditional pool prices, try prediction pools
            if ((yesPrice === null || noPrice === null) && event.metadata?.prediction_pools) {
                const yesPredAddress = event.metadata.prediction_pools.yes?.address;
                const noPredAddress = event.metadata.prediction_pools.no?.address;
                
                const [yesPredPrice, noPredPrice] = await Promise.all([
                    yesPrice === null ? this.fetchLatestCandlePrice(yesPredAddress) : Promise.resolve(yesPrice),
                    noPrice === null ? this.fetchLatestCandlePrice(noPredAddress) : Promise.resolve(noPrice)
                ]);
                
                yesPrice = yesPrice || yesPredPrice;
                noPrice = noPrice || noPredPrice;
            }
            
            return {
                ...event,
                latestPrices: {
                    yes: yesPrice,
                    no: noPrice
                }
            };
        }));
        
        return eventsWithPrices;
    }

    async getProposalChoices(includeCustom = true, includeAll = false, includePrices = true) {
        // Fetch proposals with prices if requested
        const proposals = includePrices 
            ? await this.fetchMarketEventsWithPrices({ eventStatus: includeAll ? undefined : 'open' })
            : await this.fetchActiveProposals(includeAll);
        
        const choices = proposals.map(p => {
            const formatted = this.formatProposalForDisplay(p);
            const statusEmoji = p.event_status === 'open' ? '🟢' : 
                               p.event_status === 'resolved' ? '✅' : '⏸️';
            const visibilityBadge = p.visibility === 'public' ? '' : 
                                    p.visibility === 'test' ? ' [TEST]' : 
                                    p.visibility === 'private' ? ' [PRIVATE]' : '';
            const days = formatted.daysRemaining === 'Ended' ? '⏰ Ended' : 
                        `📅 ${formatted.daysRemaining} days`;
            
            // Show first 6 chars of address (0x + 4 chars) and last 3 chars
            const shortAddress = p.id ? 
                `${p.id.substring(0, 6)}...${p.id.substring(p.id.length - 3)}` : 
                'unknown';
            
            // Format prices if available
            let priceInfo = '';
            if (p.latestPrices && (p.latestPrices.yes || p.latestPrices.no)) {
                // Use the formatPrice method for consistent formatting
                const yesPrice = p.latestPrices.yes !== null 
                    ? `Y:${this.formatPrice(p.latestPrices.yes, p.metadata)}` 
                    : 'Y:N/A';
                const noPrice = p.latestPrices.no !== null 
                    ? `N:${this.formatPrice(p.latestPrices.no, p.metadata)}` 
                    : 'N:N/A';
                priceInfo = ` | 💰 ${yesPrice} ${noPrice}`;
            }
            
            return {
                name: `${statusEmoji} [${shortAddress}] ${formatted.title.substring(0, 50)}${visibilityBadge} | ${days}${priceInfo}`,
                value: p,
                short: `${shortAddress} - ${formatted.title.substring(0, 40)}`
            };
        });

        if (includeCustom) {
            choices.push({
                name: '📝 Enter custom proposal address',
                value: 'custom',
                short: 'Custom'
            });
        }

        return choices;
    }

    clearCache() {
        this.cache.clear();
    }
}

export default MarketEventsFetcher;