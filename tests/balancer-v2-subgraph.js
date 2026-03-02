/**
 * Balancer V2 Subgraph Query Test
 * 
 * Tests querying swap data from Balancer V2 on Gnosis Chain
 * Using one of the multi-hop pools: GNO/WXDAI
 * 
 * Run: node tests/balancer-v2-subgraph.js
 */

require('dotenv').config();
const fetch = require('node-fetch');

// ============================================
// CONFIGURATION
// ============================================

const GRAPH_API_KEY = '1f3de4a47d9dfb2a32e1890f63858fff';

// Balancer V2 Gnosis Chain subgraph
const BALANCER_V2_SUBGRAPH = `https://gateway-arbitrum.network.thegraph.com/api/${GRAPH_API_KEY}/subgraphs/id/EJezH1Cp31QkKPaBDerhVPRWsKVZLrDfzjrLqpmv6cGg`;

// Pool IDs from the contract (used in multi-hop swaps)
const POOLS = {
    GNO_WXDAI: '0x8189c4c96826d016a99986394103dfa9ae41e7ee0002000000000000000000aa',
    WXDAI_USDC: '0x2086f52651837600180de173b09470f54ef7491000000000000000000000004f',
    USDC_SDAI: '0x7644fa5d0ea14fcf3e813fdf93ca9544f8567655000000000000000000000066'
};

// ============================================
// GRAPHQL QUERIES
// ============================================

// Get pool info
const POOL_INFO_QUERY = `
query getPoolInfo($poolId: ID!) {
  pool(id: $poolId) {
    id
    name
    symbol
    swapFee
    totalLiquidity
    totalSwapVolume
    totalSwapFee
    tokens {
      symbol
      address
      balance
      weight
    }
  }
}
`;

// Get recent swaps for a pool
const SWAPS_QUERY = `
query getRecentSwaps($poolId: String!, $first: Int!, $skip: Int!) {
  swaps(
    where: { poolId: $poolId }
    orderBy: timestamp
    orderDirection: desc
    first: $first
    skip: $skip
  ) {
    id
    timestamp
    tokenIn
    tokenOut
    tokenAmountIn
    tokenAmountOut
    valueUSD
    tx
  }
}
`;

// Get swaps within a time range (for candle building)
const SWAPS_TIME_RANGE_QUERY = `
query getSwapsInRange($poolId: String!, $from: Int!, $to: Int!) {
  swaps(
    where: { poolId: $poolId, timestamp_gte: $from, timestamp_lte: $to }
    orderBy: timestamp
    orderDirection: asc
    first: 1000
  ) {
    id
    timestamp
    tokenIn
    tokenOut
    tokenAmountIn
    tokenAmountOut
    valueUSD
  }
}
`;

// ============================================
// HELPER FUNCTIONS
// ============================================

async function querySubgraph(query, variables = {}) {
    const response = await fetch(BALANCER_V2_SUBGRAPH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables })
    });

    const result = await response.json();

    if (result.errors) {
        console.error('GraphQL Errors:', result.errors);
        throw new Error(result.errors[0].message);
    }

    return result.data;
}

/**
 * Build 1-hour candles from swap data
 */
function buildHourlyCandles(swaps, tokenSymbol) {
    const hourlyData = {};

    for (const swap of swaps) {
        // Calculate price (tokenOut / tokenIn)
        const amountIn = parseFloat(swap.tokenAmountIn);
        const amountOut = parseFloat(swap.tokenAmountOut);

        if (amountIn === 0) continue;

        const price = amountOut / amountIn;
        const hourTimestamp = Math.floor(swap.timestamp / 3600) * 3600;

        if (!hourlyData[hourTimestamp]) {
            hourlyData[hourTimestamp] = {
                timestamp: hourTimestamp,
                open: price,
                high: price,
                low: price,
                close: price,
                volume: parseFloat(swap.valueUSD) || 0,
                swapCount: 0
            };
        } else {
            const candle = hourlyData[hourTimestamp];
            candle.high = Math.max(candle.high, price);
            candle.low = Math.min(candle.low, price);
            candle.close = price; // Last price becomes close
            candle.volume += parseFloat(swap.valueUSD) || 0;
        }
        hourlyData[hourTimestamp].swapCount++;
    }

    return Object.values(hourlyData).sort((a, b) => a.timestamp - b.timestamp);
}

function formatTimestamp(ts) {
    return new Date(ts * 1000).toISOString();
}

// ============================================
// TEST FUNCTIONS
// ============================================

