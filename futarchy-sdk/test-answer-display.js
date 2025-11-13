#!/usr/bin/env node

// Test script to verify the answer displays correctly
import { DataLayer } from './DataLayer.js';
import { createProposalFetcher } from './fetchers/ProposalFetcher.js';
import chalk from 'chalk';

async function test() {
    console.log(chalk.cyan.bold('\n🧪 Testing Answer Display\n'));
    
    const dataLayer = new DataLayer();
    const proposalFetcher = createProposalFetcher();
    dataLayer.registerFetcher(proposalFetcher);
    
    // Test with different proposals
    const proposals = [
        '0xA94aB35282118f38b0b4FF89dDA7A5c04aD49371', // KIP-77
        '0x9bCf4Cd216E5A87012FfFaB4E46ddF9cBe604641', // GnosisPay
    ];
    
    for (const proposalAddress of proposals) {
        console.log(chalk.yellow(`\n📝 Proposal: ${proposalAddress}`));
        
        // Fetch proposal status
        const status = await dataLayer.fetch('proposal.status', { proposalAddress });
        
        if (status.status === 'success') {
            const data = status.data;
            console.log('  Market:', data.marketName.slice(0, 80) + '...');
            console.log('  Status:', data.status);
            console.log('  Finalized:', data.isFinalized);
            
            if (data.currentAnswer) {
                console.log(chalk.green(`  ✅ Current Answer: ${data.currentAnswer}`));
                
                // Verify it doesn't have token suffix
                if (data.currentAnswer.includes('-')) {
                    console.log(chalk.red('  ❌ ERROR: Answer still contains token suffix!'));
                } else {
                    console.log(chalk.green('  ✓ Answer format is correct (no token suffix)'));
                }
            } else {
                console.log('  Current Answer: Not yet determined');
            }
            
            // Also show the raw outcomes for comparison
            const outcomes = await dataLayer.fetch('proposal.outcomes', { proposalAddress });
            if (outcomes.status === 'success') {
                console.log(chalk.gray('  Raw outcomes:'), outcomes.data.outcomes);
            }
        }
    }
    
    console.log(chalk.green('\n✅ Test completed!\n'));
}

test().catch(console.error);