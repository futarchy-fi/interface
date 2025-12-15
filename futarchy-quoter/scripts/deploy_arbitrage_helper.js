const hre = require("hardhat");

async function main() {
    console.log("Deploying FutarchyArbitrageHelper...");

    // Correct Algebra Factory from live pool check
    const FACTORY_ADDRESS = "0xA0864cCA6E114013AB0e27cbd5B6f4c8947da766";

    const Helper = await hre.ethers.getContractFactory("FutarchyArbitrageHelper");
    const helper = await Helper.deploy(FACTORY_ADDRESS);

    await helper.waitForDeployment();

    const address = await helper.getAddress();
    console.log(`FutarchyArbitrageHelper deployed to: ${address}`);

    console.log("Waiting for block confirmations...");
    // await helper.deploymentTransaction().wait(5); 

    console.log(`Verify: npx hardhat verify --network gnosis ${address} ${FACTORY_ADDRESS}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
