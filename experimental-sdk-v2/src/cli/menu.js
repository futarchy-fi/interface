import inquirer from 'inquirer';
import chalk from 'chalk';
import { displayAggregator, displayOrganization } from '../actions/read.js';
import { createOrganization } from '../actions/write.js';
import { openProposalMenu } from './proposalMenu.js';
import { openOrgMenu } from './orgMenu.js';
import { CONTRACTS } from '../config/constants.js';

import { printHeader } from './ui.js';

export async function startCLI(subgraph, contracts, spotClient) {
    printHeader();

    while (true) {
        const { action } = await inquirer.prompt([
            {
                type: 'rawlist',  // Using numbered list for better terminal compatibility
                name: 'action',
                message: 'What would you like to do?',
                choices: [
                    { name: '🔍 View Aggregator', value: 'aggregator' },
                    { name: '🏢 View Organization (Admin)', value: 'organization' },
                    { name: '🎫 Manage Proposal (Analysis, Write, Config)', value: 'proposal' },
                    { name: '➕ Create Organization (Write)', value: 'create_org' },
                    { name: '❌ Exit', value: 'exit' }
                ]
            }
        ]);

        if (action === 'exit') break;

        try {
            if (action === 'aggregator') {
                const { id } = await inquirer.prompt([{
                    type: 'input',
                    name: 'id',
                    message: 'Aggregator ID:',
                    default: CONTRACTS.DEFAULT_AGGREGATOR
                }]);
                await displayAggregator(subgraph, id);
            }


            if (action === 'organization') {
                const { id } = await inquirer.prompt([{
                    type: 'input',
                    name: 'id',
                    message: 'Organization ID:'
                }]);
                // Switch to the powerful Admin Menu instead of just display
                await openOrgMenu(subgraph, contracts, id);
            }

            if (action === 'proposal') {
                const { id } = await inquirer.prompt([{
                    type: 'input',
                    name: 'id',
                    message: 'Proposal ID:'
                }]);
                await openProposalMenu(subgraph, contracts, spotClient, id);
            }

            if (action === 'create_org') {
                const { name, desc } = await inquirer.prompt([
                    { type: 'input', name: 'name', message: 'Org Name:' },
                    { type: 'input', name: 'desc', message: 'Description:' }
                ]);
                await createOrganization(contracts, CONTRACTS.DEFAULT_AGGREGATOR, name, desc);
            }

        } catch (error) {
            console.error(chalk.red('Error:'), error.message);
        }
    }
}
