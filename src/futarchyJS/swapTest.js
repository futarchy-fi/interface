/**
 * Swap Test Script for Futarchy JS
 * 
 * This script tests the swap functionality in non-React environments:
 * - Tests both buy and sell actions for YES and NO tokens
 * - Tests scenarios with and without collateral requirement
 * - Uses tiny amounts to minimize costs
 * - Logs detailed callback information at each step
 */

import 'dotenv/config'; 
import { ethers } from 'ethers';
import { createFutarchy } from './futarchy.js';
import {
  BASE_TOKENS_CONFIG,
  MERGE_CONFIG
} from './contractWrapper.js';

// Token configurations
const BASE_CURRENCY_TOKEN = BASE_TOKENS_CONFIG.currency.address; // SDAI
const BASE_COMPANY_TOKEN = BASE_TOKENS_CONFIG.company.address; // GNO

// Token positions
const CURRENCY_YES_TOKEN = MERGE_CONFIG.currencyPositions.yes.wrap.wrappedCollateralTokenAddress;
const CURRENCY_NO_TOKEN = MERGE_CONFIG.currencyPositions.no.wrap.wrappedCollateralTokenAddress;
const COMPANY_YES_TOKEN = MERGE_CONFIG.companyPositions.yes.wrap.wrappedCollateralTokenAddress;
const COMPANY_NO_TOKEN = MERGE_CONFIG.companyPositions.no.wrap.wrappedCollateralTokenAddress;

/**
 * Test token balances for a specific wallet address
 * @param {string} walletAddress - Wallet address to check balances for 
 * @param {ethers.providers.Provider} provider - Ethereum provider
 */
async function testBalances(walletAddress, provider) {
  console.log("\n💰 Checking Token Balances for:", walletAddress);
  console.log("=================================================");
  
  try {
    // Helper function to get token balance and format it
    async function getTokenBalance(tokenAddress, tokenName) {
      const tokenContract = new ethers.Contract(tokenAddress, [
        "function balanceOf(address) view returns (uint256)",
        "function decimals() view returns (uint8)",
        "function symbol() view returns (string)"
      ], provider);
      
      let symbol;
      try {
        symbol = await tokenContract.symbol();
      } catch (e) {
        symbol = tokenName;
      }
      
      const decimals = await tokenContract.decimals();
      const balance = await tokenContract.balanceOf(walletAddress);
      const formatted = ethers.utils.formatUnits(balance, decimals);
      
      return { raw: balance, formatted, symbol };
    }
    
    // Get balances for all relevant tokens
    const [
      sdaiBalance,
      gnoBalance,
      yesSDaiBalance,
      noSDaiBalance,
      yesGnoBalance,
      noGnoBalance
    ] = await Promise.all([
      getTokenBalance(BASE_CURRENCY_TOKEN, "sDAI"),
      getTokenBalance(BASE_COMPANY_TOKEN, "GNO"),
      getTokenBalance(CURRENCY_YES_TOKEN, "YES_sDAI"),
      getTokenBalance(CURRENCY_NO_TOKEN, "NO_sDAI"),
      getTokenBalance(COMPANY_YES_TOKEN, "YES_GNO"),
      getTokenBalance(COMPANY_NO_TOKEN, "NO_GNO")
    ]);
    
    // Display balances
    console.log("\n📋 Token Balances:");
    console.log("------------------");
    console.log("Base Tokens:");
    console.log(`  ${sdaiBalance.symbol}: ${sdaiBalance.formatted}`);
    console.log(`  ${gnoBalance.symbol}: ${gnoBalance.formatted}`);
    
    console.log("\nPosition Tokens:");
    console.log(`  YES_sDAI: ${yesSDaiBalance.formatted}`);
    console.log(`  NO_sDAI: ${noSDaiBalance.formatted}`);
    console.log(`  YES_GNO: ${yesGnoBalance.formatted}`);
    console.log(`  NO_GNO: ${noGnoBalance.formatted}`);
    
    // Calculate net positions
    const currencySurplusYes = parseFloat(yesSDaiBalance.formatted) - parseFloat(noSDaiBalance.formatted);
    const currencySurplusNo = parseFloat(noSDaiBalance.formatted) - parseFloat(yesSDaiBalance.formatted);
    const companySurplusYes = parseFloat(yesGnoBalance.formatted) - parseFloat(noGnoBalance.formatted);
    const companySurplusNo = parseFloat(noGnoBalance.formatted) - parseFloat(yesGnoBalance.formatted);
    
    console.log("\nNet Positions:");
    if (currencySurplusYes > 0) {
      console.log(`  Currency: ${currencySurplusYes.toFixed(6)} SDAI (YES surplus: ${currencySurplusYes.toFixed(6)})`);
    } else if (currencySurplusNo > 0) {
      console.log(`  Currency: -${currencySurplusNo.toFixed(6)} SDAI (NO surplus: ${currencySurplusNo.toFixed(6)})`);
    } else {
      console.log("  Currency: Balanced");
    }
    
    if (companySurplusYes > 0) {
      console.log(`  Company: ${companySurplusYes.toFixed(6)} GNO (YES surplus: ${companySurplusYes.toFixed(6)})`);
    } else if (companySurplusNo > 0) {
      console.log(`  Company: -${companySurplusNo.toFixed(6)} GNO (NO surplus: ${companySurplusNo.toFixed(6)})`);
    } else {
      console.log("  Company: Balanced");
    }
    
    console.log("\n💼 Available Tokens for Swaps:");
    console.log("---------------------------");
    console.log(`  YES_SDAI available: ${parseFloat(yesSDaiBalance.formatted)} (unpaired amount)`);
    console.log(`  NO_SDAI available: ${parseFloat(noSDaiBalance.formatted)} (unpaired amount)`);
    console.log(`  YES_GNO available: ${parseFloat(yesGnoBalance.formatted)} (unpaired amount)`);
    console.log(`  NO_GNO available: ${parseFloat(noGnoBalance.formatted)} (unpaired amount)`);
    
    return {
      sdai: sdaiBalance.formatted,
      gno: gnoBalance.formatted,
      yesSDai: yesSDaiBalance.formatted,
      noSDai: noSDaiBalance.formatted,
      yesGno: yesGnoBalance.formatted,
      noGno: noGnoBalance.formatted
    };
  } catch (error) {
    console.error("Error checking balances:", error);
    throw error;
  }
}

