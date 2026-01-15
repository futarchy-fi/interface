/**
 * Futarchy Terminal Interface
 * 
 * This module provides a terminal interface for interacting with Futarchy markets.
 * 
 * WHAT IS FUTARCHY?
 * Futarchy is a governance mechanism that uses prediction markets to make decisions.
 * It combines:
 * - Conditional prediction markets for value outcomes
 * - Market prices to guide decision making
 * - "Vote on values, bet on beliefs" principle
 * 
 * In this futarchy implementation:
 * - Markets predict company token value under different scenarios
 * - Traders express beliefs about value impacts, not just event probability
 * - The policy with the higher expected company token value is implemented
 * - Prices reveal market wisdom about economic impacts of decisions
 * 
 * IMPORTANT: All environment variables must be set in .env file.
 *           This script will not run with missing variables.
 */

import 'dotenv/config';
import { createFutarchy, getEnvironmentConfig, environmentConfig } from './futarchy.js';
import { ethers } from 'ethers';
import readline from 'readline';
import chalk from 'chalk';

// First, validate environment variables
function validateEnvironment() {
  const config = getEnvironmentConfig();
  
  if (!config.environment.isValid) {
    console.error(chalk.red.bold('\n❌ ERROR: Missing required environment variables:'));
    config.environment.missingVars.forEach(v => {
      console.error(chalk.red(`   - ${v}`));
    });
    console.error(chalk.red('\nAll variables must be defined in your .env file.'));
    console.error(chalk.red('The terminal will not work without all required variables.'));
    console.error(chalk.red('Please copy .env.example to .env and fill in all values.'));
    console.error(chalk.red('See the README.md for setup instructions.\n'));
    process.exit(1);
  }
  
  console.log(chalk.green('✅ Environment validation successful - all required variables are present'));
}

// Run validation immediately
validateEnvironment();

// Continue with the rest of the terminal interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Utility to prompt for input and get response
const prompt = (question) => new Promise((resolve) => rl.question(question, resolve));

/**
 * Creates a provider that can connect to Gnosis Chain
 */
function createProvider() {
  const rpcUrl = process.env.RPC_URL || "https://rpc.ankr.com/gnosis";
  console.log(`Using RPC URL: ${rpcUrl}`);
  return new ethers.providers.JsonRpcProvider(rpcUrl);
}

/**
 * Creates a wallet from private key
 */
function createWallet(provider) {
  if (!process.env.PRIVATE_KEY) {
    throw new Error("PRIVATE_KEY is not defined in .env file");
  }
  return new ethers.Wallet(process.env.PRIVATE_KEY, provider);
}

/**
 * Format a balance for display with consistent decimal places
 * 
 * @param {string} amount - The amount to format
 * @param {string} symbol - Optional symbol to append
 * @returns {string} Formatted balance string
 */
function formatBalance(amount, symbol = '') {
  // Don't apply any formatting, just use the full raw amount with all decimals
  // Token decimals are already handled correctly in the balances
  return `${amount} ${symbol}`.trim();
}

/**
 * Display formatted balances
 * 
 * Balances in futarchy include:
 * - Base tokens: The original SDAI (currency) and GNO (company) tokens
 * - Position tokens: Conditional YES/NO tokens for both currency and company
 * 
 * Position tokens represent conditional rights to the base tokens depending
 * on the event outcome.
 */
async function displayBalances(futarchy) {
  console.log(chalk.bold.blue("\n===== CURRENT BALANCES ====="));
  console.log(chalk.italic("Your balances represent your market positions and available assets"));
  
  // Use the methods exposed by futarchy instance instead of accessing balanceManager directly
  // For base token balances, we'll have to use an alternative approach
  // Let's ask futarchy for positions first
  const currencyPosition = futarchy.getPosition('currency');
  const companyPosition = futarchy.getPosition('company');
  const totalAvailable = futarchy.getTotalAvailableBalance();
  
  // We need to fetch wallet balances - these should be accessible from the futarchy instance
  // or we can use a workaround if needed
  
  // Base tokens
  console.log(chalk.bold("\nBase Tokens:"));
  console.log(chalk.dim("These are the original tokens you use to participate in the futarchy market"));
  console.log(`• SDAI (Currency): ${formatBalance(totalAvailable.currency.wallet, 'SDAI')}`);
  console.log(`• GNO (Company): ${formatBalance(totalAvailable.company.wallet, 'GNO')}`);
  
  // Position tokens
  console.log(chalk.bold("\nPosition Tokens:"));
  console.log(`• YES_SDAI: ${formatBalance(currencyPosition.yes.total, 'YES_SDAI')}`);
  console.log(`• NO_SDAI: ${formatBalance(currencyPosition.no.total, 'NO_SDAI')}`);
  console.log(`• YES_GNO: ${formatBalance(companyPosition.yes.total, 'YES_GNO')}`);
  console.log(`• NO_GNO: ${formatBalance(companyPosition.no.total, 'NO_GNO')}`);
  
  // Available collateral for removal (paired minimums)
  console.log(chalk.bold("\nAvailable for Removal (paired amounts):"));
  console.log(`• Currency (SDAI): ${formatBalance(totalAvailable.currency.collateral, 'SDAI')}`);
  console.log(`• Company (GNO): ${formatBalance(totalAvailable.company.collateral, 'GNO')}`);
  
  // Available for swaps (unpaired, per side)
  console.log(chalk.bold("\nAvailable for Swaps (unpaired amounts):"));
  console.log(`• YES_SDAI: ${formatBalance(currencyPosition.yes.available, 'SDAI')}`);
  console.log(`• NO_SDAI: ${formatBalance(currencyPosition.no.available, 'SDAI')}`);
  console.log(`• YES_GNO: ${formatBalance(companyPosition.yes.available, 'GNO')}`);
  console.log(`• NO_GNO: ${formatBalance(companyPosition.no.available, 'GNO')}`);
}

