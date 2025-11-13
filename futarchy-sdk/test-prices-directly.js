import { DataLayer } from './DataLayer.js';
import { createPoolDiscoveryFetcher } from './fetchers/PoolDiscoveryFetcher.js';

const dataLayer = new DataLayer();
const poolFetcher = createPoolDiscoveryFetcher();
dataLayer.registerFetcher(poolFetcher);

console.log('Testing price fetching...\n');

const result = await dataLayer.fetch('pools.prices', { 
    proposalAddress: '0xA94aB35282118f38b0b4FF89dDA7A5c04aD49371' 
});

if (result.status === 'success') {
    console.log('Prices fetched successfully!');
    console.log('Number of price entries:', Object.keys(result.data.prices).length);
    
    for (const [poolName, priceData] of Object.entries(result.data.prices)) {
        console.log(`\n${poolName}:`);
        console.log('  Pool:', priceData.poolAddress);
        console.log('  Price (token0/token1):', priceData.price);
        console.log('  Price (token1/token0):', priceData.priceInverse);
        console.log('  Tick:', priceData.tick);
    }
    
    if (result.data.impliedProbabilities) {
        console.log('\nImplied Probabilities:');
        console.log('  From Company pools:', result.data.impliedProbabilities.fromCompany);
        console.log('  From Currency pools:', result.data.impliedProbabilities.fromCurrency);
    }
} else {
    console.log('Failed:', result.reason);
}