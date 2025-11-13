// Simple FutarchyFetcher test
import { DataLayer } from './DataLayer.js';
import { createPublicClient, http } from 'viem';
import { gnosis } from 'viem/chains';
import { createFutarchyFetcher } from './fetchers/FutarchyFetcher.js';

console.log('🚀 Testing FutarchyFetcher...');

try {
    // Setup
    const publicClient = createPublicClient({
        chain: gnosis,
        transport: http('https://rpc.gnosischain.com')
    });
    
    const dataLayer = new DataLayer();
    const fetcher = createFutarchyFetcher(publicClient);
    dataLayer.registerFetcher(fetcher);
    
    console.log('✅ Setup complete');
    
    // Test proposal info
    console.log('\n📋 Testing proposal info...');
    const result = await dataLayer.fetch('futarchy.proposal', {
        proposalAddress: '0xDA36a35CA4Fe6214C37a452159C0C9EAd45D5919'
    });
    
    if (result.status === 'success') {
        console.log('✅ Proposal fetched successfully!');
        console.log(`📊 Market: ${result.data.marketName}`);
        console.log(`🏢 Company Token: ${result.data.collateralTokens.company}`);
        console.log(`💰 Currency Token: ${result.data.collateralTokens.currency}`);
        console.log(`🎯 YES_GNO: ${result.data.outcomeTokens.yesCompany}`);
        console.log(`🎯 YES_SDAI: ${result.data.outcomeTokens.yesCurrency}`);
    } else {
        console.error('❌ Failed:', result.reason);
    }
    
    // Test your balances
    console.log('\n💰 Testing your balances...');
    const balanceResult = await dataLayer.fetch('futarchy.balances', {
        proposalAddress: '0xDA36a35CA4Fe6214C37a452159C0C9EAd45D5919',
        userAddress: '0xF863Da42f750A9a792a2c13c1Fc8E6Edaa81CA28'
    });
    
    if (balanceResult.status === 'success') {
        console.log('✅ Balances fetched successfully!');
        const { outcomeTokens } = balanceResult.data;
        console.log(`📈 YES_GNO: ${outcomeTokens.yesCompany.formatted}`);
        console.log(`📉 NO_GNO: ${outcomeTokens.noCompany.formatted}`);
        console.log(`📈 YES_SDAI: ${outcomeTokens.yesCurrency.formatted}`);
        console.log(`📉 NO_SDAI: ${outcomeTokens.noCurrency.formatted}`);
    } else {
        console.error('❌ Balance fetch failed:', balanceResult.reason);
    }
    
    // Test position calculations
    console.log('\n🧮 Testing position calculations...');
    const positionResult = await dataLayer.fetch('futarchy.positions', {
        proposalAddress: '0xDA36a35CA4Fe6214C37a452159C0C9EAd45D5919',
        userAddress: '0xF863Da42f750A9a792a2c13c1Fc8E6Edaa81CA28'
    });
    
    if (positionResult.status === 'success') {
        console.log('✅ Positions calculated successfully!');
        const { mergeable, positions } = positionResult.data;
        console.log(`🔄 Mergeable GNO: ${mergeable.company.formatted}`);
        console.log(`🔄 Mergeable SDAI: ${mergeable.currency.formatted}`);
        console.log(`🎯 Company Position: ${positions.company.description}`);
        console.log(`🎯 Currency Position: ${positions.currency.description}`);
    } else {
        console.error('❌ Position calculation failed:', positionResult.reason);
    }
    
    console.log('\n🎉 Test completed!');
    
} catch (error) {
    console.error('💥 Test failed:', error.message);
}