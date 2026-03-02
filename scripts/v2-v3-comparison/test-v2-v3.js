/**
 * Test V2 vs V3 GNO/sDAI Price Comparison
 * 
 * Compares two pricing routes:
 * 
 * V2 Route: GNO → WXDAI (Balancer V2 pool) → sDAI (via rate provider)
 * V3 Route: waGNO/sDAI (Balancer V3 pool) → GNO (via waGNO rate provider)
 * 
 * Run: node scripts/test-v2-v3.js
 */

const GNOSIS_RPC = 'https://rpc.gnosischain.com';

// ============ V2 Route Config ============
const V2_POOL = '0x8189c4c96826d016a99986394103dfa9ae41e7ee'; // GNO/WXDAI
const SDAI_RATE_PROVIDER = '0x89c80a4540a00b5270347e02e2e144c71da2eced';

// ============ V3 Route Config ============
const V3_POOL = '0xd1d7fa8871d84d0e77020fc28b7cd5718c446522'; // waGNO/sDAI (aGNO/sDAI)
const WAGNO_RATE_PROVIDER = '0xbbb4966335677ea24f7b86dc19a423412390e1fb';

// Balancer API
const BALANCER_API_V3 = 'https://api-v3.balancer.fi';

// GeckoTerminal
const GECKO_BASE = 'https://api.geckoterminal.com/api/v2';

// ============ Helper Functions ============

async function getRateFromProvider(providerAddress, label) {
    const callData = '0x679aefce'; // keccak256("getRate()")[:4]

    const response = await fetch(GNOSIS_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_call',
            params: [{ to: providerAddress, data: callData }, 'latest']
        })
    });

    const result = await response.json();
    if (result.error) {
        console.error(`❌ RPC Error for ${label}:`, result.error);
        return null;
    }

    const rateBigInt = BigInt(result.result);
    const rate = Number(rateBigInt) / 1e18;
    return rate;
}

async function getGeckoPoolPrice(poolAddress) {
    const url = `${GECKO_BASE}/networks/xdai/pools/${poolAddress}/ohlcv/hour?limit=1&currency=token`;

    const response = await fetch(url, {
        headers: { 'Accept': 'application/json' }
    });

    const data = await response.json();

    if (data.data?.attributes?.ohlcv_list?.length > 0) {
        const [timestamp, open, high, low, close, volume] = data.data.attributes.ohlcv_list[0];
        return { price: close, timestamp };
    }

    return null;
}

async function getBalancerV3PoolData(poolId) {
    const POOL_QUERY = `
        query GetPool($id: String!, $chain: GqlChain!) {
            pool: poolGetPool(id: $id, chain: $chain) {
                id
                address
                name
                type
                poolTokens {
                    address
                    symbol
                    balance
                    decimals
                }
                dynamicData {
                    totalLiquidity
                    swapFee
                }
            }
        }
    `;

    const response = await fetch(BALANCER_API_V3, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            query: POOL_QUERY,
            variables: { chain: 'GNOSIS', id: poolId }
        })
    });

    const result = await response.json();

    if (result.errors) {
        console.error('❌ Balancer API Error:', result.errors);
        return null;
    }

    return result.data?.pool;
}

// ============ Main Comparison ============

