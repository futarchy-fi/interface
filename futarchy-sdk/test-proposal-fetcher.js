// Test the ProposalFetcher

import { DataLayer } from './DataLayer.js';
import { createProposalFetcher } from './fetchers/ProposalFetcher.js';
import chalk from 'chalk';
import Table from 'cli-table3';
import boxen from 'boxen';
import dotenv from 'dotenv';

dotenv.config();

async function testProposalFetcher() {
    console.log(chalk.cyan.bold('\n🏛️ Testing Futarchy Proposal Fetcher\n'));
    
    // Initialize DataLayer
    const dataLayer = new DataLayer();
    
    // Create and register ProposalFetcher
    const proposalFetcher = createProposalFetcher(
        process.env.RPC_URL || 'https://rpc.gnosischain.com'
    );
    dataLayer.registerFetcher(proposalFetcher);
    
    // Test proposal address
    const proposalAddress = process.env.DEFAULT_PROPOSAL || '0xDA36a35CA4Fe6214C37a452159C0C9EAd45D5919';
    
    console.log(chalk.yellow(`Testing with proposal: ${proposalAddress}\n`));
    
    // Test 1: Fetch basic info
    console.log(chalk.cyan('📋 Test 1: Fetching Basic Proposal Info'));
    try {
        const info = await dataLayer.fetch('proposal.info', { proposalAddress });
        
        if (info.status === 'success') {
            console.log(chalk.green('✓ Basic info fetched successfully'));
            console.log(chalk.gray('  Market Name:'), chalk.white(info.data.marketName));
            console.log(chalk.gray('  Question:'), chalk.white(info.data.encodedQuestion));
        } else {
            console.log(chalk.red(`✗ Failed: ${info.reason}`));
        }
    } catch (error) {
        console.log(chalk.red(`✗ Error: ${error.message}`));
    }
    
    // Test 2: Fetch detailed info
    console.log(chalk.cyan('\n📋 Test 2: Fetching Detailed Proposal Data'));
    try {
        const details = await dataLayer.fetch('proposal.details', { proposalAddress });
        
        if (details.status === 'success') {
            console.log(chalk.green('✓ Detailed data fetched successfully'));
            
            const detailsBox = boxen(
                `Market: ${details.data.marketName}
Question: ${details.data.encodedQuestion}
Outcomes: ${details.data.numOutcomes}
Token 1: ${details.data.collateralToken1}
Token 2: ${details.data.collateralToken2}`,
                {
                    padding: 1,
                    borderStyle: 'round',
                    borderColor: 'cyan',
                    title: 'Proposal Details'
                }
            );
            console.log(detailsBox);
        }
    } catch (error) {
        console.log(chalk.red(`✗ Error: ${error.message}`));
    }
    
    // Test 3: Fetch token info
    console.log(chalk.cyan('\n📋 Test 3: Fetching Token Information'));
    try {
        const tokens = await dataLayer.fetch('proposal.tokens', { proposalAddress });
        
        if (tokens.status === 'success') {
            console.log(chalk.green('✓ Token info fetched successfully'));
            console.log(chalk.gray('  Company Token:'), chalk.white(tokens.data.companyToken.symbol), chalk.dim(`(${tokens.data.companyToken.address})`));
            console.log(chalk.gray('  Currency Token:'), chalk.white(tokens.data.currencyToken.symbol), chalk.dim(`(${tokens.data.currencyToken.address})`));
        }
    } catch (error) {
        console.log(chalk.red(`✗ Error: ${error.message}`));
    }
    
    // Test 4: Fetch outcomes
    console.log(chalk.cyan('\n📋 Test 4: Fetching Outcomes'));
    try {
        const outcomes = await dataLayer.fetch('proposal.outcomes', { proposalAddress });
        
        if (outcomes.status === 'success') {
            console.log(chalk.green('✓ Outcomes fetched successfully'));
            console.log(chalk.gray('  Number of outcomes:'), chalk.white(outcomes.data.numOutcomes));
            console.log(chalk.gray('  Outcomes:'), chalk.white(outcomes.data.outcomes.join(', ')));
        }
    } catch (error) {
        console.log(chalk.red(`✗ Error: ${error.message}`));
    }
    
    // Test 5: Fetch wrapped outcomes
    console.log(chalk.cyan('\n📋 Test 5: Fetching Wrapped Outcomes'));
    try {
        const wrapped = await dataLayer.fetch('proposal.wrapped', { proposalAddress });
        
        if (wrapped.status === 'success' && wrapped.data.wrappedOutcomes.length > 0) {
            console.log(chalk.green('✓ Wrapped outcomes fetched successfully'));
            
            const table = new Table({
                head: ['Index', 'Label', 'Token Address'],
                colWidths: [8, 15, 45],
                style: {
                    head: ['cyan'],
                    border: ['gray']
                }
            });
            
            wrapped.data.wrappedOutcomes.forEach(outcome => {
                table.push([
                    outcome.index,
                    chalk.magenta(outcome.label),
                    chalk.gray(outcome.wrapped1155)
                ]);
            });
            
            console.log(table.toString());
        }
    } catch (error) {
        console.log(chalk.red(`✗ Error: ${error.message}`));
    }
    
    // List all available operations
    console.log(chalk.cyan('\n📋 Available Proposal Operations:'));
    const operations = dataLayer.getAvailableOperations().filter(op => op.startsWith('proposal.'));
    operations.forEach(op => {
        console.log(chalk.gray('  •'), chalk.white(op));
    });
    
    console.log(chalk.green.bold('\n✅ Proposal fetcher test completed!'));
    console.log(chalk.dim('The View Proposals feature is now available in the CLI'));
}

testProposalFetcher().catch(error => {
    console.error(chalk.red.bold(`\n❌ Test failed: ${error.message}`));
    process.exit(1);
});