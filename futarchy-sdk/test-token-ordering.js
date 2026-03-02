#!/usr/bin/env node

// Debug script to understand token ordering
import { DataLayer } from './DataLayer.js';
import { createPoolDiscoveryFetcher } from './fetchers/PoolDiscoveryFetcher.js';
import { createProposalFetcher } from './fetchers/ProposalFetcher.js';
import chalk from 'chalk';

async function test() {
    console.log(chalk.cyan.bold('\n🔍 Debugging Token Ordering\n'));
    
    const dataLayer = new DataLayer();
    
    // Register fetchers
    const poolFetcher = createPoolDiscoveryFetcher();
    const proposalFetcher = createProposalFetcher();
    dataLayer.registerFetcher(poolFetcher);
    dataLayer.registerFetcher(proposalFetcher);
    
    const proposalAddress = '0xA94aB35282118f38b0b4FF89dDA7A5c04aD49371';
    
    // Fetch prices
    const prices = await dataLayer.fetch('pools.prices', { proposalAddress });
    
    if (prices.status === 'success') {
        const { prices: poolPrices, tokens } = prices.data;
        
        console.log(chalk.yellow('Token Addresses:'));
        console.log('  YES_COMPANY:', tokens.yesCompany);
        console.log('  YES_CURRENCY:', tokens.yesCurrency);
        console.log('  NO_COMPANY:', tokens.noCompany);
        console.log('  NO_CURRENCY:', tokens.noCurrency);
        console.log('  BASE_CURRENCY:', tokens.currencyToken);
        
        // Check conditional pool
        console.log(chalk.cyan('\n\nConditional Pool Analysis:'));
        
        if (poolPrices['YES_COMPANY/YES_CURRENCY']) {
            const pool = poolPrices['YES_COMPANY/YES_CURRENCY'];
            console.log(chalk.yellow('\nPool: YES_COMPANY/YES_CURRENCY'));
            console.log('  Actual token0:', pool.token0);
            console.log('  Actual token1:', pool.token1);
            
            // Check which is which
            const yesCurrencyIsToken0 = pool.token0.toLowerCase() === tokens.yesCurrency.toLowerCase();
            const yesCompanyIsToken0 = pool.token0.toLowerCase() === tokens.yesCompany.toLowerCase();
            
            console.log(`  YES_CURRENCY is token0? ${yesCurrencyIsToken0}`);
            console.log(`  YES_COMPANY is token0? ${yesCompanyIsToken0}`);
            
            // The pool's raw price is always token1/token0
            console.log(`\n  Raw price (token1/token0): ${pool.price}`);
            console.log(`  Inverse (token0/token1): ${pool.priceInverse}`);
            
            if (yesCurrencyIsToken0) {
                console.log(chalk.green('\n  Pool order: YES_CURRENCY/YES_COMPANY'));
                console.log(`  Raw price means: 1 YES_CURRENCY = ${pool.price} YES_COMPANY`);
                console.log(`  Inverse means: 1 YES_COMPANY = ${pool.priceInverse} YES_CURRENCY`);
                console.log(chalk.cyan(`  → We want: 1 YES_COMPANY = X YES_CURRENCY, so use INVERSE`));
            } else {
                console.log(chalk.green('\n  Pool order: YES_COMPANY/YES_CURRENCY'));
                console.log(`  Raw price means: 1 YES_COMPANY = ${pool.price} YES_CURRENCY`);
                console.log(`  Inverse means: 1 YES_CURRENCY = ${pool.priceInverse} YES_COMPANY`);
                console.log(chalk.cyan(`  → We want: 1 YES_COMPANY = X YES_CURRENCY, so use RAW PRICE`));
            }
        }
        
        // Check prediction pool
        console.log(chalk.cyan('\n\nPrediction Pool Analysis:'));
        
        if (poolPrices['YES_CURRENCY/BASE_CURRENCY']) {
            const pool = poolPrices['YES_CURRENCY/BASE_CURRENCY'];
            console.log(chalk.yellow('\nPool: YES_CURRENCY/sDAI'));
            console.log('  Actual token0:', pool.token0);
            console.log('  Actual token1:', pool.token1);
            
            const yesCurrencyIsToken0 = pool.token0.toLowerCase() === tokens.yesCurrency.toLowerCase();
            const sdaiIsToken0 = pool.token0.toLowerCase() === tokens.currencyToken.toLowerCase();
            
            console.log(`  YES_CURRENCY is token0? ${yesCurrencyIsToken0}`);
            console.log(`  sDAI is token0? ${sdaiIsToken0}`);
            
            console.log(`\n  Raw price (token1/token0): ${pool.price}`);
            console.log(`  Inverse (token0/token1): ${pool.priceInverse}`);
            
            if (yesCurrencyIsToken0) {
                console.log(chalk.green('\n  Pool order: YES_CURRENCY/sDAI'));
                console.log(`  Raw price means: 1 YES_CURRENCY = ${pool.price} sDAI`);
                console.log(`  Inverse means: 1 sDAI = ${pool.priceInverse} YES_CURRENCY`);
                console.log(chalk.cyan(`  → We want: 1 YES_CURRENCY = X sDAI (for probability), so use RAW PRICE`));
            } else {
                console.log(chalk.green('\n  Pool order: sDAI/YES_CURRENCY'));
                console.log(`  Raw price means: 1 sDAI = ${pool.price} YES_CURRENCY`);
                console.log(`  Inverse means: 1 YES_CURRENCY = ${pool.priceInverse} sDAI`);
                console.log(chalk.cyan(`  → We want: 1 YES_CURRENCY = X sDAI (for probability), so use INVERSE`));
            }
        }
    }
    
    console.log(chalk.green('\n✅ Analysis complete!\n'));
}

test().catch(console.error);