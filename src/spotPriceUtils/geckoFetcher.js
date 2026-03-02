/**
 * Spot Price Utils - GeckoTerminal Fetcher
 * 
 * Fetch candles from GeckoTerminal API (no Express, pure JS)
 * 
 * Usage:
 *   node geckoFetcher.js waGnoGNO/sDAI
 *   node geckoFetcher.js --pool 0xd1d7fa8871d84d0e77020fc28b7cd5718c446522
 */

const fetch = require('node-fetch');

const GECKO_API = 'https://api.geckoterminal.com/api/v2';

/**
 * Search pools by token symbols
 */
async function searchPools(query, network = 'xdai') {
    const url = `${GECKO_API}/search/pools?query=${encodeURIComponent(query)}&network=${network}`;
    console.error(`[Search] ${url}`);

    const response = await fetch(url, { headers: { accept: 'application/json' } });
    const data = await response.json();

    return data.data || [];
}

/**
 * Find pool by token pair
 */
async function findPool(baseSymbol, quoteSymbol, network = 'xdai') {
    const query = `${baseSymbol} ${quoteSymbol}`;
    const pools = await searchPools(query, network);

    const matching = pools.filter(p => {
        const name = p.attributes?.name?.toLowerCase() || '';
        return name.includes(baseSymbol.toLowerCase()) && name.includes(quoteSymbol.toLowerCase());
    });

    if (matching.length === 0) return null;

    // Sort by liquidity
    matching.sort((a, b) => {
        const aLiq = parseFloat(a.attributes?.reserve_in_usd || 0);
        const bLiq = parseFloat(b.attributes?.reserve_in_usd || 0);
        return bLiq - aLiq;
    });

    return {
        address: matching[0].attributes?.address,
        name: matching[0].attributes?.name,
        tvl: matching[0].attributes?.reserve_in_usd,
    };
}

/**
 * Fetch pool info
 */
async function fetchPoolInfo(poolAddress, network = 'xdai') {
    const url = `${GECKO_API}/networks/${network}/pools/${poolAddress}?include=base_token,quote_token`;
    const response = await fetch(url, { headers: { accept: 'application/json' } });
    const data = await response.json();

    const tokens = (data.included || []).map(t => ({
        symbol: t.attributes.symbol,
        name: t.attributes.name,
    }));

    return {
        name: data.data.attributes.name,
        address: poolAddress,
        baseToken: tokens[0]?.symbol,
        quoteToken: tokens[1]?.symbol,
        tvl: data.data.attributes.reserve_in_usd,
    };
}

/**
 * Fetch OHLCV candles
 */
async function fetchCandles(poolAddress, options = {}) {
    const {
        network = 'xdai',
        timeframe = 'hour',
        limit = 100,
        aggregate = 1,
        currency = 'token',
    } = options;

    const params = new URLSearchParams({
        limit: Math.min(limit, 1000).toString(),
        aggregate: aggregate.toString(),
        currency,
    });

    const url = `${GECKO_API}/networks/${network}/pools/${poolAddress}/ohlcv/${timeframe}?${params}`;
    console.error(`[Candles] ${url}`);

    const response = await fetch(url, { headers: { accept: 'application/json' } });
    const data = await response.json();

    const ohlcvList = data.data?.attributes?.ohlcv_list || [];

    // Format for SubgraphChart
    return ohlcvList
        .map(c => ({
            time: Math.floor(c[0] / 1000),
            value: parseFloat(c[4]), // close price
        }))
        .filter(c => !isNaN(c.time) && !isNaN(c.value))
        .sort((a, b) => a.time - b.time);
}

// CLI entry point
if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log(`
GeckoTerminal Fetcher CLI

Usage:
  node geckoFetcher.js <baseToken>/<quoteToken> [--network <net>]
  node geckoFetcher.js --pool <poolAddress> [--network <net>]
  node geckoFetcher.js --search <query> [--network <net>]

Networks: eth, xdai (default), base, arbitrum, polygon, bsc

Examples:
  node geckoFetcher.js --search VLR --network eth
  node geckoFetcher.js --pool 0x123... --network eth
  node geckoFetcher.js GNO/WXDAI --network xdai
        `);
        process.exit(0);
    }

    (async () => {
        try {
            // Parse args
            let network = 'xdai';
            let action = null;
            let value = null;

            for (let i = 0; i < args.length; i++) {
                if (args[i] === '--network') network = args[++i];
                else if (args[i] === '--search') { action = 'search'; value = args[++i]; }
                else if (args[i] === '--pool') { action = 'pool'; value = args[++i]; }
                else if (!args[i].startsWith('--')) { action = 'tokens'; value = args[i]; }
            }

            if (action === 'search') {
                const pools = await searchPools(value, network);
                console.log(`\nFound ${pools.length} pools on ${network}:\n`);
                pools.slice(0, 10).forEach(p => {
                    console.log(`  ${p.attributes.name}`);
                    console.log(`    Address: ${p.attributes.address}`);
                    console.log(`    TVL: $${parseFloat(p.attributes.reserve_in_usd || 0).toFixed(2)}\n`);
                });
            }
            else if (action === 'pool') {
                const info = await fetchPoolInfo(value, network);
                console.log(`\nPool Info:`, info);

                const candles = await fetchCandles(value, { network, limit: 10 });
                console.log(`\nLatest ${candles.length} candles:`);
                candles.forEach(c => {
                    console.log(`  ${new Date(c.time * 1000).toISOString()} - ${c.value.toFixed(4)}`);
                });
            }
            else if (action === 'tokens') {
                const [base, quote] = value.split(/[\/\-]/);

                console.log(`\nSearching for ${base}/${quote} on ${network}...`);
                const pool = await findPool(base, quote, network);

                if (!pool) {
                    console.error(`\n❌ No pool found for ${base}/${quote}`);
                    console.log(`   Try: node geckoFetcher.js --search ${base} --network ${network}`);
                    process.exit(1);
                }

                console.log(`\n✅ Found pool: ${pool.name}`);
                console.log(`   Address: ${pool.address}`);
                console.log(`   TVL: $${parseFloat(pool.tvl || 0).toFixed(2)}`);

                const candles = await fetchCandles(pool.address, { network, limit: 10 });
                console.log(`\nLatest prices:`);
                candles.forEach(c => {
                    console.log(`  ${new Date(c.time * 1000).toISOString().split('T')[0]} - ${c.value.toFixed(4)}`);
                });
            }
        } catch (err) {
            console.error(`\n❌ Error: ${err.message}`);
            process.exit(1);
        }
    })();
}

module.exports = {
    searchPools,
    findPool,
    fetchPoolInfo,
    fetchCandles,
};
