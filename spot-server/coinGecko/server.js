/**
 * Super Easy GeckoTerminal Price Server
 * 
 * Multiple ways to get prices:
 *   GET /candles?tokens=GNO/sDAI         # By token symbols
 *   GET /candles?base=GNO&quote=sDAI      # By base/quote
 *   GET /candles?pool=0x123...            # By pool address
 * 
 * Auto-finds pools, applies rates, returns SubgraphChart-ready format.
 */

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3457;

// Network RPCs
const RPCS = {
    xdai: 'https://rpc.gnosischain.com',
    gnosis: 'https://rpc.gnosischain.com',
    ethereum: 'https://eth.llamarpc.com',
};

// Known rate providers (auto-applied when detected)
const KNOWN_RATE_PROVIDERS = {
    xdai: {
        // waGnoGNO (Wrapped Aave Gnosis GNO)
        'wagno': '0xbbb4966335677ea24f7b86dc19a423412390e1fb',
        'wagnogno': '0xbbb4966335677ea24f7b86dc19a423412390e1fb',
        // sDAI (Savings xDAI)
        'sdai': '0xaf204776c7245bf4147c2612bf6e5972ee483701',
    },
};

// ============================================================
// HELPERS
// ============================================================

/**
 * Search pools by token symbols on GeckoTerminal
 */
async function searchPools(network, query) {
    const url = `https://api.geckoterminal.com/api/v2/search/pools?query=${encodeURIComponent(query)}&network=${network}`;

    console.log(`[Search] ${url}`);

    const response = await fetch(url, { headers: { accept: 'application/json' } });

    if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
    }

    const data = await response.json();
    return data.data || [];
}

/**
 * Find best pool for token pair
 */
async function findPool(network, baseSymbol, quoteSymbol) {
    // Search with both tokens
    const query = `${baseSymbol} ${quoteSymbol}`;
    const pools = await searchPools(network, query);

    // Filter to find matching pair
    const matching = pools.filter(pool => {
        const name = pool.attributes?.name?.toLowerCase() || '';
        const base = baseSymbol.toLowerCase();
        const quote = quoteSymbol.toLowerCase();

        // Check if pool name contains both symbols
        return name.includes(base) && name.includes(quote);
    });

    if (matching.length === 0) {
        return null;
    }

    // Sort by liquidity (reserve_in_usd) and return best
    matching.sort((a, b) => {
        const aLiq = parseFloat(a.attributes?.reserve_in_usd || 0);
        const bLiq = parseFloat(b.attributes?.reserve_in_usd || 0);
        return bLiq - aLiq;
    });

    return matching[0];
}

/**
 * Fetch pool info
 */
async function fetchPoolInfo(network, poolAddress) {
    const url = `https://api.geckoterminal.com/api/v2/networks/${network}/pools/${poolAddress}?include=base_token,quote_token`;
    const response = await fetch(url, { headers: { accept: 'application/json' } });

    if (!response.ok) {
        throw new Error(`Pool not found: ${response.status}`);
    }

    const data = await response.json();
    const tokens = (data.included || []).map(t => ({
        symbol: t.attributes.symbol,
        name: t.attributes.name,
        address: t.attributes.address,
    }));

    return {
        name: data.data.attributes.name,
        address: poolAddress,
        baseToken: tokens[0] || null,
        quoteToken: tokens[1] || null,
        reserveUsd: data.data.attributes.reserve_in_usd,
    };
}

/**
 * Fetch OHLCV candles
 */
async function fetchCandles(network, poolAddress, options = {}) {
    const {
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

    const url = `https://api.geckoterminal.com/api/v2/networks/${network}/pools/${poolAddress}/ohlcv/${timeframe}?${params}`;
    console.log(`[Candles] ${url}`);

    const response = await fetch(url, { headers: { accept: 'application/json' } });

    if (!response.ok) {
        throw new Error(`Candles failed: ${response.status}`);
    }

    return response.json();
}

/**
 * Get rate from provider contract
 */
async function getRate(rpcUrl, providerAddress) {
    const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_call',
            params: [{ to: providerAddress, data: '0x679aefce' }, 'latest']
        }),
    });

    const result = await response.json();
    if (result.error) throw new Error(result.error.message);

    return Number(BigInt(result.result)) / 1e18;
}

