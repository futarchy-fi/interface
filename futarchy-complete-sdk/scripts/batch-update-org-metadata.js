#!/usr/bin/env node
/**
 * Batch Update Organization Extended Metadata
 * 
 * This script:
 * 1. Fetches companies from Supabase (with images, colors, etc.)
 * 2. Queries the subgraph to find matching organizations by name
 * 3. Updates the organization's extendedMetadata on-chain
 * 
 * Usage: node scripts/batch-update-org-metadata.js
 */

import 'dotenv/config';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { gnosis } from 'viem/chains';
import { createClient } from '@supabase/supabase-js';
import { confirm, checkbox } from '@inquirer/prompts';
import chalk from 'chalk';
import ora from 'ora';

// ============================================================================
// CONFIG
// ============================================================================

const RPC_URL = process.env.RPC_URL || 'https://rpc.gnosischain.com';
const AGGREGATOR = process.env.AGGREGATOR_ADDRESS || '0xC5eB43D53e2FE5FddE5faf400CC4167e5b5d4Fc1';

// Subgraph endpoint
const SUBGRAPH_URL = process.env.COMPLETE_SUBGRAPH_URL ||
    'https://d3ugkaojqkfud0.cloudfront.net/subgraphs/name/futarchy-complete-new-v3';

// Supabase
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// ============================================================================
// ABIs
// ============================================================================

// Organization ABI - updateExtendedMetadata(string _metadata, string _metadataURI)
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
    },
    {
        "inputs": [],
        "name": "metadata",
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
    }
];

// ============================================================================
// SUBGRAPH QUERIES
// ============================================================================

async function fetchOrgsFromSubgraph(aggregatorId) {
    const query = `{
        aggregator(id: "${aggregatorId.toLowerCase()}") {
            organizations {
                id
                name
                description
                metadata
                metadataURI
                owner
            }
        }
    }`;

    const response = await fetch(SUBGRAPH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
    });

    const result = await response.json();
    if (result.errors) throw new Error(result.errors[0].message);
    return result.data?.aggregator?.organizations || [];
}

// ============================================================================
// SUPABASE FETCH
// ============================================================================

async function fetchCompaniesFromSupabase() {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        console.log(chalk.yellow('⚠️  Supabase not configured, using manual input'));
        return [];
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data, error } = await supabase
        .from('company')
        .select('*')
        .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
}

// ============================================================================
// MATCH SUPABASE COMPANY → SUBGRAPH ORG
// ============================================================================

function matchCompanyToOrg(supabaseCompany, subgraphOrgs) {
    const companyName = supabaseCompany.name?.toLowerCase().trim();

    // Try exact match first
    let match = subgraphOrgs.find(org =>
        org.name?.toLowerCase().trim() === companyName
    );

    // Fuzzy match: contains
    if (!match) {
        match = subgraphOrgs.find(org =>
            org.name?.toLowerCase().includes(companyName) ||
            companyName.includes(org.name?.toLowerCase())
        );
    }

    return match;
}

// ============================================================================
// BUILD METADATA JSON
// ============================================================================

