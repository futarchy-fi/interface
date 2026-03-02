/**
 * Test: Introspect Balancer V2 Subgraph Schema on Gnosis
 * 
 * Purpose: Discover what entities are available in the subgraph
 * to see if there are candles, hourly/daily aggregations, or just swaps.
 * 
 * Run: node scripts/test-balancer-schema.js
 */

const fetch = require('node-fetch');

const GRAPH_API_KEY = '1f3de4a47d9dfb2a32e1890f63858fff';
const BALANCER_SUBGRAPH = `https://gateway-arbitrum.network.thegraph.com/api/${GRAPH_API_KEY}/subgraphs/id/EJezH1Cp31QkKPaBDerhVPRWsKVZLrDfzjrLqpmv6cGg`;

async function querySubgraph(query, variables = {}) {
    const response = await fetch(BALANCER_SUBGRAPH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables })
    });
    const result = await response.json();
    return result;
}

// ============================
// INTROSPECTION QUERIES
// ============================

async function getSchemaTypes() {
    console.log('\n📋 SCHEMA INTROSPECTION: All Types');
    console.log('='.repeat(60));

    const query = `
        query IntrospectTypes {
            __schema {
                types {
                    name
                    kind
                    description
                }
            }
        }
    `;

    const result = await querySubgraph(query);

    if (result.errors) {
        console.log('❌ Error:', result.errors[0].message);
        return [];
    }

    // Filter to only show object types (entities)
    const objectTypes = result.data.__schema.types
        .filter(t => t.kind === 'OBJECT' && !t.name.startsWith('__'))
        .map(t => t.name)
        .sort();

    console.log(`\n🔍 Found ${objectTypes.length} Object Types:`);
    for (const name of objectTypes) {
        // Highlight interesting types
        const icon =
            name.toLowerCase().includes('candle') ? '📊' :
                name.toLowerCase().includes('swap') ? '🔄' :
                    name.toLowerCase().includes('pool') ? '🏊' :
                        name.toLowerCase().includes('snapshot') ? '📸' :
                            name.toLowerCase().includes('hourly') ? '🕐' :
                                name.toLowerCase().includes('daily') ? '📅' :
                                    '  ';
        console.log(`   ${icon} ${name}`);
    }

    return objectTypes;
}

async function getTypeFields(typeName) {
    console.log(`\n📝 FIELDS for "${typeName}":`);
    console.log('-'.repeat(40));

    const query = `
        query IntrospectType($name: String!) {
            __type(name: $name) {
                name
                fields {
                    name
                    type {
                        name
                        kind
                        ofType {
                            name
                            kind
                        }
                    }
                }
            }
        }
    `;

    const result = await querySubgraph(query, { name: typeName });

    if (result.errors) {
        console.log('❌ Error:', result.errors[0].message);
        return;
    }

    const fields = result.data.__type?.fields || [];
    for (const f of fields) {
        const typeName = f.type.name || f.type.ofType?.name || f.type.kind;
        console.log(`   ${f.name}: ${typeName}`);
    }
}

async function checkQueryRoot() {
    console.log('\n🌳 ROOT QUERY FIELDS (Available Queries):');
    console.log('='.repeat(60));

    const query = `
        query IntrospectQueryType {
            __schema {
                queryType {
                    fields {
                        name
                        description
                        args {
                            name
                            type {
                                name
                                kind
                            }
                        }
                    }
                }
            }
        }
    `;

    const result = await querySubgraph(query);

    if (result.errors) {
        console.log('❌ Error:', result.errors[0].message);
        return;
    }

    const fields = result.data.__schema.queryType.fields || [];

    // Look for interesting query patterns
    const interesting = ['candle', 'ohlc', 'price', 'snapshot', 'hourly', 'daily', 'volume'];

    console.log('\n🔍 Query fields related to candles/aggregations:');
    let foundAny = false;
    for (const f of fields) {
        const name = f.name.toLowerCase();
        if (interesting.some(i => name.includes(i))) {
            foundAny = true;
            console.log(`   ✅ ${f.name}`);
            if (f.description) console.log(`      └─ ${f.description}`);
        }
    }

    if (!foundAny) {
        console.log('   ❌ No candle/OHLC/aggregation fields found');
    }

    console.log('\n📊 All available query fields:');
    for (const f of fields.sort((a, b) => a.name.localeCompare(b.name))) {
        console.log(`   • ${f.name}`);
    }
}