/**
 * Handle adding collateral to get position tokens
 * 
 * Adding collateral is the process of splitting base tokens (SDAI or GNO)
 * into conditional YES/NO position tokens. This is the first step to 
 * participate in a futarchy market.
 * 
 * WHY ADD COLLATERAL?
 * - To create position tokens that can be traded
 * - To express your belief about future outcomes
 * - To participate in market-based governance decisions
 */
async function addCollateral(futarchy) {
  // 1. Select token type
  console.log(chalk.yellow("\n=== Add Collateral ==="));
  console.log(chalk.italic("In futarchy, adding collateral splits your tokens into YES/NO conditional positions"));
  console.log("Select token type:");
  console.log("1. Currency (SDAI)");
  console.log("2. Company (GNO)");
  
  const tokenType = await prompt("Enter choice (1-2): ");
  
  if (tokenType !== "1" && tokenType !== "2") {
    console.log(chalk.red("Invalid token type. Operation cancelled."));
    return;
  }
  
  const selectedType = tokenType === "1" ? "currency" : "company";
  const symbol = selectedType === "currency" ? "SDAI" : "GNO";
  
  // Get wallet balance from the totalAvailable
  const totalAvailable = futarchy.getTotalAvailableBalance();
  const walletBalance = selectedType === "currency" 
    ? totalAvailable.currency.wallet
    : totalAvailable.company.wallet;
  
  console.log(chalk.yellow(`\nYou have ${formatBalance(walletBalance, symbol)} available in your wallet`));
  console.log(chalk.dim(`Adding collateral will create equal amounts of YES_${symbol} and NO_${symbol} position tokens`));
  console.log(chalk.dim(`These position tokens represent conditional rights to ${symbol} depending on the outcome`));
  
  // Get amount
  const amount = await prompt(`Enter amount to add (max ${formatBalance(walletBalance)}): `);
  
  // Special case: Check if user is trying to use exact maximum
  if (amount === walletBalance || amount === formatBalance(walletBalance).trim()) {
    // Use the exact walletBalance value directly to avoid any precision issues
    console.log(chalk.yellow(`\nAdding maximum wallet balance as collateral...`));
    const preciseAmount = walletBalance;
    
    // Continue with max amount
    try {
      const result = await futarchy.addCollateral(selectedType, preciseAmount, {
        onStart: () => console.log(chalk.blue("Starting collateral addition...")),
        onApprove: (tx) => console.log(chalk.yellow(`Approval sent: ${tx.hash}`)),
        onSplit: (tx) => console.log(chalk.yellow(`Split sent: ${tx.hash}`)),
        onComplete: (receipt) => console.log(chalk.green(`Collateral added successfully! Block: ${receipt.blockNumber}`)),
        onError: (error) => console.log(chalk.red(`Error: ${error.message}`))
      });
      
      if (result.success) {
        console.log(chalk.green("\n✅ Collateral added successfully!"));
      } else {
        console.log(chalk.red("\n❌ Failed to add collateral."));
      }
    } catch (error) {
      console.log(chalk.red(`\nAn error occurred: ${error.message}`));
    }
    
    // Refresh balances after addition
    console.log(chalk.yellow("Refreshing balances..."));
    await refreshBalances(futarchy);
    
    return;
  }
  
  // Get token decimals from environment config
  const baseToken = environmentConfig.baseTokens[selectedType];
  const tokenDecimals = baseToken.decimals;
  
  // Use ethers BigNumber for exact decimal comparison with correct decimals
  const amountBN = ethers.utils.parseUnits(amount, tokenDecimals);
  const maxBN = ethers.utils.parseUnits(walletBalance, tokenDecimals);
  
  // Compare with BigNumber to avoid floating-point precision issues
  // Add a small buffer (1 wei) for comparison to handle potential rounding
  if (amountBN.isZero() || amountBN.gt(maxBN.add(1))) {
    console.log(chalk.red("Invalid amount. Operation cancelled."));
    
    // Debug info
    console.log(chalk.gray(`Debug info:`));
    console.log(chalk.gray(`- Amount entered: ${amount}`));
    console.log(chalk.gray(`- Amount as BN: ${amountBN.toString()}`));
    console.log(chalk.gray(`- Max available: ${walletBalance}`));
    console.log(chalk.gray(`- Max as BN: ${maxBN.toString()}`));
    console.log(chalk.gray(`- Difference: ${amountBN.sub(maxBN).toString()}`));
    
    return;
  }
  
  // Add collateral
  try {
    console.log(chalk.yellow(`\nAdding ${amount} ${symbol} collateral...`));
    console.log(chalk.dim(`This will split your ${symbol} into YES_${symbol} and NO_${symbol} conditional tokens`));
    
    // Use the raw amount string for full precision
    const preciseAmount = amount;
    
    const result = await futarchy.addCollateral(selectedType, preciseAmount, {
      onStart: () => console.log(chalk.blue("Starting collateral addition...")),
      onApprove: (tx) => console.log(chalk.yellow(`Approval sent: ${tx.hash}`)),
      onSplit: (tx) => console.log(chalk.yellow(`Split sent: ${tx.hash}`)),
      onComplete: (receipt) => console.log(chalk.green(`Collateral added successfully! Block: ${receipt.blockNumber}`)),
      onError: (error) => console.log(chalk.red(`Error: ${error.message}`))
    });
    
    if (result.success) {
      console.log(chalk.green("\n✅ Collateral added successfully!"));
    } else {
      console.log(chalk.red("\n❌ Failed to add collateral."));
    }
  } catch (error) {
    console.log(chalk.red(`\nAn error occurred: ${error.message}`));
  }
}

