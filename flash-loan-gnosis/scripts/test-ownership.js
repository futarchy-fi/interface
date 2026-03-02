/**
 * 🔐 Ownership Test Script
 * 
 * Tests why staticCall reverts for non-owners vs owners.
 * This script explicitly uses both PRIVATE_KEY and PRIVATE_KEY_NOT_OWNER
 * to demonstrate the onlyOwner modifier behavior.
 * 
 * Usage: npx hardhat run scripts/test-ownership.js --network gnosis
 */

const { ethers } = require("hardhat");

const CONFIG = {
    contractAddress: "0xe0545480aAB67Bc855806b1f64486F5c77F08eCC",
    proposalAddress: "0x45e1064348fD8A407D6D1F59Fc64B05F633b28FC",
    tokens: {
        GNO: "0x9C58BAcC331c9aa871AFD802DB6379a98e80CEdb",
        SDAI: "0xaf204776c7245bF4147c2612BF6e5972Ee483701"
    }
};

async function main() {
    console.log("\n🔐 OWNERSHIP & STATICCALL TEST");
    console.log("=".repeat(60));

    const provider = ethers.provider;

    // ═══════════════════════════════════════════════════════════════
    // 1. CREATE WALLETS FROM BOTH PRIVATE KEYS
    // ═══════════════════════════════════════════════════════════════

    const ownerPrivateKey = process.env.PRIVATE_KEY;
    const notOwnerPrivateKey = process.env.PRIVATE_KEY_NOT_OWNER;

    if (!ownerPrivateKey) {
        console.error("❌ Missing PRIVATE_KEY in .env");
        return;
    }
    if (!notOwnerPrivateKey) {
        console.error("❌ Missing PRIVATE_KEY_NOT_OWNER in .env");
        return;
    }

    const ownerWallet = new ethers.Wallet(ownerPrivateKey, provider);
    const notOwnerWallet = new ethers.Wallet(notOwnerPrivateKey, provider);

    console.log("\n📋 WALLETS:");
    console.log(`   Owner Wallet:     ${ownerWallet.address}`);
    console.log(`   Not-Owner Wallet: ${notOwnerWallet.address}`);

    // ═══════════════════════════════════════════════════════════════
    // 2. CHECK CONTRACT OWNER
    // ═══════════════════════════════════════════════════════════════

    const contractABI = [
        "function owner() view returns (address)",
        "function executeArbitrage(address proposalAddress, address borrowToken, uint256 borrowAmount, uint8 direction, uint256 minProfit) external returns (tuple(bool success, uint256 profit, uint256 leftoverYesGno, uint256 leftoverNoGno, uint256 leftoverYesSdai, uint256 leftoverNoSdai, uint256 leftoverGno, uint256 leftoverSdai))",
        "function loadProposal(address proposalAddress) view returns (tuple(address proposal, address collateralToken1, address collateralToken2, address yesGno, address noGno, address yesSdai, address noSdai, address yesPool, address noPool, bool isValid))"
    ];

    const contract = new ethers.Contract(CONFIG.contractAddress, contractABI, provider);

    const contractOwner = await contract.owner();
    console.log(`\n🏛️  CONTRACT OWNER: ${contractOwner}`);
    console.log(`   Match with Owner Wallet:     ${contractOwner.toLowerCase() === ownerWallet.address.toLowerCase() ? "✅ YES" : "❌ NO"}`);
    console.log(`   Match with Not-Owner Wallet: ${contractOwner.toLowerCase() === notOwnerWallet.address.toLowerCase() ? "✅ YES" : "❌ NO"}`);

    // ═══════════════════════════════════════════════════════════════
    // 3. TEST VIEW FUNCTION (should work for both)
    // ═══════════════════════════════════════════════════════════════

    console.log("\n📖 TEST 1: loadProposal (view function, no ownership required)");
    try {
        const proposalInfo = await contract.loadProposal(CONFIG.proposalAddress);
        console.log(`   ✅ Success! isValid=${proposalInfo.isValid}`);
        console.log(`      YES_GNO: ${proposalInfo.yesGno.slice(0, 10)}...`);
        console.log(`      NO_GNO:  ${proposalInfo.noGno.slice(0, 10)}...`);
    } catch (e) {
        console.log(`   ❌ Failed: ${e.message.slice(0, 50)}`);
    }

    // ═══════════════════════════════════════════════════════════════
    // 4. TEST STATICCALL WITH NOT-OWNER WALLET
    // ═══════════════════════════════════════════════════════════════

    console.log("\n🔒 TEST 2: executeArbitrage.staticCall as NOT-OWNER");
    const contractAsNotOwner = new ethers.Contract(CONFIG.contractAddress, contractABI, notOwnerWallet);

    try {
        const result = await contractAsNotOwner.executeArbitrage.staticCall(
            CONFIG.proposalAddress,
            CONFIG.tokens.GNO,
            ethers.parseEther("0.01"),
            0, // SPOT_SPLIT
            0  // minProfit
        );
        console.log(`   ✅ Unexpected success! profit=${ethers.formatEther(result.profit)} GNO`);
    } catch (e) {
        console.log(`   ❌ REVERTED (expected!)`);

        // Extract detailed error
        if (e.message.includes("OwnableUnauthorizedAccount")) {
            console.log(`   📍 Reason: OwnableUnauthorizedAccount`);
            console.log(`   📍 The onlyOwner modifier blocked this call`);
        } else if (e.message.includes("revert")) {
            console.log(`   📍 Reason: ${e.message.slice(0, 100)}`);
        } else {
            console.log(`   📍 Error: ${e.message.slice(0, 100)}`);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // 5. TEST STATICCALL WITH OWNER WALLET
    // ═══════════════════════════════════════════════════════════════

    console.log("\n🔓 TEST 3: executeArbitrage.staticCall as OWNER");
    const contractAsOwner = new ethers.Contract(CONFIG.contractAddress, contractABI, ownerWallet);

    try {
        const result = await contractAsOwner.executeArbitrage.staticCall(
            CONFIG.proposalAddress,
            CONFIG.tokens.GNO,
            ethers.parseEther("0.01"),
            0, // SPOT_SPLIT
            0  // minProfit
        );
        console.log(`   ✅ SUCCESS!`);
        console.log(`      profit:          ${ethers.formatEther(result.profit)} GNO`);
        console.log(`      leftoverYesGno:  ${ethers.formatEther(result.leftoverYesGno)}`);
        console.log(`      leftoverNoGno:   ${ethers.formatEther(result.leftoverNoGno)}`);
        console.log(`      leftoverYesSdai: ${ethers.formatEther(result.leftoverYesSdai)}`);
        console.log(`      leftoverNoSdai:  ${ethers.formatEther(result.leftoverNoSdai)}`);
    } catch (e) {
        console.log(`   ❌ Failed: ${e.message.slice(0, 100)}`);

        // Check specific errors
        if (e.message.includes("Insufficient to repay")) {
            console.log(`   📍 The arb was not profitable at this amount`);
        } else if (e.message.includes("Profit below minimum")) {
            console.log(`   📍 Profit exists but below minProfit threshold`);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // 6. SUMMARY
    // ═══════════════════════════════════════════════════════════════

    console.log("\n" + "=".repeat(60));
    console.log("📋 SUMMARY:");
    console.log("=".repeat(60));
    console.log(`
The contract uses OpenZeppelin's Ownable pattern:
- ONLY the owner (${contractOwner.slice(0, 10)}...) can call executeArbitrage
- staticCall simulates from msg.sender's address
- If msg.sender != owner, the onlyOwner modifier reverts

To use a different wallet, you need to:
1. Transfer ownership: contract.transferOwnership(newAddress)
2. OR deploy a new contract from the new wallet
`);

    // Show wallet balances for context
    console.log("💰 WALLET BALANCES:");
    const ownerBalance = await provider.getBalance(ownerWallet.address);
    const notOwnerBalance = await provider.getBalance(notOwnerWallet.address);
    console.log(`   Owner:     ${ethers.formatEther(ownerBalance)} xDAI`);
    console.log(`   Not-Owner: ${ethers.formatEther(notOwnerBalance)} xDAI`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
