/**
 * Spot Price Utils - Rate Provider
 * 
 * Get rate from ERC-4626 rate provider contracts
 * 
 * Usage:
 *   node rateProvider.js 0xbbb4966335677ea24f7b86dc19a423412390e1fb
 *   node rateProvider.js 0xbbb4... 100
 */

const { ethers } = require('ethers');
const { getProviderDirect } = require('./rpcProvider');

// Known rate providers
const KNOWN_PROVIDERS = {
    100: { // Gnosis Chain
        // waGnoGNO (Wrapped Aave Gnosis GNO)
        waGnoGNO: '0xbbb4966335677ea24f7b86dc19a423412390e1fb',
        // sDAI (Savings xDAI)
        sDAI: '0xaf204776c7245bf4147c2612bf6e5972ee483701',
    },
    1: { // Ethereum Mainnet
        // Add Ethereum rate providers here
    }
};

// ABI for rate providers (ERC-4626 style)
const RATE_ABI = [
    'function getRate() view returns (uint256)',           // Balancer style
    'function convertToAssets(uint256) view returns (uint256)', // ERC-4626
];

/**
 * Get rate from a rate provider contract
 */
async function getRate(providerAddress, chainId = 100) {
    const provider = getProviderDirect(chainId);
    const contract = new ethers.Contract(providerAddress, RATE_ABI, provider);

    try {
        // Try getRate() first (Balancer style)
        const rate = await contract.getRate();
        return parseFloat(ethers.utils.formatEther(rate));
    } catch (e1) {
        try {
            // Fallback to convertToAssets (ERC-4626)
            const assets = await contract.convertToAssets(ethers.utils.parseEther('1'));
            return parseFloat(ethers.utils.formatEther(assets));
        } catch (e2) {
            throw new Error(`Failed to get rate: ${e1.message}`);
        }
    }
}

/**
 * Get rate by token symbol (from known providers)
 */
async function getRateBySymbol(symbol, chainId = 100) {
    const providers = KNOWN_PROVIDERS[chainId];

    if (!providers || !providers[symbol]) {
        return { needed: false };
    }

    const providerAddress = providers[symbol];
    const rate = await getRate(providerAddress, chainId);

    return {
        needed: true,
        provider: providerAddress,
        rate,
        symbol,
    };
}

/**
 * Check if a token symbol has a known rate provider
 */
function hasRateProvider(symbol, chainId = 100) {
    const providers = KNOWN_PROVIDERS[chainId];
    return providers && !!providers[symbol];
}

// CLI entry point
if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log(`
Rate Provider CLI

Usage:
  node rateProvider.js <providerAddress> [chainId]
  node rateProvider.js --symbol <symbol> [chainId]

Examples:
  node rateProvider.js 0xbbb4966335677ea24f7b86dc19a423412390e1fb
  node rateProvider.js --symbol waGnoGNO 100

Known symbols (chain 100):
${Object.entries(KNOWN_PROVIDERS[100] || {}).map(([k, v]) => `  - ${k}: ${v}`).join('\n')}
        `);
        process.exit(0);
    }

    (async () => {
        try {
            if (args[0] === '--symbol') {
                const symbol = args[1];
                const chainId = parseInt(args[2] || '100', 10);

                const result = await getRateBySymbol(symbol, chainId);
                console.log(`\nRate for ${symbol}:`);
                console.log(JSON.stringify(result, null, 2));
            } else {
                const providerAddress = args[0];
                const chainId = parseInt(args[1] || '100', 10);

                console.log(`\nFetching rate from ${providerAddress} on chain ${chainId}...`);
                const rate = await getRate(providerAddress, chainId);

                console.log(`\n✅ Rate: ${rate.toFixed(8)}`);
                console.log(`   (1 wrapped = ${rate.toFixed(6)} underlying)`);
            }
        } catch (err) {
            console.error(`\n❌ Error: ${err.message}`);
            process.exit(1);
        }
    })();
}

module.exports = {
    getRate,
    getRateBySymbol,
    hasRateProvider,
    KNOWN_PROVIDERS,
};