/**
 * Handle removing collateral (converting position tokens back to base tokens)
 * 
 * Removing collateral is the process of merging YES/NO position tokens
 * back into the original base token (SDAI or GNO).
 * 
 * WHY REMOVE COLLATERAL?
 * - To exit your position in the futarchy market
 * - To realize the value of your paired position tokens
 * - To recover your original base tokens for other uses
 */
async function removeCollateral(futarchy) {
  // 1. Select token type
  console.log(chalk.yellow("\n=== Remove Collateral ==="));
  console.log(chalk.italic("Removing collateral merges your YES/NO position tokens back into the original token"));
  console.log("Select token type:");
  console.log("1. Currency (SDAI)");
  console.log("2. Company (GNO)");
  
  const tokenType = await prompt("Enter choice (1-2): ");
  
  if (tokenType !== "1" && tokenType !== "2") {
    console.log(chalk.red("Invalid token type. Operation cancelled."));
    return;
  }
  
  const selectedType = tokenType === "1" ? "currency" : "company";
  const symbol = selectedType === "currency" ? "SDAI" : "GNO";
  
  // Get max removable amount
  const totalAvailable = futarchy.getTotalAvailableBalance();
  const maxRemovable = selectedType === "currency" 
    ? totalAvailable.currency.collateral
    : totalAvailable.company.collateral;
    
  console.log(chalk.yellow(`\nYou can remove up to ${formatBalance(maxRemovable, symbol)} (paired minimum of YES/NO)`));
  console.log(chalk.dim(`Removing collateral requires equal amounts of both YES_${symbol} and NO_${symbol} tokens`));
  console.log(chalk.dim(`The paired minimum is the maximum amount you can remove based on your position tokens`));
  
  // Get amount
  const amount = await prompt(`Enter amount to remove (max ${formatBalance(maxRemovable)}): `);
  
  // Special case: Check if user is trying to use exact maximum
  if (amount === maxRemovable || amount === formatBalance(maxRemovable).trim()) {
    // Use the exact maxRemovable value directly to avoid any precision issues
    console.log(chalk.yellow(`\nRemoving maximum available collateral...`));
    const preciseAmount = maxRemovable;
    
    // Continue with max amount
    try {
      const result = await futarchy.removeCollateral(selectedType, preciseAmount, {
        onStart: () => console.log(chalk.blue("Starting collateral removal...")),
        onMerge: (tx) => console.log(chalk.yellow(`Merge sent: ${tx.hash}`)),
        onComplete: (receipt) => console.log(chalk.green(`Collateral removed successfully! Block: ${receipt.blockNumber}`)),
        onError: (error) => console.log(chalk.red(`Error: ${error.message}`))
      });
      
      if (result.success) {
        console.log(chalk.green("\n✅ Collateral removed successfully!"));
      } else {
        console.log(chalk.red("\n❌ Failed to remove collateral."));
      }
    } catch (error) {
      console.log(chalk.red(`\nAn error occurred: ${error.message}`));
    }
    
    // Refresh balances after removal
    console.log(chalk.yellow("Refreshing balances..."));
    await refreshBalances(futarchy);
    
    return;
  }
  
  // Get token decimals from environment config
  const baseToken = environmentConfig.baseTokens[selectedType];
  const tokenDecimals = baseToken.decimals;
  
  // Use ethers BigNumber for exact decimal comparison with correct decimals
  const amountBN = ethers.utils.parseUnits(amount, tokenDecimals);
  const maxBN = ethers.utils.parseUnits(maxRemovable, tokenDecimals);
  
  // Compare with BigNumber to avoid floating-point precision issues
  if (amountBN.isZero() || amountBN.gt(maxBN.add(1))) {
    console.log(chalk.red("Invalid amount. Operation cancelled."));
    
    // Debug info
    console.log(chalk.gray(`Debug info:`));
    console.log(chalk.gray(`- Amount entered: ${amount}`));
    console.log(chalk.gray(`- Amount as BN: ${amountBN.toString()}`));
    console.log(chalk.gray(`- Max available: ${maxRemovable}`));
    console.log(chalk.gray(`- Max as BN: ${maxBN.toString()}`));
    console.log(chalk.gray(`- Difference: ${amountBN.sub(maxBN).toString()}`));
    
    return;
  }
  
  // Remove collateral
  try {
    console.log(chalk.yellow(`\nRemoving ${amount} ${symbol} collateral...`));
    console.log(chalk.dim(`This will merge your YES_${symbol} and NO_${symbol} back into ${symbol}`));
    
    // Use the raw amount string for full precision
    const preciseAmount = amount;
    
    const result = await futarchy.removeCollateral(selectedType, preciseAmount, {
      onStart: () => console.log(chalk.blue("Starting collateral removal...")),
      onMerge: (tx) => console.log(chalk.yellow(`Merge sent: ${tx.hash}`)),
      onComplete: (receipt) => console.log(chalk.green(`Collateral removed successfully! Block: ${receipt.blockNumber}`)),
      onError: (error) => console.log(chalk.red(`Error: ${error.message}`))
    });
    
    if (result.success) {
      console.log(chalk.green("\n✅ Collateral removed successfully!"));
    } else {
      console.log(chalk.red("\n❌ Failed to remove collateral."));
    }
  } catch (error) {
    console.log(chalk.red(`\nAn error occurred: ${error.message}`));
  }
}

