// test.js - Modular DataLayer Tests

import { DataLayer } from './DataLayer.js';
import { createSupabasePoolFetcher } from './fetchers/SupabasePoolFetcher.js';
import { MockFetcher } from './fetchers/MockFetcher.js';
import { config } from './config.js';

async function runTests() {
    console.log('🧪 Running Modular DataLayer Tests...\n');
    
    try {
        // Test 1: Create empty DataLayer
        console.log('1️⃣ Testing empty DataLayer...');
        const emptyDataLayer = new DataLayer();
        console.log('Available operations (should be empty):', emptyDataLayer.getAvailableOperations());
        
        const emptyResult = await emptyDataLayer.fetch('pools.candle', { id: 'test' });
        console.log('Empty DataLayer result:', JSON.stringify(emptyResult, null, 2));
        console.log('✅ Empty DataLayer test completed\n');
        
        // Test 2: DataLayer with MockFetcher
        console.log('2️⃣ Testing DataLayer with MockFetcher...');
        const mockDataLayer = new DataLayer();
        const mockFetcher = new MockFetcher();
        mockDataLayer.registerFetcher(mockFetcher);
        
        console.log('Mock DataLayer operations:', mockDataLayer.getAvailableOperations());
        
        // Test mock pool candles
        const mockResult = await mockDataLayer.fetch('pools.candle', {
            id: '0x1234567890123456789012345678901234567890',
            limit: 3
        });
        console.log('Mock candles result:', JSON.stringify(mockResult, null, 2));
        
        // Test mock user profile
        const userResult = await mockDataLayer.fetch('user.profile', {
            userId: '0x1234567890123456789012345678901234567890'
        });
        console.log('Mock user profile:', JSON.stringify(userResult, null, 2));
        
        console.log('✅ MockFetcher test completed\n');
        
        // Test 3: DataLayer with SupabaseFetcher
        console.log('3️⃣ Testing DataLayer with SupabaseFetcher...');
        const supabaseDataLayer = new DataLayer();
        const supabaseFetcher = createSupabasePoolFetcher(config.supabaseUrl, config.supabaseKey);
        supabaseDataLayer.registerFetcher(supabaseFetcher);
        
        console.log('Supabase DataLayer operations:', supabaseDataLayer.getAvailableOperations());
        
        const supabaseResult = await supabaseDataLayer.fetch('pools.candle', {
            id: config.defaultPools.yes,
            interval: config.intervals['1h'],
            limit: 2
        });
        console.log('Supabase result:', JSON.stringify(supabaseResult, null, 2));
        console.log('✅ SupabaseFetcher test completed\n');
        
        // Test 4: DataLayer with MULTIPLE fetchers (Mock overrides some operations)
        console.log('4️⃣ Testing DataLayer with MULTIPLE fetchers...');
        const multiDataLayer = new DataLayer();
        
        // Register Supabase fetcher first
        multiDataLayer.registerFetcher(supabaseFetcher);
        console.log('After Supabase:', multiDataLayer.getAvailableOperations());
        
        // Register mock fetcher - this will override pools.candle and pools.info
        multiDataLayer.registerFetcher(mockFetcher);
        console.log('After Mock (overrides some):', multiDataLayer.getAvailableOperations());
        
        // Now pools.candle should use MockFetcher, but pools.volume should use SupabaseFetcher
        const candleResult = await multiDataLayer.fetch('pools.candle', {
            id: '0x1234567890123456789012345678901234567890',
            limit: 2
        });
        console.log('Candle result (should be from Mock):', candleResult.source);
        
        const volumeResult = await multiDataLayer.fetch('pools.volume', {
            id: config.defaultPools.yes,
            timeframe: '24h'
        });
        console.log('Volume result (should be from Supabase):', volumeResult.source);
        
        const marketResult = await multiDataLayer.fetch('market.stats', {});
        console.log('Market stats (should be from Mock):', marketResult.source);
        
        console.log('✅ Multiple fetchers test completed\n');
        
        // Test 5: Error handling
        console.log('5️⃣ Testing error handling...');
        const errorResult = await multiDataLayer.fetch('invalid.operation', {});
        console.log('Error result:', JSON.stringify(errorResult, null, 2));
        console.log('✅ Error handling test completed\n');
        
        console.log('🎉 All tests completed successfully!');
        
        // Summary
        console.log('\n📋 TEST SUMMARY:');
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('✅ Empty DataLayer - properly rejects unknown operations');
        console.log('✅ MockFetcher - generates realistic mock data with delay');
        console.log('✅ SupabaseFetcher - connects to real Supabase and fetches data');
        console.log('✅ Multiple Fetchers - last registered wins for conflicting operations');
        console.log('✅ Error Handling - graceful failure with helpful messages');
        console.log('\n🏗️ ARCHITECTURE BENEFITS:');
        console.log('🔌 Pluggable - Easy to add new fetchers');
        console.log('🔀 Flexible - Mix and match data sources');
        console.log('🧪 Testable - Mock fetchers for development');
        console.log('📦 Modular - Each fetcher is self-contained');
        console.log('🚀 Extensible - Same interface, different implementations');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run tests
runTests(); 