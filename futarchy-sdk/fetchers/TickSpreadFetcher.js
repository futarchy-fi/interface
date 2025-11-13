import { BaseFetcher } from '../DataLayer.js';
import { formatEther } from 'viem';

/**
 * TickSpreadFetcher - Fetches liquidity and volume data from TickSpread API
 * 
 * Provides real-time liquidity and trading volume information for pools
 */
class TickSpreadFetcher extends BaseFetcher {
    constructor(options = {}) {
        super();
        
        this.name = 'TickSpreadFetcher';
        this.baseUrl = options.baseUrl || 'https://stag.api.tickspread.com/api/v1';
        this.cache = new Map();
        this.cacheExpiry = options.cacheExpiry || 30000; // 30 seconds default
        
        // Register operations
        this.registerOperation('tickspread.liquidity', this.fetchLiquidity.bind(this));
        this.registerOperation('tickspread.volume', this.fetchVolume.bind(this));
        this.registerOperation('tickspread.poolStats', this.fetchPoolStats.bind(this));
        
        console.log(`🔧 ${this.name} initialized with base URL: ${this.baseUrl}`);
    }
    
    /**
     * Main fetch method that routes to appropriate operations
     */
    async fetch(dataPath, args = {}) {
        if (dataPath in this.operations) {
            try {
                return await this.operations[dataPath](args);
            } catch (error) {
                return {
                    status: "error",
                    reason: error.message,
                    source: this.name
                };
            }
        }
        
        return {
            status: "error",
            reason: `Operation ${dataPath} not supported by ${this.name}`,
            source: this.name
        };
    }
    
    /**
     * Fetch liquidity data for a pool
     */
    async fetchLiquidity(args) {
        const { poolId } = args;
        
        if (!poolId) {
            return {
                status: 'error',
                reason: 'Pool ID is required',
                source: this.name
            };
        }
        
        const cacheKey = `liquidity_${poolId}`;
        const cached = this.cache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
            return {
                status: 'success',
                data: cached.data,
                source: this.name,
                cached: true
            };
        }
        
        try {
            const url = `${this.baseUrl}/pools/liquidity?pool_id=${poolId}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Process the liquidity data
            const processedData = {
                token: data.token,
                amount: data.amount,
                formatted: data.amount?.toFixed(2),
                raw: data
            };
            
            // Cache the result
            this.cache.set(cacheKey, {
                data: processedData,
                timestamp: Date.now()
            });
            
            return {
                status: 'success',
                data: processedData,
                source: this.name
            };
            
        } catch (error) {
            // Silently handle 404s and other errors
            return {
                status: 'error',
                reason: error.message,
                source: this.name
            };
        }
    }
    
    /**
     * Fetch volume data for a pool
     */
    async fetchVolume(args) {
        const { poolId, period = '24h' } = args;
        
        if (!poolId) {
            return {
                status: 'error',
                reason: 'Pool ID is required',
                source: this.name
            };
        }
        
        const cacheKey = `volume_${poolId}_${period}`;
        const cached = this.cache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
            return {
                status: 'success',
                data: cached.data,
                source: this.name,
                cached: true
            };
        }
        
        try {
            const url = `${this.baseUrl}/pools/volume?pool_id=${poolId}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Process the volume data
            // Volume might be negative or in scientific notation, need to handle properly
            let volume = data.volume;
            
            // Convert to positive if negative (absolute value for display)
            if (volume < 0) {
                volume = Math.abs(volume);
            }
            
            // Format as wei and then to human readable (assuming 18 decimals for sDAI)
            const volumeWei = BigInt(Math.floor(volume));
            const volumeFormatted = formatEther(volumeWei);
            
            const processedData = {
                volume: volume,
                volumeWei: volumeWei.toString(),
                volumeFormatted: parseFloat(volumeFormatted).toFixed(2),
                volumeUSD: parseFloat(volumeFormatted).toFixed(2), // Assuming sDAI ≈ USD
                period: period,
                raw: data
            };
            
            // Cache the result
            this.cache.set(cacheKey, {
                data: processedData,
                timestamp: Date.now()
            });
            
            return {
                status: 'success',
                data: processedData,
                source: this.name
            };
            
        } catch (error) {
            // Silently handle 404s and other errors
            return {
                status: 'error',
                reason: error.message,
                source: this.name
            };
        }
    }
    
    /**
     * Fetch combined pool statistics (liquidity + volume)
     */
    async fetchPoolStats(args) {
        const { poolId } = args;
        
        if (!poolId) {
            return {
                status: 'error',
                reason: 'Pool ID is required',
                source: this.name
            };
        }
        
        try {
            // Fetch both liquidity and volume in parallel
            const [liquidityResult, volumeResult] = await Promise.all([
                this.fetchLiquidity({ poolId }),
                this.fetchVolume({ poolId })
            ]);
            
            if (liquidityResult.status !== 'success' || volumeResult.status !== 'success') {
                return {
                    status: 'error',
                    reason: 'Failed to fetch pool stats',
                    source: this.name
                };
            }
            
            const stats = {
                poolId: poolId,
                liquidity: liquidityResult.data,
                volume: volumeResult.data,
                summary: {
                    totalLiquidity: liquidityResult.data.formatted,
                    volume24h: volumeResult.data.volumeFormatted,
                    volumeUSD: volumeResult.data.volumeUSD
                }
            };
            
            return {
                status: 'success',
                data: stats,
                source: this.name
            };
            
        } catch (error) {
            // Silently handle errors
            return {
                status: 'error',
                reason: error.message,
                source: this.name
            };
        }
    }
    
    /**
     * Fetch stats for multiple pools
     */
    async fetchMultiplePoolStats(poolIds) {
        const results = await Promise.all(
            poolIds.map(poolId => this.fetchPoolStats({ poolId }))
        );
        
        const successfulResults = results.filter(r => r.status === 'success');
        const failedResults = results.filter(r => r.status === 'error');
        
        return {
            status: failedResults.length === 0 ? 'success' : 'partial',
            data: successfulResults.map(r => r.data),
            errors: failedResults,
            source: this.name
        };
    }
    
    /**
     * Clear the cache
     */
    clearCache() {
        this.cache.clear();
        console.log(`🧹 ${this.name} cache cleared`);
    }
}

/**
 * Factory function to create a TickSpreadFetcher instance
 */
export function createTickSpreadFetcher(options = {}) {
    return new TickSpreadFetcher(options);
}

export { TickSpreadFetcher };
export default TickSpreadFetcher;