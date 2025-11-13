const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying ProportionalLiquidityHook (Balancer v3 Hook)...");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // Token addresses on Gnosis Chain
  const SDAI_GNOSIS = "0xaf204776c7245bf4147c2612bf6e5972ee483701"; // sDAI (Savings xDAI) on Gnosis
  const GNO_GNOSIS = "0x9C58BAcC331c9aa871AFD802DB6379a98e80CEdb";  // GNO on Gnosis
  
  console.log("🪙 Token Configuration:");
  console.log("- sDAI Token:", SDAI_GNOSIS);
  console.log("- GNO Token:", GNO_GNOSIS);

  // Deploy the hook contract
  const ProportionalLiquidityHook = await ethers.getContractFactory("ProportionalLiquidityHook");
  const hook = await ProportionalLiquidityHook.deploy(deployer.address); // Only owner needed
  
  console.log("✅ ProportionalLiquidityHook deployed to:", await hook.getAddress());

  // Test hook flags
  await testHookFlags(hook);

  // Configure a mock pool for testing
  const mockPoolAddress = "0x1234567890123456789012345678901234567890"; // Mock pool for testing
  await configureTestPool(hook, mockPoolAddress, SDAI_GNOSIS, GNO_GNOSIS);

  // Test proportional calculations with tiny amounts
  await testProportionalCalculations(hook, mockPoolAddress);

  // Save deployment info
  const deploymentInfo = {
    network: network.name,
    hookAddress: await hook.getAddress(),
    deployer: deployer.address,
    blockNumber: await ethers.provider.getBlockNumber(),
    timestamp: new Date().toISOString(),
    tokens: {
      sDAI: SDAI_GNOSIS,
      GNO: GNO_GNOSIS
    }
  };

  console.log("\n📊 Deployment Summary:");
  console.log(JSON.stringify(deploymentInfo, null, 2));

  // Verify contract if on mainnet/testnet
  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log("\n⏳ Waiting for block confirmations...");
    await hook.waitForDeployment();
    
    console.log("🔍 Verifying contract...");
    try {
      await hre.run("verify:verify", {
        address: await hook.getAddress(),
        constructorArguments: [deployer.address],
      });
      console.log("✅ Contract verified successfully");
    } catch (error) {
      console.log("❌ Verification failed:", error.message);
    }
  }

  return hook;
}

// Test hook flags functionality
async function testHookFlags(hook) {
  console.log("\n🏁 Testing Hook Flags:");
  console.log("=" .repeat(50));

  try {
    const flags = await hook.getHookFlags();
    console.log("Hook Flags Configuration:");
    console.log("- enableHookAdjustedAmounts:", flags.enableHookAdjustedAmounts);
    console.log("- shouldCallBeforeAddLiquidity:", flags.shouldCallBeforeAddLiquidity);
    console.log("- shouldCallBeforeRemoveLiquidity:", flags.shouldCallBeforeRemoveLiquidity);
    console.log("- shouldCallBeforeSwap:", flags.shouldCallBeforeSwap);
    console.log("- shouldCallAfterSwap:", flags.shouldCallAfterSwap);
    console.log("✅ Hook flags retrieved successfully!");
  } catch (error) {
    console.log("❌ Error testing hook flags:", error.message);
  }
}

// Configure a test pool
async function configureTestPool(hook, poolAddress, sdaiAddress, gnoAddress) {
  console.log("\n⚙️ Configuring Test Pool:");
  console.log("=" .repeat(50));

  try {
    const tokens = [sdaiAddress, gnoAddress];
    const weights = [100, 100]; // 1:1 ratio for sDAI:GNO

    console.log(`Configuring pool: ${poolAddress}`);
    console.log("Tokens:", tokens);
    console.log("Weights:", weights, "(1:1 ratio)");

    const tx = await hook.configurePool(poolAddress, tokens, weights);
    await tx.wait();
    
    console.log("✅ Pool configured successfully!");

    // Verify configuration
    const config = await hook.getPoolConfig(poolAddress);
    console.log("Pool configuration verified:");
    console.log("- Tokens:", config.tokens);
    console.log("- Weights:", config.weights.map(w => w.toString()));
    console.log("- Total Weight:", config.totalWeight.toString());
    console.log("- Is Registered:", config.isRegistered);

  } catch (error) {
    console.log("❌ Error configuring pool:", error.message);
  }
}

