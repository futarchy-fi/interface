// examples/sdai-rate-example.js - Simple sDAI Rate Fetcher Example

import { DataLayer } from '../DataLayer.js';
import { SdaiRateFetcher } from '../fetchers/SdaiRateFetcher.js';

// =============================================================================
// SIMPLE SDAI RATE EXAMPLE
// =============================================================================

console.log('💰 sDAI Rate Fetcher Example\n');

async function simpleExample() {
    // 1. Setup DataLayer with sDAI Rate Fetcher
    const dataLayer = new DataLayer();
    const sdaiRateFetcher = new SdaiRateFetcher();
    
    dataLayer.registerFetcher(sdaiRateFetcher);
    
    console.log('🔧 DataLayer setup complete\n');
    
    // 2. Fetch current sDAI rate
    console.log('📡 Fetching current sDAI rate...');
    const result = await dataLayer.fetch('sdai.rate');
    
    if (result.status === 'success') {
        console.log(`✅ Current sDAI Rate: ${result.data.rate}`);
        console.log(`   Source: ${result.data.cached ? 'Cache' : 'Fresh fetch'}`);
        console.log(`   Fetch time: ${new Date(result.data.fetchTime).toLocaleString()}`);
        
        // 3. Demonstrate different usage patterns
        console.log('\n📋 Additional operations:');
        
        // Get cached rate only
        const cached = await dataLayer.fetch('sdai.rate.cached');
        if (cached.status === 'success') {
            console.log(`   Cached rate: ${cached.data.rate} (${cached.data.stale ? 'stale' : 'fresh'})`);
        }
        
        // Force refresh
        console.log('   🔄 Force refreshing...');
        const refreshed = await dataLayer.fetch('sdai.rate.refresh');
        if (refreshed.status === 'success') {
            console.log(`   Refreshed rate: ${refreshed.data.rate}`);
        }
        
    } else {
        console.error(`❌ Failed to fetch sDAI rate: ${result.reason}`);
    }
}

// =============================================================================
// ADVANCED EXAMPLE WITH ERROR HANDLING
// =============================================================================

async function advancedExample() {
    console.log('\n🚀 Advanced Example with Error Handling\n');
    
    // Custom configuration
    const customFetcher = new SdaiRateFetcher({
        refreshInterval: 30000, // 30 seconds cache
        timeoutDuration: 10000,  // 10 second timeout
    });
    
    const dataLayer = new DataLayer();
    dataLayer.registerFetcher(customFetcher);
    
    // Monitor fetcher status
    console.log('📊 Initial fetcher status:');
    const initialStatus = customFetcher.getStatus();
    console.log(`   Name: ${initialStatus.name}`);
    console.log(`   Cached rate: ${initialStatus.cachedRate || 'None'}`);
    console.log(`   Supported operations: ${initialStatus.supportedOperations.length}`);
    
    // Fetch with comprehensive error handling
    try {
        console.log('\n💰 Fetching sDAI rate with error handling...');
        const result = await dataLayer.fetch('sdai.rate');
        
        switch (result.status) {
            case 'success':
                console.log(`✅ Success: Rate = ${result.data.rate}`);
                break;
                
            case 'warning':
                console.log(`⚠️ Warning: ${result.message}`);
                console.log(`   Fallback rate: ${result.data.rate}`);
                break;
                
            case 'loading':
                console.log(`⏳ Loading: ${result.message}`);
                break;
                
            case 'error':
                console.log(`❌ Error: ${result.reason}`);
                break;
        }
        
        // Check final status
        const finalStatus = customFetcher.getStatus();
        console.log('\n📊 Final fetcher status:');
        console.log(`   Cached rate: ${finalStatus.cachedRate}`);
        console.log(`   Cache valid: ${finalStatus.cacheValid}`);
        console.log(`   Active cooldowns: ${finalStatus.activeCooldowns.length}`);
        
    } catch (error) {
        console.error(`💥 Unexpected error: ${error.message}`);
    }
}

// =============================================================================
// INTEGRATION EXAMPLE
// =============================================================================

async function integrationExample() {
    console.log('\n🔗 Integration Example\n');
    
    const dataLayer = new DataLayer();
    const sdaiRateFetcher = new SdaiRateFetcher();
    dataLayer.registerFetcher(sdaiRateFetcher);
    
    // Simulate integration with other components
    const rateData = await dataLayer.fetch('sdai.rate');
    
    if (rateData.status === 'success') {
        const rate = rateData.data.rate;
        
        console.log('💡 Using sDAI rate in calculations:');
        
        // Example: Convert sDAI to USD (assuming 1 DAI ≈ $1)
        const sdaiAmount = 1000; // 1000 sDAI
        const daiEquivalent = sdaiAmount * rate;
        const usdValue = daiEquivalent; // Simplified
        
        console.log(`   ${sdaiAmount} sDAI = ${daiEquivalent.toFixed(4)} DAI`);
        console.log(`   Estimated USD value: $${usdValue.toFixed(2)}`);
        
        // Example: Calculate yield
        const baseAmount = 1000; // Original DAI amount
        const currentValue = baseAmount * rate;
        const yield_ = ((currentValue - baseAmount) / baseAmount) * 100;
        
        console.log(`   Yield on ${baseAmount} DAI: ${yield_.toFixed(2)}%`);
        
    } else {
        console.log('❌ Cannot perform calculations without rate data');
    }
}

// =============================================================================
// RUN EXAMPLES
// =============================================================================

async function runExamples() {
    try {
        await simpleExample();
        await advancedExample();
        await integrationExample();
        
        console.log('\n🎉 All examples completed successfully!');
        
    } catch (error) {
        console.error('\n💥 Example failed:', error);
    }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runExamples();
}

export { simpleExample, advancedExample, integrationExample };