function buildMetadataJson(supabaseCompany) {
    const meta = supabaseCompany.metadata || {};

    return {
        // Image fields (what the frontend expects!)
        logo: meta.logo || supabaseCompany.logo || '',
        coverImage: meta.background_image || meta.coverImage || '',

        // Colors
        colors: meta.colors || { primary: '#6b21a8' },

        // Links
        website: meta.website || '',
        twitter: meta.twitter || '',

        // Token info
        ticker: meta.ticker || '',

        // Reference
        supabaseId: supabaseCompany.id
    };
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
    console.log(chalk.cyan('\n╭─────────────────────────────────────────────────────'));
    console.log(chalk.cyan('│ ') + chalk.bold.white('🔄 Batch Update Organization Metadata'));
    console.log(chalk.cyan('│ ') + chalk.dim(`Aggregator: ${AGGREGATOR}`));
    console.log(chalk.cyan('│ ') + chalk.dim(`Subgraph: ${SUBGRAPH_URL.split('/').pop()}`));
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

    // Step 1: Fetch from Subgraph
    const spinner1 = ora('Fetching organizations from Subgraph...').start();
    const subgraphOrgs = await fetchOrgsFromSubgraph(AGGREGATOR);
    spinner1.succeed(`Found ${subgraphOrgs.length} organizations in subgraph`);

    // Step 2: Fetch from Supabase
    const spinner2 = ora('Fetching companies from Supabase...').start();
    let supabaseCompanies = [];
    try {
        supabaseCompanies = await fetchCompaniesFromSupabase();
        spinner2.succeed(`Found ${supabaseCompanies.length} companies in Supabase`);
    } catch (e) {
        spinner2.warn(`Supabase fetch failed: ${e.message}`);
    }

    // Step 3: Match and prepare updates
    console.log(chalk.yellow('\n📋 Matching companies to organizations...\n'));

    const updateCandidates = [];

    for (const company of supabaseCompanies) {
        const matchedOrg = matchCompanyToOrg(company, subgraphOrgs);

        if (matchedOrg) {
            const newMetadata = buildMetadataJson(company);
            const hasLogo = newMetadata.logo || newMetadata.coverImage;

            updateCandidates.push({
                supabaseCompany: company,
                org: matchedOrg,
                newMetadata,
                hasImages: !!hasLogo
            });

            const icon = hasLogo ? '🖼️ ' : '⚠️ ';
            console.log(`   ${icon} ${company.name} → ${matchedOrg.name} (${matchedOrg.id.slice(0, 10)}...)`);
        } else {
            console.log(chalk.dim(`   ❌ ${company.name} → No match found`));
        }
    }

    // Also show subgraph orgs without Supabase match
    console.log(chalk.dim('\n   Subgraph orgs without Supabase match:'));
    for (const org of subgraphOrgs) {
        const hasMatch = updateCandidates.some(u => u.org.id === org.id);
        if (!hasMatch) {
            console.log(chalk.dim(`   ⏭️  ${org.name} (${org.id.slice(0, 10)}...)`));
        }
    }

    if (updateCandidates.length === 0) {
        console.log(chalk.yellow('\n⚠️  No matching organizations found to update.'));
        process.exit(0);
    }

    // Step 4: Select which to update
    console.log('');
    const selected = await checkbox({
        message: 'Select organizations to update:',
        choices: updateCandidates.map((u, i) => ({
            name: `${u.hasImages ? '🖼️ ' : '⚠️ '} ${u.org.name} (${u.org.id.slice(0, 10)}...)`,
            value: i,
            checked: u.hasImages  // Pre-check if has images
        }))
    });

    if (selected.length === 0) {
        console.log(chalk.yellow('\n⏭️  Nothing selected. Exiting.'));
        process.exit(0);
    }

    // Step 5: Execute updates
    for (const idx of selected) {
        const { org, newMetadata, supabaseCompany } = updateCandidates[idx];

        console.log(chalk.magenta('\n╭─────────────────────────────────────────────────────'));
        console.log(chalk.magenta('│ ') + chalk.bold.white(`🏢 ${org.name}`));
        console.log(chalk.magenta('├─────────────────────────────────────────────────────'));
        console.log(chalk.magenta('│ ') + chalk.dim(`Contract: ${org.id}`));
        console.log(chalk.magenta('│ ') + chalk.dim(`Logo: ${newMetadata.logo || '(none)'}`));
        console.log(chalk.magenta('│ ') + chalk.dim(`Cover: ${newMetadata.coverImage || '(none)'}`));
        console.log(chalk.magenta('│ ') + chalk.dim(`Colors: ${JSON.stringify(newMetadata.colors)}`));
        console.log(chalk.magenta('╰─────────────────────────────────────────────────────'));

        const proceed = await confirm({
            message: `Update metadata for "${org.name}"?`,
            default: true
        });

        if (!proceed) {
            console.log(chalk.yellow('   ⏭️  Skipped'));
            continue;
        }

        const spinner = ora(`Updating ${org.name}...`).start();

        try {
            const metadataJson = JSON.stringify(newMetadata);

            const hash = await walletClient.writeContract({
                address: org.id,  // Organization contract address
                abi: ORGANIZATION_ABI,
                functionName: 'updateExtendedMetadata',
                args: [metadataJson, ''],  // metadata, metadataURI
                account
            });

            spinner.text = `Waiting for confirmation... ${hash.slice(0, 10)}...`;

            const receipt = await publicClient.waitForTransactionReceipt({ hash });

            spinner.succeed(chalk.green(`✅ Updated ${org.name}`));
            console.log(chalk.blue(`   🔗 https://gnosisscan.io/tx/${hash}`));

        } catch (error) {
            spinner.fail(chalk.red(`❌ Failed: ${error.message}`));

            // Check if permission issue
            if (error.message.includes('Ownable') || error.message.includes('unauthorized')) {
                console.log(chalk.yellow(`   ℹ️  You may not be the owner of this organization.`));
                console.log(chalk.dim(`   Owner: ${org.owner}`));
            }
        }
    }

    console.log(chalk.green('\n✨ Done!\n'));
}

main().catch(console.error);
