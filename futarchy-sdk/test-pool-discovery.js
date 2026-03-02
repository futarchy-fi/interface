// Test the PoolDiscoveryFetcher

import { DataLayer } from './DataLayer.js';
import { createPoolDiscoveryFetcher } from './fetchers/PoolDiscoveryFetcher.js';
import chalk from 'chalk';
import Table from 'cli-table3';
import boxen from 'boxen';
import dotenv from 'dotenv';

dotenv.config();

async function testPoolDiscovery() {
    console.log(chalk.cyan.bold('\n🏊 Testing Pool Discovery Fetcher\n'));
    
    // Initialize DataLayer
    const dataLayer = new DataLayer();
    
    // Create and register PoolDiscoveryFetcher
    const poolFetcher = createPoolDiscoveryFetcher(
        process.env.RPC_URL || 'https://rpc.gnosischain.com'
    );
    dataLayer.registerFetcher(poolFetcher);
    
    // Test proposals
    const proposals = [
        {
            address: '0xDA36a35CA4Fe6214C37a452159C0C9EAd45D5919',
            name: 'GnosisPay €2M Proposal'
        },
        {
            address: '0xA94aB35282118f38b0b4FF89dDA7A5c04aD49371',
            name: 'Kleros KIP-77 Proposal'
        }
    ];
    
    for (const proposal of proposals) {
        console.log(chalk.yellow(`\nTesting: ${proposal.name}`));
        console.log(chalk.gray(`Address: ${proposal.address}\n`));
        
        // Test 1: Discover all pools
        console.log(chalk.cyan('📋 Discovering all pools...'));
        try {
            const discovery = await dataLayer.fetch('pools.discover', { 
                proposalAddress: proposal.address 
            });
            
            if (discovery.status === 'success') {
                const data = discovery.data;
                console.log(chalk.green(`✓ Found ${data.totalPools} pools`));
                
                const summaryBox = boxen(
                    `Total Pools: ${data.totalPools}
Conditional Pools: ${data.conditionalPools.length}
Prediction Pools: ${data.predictionPools.length}`,
                    {
                        padding: 1,
                        borderStyle: 'round',
                        borderColor: 'cyan',
                        title: 'Pool Discovery Summary'
                    }
                );
                console.log(summaryBox);
                
                // Show pools in table
                if (data.totalPools > 0) {
                    const table = new Table({
                        head: ['Type', 'Name', 'Address'],
                        colWidths: [15, 30, 45],
                        style: {
                            head: ['cyan'],
                            border: ['gray']
                        }
                    });
                    
                    [...data.conditionalPools, ...data.predictionPools].forEach(pool => {
                        table.push([
                            chalk.yellow(pool.type),
                            chalk.white(pool.name),
                            chalk.gray(pool.address)
                        ]);
                    });
                    
                    console.log(table.toString());
                }
                
                // Test liquidity
                const poolAddresses = [
                    ...data.conditionalPools.map(p => p.address),
                    ...data.predictionPools.map(p => p.address)
                ].filter(addr => addr);
                
                if (poolAddresses.length > 0) {
                    console.log(chalk.cyan('\n📋 Checking liquidity...'));
                    const liquidity = await dataLayer.fetch('pools.liquidity', { poolAddresses });
                    
                    if (liquidity.status === 'success') {
                        console.log(chalk.green(`✓ ${liquidity.data.poolsWithLiquidity}/${liquidity.data.totalPools} pools have liquidity`));
                    }
                }
                
                // Test prices
                console.log(chalk.cyan('\n📋 Fetching pool prices...'));
                const prices = await dataLayer.fetch('pools.prices', { 
                    proposalAddress: proposal.address 
                });
                
                if (prices.status === 'success' && Object.keys(prices.data.prices).length > 0) {
                    console.log(chalk.green('✓ Prices fetched'));
                    
                    for (const [poolName, priceData] of Object.entries(prices.data.prices)) {
                        console.log(chalk.gray(`  ${poolName}:`), chalk.white(priceData.price.toFixed(6)));
                    }
                    
                    if (prices.data.impliedProbabilities) {
                        const probs = prices.data.impliedProbabilities;
                        console.log(chalk.cyan('\n🎲 Implied Probabilities:'));
                        if (probs.fromCompany !== undefined) {
                            console.log(chalk.gray('  From Company pools:'), 
                                chalk.green(`${(probs.fromCompany * 100).toFixed(1)}% YES`));
                        }
                        if (probs.fromCurrency !== undefined) {
                            console.log(chalk.gray('  From Currency pools:'), 
                                chalk.green(`${(probs.fromCurrency * 100).toFixed(1)}% YES`));
                        }
                    }
                }
                
            } else {
                console.log(chalk.red(`✗ Failed: ${discovery.reason}`));
            }
        } catch (error) {
            console.log(chalk.red(`✗ Error: ${error.message}`));
        }
    }
    
    // List all available operations
    console.log(chalk.cyan('\n📋 Available Pool Discovery Operations:'));
    const operations = dataLayer.getAvailableOperations().filter(op => op.startsWith('pools.'));
    operations.forEach(op => {
        const isNew = op.includes('discover') || op.includes('conditional') || op.includes('probability');
        console.log(chalk.gray('  •'), isNew ? chalk.green.bold(op + ' (NEW)') : chalk.white(op));
    });
    
    console.log(chalk.green.bold('\n✅ Pool Discovery test completed!'));
    console.log(chalk.dim('The Discover Pools feature is now available in the CLI'));
}

testPoolDiscovery().catch(error => {
    console.error(chalk.red.bold(`\n❌ Test failed: ${error.message}`));
    process.exit(1);
});