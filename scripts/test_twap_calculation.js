#!/usr/bin/env node
/**
 * Test TWAP calculation with correct pool addresses
 * 
 * Proposal: 0x45e1064348fd8a407d6d1f59fc64b05f633b28fc
 * Correct YES POOL: 0xf8346e622557763a62cc981187d084695ee296c3
 * Correct NO POOL: 0x76f78ec457c1b14bcf972f16eae44c7aa21d578f
 */

const { ethers } = require('ethers');

const PROPOSAL_ADDRESS = '0x45e1064348fd8a407d6d1f59fc64b05f633b28fc';
const GNOSIS_RPC = 'https://rpc.gnosischain.com';

// Correct pool addresses for this proposal
const YES_POOL = '0xf8346e622557763a62cc981187d084695ee296c3';
const NO_POOL = '0x76f78ec457c1b14bcf972f16eae44c7aa21d578f';

// TWAP config from metadata
const TWAP_START_TIMESTAMP = 1769990400; // Feb 2, 2026 00:00:00 UTC
const TWAP_DURATION_HOURS = 120; // 5 days

// Algebra pool ABI for TWAP
const ALGEBRA_TWAP_ABI = [
    "function getTimepoints(uint32[] secondsAgos) external view returns (int56[] tickCumulatives, uint160[] secondsPerLiquidityCumulatives, uint112[] volatilityCumulatives, uint256[] volumePerAvgLiquiditys)",
    "function token0() external view returns (address)",
    "function token1() external view returns (address)",
    "function globalState() external view returns (uint160 price, int24 tick, uint16 fee, uint8 communityFeeToken0, uint8 communityFeeToken1, bool unlocked)"
];

const ERC20_ABI = [
    "function symbol() external view returns (string)",
    "function decimals() external view returns (uint8)"
];

async function getPoolInfo(provider, poolAddress, label) {
    console.log(`\n--- ${label} Pool Info: ${poolAddress} ---`);

    const pool = new ethers.Contract(poolAddress, ALGEBRA_TWAP_ABI, provider);

    try {
        const token0 = await pool.token0();
        const token1 = await pool.token1();
        const globalState = await pool.globalState();

        const token0Contract = new ethers.Contract(token0, ERC20_ABI, provider);
        const token1Contract = new ethers.Contract(token1, ERC20_ABI, provider);

        const symbol0 = await token0Contract.symbol();
        const symbol1 = await token1Contract.symbol();

        console.log(`   Token0: ${token0} (${symbol0})`);
        console.log(`   Token1: ${token1} (${symbol1})`);
        console.log(`   Current tick: ${globalState.tick}`);

        // Calculate current spot price from tick
        const currentPrice = Math.pow(1.0001, globalState.tick);
        console.log(`   Current price (raw): ${currentPrice.toFixed(8)}`);
        console.log(`   Current price (inverted): ${(1 / currentPrice).toFixed(4)}`);

        return { token0, token1, symbol0, symbol1, tick: globalState.tick };
    } catch (error) {
        console.error(`   Error getting pool info: ${error.message}`);
        return null;
    }
}

async function calculateTwap(provider, poolAddress, secondsAgo, tokenCompanySlot = 0) {
    const pool = new ethers.Contract(poolAddress, ALGEBRA_TWAP_ABI, provider);

    try {
        const { tickCumulatives } = await pool.getTimepoints([secondsAgo, 0]);

        const latest = BigInt(tickCumulatives[1].toString());
        const oldest = BigInt(tickCumulatives[0].toString());
        const tickDelta = latest - oldest;
        const averageTick = Number(tickDelta) / secondsAgo;

        // price = 1.0001^tick
        const rawPrice = Math.pow(1.0001, averageTick);

        // Normalize based on token slot
        const normalizedPrice = tokenCompanySlot === 1 ? 1 / rawPrice : rawPrice;

        return {
            averageTick,
            rawPrice,
            normalizedPrice,
            tickCumulatives: [tickCumulatives[0].toString(), tickCumulatives[1].toString()]
        };
    } catch (error) {
        console.error(`   TWAP calculation error: ${error.message}`);
        return null;
    }
}

