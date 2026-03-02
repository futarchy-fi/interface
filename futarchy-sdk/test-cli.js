// Test script for Futarchy CLI components

import { DataLayer } from './DataLayer.js';
import { MockFetcher } from './fetchers/MockFetcher.js';
import { createSupabasePoolFetcher } from './fetchers/SupabasePoolFetcher.js';
import chalk from 'chalk';
import Table from 'cli-table3';
import dotenv from 'dotenv';

dotenv.config();

async function testCLIComponents() {
    console.log(chalk.cyan.bold('\n🧪 Testing Futarchy CLI Components\n'));
    
    // Initialize DataLayer
    const dataLayer = new DataLayer();
    
    // Setup Fetchers
    console.log(chalk.yellow('Setting up fetchers...'));
    const mockFetcher = new MockFetcher();
    dataLayer.registerFetcher(mockFetcher);
    
    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
        const supabaseFetcher = createSupabasePoolFetcher(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_ANON_KEY
        );
        dataLayer.registerFetcher(supabaseFetcher);
        console.log(chalk.green('✓ Supabase fetcher configured'));
    } else {
        console.log(chalk.yellow('⚠ Using mock data only'));
    }
    
    // Test 1: Get Market Stats
    console.log(chalk.cyan('\n📊 Test 1: Fetching Market Stats'));
    try {
        const stats = await dataLayer.fetch('market.stats', {});
        if (stats.status === 'success') {
            console.log(chalk.green('✓ Market stats fetched successfully'));
            console.log(chalk.dim(JSON.stringify(stats.data, null, 2)));
        }
    } catch (error) {
        console.log(chalk.red(`✗ Error: ${error.message}`));
    }
    
    // Test 2: Get Pool Candles
    console.log(chalk.cyan('\n📊 Test 2: Fetching Pool Candles'));
    const poolAddress = process.env.DEFAULT_YES_POOL || '0xF336F812Db1ad142F22A9A4dd43D40e64B478361';
    
    try {
        const result = await dataLayer.fetch('pools.candle', {
            id: poolAddress,
            limit: 5
        });
        
        if (result.status === 'success' && result.data) {
            console.log(chalk.green(`✓ Fetched ${result.data.length} candles`));
            
            // Create table
            const table = new Table({
                head: ['Time', 'Price', 'Volume'],
                colWidths: [25, 15, 15],
                style: {
                    head: ['cyan'],
                    border: ['gray']
                }
            });
            
            result.data.forEach(candle => {
                const time = new Date(candle.timestamp * 1000).toLocaleString();
                table.push([
                    time,
                    chalk.green(`$${(candle.price || 0).toFixed(4)}`),
                    chalk.white((candle.volume || 0).toFixed(2))
                ]);
            });
            
            console.log(table.toString());
        }
    } catch (error) {
        console.log(chalk.red(`✗ Error: ${error.message}`));
    }
    
    // Test 3: Get Pool Info
    console.log(chalk.cyan('\n📊 Test 3: Fetching Pool Info'));
    try {
        const info = await dataLayer.fetch('pools.info', {
            id: poolAddress
        });
        
        if (info.status === 'success') {
            console.log(chalk.green('✓ Pool info fetched successfully'));
            console.log(chalk.gray('Pool ID:'), chalk.white(info.data.poolId));
            console.log(chalk.gray('Name:'), chalk.white(info.data.name));
            console.log(chalk.gray('Tokens:'), chalk.white(`${info.data.token0}/${info.data.token1}`));
            console.log(chalk.gray('Liquidity:'), chalk.white(info.data.liquidity));
        }
    } catch (error) {
        console.log(chalk.red(`✗ Error: ${error.message}`));
    }
    
    // Test 4: List All Available Operations
    console.log(chalk.cyan('\n📋 Test 4: Available Operations'));
    const operations = dataLayer.getAvailableOperations();
    console.log(chalk.green(`✓ Total operations available: ${operations.length}`));
    
    const opsTable = new Table({
        head: ['Operation', 'Type'],
        colWidths: [30, 15],
        style: {
            head: ['cyan'],
            border: ['gray']
        }
    });
    
    operations.forEach(op => {
        const type = op.startsWith('pools') || op.startsWith('user') || op.startsWith('market') 
            ? 'Fetcher' 
            : 'Executor';
        opsTable.push([op, type]);
    });
    
    console.log(opsTable.toString());
    
    console.log(chalk.green.bold('\n✅ All tests completed!'));
    console.log(chalk.dim('\nTo run the full interactive CLI: npm run futarchy-cli'));
}

// Run tests
testCLIComponents().catch(error => {
    console.error(chalk.red.bold(`\n❌ Test failed: ${error.message}`));
    process.exit(1);
});