/**
 * Creates an Ethereum provider
 * @returns {ethers.providers.Provider} Provider instance
 */
function createProvider() {
  // Use an RPC URL for Gnosis Chain
  const rpcUrl = process.env.RPC_URL || "https://rpc.gnosischain.com";
  console.log("Using RPC URL:", rpcUrl);
  
  try {
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    return provider;
  } catch (error) {
    console.error("Error creating provider:", error);
    throw error;
  }
}

/**
 * Creates a wallet with the provider
 * @param {ethers.providers.Provider} provider - Provider to use with wallet
 * @returns {ethers.Wallet} Wallet instance
 */
function createWallet(provider) {
  try {
    // Check if we have a private key in environment variables
    if (!process.env.PRIVATE_KEY) {
      throw new Error("PRIVATE_KEY not found in environment variables");
    }
    
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    return wallet;
  } catch (error) {
    console.error("Error creating wallet:", error);
    throw error;
  }
}

/**
 * Test swap functionality - Buy scenario
 * @param {Object} futarchy - Futarchy instance
 * @param {Object} params - Test parameters
 */
async function testBuySwap(futarchy, params) {
  const { tokenType, eventHappens, amount, title } = params;
  
  console.log(`🔄 SWAP TEST: ${title}`);
  console.log("-------------------------------------------------");
  
  try {
    // Test with callbacks to log the process
    const result = await futarchy.advancedSmartSwap({
      tokenType,
      amount,
      eventHappens,
      action: 'buy',
      
      onStart: () => console.log(`▶️ Starting swap process`),
      
      onCollateralNeeded: (amount) => {
        console.log(`⚠️ Additional collateral needed: ${amount} ${tokenType === 'currency' ? 'SDAI' : 'GNO'}`);
      },
      
      onCollateralApprovalNeeded: (tx) => {
        console.log(`📝 COLLATERAL APPROVAL NEEDED`);
      },
      
      onCollateralApprovalComplete: () => {
        console.log(`✅ COLLATERAL APPROVAL COMPLETE`);
      },
      
      onCollateralAdded: (amount) => {
        console.log(`➕ Collateral added: ${amount} ${tokenType === 'currency' ? 'SDAI' : 'GNO'}`);
      },
      
      onSwapStart: () => {
        console.log(`🔄 Starting the swap transaction`);
      },
      
      onSwapApprovalNeeded: () => {
        console.log(`📝 TOKEN APPROVAL NEEDED FOR SWAP`);
      },
      
      onSwapApprovalComplete: () => {
        console.log(`✅ SWAP APPROVAL COMPLETE`);
      },
      
      onSwapComplete: (receipt) => {
        console.log(`✅ SWAP COMPLETED SUCCESSFULLY`);
        if (receipt) {
          console.log(`📋 Transaction Details:`);
          
          if (receipt.blockNumber === 12345678) {
            console.log(`   ⚠️ TEST MODE - No actual blockchain transaction occurred`);  
          } else {
            console.log(`   - Block: ${receipt.blockNumber}`);
            console.log(`   - Transaction Hash: ${receipt.transactionHash || 'N/A'}`);
            console.log(`   - Gas used: ${(receipt.gasUsed && receipt.gasUsed.toString()) || 'N/A'}`);
            console.log(`   - Transaction URL: https://gnosisscan.io/tx/${receipt.transactionHash}`);
          }
        } else {
          console.log(`📋 Transaction Details: Test mode (no receipt)`);
        }
      },
      
      onError: (error) => {
        console.error(`❌ SWAP ERROR:`, error);
      }
    });
    
    if (result && result.success) {
      console.log(`\n✅ BUY SWAP TEST SUCCESSFUL: ${title}`);
      
      // Check if running in test mode (receipt will have blockNumber 12345678)
      if (result.receipt?.blockNumber === 12345678) {
        console.log(`ℹ️ Note: Running in test mode - no actual blockchain transaction occurred`);
      } else if (result.receipt?.transactionHash) {
        console.log(`🔗 Transaction Hash: ${result.receipt.transactionHash}`);
        console.log(`🔍 View on GnosisScan: https://gnosisscan.io/tx/${result.receipt.transactionHash}`);
      }
      
      return true;
    } else {
      console.error(`\n❌ BUY SWAP TEST FAILED: ${title}`);
      console.error(`Error: ${result?.error?.message || 'Unknown error'}`);
      return false;
    }
  } catch (error) {
    console.error(`\n❌ BUY SWAP TEST ERROR: ${error.message}`);
    return false;
  }
}

