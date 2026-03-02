import { createPublicClient, http, parseAbi } from 'viem';
import { gnosis } from 'viem/chains';

const ALGEBRA_FACTORY = '0xA0864cCA6E114013AB0e27cbd5B6f4c8947da766'; // Swapr Algebra factory
const factoryAbi = parseAbi(['function poolByPair(address,address) view returns (address)']);

// Algebra Pool ABI for getting price - using exact types from algebra-cli
const poolAbi = parseAbi([
    'function globalState() view returns (uint160, uint128, int24, uint16, bool, uint8, uint16)',
    'function token0() view returns (address)',
    'function token1() view returns (address)'
]);

// ERC20 ABI for decimals
const erc20Abi = parseAbi([
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)'
]);

const client = createPublicClient({
    chain: gnosis,
    transport: http('https://rpc.gnosischain.com')
});

// Convert sqrtPriceX96 to human readable price
function sqrtPriceX96ToPrice(sqrtPriceX96, decimals0, decimals1) {
    // sqrtPriceX96 = sqrt(price) * 2^96
    // price = (sqrtPriceX96 / 2^96)^2
    const price = (Number(sqrtPriceX96) / (2 ** 96)) ** 2;
    // Adjust for decimal differences
    return price * (10 ** (decimals0 - decimals1));
}

async function getPoolPrices(poolAddress, token0Addr, token1Addr) {
    try {
        // Get pool state
        const globalState = await client.readContract({
            address: poolAddress,
            abi: poolAbi,
            functionName: 'globalState'
        });
        
        // Get actual token0 and token1 from pool (may be different order than our input)
        const poolToken0 = await client.readContract({
            address: poolAddress,
            abi: poolAbi,
            functionName: 'token0'
        });
        
        const poolToken1 = await client.readContract({
            address: poolAddress,
            abi: poolAbi,
            functionName: 'token1'
        });
        
        // Get decimals for both tokens
        const [decimals0, decimals1, symbol0, symbol1] = await Promise.all([
            client.readContract({
                address: poolToken0,
                abi: erc20Abi,
                functionName: 'decimals'
            }),
            client.readContract({
                address: poolToken1,
                abi: erc20Abi,
                functionName: 'decimals'
            }),
            client.readContract({
                address: poolToken0,
                abi: erc20Abi,
                functionName: 'symbol'
            }).catch(() => poolToken0.slice(0, 6)),
            client.readContract({
                address: poolToken1,
                abi: erc20Abi,
                functionName: 'symbol'
            }).catch(() => poolToken1.slice(0, 6))
        ]);
        
        const sqrtPriceX96 = globalState[0];
        const liquidity = globalState[1];
        const tick = globalState[2];
        
        // Calculate price of token0 in terms of token1
        const price0to1 = sqrtPriceX96ToPrice(sqrtPriceX96, decimals0, decimals1);
        const price1to0 = 1 / price0to1;
        
        // Check if we need to flip the prices based on input order
        const needsFlip = poolToken0.toLowerCase() !== token0Addr.toLowerCase();
        
        if (needsFlip) {
            return {
                token0: symbol1,
                token1: symbol0,
                price0to1: price1to0,  // flipped
                price1to0: price0to1,  // flipped
                tick: -tick,
                sqrtPriceX96: sqrtPriceX96.toString()
            };
        } else {
            return {
                token0: symbol0,
                token1: symbol1,
                price0to1: price0to1,
                price1to0: price1to0,
                tick: Number(tick),
                sqrtPriceX96: sqrtPriceX96.toString()
            };
        }
    } catch (error) {
        console.log(`    Error getting price: ${error.message}`);
        return null;
    }
}

// These are the tokens shown in your CLI output for proposal 0xA94aB35282118f38b0b4FF89dDA7A5c04aD49371
const tokens = {
    companyToken: '0x37b60f4E9A31A64cCc0024dce7D0fD07eAA0F7B3',
    currencyToken: '0xaf204776c7245bF4147c2612BF6e5972Ee483701',
    yesCompany: '0xe5C1D5d61FF85C52A46371BDbF41BeAae03B4dcE',
    noCompany: '0xc621aa2A251cCC514638262df3c5Cb3092918443',
    yesCurrency: '0x15f61249D35114c8676A2e45093d2b9AE4106B5e',
    noCurrency: '0xEDdB07f0900f647dC30bbc370fBf05B244F577Fa'
};

