const hre = require("hardhat");

async function main() {
    console.log("Deploying AlgebraPreciseHelper...");

    const Helper = await hre.ethers.getContractFactory("AlgebraPreciseHelper");
    const helper = await Helper.deploy();

    await helper.waitForDeployment();

    const address = await helper.getAddress();
    console.log(`AlgebraPreciseHelper deployed to: ${address}`);

    // Wait for propagation before verifying
    console.log("Waiting for block confirmations...");
    // await helper.deploymentTransaction().wait(5); 

    console.log(`Verify with: npx hardhat verify --network gnosis ${address}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
