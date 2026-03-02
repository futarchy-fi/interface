/**
 * Futarchy Complete ABI Guide - Test Script
 * 
 * This script demonstrates the complete Futarchy metadata hierarchy:
 * 
 *   Creator (Factory) → Aggregator (e.g., "Futarchy.fi")
 *       ↓
 *   OrganizationFactory → Organization (e.g., "Gnosis", "Kleros")
 *       ↓
 *   ProposalMetadataFactory → Proposal Metadata (linked to Trading Contract)
 * 
 * Contract Addresses (Gnosis Chain):
 *   - Creator:                 0x8ffCf8546DE700FB2Ceab4709fB26ee05A19652B
 *   - OrganizationFactory:     0x2Fa9318E1e29d7435EE9d23B687b10a9CDDD0d9e
 *   - ProposalMetadataFactory: 0x8E8DBe97B2B3B6fb77F30727F3dCcA085C9755D9
 *   - FutarchyFactory:         0xa6cB18FCDC17a2B44E5cAd2d80a6D5942d30a345
 *   - AlgebraFactory:          0xA0864cCA6E114013AB0e27cbd5B6f4c8947da766
 */

import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =============================================================================
// CONFIGURATION
// =============================================================================

const RPC_URL = 'https://rpc.gnosischain.com';
const provider = new ethers.JsonRpcProvider(RPC_URL);

// Contract Addresses
const CONTRACTS = {
    CREATOR: '0x8ffCf8546DE700FB2Ceab4709fB26ee05A19652B',
    ORGANIZATION_FACTORY: '0x2Fa9318E1e29d7435EE9d23B687b10a9CDDD0d9e',
    PROPOSAL_FACTORY: '0x8E8DBe97B2B3B6fb77F30727F3dCcA085C9755D9',
    FUTARCHY_FACTORY: '0xa6cB18FCDC17a2B44E5cAd2d80a6D5942d30a345',
    ALGEBRA_FACTORY: '0xA0864cCA6E114013AB0e27cbd5B6f4c8947da766'
};

// =============================================================================
// LOAD ABIs
// =============================================================================

function loadABI(name) {
    const abiPath = path.join(__dirname, '..', 'abis', `${name}.json`);
    return JSON.parse(fs.readFileSync(abiPath, 'utf8'));
}

const ABIs = {
    Creator: loadABI('Creator'),
    OrganizationFactory: loadABI('OrganizationFactory'),
    ProposalMetadataFactory: loadABI('ProposalMetadataFactory'),
    Aggregator: loadABI('Aggregator'),
    Organization: loadABI('Organization'),
    Proposal: loadABI('Proposal'),
    FutarchyProposal: loadABI('FutarchyProposal'),
    ERC20: loadABI('ERC20')
};

// =============================================================================
// 1. QUERY AGGREGATORS (Top-Level Container)
// =============================================================================

async function queryAllAggregators() {
    console.log('\n📊 === AGGREGATORS (Top-Level) ===\n');

    const creator = new ethers.Contract(CONTRACTS.CREATOR, ABIs.Creator, provider);

    // Get all AggregatorMetadataCreated events
    const filter = creator.filters.AggregatorMetadataCreated();
    const events = await creator.queryFilter(filter);

    console.log(`Found ${events.length} aggregators:\n`);

    for (const event of events) {
        const aggregatorAddr = event.args.metadata;
        const name = event.args.name;

        console.log(`  📦 ${name}`);
        console.log(`     Address: ${aggregatorAddr}`);

        // Query aggregator details
        const aggregator = new ethers.Contract(aggregatorAddr, ABIs.Aggregator, provider);

        try {
            const description = await aggregator.description();
            const orgCount = await aggregator.getOrganizationsCount();
            console.log(`     Description: ${description.slice(0, 50)}...`);
            console.log(`     Organizations: ${orgCount}`);
        } catch (e) {
            console.log(`     (Could not fetch details: ${e.message})`);
        }
        console.log();
    }

    return events.map(e => e.args.metadata);
}

