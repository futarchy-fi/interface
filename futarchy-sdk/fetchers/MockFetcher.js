// fetchers/MockFetcher.js - Mock Fetcher Module for Testing

import { BaseFetcher } from '../DataLayer.js';

// =============================================================================
// MOCK FETCHER - For Testing and Development
// =============================================================================

class MockFetcher extends BaseFetcher {
    constructor() {
        super();
        this.name = 'MockFetcher';
        
        // Register operations this fetcher supports
        this.registerOperation('pools.candle', this.mockPoolCandles.bind(this));
        this.registerOperation('pools.info', this.mockPoolInfo.bind(this));
        this.registerOperation('user.profile', this.mockUserProfile.bind(this));
        this.registerOperation('market.stats', this.mockMarketStats.bind(this));
        
        console.log(`🔧 ${this.name} initialized with ${this.supportedOperations.length} operations`);
    }
    
    async fetch(dataPath, args = {}) {
        console.log(`📡 ${this.name} handling '${dataPath}' with args:`, args);
        
        if (dataPath in this.operations) {
            // Simulate network delay
            await this.delay(100 + Math.random() * 200);
            return await this.operations[dataPath](args);
        } else {
            return { 
                status: "error", 
                reason: `Operation '${dataPath}' not supported by ${this.name}`,
                supportedOperations: this.supportedOperations
            };
        }
    }
    
    async mockPoolCandles(args) {
        const { id, interval = '3600000', limit = 10 } = args;
        
        console.log(`🎭 Generating mock candles for pool ${id}`);
        
        const candles = [];
        const now = Math.floor(Date.now() / 1000);
        const intervalSeconds = parseInt(interval) / 1000;
        
        for (let i = 0; i < limit; i++) {
            const timestamp = now - (i * intervalSeconds);
            const basePrice = 0.45;
            const price = basePrice + (Math.random() - 0.5) * 0.1;
            const volume = Math.random() * 1000;
            
            candles.push({
                timestamp,
                price: Math.round(price * 10000) / 10000,
                volume: Math.round(volume * 100) / 100,
                address: id,
                interval
            });
        }
        
        return {
            status: "success",
            data: candles,
            source: this.name,
            count: candles.length,
            timestamp: Date.now()
        };
    }
    
    async mockPoolInfo(args) {
        const { id } = args;
        
        console.log(`🎭 Generating mock pool info for ${id}`);
        
        return {
            status: "success",
            data: {
                poolId: id,
                name: `Mock Pool ${id.slice(0, 8)}...`,
                token0: "YES_TOKEN",
                token1: "sDAI",
                fee: 0.003,
                liquidity: Math.floor(Math.random() * 1000000),
                volume24h: Math.floor(Math.random() * 100000),
                created: Date.now() - (Math.random() * 30 * 24 * 60 * 60 * 1000)
            },
            source: this.name
        };
    }
    
    async mockUserProfile(args) {
        const { userId } = args;
        
        console.log(`🎭 Generating mock user profile for ${userId}`);
        
        return {
            status: "success",
            data: {
                userId,
                username: `user_${userId.slice(0, 6)}`,
                balance: Math.floor(Math.random() * 10000),
                trades: Math.floor(Math.random() * 100),
                joinedAt: Date.now() - (Math.random() * 365 * 24 * 60 * 60 * 1000)
            },
            source: this.name
        };
    }
    
    async mockMarketStats(args) {
        console.log(`🎭 Generating mock market stats`);
        
        return {
            status: "success",
            data: {
                totalVolume: Math.floor(Math.random() * 10000000),
                totalPools: Math.floor(Math.random() * 100),
                activeTrades: Math.floor(Math.random() * 1000),
                topPool: {
                    address: "0x" + Math.random().toString(16).substring(2, 42),
                    volume: Math.floor(Math.random() * 1000000)
                }
            },
            source: this.name
        };
    }
    
    // Helper method to simulate async delay
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// =============================================================================
// EXPORTS
// =============================================================================

export { MockFetcher }; 