async function runComparison() {
    console.log('═'.repeat(60));
    console.log('  GNO/sDAI Price Comparison: V2 vs V3 Routes');
    console.log('═'.repeat(60));
    console.log();

    // ============ Step 1: Get Rate Providers ============
    console.log('📡 Fetching rate providers...\n');

    const [sDAIrate, waGNOrate] = await Promise.all([
        getRateFromProvider(SDAI_RATE_PROVIDER, 'sDAI'),
        getRateFromProvider(WAGNO_RATE_PROVIDER, 'waGNO')
    ]);

    console.log(`  sDAI Rate Provider (${SDAI_RATE_PROVIDER.slice(0, 10)}...):`);
    console.log(`    → 1 sDAI = ${sDAIrate?.toFixed(6)} DAI (yield-bearing share)\n`);

    console.log(`  waGNO Rate Provider (${WAGNO_RATE_PROVIDER.slice(0, 10)}...):`);
    console.log(`    → 1 waGNO = ${waGNOrate?.toFixed(6)} GNO\n`);

    // ============ Step 2: V2 Route - GeckoTerminal ============
    console.log('─'.repeat(60));
    console.log('🔵 V2 ROUTE: GNO/WXDAI Pool + sDAI Rate');
    console.log('─'.repeat(60));
    console.log(`  Pool: ${V2_POOL}`);
    console.log(`  Route: GNO → WXDAI → sDAI (via rate)\n`);

    const v2PoolData = await getGeckoPoolPrice(V2_POOL);

    if (v2PoolData) {
        const gnoWxdaiPrice = v2PoolData.price;
        const gnoSdaiPrice = gnoWxdaiPrice / sDAIrate;

        console.log(`  GNO/WXDAI (GeckoTerminal): ${gnoWxdaiPrice.toFixed(4)} WXDAI`);
        console.log(`  GNO/sDAI (÷ sDAI rate):    ${gnoSdaiPrice.toFixed(4)} sDAI`);
        console.log();

        var v2FinalPrice = gnoSdaiPrice;
    } else {
        console.log('  ❌ Failed to get V2 pool data from GeckoTerminal\n');
        var v2FinalPrice = null;
    }

    // ============ Step 3: V3 Route - Balancer API ============
    console.log('─'.repeat(60));
    console.log('🟣 V3 ROUTE: waGNO/sDAI Pool (Balancer V3)');
    console.log('─'.repeat(60));
    console.log(`  Pool: ${V3_POOL}`);
    console.log(`  Route: waGNO/sDAI → GNO (via waGNO rate)\n`);

    const v3Pool = await getBalancerV3PoolData(V3_POOL);

    if (v3Pool) {
        console.log(`  Pool Name: ${v3Pool.name}`);
        console.log(`  Pool Type: ${v3Pool.type}`);
        console.log(`  Liquidity: $${parseFloat(v3Pool.dynamicData.totalLiquidity).toLocaleString()}`);
        console.log(`  Swap Fee:  ${(parseFloat(v3Pool.dynamicData.swapFee) * 100).toFixed(2)}%\n`);

        // Find tokens
        const waGNOtoken = v3Pool.poolTokens.find(t =>
            t.symbol.toLowerCase().includes('gno') ||
            t.symbol.toLowerCase().includes('agno')
        );
        const sDAItoken = v3Pool.poolTokens.find(t =>
            t.symbol.toLowerCase().includes('sdai') ||
            t.symbol.toLowerCase().includes('dai')
        );

        if (waGNOtoken && sDAItoken) {
            const waGNObalance = parseFloat(waGNOtoken.balance);
            const sDAIbalance = parseFloat(sDAItoken.balance);

            console.log(`  Tokens:`);
            console.log(`    ${waGNOtoken.symbol}: ${waGNObalance.toFixed(4)}`);
            console.log(`    ${sDAItoken.symbol}: ${sDAIbalance.toFixed(4)}\n`);

            // Calculate spot price from balances
            const waGnoSdaiPrice = sDAIbalance / waGNObalance;

            console.log('  📊 Price Calculations:');
            console.log(`    waGNO/sDAI (pool balance): ${waGnoSdaiPrice.toFixed(4)} sDAI`);

            // WITHOUT waGNO rate
            console.log(`\n    ❌ WITHOUT waGNO rate conversion:`);
            console.log(`       → 1 waGNO = ${waGnoSdaiPrice.toFixed(4)} sDAI`);
            console.log(`       (This is what the pool shows directly)`);

            // WITH waGNO rate
            const gnoSdaiFromV3 = waGnoSdaiPrice * waGNOrate;
            console.log(`\n    ✅ WITH waGNO rate conversion:`);
            console.log(`       → waGNO/sDAI × waGNO rate`);
            console.log(`       → ${waGnoSdaiPrice.toFixed(4)} × ${waGNOrate.toFixed(6)}`);
            console.log(`       → 1 GNO = ${gnoSdaiFromV3.toFixed(4)} sDAI`);

            var v3RawPrice = waGnoSdaiPrice;
            var v3FinalPrice = gnoSdaiFromV3;
        } else {
            console.log('  ❌ Could not identify waGNO and sDAI tokens in pool');
            var v3RawPrice = null;
            var v3FinalPrice = null;
        }
    } else {
        console.log('  ❌ Failed to get V3 pool data\n');
        var v3RawPrice = null;
        var v3FinalPrice = null;
    }

    // ============ Step 4: Comparison ============
    console.log('\n' + '═'.repeat(60));
    console.log('  📈 FINAL COMPARISON');
    console.log('═'.repeat(60));

    if (v2FinalPrice && v3FinalPrice) {
        const diff = v3FinalPrice - v2FinalPrice;
        const diffPct = (diff / v2FinalPrice) * 100;

        console.log(`\n  V2 Route (GNO→WXDAI→sDAI):     ${v2FinalPrice.toFixed(4)} sDAI per GNO`);
        console.log(`  V3 Route (waGNO→sDAI + rate):  ${v3FinalPrice.toFixed(4)} sDAI per GNO`);
        console.log(`  V3 Raw (no rate applied):      ${v3RawPrice.toFixed(4)} sDAI per waGNO`);
        console.log();
        console.log(`  Difference (V3 - V2):          ${diff >= 0 ? '+' : ''}${diff.toFixed(4)} sDAI (${diffPct >= 0 ? '+' : ''}${diffPct.toFixed(2)}%)`);

        if (Math.abs(diffPct) < 0.5) {
            console.log('\n  ✅ Prices are well-aligned (< 0.5% difference)');
        } else if (Math.abs(diffPct) < 2) {
            console.log('\n  ⚠️ Minor price difference (0.5% - 2%)');
        } else {
            console.log('\n  ❌ Significant price difference (> 2%)');
        }
    } else {
        console.log('\n  ❌ Could not complete comparison - missing data');
    }

    console.log('\n' + '═'.repeat(60));

    // ============ Rate Provider Impact ============
    console.log('\n📌 RATE PROVIDER IMPACT:');
    console.log('─'.repeat(40));

    if (v3RawPrice && v3FinalPrice && waGNOrate) {
        const rateImpact = (waGNOrate - 1) * 100;
        console.log(`  waGNO rate: ${waGNOrate.toFixed(6)}`);
        console.log(`  Impact:     ${rateImpact >= 0 ? '+' : ''}${rateImpact.toFixed(4)}%`);
        console.log(`\n  Without rate: ${v3RawPrice.toFixed(4)} sDAI/waGNO`);
        console.log(`  With rate:    ${v3FinalPrice.toFixed(4)} sDAI/GNO`);
        console.log(`  Difference:   ${(v3FinalPrice - v3RawPrice).toFixed(4)} sDAI`);
    }

    if (sDAIrate) {
        const sDAIimpact = (sDAIrate - 1) * 100;
        console.log(`\n  sDAI rate:  ${sDAIrate.toFixed(6)}`);
        console.log(`  Impact:     ${sDAIimpact >= 0 ? '+' : ''}${sDAIimpact.toFixed(4)}% (yield accrual)`);
    }

    console.log('\n✅ Test complete!');
}

runComparison().catch(err => {
    console.error('\n❌ Test failed:', err);
    process.exit(1);
});