/**
 * Handle swapping between position tokens
 * 
 * Swapping is the core activity in futarchy markets. It allows you to:
 * - Express your belief about company token value under different scenarios
 * - Adjust market prices to reflect your expectations about economic impact
 * - Potentially profit from correctly assessing value outcomes
 * 
 * WHY SWAP TOKENS?
 * - To express your belief about which policy maximizes company value
 * - To influence the price signals that guide governance decisions
 * - To potentially profit from your understanding of economic impacts
 */
async function swapTokens(futarchy) {
  console.log(chalk.bold.magenta("\n===== SWAP TOKENS ====="));
  console.log(chalk.italic("Swapping allows you to express your belief about company token value under different scenarios"));
  console.log(chalk.italic("When trading YES/NO tokens, you're betting on expected value impacts, not just event probability"));
  
  // Get market name and outcome names for display
  const yesOutcomeName = futarchy.getYesOutcomeName();
  const noOutcomeName = futarchy.getNoOutcomeName();
  
  // 1. Select action (buy/sell)
  const action = await prompt(
    "Select action:\n" +
    "1. Buy (exchange currency for company tokens)\n" +
    "2. Sell (exchange company for currency tokens)\n" +
    "Your choice (1-2): "
  );
  
  const isBuy = action === "1";
  
  // 2. Select position side (YES/NO)
  const side = await prompt(
    "Select position side:\n" +
    `1. ${yesOutcomeName}\n` +
    `2. ${noOutcomeName}\n` +
    "Your choice (1-2): "
  );
  
  const isYes = side === "1";
  
  // Explanation based on user selection
  if (isBuy) {
    if (isYes) {
      console.log(chalk.dim(`You're buying tokens for: ${yesOutcomeName}`));
      console.log(chalk.dim("Higher prices indicate expected POSITIVE impact on company value if implemented"));
    } else {
      console.log(chalk.dim(`You're buying tokens for: ${noOutcomeName}`));
      console.log(chalk.dim("Higher prices indicate expected POSITIVE impact on company value if NOT implemented"));
    }
  } else {
    if (isYes) {
      console.log(chalk.dim(`You're selling tokens for: ${yesOutcomeName}`));
      console.log(chalk.dim("This indicates you believe these tokens are currently overvalued"));
    } else {
      console.log(chalk.dim(`You're selling tokens for: ${noOutcomeName}`));
      console.log(chalk.dim("This indicates you believe these tokens are currently overvalued"));
    }
  }
  
  // 3. Determine tokenType and relevant balances
  const positions = {
    currency: futarchy.getPosition('currency'),
    company: futarchy.getPosition('company')
  };
  
  // For buy operations, we check currency tokens
  // For sell operations, we check company tokens
  const tokenType = isBuy ? "currency" : "company";
  const positionSide = isYes ? "yes" : "no";
  
  // 4. Calculate maximum available for swap
  const position = positions[tokenType];
  const availableFromPosition = position[positionSide].available;
  
  // Add wallet balance for both buy and sell operations
  const totalAvailable = futarchy.getTotalAvailableBalance();
  const walletBalance = tokenType === "currency" 
    ? totalAvailable.currency.wallet
    : totalAvailable.company.wallet;
  
  // Get token decimals from environment config
  const baseToken = environmentConfig.baseTokens[tokenType];
  const tokenDecimals = baseToken.decimals;
  
  // Use BigNumber for all calculations to avoid precision issues
  const walletBN = ethers.utils.parseUnits(walletBalance, tokenDecimals);
  const positionBN = ethers.utils.parseUnits(availableFromPosition, tokenDecimals);
  const totalBN = walletBN.add(positionBN);
  
  // Format with full precision for display and validation
  const totalAvailableAmount = ethers.utils.formatUnits(totalBN, tokenDecimals);
  
  const symbol = tokenType === "currency" ? "SDAI" : "GNO";
  const operationDesc = `${isBuy ? 'Buy' : 'Sell'} ${isYes ? 'YES' : 'NO'}`;
  
  console.log(chalk.yellow(`\nOperation: ${operationDesc}`));
  console.log(chalk.yellow(`Maximum available: ${formatBalance(totalAvailableAmount, symbol)}`));
  
  // 5. For both buy and sell operations, explain potential collateral addition
  if (parseFloat(availableFromPosition) < parseFloat(totalAvailableAmount)) {
    // Calculate potential addition using BigNumber
    const diffBN = totalBN.sub(positionBN);
    const potentialAddition = ethers.utils.formatUnits(diffBN, tokenDecimals);
    
    console.log(chalk.blue(`Note: If you use more than ${formatBalance(availableFromPosition, symbol)}, up to ${formatBalance(potentialAddition, symbol)} will be added as collateral first.`));
    console.log(chalk.dim("This means some of your wallet tokens will be automatically split into YES/NO position tokens"));
  }
  
  // 6. Get amount
  const amount = await prompt(`Enter amount to ${isBuy ? 'buy' : 'sell'} (max ${formatBalance(totalAvailableAmount)}): `);
  
  // Special case: Check if user is trying to use exact maximum
  if (amount === totalAvailableAmount || amount === formatBalance(totalAvailableAmount).trim()) {
    // Use the exact totalBN value directly to avoid any precision issues
    console.log(chalk.yellow(`\nExecuting ${operationDesc} for maximum available amount...`));
    const preciseAmount = totalAvailableAmount;
    
    // IMPORTANT FIX: Make sure we use proper action strings and event parameters
    let actionString = "buy";
    if (action === "2") {
      actionString = "sell";
    }
    
    // IMPORTANT FIX: Make sure YES = true, NO = false
    let eventHappensValue = true;
    if (side === "2") {
      eventHappensValue = false;
    }
    
    // Construct correct parameters - being very explicit
    const swapParams = {
      tokenType,
      amount: preciseAmount,
      eventHappens: eventHappensValue,  // true for YES, false for NO
      action: actionString,             // "buy" or "sell" string
      useSushiV3: true
    };
    
    console.log("Smart swap initiated with params:", swapParams);
    
    // Continue with max amount
    try {
      // Call advanced smart swap with the correct parameters
      const result = await futarchy.advancedSmartSwap({
        ...swapParams,
        onStart: () => console.log(chalk.blue("Starting swap operation...")),
        onStatus: (status) => console.log(chalk.blue(`Status: ${status}`)),
        onCollateralNeeded: (amount) => console.log(chalk.yellow(`Additional collateral needed: ${amount} ${symbol}`)),
        onCollateralAdded: () => console.log(chalk.blue("Collateral added successfully")),
        onSwapStart: () => console.log(chalk.blue("Starting swap transaction...")),
        onSwapApprovalNeeded: () => console.log(chalk.yellow("Token approval needed for swap")),
        onSwapApprovalComplete: () => console.log(chalk.blue("Token approval complete")),
        onSwapComplete: (receipt) => {
          console.log(chalk.green(`\nSwap complete!`));
          console.log(`Transaction hash: ${receipt.transactionHash}`);
        },
        onError: (error) => console.log(chalk.red(`Error: ${error.message}`)),
        onCollateralApprovalNeeded: () => console.log(chalk.yellow("Approval needed for collateral")),
        onCollateralApprovalComplete: () => console.log(chalk.blue("Collateral approval complete"))
      });
      
      if (result.success) {
        console.log(chalk.green("\n✅ Swap completed successfully!"));
      } else {
        console.log(chalk.red("\n❌ Failed to complete swap."));
      }
    } catch (error) {
      console.log(chalk.red(`\nAn error occurred: ${error.message}`));
    }
    
    // Refresh balances after swap
    console.log(chalk.yellow("Refreshing balances..."));
    await refreshBalances(futarchy);
    
    return;
  }
  
  // Use ethers BigNumber for exact decimal comparison with correct decimals
  const amountBN = ethers.utils.parseUnits(amount, tokenDecimals);
  
  // Add a small buffer (1 wei) for comparison to handle potential rounding
  // This allows exact matches to pass validation
  if (amountBN.isZero() || amountBN.gt(totalBN.add(1))) {
    console.log(chalk.red("Invalid amount. Operation cancelled."));
    
    // Debug info
    console.log(chalk.gray(`Debug info:`));
    console.log(chalk.gray(`- Amount entered: ${amount}`));
    console.log(chalk.gray(`- Amount as BN: ${amountBN.toString()}`));
    console.log(chalk.gray(`- Max available: ${totalAvailableAmount}`));
    console.log(chalk.gray(`- Max as BN: ${totalBN.toString()}`));
    console.log(chalk.gray(`- Difference: ${amountBN.sub(totalBN).toString()}`));
    
    return;
  }
  
  // 7. Execute swap
  try {
    console.log(chalk.yellow(`\nExecuting ${operationDesc} for ${amount} ${symbol}...`));
    
    // Use the raw amount string for full precision
    const preciseAmount = amount;
    
    // IMPORTANT FIX: Make sure we use proper action strings and event parameters
    let actionString = "buy";
    if (action === "2") {
      actionString = "sell";
    }
    
    // IMPORTANT FIX: Make sure YES = true, NO = false
    let eventHappensValue = true;
    if (side === "2") {
      eventHappensValue = false;
    }
    
    // Debug the values to make sure they're correct
    console.log(chalk.blue("Debug - Selected values:"));
    console.log(chalk.blue(`- Action choice: ${action} (1=buy, 2=sell)`));
    console.log(chalk.blue(`- Side choice: ${side} (1=YES, 2=NO)`));
    console.log(chalk.blue(`- Converted action: ${actionString}`));
    console.log(chalk.blue(`- Converted eventHappens: ${eventHappensValue}`));
    
    // Double check the correct parameter mapping
    // Buy YES: action='buy', eventHappens=true
    // Buy NO: action='buy', eventHappens=false
    // Sell YES: action='sell', eventHappens=true
    // Sell NO: action='sell', eventHappens=false
    
    // Construct correct parameters - being very explicit
    const swapParams = {
      tokenType,
      amount: preciseAmount,
      eventHappens: eventHappensValue,  // true for YES, false for NO
      action: actionString,             // "buy" or "sell" string
      useSushiV3: true
    };
    
    console.log("Smart swap initiated with params:", swapParams);
    
    // Call advanced smart swap with the correct parameters
    const result = await futarchy.advancedSmartSwap({
      ...swapParams,
      onStart: () => console.log(chalk.blue("Starting swap operation...")),
      onStatus: (status) => console.log(chalk.blue(`Status: ${status}`)),
      onCollateralNeeded: (amount) => console.log(chalk.yellow(`Additional collateral needed: ${amount} ${symbol}`)),
      onCollateralAdded: () => console.log(chalk.blue("Collateral added successfully")),
      onSwapStart: () => console.log(chalk.blue("Starting swap transaction...")),
      onSwapApprovalNeeded: () => console.log(chalk.yellow("Token approval needed for swap")),
      onSwapApprovalComplete: () => console.log(chalk.blue("Token approval complete")),
      onSwapComplete: (receipt) => {
        console.log(chalk.green(`\nSwap complete!`));
        console.log(`Transaction hash: ${receipt.transactionHash}`);
      },
      onError: (error) => console.log(chalk.red(`Error: ${error.message}`)),
      onCollateralApprovalNeeded: () => console.log(chalk.yellow("Approval needed for collateral")),
      onCollateralApprovalComplete: () => console.log(chalk.blue("Collateral approval complete"))
    });
    
    if (result.success) {
      console.log(chalk.green("\n✅ Swap executed successfully!"));
    } else {
      console.log(chalk.red("\n❌ Failed to execute swap."));
    }
  } catch (error) {
    console.log(chalk.red(`\nAn error occurred: ${error.message}`));
  }
}

