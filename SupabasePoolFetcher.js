// SupabasePoolFetcher.js - Simplified Supabase Pool Fetcher

import { createClient } from '@supabase/supabase-js';

// =============================================================================
// SUPABASE POOL FETCHER - Simple Standalone Class
// =============================================================================

class SupabasePoolFetcher {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
        this.name = 'SupabasePoolFetcher';
        
        console.log(`🔧 ${this.name} initialized`);
    }
    
    async fetch(operation, args = {}) {
        console.log(`📡 ${this.name} handling '${operation}' with args:`, args);
        
        switch (operation) {
            case 'pools.candle':
                return await this.fetchPoolCandles(args);
            case 'pools.info':
                return await this.fetchPoolInfo(args);
            case 'pools.volume':
                return await this.fetchPoolVolume(args);
            default:
            return { 
                status: "error", 
                    reason: `Operation '${operation}' not supported`,
                    supportedOperations: ['pools.candle', 'pools.info', 'pools.volume']
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