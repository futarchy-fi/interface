/**
 * Spot Price Utils - Get Candles (All-in-one)
 * 
 * Combines GeckoTerminal + Rate Provider
 * Same output as the Express API but as CLI tool
 * 
 * Usage:
 *   node getCandles.js waGnoGNO/sDAI
 *   node getCandles.js --pool 0xd1d7... --rate 0xbbb4...
 */

const { fetchCandles, findPool, fetchPoolInfo } = require('./geckoFetcher');
const { getRate, getRateBySymbol } = require('./rateProvider');

/**
 * Get candles with optional rate conversion
 * Returns SubgraphChart-ready format
 */
async function getCandles(options) {
    const {
        tokens,       // "waGnoGNO/sDAI"
        poolAddress,  // Or direct pool address
        rateProvider, // Optional rate provider address
        autoRate = true,
        network = 'xdai',
        chainId = 100,
        limit = 100,
        timeframe = 'hour',
    } = options;

    let pool;

    // Resolve pool
    if (poolAddress) {
        pool = await fetchPoolInfo(poolAddress, network);
    } else if (tokens) {
        const [base, quote] = tokens.split(/[\/\-]/);
        const found = await findPool(base, quote, network);

        if (!found) {
            throw new Error(`No pool found for ${tokens}`);
        }

        pool = await fetchPoolInfo(found.address, network);
    } else {
        throw new Error('Specify tokens or poolAddress');
    }

    // Fetch candles
    const rawCandles = await fetchCandles(pool.address, { network, limit, timeframe });

    // Apply rate if needed
    let rate = 1;
    let rateInfo = null;

    if (rateProvider) {
        rate = await getRate(rateProvider, chainId);
        rateInfo = {
            provider: rateProvider,
            rate,
            source: 'manual',
        };
    } else if (autoRate && pool.baseToken) {
        const detected = await getRateBySymbol(pool.baseToken, chainId);
        if (detected.needed) {
            rate = detected.rate;
            rateInfo = {
                provider: detected.provider,
                rate: detected.rate,
                token: detected.symbol,
                source: 'auto-detected',
            };
        }
    }

    // Apply rate to candles
    const candles = rawCandles.map(c => ({
        time: c.time,
        value: c.value * rate,
    }));

    const latestPrice = candles.length > 0 ? candles[candles.length - 1].value : null;

    return {
        candles,
        pool: {
            address: pool.address,
            name: pool.name,
            baseToken: pool.baseToken,
            quoteToken: pool.quoteToken,
        },
        price: latestPrice,
        rate: rateInfo,
        count: candles.length,
    };
}

// CLI entry point
if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log(`
Get Candles CLI (All-in-one)

Usage:
  node getCandles.js <baseToken>/<quoteToken> [--network <net>]
  node getCandles.js --pool <poolAddress> [--network <net>]

Networks: eth, xdai (default), base, arbitrum, polygon, bsc

Examples:
  node getCandles.js waGnoGNO/sDAI                    # Gnosis
  node getCandles.js sUSDS/USDS --network eth         # Ethereum
  node getCandles.js --pool 0xd1d7... --json --network xdai

Options:
  --pool <address>   Pool address
  --rate <address>   Rate provider contract
  --network <net>    Network (default: xdai)
  --limit <n>        Number of candles (default: 100)
  --timeframe <tf>   minute, hour, day (default: hour)
  --json             Output clean JSON only
        `);
        process.exit(0);
    }

    (async () => {
        try {
            // Parse args
            const options = { limit: 10, timeframe: 'hour', network: 'xdai' };
            let jsonOnly = false;

            for (let i = 0; i < args.length; i++) {
                if (args[i] === '--pool') options.poolAddress = args[++i];
                else if (args[i] === '--rate') options.rateProvider = args[++i];
                else if (args[i] === '--limit') options.limit = parseInt(args[++i], 10);
                else if (args[i] === '--timeframe') options.timeframe = args[++i];
                else if (args[i] === '--network') options.network = args[++i];
                else if (args[i] === '--json') jsonOnly = true;
                else if (!args[i].startsWith('--')) options.tokens = args[i];
            }

            if (!jsonOnly) console.error(`\n📊 Fetching candles...`);
            const result = await getCandles(options);

            if (jsonOnly) {
                // Clean JSON output only
                console.log(JSON.stringify(result, null, 2));
            } else {
                console.log(`\n✅ Pool: ${result.pool.name}`);
                console.log(`   Base: ${result.pool.baseToken}`);
                console.log(`   Quote: ${result.pool.quoteToken}`);

                if (result.rate) {
                    console.log(`   Rate: ${result.rate.rate.toFixed(6)} (${result.rate.source})`);
                }

                console.log(`\n📈 Latest Price: ${result.price?.toFixed(4)}`);
                console.log(`   Candles: ${result.count}\n`);

                // Show few candles
                console.log('Recent candles:');
                result.candles.slice(-5).forEach(c => {
                    const date = new Date(c.time * 1000).toISOString().replace('T', ' ').slice(0, 19);
                    console.log(`  ${date} - ${c.value.toFixed(4)}`);
                });

                console.log(`\n--FULL JSON--`);
                console.log(JSON.stringify(result, null, 2));
            }

        } catch (err) {
            console.error(`\n❌ Error: ${err.message}`);
            process.exit(1);
        }
    })();
}

module.exports = { getCandles };
