/**
 * Test script to get live spot price from Balancer API v3
 * Pool: aGNO/sDAI (0xd1d7fa8871d84d0e77020fc28b7cd5718c446522) on Gnosis
 * + Rate Provider to convert waGNO → GNO
 * 
 * Run with: node scripts/test-balancer-spot-price.js
 */

const BALANCER_API_V3 = 'https://api-v3.balancer.fi';
const GNOSIS_RPC = 'https://rpc.gnosischain.com';
const POOL_ID = '0xd1d7fa8871d84d0e77020fc28b7cd5718c446522';
const RATE_PROVIDER = '0xbbb4966335677ea24f7b86dc19a423412390e1fb';

// Rate provider ABI (just getRate function)
const RATE_PROVIDER_ABI = [
    {
        "inputs": [],
        "name": "getRate",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    }
];

// Simple query for pool data
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

// Call RPC to get rate
async function getWaGnoRate() {
    console.log('📡 Calling rate provider on Gnosis RPC...');

    // eth_call to getRate()
    const callData = '0x679aefce'; // keccak256("getRate()")[:4]

    const response = await fetch(GNOSIS_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_call',
            params: [{
                to: RATE_PROVIDER,
                data: callData
            }, 'latest']
        })
    });

    const result = await response.json();

    if (result.error) {
        console.error('❌ RPC Error:', result.error);
        return null;
    }

    // Parse the uint256 result (18 decimals)
    const rateBigInt = BigInt(result.result);
    const rate = Number(rateBigInt) / 1e18;

    console.log(`✅ waGNO → GNO Rate: ${rate.toFixed(6)}`);
    console.log(`   (1 waGNO = ${rate.toFixed(6)} GNO)\n`);

    return rate;
}

async function getBalancerPoolData() {
    console.log('🔍 Fetching pool data from Balancer API v3...\n');
    console.log(`Pool ID: ${POOL_ID}`);
    console.log(`Endpoint: ${BALANCER_API_V3}\n`);

    try {
        // 1. Get waGNO rate first
        const waGnoRate = await getWaGnoRate();

        // 2. Get pool data from Balancer API
        const response = await fetch(BALANCER_API_V3, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: POOL_QUERY,
                variables: { chain: 'GNOSIS', id: POOL_ID }
            })
        });

        const result = await response.json();

        if (result.errors) {
            console.error('\n❌ GraphQL Errors:', JSON.stringify(result.errors, null, 2));
            return null;
        }

        const pool = result.data?.pool;

        if (!pool) {
            console.error('❌ Pool not found');
            return null;
        }

        console.log('✅ Pool found!\n');
        console.log('='.repeat(50));
        console.log(`Name: ${pool.name}`);
        console.log(`Type: ${pool.type}`);
        console.log(`Address: ${pool.address}`);
        console.log('='.repeat(50));

        console.log('\n📊 Tokens:');
        pool.poolTokens.forEach((token, i) => {
            console.log(`  [${i}] ${token.symbol}`);
            console.log(`      Address: ${token.address}`);
            console.log(`      Balance: ${token.balance}`);
        });

        console.log('\n💰 Dynamic Data:');
        console.log(`  Total Liquidity: $${parseFloat(pool.dynamicData.totalLiquidity).toLocaleString()}`);
        console.log(`  Swap Fee: ${(parseFloat(pool.dynamicData.swapFee) * 100).toFixed(2)}%`);

        // Calculate spot prices
        if (pool.poolTokens.length >= 2) {
            const token0 = pool.poolTokens[0]; // waGNO
            const token1 = pool.poolTokens[1]; // sDAI

            const balance0 = parseFloat(token0.balance);
            const balance1 = parseFloat(token1.balance);

            // Pool price (waGNO/sDAI)
            const priceWaGnoInSdai = balance1 / balance0;
            const priceSdaiInWaGno = balance0 / balance1;

            console.log('\n📈 Pool Spot Prices (waGNO/sDAI):');
            console.log(`  1 ${token0.symbol} = ${priceWaGnoInSdai.toFixed(4)} ${token1.symbol}`);
            console.log(`  1 ${token1.symbol} = ${priceSdaiInWaGno.toFixed(6)} ${token0.symbol}`);

            // Apply waGNO → GNO rate conversion
            if (waGnoRate) {
                const priceGnoInSdai = priceWaGnoInSdai * waGnoRate;
                const priceSdaiInGno = 1 / priceGnoInSdai;

                console.log('\n🎯 REAL Spot Prices (GNO/sDAI):');
                console.log(`  1 GNO = ${priceGnoInSdai.toFixed(4)} sDAI`);
                console.log(`  1 sDAI = ${priceSdaiInGno.toFixed(6)} GNO`);
            }
        }

        return pool;

    } catch (error) {
        console.error('❌ Fetch error:', error.message);
        return null;
    }
}

getBalancerPoolData()
    .then(() => console.log('\n✅ Test complete!'))
    .catch(err => console.error('\n❌ Test failed:', err));
