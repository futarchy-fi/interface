// test-sdai-rate-fetcher.js - Test the sDAI Rate Fetcher

import { DataLayer } from './DataLayer.js';
import { SdaiRateFetcher } from './fetchers/SdaiRateFetcher.js';

// =============================================================================
// TEST SDAI RATE FETCHER
// =============================================================================

async function testSdaiRateFetcher() {
    console.log('🧪 Testing sDAI Rate Fetcher\n');
    
    try {
        // 1. Initialize DataLayer and Fetcher
        console.log('📚 Step 1: Initialize DataLayer and SdaiRateFetcher');
        const dataLayer = new DataLayer();
        const sdaiRateFetcher = new SdaiRateFetcher();
        
        // Register the fetcher
        dataLayer.registerFetcher(sdaiRateFetcher);
        
        console.log('✅ Fetcher registered successfully\n');
        
        // 2. Test basic rate fetching
        console.log('💰 Step 2: Fetch current sDAI rate');
        const rateResult = await dataLayer.fetch('sdai.rate');
        
        if (rateResult.status === 'success') {
            console.log(`✅ Successfully fetched sDAI rate: ${rateResult.data.rate}`);
            console.log(`   Cached: ${rateResult.data.cached}`);
            console.log(`   Fetch time: ${new Date(rateResult.data.fetchTime).toLocaleString()}`);
        } else {
            console.error(`❌ Failed to fetch rate: ${rateResult.reason}`);
        }
        console.log('');
        
        // 3. Test cached rate retrieval
        console.log('📋 Step 3: Test cached rate retrieval');
        const cachedResult = await dataLayer.fetch('sdai.rate.cached');
        
        if (cachedResult.status === 'success') {
            console.log(`✅ Cached rate: ${cachedResult.data.rate}`);
            console.log(`   Cache valid: ${!cachedResult.data.stale}`);
        } else {
            console.log(`ℹ️ No cached rate available: ${cachedResult.reason}`);
        }
        console.log('');
        
        // 4. Test fetcher status
        console.log('📊 Step 4: Check fetcher status');
        const status = sdaiRateFetcher.getStatus();
        console.log('Fetcher Status:');
        console.log(`  Name: ${status.name}`);
        console.log(`  Cached Rate: ${status.cachedRate}`);
        console.log(`  Cache Valid: ${status.cacheValid}`);
        console.log(`  Is Loading: ${status.isLoading}`);
        console.log(`  Current RPC Index: ${status.currentRpcIndex}`);
        console.log(`  Active Cooldowns: ${status.activeCooldowns.length}`);
        console.log(`  Supported Operations: ${status.supportedOperations.join(', ')}`);
        console.log('');
        
        // 5. Test rate refresh
        console.log('🔄 Step 5: Test force refresh');
        const refreshResult = await dataLayer.fetch('sdai.rate.refresh');
        
        if (refreshResult.status === 'success') {
            console.log(`✅ Refreshed rate: ${refreshResult.data.rate}`);
        } else if (refreshResult.status === 'warning') {
            console.log(`⚠️ Warning: ${refreshResult.message}`);
            console.log(`   Fallback rate: ${refreshResult.data.rate}`);
        } else {
            console.error(`❌ Failed to refresh: ${refreshResult.reason}`);
        }
        console.log('');
        
        // 6. Test multiple rapid calls (should use cache)
        console.log('⚡ Step 6: Test rapid successive calls (caching behavior)');
        const start = Date.now();
        
        const rapidCalls = await Promise.all([
            dataLayer.fetch('sdai.rate'),
            dataLayer.fetch('sdai.rate'),
            dataLayer.fetch('sdai.rate')
        ]);
        
        const duration = Date.now() - start;
        console.log(`✅ Made 3 rapid calls in ${duration}ms`);
        
        rapidCalls.forEach((result, index) => {
            if (result.status === 'success') {
                console.log(`   Call ${index + 1}: Rate ${result.data.rate}, Cached: ${result.data.cached}`);
            } else {
                console.log(`   Call ${index + 1}: ${result.status} - ${result.reason || result.message}`);
            }
        });
        console.log('');
        
        // 7. Test error handling with invalid operation
        console.log('❌ Step 7: Test error handling with invalid operation');
        const errorResult = await dataLayer.fetch('sdai.invalid');
        console.log(`Expected error: ${errorResult.reason}`);
        console.log('');
        
        console.log('🎉 All tests completed successfully!');
        
        return {
            success: true,
            finalRate: rateResult.status === 'success' ? rateResult.data.rate : null,
            testDuration: Date.now() - start
        };
        
    } catch (error) {
        console.error('💥 Test failed with error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// =============================================================================
// PERFORMANCE TEST
// =============================================================================

async function performanceTest() {
    console.log('\n⚡ Performance Test: Multiple Rate Fetches\n');
    
    const dataLayer = new DataLayer();
    const sdaiRateFetcher = new SdaiRateFetcher();
    dataLayer.registerFetcher(sdaiRateFetcher);
    
    const iterations = 10;
    const results = [];
    
    console.log(`Running ${iterations} rate fetch operations...`);
    
    for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        const result = await dataLayer.fetch('sdai.rate');
        const duration = Date.now() - start;
        
        results.push({
            iteration: i + 1,
            duration,
            success: result.status === 'success',
            cached: result.data?.cached || false,
            rate: result.data?.rate || null
        });
        
        console.log(`  ${i + 1}. ${duration}ms - ${result.status} - ${result.data?.cached ? 'cached' : 'fresh'} - Rate: ${result.data?.rate || 'N/A'}`);
        
        // Small delay between calls
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
    const successRate = results.filter(r => r.success).length / results.length * 100;
    const cacheHitRate = results.filter(r => r.cached).length / results.length * 100;
    
    console.log('\n📊 Performance Summary:');
    console.log(`   Average Duration: ${avgDuration.toFixed(2)}ms`);
    console.log(`   Success Rate: ${successRate.toFixed(1)}%`);
    console.log(`   Cache Hit Rate: ${cacheHitRate.toFixed(1)}%`);
    
    return results;
}

// =============================================================================
// RUN TESTS
// =============================================================================

async function runAllTests() {
    console.log('🚀 Starting sDAI Rate Fetcher Tests\n');
    console.log('=' .repeat(60));
    
    // Main functionality test
    const mainTestResult = await testSdaiRateFetcher();
    
    console.log('=' .repeat(60));
    
    // Performance test
    const perfResults = await performanceTest();
    
    console.log('\n' + '=' .repeat(60));
    console.log('🏁 Test Suite Complete');
    
    if (mainTestResult.success) {
        console.log('✅ All tests passed successfully!');
        if (mainTestResult.finalRate) {
            console.log(`📊 Final sDAI Rate: ${mainTestResult.finalRate}`);
        }
    } else {
        console.log('❌ Some tests failed');
        console.log(`Error: ${mainTestResult.error}`);
    }
    
    return {
        mainTest: mainTestResult,
        performanceTest: perfResults
    };
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runAllTests().catch(console.error);
}

export { testSdaiRateFetcher, performanceTest, runAllTests };
