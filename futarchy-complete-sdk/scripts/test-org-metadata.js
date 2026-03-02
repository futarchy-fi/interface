#!/usr/bin/env node
/**
 * Test Script: Verify Organization Metadata
 * 
 * Checks if metadata was properly set by reading it back from contracts.
 * 
 * Usage: node scripts/test-org-metadata.js
 */

import 'dotenv/config';
import { createPublicClient, http } from 'viem';
import { gnosis } from 'viem/chains';
import chalk from 'chalk';

// ============================================================================
// ORGS TO CHECK
// ============================================================================

const ORGS_TO_CHECK = [
    { name: 'Aave DAO', address: '0xb84b41518806b70fee6dae06982abd9526cb59c7' },
    { name: 'Gnosis DAO', address: '0x3fd2e8e71f75eed4b5c507706c413e33e0661bbf' },
    { name: 'Kleros DAO', address: '0xaab097ead5c2db1ca7b1e5034224a2118edabe36' },
    { name: 'VeloraDAO', address: '0x2f345ce868cc7840a89472f2503944e4ef8f797c' }
];

// ============================================================================
// ABI
// ============================================================================

const ORGANIZATION_ABI = [
    {
        "inputs": [],
        "name": "metadata",
        "outputs": [{ "internalType": "string", "name": "", "type": "string" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "metadataURI",
        "outputs": [{ "internalType": "string", "name": "", "type": "string" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "companyName",
        "outputs": [{ "internalType": "string", "name": "", "type": "string" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "owner",
        "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
        "stateMutability": "view",
        "type": "function"
    }
];

// ============================================================================
// MAIN
// ============================================================================

async function main() {
    console.log(chalk.cyan('\n╭─────────────────────────────────────────────────────'));
    console.log(chalk.cyan('│ ') + chalk.bold.white('🧪 Test Organization Metadata'));
    console.log(chalk.cyan('╰─────────────────────────────────────────────────────\n'));

    const RPC_URL = process.env.RPC_URL || 'https://rpc.gnosischain.com';

    const publicClient = createPublicClient({
        chain: gnosis,
        transport: http(RPC_URL)
    });

    console.log(chalk.dim(`🌐 RPC: ${RPC_URL}\n`));

    for (const org of ORGS_TO_CHECK) {
        console.log(chalk.magenta('╭─────────────────────────────────────────────────────'));
        console.log(chalk.magenta('│ ') + chalk.bold.white(`🏢 ${org.name}`));
        console.log(chalk.magenta('│ ') + chalk.dim(`Address: ${org.address}`));
        console.log(chalk.magenta('├─────────────────────────────────────────────────────'));

        try {
            // Read contract data
            const [companyName, metadata, metadataURI, owner] = await Promise.all([
                publicClient.readContract({
                    address: org.address,
                    abi: ORGANIZATION_ABI,
                    functionName: 'companyName'
                }),
                publicClient.readContract({
                    address: org.address,
                    abi: ORGANIZATION_ABI,
                    functionName: 'metadata'
                }),
                publicClient.readContract({
                    address: org.address,
                    abi: ORGANIZATION_ABI,
                    functionName: 'metadataURI'
                }),
                publicClient.readContract({
                    address: org.address,
                    abi: ORGANIZATION_ABI,
                    functionName: 'owner'
                })
            ]);

            console.log(chalk.magenta('│ ') + chalk.green(`✅ Contract exists`));
            console.log(chalk.magenta('│ ') + `Name: ${companyName}`);
            console.log(chalk.magenta('│ ') + `Owner: ${owner}`);
            console.log(chalk.magenta('│ ') + `MetadataURI: ${metadataURI || '(empty)'}`);

            // Parse metadata JSON
            if (metadata) {
                console.log(chalk.magenta('│ ') + chalk.yellow(`📦 Metadata (raw): ${metadata.substring(0, 80)}...`));
                try {
                    const parsed = JSON.parse(metadata);
                    console.log(chalk.magenta('│ '));
                    console.log(chalk.magenta('│ ') + chalk.cyan('   Parsed metadata:'));
                    console.log(chalk.magenta('│ ') + `   logo: ${parsed.logo ? chalk.green('✅ SET') : chalk.red('❌ MISSING')}`);
                    if (parsed.logo) {
                        console.log(chalk.magenta('│ ') + chalk.dim(`   → ${parsed.logo.substring(0, 60)}...`));
                    }
                    console.log(chalk.magenta('│ ') + `   coverImage: ${parsed.coverImage ? chalk.green('✅ SET') : chalk.yellow('⚠️  not set')}`);
                    console.log(chalk.magenta('│ ') + `   colors: ${JSON.stringify(parsed.colors) || '(none)'}`);
                } catch (e) {
                    console.log(chalk.magenta('│ ') + chalk.red(`   ❌ Failed to parse JSON: ${e.message}`));
                }
            } else {
                console.log(chalk.magenta('│ ') + chalk.red(`❌ Metadata is EMPTY`));
            }

        } catch (error) {
            console.log(chalk.magenta('│ ') + chalk.red(`❌ Error: ${error.message}`));
        }

        console.log(chalk.magenta('╰─────────────────────────────────────────────────────\n'));
    }

    console.log(chalk.green('✨ Test complete!\n'));
}

main().catch(console.error);