/**
 * Refreshes balances
 */
async function refreshBalances(futarchy) {
  try {
    console.log(chalk.blue("Refreshing balances..."));
    
    // Call initialize() which updates balances and other state
    await futarchy.initialize();
    
    console.log(chalk.green("Balances refreshed!"));
  } catch (error) {
    console.log(chalk.yellow("Could not refresh balances automatically. State may be stale."));
    console.error(error);
  }
}

/**
 * Display current prices and probability calculation
 * 
 * Price checking is crucial in futarchy as prices reflect:
 * - Market's collective belief about value outcomes under different scenarios
 * - Expected impact of policy decisions on company token value
 * - Which policy choice maximizes expected value
 * 
 * The comparison between YES and NO company prices determines which policy
 * would maximize company token value.
 */
async function checkPrices(futarchy) {
  console.log(chalk.bold.cyan("\n===== CURRENT MARKET PRICES ====="));
  console.log(chalk.italic("In futarchy, prices reveal expected company value under different scenarios"));
  console.log(chalk.italic("The policy that maximizes expected company value would be chosen"));
  
  // Get market name
  const marketName = futarchy.getMarketName();
  if (marketName) {
    console.log(chalk.yellow.bold(`Market Question: "${marketName}"`));
  }
  
  try {
    // Get initial pool prices from futarchy object
    let poolPrices = futarchy.getPoolPrices();
    
    // Get access to provider directly instead of through getProviderAndSigner
    // During initialization, we create the provider in the runTerminal function
    const provider = new ethers.providers.JsonRpcProvider("https://rpc.ankr.com/gnosis");
    
    // Force a refresh of pool prices
    await futarchy.fetchPoolPrices();
    
    // Get the updated pool prices
    poolPrices = futarchy.getPoolPrices();
    
    // Fix the price display - these values should not be displayed as percentages
    console.log(chalk.bold("\nCompany Token Prices (from Uniswap V3):"));
    console.log(chalk.dim("These prices show how much each conditional token is worth relative to its paired currency token"));
    console.log(`• YES Company Price: ${poolPrices.yes.company.toFixed(6)}`);
    console.log(`• NO Company Price: ${poolPrices.no.company.toFixed(6)}`);
    
    console.log(chalk.bold("\nCurrency Token Prices (from Uniswap V3):"));
    console.log(chalk.dim("These are reference prices used in probability calculations"));
    console.log(`• YES Currency Price: ${poolPrices.yes.currency.toFixed(6)}`);
    console.log(`• NO Currency Price: ${poolPrices.no.currency.toFixed(6)}`);
    
    console.log(chalk.bold("\nImplied Event Probability:"));
    console.log(chalk.dim("This is the market's estimate of whether the event will happen, derived from token prices"));
    console.log(chalk.dim("Higher YES prices relative to NO prices indicate the market believes the event is more likely"));
    
    // Use the impliedProbability directly from futarchy.js
    if (poolPrices.impliedProbability !== undefined) {
      const probabilityPercentage = (poolPrices.impliedProbability * 100).toFixed(2);
      console.log(`• Event Probability: ${probabilityPercentage}%`);
      
      // Add interpretation
      if (poolPrices.impliedProbability > 0.75) {
        console.log(chalk.green(`The market strongly believes the event WILL happen (${probabilityPercentage}% confidence)`));
      } else if (poolPrices.impliedProbability > 0.5) {
        console.log(chalk.green(`The market leans toward the event happening (${probabilityPercentage}% confidence)`));
      } else if (poolPrices.impliedProbability > 0.25) {
        console.log(chalk.red(`The market leans toward the event NOT happening (${(100-probabilityPercentage).toFixed(2)}% confidence)`));
      } else {
        console.log(chalk.red(`The market strongly believes the event will NOT happen (${(100-probabilityPercentage).toFixed(2)}% confidence)`));
      }
    }
    
    // Get SDAI rate from poolPrices
    console.log(chalk.bold("\nSDAI Rate:"));
    console.log(chalk.dim("The SDAI rate reflects the value of SDAI relative to the native token"));
    
    // Use both raw and formatted sdaiRate from futarchy object
    const sdaiRateRaw = poolPrices.sdaiRateRaw;
    const sdaiPriceFormatted = poolPrices.sdaiRate;
    
    console.log(`• SDAI Rate: ${sdaiPriceFormatted}`);
    
    // Market analysis metrics from futarchy.js (direct from pool prices)
    console.log(chalk.bold("\n📊 Governance Implications:"));
    console.log(chalk.dim("In futarchy, governance decisions are based on which outcome maximizes company value"));
    
    // Compare YES company price vs NO company price
    console.log(chalk.bold("Company Token Price Comparison:"));
    console.log(`• YES Company Price: ${poolPrices.yes.company.toFixed(6)}`);
    console.log(`• NO Company Price: ${poolPrices.no.company.toFixed(6)}`);
    
    // Calculate Impact: (yesCompany - noCompany) / min(yesCompany, noCompany)
    const minCompanyPrice = Math.min(poolPrices.yes.company, poolPrices.no.company);
    const impact = (poolPrices.yes.company - poolPrices.no.company) / minCompanyPrice;
    const impactPercentage = (impact * 100).toFixed(2);
    
    // Calculate ConditionalAveragePrice: yesCompany * yesCurrency + noCompany * noCurrency
    const conditionalAveragePrice = (poolPrices.yes.company * poolPrices.yes.currency) + 
                                   (poolPrices.no.company * poolPrices.no.currency);
    
    console.log(chalk.bold("\n📊 Proposal Impact Analysis:"));
    console.log(`• Impact: ${impactPercentage}%`);
    if (impact > 0) {
      console.log(chalk.green(`  The market expects the proposal to increase company value by ${impactPercentage}%`));
    } else {
      console.log(chalk.red(`  The market expects the proposal to decrease company value by ${Math.abs(impactPercentage)}%`));
    }
    
    console.log(chalk.bold("\n💰 Conditional Average Price:"));
    console.log(`• Expected Value: ${conditionalAveragePrice.toFixed(6)}`);
    console.log(chalk.dim(`  This represents the weighted average company token price, considering both outcomes`));
    console.log(chalk.dim(`  Formula: (yesCompany * yesCurrency + noCompany * noCurrency)`));
    
    // Determine which price is higher and what it means
    if (poolPrices.yes.company > poolPrices.no.company) {
      console.log(chalk.green(`The YES company token price (${poolPrices.yes.company.toFixed(6)}) is higher than the NO price (${poolPrices.no.company.toFixed(6)})`));
      console.log(chalk.green("This indicates the market believes implementing the policy would INCREASE company value"));
      console.log(chalk.dim("In futarchy, this would suggest the policy SHOULD be implemented"));
    } else {
      console.log(chalk.red(`The NO company token price (${poolPrices.no.company.toFixed(6)}) is higher than the YES price (${poolPrices.yes.company.toFixed(6)})`));
      console.log(chalk.red("This indicates the market believes NOT implementing the policy would INCREASE company value"));
      console.log(chalk.dim("In futarchy, this would suggest the policy should NOT be implemented"));
    }
  } catch (error) {
    console.log(chalk.red(`\nError fetching prices: ${error.message}`));
    console.error(error);
  }
}