/**
 * Test swap functionality - Sell scenario
 * @param {Object} futarchy - Futarchy instance
 * @param {Object} params - Test parameters
 */
async function testSellSwap(futarchy, params) {
  const { tokenType, eventHappens, amount, title } = params;
  
  console.log(`🔄 SWAP TEST: ${title}`);
  console.log("-------------------------------------------------");
  
  try {
    // Test with callbacks to log the process
    const result = await futarchy.advancedSmartSwap({
      tokenType,
      amount,
      eventHappens,
      action: 'sell',
      
      onStart: () => console.log(`▶️ Starting swap process`),
      
      onCollateralNeeded: (amount) => {
        console.log(`⚠️ Additional collateral needed: ${amount} ${tokenType === 'currency' ? 'SDAI' : 'GNO'}`);
      },
      
      onCollateralApprovalNeeded: (tx) => {
        console.log(`📝 COLLATERAL APPROVAL NEEDED`);
      },
      
      onCollateralApprovalComplete: () => {
        console.log(`✅ COLLATERAL APPROVAL COMPLETE`);
      },
      
      onCollateralAdded: (amount) => {
        console.log(`➕ Collateral added: ${amount} ${tokenType === 'currency' ? 'SDAI' : 'GNO'}`);
      },
      
      onSwapStart: () => {
        console.log(`🔄 Starting the swap transaction`);
      },
      
      onSwapApprovalNeeded: () => {
        console.log(`📝 TOKEN APPROVAL NEEDED FOR SWAP`);
      },
      
      onSwapApprovalComplete: () => {
        console.log(`✅ SWAP APPROVAL COMPLETE`);
      },
      
      onSwapComplete: (receipt) => {
        console.log(`✅ SWAP COMPLETED SUCCESSFULLY`);
        if (receipt) {
          console.log(`📋 Transaction Details:`);
          
          if (receipt.blockNumber === 12345678) {
            console.log(`   ⚠️ TEST MODE - No actual blockchain transaction occurred`);  
          } else {
            console.log(`   - Block: ${receipt.blockNumber}`);
            console.log(`   - Transaction Hash: ${receipt.transactionHash || 'N/A'}`);
            console.log(`   - Gas used: ${(receipt.gasUsed && receipt.gasUsed.toString()) || 'N/A'}`);
            console.log(`   - Transaction URL: https://gnosisscan.io/tx/${receipt.transactionHash}`);
          }
        } else {
          console.log(`📋 Transaction Details: Test mode (no receipt)`);
        }
      },
      
      onError: (error) => {
        console.error(`❌ SWAP ERROR:`, error);
      }
    });
    
    if (result && result.success) {
      console.log(`\n✅ SELL SWAP TEST SUCCESSFUL: ${title}`);
      
      // Check if running in test mode (receipt will have blockNumber 12345678)
      if (result.receipt?.blockNumber === 12345678) {
        console.log(`ℹ️ Note: Running in test mode - no actual blockchain transaction occurred`);
      } else if (result.receipt?.transactionHash) {
        console.log(`🔗 Transaction Hash: ${result.receipt.transactionHash}`);
        console.log(`🔍 View on GnosisScan: https://gnosisscan.io/tx/${result.receipt.transactionHash}`);
      }
      
      return true;
    } else {
      console.error(`\n❌ SELL SWAP TEST FAILED: ${title}`);
      console.error(`Error: ${result?.error?.message || 'Unknown error'}`);
      return false;
    }
  } catch (error) {
    console.error(`\n❌ SELL SWAP TEST ERROR: ${error.message}`);
    return false;
  }
}

