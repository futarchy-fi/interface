#!/usr/bin/env node
/**
 * Test the Futarchy MCP Server tools directly
 * 
 * Usage: node test-mcp-tools.js
 */

import dotenv from 'dotenv';
dotenv.config();

import { DataLayer } from './src/core/DataLayer.js';
import { ViemExecutor } from './src/executors/ViemExecutor.js';
import { FutarchyCompleteCartridge } from './src/cartridges/FutarchyCompleteCartridge.js';
import { fetchPools, fetchCandles } from './src/core/ChartDataClient.js';
import { CONTRACT_ADDRESSES } from './src/config/contracts.js';

// Setup
const dataLayer = new DataLayer();
const executor = new ViemExecutor();
const cartridge = new FutarchyCompleteCartridge();
executor.registerCartridge(cartridge);
dataLayer.registerExecutor(executor);

// Test helper
async function testTool(name, operation, args = {}) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📡 Testing: ${name}`);
    console.log(`   Operation: ${operation}`);
    console.log(`   Args: ${JSON.stringify(args)}`);
    console.log('='.repeat(60));

    try {
        for await (const update of dataLayer.execute(operation, args)) {
            if (update.status === 'success') {
                console.log(`✅ SUCCESS`);
                console.log(JSON.stringify(update.data, null, 2).slice(0, 1000));
                if (JSON.stringify(update.data).length > 1000) {
                    console.log('... (truncated)');
                }
                return update.data;
            } else if (update.status === 'error') {
                console.log(`❌ ERROR: ${update.message}`);
                return null;
            } else {
                console.log(`   ${update.status}: ${update.message || ''}`);
            }
        }
    } catch (e) {
        console.log(`❌ EXCEPTION: ${e.message}`);
        return null;
    }
}

// Run tests
async function main() {
    console.log('\n🧪 FUTARCHY MCP SERVER - TOOL TESTS\n');

    // Test 1: Get Organizations
    const orgs = await testTool(
        'get_organizations',
        'futarchy.getOrganizations',
        { aggregatorAddress: CONTRACT_ADDRESSES.DEFAULT_AGGREGATOR }
    );

    if (!orgs || orgs.length === 0) {
        console.log('\n⚠️  No organizations found, stopping tests');
        return;
    }

    // Test 2: Get Proposals (first org)
    const firstOrg = orgs[0];
    console.log(`\n📦 Using org: ${firstOrg.name} (${firstOrg.address})`);

    const proposals = await testTool(
        'get_proposals',
        'futarchy.getProposals',
        { organizationAddress: firstOrg.address }
    );

    if (!proposals || proposals.length === 0) {
        console.log('\n⚠️  No proposals found');
    } else {
        // Test 3: Get Proposal Details (first proposal)
        const firstProposal = proposals[0];
        const proposalAddr = firstProposal.proposalAddress;

        if (proposalAddr) {
            console.log(`\n📋 Using proposal: ${proposalAddr}`);

            await testTool(
                'get_proposal_details',
                'futarchy.getProposalDetails',
                { proposalAddress: proposalAddr }
            );

            // Test 4: Get Pool Prices
            console.log(`\n📈 Testing pool prices...`);
            const { yesPool, noPool, error } = await fetchPools(100, proposalAddr);
            if (error) {
                console.log(`❌ Pool fetch error: ${error}`);
            } else {
                console.log(`✅ YES Pool: ${yesPool?.id?.slice(0, 20)}... price=${yesPool?.price}`);
                console.log(`✅ NO Pool: ${noPool?.id?.slice(0, 20)}... price=${noPool?.price}`);
            }

            // Test 5: Get Candles
            console.log(`\n📊 Testing candle fetch...`);
            const candleResult = await fetchCandles(100, proposalAddr, 10);
            if (candleResult.error) {
                console.log(`❌ Candle fetch error: ${candleResult.error}`);
            } else {
                console.log(`✅ YES Candles: ${candleResult.yesData?.length || 0}`);
                console.log(`✅ NO Candles: ${candleResult.noData?.length || 0}`);
            }
        }
    }

    // Test 6: Get Linkable Proposals
    await testTool(
        'get_linkable_proposals',
        'futarchy.getLinkableProposals',
        { chainId: 100, limit: 5 }
    );

    console.log('\n' + '='.repeat(60));
    console.log('🎉 ALL TESTS COMPLETE');
    console.log('='.repeat(60) + '\n');
}

main().catch(console.error);
