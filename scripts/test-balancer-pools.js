/**
 * Test Balancer V2 Pool Discovery
 * 
 * Shows how to find pool addresses on Balancer V2 via:
 * 1. Subgraph query (by token addresses)
 * 2. Vault events (PoolRegistered)
 * 
 * Usage: node scripts/test-balancer-pools.js
 */

const GRAPH_API_KEY = process.env.GRAPH_API_KEY || '1f3de4a47d9dfb2a32e1890f63858fff';
const SUBGRAPH_URL = `https://gateway-arbitrum.network.thegraph.com/api/${GRAPH_API_KEY}/subgraphs/id/EJezH1Cp31QkKPaBDerhVPRWsKVZLrDfzjrLqpmv6cGg`;

// Token addresses on Gnosis
const TOKENS = {
    GNO: '0x9c58bacc331c9aa871afd802db6379a98e80cedb',
    WXDAI: '0xe91d153e0b41518a2ce8dd3d7944fa863463a97d',
    USDC: '0xddafbb505ad214d7b80b1f830fccc89b60fb7a83',
    sDAI: '0xaf204776c7245bf4147c2612bf6e5972ee483701',
    waGNO: '0x7c16f0185a26db0ae7a9377f23bc18ea7ce5d644', // wrapped aave GNO
};

async function querySubgraph(query, variables = {}) {
    const response = await fetch(SUBGRAPH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables })
    });
    const result = await response.json();
    if (result.errors) throw new Error(result.errors[0].message);
    return result.data;
}

// ============================================================
// METHOD 1: Query pools by tokens
// ============================================================
async function findPoolsByTokens(tokenA, tokenB) {
    // Query pools that contain both tokens
    const query = `
        query FindPools($tokenA: String!, $tokenB: String!) {
            pools(
                where: {
                    tokensList_contains: [$tokenA, $tokenB]
                }
                orderBy: totalLiquidity
                orderDirection: desc
                first: 10
            ) {
                id
                address
                name
                poolType
                totalLiquidity
                swapFee
                tokens {
                    symbol
                    address
                    balance
                }
            }
        }
    `;

    return querySubgraph(query, {
        tokenA: tokenA.toLowerCase(),
        tokenB: tokenB.toLowerCase()
    });
}

// ============================================================
// METHOD 2: Get pool by ID
// ============================================================
async function getPoolById(poolId) {
    const query = `
        query GetPool($poolId: ID!) {
            pool(id: $poolId) {
                id
                address
                name
                poolType
                totalLiquidity
                swapFee
                tokens {
                    symbol
                    address
                    balance
                    weight
                }
            }
        }
    `;

    return querySubgraph(query, { poolId });
}

// ============================================================
// METHOD 3: Query all pools with recent swaps
// ============================================================
async function getActivePoolsForToken(tokenAddress) {
    const query = `
        query ActivePools($token: String!) {
            pools(
                where: {
                    tokensList_contains: [$token]
                    totalSwapVolume_gt: "0"
                }
                orderBy: totalSwapVolume
                orderDirection: desc
                first: 10
            ) {
                id
                address
                name
                poolType
                totalLiquidity
                totalSwapVolume
                tokens {
                    symbol
                    address
                }
            }
        }
    `;

    return querySubgraph(query, { token: tokenAddress.toLowerCase() });
}

// ============================================================
// MAIN
// ============================================================
async function main() {
    console.log('Balancer V2 Pool Discovery');
    console.log('==========================');
    console.log('');

    // Method 1: Find pools with GNO and WXDAI
    console.log('1. Finding pools with GNO + WXDAI:');
    console.log('');

    try {
        const gnoDaiPools = await findPoolsByTokens(TOKENS.GNO, TOKENS.WXDAI);
        if (gnoDaiPools.pools?.length > 0) {
            gnoDaiPools.pools.forEach(p => {
                console.log('  Pool: ' + p.name);
                console.log('    ID: ' + p.id);
                console.log('    Address: ' + p.address);
                console.log('    Type: ' + p.poolType);
                console.log('    Liquidity: $' + parseFloat(p.totalLiquidity || 0).toFixed(2));
                console.log('    Tokens: ' + p.tokens.map(t => t.symbol).join(', '));
                console.log('');
            });
        } else {
            console.log('  No pools found');
        }
    } catch (e) {
        console.log('  Error: ' + e.message);
    }

    // Method 2: Find pools with USDC and sDAI
    console.log('');
    console.log('2. Finding pools with USDC + sDAI:');
    console.log('');

    try {
        const usdSdaiPools = await findPoolsByTokens(TOKENS.USDC, TOKENS.sDAI);
        if (usdSdaiPools.pools?.length > 0) {
            usdSdaiPools.pools.forEach(p => {
                console.log('  Pool: ' + p.name);
                console.log('    ID: ' + p.id);
                console.log('    Type: ' + p.poolType);
                console.log('    Tokens: ' + p.tokens.map(t => t.symbol).join(', '));
                console.log('');
            });
        } else {
            console.log('  No pools found');
        }
    } catch (e) {
        console.log('  Error: ' + e.message);
    }

    // Method 3: Get specific pool by ID (the GNO/WXDAI pool we use)
    console.log('');
    console.log('3. Getting pool by ID (GNO/WXDAI from our preset):');
    console.log('');

    const gnoWxdaiPoolId = '0x8189c4c96826d016a99986394103dfa9ae41e7ee0002000000000000000000aa';
    try {
        const pool = await getPoolById(gnoWxdaiPoolId);
        if (pool.pool) {
            const p = pool.pool;
            console.log('  Pool: ' + p.name);
            console.log('    ID: ' + p.id);
            console.log('    Address: ' + p.address);
            console.log('    Type: ' + p.poolType);
            console.log('    Fee: ' + (parseFloat(p.swapFee) * 100).toFixed(2) + '%');
            console.log('    Tokens:');
            p.tokens.forEach(t => {
                console.log('      - ' + t.symbol + ': ' + parseFloat(t.balance).toFixed(4) + (t.weight ? ' (' + (parseFloat(t.weight) * 100).toFixed(0) + '%)' : ''));
            });
        }
    } catch (e) {
        console.log('  Error: ' + e.message);
    }

    // Method 4: Find active sDAI pools
    console.log('');
    console.log('4. Finding most active pools containing sDAI:');
    console.log('');

    try {
        const sdaiPools = await getActivePoolsForToken(TOKENS.sDAI);
        if (sdaiPools.pools?.length > 0) {
            sdaiPools.pools.slice(0, 5).forEach(p => {
                console.log('  Pool: ' + p.name);
                console.log('    ID: ' + p.id);
                console.log('    Volume: $' + parseFloat(p.totalSwapVolume || 0).toFixed(2));
                console.log('');
            });
        } else {
            console.log('  No pools found');
        }
    } catch (e) {
        console.log('  Error: ' + e.message);
    }

    console.log('');
    console.log('==========================');
    console.log('Note: Pool ID = address + pool type encoding');
    console.log('The Vault address on Gnosis: 0xBA12222222228d8Ba445958a75a0704d566BF2C8');
}

main().catch(console.error);
