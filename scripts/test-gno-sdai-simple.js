/**
 * Simple GNO/sDAI via GeckoTerminal + Rate Provider
 * 
 * 1. Get GNO/WXDAI candles from GeckoTerminal (using Balancer V2 pool)
 * 2. Apply sDAI rate from rate provider contract
 * 
 * Rate Provider: 0x89c80a4540a00b5270347e02e2e144c71da2eced
 * (returns sDAI per DAI - the DSR rate)
 * 
 * Usage: node scripts/test-gno-sdai-simple.js
 */

const fs = require('fs');
const path = require('path');

const GECKO_API = 'https://api.geckoterminal.com/api/v2';
const RPC_URL = 'https://rpc.gnosischain.com';

// Balancer V2 GNO/WXDAI pool on Gnosis
const GNO_WXDAI_POOL = '0x8189c4c96826d016a99986394103dfa9ae41e7ee';
const NETWORK = 'xdai';

// sDAI Rate Provider (from screenshot)
const SDAI_RATE_PROVIDER = '0x89c80a4540a00b5270347e02e2e144c71da2eced';

// getRate() function signature
const GET_RATE_SELECTOR = '0x679aefce'; // keccak256("getRate()") first 4 bytes

async function fetchGeckoCandles(poolAddress, limit = 168) {
    const url = `${GECKO_API}/networks/${NETWORK}/pools/${poolAddress}/ohlcv/hour?aggregate=1&limit=${limit}&currency=token`;
    console.log('Fetching from GeckoTerminal:', url);

    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error('GeckoTerminal error: ' + res.status);

    const data = await res.json();
    const ohlcv = data.data?.attributes?.ohlcv_list || [];

    // [timestamp, open, high, low, close, volume]
    return ohlcv.map(c => ({
        time: c[0],
        close: parseFloat(c[4])
    })).reverse().sort((a, b) => a.time - b.time);
}

async function getRate(rateProviderAddress) {
    // Call getRate() via eth_call
    const payload = {
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [{
            to: rateProviderAddress,
            data: GET_RATE_SELECTOR
        }, 'latest']
    };

    const res = await fetch(RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const result = await res.json();
    if (result.error) throw new Error('RPC error: ' + result.error.message);

    // Result is uint256 with 18 decimals
    const rateBigInt = BigInt(result.result);
    const rate = Number(rateBigInt) / 1e18;

    return rate;
}

async function main() {
    console.log('Simple GNO/sDAI via GeckoTerminal + Rate Provider');
    console.log('==================================================');
    console.log('');

    // Step 1: Get sDAI rate from rate provider
    console.log('Step 1: Getting sDAI rate from rate provider...');
    console.log('  Contract: ' + SDAI_RATE_PROVIDER);

    const sdaiRate = await getRate(SDAI_RATE_PROVIDER);
    console.log('  sDAI Rate: ' + sdaiRate.toFixed(6));
    console.log('  (1 WXDAI = ' + (1 / sdaiRate).toFixed(6) + ' sDAI)');
    console.log('');

    // Step 2: Get GNO/WXDAI candles from GeckoTerminal
    console.log('Step 2: Getting GNO/WXDAI candles from GeckoTerminal...');
    console.log('  Pool: ' + GNO_WXDAI_POOL);

    const gnoDaiCandles = await fetchGeckoCandles(GNO_WXDAI_POOL);
    console.log('  Candles: ' + gnoDaiCandles.length);
    console.log('');

    // Step 3: Apply rate to convert WXDAI to sDAI
    // If GNO/WXDAI = 138 and sDAI rate = 1.22 (meaning 1 DAI = 1.22 sDAI shares)
    // Then GNO/sDAI = 138 / 1.22 = 113 sDAI per GNO
    // 
    // Wait - let me think about this:
    // sDAI is an ERC4626 vault. The rate is the value of 1 share.
    // If rate = 1.22, that means 1 sDAI share is worth 1.22 DAI
    // So to get X DAI worth in sDAI terms: X / rate
    //
    // GNO = 138 WXDAI
    // sDAI = 138 / 1.22 = 113 sDAI

    console.log('Step 3: Converting to GNO/sDAI...');
    const gnoSdaiCandles = gnoDaiCandles.map(c => ({
        time: c.time,
        gnoWxdai: c.close,
        value: c.close / sdaiRate // Divide by rate to get sDAI
    }));

    // Output
    const output = {
        _meta: {
            source: 'GeckoTerminal + Rate Provider',
            gnoWxdaiPool: GNO_WXDAI_POOL,
            rateProvider: SDAI_RATE_PROVIDER,
            sdaiRate,
            note: 'GNO/sDAI = GNO/WXDAI / sdaiRate',
            generatedAt: new Date().toISOString(),
            candleCount: gnoSdaiCandles.length,
            latestPrice: gnoSdaiCandles[gnoSdaiCandles.length - 1]?.value
        },
        candles: gnoSdaiCandles.map(c => ({ time: c.time, value: c.value })),
        candlesReadable: gnoSdaiCandles.map(c => ({
            time: c.time,
            datetime: new Date(c.time * 1000).toISOString(),
            gnoWxdai: c.gnoWxdai.toFixed(4),
            gnoSdai: c.value.toFixed(4) + ' sDAI'
        }))
    };

    const outputPath = path.join(__dirname, 'gno-sdai-simple.json');
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

    console.log('');
    console.log('LAST 5 CANDLES:');
    output.candlesReadable.slice(-5).forEach(c => {
        console.log('  ' + c.datetime + ' | GNO/WXDAI: ' + c.gnoWxdai + ' | GNO/sDAI: ' + c.gnoSdai);
    });
    console.log('');
    console.log('Latest GNO/sDAI: ' + output._meta.latestPrice?.toFixed(4));
    console.log('Output: ' + outputPath);
}

main().catch(console.error);
