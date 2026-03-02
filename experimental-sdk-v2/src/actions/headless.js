import chalk from 'chalk';
import { ConfigAdapter } from '../core/configAdapter.js';
import { LiquidityAnalyzer } from '../core/liquidity.js';
import { CHAIN_ID, CONTRACTS } from '../config/constants.js';

export async function checkProposal(subgraph, id) {
    console.log(chalk.blue(`Checking Proposal ${id}...`));
    const data = await subgraph.getProposalDetails(id);

    if (!data.proposal) {
        console.error(chalk.red('Proposal NOT FOUND'));
        process.exit(1);
    }

    // 1. Config Check
    try {
        const config = ConfigAdapter.transform(data.proposal, CHAIN_ID);
        console.log(chalk.green('✓ Config Adapter: Valid'));

        // Check critical fields
        if (!config.metadata.contractInfos.collateralToken) console.warn(chalk.yellow('! Missing Collateral Token'));
        if (config.metadata.contractInfos.outcomeTokens.length < 2) console.warn(chalk.yellow('! Missing Outcome Tokens'));
    } catch (e) {
        console.error(chalk.red('X Config Adapter Failed:'), e.message);
    }

    // 2. Liquidity Check
    const analysis = LiquidityAnalyzer.analyze(data.proposal.pools);
    if (!analysis.yes && !analysis.no) {
        console.log(chalk.red('X Pools: NO ACTIVE POOLS FOUND'));
    } else {
        const status = (p) => p ? chalk.green(`OK (${p.address.slice(0, 6)}...)`) : chalk.red('MISSING');
        console.log(`POOLS STATUS: YES [${status(analysis.yes)}] | NO [${status(analysis.no)}]`);
    }

    console.log(chalk.dim('Done.'));
}

export async function dumpJson(subgraph, id) {
    const data = await subgraph.getProposalDetails(id);
    if (!data.proposal) {
        process.stderr.write('Proposal not found\n');
        process.exit(1);
    }
    const config = ConfigAdapter.transform(data.proposal, CHAIN_ID);
    console.log(JSON.stringify(config, null, 2));
}

export async function verifyHierarchy(subgraph) {
    console.log(chalk.blue('Walking Hierarchy...'));
    const data = await subgraph.getAggregator(CONTRACTS.DEFAULT_AGGREGATOR);

    // Debug Logging
    if (!data) {
        console.error(chalk.red(`Error: Subgraph returned undefined for ID: ${CONTRACTS.DEFAULT_AGGREGATOR}`));
        console.error('Check your SUBGRAPH_URL in constants.js');
        process.exit(1);
    }

    const agg = data.aggregator;

    if (!agg) {
        console.error(chalk.red('Aggregator Not Found'));
        process.exit(1);
    }

    console.log(`Aggregator: ${agg.id} (Name: ${agg.name})`);

    for (const org of agg.organizations) {
        console.log(`\n  🏢 Org: ${org.name} [${org.id}]`);
        // List up to 5 proposals to avoid clutter
        const recent = org.proposals.slice(0, 5);
        for (const p of recent) {
            console.log(`      └─ Proposal: "${p.marketName || 'Untitled'}" [${p.id}]`);
        }
        if (org.proposals.length > 5) {
            console.log(`      └─ ... and ${org.proposals.length - 5} more`);
        }
    }
}
