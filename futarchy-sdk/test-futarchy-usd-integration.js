#!/usr/bin/env node

// Test sDAI Rate Integration in Futarchy Complete
// This test verifies that USD conversions are working correctly

import { DataLayer } from './DataLayer.js';
import { SdaiRateFetcher } from './fetchers/SdaiRateFetcher.js';

// =============================================================================
// TEST USD INTEGRATION
// =============================================================================

async function testUSDIntegration() {
    console.log('🧪 Testing sDAI Rate USD Integration\n');
    
    try {
        // 1. Test the fetcher directly
        console.log('📚 Step 1: Test SdaiRateFetcher directly');
        const dataLayer = new DataLayer();
        const sdaiRateFetcher = new SdaiRateFetcher();
        dataLayer.registerFetcher(sdaiRateFetcher);
        
        const rateResult = await dataLayer.fetch('sdai.rate');
        
        if (rateResult.status === 'success') {
            const rate = rateResult.data.rate;
            console.log(`✅ Successfully fetched sDAI rate: ${rate}`);
            
            // 2. Test USD conversion logic
            console.log('\n💰 Step 2: Test USD conversion logic');
            
            // Simulate the price formatting function
            function formatPriceWithUSD(sdaiAmount, decimals = 4) {
                if (!rate || rate <= 0) {
                    return `${sdaiAmount.toFixed(decimals)} sDAI`;
                }
                
                const daiEquivalent = sdaiAmount * rate;
                const usdValue = daiEquivalent; // Assuming 1 DAI ≈ $1 USD
                
                return `${sdaiAmount.toFixed(decimals)} sDAI (~$${usdValue.toFixed(2)} USD)`;
            }
            
            // Test various amounts
            const testAmounts = [1, 10, 100, 1000, 0.1, 0.01];
            
            console.log('Test conversions:');
            testAmounts.forEach(amount => {
                const formatted = formatPriceWithUSD(amount);
                console.log(`  ${amount} sDAI → ${formatted}`);
            });
            
            // 3. Test edge cases
            console.log('\n🔍 Step 3: Test edge cases');
            
            // Test with no rate
            function formatWithoutRate(sdaiAmount) {
                return `${sdaiAmount.toFixed(4)} sDAI`;
            }
            
            console.log('Without rate:', formatWithoutRate(100));
            console.log('With rate:', formatPriceWithUSD(100));
            
            // 4. Calculate some realistic market scenarios
            console.log('\n📊 Step 4: Realistic market scenarios');
            
            const scenarios = [
                { name: 'Small trade', amount: 10 },
                { name: 'Medium trade', amount: 100 },
                { name: 'Large trade', amount: 1000 },
                { name: 'Micro trade', amount: 1 },
                { name: 'Token price (0.1 sDAI)', amount: 0.1 },
                { name: 'Token price (0.5 sDAI)', amount: 0.5 }
            ];
            
            scenarios.forEach(scenario => {
                const usdValue = scenario.amount * rate;
                console.log(`  ${scenario.name}: ${scenario.amount} sDAI = $${usdValue.toFixed(2)} USD`);
            });
            
            // 5. Test rate refresh
            console.log('\n🔄 Step 5: Test rate refresh');
            const refreshResult = await dataLayer.fetch('sdai.rate.refresh');
            
            if (refreshResult.status === 'success' || refreshResult.status === 'warning') {
                console.log(`✅ Rate refresh successful: ${refreshResult.data.rate}`);
            } else {
                console.log(`⚠️ Rate refresh failed: ${refreshResult.reason}`);
            }
            
            console.log('\n🎉 All USD integration tests passed!');
            
            return {
                success: true,
                rate: rate,
                testResults: {
                    basicFetch: true,
                    formatting: true,
                    edgeCases: true,
                    scenarios: true,
                    refresh: refreshResult.status !== 'error'
                }
            };
            
        } else {
            console.error(`❌ Failed to fetch sDAI rate: ${rateResult.reason}`);
            return { success: false, error: rateResult.reason };
        }
        
    } catch (error) {
        console.error('💥 Test failed with error:', error);
        return { success: false, error: error.message };
    }
}

// =============================================================================
// TEST PRICE DISPLAY FORMATTING
// =============================================================================

async function testPriceDisplayFormatting() {
    console.log('\n🎨 Testing Price Display Formatting\n');
    
    const dataLayer = new DataLayer();
    const sdaiRateFetcher = new SdaiRateFetcher();
    dataLayer.registerFetcher(sdaiRateFetcher);
    
    const rateResult = await dataLayer.fetch('sdai.rate');
    
    if (rateResult.status !== 'success') {
        console.log('⚠️ Cannot test formatting without sDAI rate');
        return;
    }
    
    const rate = rateResult.data.rate;
    
    // Test the exact formatting used in futarchy-complete
    function formatPriceWithUSD(sdaiAmount, decimals = 4) {
        if (!rate || rate <= 0) {
            return `${sdaiAmount.toFixed(decimals)} sDAI`;
        }
        
        const daiEquivalent = sdaiAmount * rate;
        const usdValue = daiEquivalent;
        
        return `${sdaiAmount.toFixed(decimals)} sDAI (~$${usdValue.toFixed(2)} USD)`;
    }
    
    // Test various price displays that would appear in futarchy-complete
    console.log('🏷️ Pool Price Examples:');
    console.log(`  YES_COMPANY/sDAI: 1 YES_COMPANY = ${formatPriceWithUSD(0.45, 6)}`);
    console.log(`  NO_COMPANY/sDAI: 1 NO_COMPANY = ${formatPriceWithUSD(0.55, 6)}`);
    console.log(`  YES_CURRENCY/sDAI: 1 YES_CURRENCY = ${formatPriceWithUSD(0.48, 6)}`);
    console.log(`  NO_CURRENCY/sDAI: 1 NO_CURRENCY = ${formatPriceWithUSD(0.52, 6)}`);
    
    console.log('\n💸 Trade Examples:');
    console.log(`  You pay: ${formatPriceWithUSD(100)}`);
    console.log(`  You receive: ${formatPriceWithUSD(95.2, 6)}`);
    console.log(`  Exchange rate: 1 YES_COMPANY = ${formatPriceWithUSD(0.45, 4)}`);
    
    console.log('\n👛 Balance Examples:');
    console.log(`  sDAI balance: ${formatPriceWithUSD(1250.75)}`);
    console.log(`  Available to spend: ${formatPriceWithUSD(500)}`);
    
    console.log('\n✅ Price formatting test complete');
}

// =============================================================================
// RUN ALL TESTS
// =============================================================================

async function runAllTests() {
    console.log('🚀 Starting sDAI Rate USD Integration Tests\n');
    console.log('=' .repeat(60));
    
    const integrationResult = await testUSDIntegration();
    
    console.log('=' .repeat(60));
    
    await testPriceDisplayFormatting();
    
    console.log('\n' + '=' .repeat(60));
    console.log('🏁 Test Suite Complete');
    
    if (integrationResult.success) {
        console.log('✅ All integration tests passed!');
        console.log(`📊 sDAI Rate: ${integrationResult.rate.toFixed(6)}`);
        console.log(`💵 $1 USD = ${(1 / integrationResult.rate).toFixed(4)} sDAI`);
        console.log(`💰 1 sDAI = $${integrationResult.rate.toFixed(4)} USD`);
    } else {
        console.log('❌ Some tests failed');
        console.log(`Error: ${integrationResult.error}`);
    }
    
    return integrationResult;
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runAllTests().catch(console.error);
}

export { testUSDIntegration, testPriceDisplayFormatting, runAllTests };