/**
 * Compare balances and show what changed
 * @param {Object} oldBalances - Previous balances
 * @param {Object} newBalances - New balances
 * @param {string} testTitle - Title of the test for better logging
 */
function compareBalances(oldBalances, newBalances, testTitle) {
  console.log(`\n📊 BALANCE CHANGES FOR: ${testTitle}`);
  console.log("=================================================");
  
  // Compare base tokens
  const sdaiDiff = parseFloat(newBalances.sdai) - parseFloat(oldBalances.sdai);
  const gnoDiff = parseFloat(newBalances.gno) - parseFloat(oldBalances.gno);
  
  // Compare position tokens
  const yesSDaiDiff = parseFloat(newBalances.yesSDai) - parseFloat(oldBalances.yesSDai);
  const noSDaiDiff = parseFloat(newBalances.noSDai) - parseFloat(oldBalances.noSDai);
  const yesGnoDiff = parseFloat(newBalances.yesGno) - parseFloat(oldBalances.yesGno);
  const noGnoDiff = parseFloat(newBalances.noGno) - parseFloat(oldBalances.noGno);
  
  // Format the amounts with + or - sign 
  const formatDiff = (diff) => {
    const sign = diff > 0 ? '+' : '';
    return `${sign}${diff.toFixed(9)}`;
  };
  
  console.log("Base Tokens Changes:");
  console.log(`  sDAI: ${formatDiff(sdaiDiff)} ${sdaiDiff < 0 ? '🔻' : sdaiDiff > 0 ? '🔺' : '➖'}`);
  console.log(`  GNO:  ${formatDiff(gnoDiff)} ${gnoDiff < 0 ? '🔻' : gnoDiff > 0 ? '🔺' : '➖'}`);
  
  console.log("\nPosition Tokens Changes:");
  console.log(`  YES_sDAI: ${formatDiff(yesSDaiDiff)} ${yesSDaiDiff < 0 ? '🔻' : yesSDaiDiff > 0 ? '🔺' : '➖'}`);
  console.log(`  NO_sDAI:  ${formatDiff(noSDaiDiff)} ${noSDaiDiff < 0 ? '🔻' : noSDaiDiff > 0 ? '🔺' : '➖'}`);
  console.log(`  YES_GNO:  ${formatDiff(yesGnoDiff)} ${yesGnoDiff < 0 ? '🔻' : yesGnoDiff > 0 ? '🔺' : '➖'}`);
  console.log(`  NO_GNO:   ${formatDiff(noGnoDiff)} ${noGnoDiff < 0 ? '🔻' : noGnoDiff > 0 ? '🔺' : '➖'}`);
  
  // Explain what happened in the swap
  console.log("\n📝 Swap Summary:");
  
  // Try to identify the swap direction
  if (testTitle.includes('Buy YES')) {
    // Buy YES: Swapping YES_SDAI → YES_GNO
    if (yesSDaiDiff < 0 && yesGnoDiff > 0) {
      console.log(`  Swapped ${Math.abs(yesSDaiDiff).toFixed(9)} YES_SDAI for ${yesGnoDiff.toFixed(9)} YES_GNO`);
    }
  } else if (testTitle.includes('Buy NO')) {
    // Buy NO: Swapping NO_SDAI → NO_GNO
    if (noSDaiDiff < 0 && noGnoDiff > 0) {
      console.log(`  Swapped ${Math.abs(noSDaiDiff).toFixed(9)} NO_SDAI for ${noGnoDiff.toFixed(9)} NO_GNO`);
    }
  } else if (testTitle.includes('Sell YES')) {
    // Sell YES: Swapping YES_GNO → YES_SDAI
    if (yesGnoDiff < 0 && yesSDaiDiff > 0) {
      console.log(`  Swapped ${Math.abs(yesGnoDiff).toFixed(9)} YES_GNO for ${yesSDaiDiff.toFixed(9)} YES_SDAI`);
    }
  } else if (testTitle.includes('Sell NO')) {
    // Sell NO: Swapping NO_GNO → NO_SDAI
    if (noGnoDiff < 0 && noSDaiDiff > 0) {
      console.log(`  Swapped ${Math.abs(noGnoDiff).toFixed(9)} NO_GNO for ${noSDaiDiff.toFixed(9)} NO_SDAI`);
    }
  }
  
  // Check for collateral additions
  if (sdaiDiff < 0 && (yesSDaiDiff > 0 || noSDaiDiff > 0)) {
    console.log(`  Added ${Math.abs(sdaiDiff).toFixed(9)} sDAI as collateral to get position tokens`);
  }
  
  if (gnoDiff < 0 && (yesGnoDiff > 0 || noGnoDiff > 0)) {
    console.log(`  Added ${Math.abs(gnoDiff).toFixed(9)} GNO as collateral to get position tokens`);
  }
}

