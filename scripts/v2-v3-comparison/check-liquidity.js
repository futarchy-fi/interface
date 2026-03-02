/**
 * Check liquidity of V2 vs V3 pools
 * Run: node scripts/check-liquidity.js
 */

const BALANCER_API = 'https://api-v3.balancer.fi';
const GECKO_BASE = 'https://api.geckoterminal.com/api/v2';

const V2_POOL = '0x8189c4c96826d016a99986394103dfa9ae41e7ee'; // GNO/WXDAI
const V3_POOL = '0xd1d7fa8871d84d0e77020fc28b7cd5718c446522'; // waGNO/sDAI

async function checkLiquidity() {
    console.log('=== LIQUIDITY COMPARISON ===\n');

    // V2 Pool from GeckoTerminal
    console.log('V2 Pool (GNO/WXDAI):', V2_POOL);
    try {
        const v2Resp = await fetch(`${GECKO_BASE}/networks/xdai/pools/${V2_POOL}`);
        const v2Data = await v2Resp.json();
        const v2Pool = v2Data.data?.attributes;
        if (v2Pool) {
            console.log('  Name:', v2Pool.name);
            console.log('  Liquidity (USD):', '$' + parseFloat(v2Pool.reserve_in_usd || 0).toLocaleString());
            console.log('  24h Volume:', '$' + parseFloat(v2Pool.volume_usd?.h24 || 0).toLocaleString());
            var v2Liq = parseFloat(v2Pool.reserve_in_usd || 0);
        }
    } catch (e) {
        console.log('  Error fetching V2:', e.message);
    }

    // V3 Pool from Balancer API
    console.log('\nV3 Pool (waGNO/sDAI):', V3_POOL);
    try {
        const query = `
            query {
                pool: poolGetPool(id: "${V3_POOL}", chain: GNOSIS) {
                    name
                    dynamicData { totalLiquidity volume24h }
                    poolTokens { symbol balance }
                }
            }
        `;
        const v3Resp = await fetch(BALANCER_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });
        const v3Data = await v3Resp.json();
        const v3Pool = v3Data.data?.pool;
        if (v3Pool) {
            console.log('  Name:', v3Pool.name);
            console.log('  Liquidity (USD):', '$' + parseFloat(v3Pool.dynamicData.totalLiquidity).toLocaleString());
            console.log('  24h Volume:', '$' + parseFloat(v3Pool.dynamicData.volume24h || 0).toLocaleString());
            console.log('  Tokens:');
            v3Pool.poolTokens.forEach(t => console.log('    -', t.symbol + ':', parseFloat(t.balance).toFixed(2)));
            var v3Liq = parseFloat(v3Pool.dynamicData.totalLiquidity);
        }
    } catch (e) {
        console.log('  Error fetching V3:', e.message);
    }

    console.log('\n=== LIQUIDITY RATIO ===');
    if (v2Liq && v3Liq) {
        const ratio = v2Liq / v3Liq;
        console.log(`V2 Liquidity: $${v2Liq.toLocaleString()}`);
        console.log(`V3 Liquidity: $${v3Liq.toLocaleString()}`);
        console.log(`Ratio: V2 has ${ratio.toFixed(1)}x more liquidity than V3`);
    }
}

checkLiquidity().catch(console.error);
