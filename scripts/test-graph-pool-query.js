/**
 * Find liquid GNO/DAI pools on Gnosis from Balancer subgraph
 * 
 * Run with: node scripts/test-graph-pool-query.js
 */

const SUBGRAPH_URL = 'https://gateway.thegraph.com/api/1f3de4a47d9dfb2a32e1890f63858fff/subgraphs/id/5u5FiHsL7HTvu8Hh3zqvh5nLdQYpmxdXyBmZacPzk2sn';

async function querySubgraph(query) {
    const response = await fetch(SUBGRAPH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
    });
    return response.json();
}

async function findLiquidPools() {
    console.log('🔍 Finding liquid pools on Gnosis (Balancer V3 subgraph)...\n');
    console.log('Filtering for pools with significant TVL containing GNO or DAI variants\n');

    const result = await querySubgraph(`
    query {
      pools(
        first: 50
        orderBy: totalLiquidity
        orderDirection: desc
        where: { totalLiquidity_gt: "1000" }
      ) {
        id
        address
        name
        symbol
        poolType
        totalLiquidity
        swapFee
        tokens {
          address
          symbol
          balance
          decimals
        }
      }
    }
  `);

    if (result.errors) {
        console.log('❌ Query failed:', JSON.stringify(result.errors, null, 2));
        return;
    }

    const pools = result.data?.pools || [];
    console.log(`Found ${pools.length} pools with TVL > $1000\n`);

    // Filter for pools with GNO or DAI variants
    const relevantPools = pools.filter(pool => {
        const symbols = pool.tokens?.map(t => t.symbol?.toUpperCase()) || [];
        const hasGno = symbols.some(s => s?.includes('GNO'));
        const hasDai = symbols.some(s => s?.includes('DAI'));
        return hasGno || hasDai;
    });

    console.log(`${relevantPools.length} pools contain GNO or DAI tokens:\n`);
    console.log('='.repeat(70));

    relevantPools.forEach((pool, i) => {
        const tvl = parseFloat(pool.totalLiquidity);
        const tokenList = pool.tokens?.map(t => t.symbol).join(' / ');

        console.log(`\n[${i + 1}] ${pool.name || pool.symbol}`);
        console.log(`    Address: ${pool.address}`);
        console.log(`    Type: ${pool.poolType}`);
        console.log(`    TVL: $${tvl.toLocaleString()}`);
        console.log(`    Fee: ${(parseFloat(pool.swapFee) * 100).toFixed(2)}%`);
        console.log(`    Tokens: ${tokenList}`);

        // Show balances
        pool.tokens?.forEach(t => {
            const bal = parseFloat(t.balance);
            console.log(`      - ${t.symbol}: ${bal.toLocaleString(undefined, { maximumFractionDigits: 2 })}`);
        });
    });

    // Highlight best GNO/DAI pools
    console.log('\n' + '='.repeat(70));
    console.log('🎯 BEST CANDIDATES FOR GNO/sDAI PRICING:');
    console.log('='.repeat(70));

    const gnoDaiPools = relevantPools.filter(pool => {
        const symbols = pool.tokens?.map(t => t.symbol?.toUpperCase()) || [];
        const hasGno = symbols.some(s => s?.includes('GNO'));
        const hasDai = symbols.some(s => s?.includes('DAI'));
        return hasGno && hasDai;
    });

    if (gnoDaiPools.length === 0) {
        console.log('\nNo pools with BOTH GNO and DAI variants found.');
        console.log('You may need to route through intermediate pools.');
    } else {
        gnoDaiPools.forEach((pool, i) => {
            console.log(`\n🏆 ${pool.name}`);
            console.log(`   Address: ${pool.address}`);
            console.log(`   TVL: $${parseFloat(pool.totalLiquidity).toLocaleString()}`);
            console.log(`   Tokens: ${pool.tokens?.map(t => t.symbol).join(' / ')}`);
        });
    }
}

findLiquidPools()
    .then(() => console.log('\n\n✅ Done!'))
    .catch(err => console.error('\n❌ Failed:', err));