// =============================================================================
// 2. QUERY ORGANIZATIONS (Company-Level)
// =============================================================================

async function queryOrganizations(aggregatorAddress = null) {
    console.log('\n🏢 === ORGANIZATIONS ===\n');

    const orgFactory = new ethers.Contract(
        CONTRACTS.ORGANIZATION_FACTORY,
        ABIs.OrganizationFactory,
        provider
    );

    // Get all OrganizationMetadataCreated events
    const filter = orgFactory.filters.OrganizationMetadataCreated();
    const events = await orgFactory.queryFilter(filter);

    console.log(`Found ${events.length} organizations:\n`);

    const orgs = [];

    for (const event of events.slice(0, 10)) { // Limit to 10 for demo
        const orgAddr = event.args.metadata;
        const name = event.args.name;

        console.log(`  🏢 ${name}`);
        console.log(`     Address: ${orgAddr}`);

        // Query organization details
        const org = new ethers.Contract(orgAddr, ABIs.Organization, provider);

        try {
            const description = await org.description();
            const proposalCount = await org.getProposalsCount();
            console.log(`     Description: ${description.slice(0, 50)}...`);
            console.log(`     Proposals: ${proposalCount}`);

            orgs.push({
                address: orgAddr,
                name,
                proposalCount: Number(proposalCount)
            });
        } catch (e) {
            console.log(`     (Could not fetch details: ${e.message})`);
        }
        console.log();
    }

    return orgs;
}

// =============================================================================
// 3. QUERY PROPOSALS FROM ORGANIZATION
// =============================================================================

async function queryProposalsFromOrganization(orgAddress) {
    console.log(`\n📋 === PROPOSALS FOR ${orgAddress.slice(0, 10)}... ===\n`);

    const org = new ethers.Contract(orgAddress, ABIs.Organization, provider);

    try {
        const count = await org.getProposalsCount();
        console.log(`Total proposals: ${count}\n`);

        if (count > 0) {
            // Get proposals (paginated)
            const proposals = await org.getProposals(0, count);

            for (const proposalMetaAddr of proposals.slice(0, 5)) { // Limit to 5
                console.log(`  📋 Proposal Metadata: ${proposalMetaAddr}`);

                // Query proposal details
                const proposalMeta = new ethers.Contract(proposalMetaAddr, ABIs.Proposal, provider);

                try {
                    const question = await proposalMeta.displayNameQuestion();
                    const eventName = await proposalMeta.displayNameEvent();
                    const tradingAddr = await proposalMeta.proposalAddress();

                    console.log(`     Question: ${question}`);
                    console.log(`     Event: ${eventName}`);
                    console.log(`     Trading Contract: ${tradingAddr}`);

                    // Query trading contract
                    await queryTradingProposal(tradingAddr);
                } catch (e) {
                    console.log(`     (Could not fetch: ${e.message})`);
                }
                console.log();
            }

            return proposals;
        }
    } catch (e) {
        console.log(`Error: ${e.message}`);
    }

    return [];
}

// =============================================================================
// 4. QUERY TRADING PROPOSAL (The Actual DeFi Contract)
// =============================================================================

