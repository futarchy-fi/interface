#!/usr/bin/env node

// Simple test to verify pool discovery and price fetching
import { DataLayer } from './DataLayer.js';
import { createPoolDiscoveryFetcher } from './fetchers/PoolDiscoveryFetcher.js';
import { createProposalFetcher } from './fetchers/ProposalFetcher.js';
import chalk from 'chalk';

async function test() {
    console.log(chalk.cyan.bold('\n🚀 Testing Futarchy Pool Discovery & Prices\n'));
    
    const dataLayer = new DataLayer();
    
    // Register fetchers
    const poolFetcher = createPoolDiscoveryFetcher();
    const proposalFetcher = createProposalFetcher();
    dataLayer.registerFetcher(poolFetcher);
    dataLayer.registerFetcher(proposalFetcher);
    
    const proposalAddress = '0xA94aB35282118f38b0b4FF89dDA7A5c04aD49371';
    
    // 1. Fetch proposal details
    console.log(chalk.yellow('📝 Fetching proposal details...'));
    const details = await dataLayer.fetch('proposal.details', { proposalAddress });
    if (details.status === 'success') {
        console.log(chalk.green('✓'), 'Market:', details.data.marketName);
        console.log(chalk.green('✓'), 'Question:', details.data.encodedQuestion);
    }
    
    // 2. Discover pools
    console.log(chalk.yellow('\n🔍 Discovering pools...'));
    const pools = await dataLayer.fetch('pools.discover', { proposalAddress });
    if (pools.status === 'success') {
        console.log(chalk.green('✓'), `Found ${pools.data.totalPools} pools`);
        console.log('  - Conditional pools:', pools.data.conditionalPools.length);
        console.log('  - Prediction pools:', pools.data.predictionPools.length);
    }
    
    // 3. Fetch prices
    console.log(chalk.yellow('\n💱 Fetching prices...'));
    const prices = await dataLayer.fetch('pools.prices', { proposalAddress });
    if (prices.status === 'success') {
        const priceData = prices.data.prices;
        
        console.log(chalk.cyan('\nPrediction Market Prices (vs sDAI):'));
        
        // Show key prices
        const markets = [
            { name: 'YES_COMPANY/BASE_CURRENCY', label: 'YES_COMPANY', useInverse: true },
            { name: 'NO_COMPANY/BASE_CURRENCY', label: 'NO_COMPANY', useInverse: true },
            { name: 'YES_CURRENCY/BASE_CURRENCY', label: 'YES_CURRENCY', useInverse: false },
            { name: 'NO_CURRENCY/BASE_CURRENCY', label: 'NO_CURRENCY', useInverse: false }
        ];
        
        for (const market of markets) {
            if (priceData[market.name]) {
                const price = market.useInverse ? 
                    priceData[market.name].priceInverse : 
                    priceData[market.name].price;
                console.log(`  ${market.label}: ${price.toFixed(6)} sDAI`);
            }
        }
        
        // Display implied probabilities
        if (prices.data.impliedProbability) {
            const prob = prices.data.impliedProbability;
            console.log(chalk.cyan('\n📊 Implied Probabilities:'));
            
            // Show prediction pool method (most accurate)
            if (prob.fromPredictionCurrency) {
                console.log(chalk.yellow('From Prediction Markets (YES/NO vs sDAI):'));
                console.log(chalk.green(`  YES price: ${prob.fromPredictionCurrency.yesPrice.toFixed(6)} sDAI = ${(prob.fromPredictionCurrency.yesPrice * 100).toFixed(2)}%`));
                console.log(chalk.red(`  NO price: ${prob.fromPredictionCurrency.noPrice.toFixed(6)} sDAI = ${(prob.fromPredictionCurrency.noPrice * 100).toFixed(2)}%`));
                console.log(chalk.gray(`  Sum: ${prob.fromPredictionCurrency.total.toFixed(6)} (${prob.fromPredictionCurrency.total > 1 ? 'arbitrage opportunity' : 'efficient'}`));
                
                if (Math.abs(prob.fromPredictionCurrency.total - 1) > 0.1) {
                    console.log(chalk.yellow('\nNormalized Probabilities:'));
                    console.log(chalk.green(`  YES: ${(prob.fromPredictionCurrency.yesNormalized * 100).toFixed(1)}%`));
                    console.log(chalk.red(`  NO: ${(prob.fromPredictionCurrency.noNormalized * 100).toFixed(1)}%`));
                }
            }
            
            // Show conditional pool method for comparison
            if (prob.fromConditionalCurrency) {
                console.log(chalk.yellow('\nFrom Conditional Pools (YES/NO ratio):'));
                console.log(chalk.green(`  YES: ${(prob.fromConditionalCurrency.yes * 100).toFixed(1)}%`));
                console.log(chalk.red(`  NO: ${(prob.fromConditionalCurrency.no * 100).toFixed(1)}%`));
            }
        }
    }
    
    console.log(chalk.green('\n✅ Test completed successfully!\n'));
}

test().catch(console.error);