const { ethers } = require('ethers');

// Configuration
const GNOSIS_RPC = 'https://rpc.gnosischain.com';
const USER_ADDRESS = '0x645A3D9208523bbFEE980f7269ac72C61Dd3b552';
const SWAPR_NFPM_ADDRESS = '0x91fD594c46D8B01E62dBDeBed2401dde01817834'; // User confirmed this is correct

// Minimal ABI for NFPM (balanceOf, tokenOfOwnerByIndex, positions)
const NFPM_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
    "function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)"
];

// Expected Tokens from User's Debug Info
const EXPECTED_TOKENS = {
    YES_sDAI: "0xDB19aA09CEC2Fd0115bfE0403331CFe8dB556e2E".toLowerCase(),
    NO_sDAI: "0x103c32929f1C3245f54DfEc43F29f90B8027c093".toLowerCase(),
    YES_GNO: "0x2aFd4Fc8B3cc8505BCD1cC9B9E39A3e28877463F".toLowerCase(),
    NO_GNO: "0x209b48cb8D47B446fa83d0Cda8b2730dB6F84236".toLowerCase(),
    sDAI: "0xaf204776c7245bF4147c2612BF6e5972Ee483701".toLowerCase(),
    GNO: "0x9C58BAcC331c9aa871AFD802DB6379a98e80CEdb".toLowerCase()
};

async function main() {
    console.log(`Connecting to ${GNOSIS_RPC}...`);
    const provider = new ethers.providers.JsonRpcProvider(GNOSIS_RPC);
    const nfpmContract = new ethers.Contract(SWAPR_NFPM_ADDRESS, NFPM_ABI, provider);

    console.log(`Querying positions for user: ${USER_ADDRESS}`);
    console.log(`NFPM Address: ${SWAPR_NFPM_ADDRESS}`);

    try {
        const balance = await nfpmContract.balanceOf(USER_ADDRESS);
        console.log(`\nUser holds ${balance.toString()} positions.`);

        // ONLY LOG IF AT LEAST ONE TOKEN IS KNOWN
        const isKnown = (addr) => Object.values(EXPECTED_TOKENS).includes(addr);

        if (!isKnown(token0) && !isKnown(token1)) {
            if (i % 50 === 0) console.log(`Processed ${i} positions...`);
            continue;
        }

        console.log(`\n--- Position ${i + 1} (Token ID: ${tokenId}) ---`);

        const position = await nfpmContract.positions(tokenId);
        const token0 = position.token0.toLowerCase();
        const token1 = position.token1.toLowerCase();
        const liquidity = position.liquidity.toString();

        let token0Name = "Unknown";
        let token1Name = "Unknown";

        Object.entries(EXPECTED_TOKENS).forEach(([name, address]) => {
            if (address === token0) token0Name = name;
            if (address === token1) token1Name = name;
        });

        console.log(`Token Pair: ${token0Name} (${token0}) / ${token1Name} (${token1})`);
        console.log(`Liquidity: ${liquidity}`);

        // Check against expected tokens
        const isMatch = (targetA, targetB) => {
            return (token0 === targetA && token1 === targetB) || (token0 === targetB && token1 === targetA);
        };

        let matched = false;
        // Example Pool Checks
        if (isMatch(EXPECTED_TOKENS.YES_GNO, EXPECTED_TOKENS.YES_sDAI)) { console.log(">>> MATCHES: YES GNO / YES sDAI Pool"); matched = true; }
        if (isMatch(EXPECTED_TOKENS.NO_GNO, EXPECTED_TOKENS.NO_sDAI)) { console.log(">>> MATCHES: NO GNO / NO sDAI Pool"); matched = true; }

        if (isMatch(EXPECTED_TOKENS.YES_sDAI, EXPECTED_TOKENS.sDAI)) { console.log(">>> MATCHES: YES sDAI / sDAI Pool"); matched = true; }
        if (isMatch(EXPECTED_TOKENS.NO_sDAI, EXPECTED_TOKENS.sDAI)) { console.log(">>> MATCHES: NO sDAI / sDAI Pool"); matched = true; }

        if (isMatch(EXPECTED_TOKENS.YES_GNO, EXPECTED_TOKENS.sDAI)) { console.log(">>> MATCHES: YES GNO / sDAI Pool"); matched = true; }
        if (isMatch(EXPECTED_TOKENS.NO_GNO, EXPECTED_TOKENS.sDAI)) { console.log(">>> MATCHES: NO GNO / sDAI Pool"); matched = true; }

        console.log(`Link: https://v3.swapr.eth.limo/#/position/${tokenId}`);
    }

    } catch (error) {
    console.error("Error fetching positions:", error);
}
}

main();