/**
 * Check if token needs rate conversion and get rate
 */
async function detectAndApplyRate(network, tokenSymbol) {
    const providers = KNOWN_RATE_PROVIDERS[network] || {};
    const key = tokenSymbol.toLowerCase();

    if (providers[key]) {
        const rpcUrl = RPCS[network] || RPCS.xdai;
        const rate = await getRate(rpcUrl, providers[key]);
        return {
            needed: true,
            provider: providers[key],
            rate,
            token: tokenSymbol,
        };
    }

    return { needed: false };
}

/**
 * Adapt OHLCV to SubgraphChart format
 */
function formatCandles(ohlcvData, rate = 1) {
    if (!ohlcvData?.data?.attributes?.ohlcv_list) {
        return [];
    }

    return ohlcvData.data.attributes.ohlcv_list
        .map(c => ({
            time: Math.floor(c[0] / 1000),
            value: parseFloat(c[4]) * rate,
        }))
        .filter(c => !isNaN(c.time) && !isNaN(c.value))
        .sort((a, b) => a.time - b.time);
}

// ============================================================
// ROUTES
// ============================================================

app.use(cors());
app.use(express.json());

// Health / Usage
app.get('/', (req, res) => {
    res.json({
        name: '🚀 Super Easy GeckoTerminal Server',
        usage: {
            byTokens: 'GET /candles?tokens=GNO/sDAI',
            byBaseQuote: 'GET /candles?base=GNO&quote=sDAI',
            byPool: 'GET /candles?pool=0x123...',
        },
        options: {
            network: 'xdai (default), ethereum',
            timeframe: 'minute, hour (default), day',
            limit: '1-1000 (default: 100)',
            aggregate: '1,4,12 for hour; 1,5,15 for minute',
        },
        autoFeatures: [
            'Auto-finds best pool by liquidity',
            'Auto-detects wrapped tokens (waGnoGNO, sDAI)',
            'Auto-applies rate conversion when needed',
            'Returns SubgraphChart-ready format',
        ],
    });
});

/**
 * GET /search
 * Search pools by query
 */