/**
 * Main menu function
 * 
 * This menu provides access to all futarchy operations:
 * 1. Check Balances - View your current positions and tokens
 * 2. Add Collateral - Split base tokens into YES/NO positions
 * 3. Remove Collateral - Merge YES/NO positions back to base tokens
 * 4. Swap Tokens - Express beliefs about value impacts
 * 5. Check Prices - View expected value comparisons
 */
async function mainMenu(futarchy) {
  while (true) {
    // Get market name
    const marketName = futarchy.getMarketName();
    
    console.log(chalk.cyan.bold('\n===== FUTARCHY TERMINAL ====='));
    console.log(chalk.cyan('Futarchy: Using markets to determine which policies maximize value'));
    console.log(chalk.cyan('We vote on values but bet on beliefs about expected value impacts'));
    if (marketName) {
      console.log(chalk.yellow.bold(`Market Question: "${marketName}"`));
    }
    console.log('1. Check Balances');
    console.log('2. Add Collateral');
    console.log('3. Remove Collateral');
    console.log('4. Swap Tokens');
    console.log('5. Check Prices');
    console.log('0. Exit');
    
    const choice = await prompt("Enter your choice (0-5): ");
    
    switch (choice) {
      case "1":
        await displayBalances(futarchy);
        break;
      case "2":
        await addCollateral(futarchy);
        // Refresh balances after operation
        await refreshBalances(futarchy);
        break;
      case "3":
        await removeCollateral(futarchy);
        // Refresh balances after operation
        await refreshBalances(futarchy);
        break;
      case "4":
        await swapTokens(futarchy);
        // Refresh balances after operation
        await refreshBalances(futarchy);
        break;
      case "5":
        await checkPrices(futarchy);
        break;
      case "0":
        console.log(chalk.green("\nExiting Futarchy Terminal. Goodbye!"));
        rl.close();
        return;
      default:
        console.log(chalk.red("Invalid choice. Please try again."));
    }
    
    // Prompt to continue
    await prompt(chalk.dim("\nPress Enter to continue..."));
  }
}

