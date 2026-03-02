// cli.js
import dotenv from 'dotenv';
dotenv.config();

import { DataLayer } from './src/core/DataLayer.js';
import { ViemExecutor } from './src/executors/ViemExecutor.js';
import { FutarchyCompleteCartridge } from './src/cartridges/FutarchyCompleteCartridge.js';

// Setup System
const dataLayer = new DataLayer();
const executor = new ViemExecutor(); // Reads ENV for Private Key/RPC
const cartridge = new FutarchyCompleteCartridge();

// Link them up
executor.registerCartridge(cartridge);
dataLayer.registerExecutor(executor);

// Helper to run operations
async function runOperation(op, args) {
    console.log(`\n🔹 Running: ${op}`);
    for await (const update of dataLayer.execute(op, args)) {
        if (update.status === 'partial') {
            // Optional: Print progress
            // console.log(`  > ${update.message}`);
        } else {
            console.log(`  [${update.status.toUpperCase()}] ${update.message}`);
            if (update.data && update.status === 'success') {
                console.log('  DATA:', JSON.stringify(update.data, null, 2));
            }
        }
    }
}

import { InteractiveCLI } from './src/cli/interactive.js';

// Simple Command Handler
const [, , command, ...args] = process.argv;

async function main() {
    if (!command) {
        // Launch Interactive Mode
        const interactive = new InteractiveCLI(dataLayer, executor);
        await interactive.start();
        return;
    }

    switch (command) {
        case 'interactive':
            const interactive = new InteractiveCLI(dataLayer, executor);
            await interactive.start();
            break;

        case 'list-orgs':
            await runOperation('futarchy.getOrganizations', {});
            return;

        case 'list-proposals':
            const orgAddress = args[0];
            if (!orgAddress) {
                console.error("Usage: list-proposals <orgAddress>");
                return;
            }
            await runOperation('futarchy.getProposals', { organizationAddress: orgAddress });
            break;

        case 'add-proposal':
            // Usage: add-proposal <orgAddr> <proposalAddr> <question> <marketName>
            const [orgAddr, propAddr, question, marketName] = args;
            if (!orgAddr || !propAddr || !question || !marketName) {
                console.error("Usage: add-proposal <orgAddr> <proposalAddr> <question> <marketName>");
                return;
            }
            await runOperation('futarchy.addProposal', {
                organizationAddress: orgAddr,
                proposalAddress: propAddr,
                question,
                marketName
            });
            break;

        case 'create-pool':
            // Usage: create-pool <proposalAddr> <poolType> <initialPrice> [chainId]
            const [poolProposal, poolType, priceStr, chainIdStr] = args;
            if (!poolProposal || !poolType || !priceStr) {
                console.error("Usage: create-pool <proposalAddr> <poolType> <initialPrice> [chainId]");
                console.error("  poolType: CONDITIONAL_YES, CONDITIONAL_NO, PREDICTION_YES, PREDICTION_NO, EXPECTED_VALUE_YES, EXPECTED_VALUE_NO");
                console.error("  initialPrice: spot price of token1/token0 (e.g., 120 for GNO/sDAI)");
                console.error("  chainId: 100 (Gnosis/Algebra) or 1 (Ethereum/UniswapV3). Default: 100");
                return;
            }
            await runOperation('futarchy.createPool', {
                proposalAddress: poolProposal,
                poolType: poolType,
                initialPrice: parseFloat(priceStr),
                chainId: chainIdStr ? parseInt(chainIdStr) : 100
            });
            break;

        default:
            console.log("Usage:");
            console.log("  node cli.js list-orgs");
            console.log("  node cli.js list-proposals <orgAddress>");
            console.log("  node cli.js add-proposal <orgAddr> <proposalAddr> <question> <marketName>");
            console.log("  node cli.js create-pool <proposalAddr> <poolType> <initialPrice> [chainId]");
            break;
    }
}

main().catch(console.error);