app.get('/search', async (req, res) => {
    try {
        const { q, network = 'xdai' } = req.query;

        if (!q) {
            return res.status(400).json({ error: 'Missing: q (search query)' });
        }

        const pools = await searchPools(network, q);

        res.json({
            query: q,
            network,
            count: pools.length,
            pools: pools.map(p => ({
                address: p.attributes?.address,
                name: p.attributes?.name,
                reserveUsd: p.attributes?.reserve_in_usd,
            })),
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /candles
 * The main endpoint - super flexible
 */
app.get('/candles', async (req, res) => {
    try {
        const {
            // Multiple ways to specify pair
            tokens,          // "GNO/sDAI" or "GNO-sDAI"
            base,            // "GNO"
            quote,           // "sDAI"
            pool,            // "0x123..."

            // Options
            network = 'xdai',
            timeframe = 'hour',
            limit = '100',
            aggregate = '1',

            // Rate options
            rateProvider,    // Manual rate provider
            autoRate = 'true', // Auto-detect wrapped tokens
        } = req.query;

        let poolAddress = pool;
        let poolInfo = null;

        // === RESOLVE POOL ===

        // Option 1: By pool address
        if (pool) {
            poolInfo = await fetchPoolInfo(network, pool.toLowerCase());
        }
        // Option 2: By "tokens" param (GNO/sDAI)
        else if (tokens) {
            const [baseSymbol, quoteSymbol] = tokens.split(/[\/\-_]/);
            if (!baseSymbol || !quoteSymbol) {
                return res.status(400).json({
                    error: 'Invalid tokens format. Use: GNO/sDAI or GNO-sDAI'
                });
            }

            const found = await findPool(network, baseSymbol, quoteSymbol);
            if (!found) {
                return res.status(404).json({
                    error: `No pool found for ${baseSymbol}/${quoteSymbol}`,
                    suggestion: 'Try /search?q=' + baseSymbol,
                });
            }

            poolAddress = found.attributes?.address;
            poolInfo = await fetchPoolInfo(network, poolAddress);
        }
        // Option 3: By base & quote params
        else if (base && quote) {
            const found = await findPool(network, base, quote);
            if (!found) {
                return res.status(404).json({
                    error: `No pool found for ${base}/${quote}`,
                    suggestion: 'Try /search?q=' + base,
                });
            }

            poolAddress = found.attributes?.address;
            poolInfo = await fetchPoolInfo(network, poolAddress);
        }
        else {
            return res.status(400).json({
                error: 'Specify pair using: tokens=GNO/sDAI, base=GNO&quote=sDAI, or pool=0x123...',
            });
        }

        // === FETCH CANDLES ===

        const ohlcvData = await fetchCandles(network, poolAddress, {
            timeframe,
            limit: parseInt(limit, 10),
            aggregate: parseInt(aggregate, 10),
            currency: 'token',
        });

        // === APPLY RATE ===

        let rate = 1;
        let rateInfo = null;

        if (rateProvider) {
            // Manual rate provider
            const rpcUrl = RPCS[network] || RPCS.xdai;
            rate = await getRate(rpcUrl, rateProvider.toLowerCase());
            rateInfo = {
                provider: rateProvider,
                rate,
                source: 'manual',
            };
        }
        else if (autoRate === 'true') {
            // Auto-detect wrapped tokens
            const baseCheck = await detectAndApplyRate(network, poolInfo.baseToken?.symbol);
            if (baseCheck.needed) {
                rate = baseCheck.rate;
                rateInfo = {
                    provider: baseCheck.provider,
                    rate: baseCheck.rate,
                    token: baseCheck.token,
                    source: 'auto-detected',
                };
            }
        }

        // === FORMAT RESPONSE ===

        const candles = formatCandles(ohlcvData, rate);
        const latestPrice = candles.length > 0 ? candles[candles.length - 1].value : null;

        res.json({
            // SubgraphChart-ready format!
            candles,

            // Metadata
            pool: {
                address: poolAddress,
                name: poolInfo.name,
                baseToken: poolInfo.baseToken?.symbol,
                quoteToken: poolInfo.quoteToken?.symbol,
                tvl: poolInfo.reserveUsd,
            },
            price: latestPrice,
            rate: rateInfo,
            params: {
                network,
                timeframe,
                limit: parseInt(limit, 10),
                aggregate: parseInt(aggregate, 10),
            },
            count: candles.length,
        });

    } catch (err) {
        console.error('[/candles]', err.message);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /price
 * Just latest price
 */
app.get('/price', async (req, res) => {
    try {
        const { tokens, base, quote, pool, network = 'xdai', autoRate = 'true' } = req.query;

        // Reuse candles logic with limit=1
        const candleReq = { ...req, query: { ...req.query, limit: '10' } };

        // Build URL
        let url = `http://localhost:${PORT}/candles?network=${network}&limit=10&autoRate=${autoRate}`;
        if (pool) url += `&pool=${pool}`;
        else if (tokens) url += `&tokens=${tokens}`;
        else if (base && quote) url += `&base=${base}&quote=${quote}`;
        else return res.status(400).json({ error: 'Specify tokens, base/quote, or pool' });

        const response = await fetch(url);
        const data = await response.json();

        res.json({
            pair: data.pool?.name,
            price: data.price,
            rate: data.rate?.rate,
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// START
// ============================================================
app.listen(PORT, () => {
    console.log(`\n🚀 Super Easy Price Server at http://localhost:${PORT}`);
    console.log(`\n📊 Usage Examples:`);
    console.log(`   /candles?tokens=GNO/sDAI`);
    console.log(`   /candles?base=GNO&quote=sDAI`);
    console.log(`   /candles?pool=0xd1d7...`);
    console.log(`   /search?q=GNO`);
    console.log(`\n✨ Auto-detects wrapped tokens & applies rates!`);
});
