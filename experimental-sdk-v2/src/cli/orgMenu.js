import inquirer from 'inquirer';
import chalk from 'chalk';
import Table from 'cli-table3';

export async function openOrgMenu(subgraph, contracts, orgId) {
    while (true) {
        console.log(chalk.bold.cyan(`\n🏢 Organization Admin: ${orgId}`));

        const { action } = await inquirer.prompt([
            {
                type: 'list',
                name: 'action',
                message: 'Manage Organization:',
                choices: [
                    '🕵️‍♀️ Audit Proposals (Chain vs Subgraph)',
                    '👑 Check Ownership',
                    '⬅️ Back'
                ]
            }
        ]);

        if (action === '⬅️ Back') break;

        try {
            if (action === '🕵️‍♀️ Audit Proposals (Chain vs Subgraph)') {
                await auditProposals(subgraph, contracts, orgId);
            }
            if (action === '👑 Check Ownership') {
                await checkOwnership(contracts, orgId);
            }
        } catch (error) {
            console.error(chalk.red('Error:'), error.message);
        }
    }
}

async function auditProposals(subgraph, contracts, orgId) {
    console.log(chalk.yellow('Fetching data...'));

    // 1. Fetch Subgraph Data
    const subData = await subgraph.getOrganization(orgId);
    const subProposals = subData.organization ? subData.organization.proposals : [];
    const subIds = new Set(subProposals.map(p => p.id.toLowerCase()));

    // 2. Fetch On-Chain Data
    const orgContract = contracts.getOrganization(orgId);
    let chainProposals = [];
    try {
        // Some older ABI versions might use filtered proposals or index-based
        // We assume getProposals returns address[]
        chainProposals = await orgContract.getProposals();
    } catch (e) {
        console.error(chalk.red('Failed to fetch on-chain proposals. (ABI Mismatch?)'), e.message);
        return;
    }

    // 3. Compare
    console.log(chalk.bold(`\n📊 Audit Report for ${orgId}`));
    console.log(`On-Chain Count: ${chainProposals.length}`);
    console.log(`Subgraph Count: ${subProposals.length}`);

    const table = new Table({
        head: ['Index', 'Address', 'Status'],
        colWidths: [10, 45, 20]
    });

    chainProposals.forEach((addr, idx) => {
        const id = addr.toLowerCase();
        let status = chalk.green('✅ Indexed');

        if (!subIds.has(id)) {
            status = chalk.red('❌ ZOMBIE (Unindexed)');
        }

        table.push([idx, id, status]);
    });

    console.log(table.toString());

    if (chainProposals.length > subProposals.length) {
        console.log(chalk.red('\n! FOUND ZOMBIE PROPOSALS !'));
        console.log('These proposals exist on-chain but are not in the Subgraph.');
        console.log('Possible causes: Bad Metadata, Indexing Lag, or Creation Failure.');
    } else {
        console.log(chalk.green('\n✓ Chain and Subgraph are synced.'));
    }
}

async function checkOwnership(contracts, orgId) {
    const orgContract = contracts.getOrganization(orgId);
    const owner = await orgContract.owner();
    console.log(`\n👑 Contract Owner: ${chalk.green(owner)}`);

    // Check local wallet
    // Note: This requires the provider to have a signer
    try {
        const signer = await contracts.provider.getWallet();
        if (signer) {
            console.log(`Your Address:    ${chalk.blue(signer.address)}`);
            if (signer.address.toLowerCase() === owner.toLowerCase()) {
                console.log(chalk.bgGreen.black(' YOU ARE THE OWNER '));
            } else {
                console.log(chalk.yellow('You are NOT the owner (Read-Only)'));
            }
        } else {
            console.log(chalk.dim('No private key loaded (Read-Only Mode)'));
        }
    } catch (e) {
        console.log(chalk.dim('Could not determine local identity.'));
    }
}
