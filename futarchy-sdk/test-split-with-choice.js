#!/usr/bin/env node

// Test script to verify split position with collateral choice
import { DataLayer } from './DataLayer.js';
import { createProposalFetcher } from './fetchers/ProposalFetcher.js';
import { createPublicClient, http } from 'viem';
import { gnosis } from 'viem/chains';
import chalk from 'chalk';

async function test() {
    console.log(chalk.cyan.bold('\n🧪 Testing Collateral Token Detection\n'));
    
    const dataLayer = new DataLayer();
    const proposalFetcher = createProposalFetcher();
    dataLayer.registerFetcher(proposalFetcher);
    
    const proposalAddress = '0xA94aB35282118f38b0b4FF89dDA7A5c04aD49371';
    
    // Create public client
    const publicClient = createPublicClient({
        chain: gnosis,
        transport: http('https://rpc.gnosischain.com')
    });
    
    // Fetch proposal tokens
    console.log(chalk.yellow('📝 Fetching proposal tokens...'));
    const tokens = await dataLayer.fetch('proposal.tokens', { proposalAddress });
    
    if (tokens.status === 'success') {
        const { companyToken, currencyToken } = tokens.data;
        console.log(chalk.green('✓'), 'Company Token:', companyToken);
        console.log(chalk.green('✓'), 'Currency Token:', currencyToken);
        
        // Extract addresses from token objects
        const companyAddress = companyToken.address || companyToken;
        const currencyAddress = currencyToken.address || currencyToken;
        
        // Get token symbols and names
        console.log(chalk.yellow('\n📊 Fetching token details...'));
        
        const tokenABI = [
            {
                name: 'symbol',
                type: 'function',
                stateMutability: 'view',
                inputs: [],
                outputs: [{ name: '', type: 'string' }]
            },
            {
                name: 'name',
                type: 'function',
                stateMutability: 'view',
                inputs: [],
                outputs: [{ name: '', type: 'string' }]
            },
            {
                name: 'decimals',
                type: 'function',
                stateMutability: 'view',
                inputs: [],
                outputs: [{ name: '', type: 'uint8' }]
            }
        ];
        
        try {
            // Fetch company token details
            const [companySymbol, companyName, companyDecimals] = await Promise.all([
                publicClient.readContract({
                    address: companyAddress,
                    abi: tokenABI,
                    functionName: 'symbol'
                }),
                publicClient.readContract({
                    address: companyAddress,
                    abi: tokenABI,
                    functionName: 'name'
                }),
                publicClient.readContract({
                    address: companyAddress,
                    abi: tokenABI,
                    functionName: 'decimals'
                })
            ]);
            
            console.log(chalk.cyan('\n💰 Company Collateral Token:'));
            console.log('  Address:', companyAddress);
            console.log('  Symbol:', companySymbol);
            console.log('  Name:', companyName);
            console.log('  Decimals:', companyDecimals);
            
            // Fetch currency token details
            const [currencySymbol, currencyName, currencyDecimals] = await Promise.all([
                publicClient.readContract({
                    address: currencyAddress,
                    abi: tokenABI,
                    functionName: 'symbol'
                }),
                publicClient.readContract({
                    address: currencyAddress,
                    abi: tokenABI,
                    functionName: 'name'
                }),
                publicClient.readContract({
                    address: currencyAddress,
                    abi: tokenABI,
                    functionName: 'decimals'
                })
            ]);
            
            console.log(chalk.cyan('\n💵 Currency Collateral Token:'));
            console.log('  Address:', currencyAddress);
            console.log('  Symbol:', currencySymbol);
            console.log('  Name:', currencyName);
            console.log('  Decimals:', currencyDecimals);
            
            // Check if sDAI (common currency token)
            if (currencySymbol === 'sDAI') {
                console.log(chalk.green('\n✓ Currency token is sDAI (Savings DAI)'));
                console.log('  Users can split sDAI to get YES_CURRENCY/NO_CURRENCY tokens');
            }
            
            // Show split options
            console.log(chalk.yellow('\n📋 Split Options Available:'));
            console.log(`1. Split ${companySymbol} → Receive YES_COMPANY + NO_COMPANY`);
            console.log(`2. Split ${currencySymbol} → Receive YES_CURRENCY + NO_CURRENCY`);
            
            console.log(chalk.gray('\nNote: After splitting, users can:'));
            console.log(chalk.gray('- Trade individual YES/NO tokens on DEX pools'));
            console.log(chalk.gray('- Merge YES+NO tokens back to collateral'));
            console.log(chalk.gray('- Redeem winning tokens after proposal finalizes'));
            
        } catch (error) {
            console.error(chalk.red('Error fetching token details:'), error);
        }
    }
    
    console.log(chalk.green('\n✅ Test completed!\n'));
}

test().catch(console.error);