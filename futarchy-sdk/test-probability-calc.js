#!/usr/bin/env node

// Test to verify probability calculation matches algebra-cli
import { createPublicClient, http, parseAbi } from 'viem';
import { gnosis } from 'viem/chains';
import chalk from 'chalk';

const ALGEBRA_POOL_ABI = parseAbi([
    'function globalState() view returns (uint160 sqrtPriceX96, int24 tick, uint16 fee, uint16 timepointIndex, uint8 communityFeeToken0, uint8 communityFeeToken1, bool unlocked)',
    'function token0() view returns (address)',
    'function token1() view returns (address)'
]);

const ERC20_ABI = parseAbi([
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)'
]);

async function test() {
    const publicClient = createPublicClient({
        chain: gnosis,
        transport: http('https://rpc.gnosischain.com')
    });
    
    // Test with YES_CURRENCY/BASE_CURRENCY pool
    const poolAddress = '0xC1C85eaA75d10Fea6e422FaDEE87a91BA74c5303';
    console.log(chalk.cyan.bold('\n🔬 Testing Probability Calculation\n'));
    console.log('Pool:', poolAddress);
    
    try {
        // Get pool state
        const [globalState, token0, token1] = await Promise.all([
            publicClient.readContract({
                address: poolAddress,
                abi: ALGEBRA_POOL_ABI,
                functionName: 'globalState'
            }),
            publicClient.readContract({
                address: poolAddress,
                abi: ALGEBRA_POOL_ABI,
                functionName: 'token0'
            }),
            publicClient.readContract({
                address: poolAddress,
                abi: ALGEBRA_POOL_ABI,
                functionName: 'token1'
            })
        ]);
        
        const sqrtPriceX96 = globalState[0];
        
        // Get token info
        const [symbol0, symbol1, decimals0, decimals1] = await Promise.all([
            publicClient.readContract({
                address: token0,
                abi: ERC20_ABI,
                functionName: 'symbol'
            }),
            publicClient.readContract({
                address: token1,
                abi: ERC20_ABI,
                functionName: 'symbol'
            }),
            publicClient.readContract({
                address: token0,
                abi: ERC20_ABI,
                functionName: 'decimals'
            }),
            publicClient.readContract({
                address: token1,
                abi: ERC20_ABI,
                functionName: 'decimals'
            })
        ]);
        
        console.log(chalk.yellow('\n📊 Pool Info:'));
        console.log('Token0:', symbol0, token0);
        console.log('Token1:', symbol1, token1);
        console.log('Decimals:', decimals0, '/', decimals1);
        console.log('sqrtPriceX96:', sqrtPriceX96.toString());
        
        // Calculate price both ways
        console.log(chalk.yellow('\n💰 Price Calculations:'));
        
        // Method 1: algebra-cli style
        const priceAlgebraStyle = Number(sqrtPriceX96) ** 2 / 2 ** 192;
        console.log(`\nMethod 1 (algebra-cli): Number(sqrtPriceX96)**2 / 2**192`);
        console.log(`  Raw price (token1/token0):`, priceAlgebraStyle);
        console.log(`  1 ${symbol0} = ${priceAlgebraStyle.toFixed(10)} ${symbol1}`);
        console.log(`  1 ${symbol1} = ${(1/priceAlgebraStyle).toFixed(10)} ${symbol0}`);
        
        // Method 2: our style
        const priceOurStyle = (Number(sqrtPriceX96) / (2 ** 96)) ** 2;
        console.log(`\nMethod 2 (our method): (Number(sqrtPriceX96) / 2**96) ** 2`);
        console.log(`  Raw price (token1/token0):`, priceOurStyle);
        console.log(`  1 ${symbol0} = ${priceOurStyle.toFixed(10)} ${symbol1}`);
        console.log(`  1 ${symbol1} = ${(1/priceOurStyle).toFixed(10)} ${symbol0}`);
        
        // Adjust for decimals
        const decimalAdjustment = 10 ** (Number(decimals0) - Number(decimals1));
        const priceAdjusted = priceAlgebraStyle * decimalAdjustment;
        console.log(`\nWith decimal adjustment (10^(${decimals0}-${decimals1}) = ${decimalAdjustment}):`);
        console.log(`  Adjusted price:`, priceAdjusted);
        console.log(`  1 ${symbol0} = ${priceAdjusted.toFixed(10)} ${symbol1}`);
        console.log(`  1 ${symbol1} = ${(1/priceAdjusted).toFixed(10)} ${symbol0}`);
        
        // Determine implied probability
        console.log(chalk.cyan('\n📈 Implied Probability:'));
        
        // Check which token is the conditional token
        const isToken0Conditional = symbol0.includes('YES') || symbol0.includes('NO');
        const isToken1Conditional = symbol1.includes('YES') || symbol1.includes('NO');
        
        if (isToken0Conditional && !isToken1Conditional) {
            // Conditional is token0, base is token1
            // Price is: 1 conditional = X base
            const conditionalPrice = priceAdjusted;
            console.log(`  ${symbol0} is conditional, ${symbol1} is base`);
            console.log(`  1 ${symbol0} = ${conditionalPrice.toFixed(6)} ${symbol1}`);
            console.log(chalk.green(`  Implied probability: ${(conditionalPrice * 100).toFixed(2)}%`));
        } else if (isToken1Conditional && !isToken0Conditional) {
            // Conditional is token1, base is token0
            // We need inverse price: 1 conditional = X base
            const conditionalPrice = 1 / priceAdjusted;
            console.log(`  ${symbol1} is conditional, ${symbol0} is base`);
            console.log(`  1 ${symbol1} = ${conditionalPrice.toFixed(6)} ${symbol0}`);
            console.log(chalk.green(`  Implied probability: ${(conditionalPrice * 100).toFixed(2)}%`));
        }
        
        // Test all 4 prediction pools
        console.log(chalk.yellow('\n\n🔍 Testing All Prediction Pools:'));
        const pools = [
            { address: '0xC1C85eaA75d10Fea6e422FaDEE87a91BA74c5303', name: 'YES_CURRENCY/BASE' },
            { address: '0xEcB6AB72B7744CAD088f11EddeeBC8ee6b3A8449', name: 'NO_CURRENCY/BASE' },
            { address: '0x7C0e7161B2C7AAEb70297bEBF906b3a4A4acb862', name: 'YES_COMPANY/BASE' },
            { address: '0xc623300F733e7b4de96562c9252968606B4FE71e', name: 'NO_COMPANY/BASE' }
        ];
        
        for (const pool of pools) {
            const globalState = await publicClient.readContract({
                address: pool.address,
                abi: ALGEBRA_POOL_ABI,
                functionName: 'globalState'
            });
            
            const sqrtPriceX96 = globalState[0];
            const price = Number(sqrtPriceX96) ** 2 / 2 ** 192;
            
            // For YES/NO_CURRENCY pools, conditional is token0
            // For YES/NO_COMPANY pools, conditional is token1 (need inverse)
            const isCompanyPool = pool.name.includes('COMPANY');
            const conditionalPrice = isCompanyPool ? (1 / price) : price;
            
            console.log(`\n${pool.name}:`);
            console.log(`  Price: ${conditionalPrice.toFixed(6)} sDAI`);
            console.log(`  Implied prob: ${(conditionalPrice * 100).toFixed(2)}%`);
        }
        
    } catch (error) {
        console.error(chalk.red('Error:'), error);
    }
}

test().catch(console.error);