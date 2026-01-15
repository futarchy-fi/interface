const hre = require("hardhat");
const { ethers } = hre;

const ERC20_ABI = [
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)"
];

async function main() {
    const t0Address = "0xCA7445827f6B5408d7fDD57615526933b769c1f3";
    const t1Address = "0xd26F0d2bBaeb156571177Cc32b3a4A70Ce21cb3A";
    const [signer] = await ethers.getSigners();

    const t0 = new ethers.Contract(t0Address, ERC20_ABI, signer);
    const t1 = new ethers.Contract(t1Address, ERC20_ABI, signer);

    console.log(`\n🔍 Checking Token Symbols:`);
    try {
        console.log(`   Token0 (${t0Address}): ${await t0.symbol()}`);
    } catch (e) { console.log(`   Token0: Failed to get symbol`); }

    try {
        console.log(`   Token1 (${t1Address}): ${await t1.symbol()}`);
    } catch (e) { console.log(`   Token1: Failed to get symbol`); }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
