// fetchers/SupabasePoolFetcher.js - Supabase Pool Fetcher Module

import { createClient } from '@supabase/supabase-js';
import { BaseFetcher } from '../DataLayer.js';

// =============================================================================
// SUPABASE POOL FETCHER - Pluggable Module
// =============================================================================

class SupabasePoolFetcher extends BaseFetcher {
    constructor(supabaseClient) {
        super();
        this.supabase = supabaseClient;
        this.name = 'SupabasePoolFetcher';
        
        // Register all operations this fetcher supports
        this.registerOperation('pools.candle', this.fetchPoolCandles.bind(this));
        this.registerOperation('pools.info', this.fetchPoolInfo.bind(this));
        this.registerOperation('pools.volume', this.fetchPoolVolume.bind(this));
        this.registerOperation('markets.events', this.fetchMarketEvents.bind(this));
        // Single market_event lookups
        this.registerOperation('markets.event', this.fetchMarketEventById.bind(this));
        this.registerOperation('markets.event.hero', this.fetchMarketEventHero.bind(this));
        
        console.log(`🔧 ${this.name} initialized with ${this.supportedOperations.length} operations`);
    }
    
    async fetch(dataPath, args = {}) {
        console.log(`📡 ${this.name} handling '${dataPath}' with args:`, args);
        
        if (dataPath in this.operations) {
            return await this.operations[dataPath](args);
        } else {
            return { 
                status: "error", 
                reason: `Operation '${dataPath}' not supported by ${this.name}`,
                supportedOperations: this.supportedOperations
            };
        }
    }
    
    async fetchPoolCandles(args) {
        const { id, interval = '3600000', limit = 10 } = args;
        
        console.log(`🔍 Querying Supabase for pool ${id} with interval ${interval}, limit ${limit}`);
        
        try {
            const { data: candlesData, error: candlesError } = await this.supabase
                .from('pool_candles')
                .select('timestamp, price')
                .eq('address', id)
                .eq('interval', interval)
                .order('timestamp', { ascending: false })
                .limit(limit);
                
            if (candlesError) {
                console.error(`❌ Supabase error:`, candlesError);
                return { 
                    status: "error", 
                    reason: candlesError.message,
                    source: this.name
                };
            }
            
            const candlesDataChrono = (candlesData || []).slice();
            
            console.log(`✅ Successfully fetched ${candlesDataChrono.length} candles from Supabase`);
            
            return {
                status: "success",
                data: candlesDataChrono,
                source: this.name,
                count: candlesDataChrono.length,
                timestamp: Date.now()
            };
        } catch (err) {
            console.error(`💥 Unexpected error:`, err);
            return {
                status: "error",
                reason: err.message,
                source: this.name
            };
        }
    }
    
    async fetchPoolInfo(args) {
        const { id } = args;
        
        console.log(`🔍 Fetching pool info for ${id}`);
        
        try {
            // This would query your pool_info table
            const { data, error } = await this.supabase
                .from('pools')
                .select('*')
                .eq('address', id)
                .single();
                
            if (error) {
                return { 
                    status: "error", 
                    reason: error.message,
                    source: this.name
                };
            }
            
            return { 
                status: "success", 
                data: data || { poolId: id, info: "Pool info not found" },
                source: this.name
            };
        } catch (err) {
            return {
                status: "error",
                reason: err.message,
                source: this.name
            };
        }
    }
    
    async fetchPoolVolume(args) {
        const { id, timeframe = '24h' } = args;
        
        console.log(`🔍 Fetching pool volume for ${id} (${timeframe})`);
        
        try {
            // Calculate volume for the timeframe
            const hoursAgo = timeframe === '24h' ? 24 : parseInt(timeframe);
            const since = Math.floor(Date.now() / 1000) - (hoursAgo * 3600);
            
            const { data, error } = await this.supabase
                .from('pool_candles')
                .select('timestamp')
                .eq('address', id)
                .gte('timestamp', since);
                
            if (error) {
                return { 
                    status: "error", 
                    reason: error.message,
                    source: this.name
                };
            }
            
            // Since volume column doesn't exist, return count of candles as volume indicator
            const totalVolume = data.length;
            
            return { 
                status: "success", 
                data: { 
                    poolId: id, 
                    timeframe, 
                    totalVolume,
                    candlesCount: data.length
                },
                source: this.name
            };
        } catch (err) {
            return {
                status: "error",
                reason: err.message,
                source: this.name
            };
        }
    }
    
