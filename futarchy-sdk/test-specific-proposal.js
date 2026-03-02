// Test specific proposal to debug Realitio status

import { DataLayer } from './DataLayer.js';
import { createProposalFetcher } from './fetchers/ProposalFetcher.js';
import chalk from 'chalk';
import dotenv from 'dotenv';

dotenv.config();

async function testSpecificProposal() {
    console.log(chalk.cyan.bold('\n🔍 Testing Specific Proposal\n'));
    
    // Initialize DataLayer
    const dataLayer = new DataLayer();
    
    // Create and register ProposalFetcher
    const proposalFetcher = createProposalFetcher(
        process.env.RPC_URL || 'https://rpc.gnosischain.com'
    );
    dataLayer.registerFetcher(proposalFetcher);
    
    // Test the Kleros proposal
    const proposalAddress = '0xA94aB35282118f38b0b4FF89dDA7A5c04aD49371';
    
    console.log(chalk.yellow(`Testing proposal: ${proposalAddress}\n`));
    console.log(chalk.cyan('This is the Kleros KIP-77 proposal\n'));
    
    // Test fetching status
    console.log(chalk.cyan('Fetching Realitio status...'));
    try {
        const status = await dataLayer.fetch('proposal.status', { proposalAddress });
        
        if (status.status === 'success') {
            console.log(chalk.green('✓ Status fetched successfully'));
            console.log('\nStatus Data:');
            console.log(JSON.stringify(status.data, null, 2));
        } else {
            console.log(chalk.red('✗ Status fetch failed:'), status.reason);
        }
    } catch (error) {
        console.log(chalk.red('✗ Error:'), error.message);
        console.log(error.stack);
    }
    
    // Test fetching raw Realitio data
    console.log(chalk.cyan('\nFetching raw Realitio data...'));
    try {
        const realitio = await dataLayer.fetch('proposal.realitio', { proposalAddress });
        
        if (realitio.status === 'success') {
            console.log(chalk.green('✓ Realitio data fetched successfully'));
            console.log('\nRealitio Data:');
            console.log(JSON.stringify(realitio.data, null, 2));
        } else {
            console.log(chalk.red('✗ Realitio fetch failed:'), realitio.reason);
        }
    } catch (error) {
        console.log(chalk.red('✗ Error:'), error.message);
        console.log(error.stack);
    }
}

testSpecificProposal().catch(error => {
    console.error(chalk.red.bold(`\n❌ Test failed: ${error.message}`));
    console.log(error.stack);
    process.exit(1);
});