async function queryTradingProposal(tradingAddress) {
    console.log(`\n     💹 Trading Contract Details:`);

    const trading = new ethers.Contract(tradingAddress, ABIs.FutarchyProposal, provider);

    try {
        // Market Name
        const marketName = await trading.marketName();
        console.log(`        Market: ${marketName}`);

        // Collateral Tokens
        const companyToken = await trading.collateralToken1();
        const currencyToken = await trading.collateralToken2();

        // Get Token Details
        const company = new ethers.Contract(companyToken, ABIs.ERC20, provider);
        const currency = new ethers.Contract(currencyToken, ABIs.ERC20, provider);

        const companySymbol = await company.symbol().catch(() => 'UNK');
        const currencySymbol = await currency.symbol().catch(() => 'UNK');

        console.log(`        Company Token: ${companySymbol} (${companyToken})`);
        console.log(`        Currency Token: ${currencySymbol} (${currencyToken})`);

        // Wrapped Outcomes (Conditional Tokens)
        const outcomes = [];
        for (let i = 0; i < 4; i++) {
            try {
                const result = await trading.wrappedOutcome(i);
                outcomes.push(result.wrapped1155);
                console.log(`        Outcome[${i}]: ${result.wrapped1155}`);
            } catch (e) {
                break;
            }
        }

        return {
            marketName,
            companyToken: { address: companyToken, symbol: companySymbol },
            currencyToken: { address: currencyToken, symbol: currencySymbol },
            outcomes
        };
    } catch (e) {
        console.log(`        (Could not fetch: ${e.message})`);
        return null;
    }
}

// =============================================================================
// 5. QUERY VIA SUBGRAPH (THE EASY WAY)
// =============================================================================

async function querySubgraph() {
    console.log('\n🔍 === SUBGRAPH QUERY (Recommended) ===\n');

    const SUBGRAPH_URL = 'https://api.studio.thegraph.com/query/1719045/futarchy-complete/version/latest';

    const query = `{
        aggregators(first: 5) {
            id
            name
            description
            organizations {
                id
                name
                proposals {
                    id
                    title
                    displayNameQuestion
                    companyToken { symbol }
                    currencyToken { symbol }
                    poolConditionalYes { id currentPrice }
                    poolConditionalNo { id currentPrice }
                }
            }
        }
    }`;

    try {
        const response = await fetch(SUBGRAPH_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });

        const result = await response.json();

        if (result.data?.aggregators) {
            console.log('✅ Subgraph Response:\n');
            console.log(JSON.stringify(result.data, null, 2));
        } else {
            console.log('⚠️  No data or error:', result.errors);
        }

        return result.data;
    } catch (e) {
        console.log(`❌ Subgraph error: ${e.message}`);
        return null;
    }
}

// =============================================================================
// MAIN EXECUTION
// =============================================================================

async function main() {
    console.log('═'.repeat(60));
    console.log('  FUTARCHY COMPLETE ABI GUIDE - INTERACTIVE TEST');
    console.log('═'.repeat(60));

    const args = process.argv.slice(2);
    const command = args[0] || 'all';

    switch (command) {
        case 'aggregators':
            await queryAllAggregators();
            break;

        case 'organizations':
            await queryOrganizations();
            break;

        case 'proposals':
            const orgAddr = args[1];
            if (orgAddr) {
                await queryProposalsFromOrganization(orgAddr);
            } else {
                console.log('Usage: node test-complete-abi.js proposals <org-address>');
                // Find first org with proposals
                const orgs = await queryOrganizations();
                const withProposals = orgs.find(o => o.proposalCount > 0);
                if (withProposals) {
                    console.log(`\nAuto-selecting: ${withProposals.name}`);
                    await queryProposalsFromOrganization(withProposals.address);
                }
            }
            break;

        case 'trading':
            const tradingAddr = args[1];
            if (tradingAddr) {
                await queryTradingProposal(tradingAddr);
            } else {
                console.log('Usage: node test-complete-abi.js trading <trading-address>');
            }
            break;

        case 'subgraph':
            await querySubgraph();
            break;

        case 'all':
        default:
            console.log('\nRunning full hierarchy test...\n');

            // 1. Aggregators
            const aggregators = await queryAllAggregators();

            // 2. Organizations
            const orgs = await queryOrganizations();

            // 3. First org with proposals
            const orgWithProposals = orgs.find(o => o.proposalCount > 0);
            if (orgWithProposals) {
                await queryProposalsFromOrganization(orgWithProposals.address);
            }

            // 4. Subgraph (easier way)
            await querySubgraph();
            break;
    }

    console.log('\n' + '═'.repeat(60));
    console.log('  TEST COMPLETE');
    console.log('═'.repeat(60));
}

main().catch(console.error);