    async fetchMarketEvents(args) {
        const { limit = 50, status = null, visibility = null } = args;
        
        console.log(`🏛️ Fetching market events from market_event table (limit: ${limit})`);
        
        try {
            let query = this.supabase
                .from('market_event')
                .select('*')
                .order('created_at', { ascending: false });
            
            // Apply filters if provided
            if (status) {
                query = query.eq('event_status', status);
            }
            
            if (visibility) {
                query = query.eq('visibility', visibility);
            }
            
            if (limit > 0) {
                query = query.limit(limit);
            }
            
            const { data, error } = await query;
            
            if (error) {
                console.error(`❌ Supabase error:`, error);
                return { 
                    status: "error", 
                    reason: error.message,
                    source: this.name
                };
            }
            
            console.log(`✅ Successfully fetched ${data?.length || 0} market events`);
            
            // Process and enhance the data
            const processedEvents = (data || []).map(event => ({
                ...event,
                // Extract key token addresses from metadata for easy access
                tokenAddresses: event.metadata ? {
                    proposalAddress: event.metadata.proposalAddress || event.id,
                    companyToken: event.metadata.companyTokens?.base?.wrappedCollateralTokenAddress,
                    currencyToken: event.metadata.currencyTokens?.base?.wrappedCollateralTokenAddress,
                    yesCompany: event.metadata.companyTokens?.yes?.wrappedCollateralTokenAddress,
                    noCompany: event.metadata.companyTokens?.no?.wrappedCollateralTokenAddress,
                    yesCurrency: event.metadata.currencyTokens?.yes?.wrappedCollateralTokenAddress,
                    noCurrency: event.metadata.currencyTokens?.no?.wrappedCollateralTokenAddress
                } : null,
                // Extract pool addresses
                poolAddresses: event.metadata ? {
                    yesPool: event.metadata.prediction_pools?.yes?.address,
                    noPool: event.metadata.prediction_pools?.no?.address,
                    yesConditional: event.metadata.conditional_pools?.yes?.address,
                    noConditional: event.metadata.conditional_pools?.no?.address
                } : null,
                // Quick summary
                summary: {
                    isResolved: event.resolution_status === 'resolved',
                    outcome: event.resolution_outcome,
                    isOpen: event.event_status === 'open',
                    isPending: event.approval_status === 'pending_review',
                    isVisible: event.visibility === 'public'
                }
            }));
            
            return {
                status: "success",
                data: processedEvents,
                source: this.name,
                count: processedEvents.length,
                timestamp: Date.now(),
                filters: { status, visibility, limit }
            };
            
        } catch (err) {
            console.error(`💥 Unexpected error:`, err);
            return {
                status: "error",
                reason: err.message,
                source: this.name
            };
        }
    }

    // Build a compact hero object from a market_event row
    buildHeroFromEvent(event) {
        const meta = event?.metadata || {};
        const displayTitle0 = meta.display_title_0
            || (meta.marketName || event?.title || '').split('?')[0]?.trim()
            || '';
        const displayTitle1 = meta.display_title_1
            || (meta.marketName || event?.title || '').split('?')[1]?.trim()
            || '';

        return {
            id: event?.id,
            endDate: event?.end_date || null,
            displayTitle0,
            displayTitle1,
            trackProgressLink: meta.trackProgressLink || null,
            questionLink: meta.questionLink || null,
            questionId: meta.questionId || event?.question_id || null,
            conditionId: meta.conditionId || event?.condition_id || null,
            chainId: meta.chain || 100,
            tokens: {
                company: {
                    base: meta.companyTokens?.base?.wrappedCollateralTokenAddress || null,
                    yes: meta.companyTokens?.yes?.wrappedCollateralTokenAddress || null,
                    no: meta.companyTokens?.no?.wrappedCollateralTokenAddress || null
                },
                currency: {
                    base: meta.currencyTokens?.base?.wrappedCollateralTokenAddress || null,
                    yes: meta.currencyTokens?.yes?.wrappedCollateralTokenAddress || null,
                    no: meta.currencyTokens?.no?.wrappedCollateralTokenAddress || null
                }
            }
        };
    }

    // Fetch a single market_event by id
    async fetchMarketEventById(args) {
        const { id } = args;
        if (!id) {
            return {
                status: "error",
                reason: "Missing required 'id' argument",
                source: this.name
            };
        }

        try {
            const { data, error } = await this.supabase
                .from('market_event')
                .select('*')
                .eq('id', id)
                .single();

            if (error) {
                return {
                    status: "error",
                    reason: error.message,
                    source: this.name
                };
            }

            const enhanced = data ? {
                ...data,
                tokenAddresses: data.metadata ? {
                    proposalAddress: data.metadata.proposalAddress || data.id,
                    companyToken: data.metadata.companyTokens?.base?.wrappedCollateralTokenAddress,
                    currencyToken: data.metadata.currencyTokens?.base?.wrappedCollateralTokenAddress,
                    yesCompany: data.metadata.companyTokens?.yes?.wrappedCollateralTokenAddress,
                    noCompany: data.metadata.companyTokens?.no?.wrappedCollateralTokenAddress,
                    yesCurrency: data.metadata.currencyTokens?.yes?.wrappedCollateralTokenAddress,
                    noCurrency: data.metadata.currencyTokens?.no?.wrappedCollateralTokenAddress
                } : null,
                poolAddresses: data.metadata ? {
                    yesPool: data.metadata.prediction_pools?.yes?.address,
                    noPool: data.metadata.prediction_pools?.no?.address,
                    yesConditional: data.metadata.conditional_pools?.yes?.address,
                    noConditional: data.metadata.conditional_pools?.no?.address
                } : null,
                summary: {
                    isResolved: data.resolution_status === 'resolved',
                    outcome: data.resolution_outcome,
                    isOpen: data.event_status === 'open',
                    isPending: data.approval_status === 'pending_review',
                    isVisible: data.visibility === 'public'
                }
            } : null;

            return {
                status: "success",
                data: enhanced,
                hero: enhanced ? this.buildHeroFromEvent(enhanced) : null,
                source: this.name
            };
        } catch (err) {
            return {
                status: "error",
                reason: err.message,
                source: this.name
            };
        }
    }

    // Convenience wrapper to return only the hero payload
    async fetchMarketEventHero(args) {
        const res = await this.fetchMarketEventById(args);
        if (res.status !== 'success') return res;
        return {
            status: 'success',
            data: res.hero,
            source: this.name
        };
    }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

export function createSupabasePoolFetcher(supabaseUrl, supabaseKey) {
    console.log(`🔧 Creating Supabase client for pool operations...`);
    const supabaseClient = createClient(supabaseUrl, supabaseKey);
    return new SupabasePoolFetcher(supabaseClient);
}

// =============================================================================
// EXPORTS
// =============================================================================

export { SupabasePoolFetcher }; 