/**
 * Main function to run the terminal interface
 */
async function runTerminal() {
  console.log(chalk.bold.green("🔮 Welcome to Futarchy Terminal Interface"));
  console.log(chalk.gray("============================================="));
  console.log(chalk.italic("\nFutarchy is a governance system where markets determine policies based on expected value."));
  console.log(chalk.italic("In futarchy, we 'vote on values, but bet on beliefs' - Robin Hanson"));
  console.log(chalk.italic("How it works:"));
  console.log(chalk.italic("1. A policy or decision is proposed"));
  console.log(chalk.italic("2. Markets are created for company token value under two scenarios: if implemented and if not"));
  console.log(chalk.italic("3. Traders express their beliefs about expected company token values in each scenario"));
  console.log(chalk.italic("4. Market prices reveal which option is expected to maximize company token value"));
  console.log(chalk.italic("5. The policy with higher expected company value is implemented"));
  console.log(chalk.italic("\nThis terminal lets you participate by trading tokens representing value under different scenarios."));
  
  try {
    // Create provider and wallet
    const provider = createProvider();
    const network = await provider.getNetwork();
    console.log(chalk.blue(`Connected to ${network.name} (Chain ID: ${network.chainId})`));
    
    const wallet = createWallet(provider);
    const walletAddress = await wallet.getAddress();
    console.log(chalk.blue(`Using wallet: ${walletAddress}`));
    
    // Create futarchy instance
    console.log(chalk.yellow("\nInitializing Futarchy system..."));
    const futarchy = createFutarchy({
      customProvider: provider,
      customSigner: wallet,
      autoInitialize: false,
      useSushiV3: true
    });
    
    // Initialize futarchy
    await futarchy.initialize();
    
    // Display market name after initialization
    const marketName = futarchy.getMarketName();
    if (marketName) {
      console.log(chalk.yellow.bold(`\nMarket Question: "${marketName}"`));
      console.log(chalk.yellow(`    Yes Outcome: "${futarchy.getYesOutcomeName()}"`));
      console.log(chalk.yellow(`    No Outcome: "${futarchy.getNoOutcomeName()}"\n`));
    }
    
    console.log(chalk.green("✅ Futarchy system initialized successfully!"));
    console.log(chalk.dim("Now you can check balances, add collateral, swap tokens, and more."));
    
    // Run main menu
    await mainMenu(futarchy);
    
    // Clean up
    futarchy.cleanup();
    console.log(chalk.gray("Cleaned up futarchy instance."));
    
  } catch (error) {
    console.log(chalk.red(`\n❌ Fatal error: ${error.message}`));
    console.error(error);
  } finally {
    // Ensure readline interface is closed
    rl.close();
    setTimeout(() => process.exit(0), 500);
  }
}

// Run the terminal
runTerminal().catch(error => {
  console.error(chalk.red("Unhandled error:"), error);
  process.exit(1);
}); 