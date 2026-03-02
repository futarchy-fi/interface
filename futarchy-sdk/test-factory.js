import { ethers } from 'ethers';

const provider = new ethers.providers.JsonRpcProvider('https://rpc.gnosischain.com');

// Test Position Manager factory() call
const pmAbi = ['function factory() view returns (address)'];
const pm = new ethers.Contract('0x7495a583ba85875d59407781b4958ED6e0E1228f', pmAbi, provider);

console.log('Testing Position Manager factory() call...');
try {
    const factory = await pm.factory();
    console.log('Factory address:', factory);
} catch (error) {
    console.log('Error calling factory():', error.message);
    
    // Try direct factory address from known deployments
    console.log('\nTrying known factory addresses...');
    
    const knownFactories = [
        '0x30c4e9D7deCed8511AE1Fae9d93deDE2b427343d', // Algebra Factory V1.1
        '0xA7F069E8767C73838294393AeA58D88EF11a8c70', // Another potential factory
    ];
    
    for (const factoryAddr of knownFactories) {
        try {
            const factoryAbi = ['function poolByPair(address,address) view returns (address)'];
            const factory = new ethers.Contract(factoryAddr, factoryAbi, provider);
            
            // Try a test call
            const testPool = await factory.poolByPair(
                '0xaf204776c7245bF4147c2612BF6e5972Ee483701', // sDAI
                '0x37b60f4E9A31A64cCc0024dce7D0fD07eAA0F7B3'  // GNO
            );
            
            console.log(`Factory ${factoryAddr} works!`);
            console.log(`  Test pool result: ${testPool}`);
            break;
        } catch (e) {
            console.log(`Factory ${factoryAddr} failed:`, e.message);
        }
    }
}