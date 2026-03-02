import chalk from 'chalk';
import Table from 'cli-table3';
import { printSection, printError, STYLES } from '../cli/ui.js';

export async function displayAggregator(subgraph, id) {
    const data = await subgraph.getAggregator(id);
    const agg = data.aggregator;

    if (!agg) {
        printError('Aggregator not found!');
        return;
    }

    const info = `
${STYLES.info('ID:')} ${STYLES.address(agg.id)}
${STYLES.info('Owner:')} ${chalk.green(agg.owner)}
${STYLES.info('Organizations:')} ${agg.organizations.length}
`;
    printSection(`🏛️  Aggregator: ${agg.name}`, info, 'blue');

    const table = new Table({
        head: ['Org Name', 'Org ID', 'Proposals'],
        colWidths: [20, 45, 12]
    });

    agg.organizations.forEach(org => {
        table.push([org.name, org.id, org.proposals.length]);
    });

    console.log(table.toString());
}

export async function displayOrganization(subgraph, id) {
    const data = await subgraph.getOrganization(id);
    const org = data.organization;

    if (!org) {
        printError('Organization not found!');
        return;
    }

    const info = `
${STYLES.info('ID:')} ${STYLES.address(org.id)}
${STYLES.info('Description:')} ${org.description || 'N/A'}
${STYLES.info('Proposals:')} ${org.proposals.length}
`;
    printSection(`🏢 Organization: ${org.name}`, info, 'blue');

    const table = new Table({
        head: ['Proposal ID', 'Name'],
        colWidths: [45, 50]
    });

    org.proposals.forEach(p => {
        // truncate name
        let name = p.marketName || 'No Name';
        if (name.length > 45) name = name.substring(0, 45) + '...';
        table.push([p.id, name]);
    });

    console.log(table.toString());
}

export async function displayPools(subgraph, proposalId) {
    const data = await subgraph.getPools(proposalId);
    const pools = data.pools;

    if (!pools || pools.length === 0) {
        // Not an error, just empty
        console.log(STYLES.warning('\nNo pools found for this proposal.'));
        return;
    }

    console.log(STYLES.success(`\n🌊 ${pools.length} Pools Found`));

    const table = new Table({
        head: ['Type', 'Side', 'Liquidity', 'Tick'],
        colWidths: [15, 10, 20, 10]
    });

    pools.forEach(pool => {
        table.push([
            pool.type,
            pool.outcomeSide || '-',
            parseFloat(pool.liquidity).toExponential(2),
            pool.tick
        ]);
    });

    console.log(table.toString());
}

export async function displaySwaps(subgraph, poolIds) {
    const swaps = await subgraph.getSwaps(poolIds);

    if (swaps.length === 0) {
        console.log(STYLES.dim('\nNo recent swaps.'));
        return;
    }

    console.log(STYLES.highlight(`\n🔄 Recent Swaps (Last ${swaps.length})`));

    const table = new Table({
        head: ['Time', 'Side', 'In', 'Out'],
        colWidths: [20, 8, 20, 20]
    });

    swaps.forEach(swap => {
        const date = new Date(parseInt(swap.timestamp) * 1000).toLocaleTimeString();
        const side = swap.pool.outcomeSide || '?';
        const inAmt = `${parseFloat(swap.amountIn).toFixed(2)} ${swap.tokenIn.symbol}`;
        const outAmt = `${parseFloat(swap.amountOut).toFixed(2)} ${swap.tokenOut.symbol}`;

        table.push([date, side, inAmt, outAmt]);
    });

    console.log(table.toString());
}

export async function displayCandles(subgraph, poolId) {
    const candles = await subgraph.getCandles(poolId, 10);

    if (candles.length === 0) {
        console.log(STYLES.dim('\nNo candle data.'));
        return;
    }

    console.log(STYLES.warning(`\n🕯️  Candles (Last 10)`));

    const table = new Table({
        head: ['Time', 'Open', 'Close', 'Vol'],
        colWidths: [10, 10, 10, 10]
    });

    candles.reverse().forEach(c => {
        const date = new Date(parseInt(c.periodStartUnix) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        table.push([
            date,
            parseFloat(c.open).toFixed(3),
            parseFloat(c.close).toFixed(3),
            Math.round(c.volumeUSD)
        ]);
    });

    console.log(table.toString());
}

export async function displaySpotPrice(spotClient, network, poolAddress) {
    const price = await spotClient.getSpotPrice(network, poolAddress);

    if (price) {
        printSection('Spot Price', `GeckoTerminal: $${price}`, 'green');
    } else {
        console.log(STYLES.dim('\nNo external spot price available.'));
    }
}