console.log('Checking pools for tokens from proposal 0xA94aB35282118f38b0b4FF89dDA7A5c04aD49371');
console.log('Factory:', ALGEBRA_FACTORY);

const pairs = [
    { name: 'YES_COMPANY/YES_CURRENCY', t0: tokens.yesCompany, t1: tokens.yesCurrency },
    { name: 'NO_COMPANY/NO_CURRENCY', t0: tokens.noCompany, t1: tokens.noCurrency },
    { name: 'YES_COMPANY/BASE_CURRENCY', t0: tokens.yesCompany, t1: tokens.currencyToken },
    { name: 'NO_COMPANY/BASE_CURRENCY', t0: tokens.noCompany, t1: tokens.currencyToken },
    { name: 'YES_CURRENCY/BASE_CURRENCY', t0: tokens.yesCurrency, t1: tokens.currencyToken },
    { name: 'NO_CURRENCY/BASE_CURRENCY', t0: tokens.noCurrency, t1: tokens.currencyToken }
];

for (const pair of pairs) {
    console.log(`\nChecking ${pair.name}:`);
    console.log(`  Token0: ${pair.t0}`);
    console.log(`  Token1: ${pair.t1}`);
    
    try {
        // Try first order
        let pool = await client.readContract({
            address: ALGEBRA_FACTORY,
            abi: factoryAbi,
            functionName: 'poolByPair',
            args: [pair.t0, pair.t1]
        });
        
        console.log(`  Result (${pair.t0.slice(0,6)}.../${pair.t1.slice(0,6)}...): ${pool}`);
        
        if (!pool || pool === '0x0000000000000000000000000000000000000000') {
            // Try reverse order
            pool = await client.readContract({
                address: ALGEBRA_FACTORY,
                abi: factoryAbi,
                functionName: 'poolByPair',
                args: [pair.t1, pair.t0]
            });
            console.log(`  Result (${pair.t1.slice(0,6)}.../${pair.t0.slice(0,6)}...): ${pool}`);
        }
        
        if (pool && pool !== '0x0000000000000000000000000000000000000000') {
            console.log(`  ✅ POOL EXISTS: ${pool}`);
            
            // Get and display prices
            const priceInfo = await getPoolPrices(pool, pair.t0, pair.t1);
            if (priceInfo) {
                console.log(`\n  💱 PRICES:`);
                console.log(`    1 ${priceInfo.token0} = ${priceInfo.price0to1.toFixed(6)} ${priceInfo.token1}`);
                console.log(`    1 ${priceInfo.token1} = ${priceInfo.price1to0.toFixed(6)} ${priceInfo.token0}`);
                console.log(`    Tick: ${priceInfo.tick}`);
            }
        } else {
            console.log(`  ❌ No pool found`);
        }
    } catch (error) {
        console.log(`  Error: ${error.message}`);
    }
}

// Also check if there's a GNO/sDAI pool (common base pool)
console.log('\n\nAlso checking GNO/sDAI pool (should exist):');
const gno = '0x9C58BAcC331c9aa871AFD802DB6379a98e80CEdb';
const sdai = '0xaf204776c7245bF4147c2612BF6e5972Ee483701';

try {
    let pool = await client.readContract({
        address: ALGEBRA_FACTORY,
        abi: factoryAbi,
        functionName: 'poolByPair',
        args: [gno, sdai]
    });
    console.log(`GNO/sDAI pool: ${pool}`);
    
    if (!pool || pool === '0x0000000000000000000000000000000000000000') {
        pool = await client.readContract({
            address: ALGEBRA_FACTORY,
            abi: factoryAbi,
            functionName: 'poolByPair',
            args: [sdai, gno]
        });
        console.log(`sDAI/GNO pool: ${pool}`);
    }
} catch (error) {
    console.log(`Error: ${error.message}`);
}