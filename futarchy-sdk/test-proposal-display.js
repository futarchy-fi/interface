#!/usr/bin/env node

import MarketEventsFetcher from './fetchers/MarketEventsFetcher.js';
import chalk from 'chalk';

async function testProposalDisplay() {
    console.log(chalk.cyan.bold('\n📋 Testing Proposal Display with Addresses\n'));
    
    const fetcher = new MarketEventsFetcher();
    
    try {
        // Get all proposal choices
        const choices = await fetcher.getProposalChoices(true, true);
        
        console.log(chalk.yellow('All proposals with address identifiers:\n'));
        
        choices.forEach((choice, index) => {
            if (choice.value === 'custom') {
                console.log(chalk.gray(`\n${index + 1}. ${choice.name}`));
            } else {
                console.log(chalk.white(`${index + 1}. ${choice.name}`));
                
                // Also show the full address for reference
                if (choice.value && choice.value.id) {
                    console.log(chalk.gray(`   Full address: ${choice.value.id}`));
                }
            }
        });
        
        console.log(chalk.cyan.bold('\n✨ The format is: [0xABCD...xyz] for easy identification!'));
        
    } catch (error) {
        console.error(chalk.red('❌ Error:'), error.message);
        process.exit(1);
    }
}

testProposalDisplay();