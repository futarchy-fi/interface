#!/usr/bin/env node

// Test script to show all 6 pool prices correctly
import { DataLayer } from './DataLayer.js';
import { createPoolDiscoveryFetcher } from './fetchers/PoolDiscoveryFetcher.js';
import { createProposalFetcher } from './fetchers/ProposalFetcher.js';
import chalk from 'chalk';

async function test() {
    console.log(chalk.cyan.bold('\n🚀 Testing All 6 Pool Prices\n'));
    
    const dataLayer = new DataLayer();
    
    // Register fetchers
    const poolFetcher = createPoolDiscoveryFetcher();
    const proposalFetcher = createProposalFetcher();
    dataLayer.registerFetcher(poolFetcher);
    dataLayer.registerFetcher(proposalFetcher);
    
    const proposalAddress = '0xA94aB35282118f38b0b4FF89dDA7A5c04aD49371';
    
    // Fetch prices
    console.log(chalk.yellow('💱 Fetching all pool prices...'));
    const prices = await dataLayer.fetch('pools.prices', { proposalAddress });
    
    if (prices.status === 'success') {
        const { prices: poolPrices, tokens } = prices.data;
        
        console.log(chalk.cyan.bold('\n📊 All 6 Futarchy Pool Prices:\n'));
        
        // 1. Conditional Pools
        console.log(chalk.yellow('Conditional Pools (YES/NO pairs):'));
        
        // YES_COMPANY/YES_CURRENCY - we want: how much YES_CURRENCY to buy 1 YES_COMPANY
        if (poolPrices['YES_COMPANY/YES_CURRENCY']) {
            const pool = poolPrices['YES_COMPANY/YES_CURRENCY'];
            // Check actual token ordering in the pool
            const yesCompanyIsToken0 = pool.token0.toLowerCase() === tokens.yesCompany.toLowerCase();
            // If YES_COMPANY is token0, raw price = token1/token0 = YES_CURRENCY/YES_COMPANY (what we want!)
            // If YES_COMPANY is token1, raw price = token1/token0 = YES_COMPANY/YES_CURRENCY (need inverse)
            const price = yesCompanyIsToken0 ? pool.price : pool.priceInverse;
            console.log(chalk.gray('  Pool 1: YES_COMPANY/YES_CURRENCY'));
            console.log(`    → 1 YES_COMPANY = ${price.toFixed(4)} YES_CURRENCY`);
        }
        
        // NO_COMPANY/NO_CURRENCY - we want: how much NO_CURRENCY to buy 1 NO_COMPANY  
        if (poolPrices['NO_COMPANY/NO_CURRENCY']) {
            const pool = poolPrices['NO_COMPANY/NO_CURRENCY'];
            // Check actual token ordering in the pool
            const noCompanyIsToken0 = pool.token0.toLowerCase() === tokens.noCompany.toLowerCase();
            // If NO_COMPANY is token0, raw price = token1/token0 = NO_CURRENCY/NO_COMPANY (what we want!)
            // If NO_COMPANY is token1, raw price = token1/token0 = NO_COMPANY/NO_CURRENCY (need inverse)
            const price = noCompanyIsToken0 ? pool.price : pool.priceInverse;
            console.log(chalk.gray('  Pool 2: NO_COMPANY/NO_CURRENCY'));
            console.log(`    → 1 NO_COMPANY = ${price.toFixed(4)} NO_CURRENCY`);
        }
        
        // 2. Prediction Pools
        console.log(chalk.yellow('\nPrediction Pools (vs sDAI):'));
        
        // YES_COMPANY/sDAI
        if (poolPrices['YES_COMPANY/BASE_CURRENCY']) {
            const pool = poolPrices['YES_COMPANY/BASE_CURRENCY'];
            const yesCompanyIsToken0 = pool.token0.toLowerCase() === tokens.yesCompany.toLowerCase();
            const price = yesCompanyIsToken0 ? pool.price : pool.priceInverse;
            console.log(chalk.gray('  Pool 3: YES_COMPANY/sDAI'));
            console.log(chalk.green(`    → 1 YES_COMPANY = ${price.toFixed(6)} sDAI (${(price * 100).toFixed(2)}% probability)`));
        }
        
        // NO_COMPANY/sDAI
        if (poolPrices['NO_COMPANY/BASE_CURRENCY']) {
            const pool = poolPrices['NO_COMPANY/BASE_CURRENCY'];
            const noCompanyIsToken0 = pool.token0.toLowerCase() === tokens.noCompany.toLowerCase();
            const price = noCompanyIsToken0 ? pool.price : pool.priceInverse;
            console.log(chalk.gray('  Pool 4: NO_COMPANY/sDAI'));
            console.log(chalk.red(`    → 1 NO_COMPANY = ${price.toFixed(6)} sDAI (${(price * 100).toFixed(2)}% probability)`));
        }
        
        // YES_CURRENCY/sDAI
        if (poolPrices['YES_CURRENCY/BASE_CURRENCY']) {
            const pool = poolPrices['YES_CURRENCY/BASE_CURRENCY'];
            const yesCurrencyIsToken0 = pool.token0.toLowerCase() === tokens.yesCurrency.toLowerCase();
            const price = yesCurrencyIsToken0 ? pool.price : pool.priceInverse;
            console.log(chalk.gray('  Pool 5: YES_CURRENCY/sDAI'));
            console.log(chalk.green(`    → 1 YES_CURRENCY = ${price.toFixed(6)} sDAI (${(price * 100).toFixed(2)}% probability)`));
        }
        
        // NO_CURRENCY/sDAI
        if (poolPrices['NO_CURRENCY/BASE_CURRENCY']) {
            const pool = poolPrices['NO_CURRENCY/BASE_CURRENCY'];
            const noCurrencyIsToken0 = pool.token0.toLowerCase() === tokens.noCurrency.toLowerCase();
            const price = noCurrencyIsToken0 ? pool.price : pool.priceInverse;
            console.log(chalk.gray('  Pool 6: NO_CURRENCY/sDAI'));
            console.log(chalk.red(`    → 1 NO_CURRENCY = ${price.toFixed(6)} sDAI (${(price * 100).toFixed(2)}% probability)`));
        }
        
        // 3. Summary
        console.log(chalk.cyan('\n📈 Market Summary:'));
        
        if (prices.data.impliedProbability?.fromPredictionCurrency) {
            const prob = prices.data.impliedProbability.fromPredictionCurrency;
            console.log(`  YES+NO sum: ${prob.total.toFixed(4)} sDAI`);
            
            if (prob.total < 1.0) {
                console.log(chalk.green(`  → Arbitrage: Buy both for ${prob.total.toFixed(4)}, redeem winner for 1.0`));
            } else if (prob.total > 1.0) {
                console.log(chalk.yellow(`  → Arbitrage: Mint both for 1.0, sell for ${prob.total.toFixed(4)}`));
            }
            
            console.log(`  Normalized: YES ${(prob.yesNormalized * 100).toFixed(1)}% / NO ${(prob.noNormalized * 100).toFixed(1)}%`);
        }
    }
    
    console.log(chalk.green('\n✅ Test completed!\n'));
}

test().catch(console.error);