async function main() {
    console.log('🔍 TWAP Calculation Test for Proposal:', PROPOSAL_ADDRESS);
    console.log('=========================================\n');

    const provider = new ethers.providers.JsonRpcProvider(GNOSIS_RPC);

    // Get pool info
    const yesInfo = await getPoolInfo(provider, YES_POOL, 'YES');
    const noInfo = await getPoolInfo(provider, NO_POOL, 'NO');

    // Calculate time since TWAP start
    const now = Math.floor(Date.now() / 1000);
    const twapDurationSeconds = TWAP_DURATION_HOURS * 60 * 60;
    const twapEndTimestamp = TWAP_START_TIMESTAMP + twapDurationSeconds;

    console.log('\n--- TWAP Timing ---');
    console.log(`   Start: ${new Date(TWAP_START_TIMESTAMP * 1000).toISOString()}`);
    console.log(`   End: ${new Date(twapEndTimestamp * 1000).toISOString()}`);
    console.log(`   Now: ${new Date(now * 1000).toISOString()}`);

    const isActive = now >= TWAP_START_TIMESTAMP && now < twapEndTimestamp;
    const hasEnded = now >= twapEndTimestamp;

    console.log(`   Status: ${isActive ? 'ACTIVE' : hasEnded ? 'ENDED' : 'NOT STARTED'}`);

    if (now < TWAP_START_TIMESTAMP) {
        console.log(`   Time until start: ${Math.floor((TWAP_START_TIMESTAMP - now) / 3600)}h`);
        return;
    }

    // Calculate seconds ago for TWAP window
    const timeSinceStart = Math.min(now - TWAP_START_TIMESTAMP, twapDurationSeconds);
    const secondsAgo = hasEnded ? twapDurationSeconds : timeSinceStart;

    console.log(`   TWAP window: ${secondsAgo} seconds (${(secondsAgo / 3600).toFixed(2)} hours)`);

    // Determine token slots based on pool token order
    // If company token (GNO) is token0, slot = 0; if token1, slot = 1
    // We need to check which token is the company token (typically wrapped YES_GNO or NO_GNO)

    console.log('\n--- TWAP Calculations ---');

    // Try both slot configurations to find the correct one
    for (const slot of [0, 1]) {
        console.log(`\n   Testing tokenCompanySlot = ${slot}:`);

        const yesTwap = await calculateTwap(provider, YES_POOL, secondsAgo, slot);
        const noTwap = await calculateTwap(provider, NO_POOL, secondsAgo, slot);

        if (yesTwap && noTwap) {
            console.log(`   YES TWAP: ${yesTwap.normalizedPrice.toFixed(6)}`);
            console.log(`   NO TWAP: ${noTwap.normalizedPrice.toFixed(6)}`);
            console.log(`   Spread: ${(yesTwap.normalizedPrice - noTwap.normalizedPrice).toFixed(6)}`);

            // Check if values look reasonable (should be close to spot prices ~96)
            if (yesTwap.normalizedPrice > 50 && yesTwap.normalizedPrice < 150) {
                console.log(`   ✅ This slot configuration looks correct!`);
            }
        }
    }

    // Also test with raw tick calculations
    console.log('\n--- Raw Tick Analysis ---');
    const pool = new ethers.Contract(YES_POOL, ALGEBRA_TWAP_ABI, provider);

    try {
        const globalState = await pool.globalState();
        const currentTick = globalState.tick;

        console.log(`   YES Pool current tick: ${currentTick}`);
        console.log(`   Price from tick (token0/token1): ${Math.pow(1.0001, currentTick).toFixed(6)}`);
        console.log(`   Price inverted (token1/token0): ${(1 / Math.pow(1.0001, currentTick)).toFixed(4)}`);
    } catch (e) {
        console.error(`   Error: ${e.message}`);
    }
}

main().catch(console.error);