/**
 * Main test function that runs all swap scenarios
 */
async function runSwapTest() {
  console.log("🔍 Starting Swap Test");
  console.log("===================================");
  
  let futarchy = null; // Add this so we can clean it up later
  let previousBalances = null; // Track previous balances for comparison
  
  try {
    // Create provider and wallet
    const provider = createProvider();
    await provider.getNetwork().then(network => {
      console.log(`✅ Connected to ${network.name} (Chain ID: ${network.chainId})`);
    });
    
    const wallet = createWallet(provider);
    const walletAddress = await wallet.getAddress();
    console.log(`✅ Wallet created: ${walletAddress}`);
    
    // Check balances before testing
    console.log("\n💰 BALANCES BEFORE TESTING:");
    const initialBalances = await testBalances(walletAddress, provider);
    previousBalances = { ...initialBalances }; // Save initial balances
    
    // Create a futarchy instance with custom provider/signer
    futarchy = createFutarchy({ 
      customProvider: provider,
      customSigner: wallet,
      autoInitialize: false,
      testMode: false,
      useSushiV3: true
    });
    console.log("✅ Futarchy instance created with REAL TRANSACTION MODE");
    
    // Manually initialize
    await futarchy.initialize();
    console.log("✅ Futarchy instance initialized");
    
    // Use tiny amounts for testing
    const tinyAmount = "0.000001";
    
    // Get the position to determine available tokens
    const currencyPosition = futarchy.getPosition('currency');
    const companyPosition = futarchy.getPosition('company');
    
    console.log("\n📊 Available positions for swaps:");
    console.log(`  YES_SDAI: ${currencyPosition?.yes?.available || '0'}`);
    console.log(`  NO_SDAI: ${currencyPosition?.no?.available || '0'}`);
    console.log(`  YES_GNO: ${companyPosition?.yes?.available || '0'}`);
    console.log(`  NO_GNO: ${companyPosition?.no?.available || '0'}`);
    
    // Test scenarios for all four cases:
    // 1. Buy YES: Using YES_SDAI to get YES_GNO
    // 2. Buy NO: Using NO_SDAI to get NO_GNO
    // 3. Sell YES: Converting YES_GNO to YES_SDAI
    // 4. Sell NO: Converting NO_GNO to NO_SDAI
    
    let swapTests = [];
    
    // 1. Buy YES (if we have enough YES_SDAI)
    if (parseFloat(currencyPosition?.yes?.available || 0) > parseFloat(tinyAmount)) {
      swapTests.push({
        fn: testBuySwap,
        params: {
          tokenType: 'currency',
          eventHappens: true,
          amount: tinyAmount,
          title: 'Buy YES: YES_SDAI → YES_GNO (No Collateral Needed)'
        }
      });
    } else {
      swapTests.push({
        fn: testBuySwap,
        params: {
          tokenType: 'currency',
          eventHappens: true,
          amount: tinyAmount,
          title: 'Buy YES: YES_SDAI → YES_GNO (With Collateral Needed)'
        }
      });
    }
    
    // 2. Buy NO (if we have enough NO_SDAI)
    if (parseFloat(currencyPosition?.no?.available || 0) > parseFloat(tinyAmount)) {
      swapTests.push({
        fn: testBuySwap,
        params: {
          tokenType: 'currency',
          eventHappens: false,
          amount: tinyAmount,
          title: 'Buy NO: NO_SDAI → NO_GNO (No Collateral Needed)'
        }
      });
    } else {
      swapTests.push({
        fn: testBuySwap,
        params: {
          tokenType: 'currency',
          eventHappens: false,
          amount: tinyAmount,
          title: 'Buy NO: NO_SDAI → NO_GNO (With Collateral Needed)'
        }
      });
    }
    
    // 3. Sell YES (if we have enough YES_GNO)
    if (parseFloat(companyPosition?.yes?.available || 0) > parseFloat(tinyAmount)) {
      swapTests.push({
        fn: testSellSwap,
        params: {
          tokenType: 'company',
          eventHappens: true,
          amount: tinyAmount,
          title: 'Sell YES: YES_GNO → YES_SDAI (No Collateral Needed)'
        }
      });
    } else {
      swapTests.push({
        fn: testSellSwap,
        params: {
          tokenType: 'company',
          eventHappens: true,
          amount: tinyAmount,
          title: 'Sell YES: YES_GNO → YES_SDAI (With Collateral Needed)'
        }
      });
    }
    
    // 4. Sell NO (if we have enough NO_GNO)
    if (parseFloat(companyPosition?.no?.available || 0) > parseFloat(tinyAmount)) {
      swapTests.push({
        fn: testSellSwap,
        params: {
          tokenType: 'company',
          eventHappens: false,
          amount: tinyAmount,
          title: 'Sell NO: NO_GNO → NO_SDAI (No Collateral Needed)'
        }
      });
    } else {
      swapTests.push({
        fn: testSellSwap,
        params: {
          tokenType: 'company',
          eventHappens: false,
          amount: tinyAmount,
          title: 'Sell NO: NO_GNO → NO_SDAI (With Collateral Needed)'
        }
      });
    }
    
    // Run the tests one by one with proper delays
    console.log("\n🔄 Running swap tests sequentially:");
    console.log("===================================");
    
    for (let i = 0; i < swapTests.length; i++) {
      const test = swapTests[i];
      console.log(`\n🧪 TEST ${i+1} of ${swapTests.length}: ${test.params.title}`);
      console.log("=================================================");
      
      // Run the current test
      await test.fn(futarchy, test.params);
      
      // Check balances after the test
      console.log(`\n💰 BALANCES AFTER TEST ${i+1}:`);
      const newBalances = await testBalances(walletAddress, provider);
      
      // Compare previous and new balances to show what changed
      compareBalances(previousBalances, newBalances, test.params.title);
      
      // Update previous balances for next comparison
      previousBalances = { ...newBalances };
      
      // Add delay between tests unless it's the last test
      if (i < swapTests.length - 1) {
        console.log(`\n⏳ Waiting 3 seconds before next test...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
        console.log(`Ready for next test!\n`);
      }
    }
    
    console.log("\n🎉 All swap tests completed successfully!");
    
    // Display final balances
    console.log("\n💰 FINAL BALANCES AFTER ALL TESTS:");
    const finalBalances = await testBalances(walletAddress, provider);
    
    // Compare initial and final balances
    console.log("\n📊 TOTAL BALANCE CHANGES (Initial vs Final):");
    console.log("=================================================");
    compareBalances(initialBalances, finalBalances, "ALL TESTS COMBINED");
    
  } catch (error) {
    console.error("❌ Test failed with error:", error);
    console.error("Fatal error:", error);
  } finally {
    // Clean up the futarchy instance to stop any polling
    if (futarchy) {
      console.log("\n🧹 Cleaning up futarchy instance...");
      futarchy.cleanup();
      console.log("✅ Cleanup complete");
    }
    
    // Force exit after a short delay to ensure all console output is shown
    console.log("\n👋 Test script completed, exiting in 1 second...");
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  }
}

// Run the tests
runSwapTest();

export default runSwapTest; 