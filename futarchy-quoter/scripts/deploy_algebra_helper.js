const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();

    console.log("Deploying contracts with the account:", deployer.address);

    const AlgebraPriceDeltaHelper = await hre.ethers.getContractFactory("AlgebraPriceDeltaHelper");
    const helper = await AlgebraPriceDeltaHelper.deploy();

    await helper.waitForDeployment();

    const address = await helper.getAddress();
    console.log("AlgebraPriceDeltaHelper deployed to:", address);

    // Wait a few block confirmations to ensure the block explorer has indexed it before verifying
    console.log("Waiting for block confirmations...");
    // Using a simple timeout/delay strategy + checking transaction receipt confirmations if preferred, 
    // or just hard waiting 10-15s
    await new Promise(resolve => setTimeout(resolve, 15000));

    try {
        await hre.run("verify:verify", {
            address: address,
            constructorArguments: [],
        });
        console.log("Verification successful");
    } catch (error) {
        if (error.message.includes("Already Verified")) {
            console.log("Contract already verified");
        } else {
            console.error("Verification failed:", error);
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
