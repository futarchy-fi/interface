#!/usr/bin/env node

// Live test of MCP Futarchy Server
// This demonstrates all the available tools

import chalk from 'chalk';
import ora from 'ora';
import { FutarchyMCPServer } from './mcp-futarchy-server.js';

async function testMCPTools() {
    console.log(chalk.cyan.bold('\n🧪 Testing MCP Futarchy Server Tools\n'));
    
    const server = new FutarchyMCPServer();
    
    // Test 1: Load Proposal
    console.log(chalk.yellow('📋 Test 1: Loading Proposal...'));
    const spinner1 = ora('Loading proposal 0xaCf939B88647935799C7612809472bB29d5472e7').start();
    
    try {
        const proposalResult = await server.handleLoadProposal({
            proposalId: '0xaCf939B88647935799C7612809472bB29d5472e7'
        });
        
        const data = JSON.parse(proposalResult.content[0].text);
        spinner1.succeed('Proposal loaded successfully!');
        console.log(chalk.gray('  Address:'), data.proposal.address);
        console.log(chalk.gray('  Oracle:'), data.proposal.oracle);
        console.log(chalk.gray('  Company Token:'), data.proposal.companyToken);
        console.log(chalk.gray('  Currency Token:'), data.proposal.currencyToken);
        if (data.pools) {
            console.log(chalk.gray('  Pools found:'), 
                `${data.pools.conditional} conditional, ${data.pools.prediction} prediction`);
        }
    } catch (error) {
        spinner1.fail(`Failed to load proposal: ${error.message}`);
    }
    
    // Test 2: Get Prices
    console.log(chalk.yellow('\n💰 Test 2: Getting Prices...'));
    const spinner2 = ora('Fetching current prices').start();
    
    try {
        const pricesResult = await server.handleGetPrices();
        const prices = JSON.parse(pricesResult.content[0].text);
        spinner2.succeed('Prices fetched successfully!');
        
        if (prices.sdaiRate) {
            console.log(chalk.gray('  sDAI Rate:'), prices.sdaiRate.toFixed(4));
        }
        
        // Show other prices if available
        Object.keys(prices).forEach(key => {
            if (key !== 'sdaiRate') {
                console.log(chalk.gray(`  ${key}:`), JSON.stringify(prices[key]));
            }
        });
    } catch (error) {
        spinner2.fail(`Failed to get prices: ${error.message}`);
    }
    
    // Test 3: Check Balances (will fail without wallet)
    console.log(chalk.yellow('\n🏦 Test 3: Checking Balances...'));
    const spinner3 = ora('Getting account balances').start();
    
    try {
        const balancesResult = await server.handleGetBalances();
        const balances = JSON.parse(balancesResult.content[0].text);
        spinner3.succeed('Balances fetched successfully!');
        console.log(chalk.gray('  Balances:'), balances);
    } catch (error) {
        if (error.message.includes('No wallet')) {
            spinner3.warn('No wallet connected (expected in read-only mode)');
        } else {
            spinner3.fail(`Failed to get balances: ${error.message}`);
        }
    }
    
    // Test 4: Position Analysis (will fail without wallet)
    console.log(chalk.yellow('\n📊 Test 4: Position Analysis...'));
    const spinner4 = ora('Analyzing positions').start();
    
    try {
        const analysisResult = await server.handlePositionAnalysis();
        const analysis = JSON.parse(analysisResult.content[0].text);
        spinner4.succeed('Position analysis complete!');
        console.log(chalk.gray('  Analysis:'), analysis);
    } catch (error) {
        if (error.message.includes('No wallet')) {
            spinner4.warn('No wallet connected (expected in read-only mode)');
        } else {
            spinner4.fail(`Failed to analyze positions: ${error.message}`);
        }
    }
    
    // Summary
    console.log(chalk.green.bold('\n✅ MCP Server Test Complete!\n'));
    console.log(chalk.cyan('Available MCP Tools:'));
    console.log(chalk.gray('  • loadProposal - Load futarchy proposals'));
    console.log(chalk.gray('  • getBalances - Check token balances'));
    console.log(chalk.gray('  • getPrices - Get current market prices'));
    console.log(chalk.gray('  • splitPosition - Split collateral into YES/NO'));
    console.log(chalk.gray('  • mergePositions - Merge YES/NO back to collateral'));
    console.log(chalk.gray('  • swapTokens - Execute market swaps'));
    console.log(chalk.gray('  • getPositionAnalysis - Analyze your positions'));
    console.log(chalk.gray('  • estimateSwap - Get swap quotes'));
    
    console.log(chalk.cyan('\n📝 Usage in Claude:'));
    console.log(chalk.gray('  Just ask: "Use the futarchy tools to [your request]"'));
}

// Run the test
testMCPTools().catch(console.error);