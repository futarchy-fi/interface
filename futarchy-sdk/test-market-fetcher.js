#!/usr/bin/env node

import MarketEventsFetcher from './fetchers/MarketEventsFetcher.js';
import chalk from 'chalk';
import Table from 'cli-table3';

async function testMarketFetcher() {
    console.log(chalk.cyan.bold('\n🔍 Testing MarketEventsFetcher\n'));
    
    const fetcher = new MarketEventsFetcher();
    
    try {
        // Test 1: Fetch active proposals (default filter)
        console.log(chalk.yellow('Fetching active proposals (open only)...'));
        const activeProposals = await fetcher.fetchActiveProposals();
        console.log(chalk.green(`✅ Found ${activeProposals.length} open proposals\n`));
        
        // Test 1b: Fetch ALL proposals
        console.log(chalk.yellow('Fetching ALL proposals (including closed/test)...'));
        const allProposals = await fetcher.fetchActiveProposals(true);
        console.log(chalk.green(`✅ Found ${allProposals.length} total proposals\n`));
        
        // Display in table
        const table = new Table({
            head: [
                chalk.cyan('Title'),
                chalk.cyan('Tokens'),
                chalk.cyan('Status'),
                chalk.cyan('Days Left'),
                chalk.cyan('Visibility')
            ],
            colWidths: [50, 15, 15, 12, 12],
            wordWrap: true
        });
        
        allProposals.slice(0, 8).forEach(proposal => {
            const formatted = fetcher.formatProposalForDisplay(proposal);
            table.push([
                formatted.title,
                proposal.tokens,
                formatted.status,
                formatted.daysRemaining,
                formatted.visibility
            ]);
        });
        
        console.log(table.toString());
        
        // Test 2: Get proposal choices for terminal
        console.log(chalk.yellow('\nGenerating proposal choices for terminal...'));
        const choices = await fetcher.getProposalChoices();
        
        console.log(chalk.green(`✅ Generated ${choices.length} choices (including custom option)\n`));
        
        choices.slice(0, 3).forEach((choice, index) => {
            console.log(chalk.gray(`  ${index + 1}. ${choice.short || choice.name}`));
        });
        
        // Test 3: Fetch specific proposal
        if (allProposals.length > 0) {
            const proposalId = allProposals[0].id;
            console.log(chalk.yellow(`\nFetching specific proposal: ${proposalId}`));
            
            const proposal = await fetcher.fetchProposalById(proposalId);
            console.log(chalk.green('✅ Proposal fetched successfully'));
            
            console.log(chalk.gray('  Condition ID:'), proposal.condition_id);
            console.log(chalk.gray('  Question ID:'), proposal.question_id);
            console.log(chalk.gray('  Pool YES:'), proposal.pool_yes);
            console.log(chalk.gray('  Pool NO:'), proposal.pool_no);
        }
        
        console.log(chalk.cyan.bold('\n✨ All tests passed!'));
        
    } catch (error) {
        console.error(chalk.red('❌ Test failed:'), error.message);
        process.exit(1);
    }
}

testMarketFetcher();