import { program } from 'commander';
import { SubgraphClient } from './src/core/subgraph.js';
import { BlockchainService } from './src/core/provider.js';
import { ContractService } from './src/core/contracts.js';
import { SpotClient } from './src/core/spotClient.js';
import { startCLI } from './src/cli/menu.js';
import { checkProposal, dumpJson, verifyHierarchy } from './src/actions/headless.js';

async function main() {
    const subgraph = new SubgraphClient();
    const blockchain = new BlockchainService();
    const contracts = new ContractService(blockchain);
    const spotClient = new SpotClient();

    program
        .name('futarchy-sdk')
        .description('Futarchy v2 SDK CLI & Automation Tool')
        .version('1.0.0');

    // Interactive Mode (Default)
    program.command('interactive', { isDefault: true })
        .description('Start the interactive menu (Default)')
        .action(async () => {
            await startCLI(subgraph, contracts, spotClient);
        });

    // Automation Commands
    program.command('check <id>')
        .description('Run health check on a proposal (Config + Liquidity)')
        .action(async (id) => {
            await checkProposal(subgraph, id);
        });

    program.command('json <id>')
        .description('Dump raw JSON config for piping')
        .action(async (id) => {
            await dumpJson(subgraph, id);
        });

    program.command('verify')
        .description('Verify Aggregator Hierarchy connectivity')
        .action(async () => {
            await verifyHierarchy(subgraph);
        });

    await program.parseAsync(process.argv);
}

main().catch(console.error);