async function testPoolInfo() {
    console.log('\n📊 TEST 1: Fetching Pool Info for GNO/WXDAI');
    console.log('='.repeat(50));

    try {
        const data = await querySubgraph(POOL_INFO_QUERY, { poolId: POOLS.GNO_WXDAI });

        if (data.pool) {
            console.log(`Pool Name: ${data.pool.name}`);
            console.log(`Pool Symbol: ${data.pool.symbol}`);
            console.log(`Swap Fee: ${(parseFloat(data.pool.swapFee) * 100).toFixed(2)}%`);
            console.log(`Total Liquidity: $${parseFloat(data.pool.totalLiquidity).toLocaleString()}`);
            console.log(`Total Volume: $${parseFloat(data.pool.totalSwapVolume).toLocaleString()}`);
            console.log('\nTokens:');
            for (const token of data.pool.tokens) {
                console.log(`  - ${token.symbol}: ${parseFloat(token.balance).toFixed(4)} (${(parseFloat(token.weight) * 100).toFixed(0)}%)`);
            }
            return true;
        } else {
            console.log('❌ Pool not found');
            return false;
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
        return false;
    }
}

async function testRecentSwaps() {
    console.log('\n🔄 TEST 2: Fetching Recent Swaps for GNO/WXDAI');
    console.log('='.repeat(50));

    try {
        const data = await querySubgraph(SWAPS_QUERY, {
            poolId: POOLS.GNO_WXDAI,
            first: 10,
            skip: 0
        });

        if (data.swaps && data.swaps.length > 0) {
            console.log(`Found ${data.swaps.length} recent swaps:\n`);

            for (const swap of data.swaps.slice(0, 5)) {
                console.log(`Time: ${formatTimestamp(swap.timestamp)}`);
                console.log(`  In:  ${parseFloat(swap.tokenAmountIn).toFixed(6)} (${swap.tokenIn.slice(0, 10)}...)`);
                console.log(`  Out: ${parseFloat(swap.tokenAmountOut).toFixed(6)} (${swap.tokenOut.slice(0, 10)}...)`);
                console.log(`  Value: $${parseFloat(swap.valueUSD).toFixed(2)}`);
                console.log('');
            }
            return true;
        } else {
            console.log('❌ No swaps found');
            return false;
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
        return false;
    }
}

async function testHourlyCandles() {
    console.log('\n📈 TEST 3: Building 1-Hour Candles (Last 24 Hours)');
    console.log('='.repeat(50));

    try {
        const now = Math.floor(Date.now() / 1000);
        const oneDayAgo = now - (24 * 60 * 60);

        const data = await querySubgraph(SWAPS_TIME_RANGE_QUERY, {
            poolId: POOLS.GNO_WXDAI,
            from: oneDayAgo,
            to: now
        });

        if (data.swaps && data.swaps.length > 0) {
            console.log(`Found ${data.swaps.length} swaps in last 24 hours\n`);

            const candles = buildHourlyCandles(data.swaps);

            console.log('Hourly Candles:');
            console.log('-'.repeat(80));
            console.log('Time                      | Open     | High     | Low      | Close    | Volume   | Swaps');
            console.log('-'.repeat(80));

            for (const candle of candles.slice(-10)) { // Last 10 hours
                const time = formatTimestamp(candle.timestamp).slice(0, 16);
                console.log(
                    `${time} | ` +
                    `${candle.open.toFixed(4).padStart(8)} | ` +
                    `${candle.high.toFixed(4).padStart(8)} | ` +
                    `${candle.low.toFixed(4).padStart(8)} | ` +
                    `${candle.close.toFixed(4).padStart(8)} | ` +
                    `$${candle.volume.toFixed(0).padStart(7)} | ` +
                    `${candle.swapCount}`
                );
            }

            return true;
        } else {
            console.log('⚠️ No swaps found in last 24 hours (pool may have low activity)');
            return false;
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
        return false;
    }
}

async function testAllPools() {
    console.log('\n🏊 TEST 4: Checking All Multi-Hop Pools');
    console.log('='.repeat(50));

    for (const [name, poolId] of Object.entries(POOLS)) {
        try {
            const data = await querySubgraph(POOL_INFO_QUERY, { poolId });

            if (data.pool) {
                const tokens = data.pool.tokens.map(t => t.symbol).join(' / ');
                const liquidity = parseFloat(data.pool.totalLiquidity).toLocaleString();
                console.log(`✅ ${name}: ${tokens} — $${liquidity} liquidity`);
            } else {
                console.log(`❌ ${name}: Pool not found`);
            }
        } catch (error) {
            console.log(`❌ ${name}: ${error.message}`);
        }
    }
}

// ============================================
// MAIN
// ============================================

async function main() {
    console.log('🔍 Balancer V2 Subgraph Test - Gnosis Chain');
    console.log('='.repeat(50));
    console.log(`Subgraph: ${BALANCER_V2_SUBGRAPH.slice(0, 60)}...`);
    console.log(`Target Pool: GNO/WXDAI (${POOLS.GNO_WXDAI.slice(0, 20)}...)`);

    const results = {
        poolInfo: await testPoolInfo(),
        recentSwaps: await testRecentSwaps(),
        hourlyCandles: await testHourlyCandles(),
        allPools: await testAllPools()
    };

    console.log('\n📋 SUMMARY');
    console.log('='.repeat(50));
    console.log(`Pool Info:      ${results.poolInfo ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Recent Swaps:   ${results.recentSwaps ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Hourly Candles: ${results.hourlyCandles ? '✅ PASS' : '⚠️ NO DATA'}`);
    console.log(`All Pools:      ${results.allPools !== false ? '✅ CHECKED' : '❌ FAIL'}`);
}

main().catch(console.error);
