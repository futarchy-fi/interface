// Test the enhanced ProposalFetcher with Realitio status

import { DataLayer } from './DataLayer.js';
import { createProposalFetcher } from './fetchers/ProposalFetcher.js';
import { formatEther } from 'viem';
import chalk from 'chalk';
import boxen from 'boxen';
import dotenv from 'dotenv';

dotenv.config();

async function testRealitioStatus() {
    console.log(chalk.cyan.bold('\n⏰ Testing Realitio Status Integration\n'));
    
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
    
    // Test 1: Fetch Realitio Status
    console.log(chalk.cyan('📋 Test 1: Fetching Realitio Question Status'));
    try {
        const realitio = await dataLayer.fetch('proposal.realitio', { proposalAddress });
        
        if (realitio.status === 'success') {
            console.log(chalk.green('✓ Realitio status fetched successfully'));
            
            const data = realitio.data;
            console.log('\n' + chalk.cyan('Question Details:'));
            console.log(chalk.gray('  Question ID:'), chalk.white(data.questionId));
            console.log(chalk.gray('  Content Hash:'), chalk.white(data.contentHash));
            console.log(chalk.gray('  Arbitrator:'), chalk.white(data.arbitrator));
            console.log(chalk.gray('  Opening Time:'), chalk.white(new Date(data.openingTime * 1000).toLocaleString()));
            console.log(chalk.gray('  Timeout:'), chalk.white(`${data.timeout} seconds`));
            
            if (data.finalizeTime > 0) {
                console.log(chalk.gray('  Finalize Time:'), chalk.white(new Date(data.finalizeTime * 1000).toLocaleString()));
            }
            
            console.log('\n' + chalk.cyan('Status:'));
            console.log(chalk.gray('  Is Finalized:'), data.isFinalized ? chalk.green('Yes') : chalk.yellow('No'));
            console.log(chalk.gray('  Pending Arbitration:'), data.isPendingArbitration ? chalk.red('Yes') : chalk.green('No'));
            
            console.log('\n' + chalk.cyan('Financial Details:'));
            console.log(chalk.gray('  Bounty:'), chalk.white(formatEther(BigInt(data.bounty))), 'xDAI');
            console.log(chalk.gray('  Current Bond:'), chalk.white(formatEther(BigInt(data.bond))), 'xDAI');
            console.log(chalk.gray('  Min Bond:'), chalk.white(formatEther(BigInt(data.minBond))), 'xDAI');
            
            console.log('\n' + chalk.cyan('Answers:'));
            console.log(chalk.gray('  Best Answer:'), chalk.white(data.bestAnswer));
            console.log(chalk.gray('  Result For:'), chalk.white(data.resultFor));
            if (data.finalAnswer) {
                console.log(chalk.gray('  Final Answer:'), chalk.green(data.finalAnswer));
            }
        } else {
            console.log(chalk.red(`✗ Failed: ${realitio.reason}`));
        }
    } catch (error) {
        console.log(chalk.red(`✗ Error: ${error.message}`));
    }
    
    // Test 2: Fetch Comprehensive Status
    console.log(chalk.cyan('\n📋 Test 2: Fetching Comprehensive Proposal Status'));
    try {
        const status = await dataLayer.fetch('proposal.status', { proposalAddress });
        
        if (status.status === 'success') {
            console.log(chalk.green('✓ Comprehensive status fetched successfully'));
            
            const data = status.data;
            
            // Determine status color
            let statusColor = 'yellow';
            let statusIcon = '⏳';
            
            if (data.status === 'FINALIZED') {
                statusColor = 'green';
                statusIcon = '✅';
            } else if (data.status === 'PENDING_ARBITRATION') {
                statusColor = 'red';
                statusIcon = '⚖️';
            } else if (data.status === 'OPEN_FOR_ANSWERS') {
                statusColor = 'cyan';
                statusIcon = '📝';
            }
            
            const statusBox = boxen(
                `Market: ${data.marketName}
Status: ${chalk[statusColor].bold(data.status)} ${statusIcon}
Finalized: ${data.isFinalized ? 'Yes' : 'No'}
Opening: ${data.openingTime}
${data.finalizeTime ? `Finalized: ${data.finalizeTime}` : 'Not finalized yet'}
${data.currentAnswer ? `Current Answer: ${data.currentAnswer}` : 'No answer yet'}
Outcomes: ${data.outcomes.join(', ')}`,
                {
                    padding: 1,
                    borderStyle: 'round',
                    borderColor: statusColor,
                    title: 'Proposal Status Summary'
                }
            );
            
            console.log(statusBox);
            
            // Interpret the status
            console.log('\n' + chalk.cyan('Status Interpretation:'));
            switch(data.status) {
                case 'FINALIZED':
                    console.log(chalk.green('✅ The question has been finalized with answer:'), chalk.white.bold(data.currentAnswer || 'Unknown'));
                    break;
                case 'PENDING_ARBITRATION':
                    console.log(chalk.red('⚖️ The question is pending arbitration'));
                    break;
                case 'OPEN_FOR_ANSWERS':
                    console.log(chalk.cyan('📝 The question is open for answers'));
                    if (data.currentAnswer) {
                        console.log(chalk.yellow('   Current best answer:'), chalk.white(data.currentAnswer));
                    }
                    break;
                case 'NOT_OPENED':
                    console.log(chalk.gray('⏰ The question has not opened yet'));
                    break;
                default:
                    console.log(chalk.gray('❓ Unknown status'));
            }
        }
    } catch (error) {
        console.log(chalk.red(`✗ Error: ${error.message}`));
    }
    
    // List new operations
    console.log(chalk.cyan('\n📋 New Proposal Operations Available:'));
    const operations = dataLayer.getAvailableOperations().filter(op => op.startsWith('proposal.'));
    operations.forEach(op => {
        const isNew = op.includes('realitio') || op.includes('status');
        console.log(chalk.gray('  •'), isNew ? chalk.green.bold(op + ' (NEW)') : chalk.white(op));
    });
    
    console.log(chalk.green.bold('\n✅ Realitio integration test completed!'));
    console.log(chalk.dim('The View Proposals feature now shows Realitio question status'));
}

testRealitioStatus().catch(error => {
    console.error(chalk.red.bold(`\n❌ Test failed: ${error.message}`));
    process.exit(1);
});