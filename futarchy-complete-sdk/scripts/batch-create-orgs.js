#!/usr/bin/env node
/**
 * Batch Create Organizations from Supabase Companies
 * 
 * Semi-automatic script that shows details and asks for confirmation
 * before creating each organization on the default aggregator.
 * 
 * Usage: node scripts/batch-create-orgs.js
 */

import 'dotenv/config';
import fs from 'fs';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { gnosis } from 'viem/chains';
import { confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import ora from 'ora';

// Contract config
const DEFAULT_AGGREGATOR = '0xC5eB43D53e2FE5FddE5faf400CC4167e5b5d4Fc1';

// ABI for createAndAddOrganizationMetadata
const AGGREGATOR_ABI = [
    {
        "inputs": [
            { "internalType": "string", "name": "name", "type": "string" },
            { "internalType": "string", "name": "description", "type": "string" },
            { "internalType": "string", "name": "metadata", "type": "string" },
            { "internalType": "string", "name": "metadataURI", "type": "string" }
        ],
        "name": "createAndAddOrganizationMetadata",
        "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
        "stateMutability": "nonpayable",
        "type": "function"
    }
];

// Companies to create (filter by name)
const COMPANIES_TO_CREATE = [
    'Aave DAO',
    'Gnosis DAO',
    'Kleros DAO',
    'VeloraDAO'
];

async function main() {
    console.log(chalk.cyan('\n╭─────────────────────────────────────────────────────'));
    console.log(chalk.cyan('│ ') + chalk.bold.white('🏭 Batch Create Organizations'));
    console.log(chalk.cyan('│ ') + chalk.dim(`Aggregator: ${DEFAULT_AGGREGATOR}`));
    console.log(chalk.cyan('╰─────────────────────────────────────────────────────\n'));

    // Load companies from JSON
    const companiesFile = 'companies_for_orgs.json';
    if (!fs.existsSync(companiesFile)) {
        console.error(chalk.red('❌ Run export-supabase-companies.js first'));
        process.exit(1);
    }

    const allCompanies = JSON.parse(fs.readFileSync(companiesFile, 'utf-8'));

    // Filter to only requested companies
    const companies = allCompanies.filter(c =>
        COMPANIES_TO_CREATE.includes(c.companyName)
    );

    console.log(chalk.yellow(`📋 Found ${companies.length} companies to create:\n`));
    companies.forEach((c, i) => {
        console.log(`   ${i + 1}. ${c.companyName}`);
    });
    console.log('');

    // Setup viem clients
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
        console.error(chalk.red('❌ PRIVATE_KEY not found in .env'));
        process.exit(1);
    }

    const account = privateKeyToAccount(privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`);
    console.log(chalk.dim(`🔑 Wallet: ${account.address}\n`));

    const publicClient = createPublicClient({
        chain: gnosis,
        transport: http('https://rpc.gnosischain.com')
    });

    const walletClient = createWalletClient({
        chain: gnosis,
        transport: http('https://rpc.gnosischain.com'),
        account
    });

    // Process each company
    for (const company of companies) {
        console.log(chalk.magenta('\n╭─────────────────────────────────────────────────────'));
        console.log(chalk.magenta('│ ') + chalk.bold.white(`📦 ${company.companyName}`));
        console.log(chalk.magenta('├─────────────────────────────────────────────────────'));
        console.log(chalk.magenta('│ ') + chalk.dim(`Description: ${company.description?.substring(0, 60)}...`));
        console.log(chalk.magenta('│ ') + chalk.dim(`Supabase ID: ${company._ref?.supabaseId}`));
        console.log(chalk.magenta('│ ') + chalk.dim(`Status: ${company._ref?.status}`));
        console.log(chalk.magenta('╰─────────────────────────────────────────────────────'));

        const shouldCreate = await confirm({
            message: `Create "${company.companyName}" on aggregator?`,
            default: true
        });

        if (!shouldCreate) {
            console.log(chalk.yellow('   ⏭️  Skipped'));
            continue;
        }

        const spinner = ora(`Creating ${company.companyName}...`).start();

        try {
            const hash = await walletClient.writeContract({
                address: DEFAULT_AGGREGATOR,
                abi: AGGREGATOR_ABI,
                functionName: 'createAndAddOrganizationMetadata',
                args: [
                    company.companyName,
                    company.description || '',
                    company.metadata || '{}',
                    company.metadataURI || ''
                ],
                account
            });

            spinner.text = `Waiting for confirmation... ${hash.slice(0, 10)}...`;

            const receipt = await publicClient.waitForTransactionReceipt({ hash });

            // Try to get the created org address from logs
            let orgAddress = null;
            if (receipt.logs && receipt.logs.length > 0) {
                // The org address is usually in the first log's topics
                for (const log of receipt.logs) {
                    if (log.topics && log.topics.length >= 2) {
                        orgAddress = '0x' + log.topics[1].slice(-40);
                        break;
                    }
                }
            }

            spinner.succeed(chalk.green(`✅ Created ${company.companyName}`));
            console.log(chalk.dim(`   Org: ${orgAddress || 'Check tx'}`));
            console.log(chalk.blue(`   🔗 https://gnosisscan.io/tx/${hash}`));

        } catch (error) {
            spinner.fail(chalk.red(`❌ Failed: ${error.message}`));
        }
    }

    console.log(chalk.green('\n✨ Done!\n'));
}

main().catch(console.error);
