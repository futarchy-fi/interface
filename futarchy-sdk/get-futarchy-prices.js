// Simple script to get Futarchy pool prices
import { DataLayer } from './DataLayer.js';
import { createPoolDiscoveryFetcher } from './fetchers/PoolDiscoveryFetcher.js';
import chalk from 'chalk';

// Initialize DataLayer
const dataLayer = new DataLayer();

// Create and register the pool discovery fetcher
const poolFetcher = createPoolDiscoveryFetcher();
dataLayer.registerFetcher(poolFetcher);

// Proposal address (change this to any proposal you want)
const PROPOSAL_ADDRESS = '0xA94aB35282118f38b0b4FF89dDA7A5c04aD49371'; // Kleros proposal

async function getPrices() {
    console.log(chalk.cyan.bold('\n🏊 Fetching Futarchy Pool Prices\n'));
    console.log(chalk.gray(`Proposal: ${PROPOSAL_ADDRESS}\n`));
    
    // Discover pools
    const discovery = await dataLayer.fetch('pools.discover', { 
        proposalAddress: PROPOSAL_ADDRESS 
    });
    
    if (discovery.status === 'success') {
        console.log(chalk.green(`✓ Found ${discovery.data.totalPools} pools\n`));
        
        // Get prices
        const prices = await dataLayer.fetch('pools.prices', { 
            proposalAddress: PROPOSAL_ADDRESS 
        });
        
        if (prices.status === 'success') {
            console.log(chalk.yellow('💱 Current Prices:\n'));
            
            // Show prediction pools (most important for probability)
            console.log(chalk.cyan('Prediction Markets (vs sDAI):'));
            
            const priceData = prices.data.prices;
            
            // YES tokens
            if (priceData['YES_COMPANY/BASE_CURRENCY']) {
                const yesCompanyPrice = priceData['YES_COMPANY/BASE_CURRENCY'].priceInverse;
                console.log(chalk.white(`  YES_COMPANY: ${yesCompanyPrice.toFixed(6)} sDAI`));
            }
            
            if (priceData['YES_CURRENCY/BASE_CURRENCY']) {
                const yesCurrencyPrice = priceData['YES_CURRENCY/BASE_CURRENCY'].price;
                console.log(chalk.white(`  YES_CURRENCY: ${yesCurrencyPrice.toFixed(6)} sDAI`));
            }
            
            // NO tokens
            if (priceData['NO_COMPANY/BASE_CURRENCY']) {
                const noCompanyPrice = priceData['NO_COMPANY/BASE_CURRENCY'].priceInverse;
                console.log(chalk.white(`  NO_COMPANY: ${noCompanyPrice.toFixed(6)} sDAI`));
            }
            
            if (priceData['NO_CURRENCY/BASE_CURRENCY']) {
                const noCurrencyPrice = priceData['NO_CURRENCY/BASE_CURRENCY'].price;
                console.log(chalk.white(`  NO_CURRENCY: ${noCurrencyPrice.toFixed(6)} sDAI`));
            }
            
            // Calculate implied probabilities
            console.log(chalk.cyan('\n📊 Implied Probabilities:'));
            
            // From company tokens
            const yesCompany = priceData['YES_COMPANY/BASE_CURRENCY']?.priceInverse || 0;
            const noCompany = priceData['NO_COMPANY/BASE_CURRENCY']?.priceInverse || 0;
            const totalCompany = yesCompany + noCompany;
            
            if (totalCompany > 0) {
                const probYesCompany = (yesCompany / totalCompany) * 100;
                const probNoCompany = (noCompany / totalCompany) * 100;
                console.log(chalk.white(`  From Company Tokens:`));
                console.log(chalk.green(`    YES: ${probYesCompany.toFixed(1)}%`));
                console.log(chalk.red(`    NO: ${probNoCompany.toFixed(1)}%`));
            }
            
            // From currency tokens
            const yesCurrency = priceData['YES_CURRENCY/BASE_CURRENCY']?.price || 0;
            const noCurrency = priceData['NO_CURRENCY/BASE_CURRENCY']?.price || 0;
            const totalCurrency = yesCurrency + noCurrency;
            
            if (totalCurrency > 0) {
                const probYesCurrency = (yesCurrency / totalCurrency) * 100;
                const probNoCurrency = (noCurrency / totalCurrency) * 100;
                console.log(chalk.white(`  From Currency Tokens:`));
                console.log(chalk.green(`    YES: ${probYesCurrency.toFixed(1)}%`));
                console.log(chalk.red(`    NO: ${probNoCurrency.toFixed(1)}%`));
            }
            
            // Show all pool addresses
            console.log(chalk.cyan('\n📍 Pool Addresses:'));
            for (const [poolName, data] of Object.entries(priceData)) {
                console.log(chalk.gray(`  ${poolName}: ${data.poolAddress}`));
            }
            
        } else {
            console.log(chalk.red('Failed to fetch prices'));
        }
    } else {
        console.log(chalk.red('Failed to discover pools'));
    }
}

// Run the script
getPrices().catch(console.error);