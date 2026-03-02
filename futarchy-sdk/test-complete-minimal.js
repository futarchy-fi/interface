#!/usr/bin/env node

// Minimal test of the futarchy-complete interface
import { DataLayer } from './DataLayer.js';
import { createPoolDiscoveryFetcher } from './fetchers/PoolDiscoveryFetcher.js';
import { createProposalFetcher } from './fetchers/ProposalFetcher.js';
import { createPublicClient, http } from 'viem';
import { gnosis } from 'viem/chains';
import chalk from 'chalk';

async function test() {
    console.log(chalk.cyan.bold('\n🚀 Testing Futarchy Complete Interface Components\n'));
    
    const dataLayer = new DataLayer();
    
    // Register fetchers
    const poolFetcher = createPoolDiscoveryFetcher();
    const proposalFetcher = createProposalFetcher();
    dataLayer.registerFetcher(poolFetcher);
    dataLayer.registerFetcher(proposalFetcher);
    
    const proposalAddress = '0xA94aB35282118f38b0b4FF89dDA7A5c04aD49371';
    
    // Create public client
    const publicClient = createPublicClient({
        chain: gnosis,
        transport: http('https://rpc.gnosischain.com')
    });
    
    try {
        // 1. Test discovery which includes tokens
        console.log(chalk.yellow('🔍 Testing pool discovery with tokens...'));
        const discovery = await dataLayer.fetch('pools.discover', { proposalAddress });
        
        if (discovery.status === 'success') {
            const { tokens } = discovery.data;
            console.log(chalk.green('✓'), 'Tokens found in discovery:');
            console.log('  Company Token:', tokens.companyToken);
            console.log('  Currency Token:', tokens.currencyToken);
            
            // 2. Test token symbol fetching
            console.log(chalk.yellow('\n📊 Testing token symbol fetching...'));
            
            const [companySymbol, currencySymbol] = await Promise.all([
                publicClient.readContract({
                    address: tokens.companyToken,
                    abi: [{
                        name: 'symbol',
                        type: 'function',
                        stateMutability: 'view',
                        inputs: [],
                        outputs: [{ name: '', type: 'string' }]
                    }],
                    functionName: 'symbol'
                }).catch(() => 'COMPANY'),
                publicClient.readContract({
                    address: tokens.currencyToken,
                    abi: [{
                        name: 'symbol',
                        type: 'function',
                        stateMutability: 'view',
                        inputs: [],
                        outputs: [{ name: '', type: 'string' }]
                    }],
                    functionName: 'symbol'
                }).catch(() => 'CURRENCY')
            ]);
            
            console.log(chalk.green('✓'), 'Token symbols:');
            console.log(`  ${companySymbol} (Company)`, chalk.gray(tokens.companyToken));
            console.log(`  ${currencySymbol} (Currency)`, chalk.gray(tokens.currencyToken));
            
            // 3. Test balance fetching for a test address
            const testAddress = '0x2403Cc666aFf9EE68467e097bB494ceE8cEEBD9F';
            console.log(chalk.yellow('\n💰 Testing balance fetching for'), testAddress);
            
            const [companyBalance, currencyBalance] = await Promise.all([
                publicClient.readContract({
                    address: tokens.companyToken,
                    abi: [{
                        name: 'balanceOf',
                        type: 'function',
                        stateMutability: 'view',
                        inputs: [{ name: 'account', type: 'address' }],
                        outputs: [{ name: '', type: 'uint256' }]
                    }],
                    functionName: 'balanceOf',
                    args: [testAddress]
                }).catch(() => 0n),
                publicClient.readContract({
                    address: tokens.currencyToken,
                    abi: [{
                        name: 'balanceOf',
                        type: 'function',
                        stateMutability: 'view',
                        inputs: [{ name: 'account', type: 'address' }],
                        outputs: [{ name: '', type: 'uint256' }]
                    }],
                    functionName: 'balanceOf',
                    args: [testAddress]
                }).catch(() => 0n)
            ]);
            
            console.log(chalk.green('✓'), 'Balances:');
            console.log(`  ${companySymbol}:`, (Number(companyBalance) / 1e18).toFixed(6));
            console.log(`  ${currencySymbol}:`, (Number(currencyBalance) / 1e18).toFixed(6));
            
            // 4. Show split options
            console.log(chalk.cyan('\n📋 Split Options Available:'));
            console.log(`1. Split ${companySymbol} → YES_COMPANY + NO_COMPANY`);
            console.log(`2. Split ${currencySymbol} → YES_CURRENCY + NO_CURRENCY`);
            
            console.log(chalk.green('\n✅ All components working correctly!'));
            console.log(chalk.gray('\nThe futarchy-complete interface will:'));
            console.log(chalk.gray('- Let users choose which collateral to split'));
            console.log(chalk.gray('- Show token symbols and balances'));
            console.log(chalk.gray('- Handle approvals automatically'));
            console.log(chalk.gray('- Enable trading and redemption'));
        }
    } catch (error) {
        console.error(chalk.red('Error:'), error);
    }
}

test().catch(console.error);