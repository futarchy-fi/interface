const hre = require("hardhat");
const { ethers } = hre;

async function main() {
    const PROP = "0x7e9Fc0C3d6C1619d4914556ad2dEe6051Ce68418";
    console.log(`Checking Proposal: ${PROP}`);

    // Check code
    const code = await ethers.provider.getCode(PROP);
    if (code === "0x") {
        console.error("❌ No code at address!");
        return;
    }
    console.log("✅ Contract exists.");

    // Try wrappedOutcome(0)
    const abi = ["function wrappedOutcome(uint256 index) external view returns (address token, bytes memory data)"];
    const contract = new ethers.Contract(PROP, abi, ethers.provider);

    try {
        const [token, data] = await contract.wrappedOutcome(0);
        console.log(`✅ wrappedOutcome(0): ${token}`);
    } catch (e) {
        console.error("❌ wrappedOutcome(0) failed:", e.shortMessage || e.message);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
