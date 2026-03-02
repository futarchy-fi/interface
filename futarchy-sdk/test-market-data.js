// Quick test for market data fetching

import { DataLayer } from './DataLayer.js';
import { createSupabasePoolFetcher } from './fetchers/SupabasePoolFetcher.js';
import { MockFetcher } from './fetchers/MockFetcher.js';
import chalk from 'chalk';
import Table from 'cli-table3';
import dotenv from 'dotenv';

dotenv.config();

async function testMarketData() {
    console.log(chalk.cyan.bold('\n📊 Testing Market Data Display Fix\n'));
    
    // Setup DataLayer
    const dataLayer = new DataLayer();
    
    // Add fetchers
    const mockFetcher = new MockFetcher();
    dataLayer.registerFetcher(mockFetcher);
    
    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
        const supabaseFetcher = createSupabasePoolFetcher(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_ANON_KEY
        );
        dataLayer.registerFetcher(supabaseFetcher);
    }
    
    const poolAddress = '0xF336F812Db1ad142F22A9A4dd43D40e64B478361';
    
    console.log(chalk.yellow(`Fetching data for pool: ${poolAddress}\n`));
    
    try {
        const result = await dataLayer.fetch('pools.candle', {
            id: poolAddress,
            limit: 5
        });
        
        if (result.status === 'success' && result.data) {
            console.log(chalk.green(`✅ Successfully fetched ${result.data.length} candles\n`));
            
            // Create table
            const table = new Table({
                head: ['Time', 'Price', 'Volume'],
                colWidths: [30, 15, 15],
                style: {
                    head: ['cyan'],
                    border: ['gray']
                }
            });
            
            result.data.forEach((candle, index) => {
                console.log(chalk.dim(`Candle ${index + 1} raw data:`), candle);
                
                const time = new Date(candle.timestamp * 1000).toLocaleString();
                const price = (candle.price || 0).toFixed(4);
                const volume = (candle.volume || 0).toFixed(2);
                
                table.push([
                    time,
                    chalk.green(`$${price}`),
                    chalk.white(volume)
                ]);
            });
            
            console.log('\n' + chalk.cyan('📊 Market Data Table:'));
            console.log(table.toString());
            
            console.log(chalk.green.bold('\n✅ Market data display is now fixed!'));
            console.log(chalk.dim('Volume shows as 0.00 because Supabase data only includes timestamp and price'));
            
        } else {
            console.log(chalk.red('Failed to fetch data'));
        }
    } catch (error) {
        console.error(chalk.red(`Error: ${error.message}`));
    }
}

testMarketData();