async function testPoolSnapshots() {
    console.log('\n📸 TESTING: Pool Snapshots (if available)');
    console.log('='.repeat(60));

    // Try to query poolSnapshots - common pattern in Balancer subgraphs
    const query = `
        query TestPoolSnapshots {
            poolSnapshots(first: 5, orderBy: timestamp, orderDirection: desc) {
                id
                timestamp
                pool {
                    id
                    name
                }
                swapVolume
                swapFees
                liquidity
            }
        }
    `;

    const result = await querySubgraph(query);

    if (result.errors) {
        console.log('❌ PoolSnapshots not available or different schema');
        console.log('   Error:', result.errors[0].message);
    } else if (result.data?.poolSnapshots) {
        console.log('✅ PoolSnapshots found!');
        console.log(JSON.stringify(result.data.poolSnapshots, null, 2));
    }
}

async function testTokenPrices() {
    console.log('\n💰 TESTING: Token Prices (if available)');
    console.log('='.repeat(60));

    // Try various price-related queries
    const queries = [
        { name: 'tokenPrices', query: `{ tokenPrices(first: 5) { id price timestamp asset } }` },
        { name: 'latestPrices', query: `{ latestPrices(first: 5) { id asset price pricingAsset } }` },
        { name: 'poolHistoricalLiquidities', query: `{ poolHistoricalLiquidities(first: 5, orderBy: block, orderDirection: desc) { id poolId poolLiquidity block } }` },
    ];

    for (const q of queries) {
        console.log(`\n   Testing ${q.name}...`);
        const result = await querySubgraph(q.query);
        if (result.errors) {
            console.log(`   ❌ ${q.name}: ${result.errors[0].message.slice(0, 80)}`);
        } else {
            console.log(`   ✅ ${q.name} available!`);
            const data = result.data[q.name];
            if (data && data.length > 0) {
                console.log(`      Sample: ${JSON.stringify(data[0])}`);
            }
        }
    }
}

async function testSwapSchema() {
    console.log('\n🔄 TESTING: Swap Entity Fields');
    console.log('='.repeat(60));

    // Get detailed swap fields
    await getTypeFields('Swap');

    // Get a sample swap
    const query = `
        query SampleSwap {
            swaps(first: 1, orderBy: timestamp, orderDirection: desc) {
                id
                timestamp
                tokenIn
                tokenOut
                tokenAmountIn
                tokenAmountOut
                poolId {
                    id
                    name
                    tokens {
                        symbol
                        address
                    }
                }
                tx
            }
        }
    `;

    console.log('\n📋 Sample Swap:');
    const result = await querySubgraph(query);
    if (result.errors) {
        console.log('❌ Error:', result.errors[0].message);
    } else if (result.data?.swaps?.[0]) {
        console.log(JSON.stringify(result.data.swaps[0], null, 2));
    }
}

async function testPoolEntity() {
    console.log('\n🏊 TESTING: Pool Entity Fields');
    console.log('='.repeat(60));

    // Check if pool has historical/snapshot data
    await getTypeFields('Pool');
}

// ============================
// MAIN
// ============================

async function main() {
    console.log('🧪 BALANCER V2 SUBGRAPH SCHEMA EXPLORER');
    console.log('📍 Gnosis Chain');
    console.log('='.repeat(60));
    console.log(`\n🔗 Subgraph: ${BALANCER_SUBGRAPH.slice(0, 80)}...`);

    // 1. Check all types
    const types = await getSchemaTypes();

    // 2. Check root queries
    await checkQueryRoot();

    // 3. Test specific entities
    await testSwapSchema();
    await testPoolEntity();
    await testPoolSnapshots();
    await testTokenPrices();

    // 4. Summary
    console.log('\n');
    console.log('='.repeat(60));
    console.log('📊 SUMMARY: Can we get candles instead of swaps?');
    console.log('='.repeat(60));

    const hasCandles = types.some(t => t.toLowerCase().includes('candle'));
    const hasSnapshots = types.some(t => t.toLowerCase().includes('snapshot'));
    const hasHourly = types.some(t => t.toLowerCase().includes('hourly'));
    const hasDaily = types.some(t => t.toLowerCase().includes('daily'));

    console.log(`\n   📊 Candle entities:    ${hasCandles ? '✅ YES' : '❌ NO'}`);
    console.log(`   📸 Snapshot entities:  ${hasSnapshots ? '✅ YES' : '❌ NO'}`);
    console.log(`   🕐 Hourly entities:    ${hasHourly ? '✅ YES' : '❌ NO'}`);
    console.log(`   📅 Daily entities:     ${hasDaily ? '✅ YES' : '❌ NO'}`);

    if (!hasCandles && !hasHourly) {
        console.log('\n   ⚠️  No pre-aggregated candle data available.');
        console.log('   💡 Solution: Build candles client-side from swap data.');
        console.log('   📝 Current approach (using swaps) is correct!');
    }

    console.log('\n✅ Schema exploration complete!');
}

main().catch(console.error);
