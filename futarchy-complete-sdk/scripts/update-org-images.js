#!/usr/bin/env node
/**
 * Update Organization Images with Specific URLs
 * 
 * Quick script to update metadata with custom image URLs.
 * 
 * Usage: node scripts/update-org-images.js
 */

import 'dotenv/config';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { gnosis } from 'viem/chains';
import { confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import ora from 'ora';

// ============================================================================
// HARDCODED ORG IMAGES - EDIT HERE!
// ============================================================================

const ORG_UPDATES = [
    {
        name: 'Aave DAO',
        address: '0xb84b41518806b70fee6dae06982abd9526cb59c7',
        metadata: {
            chain: '1',  // Mainnet
            logo: 'https://sa-east-1.graphassets.com/clxcbx2jo04l307lv5cpz8caj/cm4ljz09900mh07luriman4mg',
            coverImage: 'https://sa-east-1.graphassets.com/clxcbx2jo04l307lv5cpz8caj/cm4ljz09900mh07luriman4mg',
            colors: { primary: '#B6509E' }
        }
    },
    {
        name: 'Gnosis DAO',
        address: '0x3fd2e8e71f75eed4b5c507706c413e33e0661bbf',
        metadata: {
            chain: '100',  // Gnosis Chain
            logo: 'https://www.cryptoninjas.net/wp-content/uploads/gnosis-crypto-ninjas.jpg',
            coverImage: 'https://www.cryptoninjas.net/wp-content/uploads/gnosis-crypto-ninjas.jpg',
            colors: { primary: '#00A89D' }
        }
    },
    {
        name: 'Kleros DAO',
        address: '0xaab097ead5c2db1ca7b1e5034224a2118edabe36',
        metadata: {
            chain: '100',  // Gnosis Chain
            logo: 'https://kleros.io/static/open-graph-card-ec90c20e2e4b2b3aa0cd0bce9fc31787.png',
            coverImage: 'https://kleros.io/static/open-graph-card-ec90c20e2e4b2b3aa0cd0bce9fc31787.png',
            colors: { primary: '#9013FE' }
        }
    },
    {
        name: 'VeloraDAO',
        address: '0x2f345ce868cc7840a89472f2503944e4ef8f797c',
        metadata: {
            chain: '1',  // Mainnet
            logo: 'https://pbs.twimg.com/media/GzgREDlWMAAa3hz.jpg',
            coverImage: 'https://pbs.twimg.com/media/GzgREDlWMAAa3hz.jpg',
            colors: { primary: '#FF5A3E' }
        }
    }
];

// ============================================================================
// CONFIG
// ============================================================================

const RPC_URL = process.env.RPC_URL || 'https://rpc.gnosischain.com';

const ORGANIZATION_ABI = [
    {
        "inputs": [
            { "internalType": "string", "name": "_metadata", "type": "string" },
            { "internalType": "string", "name": "_metadataURI", "type": "string" }
        ],
        "name": "updateExtendedMetadata",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
];

// ============================================================================
// MAIN
// ============================================================================

async function main() {
    console.log(chalk.cyan('\n╭─────────────────────────────────────────────────────'));
    console.log(chalk.cyan('│ ') + chalk.bold.white('🖼️  Update Organization Images'));
    console.log(chalk.cyan('╰─────────────────────────────────────────────────────\n'));

    // Setup wallet
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
        console.error(chalk.red('❌ PRIVATE_KEY not found in .env'));
        process.exit(1);
    }

    const account = privateKeyToAccount(privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`);
    console.log(chalk.dim(`🔑 Wallet: ${account.address}\n`));

    const publicClient = createPublicClient({
        chain: gnosis,
        transport: http(RPC_URL)
    });

    const walletClient = createWalletClient({
        chain: gnosis,
        transport: http(RPC_URL),
        account
    });

    // Process each org
    for (const org of ORG_UPDATES) {
        console.log(chalk.magenta('\n╭─────────────────────────────────────────────────────'));
        console.log(chalk.magenta('│ ') + chalk.bold.white(`🏢 ${org.name}`));
        console.log(chalk.magenta('├─────────────────────────────────────────────────────'));
        console.log(chalk.magenta('│ ') + chalk.dim(`Contract: ${org.address}`));
        console.log(chalk.magenta('│ ') + chalk.dim(`Logo: ${org.metadata.logo.substring(0, 50)}...`));
        console.log(chalk.magenta('│ ') + chalk.dim(`Colors: ${JSON.stringify(org.metadata.colors)}`));
        console.log(chalk.magenta('╰─────────────────────────────────────────────────────'));

        const proceed = await confirm({
            message: `Update "${org.name}"?`,
            default: true
        });

        if (!proceed) {
            console.log(chalk.yellow('   ⏭️  Skipped'));
            continue;
        }

        const spinner = ora(`Updating ${org.name}...`).start();

        try {
            const metadataJson = JSON.stringify(org.metadata);

            const hash = await walletClient.writeContract({
                address: org.address,
                abi: ORGANIZATION_ABI,
                functionName: 'updateExtendedMetadata',
                args: [metadataJson, ''],
                account
            });

            spinner.text = `Waiting for confirmation... ${hash.slice(0, 10)}...`;

            await publicClient.waitForTransactionReceipt({ hash });

            spinner.succeed(chalk.green(`✅ Updated ${org.name}`));
            console.log(chalk.blue(`   🔗 https://gnosisscan.io/tx/${hash}`));

        } catch (error) {
            spinner.fail(chalk.red(`❌ Failed: ${error.message}`));
        }
    }

    console.log(chalk.green('\n✨ All done!\n'));
}

main().catch(console.error);
