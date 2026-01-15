const hre = require("hardhat");
const { ethers } = hre;

async function main() {
    console.log("🔍 Checking AlgebraFactory on Helper...");

    const HELPER_ADDRESS = "0xaEB1869B8e93D0E3361A0c604D627AF1640a472A";

    const abi = [
        "function algebraFactory() view returns (address)"
    ];
    const helper = new ethers.Contract(HELPER_ADDRESS, abi, ethers.provider);

    const factory = await helper.algebraFactory();
    console.log(`   Factory on Contract: ${factory}`);

    // Known Factory
    const KNOWN = "0xA0864cCA6E114013AB0e27cbd5B6f4c8947da766";
    console.log(`   Known Factory:       ${KNOWN}`);

    if (factory.toLowerCase() === KNOWN.toLowerCase()) {
        console.log("✅ MATCH!");
    } else {
        console.log("❌ MISMATCH!");
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