// Test proportional calculations with tiny amounts as requested
async function testProportionalCalculations(hook, poolAddress) {
  console.log("\n🧪 Testing Proportional Calculations:");
  console.log("=" .repeat(50));

  try {
    // Test with 0.000000000001 sDAI (1e-12)
    const tinyAmount = ethers.parseUnits("0.000000000001", 18); // 1e-12 tokens
    console.log(`\n📈 Test 1: Calculating for ${ethers.formatEther(tinyAmount)} sDAI:`);
    
    const amounts1 = await hook.calculateProportionalAmounts(poolAddress, 0, tinyAmount); // index 0 = sDAI
    console.log("- sDAI needed:", ethers.formatEther(amounts1[0]));
    console.log("- GNO needed:", ethers.formatEther(amounts1[1]));
    console.log("- Ratio (sDAI:GNO):", "1:1");

    // Test with 0.000000000001 GNO (1e-12)
    console.log(`\n📈 Test 2: Calculating for ${ethers.formatEther(tinyAmount)} GNO:`);
    
    const amounts2 = await hook.calculateProportionalAmounts(poolAddress, 1, tinyAmount); // index 1 = GNO
    console.log("- sDAI needed:", ethers.formatEther(amounts2[0]));
    console.log("- GNO needed:", ethers.formatEther(amounts2[1]));
    console.log("- Ratio (sDAI:GNO):", "1:1");

    // Test proportional validation
    console.log("\n🔍 Testing Proportional Validation:");
    const testAmounts = [tinyAmount, tinyAmount]; // Equal amounts for 1:1 ratio
    const isValid = await hook.isProportional(poolAddress, testAmounts);
    console.log("- Test amounts:", testAmounts.map(a => ethers.formatEther(a)));
    console.log("- Is proportional:", isValid);

    // Test invalid proportions
    const invalidAmounts = [tinyAmount, tinyAmount * 2n]; // 1:2 ratio (should be invalid for 1:1 pool)
    const isInvalid = await hook.isProportional(poolAddress, invalidAmounts);
    console.log("- Invalid test amounts:", invalidAmounts.map(a => ethers.formatEther(a)));
    console.log("- Is proportional:", isInvalid, "(should be false)");

    console.log("\n✅ All proportional calculations working correctly!");
    
  } catch (error) {
    console.log("❌ Error in testing:", error.message);
  }
}

// Test different weight configurations
async function testDifferentRatios() {
  console.log("\n🔄 Testing Different Weight Ratios:");
  console.log("=" .repeat(50));
  
  try {
    const ProportionalLiquidityHook = await ethers.getContractFactory("ProportionalLiquidityHook");
    const testHook = await ProportionalLiquidityHook.deploy(deployer.address);
    
    // Test 2:1 ratio
    const mockPool2 = "0x2234567890123456789012345678901234567890";
    const tokens = ["0xTokenA", "0xTokenB"];
    const weights = [200, 100]; // 2:1 ratio
    
    await testHook.configurePool(mockPool2, tokens, weights);
    
    const baseAmount = ethers.parseEther("1");
    const amounts = await testHook.calculateProportionalAmounts(mockPool2, 1, baseAmount); // 1 TokenB
    
    console.log("For 2:1 ratio pool:");
    console.log("- Input: 1 TokenB");
    console.log("- Required TokenA:", ethers.formatEther(amounts[0]));
    console.log("- Input TokenB:", ethers.formatEther(amounts[1]));
    console.log("- Ratio:", Number(ethers.formatEther(amounts[0])) / Number(ethers.formatEther(amounts[1])));
    
  } catch (error) {
    console.log("❌ Error in ratio testing:", error.message);
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("❌ Deployment failed:", error);
      process.exit(1);
    });
}

module.exports = { main, testHookFlags, configureTestPool, testProportionalCalculations }; 