/**
 * @fileoverview Futarchy Proposal Terminal
 * 
 * A command-line interface for creating Futarchy proposals on Gnosis Chain.
 * This tool guides users through creating proposals with prediction markets
 * for governance decisions.
 */

import { ethers } from 'ethers';
import dotenv from 'dotenv';
import readline from 'readline';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { 
  createProposalConfig, 
  saveProposalConfig, 
  validateProposalConfig,
  getSampleProposalConfig,
  isValidAddress
} from './proposalConfig.js';
import { createLiquidityProvider } from './liquidityManager.js';

// Load environment variables
dotenv.config();

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Contract ABIs
const FUTARCHY_FACTORY_ABI = [
  "function createProposal((string,address,address,string,string,uint256,uint32)) external returns (address)",
  "function proposals(uint256) external view returns (address)",
  "function marketsCount() external view returns (uint256)"
];

const FUTARCHY_PROPOSAL_ABI = [
  "function marketName() view returns (string)",
  "function encodedQuestion() view returns (string)",
  "function collateralToken1() view returns (address)",
  "function collateralToken2() view returns (address)",
  "function wrappedOutcome(uint256) view returns (address)",
  "function numOutcomes() view returns (uint256)"
];

const FUTARCHY_ROUTER_ABI = [
  "function splitPosition(address,address,uint256) external",
  "function mergePositions(address,address,uint256) external"
];

const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)"
];

// Helper function for prompting with a question
const askQuestion = (query) => new Promise((resolve) => rl.question(query, resolve));

// Helper function for displaying colored console output
const consoleColors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

/**
 * Prints a formatted header to the console
 * @param {string} text - Text to display in the header
 */
const printHeader = (text) => {
  console.log('\n' + consoleColors.bright + consoleColors.cyan + '══════════════════════════════════════════════' + consoleColors.reset);
  console.log(consoleColors.bright + consoleColors.cyan + '  ' + text + consoleColors.reset);
  console.log(consoleColors.bright + consoleColors.cyan + '══════════════════════════════════════════════' + consoleColors.reset + '\n');
};

/**
 * Prints a success message to the console
 * @param {string} text - Success message text
 */
const printSuccess = (text) => {
  console.log(consoleColors.green + '✓ ' + consoleColors.reset + text);
};

/**
 * Prints an error message to the console
 * @param {string} text - Error message text
 */
const printError = (text) => {
  console.log(consoleColors.red + '✗ ' + consoleColors.reset + text);
};

/**
 * Prints an info message to the console
 * @param {string} text - Info message text
 */
const printInfo = (text) => {
  console.log(consoleColors.blue + 'ℹ ' + consoleColors.reset + text);
};

// Fix: Define colors object for consistency
const colors = consoleColors;

/**
 * Executes a shell command and returns the output
 * @param {string} command - Command to execute
 * @returns {Promise<string>} Command output
 */
const executeCommand = (command) => {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(stdout);
    });
  });
};

/**
 * Validates environment variables and returns provider and signer
 * @returns {Object} Provider and signer objects
 */
const setupProviderAndSigner = () => {
  // Check for required environment variables
  const requiredEnvVars = [
    'PRIVATE_KEY',
    'RPC_URL',
    'FUTARCHY_FACTORY'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    printError('Missing required environment variables: ' + missingVars.join(', '));
    console.log('Please ensure these are set in your .env file:');
    missingVars.forEach(varName => {
      console.log(`  ${varName}=...`);
    });
    process.exit(1);
  }

  // Create provider and signer
  const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  
  return { provider, signer };
};

/**
 * Get outcome token addresses from a proposal contract
 * @param {string} proposalAddress - Proposal contract address
 * @param {Object} options - Provider and signer
 * @returns {Promise<Object>} Outcome token addresses
 */
const getOutcomeTokens = async (proposalAddress, { provider, signer }) => {
  try {
    const proposalContract = new ethers.Contract(
      proposalAddress,
      FUTARCHY_PROPOSAL_ABI,
      provider
    );
    
    const numOutcomes = await proposalContract.numOutcomes();
    const outcomeTokens = [];
    
    for (let i = 0; i < numOutcomes.toNumber(); i++) {
      const tokenAddress = await proposalContract.wrappedOutcome(i);
      // In a real implementation, we would get the token symbol from the contract
      // For simplicity, we'll use YES/NO
      const symbol = i === 0 ? 'YES' : 'NO';
      outcomeTokens.push({
        index: i,
        symbol,
        address: tokenAddress
      });
    }
    
    // Also get collateral tokens
    const collateral1 = await proposalContract.collateralToken1();
    const collateral2 = await proposalContract.collateralToken2();
    
    return {
      outcomeTokens,
      collateral1,
      collateral2
    };
  } catch (error) {
    printError(`Failed to get outcome tokens from proposal: ${error.message}`);
    return {
      outcomeTokens: [],
      collateral1: null,
      collateral2: null
    };
  }
};

/**
 * Finds the maximum BigNumber in an array of BigNumbers
 * @param {Array<ethers.BigNumber>} bigNumbers - Array of BigNumber objects
 * @returns {ethers.BigNumber} The maximum BigNumber
 */
const findMaxBigNumber = (bigNumbers) => {
  if (!bigNumbers || bigNumbers.length === 0) {
    return ethers.BigNumber.from(0);
  }
  
  let max = bigNumbers[0];
  for (let i = 1; i < bigNumbers.length; i++) {
    if (bigNumbers[i].gt(max)) {
      max = bigNumbers[i];
    }
  }
  
  return max;
};

/**
 * Main function that guides user through proposal creation
 */
const createProposal = async () => {
  try {
    printHeader('FUTARCHY PROPOSAL CREATION TOOL');
    
    // Setup provider and signer
    const { provider, signer } = setupProviderAndSigner();
    const userAddress = await signer.getAddress();
    
    // Get network information
    const network = await provider.getNetwork();
    const networkName = network.name === 'unknown' ? 'Gnosis Chain' : network.name;
    
    printInfo(`Connected to network: ${networkName} (Chain ID: ${network.chainId})`);
    printInfo(`Using account: ${userAddress}`);
    printInfo(`Account balance: ${ethers.utils.formatEther(await provider.getBalance(userAddress))} XDAI\n`);

    // Create contract instance
    const factoryContract = new ethers.Contract(
      process.env.FUTARCHY_FACTORY,
      FUTARCHY_FACTORY_ABI,
      signer
    );

    // Collect proposal parameters through interactive prompts
    console.log(colors.yellow + 'Please provide the following proposal details:' + colors.reset);
    
    // Ask for basic proposal details
    const proposalName = await askQuestion('Proposal name: ');
    const proposalQuestion = await askQuestion('Proposal question (e.g., "Should we implement X?"): ');
    const category = await askQuestion('Question category (default: "governance"): ') || 'governance';
    const lang = await askQuestion('Language code (default: "en"): ') || 'en';
    
    // Get collateral token addresses with validation
    let collateralToken1 = '';
    while (!isValidAddress(collateralToken1)) {
      collateralToken1 = await askQuestion(
        `Collateral token 1 address (SDAI/DAI) ${process.env.SDAI_ADDRESS ? `[default: ${process.env.SDAI_ADDRESS}]: ` : ': '}`
      );
      
      // Use default from env if available and no input given
      if (!collateralToken1 && process.env.SDAI_ADDRESS) {
        collateralToken1 = process.env.SDAI_ADDRESS;
      }
      
      if (!isValidAddress(collateralToken1)) {
        printError('Invalid Ethereum address. Please try again.');
      }
    }
    
    let collateralToken2 = '';
    while (!isValidAddress(collateralToken2)) {
      collateralToken2 = await askQuestion(
        `Collateral token 2 address (GNO) ${process.env.GNO_ADDRESS ? `[default: ${process.env.GNO_ADDRESS}]: ` : ': '}`
      );
      
      // Use default from env if available and no input given
      if (!collateralToken2 && process.env.GNO_ADDRESS) {
        collateralToken2 = process.env.GNO_ADDRESS;
      }
      
      if (!isValidAddress(collateralToken2)) {
        printError('Invalid Ethereum address. Please try again.');
      }
    }
    
    // Get minimum bond and opening time
    let minBond = await askQuestion('Minimum bond amount in XDAI (default: 1.0): ');
    minBond = minBond || '1.0';
    minBond = ethers.utils.parseEther(minBond).toString();
    
    let openingTime = await askQuestion('Opening time (0 for immediate, or UNIX timestamp): ');
    openingTime = parseInt(openingTime || '0');
    
    // Remove the liquidity configuration prompt and replace with automatic configuration
    // using default values
    let createLiquidityConfig = true; // Always create config with defaults
    let wxdaiAmount = process.env.DEFAULT_WXDAI_AMOUNT || '1000000000000000000';
    let token1Amount = process.env.DEFAULT_TOKEN1_AMOUNT || '1000000000000000000';
    let token2Amount = process.env.DEFAULT_TOKEN2_AMOUNT || '1000000000000000000';
    
    // Note that we removed the interactive liquidity parameters prompt
    printInfo('Setting up default liquidity parameters for later use.');
    printInfo('You can customize these values when adding liquidity from the main menu.');

    // Create proposal configuration
    const proposalConfig = createProposalConfig({
      name: proposalName,
      question: proposalQuestion,
      category,
      lang,
      collateralToken1,
      collateralToken2,
      minBond,
      openingTime,
      wxdaiAmount,
      token1Amount,
      token2Amount
    });
    
    // Validate the configuration
    const validationResult = validateProposalConfig(proposalConfig);
    if (!validationResult.valid) {
      printError('Invalid proposal configuration:');
      validationResult.errors.forEach(error => {
        console.log(`  - ${error}`);
      });
      throw new Error('Invalid proposal configuration');
    }

    // Display summary for confirmation
    console.log('\n' + colors.yellow + '--- Proposal Summary ---' + colors.reset);
    console.log(`Name: ${proposalConfig.name}`);
    console.log(`Question: ${proposalConfig.question}`);
    console.log(`Category: ${proposalConfig.category}`);
    console.log(`Language: ${proposalConfig.lang}`);
    console.log(`Collateral Token 1: ${proposalConfig.collateralToken1}`);
    console.log(`Collateral Token 2: ${proposalConfig.collateralToken2}`);
    console.log(`Minimum Bond: ${ethers.utils.formatEther(proposalConfig.minBond)} XDAI`);
    console.log(`Opening Time: ${proposalConfig.openingTime === 0 ? 'Immediate' : new Date(proposalConfig.openingTime * 1000).toISOString()}`);
    
    console.log('\nLiquidity:');
    console.log(`Default parameters will be saved with this proposal.`);
    console.log(`You can customize liquidity settings when adding liquidity from the main menu.`);
    
    console.log('');

    const confirmation = await askQuestion('Proceed with proposal creation? (y/n): ');
    
    if (confirmation.toLowerCase() !== 'y') {
      printInfo('Proposal creation cancelled.');
      return;
    }

    // Save proposal configuration to a file
    const timestamp = Math.floor(Date.now() / 1000);
    const configFilename = `proposal_config_${timestamp}.json`;
    const configPath = saveProposalConfig(proposalConfig, configFilename);
    printSuccess(`Proposal configuration saved to ${configPath}`);

    // Create tuple format for Solidity call
    const paramsTuple = [
      proposalConfig.name,
      proposalConfig.collateralToken1,
      proposalConfig.collateralToken2,
      proposalConfig.category,
      proposalConfig.lang,
      proposalConfig.minBond,
      proposalConfig.openingTime
    ];

    // Send transaction to create proposal
    printInfo('Sending transaction to create proposal...');
    
    // Estimate gas for the transaction
    try {
      const gasEstimate = await factoryContract.estimateGas.createProposal(paramsTuple);
      printInfo(`Estimated gas: ${gasEstimate.toString()}`);
      
      // Add 20% buffer to gas estimate
      const gasLimit = gasEstimate.mul(120).div(100);
      
      const tx = await factoryContract.createProposal(paramsTuple, {
        gasLimit
      });
      
      printInfo(`Transaction sent! Hash: ${tx.hash}`);
      printInfo(`View on explorer: https://gnosisscan.io/tx/${tx.hash}`);
      
      printInfo('Waiting for transaction confirmation...');
      const receipt = await tx.wait(1);
      
      if (receipt.status === 1) {
        // Extract the created proposal address from the transaction receipt
        // This depends on the contract implementation and events
        let proposalAddress;
        
        // Try to extract from the logs
        for (const log of receipt.logs) {
          try {
            // Look for events that might contain the address
            if (log.topics[0] === ethers.utils.id('ProposalCreated(address)')) {
              const decodedLog = ethers.utils.defaultAbiCoder.decode(
                ['address'],
                log.data
              );
              proposalAddress = decodedLog[0];
              break;
            }
          } catch (e) {
            // Continue checking other logs
          }
        }

        if (!proposalAddress) {
          // If we couldn't get the address from events, try to get it from the contract
          const marketsCount = await factoryContract.marketsCount();
          if (marketsCount > 0) {
            proposalAddress = await factoryContract.proposals(marketsCount.sub(1));
          }
        }

        printSuccess('Proposal created successfully!');
        
        if (proposalAddress) {
          printSuccess(`Proposal address: ${proposalAddress}`);
          printSuccess(`View on explorer: https://gnosisscan.io/address/${proposalAddress}`);
          
          // Update the config file with the proposal address
          proposalConfig.proposalAddress = proposalAddress;
          saveProposalConfig(proposalConfig, configFilename);
        }
        
        // Next steps guidance - Modified to return to main menu instead of offering to add liquidity immediately
        console.log('\n' + colors.yellow + '--- Next Steps ---' + colors.reset);
        console.log('Your proposal has been created successfully! To add liquidity:');
        console.log('1. Return to the main menu (the tool will return there automatically)');
        console.log('2. Select option 2 "Add liquidity to existing proposal"');
        console.log('3. When prompted, either enter your proposal address or leave empty to use this proposal');
        console.log('\nThis separation allows you to verify your proposal before adding liquidity.');
        console.log('The liquidity settings you configured during proposal creation will be used automatically.');
        
        // Return to main menu after a short delay without closing the readline interface
        setTimeout(() => {
          showMainMenu();
        }, 1000);
      } else {
        printError('Transaction failed!');
      }
    } catch (error) {
      printError(`Failed to estimate gas: ${error.message}`);
      throw error;
    }
  } catch (error) {
    printError(`Error: ${error.message}`);
    if (error.data) {
      console.error('Error data:', error.data);
    }
    
    // Return to main menu on error
    setTimeout(() => {
      showMainMenu();
    }, 1000);
  }
};

/**
 * Interactive V2 liquidity addition process with automatic splitting of tokens if needed
 * @param {string} configPath - Path to the proposal configuration file
 * @param {Object} options - Provider and signer
 */
const addV2LiquidityInteractive = async (configPath, { provider, signer }) => {
  try {
    printHeader('ADDING LIQUIDITY TO PROPOSAL');
    printInfo(`Using configuration file: ${configPath}`);
    
    // Log environment variables for debugging
    console.log('DEBUG - Environment variables:');
    console.log('WXDAI_ADDRESS:', process.env.WXDAI_ADDRESS);
    console.log('SUSHISWAP_V2_ROUTER_POOL_CREATOR:', process.env.SUSHISWAP_V2_ROUTER_POOL_CREATOR);
    console.log('SUSHISWAP_V2_FACTORY:', process.env.SUSHISWAP_V2_FACTORY);
    
    // Load the configuration
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    console.log('DEBUG - Loaded config:', JSON.stringify(config, null, 2));
    
    if (!config.proposalAddress) {
      printError('Proposal address is missing in the configuration file.');
      return;
    }
    
    printInfo(`Proposal address: ${config.proposalAddress}`);
    printInfo(`Proposal name: ${config.name}`);
    printInfo(`Preparing to create liquidity pools for this proposal...`);
    
    // Check if FUTARCHY_ROUTER is set in environment
    const routerAddress = process.env.FUTARCHY_ROUTER;
    if (!routerAddress) {
      printError('FUTARCHY_ROUTER address is not set in the environment variables.');
      printInfo('Please set FUTARCHY_ROUTER in your .env file to enable token splitting.');
      // Continue without split functionality
    }
    
    // Get user address
    const userAddress = await signer.getAddress();
    
    // If we have outcome tokens in the config, display them
    if (config.outcomeTokens && config.outcomeTokens.length) {
      printInfo('\nOutcome tokens that will be used:');
      
      // Check balances for all outcome tokens
      const balances = [];
      for (const token of config.outcomeTokens) {
        const tokenContract = new ethers.Contract(token.address, ERC20_ABI, provider);
        const balance = await tokenContract.balanceOf(userAddress);
        const decimals = await tokenContract.decimals();
        const formattedBalance = ethers.utils.formatUnits(balance, decimals);
        
        balances.push({
          ...token,
          balance,
          formattedBalance
        });
        
        console.log(`  ${token.index}: ${token.symbol} (${token.address}) - Balance: ${formattedBalance}`);
      }
      
      // Store balances in config for later use
      config.outcomeTokensWithBalances = balances;
    }
    
    // Create our liquidity provider with interactive callbacks
    const liquidityProvider = createLiquidityProvider({
      provider,
      signer,
      // Callback when approval is needed
      onApprovalNeeded: async (tokenSymbol) => {
        const approve = await askQuestion(`Approve ${tokenSymbol} for SushiSwap V2 Router? (y/n): `);
        return approve.toLowerCase() === 'y';
      },
      // Callback when a pool is about to be created
      onPoolCreation: async (token1Symbol, token2Symbol) => {
        if (token1Symbol === 'ALL POOLS') {
          const proceed = await askQuestion(`Create all liquidity pools for this proposal? (y/n): `);
          return proceed.toLowerCase() === 'y';
        }
        const proceed = await askQuestion(`Create pool for ${token1Symbol}/${token2Symbol}? (y/n): `);
        return proceed.toLowerCase() === 'y';
      },
      // Callback when liquidity is about to be added
      onLiquidityAdded: async (token1Symbol, amount1, token2Symbol, amount2) => {
        const proceed = await askQuestion(`Add ${amount1} ${token1Symbol} and ${amount2} ${token2Symbol} to pool? (y/n): `);
        return proceed.toLowerCase() === 'y';
      },
      // Transaction callback
      onTransaction: (txInfo) => {
        const txType = txInfo.type;
        const txHash = txInfo.hash;
        
        switch (txType) {
          case 'approval':
            printInfo(`Approving ${txInfo.token.symbol}... (tx: ${txHash})`);
            break;
          case 'createPair':
            printInfo(`Creating pair... (tx: ${txHash})`);
            break;
          case 'addLiquidity':
            printInfo(`Adding liquidity... (tx: ${txHash})`);
            break;
        }
      }
    });
    
    // Show a summary of what's going to happen using outcome token symbols if available
    const getTokenSymbol = (index) => {
      if (config.outcomeTokens && config.outcomeTokens[index]) {
        return config.outcomeTokens[index].symbol;
      }
      
      const prefixes = ['YES_', 'NO_', 'YES_', 'NO_'];
      const baseTokens = [
        config.collateralToken1Symbol || 'Token1', 
        config.collateralToken1Symbol || 'Token1',
        config.collateralToken2Symbol || 'Token2',
        config.collateralToken2Symbol || 'Token2'
      ];
      
      return `${prefixes[index]}${baseTokens[index]}`;
    };
    
    printInfo(`\nThe following liquidity pools will be created for proposal ${config.name}:`);
    console.log(`1. WXDAI <> ${getTokenSymbol(0)} Pool`);
    console.log(`2. WXDAI <> ${getTokenSymbol(1)} Pool`);
    
    if (config.collateralToken2) {
      console.log(`3. WXDAI <> ${getTokenSymbol(2)} Pool`);
      console.log(`4. WXDAI <> ${getTokenSymbol(3)} Pool`);
    }
    
    console.log('');
    printInfo('This process includes:');
    console.log('1. Checking and approving tokens for the SushiSwap V2 Router');
    console.log('2. Creating each trading pool one by one');
    console.log('3. Adding initial liquidity to each pool');
    console.log('4. Confirming all transactions on the blockchain\n');
    
    // If we have the router address, check if we need to split tokens
    if (routerAddress && config.outcomeTokensWithBalances) {
      printInfo('Checking if token splitting is needed before adding liquidity...');
      
      // Get liquidity amounts from config
      const wxdaiAmount = config.liquidity?.wxdaiAmount || ethers.utils.parseEther('1.0').toString();
      
      // Get token amounts - check if we have individual outcomeTokenAmounts
      let tokenAmounts = [];
      if (config.liquidity?.outcomeTokenAmounts && config.liquidity.outcomeTokenAmounts.length) {
        tokenAmounts = config.liquidity.outcomeTokenAmounts;
      } else {
        // Fallback to legacy format
        const token1Amount = config.liquidity?.token1Amount || ethers.utils.parseEther('1.0').toString();
        const token2Amount = config.liquidity?.token2Amount || ethers.utils.parseEther('1.0').toString();
        
        // Create a default array with the same amount for each collateral type
        tokenAmounts = [token1Amount, token1Amount, token2Amount, token2Amount];
      }
      
      // Check if we need to split any tokens
      const tokenSplitNeeded = [];
      
      // Group tokens by collateral type
      const token1Outcomes = config.outcomeTokensWithBalances.filter(token => 
        token.symbol.includes(config.collateralToken1Symbol) || 
        token.index < 2
      );
      
      const token2Outcomes = config.outcomeTokensWithBalances.filter(token => 
        token.symbol.includes(config.collateralToken2Symbol) || 
        token.index >= 2
      );
      
      // Check each outcome token against the required amount
      for (let i = 0; i < config.outcomeTokensWithBalances.length; i++) {
        const token = config.outcomeTokensWithBalances[i];
        const requiredAmount = tokenAmounts[i] || ethers.utils.parseEther('1.0').toString();
        
        if (token.balance.lt(requiredAmount)) {
          // Calculate how much we need to split
          const amountNeeded = ethers.BigNumber.from(requiredAmount).sub(token.balance);
          const collateralType = i < 2 ? config.collateralToken1 : config.collateralToken2;
          const collateralSymbol = i < 2 ? config.collateralToken1Symbol : config.collateralToken2Symbol;
          
          tokenSplitNeeded.push({
            index: i,
            symbol: token.symbol,
            address: token.address,
            balance: token.balance,
            formattedBalance: token.formattedBalance,
            requiredAmount,
            amountNeeded,
            formattedAmountNeeded: ethers.utils.formatEther(amountNeeded),
            collateralType,
            collateralSymbol
          });
        }
      }
      
      // If any tokens need splitting, ask user if they want to proceed
      if (tokenSplitNeeded.length > 0) {
        printInfo('\nYou need to split tokens to have enough for liquidity:');
        
        // Group by collateral type for splitting
        const collateralNeeded = new Map();
        
        // If any tokens need splitting, ask user if they want to proceed
        if (tokenSplitNeeded.length > 0) {
          printInfo('\nYou need to split tokens to have enough for liquidity:');
          
          // Group tokens by YES/NO and then by collateral to find the max needed per pair
          const collateralPairs = {};
          
          for (const tokenInfo of tokenSplitNeeded) {
            console.log(`  ${tokenInfo.token.symbol}: ${balances[tokenInfo.token.address].formattedBalance} available, need ${ethers.utils.formatEther(tokenInfo.amountNeeded)} more`);
            
            // Check if it's a YES or NO token
            const isYesToken = tokenInfo.token.symbol.toLowerCase().includes('yes');
            const isNoToken = tokenInfo.token.symbol.toLowerCase().includes('no');
            const baseTokenType = isYesToken ? 'yes' : (isNoToken ? 'no' : 'unknown');
            
            // Create a key for the collateral type
            const collateralKey = tokenInfo.collateralType;
            
            // Initialize if needed
            if (!collateralPairs[collateralKey]) {
              collateralPairs[collateralKey] = {
                yes: ethers.BigNumber.from(0),
                no: ethers.BigNumber.from(0),
                symbol: tokenInfo.collateralSymbol
              };
            }
            
            // Update the amount needed for this YES/NO token
            if (baseTokenType === 'yes') {
              collateralPairs[collateralKey].yes = ethers.BigNumber.from(
                collateralPairs[collateralKey].yes.gt(tokenInfo.amountNeeded) ? 
                collateralPairs[collateralKey].yes : tokenInfo.amountNeeded
              );
            } else if (baseTokenType === 'no') {
              collateralPairs[collateralKey].no = ethers.BigNumber.from(
                collateralPairs[collateralKey].no.gt(tokenInfo.amountNeeded) ? 
                collateralPairs[collateralKey].no : tokenInfo.amountNeeded
              );
            }
          }
          
          // Calculate the maximum between YES and NO for each collateral
          for (const [collateralType, amounts] of Object.entries(collateralPairs)) {
            // When you split tokens, you get both YES and NO, so use the maximum needed
            const maxAmount = amounts.yes.gt(amounts.no) ? amounts.yes : amounts.no;
            collateralNeeded.set(collateralType, maxAmount);
          }
          
          // Show total by collateral type
          console.log('\nTotal collateral needed for splitting:');
          for (const [collateralType, amount] of collateralNeeded.entries()) {
            const symbol = collateralPairs[collateralType]?.symbol || 'TOKEN';
            console.log(`  ${symbol}: ${ethers.utils.formatEther(amount)} (exact: ${amount.toString()})`);
          }
        }
        
        const shouldSplit = await askQuestion('\nDo you want to split these tokens now? (y/n): ');
        
        if (shouldSplit.toLowerCase() === 'y') {
          // Create router contract
          const routerAddress = process.env.FUTARCHY_ROUTER;
          const routerContract = new ethers.Contract(
            routerAddress,
            FUTARCHY_ROUTER_ABI,
            signer
          );
          
          // Check token allowances and approve if needed
          for (const [collateralType, amount] of collateralNeeded.entries()) {
            const collateralContract = new ethers.Contract(
              collateralType,
              ERC20_ABI,
              signer
            );
            
            const symbol = tokenSplitNeeded.find(t => t.collateralType === collateralType)?.collateralSymbol || 'TOKEN';
            const allowance = await collateralContract.allowance(userAddress, routerAddress);
            
            if (allowance.lt(amount)) {
              printInfo(`Approving ${symbol} for Futarchy Router...`);
              
              const shouldApprove = await askQuestion(`Approve ${symbol} for splitting? (y/n): `);
              if (shouldApprove.toLowerCase() !== 'y') {
                printError('Cannot proceed without approval.');
                return;
              }
              
              // Approve unlimited amount
              const approveTx = await collateralContract.approve(
                routerAddress, 
                ethers.constants.MaxUint256
              );
              
              printInfo(`Approval transaction sent: ${approveTx.hash}`);
              printInfo(`View on explorer: https://gnosisscan.io/tx/${approveTx.hash}`);
              
              printInfo('Waiting for approval confirmation...');
              await approveTx.wait(1);
              printSuccess(`${symbol} approved for Futarchy Router`);
            } else {
              printSuccess(`${symbol} already approved for Futarchy Router`);
            }
            
            // Split the tokens
            printInfo(`Splitting ${ethers.utils.formatEther(amount)} ${symbol}...`);
            
            // Remove the gas estimation code and use a fixed high gas limit instead
            // with EIP-1559 transaction parameters like in futarchy.js
            const splitTx = await routerContract.splitPosition(
              config.proposalAddress,
              collateralType,
              amount,
              {
                gasLimit: 2000000, // High fixed gas limit
                type: 2, // EIP-1559 transaction
                maxFeePerGas: ethers.utils.parseUnits("1.5", "gwei"),
                maxPriorityFeePerGas: ethers.utils.parseUnits("1", "gwei")
              }
            );
            
            printInfo(`Split transaction sent: ${splitTx.hash}`);
            printInfo(`View on explorer: https://gnosisscan.io/tx/${splitTx.hash}`);
            
            printInfo('Waiting for split confirmation...');
            await splitTx.wait(1);
            printSuccess(`Successfully split ${ethers.utils.formatEther(amount)} ${symbol}`);
          }
          
          // Update token balances after splitting
          printInfo('\nUpdated token balances after splitting:');
          for (const token of config.outcomeTokensWithBalances) {
            const tokenContract = new ethers.Contract(token.address, ERC20_ABI, provider);
            const balance = await tokenContract.balanceOf(userAddress);
            const formattedBalance = ethers.utils.formatUnits(balance, 18); // Assuming 18 decimals
            
            console.log(`  ${token.symbol}: ${formattedBalance}`);
            
            // Update balance in our data structure
            token.balance = balance;
            token.formattedBalance = formattedBalance;
          }
        } else {
          printInfo('Token splitting skipped. You may not have enough tokens to add the requested liquidity.');
          
          const continueAnyway = await askQuestion('Continue with liquidity addition anyway? (y/n): ');
          if (continueAnyway.toLowerCase() !== 'y') {
            printInfo('Liquidity addition cancelled.');
            return;
          }
          
          printInfo('Continuing with available tokens...');
        }
      } else {
        printSuccess('You have enough tokens to add the requested liquidity. No splitting needed.');
      }
    }
    
    // Final confirmation
    const confirmFinal = await askQuestion('Proceed with liquidity addition? (y/n): ');
    if (confirmFinal.toLowerCase() !== 'y') {
      printInfo('Liquidity addition cancelled.');
      return;
    }
    
    // Create the pools and add liquidity
    try {
      console.log('\nDEBUG - Starting pool creation process');
      console.log('Using liquidityProvider to create pools from config');
      
      const result = await liquidityProvider.createPoolsFromConfig(configPath);
      
      if (result.success) {
        printSuccess('\nAll liquidity pools have been successfully created!');
        printInfo('The prediction markets are now ready for trading.');
        
        // List created pools
        console.log('\n' + colors.yellow + '--- Created Pools ---' + colors.reset);
        result.results.forEach((pool, index) => {
          if (pool.success) {
            console.log(`${index + 1}. ${pool.token0.symbol}/${pool.token1.symbol}: ${pool.pairAddress}`);
            console.log(`   View on explorer: https://gnosisscan.io/address/${pool.pairAddress}`);
          }
        });
        
        // New message about returning to main menu
        console.log('\n' + colors.yellow + '--- Next Steps ---' + colors.reset);
        console.log('Liquidity addition complete! The tool will now return to the main menu.');
        console.log('Your prediction markets are now ready for trading and participation.');
        
        // Return to main menu after a short delay without closing the readline interface
        setTimeout(() => {
          showMainMenu();
        }, 1000);
      } else {
        printError('\nSome or all pools failed to be created.');
        console.log('DEBUG - Result from createPoolsFromConfig:', JSON.stringify(result, null, 2));
        
        // Log each pool result
        if (result.results && result.results.length > 0) {
          console.log('DEBUG - Detailed pool results:');
          result.results.forEach((poolResult, index) => {
            console.log(`Pool ${index + 1}:`, JSON.stringify(poolResult, null, 2));
          });
        }
        
        printInfo('You can try again later by selecting "Add liquidity to existing proposal" from the main menu.');
        
        // Return to main menu after a short delay without closing the readline interface
        setTimeout(() => {
          showMainMenu();
        }, 1000);
      }
    } catch (error) {
      printError('\nError during pool creation process:');
      console.error('DEBUG - Full error object:', error);
      console.error('DEBUG - Error message:', error.message);
      console.error('DEBUG - Error stack:', error.stack);
      
      if (error.code) {
        console.error('DEBUG - Error code:', error.code);
      }
      
      if (error.reason) {
        console.error('DEBUG - Error reason:', error.reason);
      }
      
      if (error.data) {
        console.error('DEBUG - Error data:', error.data);
      }
      
      if (error.transaction) {
        console.error('DEBUG - Transaction hash:', error.transaction.hash);
      }
      
      printError('Pool creation failed. Please check the error details above.');
      
      // Return to main menu after a short delay without closing the readline interface
      setTimeout(() => {
        showMainMenu();
      }, 1000);
    }
  } catch (error) {
    printError(`Error adding liquidity: ${error.message}`);
    console.error('DEBUG - Full error in addV2LiquidityInteractive:', error);
    console.error('DEBUG - Error stack:', error.stack);
    
    // Return to main menu after a short delay without closing the readline interface
    setTimeout(() => {
      showMainMenu();
    }, 1000);
  }
};

/**
 * Interactive V3 liquidity addition process for SushiSwap V3 pools
 * @param {string} configPath - Path to the proposal configuration file or address
 * @param {Object} options - Provider and signer
 */
const addV3LiquidityInteractive = async (configPathOrAddress, { provider, signer }) => {
  try {
    printHeader('ADDING V3 LIQUIDITY TO PROPOSAL');
    printInfo(`Using proposal at: ${configPathOrAddress}`);
    
    // Log environment variables for debugging
    console.log('DEBUG - V3 Environment variables:');
    console.log('NONFUNGIBLE_POSITION_MANAGER:', process.env.NONFUNGIBLE_POSITION_MANAGER);
    console.log('SUSHI_V3_FACTORY:', process.env.SUSHI_V3_FACTORY);
    
    // Define required environment variables for V3
    const requiredEnvVars = [
      'NONFUNGIBLE_POSITION_MANAGER',
      'SUSHI_V3_FACTORY',
      'FUTARCHY_ROUTER'
    ];
    
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
      printError('Missing required environment variables for V3 pools: ' + missingVars.join(', '));
      printInfo('Please set these in your .env file to use V3 liquidity pools.');
      
      // Return to main menu
      setTimeout(() => {
        showMainMenu();
      }, 1000);
      return;
    }
    
    // Load or fetch the configuration
    let config;
    let isAddress = false;
    
    // Check if the input is an Ethereum address
    if (isValidAddress(configPathOrAddress)) {
      isAddress = true;
      printInfo(`Using proposal contract at address: ${configPathOrAddress}`);
      
      // Create a contract instance for the proposal
      const proposalContract = new ethers.Contract(
        configPathOrAddress,
        FUTARCHY_PROPOSAL_ABI,
        provider
      );
      
      // Get information from the proposal contract
      try {
        printInfo('Fetching proposal information from contract...');
        
        const [
          name,
          encodedQuestionData,
          collateralToken1,
          collateralToken2,
          numOutcomes
        ] = await Promise.all([
          proposalContract.marketName(),
          proposalContract.encodedQuestion(),
          proposalContract.collateralToken1(),
          proposalContract.collateralToken2(),
          proposalContract.numOutcomes()
        ]);
        
        // Parse encoded question if needed
        let question = encodedQuestionData;
        if (encodedQuestionData.includes('␟')) {
          const parts = encodedQuestionData.split('␟');
          question = parts[0]; // Use the title part as the question
        }
        
        // Get collateral token symbols
        const collateralToken1Contract = new ethers.Contract(collateralToken1, ERC20_ABI, provider);
        const collateralToken2Contract = new ethers.Contract(collateralToken2, ERC20_ABI, provider);
        
        const [
          collateralToken1Symbol,
          collateralToken2Symbol
        ] = await Promise.all([
          collateralToken1Contract.symbol(),
          collateralToken2Contract.symbol()
        ]);
        
        // Get outcome tokens and their symbols
        const outcomeTokens = [];
        for (let i = 0; i < numOutcomes.toNumber(); i++) {
          const tokenAddress = await proposalContract.wrappedOutcome(i);
          const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
          
          try {
            const symbol = await tokenContract.symbol();
            outcomeTokens.push({
              index: i,
              address: tokenAddress,
              symbol: symbol
            });
          } catch (error) {
            // If symbol() fails, use a generic name
            outcomeTokens.push({
              index: i,
              address: tokenAddress,
              symbol: `Outcome ${i}`
            });
          }
        }
        
        printInfo(`Found proposal: "${name}"`);
        printInfo(`Question: "${question}"`);
        printInfo(`Collateral tokens: ${collateralToken1Symbol} (${collateralToken1}), ${collateralToken2Symbol} (${collateralToken2})`);
        printInfo(`Number of outcome tokens: ${numOutcomes.toString()}`);
        
        // Display outcome tokens with their symbols
        printInfo(`Outcome tokens:`);
        outcomeTokens.forEach(token => {
          console.log(`  ${token.index}: ${token.symbol} (${token.address})`);
        });
        
        // Build configuration object from contract data
        config = {
          name,
          question,
          proposalAddress: configPathOrAddress,
          collateralToken1,
          collateralToken2,
          collateralToken1Symbol,
          collateralToken2Symbol,
          outcomeTokens
        };
      } catch (error) {
        printError(`Error fetching proposal information: ${error.message}`);
        
        // Check if this is a valid proposal contract
        try {
          await proposalContract.collateralToken1();
        } catch {
          printError('This does not appear to be a valid Futarchy proposal contract.');
          printInfo('The address should be a Futarchy proposal contract with methods like collateralToken1(), numOutcomes(), etc.');
          
          // Return to main menu
          setTimeout(() => {
            showMainMenu();
          }, 1000);
          return;
        }
        
        throw error;
      }
    } else {
      // Treat as a configuration file path
      // Validate that the file exists
      if (!fs.existsSync(configPathOrAddress)) {
        printError(`Configuration file not found: ${configPathOrAddress}`);
        
        // Return to main menu
        setTimeout(() => {
          showMainMenu();
        }, 1000);
        return;
      }
      
      // Load the configuration
      try {
        config = JSON.parse(fs.readFileSync(configPathOrAddress, 'utf8'));
        printInfo(`Loaded configuration from file: ${configPathOrAddress}`);
      } catch (error) {
        printError(`Error loading configuration file: ${error.message}`);
        
        // Return to main menu
        setTimeout(() => {
          showMainMenu();
        }, 1000);
        return;
      }
    }
    
    // Check if we have a proposal address
    if (!config.proposalAddress) {
      printError('Proposal address is missing in the configuration.');
      
      // Return to main menu
      setTimeout(() => {
        showMainMenu();
      }, 1000);
      return;
    }
    
    // Show V3 pool information
    printHeader('V3 LIQUIDITY CONFIGURATION');
    printInfo('V3 pools require different parameters than V2 pools:');
    printInfo('First, we need to determine which token will be the "currency" token.');
    console.log('The "currency" token will be used for pricing the outcome tokens in the main liquidity pools.');
    console.log('The other token will be the "company" token, which will be paired with the currency outcome tokens.');
    
    // Ask user to choose which token is the currency token
    const currencyChoice = await askQuestion(`Which token should be used as the currency token? (1 = ${config.collateralToken1Symbol}, 2 = ${config.collateralToken2Symbol}): `);
    const currencyIsToken1 = currencyChoice === '1' || currencyChoice.toLowerCase() === config.collateralToken1Symbol.toLowerCase();
    
    const currencyToken = currencyIsToken1 ? config.collateralToken1 : config.collateralToken2;
    const currencyTokenSymbol = currencyIsToken1 ? config.collateralToken1Symbol : config.collateralToken2Symbol;
    const companyToken = currencyIsToken1 ? config.collateralToken2 : config.collateralToken1;
    const companyTokenSymbol = currencyIsToken1 ? config.collateralToken2Symbol : config.collateralToken1Symbol;
    
    printSuccess(`Selected ${currencyTokenSymbol} as the currency token and ${companyTokenSymbol} as the company token.`);
    
    // Dynamically determine which outcome tokens correspond to currency and company
    // For tokens 0/1 = YES/NO of token1, tokens 2/3 = YES/NO of token2
    const yesCurrencyToken = currencyIsToken1 
      ? config.outcomeTokens.find(t => t.index === 0) 
      : config.outcomeTokens.find(t => t.index === 2);
    
    const noCurrencyToken = currencyIsToken1 
      ? config.outcomeTokens.find(t => t.index === 1) 
      : config.outcomeTokens.find(t => t.index === 3);
    
    const yesCompanyToken = currencyIsToken1 
      ? config.outcomeTokens.find(t => t.index === 2) 
      : config.outcomeTokens.find(t => t.index === 0);
    
    const noCompanyToken = currencyIsToken1 
      ? config.outcomeTokens.find(t => t.index === 3) 
      : config.outcomeTokens.find(t => t.index === 1);
    
    printInfo('\nThese pools will be created:');
    console.log(`1. ${yesCurrencyToken.symbol}/${currencyTokenSymbol} - Pool between YES outcome token and ${currencyTokenSymbol}`);
    console.log(`2. ${noCurrencyToken.symbol}/${currencyTokenSymbol} - Pool between NO outcome token and ${currencyTokenSymbol}`);
    console.log(`3. ${yesCompanyToken.symbol}/${yesCurrencyToken.symbol} - Pool between YES outcome tokens`);
    console.log(`4. ${noCompanyToken.symbol}/${noCurrencyToken.symbol} - Pool between NO outcome tokens`);
    
    // Get user address
    const userAddress = await signer.getAddress();
    
    // Check token balances
    printInfo('\nChecking token balances...');
    let balances = {};
    
    for (const token of config.outcomeTokens) {
      const tokenContract = new ethers.Contract(token.address, ERC20_ABI, provider);
      const balance = await tokenContract.balanceOf(userAddress);
      const decimals = await tokenContract.decimals();
      const formattedBalance = ethers.utils.formatUnits(balance, decimals);
      
      balances[token.address] = {
        balance,
        formattedBalance,
        address: token.address,
        symbol: token.symbol,
        index: token.index
      };
      
      console.log(`  ${token.symbol}: ${formattedBalance}`);
    }
    
    // Also check the currency token balance
    const currencyTokenContract = new ethers.Contract(currencyToken, ERC20_ABI, provider);
    const currencyTokenBalance = await currencyTokenContract.balanceOf(userAddress);
    const currencyTokenDecimals = await currencyTokenContract.decimals();
    const formattedCurrencyTokenBalance = ethers.utils.formatUnits(currencyTokenBalance, currencyTokenDecimals);
    
    balances[currencyToken] = {
      balance: currencyTokenBalance,
      formattedBalance: formattedCurrencyTokenBalance,
      address: currencyToken,
      symbol: currencyTokenSymbol
    };
    
    console.log(`  ${currencyTokenSymbol}: ${formattedCurrencyTokenBalance}`);
    
    // Check if token splitting is needed
    let tokenSplitNeeded = [];
    
    // Configure V3 pool parameters
    printInfo('\nConfigure V3 pool parameters:');
    
    // Fee tier - 0.01% = 100, 0.05% = 500, 0.3% = 3000, 1% = 10000
    let feeTier = parseInt(await askQuestion('Fee tier (100=0.01%, 500=0.05%, 3000=0.3%, 10000=1%, default: 500): ') || '500');
    
    // Tick range for concentrated liquidity
    // Price = 1.0001^tick, so ticks of ±1000 is roughly ±10% price range
    let tickRange = parseInt(await askQuestion('Tick range around current price (default: 1000, about ±10%): ') || '1000');
    let tickLower = -tickRange;
    let tickUpper = tickRange;
    
    // Configure amounts for each pool
    printHeader(`POOL 1: ${yesCurrencyToken.symbol}/${currencyTokenSymbol}`);
    let yesCurrencyAmount = await askQuestion(`Amount of ${yesCurrencyToken.symbol} (default: 1.0): `);
    yesCurrencyAmount = yesCurrencyAmount ? ethers.utils.parseEther(yesCurrencyAmount) : ethers.utils.parseEther('1.0');
    
    let currencyForYesPool = await askQuestion(`Amount of ${currencyTokenSymbol} (default: 1.0): `);
    currencyForYesPool = currencyForYesPool ? ethers.utils.parseEther(currencyForYesPool) : ethers.utils.parseEther('1.0');
    
    // Check if we need to split tokens for YES_Currency
    if (balances[yesCurrencyToken.address].balance.lt(yesCurrencyAmount)) {
      const amountNeeded = yesCurrencyAmount.sub(balances[yesCurrencyToken.address].balance);
      tokenSplitNeeded.push({
        token: yesCurrencyToken,
        amountNeeded,
        formattedAmountNeeded: ethers.utils.formatEther(amountNeeded),
        collateralType: currencyToken,
        collateralSymbol: currencyTokenSymbol
      });
    }
    
    printHeader(`POOL 2: ${noCurrencyToken.symbol}/${currencyTokenSymbol}`);
    let noCurrencyAmount = await askQuestion(`Amount of ${noCurrencyToken.symbol} (default: 1.0): `);
    noCurrencyAmount = noCurrencyAmount ? ethers.utils.parseEther(noCurrencyAmount) : ethers.utils.parseEther('1.0');
    
    let currencyForNoPool = await askQuestion(`Amount of ${currencyTokenSymbol} (default: 1.0): `);
    currencyForNoPool = currencyForNoPool ? ethers.utils.parseEther(currencyForNoPool) : ethers.utils.parseEther('1.0');
    
    // Check if we need to split tokens for NO_Currency
    if (balances[noCurrencyToken.address].balance.lt(noCurrencyAmount)) {
      const amountNeeded = noCurrencyAmount.sub(balances[noCurrencyToken.address].balance);
      tokenSplitNeeded.push({
        token: noCurrencyToken,
        amountNeeded,
        formattedAmountNeeded: ethers.utils.formatEther(amountNeeded),
        collateralType: currencyToken,
        collateralSymbol: currencyTokenSymbol
      });
    }
    
    printHeader(`POOL 3: ${yesCompanyToken.symbol}/${yesCurrencyToken.symbol}`);
    let yesCompanyAmount = await askQuestion(`Amount of ${yesCompanyToken.symbol} (default: 1.0): `);
    yesCompanyAmount = yesCompanyAmount ? ethers.utils.parseEther(yesCompanyAmount) : ethers.utils.parseEther('1.0');
    
    let yesCurrencyForCrossPool = await askQuestion(`Amount of ${yesCurrencyToken.symbol} (default: 1.0): `);
    yesCurrencyForCrossPool = yesCurrencyForCrossPool ? ethers.utils.parseEther(yesCurrencyForCrossPool) : ethers.utils.parseEther('1.0');
    
    // Check if we need to split tokens for YES_Company
    if (balances[yesCompanyToken.address].balance.lt(yesCompanyAmount)) {
      const amountNeeded = yesCompanyAmount.sub(balances[yesCompanyToken.address].balance);
      tokenSplitNeeded.push({
        token: yesCompanyToken,
        amountNeeded,
        formattedAmountNeeded: ethers.utils.formatEther(amountNeeded),
        collateralType: companyToken,
        collateralSymbol: companyTokenSymbol
      });
    }
    
    printHeader(`POOL 4: ${noCompanyToken.symbol}/${noCurrencyToken.symbol}`);
    let noCompanyAmount = await askQuestion(`Amount of ${noCompanyToken.symbol} (default: 1.0): `);
    noCompanyAmount = noCompanyAmount ? ethers.utils.parseEther(noCompanyAmount) : ethers.utils.parseEther('1.0');
    
    let noCurrencyForCrossPool = await askQuestion(`Amount of ${noCurrencyToken.symbol} (default: 1.0): `);
    noCurrencyForCrossPool = noCurrencyForCrossPool ? ethers.utils.parseEther(noCurrencyForCrossPool) : ethers.utils.parseEther('1.0');
    
    // Check if we need to split tokens for NO_Company
    if (balances[noCompanyToken.address].balance.lt(noCompanyAmount)) {
      const amountNeeded = noCompanyAmount.sub(balances[noCompanyToken.address].balance);
      tokenSplitNeeded.push({
        token: noCompanyToken,
        amountNeeded,
        formattedAmountNeeded: ethers.utils.formatEther(amountNeeded),
        collateralType: companyToken,
        collateralSymbol: companyTokenSymbol
      });
    }
    
    // Total additional YES_Currency needed for both pools
    const totalYesCurrencyNeeded = yesCurrencyAmount.add(yesCurrencyForCrossPool);
    if (balances[yesCurrencyToken.address].balance.lt(totalYesCurrencyNeeded)) {
      // Update the existing entry if there is one
      const existingIndex = tokenSplitNeeded.findIndex(
        item => item.token.address === yesCurrencyToken.address
      );
      
      const amountNeeded = totalYesCurrencyNeeded.sub(balances[yesCurrencyToken.address].balance);
      
      if (existingIndex >= 0) {
        tokenSplitNeeded[existingIndex].amountNeeded = amountNeeded;
        tokenSplitNeeded[existingIndex].formattedAmountNeeded = ethers.utils.formatEther(amountNeeded);
      } else {
        tokenSplitNeeded.push({
          token: yesCurrencyToken,
          amountNeeded,
          formattedAmountNeeded: ethers.utils.formatEther(amountNeeded),
          collateralType: currencyToken,
          collateralSymbol: currencyTokenSymbol
        });
      }
    }
    
    // Total additional NO_Currency needed for both pools
    const totalNoCurrencyNeeded = noCurrencyAmount.add(noCurrencyForCrossPool);
    if (balances[noCurrencyToken.address].balance.lt(totalNoCurrencyNeeded)) {
      // Update the existing entry if there is one
      const existingIndex = tokenSplitNeeded.findIndex(
        item => item.token.address === noCurrencyToken.address
      );
      
      const amountNeeded = totalNoCurrencyNeeded.sub(balances[noCurrencyToken.address].balance);
      
      if (existingIndex >= 0) {
        tokenSplitNeeded[existingIndex].amountNeeded = amountNeeded;
        tokenSplitNeeded[existingIndex].formattedAmountNeeded = ethers.utils.formatEther(amountNeeded);
      } else {
        tokenSplitNeeded.push({
          token: noCurrencyToken,
          amountNeeded,
          formattedAmountNeeded: ethers.utils.formatEther(amountNeeded),
          collateralType: currencyToken,
          collateralSymbol: currencyTokenSymbol
        });
      }
    }
    
    // Group by collateral type for splitting
    const collateralNeeded = new Map();
    
    // If any tokens need splitting, ask user if they want to proceed
    if (tokenSplitNeeded.length > 0) {
      printInfo('\nYou need to split tokens to have enough for liquidity:');
      
      // First, log all tokens that need to be split
      for (const tokenInfo of tokenSplitNeeded) {
        console.log(`  ${tokenInfo.token.symbol}: ${balances[tokenInfo.token.address].formattedBalance} available, need ${ethers.utils.formatEther(tokenInfo.amountNeeded)} more`);
      }
      
      // Now calculate collateralNeeded using max instead of sum
      // Create a map to track YES and NO amounts by collateral type
      const yesByCollateral = new Map();
      const noByCollateral = new Map();
      
      // Group tokens by YES/NO and collateral type
      for (const tokenInfo of tokenSplitNeeded) {
        const collateralType = tokenInfo.collateralType;
        const isYes = tokenInfo.token.symbol.toLowerCase().includes('yes');
        const isNo = tokenInfo.token.symbol.toLowerCase().includes('no');
        
        if (isYes) {
          // Track max YES amount for this collateral
          const currentMax = yesByCollateral.get(collateralType) || ethers.BigNumber.from(0);
          if (tokenInfo.amountNeeded.gt(currentMax)) {
            yesByCollateral.set(collateralType, tokenInfo.amountNeeded);
          }
        } else if (isNo) {
          // Track max NO amount for this collateral
          const currentMax = noByCollateral.get(collateralType) || ethers.BigNumber.from(0);
          if (tokenInfo.amountNeeded.gt(currentMax)) {
            noByCollateral.set(collateralType, tokenInfo.amountNeeded);
          }
        }
      }
      
      // For each collateral type, use the max between YES and NO
      const allCollateralTypes = new Set([...yesByCollateral.keys(), ...noByCollateral.keys()]);
      for (const collateralType of allCollateralTypes) {
        const yesAmount = yesByCollateral.get(collateralType) || ethers.BigNumber.from(0);
        const noAmount = noByCollateral.get(collateralType) || ethers.BigNumber.from(0);
        
        // Use the maximum of YES and NO amounts
        const maxAmount = yesAmount.gt(noAmount) ? yesAmount : noAmount;
        collateralNeeded.set(collateralType, maxAmount);
      }
      
      // Show total by collateral type
      console.log('\nTotal collateral needed for splitting:');
      for (const [collateralType, amount] of collateralNeeded.entries()) {
        const symbol = tokenSplitNeeded.find(t => t.collateralType === collateralType)?.collateralSymbol || 'TOKEN';
        console.log(`  ${symbol}: ${ethers.utils.formatEther(amount)} (exact: ${amount.toString()})`);
      }
      
      const shouldSplit = await askQuestion('\nDo you want to split these tokens now? (y/n): ');
      
      if (shouldSplit.toLowerCase() === 'y') {
        // Create router contract
        const routerAddress = process.env.FUTARCHY_ROUTER;
        const routerContract = new ethers.Contract(
          routerAddress,
          FUTARCHY_ROUTER_ABI,
          signer
        );
        
        // Check token allowances and approve if needed
        for (const [collateralType, amount] of collateralNeeded.entries()) {
          const collateralContract = new ethers.Contract(
            collateralType,
            ERC20_ABI,
            signer
          );
          
          const symbol = tokenSplitNeeded.find(t => t.collateralType === collateralType)?.collateralSymbol || 'TOKEN';
          const allowance = await collateralContract.allowance(userAddress, routerAddress);
          
          if (allowance.lt(amount)) {
            printInfo(`Approving ${symbol} for Futarchy Router...`);
            
            const shouldApprove = await askQuestion(`Approve ${symbol} for splitting? (y/n): `);
            if (shouldApprove.toLowerCase() !== 'y') {
              printError('Cannot proceed without approval.');
              return;
            }
            
            // Approve unlimited amount
            const approveTx = await collateralContract.approve(
              routerAddress, 
              ethers.constants.MaxUint256
            );
            
            printInfo(`Approval transaction sent: ${approveTx.hash}`);
            printInfo(`View on explorer: https://gnosisscan.io/tx/${approveTx.hash}`);
            
            printInfo('Waiting for approval confirmation...');
            await approveTx.wait(1);
            printSuccess(`${symbol} approved for Futarchy Router`);
          } else {
            printSuccess(`${symbol} already approved for Futarchy Router`);
          }
          
          // Split the tokens
          printInfo(`Splitting ${ethers.utils.formatEther(amount)} ${symbol}...`);
          
          // Remove the gas estimation code and use a fixed high gas limit instead
          // with EIP-1559 transaction parameters like in futarchy.js
          const splitTx = await routerContract.splitPosition(
            config.proposalAddress,
            collateralType,
            amount,
            {
              gasLimit: 2000000, // High fixed gas limit
              type: 2, // EIP-1559 transaction
              maxFeePerGas: ethers.utils.parseUnits("1.5", "gwei"),
              maxPriorityFeePerGas: ethers.utils.parseUnits("1", "gwei")
            }
          );
          
          printInfo(`Split transaction sent: ${splitTx.hash}`);
          printInfo(`View on explorer: https://gnosisscan.io/tx/${splitTx.hash}`);
          
          printInfo('Waiting for split confirmation...');
          await splitTx.wait(1);
          printSuccess(`Successfully split ${ethers.utils.formatEther(amount)} ${symbol}`);
        }
        
        // Update token balances after splitting
        printInfo('\nUpdated token balances after splitting:');
        for (const token of config.outcomeTokens) {
          const tokenContract = new ethers.Contract(token.address, ERC20_ABI, provider);
          const balance = await tokenContract.balanceOf(userAddress);
          const formattedBalance = ethers.utils.formatUnits(balance, 18); // Assuming 18 decimals
          
          console.log(`  ${token.symbol}: ${formattedBalance}`);
          
          // Update balance in our data structure
          balances[token.address].balance = balance;
          balances[token.address].formattedBalance = formattedBalance;
        }
      } else {
        printInfo('Token splitting skipped. You may not have enough tokens for all V3 pools.');
        
        const continueAnyway = await askQuestion('Continue with liquidity addition anyway? (y/n): ');
        if (continueAnyway.toLowerCase() !== 'y') {
          printInfo('Liquidity addition cancelled.');
          
          // Return to main menu
          setTimeout(() => {
            showMainMenu();
          }, 1000);
          return;
        }
        
        printInfo('Continuing with available tokens...');
      }
    }
    
    // Approve tokens for the Nonfungible Position Manager
    const positionManagerAddress = process.env.NONFUNGIBLE_POSITION_MANAGER;
    
    printInfo('\nApproving tokens for the Nonfungible Position Manager...');
    printInfo(`Position Manager Address: ${positionManagerAddress}`);
    
    // Function to approve a token if needed
    const approveToken = async (tokenAddress, tokenSymbol, amount) => {
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
      const allowance = await tokenContract.allowance(userAddress, positionManagerAddress);
      
      if (allowance.lt(amount)) {
        printInfo(`Approving ${tokenSymbol} for Position Manager...`);
        
        const shouldApprove = await askQuestion(`Approve ${tokenSymbol}? (y/n): `);
        if (shouldApprove.toLowerCase() !== 'y') {
          printError(`Cannot proceed without ${tokenSymbol} approval.`);
          return false;
        }
        
        // Approve unlimited amount
        const approveTx = await tokenContract.approve(
          positionManagerAddress, 
          ethers.constants.MaxUint256
        );
        
        printInfo(`Approval transaction sent: ${approveTx.hash}`);
        printInfo(`View on explorer: https://gnosisscan.io/tx/${approveTx.hash}`);
        
        printInfo('Waiting for approval confirmation...');
        await approveTx.wait(1);
        printSuccess(`${tokenSymbol} approved for Position Manager`);
      } else {
        printSuccess(`${tokenSymbol} already approved for Position Manager`);
      }
      
      return true;
    };
    
    // Approve tokens one by one (not in parallel)
    const tokensToApprove = [
      { address: yesCurrencyToken.address, symbol: yesCurrencyToken.symbol, amount: totalYesCurrencyNeeded },
      { address: noCurrencyToken.address, symbol: noCurrencyToken.symbol, amount: totalNoCurrencyNeeded },
      { address: yesCompanyToken.address, symbol: yesCompanyToken.symbol, amount: yesCompanyAmount },
      { address: noCompanyToken.address, symbol: noCompanyToken.symbol, amount: noCompanyAmount },
      { address: currencyToken, symbol: currencyTokenSymbol, amount: currencyForYesPool.add(currencyForNoPool) }
    ];
    
    let allApprovalsSuccessful = true;
    for (const token of tokensToApprove) {
      const approved = await approveToken(token.address, token.symbol, token.amount);
      if (!approved) {
        allApprovalsSuccessful = false;
        break;
      }
    }
    
    // If any approval failed, return to main menu
    if (!allApprovalsSuccessful) {
      printError('Not all tokens were approved. Returning to main menu.');
      
      // Return to main menu
      setTimeout(() => {
        showMainMenu();
      }, 1000);
      return;
    }
    
    // Final confirmation before creating pools
    const confirmFinal = await askQuestion('\nProceed with V3 liquidity pool creation? (y/n): ');
    if (confirmFinal.toLowerCase() !== 'y') {
      printInfo('V3 liquidity addition cancelled.');
      
      // Return to main menu
      setTimeout(() => {
        showMainMenu();
      }, 1000);
      return;
    }
    
    // Create the Position Manager contract with expanded ABI and explicit parameter names
    const positionManagerABI = [
      "function createAndInitializePoolIfNecessary(address token0, address token1, uint24 fee, uint160 sqrtPriceX96) external payable returns (address pool)",
      "function mint(tuple(address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline)) external payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)"
    ];
    
    const positionManager = new ethers.Contract(
      positionManagerAddress,
      positionManagerABI,
      signer
    );
    
    // Initial sqrt price for 1:1 ratio (2^96)
    const SQRT_PRICE_X96 = "79228162514264337593543950336";
    
    // Function to create a pool and add liquidity
    const createV3Pool = async (token0, token1, token0Symbol, token1Symbol, amount0, amount1) => {
      try {
        printInfo(`Creating pool for ${token0Symbol}/${token1Symbol}...`);
        printInfo(`Token0 Address: ${token0}`);
        printInfo(`Token1 Address: ${token1}`);
        
        // Ensure token0 < token1 as required by the protocol
        let sortedToken0 = token0;
        let sortedToken1 = token1;
        let sortedAmount0 = amount0;
        let sortedAmount1 = amount1;
        let sortedSymbol0 = token0Symbol;
        let sortedSymbol1 = token1Symbol;
        
        if (ethers.BigNumber.from(token0).gt(ethers.BigNumber.from(token1))) {
          // Swap tokens to ensure correct order
          sortedToken0 = token1;
          sortedToken1 = token0;
          sortedAmount0 = amount1;
          sortedAmount1 = amount0;
          sortedSymbol0 = token1Symbol;
          sortedSymbol1 = token0Symbol;
          
          printInfo(`Tokens swapped for protocol ordering: ${sortedSymbol0}/${sortedSymbol1}`);
          printInfo(`Sorted Token0 Address: ${sortedToken0}`);
          printInfo(`Sorted Token1 Address: ${sortedToken1}`);
        }
        
        // Initialize the pool
        printInfo('Initializing pool...');
        printInfo(`Fee tier: ${feeTier}`);
        printInfo(`SQRT_PRICE_X96: ${SQRT_PRICE_X96}`);
        
        const poolTx = await positionManager.createAndInitializePoolIfNecessary(
          sortedToken0,
          sortedToken1,
          feeTier,
          SQRT_PRICE_X96,
          {
            gasLimit: 6000000 // Increased gas limit to prevent "Out of gas" errors
          }
        );
        
        printInfo(`Pool initialization transaction sent: ${poolTx.hash}`);
        printInfo(`View on explorer: https://gnosisscan.io/tx/${poolTx.hash}`);
        
        printInfo('Waiting for pool initialization...');
        const poolReceipt = await poolTx.wait(1);
        
        // This is a simplification - we should parse events to get the pool address
        printSuccess(`Pool initialized! Transaction confirmed.`);
        
        // Add liquidity by minting a position
        printInfo('Adding liquidity to the pool...');
        
        // Create mint params object
        const mintParams = {
          token0: sortedToken0,
          token1: sortedToken1,
          fee: feeTier,
          tickLower: tickLower,
          tickUpper: tickUpper,
          amount0Desired: sortedAmount0,
          amount1Desired: sortedAmount1,
          amount0Min: 0, // No slippage protection for simplicity
          amount1Min: 0, // No slippage protection for simplicity
          recipient: userAddress,
          deadline: Math.floor(Date.now() / 1000) + 600 // 10 minutes
        };
        
        // Debug log all mint parameters
        printInfo('Mint parameters:');
        Object.entries(mintParams).forEach(([key, value]) => {
          if (typeof value === 'object' && value._isBigNumber) {
            printInfo(`  ${key}: ${value.toString()}`);
          } else {
            printInfo(`  ${key}: ${value}`);
          }
        });
        
        // For ethers.js v5, we need to pass the params as an array for a struct
        const mintTx = await positionManager.mint(
          [
            sortedToken0,
            sortedToken1,
            feeTier,
            tickLower,
            tickUpper,
            sortedAmount0,
            sortedAmount1,
            0, // amount0Min
            0, // amount1Min
            userAddress,
            Math.floor(Date.now() / 1000) + 600 // deadline
          ],
          {
            gasLimit: 6000000 // Increased gas limit to prevent "Out of gas" errors
          }
        );
        
        printInfo(`Liquidity addition transaction sent: ${mintTx.hash}`);
        printInfo(`View on explorer: https://gnosisscan.io/tx/${mintTx.hash}`);
        
        printInfo('Waiting for liquidity addition...');
        const mintReceipt = await mintTx.wait(1);
        
        // Parse events to get details (simplified)
        printSuccess(`Successfully added liquidity to ${sortedSymbol0}/${sortedSymbol1} pool!`);
        
        return {
          success: true,
          token0: { address: sortedToken0, symbol: sortedSymbol0 },
          token1: { address: sortedToken1, symbol: sortedSymbol1 },
          txHash: mintTx.hash
        };
      } catch (error) {
        // Enhanced error logging
        printError(`Failed to create ${token0Symbol}/${token1Symbol} pool: ${error.message}`);
        printInfo('Error details:');
        if (error.reason) printInfo(`  Reason: ${error.reason}`);
        if (error.code) printInfo(`  Code: ${error.code}`);
        if (error.argument) printInfo(`  Argument: ${error.argument}`);
        if (error.value) printInfo(`  Value: ${error.value}`);
        if (error.transaction) printInfo(`  Transaction: ${error.transaction.hash}`);
        console.error('Full error:', error);
        
        return {
          success: false,
          token0: { address: token0, symbol: token0Symbol },
          token1: { address: token1, symbol: token1Symbol },
          error: error.message
        };
      }
    };
    
    // Create all V3 pools
    printHeader('CREATING V3 LIQUIDITY POOLS');
    
    // Define our 4 pools
    const poolConfigs = [
      {
        name: `${yesCurrencyToken.symbol}/${currencyTokenSymbol}`,
        token0: yesCurrencyToken.address,
        token1: currencyToken,
        token0Symbol: yesCurrencyToken.symbol,
        token1Symbol: currencyTokenSymbol,
        amount0: yesCurrencyAmount,
        amount1: currencyForYesPool
      },
      {
        name: `${noCurrencyToken.symbol}/${currencyTokenSymbol}`,
        token0: noCurrencyToken.address,
        token1: currencyToken,
        token0Symbol: noCurrencyToken.symbol,
        token1Symbol: currencyTokenSymbol,
        amount0: noCurrencyAmount,
        amount1: currencyForNoPool
      },
      {
        name: `${yesCompanyToken.symbol}/${yesCurrencyToken.symbol}`,
        token0: yesCompanyToken.address,
        token1: yesCurrencyToken.address,
        token0Symbol: yesCompanyToken.symbol,
        token1Symbol: yesCurrencyToken.symbol,
        amount0: yesCompanyAmount,
        amount1: yesCurrencyForCrossPool
      },
      {
        name: `${noCompanyToken.symbol}/${noCurrencyToken.symbol}`,
        token0: noCompanyToken.address,
        token1: noCurrencyToken.address,
        token0Symbol: noCompanyToken.symbol,
        token1Symbol: noCurrencyToken.symbol,
        amount0: noCompanyAmount,
        amount1: noCurrencyForCrossPool
      }
    ];
    
    // Create each pool one by one
    const results = [];
    
    for (const poolConfig of poolConfigs) {
      printInfo(`\nProcessing pool: ${poolConfig.name}`);
      
      try {
        const result = await createV3Pool(
          poolConfig.token0,
          poolConfig.token1,
          poolConfig.token0Symbol,
          poolConfig.token1Symbol,
          poolConfig.amount0,
          poolConfig.amount1
        );
        
        results.push(result);
        
        if (result.success) {
          printSuccess(`Successfully created ${poolConfig.name} pool!`);
        } else {
          printInfo(`ℹ Issue with ${poolConfig.name} pool: ${result.error}`);
        }
      } catch (error) {
        printInfo(`ℹ Error with ${poolConfig.name} pool: ${error.message}`);
        results.push({
          success: false,
          name: poolConfig.name,
          error: error.message
        });
      }
    }
    
    // Final summary
    printHeader('V3 LIQUIDITY ADDITION SUMMARY');
    
    const successCount = results.filter(r => r.success).length;
    
    if (successCount === poolConfigs.length) {
      printSuccess('All V3 liquidity pools were successfully created!');
    } else {
      printInfo(`${successCount} out of ${poolConfigs.length} V3 pools were created successfully.`);
    }
    
    // List created pools
    console.log('\n' + colors.yellow + '--- Created V3 Pools ---' + colors.reset);
    results.forEach((pool, index) => {
      if (pool.success) {
        console.log(`${index + 1}. ${pool.token0.symbol}/${pool.token1.symbol}`);
        console.log(`   View transaction: https://gnosisscan.io/tx/${pool.txHash}`);
      } else {
        console.log(`${index + 1}. ${poolConfigs[index].name} - Failed: ${pool.error || 'Unknown error'}`);
      }
    });
    
    // Next steps
    console.log('\n' + colors.yellow + '--- Next Steps ---' + colors.reset);
    console.log('V3 liquidity addition complete! The tool will now return to the main menu.');
    console.log('Your prediction markets are now ready for trading with V3 concentrated liquidity.');
    
    // Return to main menu
    setTimeout(() => {
      showMainMenu();
    }, 1000);
  } catch (error) {
    printError(`Error adding V3 liquidity: ${error.message}`);
    console.error('DEBUG - Full error in addV3LiquidityInteractive:', error);
    console.error('DEBUG - Error stack:', error.stack);
    
    // Return to main menu
    setTimeout(() => {
      showMainMenu();
    }, 1000);
  }
};

/**
 * Function to add liquidity to an existing proposal
 * @param {string} liquidityType - Type of liquidity to add ('v2' or 'v3')
 */
const addLiquidityToProposal = async (liquidityType = 'v2') => {
  try {
    let configPathOrAddress;
    const isV3 = liquidityType === 'v3';
    
    if (isV3) {
      printHeader('ADD V3 LIQUIDITY TO EXISTING PROPOSAL');
    } else {
      printHeader('ADD V2 LIQUIDITY TO EXISTING PROPOSAL');
    }
    
    // Change default option to proposal address (option 1)
    configPathOrAddress = await askQuestion('Enter the proposal address (or leave empty to use most recently created proposal): ');
    
    // If empty, try to find the most recent config file
    if (!configPathOrAddress) {
      printInfo('Looking for most recently created proposal configuration...');
      
      // Get list of proposal config files
      const configFiles = fs.readdirSync('.')
        .filter(file => file.startsWith('proposal_config_') && file.endsWith('.json'))
        .sort()
        .reverse(); // Most recent first
      
      if (configFiles.length > 0) {
        const latestConfig = configFiles[0];
        try {
          const config = JSON.parse(fs.readFileSync(latestConfig, 'utf8'));
          if (config.proposalAddress) {
            configPathOrAddress = config.proposalAddress;
            printSuccess(`Using most recent proposal at address: ${configPathOrAddress}`);
            printInfo(`(From config file: ${latestConfig})`);
          } else {
            printError('Most recent proposal config does not contain a proposal address.');
            setTimeout(() => {
              showMainMenu();
            }, 1000);
            return;
          }
        } catch (error) {
          printError(`Error reading latest config file: ${error.message}`);
          setTimeout(() => {
            showMainMenu();
          }, 1000);
          return;
        }
      } else {
        printError('No proposal configuration files found. Please enter a proposal address.');
        setTimeout(() => {
          showMainMenu();
        }, 1000);
        return;
      }
    }
    
    // Setup provider and signer
    const { provider, signer } = setupProviderAndSigner();
    
    // For V3 liquidity, skip the V2 configuration and directly call addV3LiquidityInteractive
    if (isV3) {
      if (isValidAddress(configPathOrAddress)) {
        // If it's an address, directly use it for V3 liquidity
        await addV3LiquidityInteractive(configPathOrAddress, { provider, signer });
        return;
      } else {
        // If it's a config file, validate it exists then use it
        if (!fs.existsSync(configPathOrAddress)) {
          printError(`Configuration file not found: ${configPathOrAddress}`);
          setTimeout(() => {
            showMainMenu();
          }, 1000);
          return;
        }
        
        // Run the interactive V3 liquidity addition with the config file
        await addV3LiquidityInteractive(configPathOrAddress, { provider, signer });
        return;
      }
    }
    
    // The rest of this function is for V2 liquidity only
    let config;
    let isAddress = false;
    
    // Check if the input is an Ethereum address
    if (isValidAddress(configPathOrAddress)) {
      isAddress = true;
      printInfo(`Using proposal contract at address: ${configPathOrAddress}`);
      
      // Create a contract instance for the proposal
      const proposalContract = new ethers.Contract(
        configPathOrAddress,
        FUTARCHY_PROPOSAL_ABI,
        provider
      );
      
      // Define ERC20 ABI for symbol and name functions
      const ERC20_ABI = [
        "function symbol() view returns (string)",
        "function name() view returns (string)",
        "function decimals() view returns (uint8)"
      ];
      
      // Get information from the proposal contract
      try {
        printInfo('Fetching proposal information from contract...');
        
        const [
          name,
          encodedQuestionData,
          collateralToken1,
          collateralToken2,
          numOutcomes
        ] = await Promise.all([
          proposalContract.marketName(),
          proposalContract.encodedQuestion(),
          proposalContract.collateralToken1(),
          proposalContract.collateralToken2(),
          proposalContract.numOutcomes()
        ]);
        
        // Parse encoded question if needed
        // Format is typically: "Title␟"Yes","No"␟category␟language"
        let question = encodedQuestionData;
        if (encodedQuestionData.includes('␟')) {
          const parts = encodedQuestionData.split('␟');
          question = parts[0]; // Use the title part as the question
        }
        
        // Get collateral token symbols
        const collateralToken1Contract = new ethers.Contract(collateralToken1, ERC20_ABI, provider);
        const collateralToken2Contract = new ethers.Contract(collateralToken2, ERC20_ABI, provider);
        
        const [
          collateralToken1Symbol,
          collateralToken2Symbol
        ] = await Promise.all([
          collateralToken1Contract.symbol(),
          collateralToken2Contract.symbol()
        ]);
        
        // Get outcome tokens and their symbols
        const outcomeTokens = [];
        for (let i = 0; i < numOutcomes.toNumber(); i++) {
          const tokenAddress = await proposalContract.wrappedOutcome(i);
          const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
          
          try {
            const symbol = await tokenContract.symbol();
            outcomeTokens.push({
              index: i,
              address: tokenAddress,
              symbol: symbol
            });
          } catch (error) {
            // If symbol() fails, use a generic name
            outcomeTokens.push({
              index: i,
              address: tokenAddress,
              symbol: `Outcome ${i}`
            });
          }
        }
        
        printInfo(`Found proposal: "${name}"`);
        printInfo(`Question: "${question}"`);
        printInfo(`Collateral tokens: ${collateralToken1Symbol} (${collateralToken1}), ${collateralToken2Symbol} (${collateralToken2})`);
        printInfo(`Number of outcome tokens: ${numOutcomes.toString()}`);
        
        // Display outcome tokens with their symbols
        printInfo(`Outcome tokens:`);
        outcomeTokens.forEach(token => {
          console.log(`  ${token.index}: ${token.symbol} (${token.address})`);
        });
        
        // Build configuration object from contract data
        config = {
          name,
          question,
          proposalAddress: configPathOrAddress,
          collateralToken1,
          collateralToken2,
          collateralToken1Symbol,
          collateralToken2Symbol,
          outcomeTokens,
          liquidity: {
            wxdaiAmount: process.env.DEFAULT_WXDAI_AMOUNT || ethers.utils.parseEther('1.0').toString(),
            token1Amount: process.env.DEFAULT_TOKEN1_AMOUNT || ethers.utils.parseEther('1.0').toString(),
            token2Amount: process.env.DEFAULT_TOKEN2_AMOUNT || ethers.utils.parseEther('1.0').toString()
          }
        };
      } catch (error) {
        printError(`Error fetching proposal information: ${error.message}`);
        
        // Check if this is a valid proposal contract
        try {
          await proposalContract.collateralToken1();
        } catch {
          printError('This does not appear to be a valid Futarchy proposal contract.');
          printInfo('The address should be a Futarchy proposal contract with methods like collateralToken1(), numOutcomes(), etc.');
          return;
        }
        
        throw error;
      }
    } else {
      // Treat as a configuration file path
      // Validate that the file exists
      if (!fs.existsSync(configPathOrAddress)) {
        printError(`Configuration file not found: ${configPathOrAddress}`);
        return;
      }
      
      // Load the configuration
      try {
        config = JSON.parse(fs.readFileSync(configPathOrAddress, 'utf8'));
        printInfo(`Loaded configuration from file: ${configPathOrAddress}`);
      } catch (error) {
        printError(`Error loading configuration file: ${error.message}`);
        return;
      }
    }
    
    // Check if we have a proposal address
    if (!config.proposalAddress) {
      printError('Proposal address is missing in the configuration.');
      return;
    }
    
    // V2-specific configuration - This section only runs for V2 liquidity
    if (isAddress) {
      printHeader('V2 LIQUIDITY CONFIGURATION');
      printInfo('Specify the amounts of tokens to add as liquidity for each pool:');
      
      // Now use the actual token symbols for the outcome tokens
      // We'll ask for an amount for each token pair we'll create
      
      // First pair: WXDAI <> YES_TOKEN1
      const yesToken1Symbol = config.outcomeTokens.find(t => t.index === 0)?.symbol || 'YES_Token1';
      console.log('\n' + colors.cyan + `Pool 1: WXDAI <> ${yesToken1Symbol}` + colors.reset);
      let yesToken1WxdaiAmount = await askQuestion(`WXDAI amount for ${yesToken1Symbol} pool (default: 1.0): `);
      yesToken1WxdaiAmount = yesToken1WxdaiAmount ? ethers.utils.parseEther(yesToken1WxdaiAmount).toString() : config.liquidity.wxdaiAmount;
      
      let yesToken1Amount = await askQuestion(`${yesToken1Symbol} amount (default: 1.0): `);
      yesToken1Amount = yesToken1Amount ? ethers.utils.parseEther(yesToken1Amount).toString() : config.liquidity.token1Amount;
      
      // Calculate and display ratio
      const yesToken1Ratio = ethers.utils.formatEther(yesToken1WxdaiAmount) / ethers.utils.formatEther(yesToken1Amount);
      const yesToken1Price = 1 / yesToken1Ratio;
      console.log(colors.yellow + `  Initial price: 1 ${yesToken1Symbol} = ${yesToken1Ratio.toFixed(4)} WXDAI` + colors.reset);
      console.log(colors.yellow + `  Initial price: 1 WXDAI = ${yesToken1Price.toFixed(4)} ${yesToken1Symbol}` + colors.reset);
      
      // Second pair: WXDAI <> NO_TOKEN1
      const noToken1Symbol = config.outcomeTokens.find(t => t.index === 1)?.symbol || 'NO_Token1';
      console.log('\n' + colors.cyan + `Pool 2: WXDAI <> ${noToken1Symbol}` + colors.reset);
      let noToken1WxdaiAmount = await askQuestion(`WXDAI amount for ${noToken1Symbol} pool (default: 1.0): `);
      noToken1WxdaiAmount = noToken1WxdaiAmount ? ethers.utils.parseEther(noToken1WxdaiAmount).toString() : config.liquidity.wxdaiAmount;
      
      let noToken1Amount = await askQuestion(`${noToken1Symbol} amount (default: 1.0): `);
      noToken1Amount = noToken1Amount ? ethers.utils.parseEther(noToken1Amount).toString() : config.liquidity.token1Amount;
      
      // Calculate and display ratio
      const noToken1Ratio = ethers.utils.formatEther(noToken1WxdaiAmount) / ethers.utils.formatEther(noToken1Amount);
      const noToken1Price = 1 / noToken1Ratio;
      console.log(colors.yellow + `  Initial price: 1 ${noToken1Symbol} = ${noToken1Ratio.toFixed(4)} WXDAI` + colors.reset);
      console.log(colors.yellow + `  Initial price: 1 WXDAI = ${noToken1Price.toFixed(4)} ${noToken1Symbol}` + colors.reset);
      
      // Implied probability based on YES and NO prices
      const impliedProb = yesToken1Price / (yesToken1Price + noToken1Price);
      console.log(colors.green + `  Implied probability: ${(impliedProb * 100).toFixed(2)}%` + colors.reset);
      
      // Add GNO token pools if available
      let yesToken2WxdaiAmount = config.liquidity.wxdaiAmount;
      let yesToken2Amount = config.liquidity.token2Amount;
      let noToken2WxdaiAmount = config.liquidity.wxdaiAmount;
      let noToken2Amount = config.liquidity.token2Amount;
      let yesToken2Symbol = '';
      let noToken2Symbol = '';
      let yesToken2Ratio = 0;
      let noToken2Ratio = 0;
      
      if (config.outcomeTokens.length >= 4) {
        // Third pair: WXDAI <> YES_TOKEN2 (usually YES_GNO)
        yesToken2Symbol = config.outcomeTokens.find(t => t.index === 2)?.symbol || 'YES_Token2';
        console.log('\n' + colors.cyan + `Pool 3: WXDAI <> ${yesToken2Symbol}` + colors.reset);
        const yesToken2WxdaiInput = await askQuestion(`WXDAI amount for ${yesToken2Symbol} pool (default: 1.0): `);
        yesToken2WxdaiAmount = yesToken2WxdaiInput ? ethers.utils.parseEther(yesToken2WxdaiInput).toString() : config.liquidity.wxdaiAmount;
        
        const yesToken2AmountInput = await askQuestion(`${yesToken2Symbol} amount (default: 1.0): `);
        yesToken2Amount = yesToken2AmountInput ? ethers.utils.parseEther(yesToken2AmountInput).toString() : config.liquidity.token2Amount;
        
        // Calculate and display ratio
        yesToken2Ratio = ethers.utils.formatEther(yesToken2WxdaiAmount) / ethers.utils.formatEther(yesToken2Amount);
        const yesToken2Price = 1 / yesToken2Ratio;
        console.log(colors.yellow + `  Initial price: 1 ${yesToken2Symbol} = ${yesToken2Ratio.toFixed(4)} WXDAI` + colors.reset);
        console.log(colors.yellow + `  Initial price: 1 WXDAI = ${yesToken2Price.toFixed(4)} ${yesToken2Symbol}` + colors.reset);
        
        // Fourth pair: WXDAI <> NO_TOKEN2 (usually NO_GNO)
        noToken2Symbol = config.outcomeTokens.find(t => t.index === 3)?.symbol || 'NO_Token2';
        console.log('\n' + colors.cyan + `Pool 4: WXDAI <> ${noToken2Symbol}` + colors.reset);
        const noToken2WxdaiInput = await askQuestion(`WXDAI amount for ${noToken2Symbol} pool (default: 1.0): `);
        noToken2WxdaiAmount = noToken2WxdaiInput ? ethers.utils.parseEther(noToken2WxdaiInput).toString() : config.liquidity.wxdaiAmount;
        
        const noToken2AmountInput = await askQuestion(`${noToken2Symbol} amount (default: 1.0): `);
        noToken2Amount = noToken2AmountInput ? ethers.utils.parseEther(noToken2AmountInput).toString() : config.liquidity.token2Amount;
        
        // Calculate and display ratio
        noToken2Ratio = ethers.utils.formatEther(noToken2WxdaiAmount) / ethers.utils.formatEther(noToken2Amount);
        const noToken2Price = 1 / noToken2Ratio;
        console.log(colors.yellow + `  Initial price: 1 ${noToken2Symbol} = ${noToken2Ratio.toFixed(4)} WXDAI` + colors.reset);
        console.log(colors.yellow + `  Initial price: 1 WXDAI = ${noToken2Price.toFixed(4)} ${noToken2Symbol}` + colors.reset);
        
        // Implied probability for token2
        const impliedProbToken2 = yesToken2Price / (yesToken2Price + noToken2Price);
        console.log(colors.green + `  Implied probability: ${(impliedProbToken2 * 100).toFixed(2)}%` + colors.reset);
      }
      
      // Summary of all configured pools
      console.log('\n' + colors.yellow + '--- Pool Configuration Summary ---' + colors.reset);
      console.log(`Pool 1: ${ethers.utils.formatEther(yesToken1WxdaiAmount)} WXDAI <> ${ethers.utils.formatEther(yesToken1Amount)} ${yesToken1Symbol} (Ratio: ${yesToken1Ratio.toFixed(4)})`);
      console.log(`Pool 2: ${ethers.utils.formatEther(noToken1WxdaiAmount)} WXDAI <> ${ethers.utils.formatEther(noToken1Amount)} ${noToken1Symbol} (Ratio: ${noToken1Ratio.toFixed(4)})`);
      
      if (config.outcomeTokens.length >= 4) {
        console.log(`Pool 3: ${ethers.utils.formatEther(yesToken2WxdaiAmount)} WXDAI <> ${ethers.utils.formatEther(yesToken2Amount)} ${yesToken2Symbol} (Ratio: ${yesToken2Ratio.toFixed(4)})`);
        console.log(`Pool 4: ${ethers.utils.formatEther(noToken2WxdaiAmount)} WXDAI <> ${ethers.utils.formatEther(noToken2Amount)} ${noToken2Symbol} (Ratio: ${noToken2Ratio.toFixed(4)})`);
      }
      
      // Update config with all token amounts, using the new pool-specific WXDAI amounts
      config.liquidity = {
        // Keep wxdaiAmount for backward compatibility, using the maximum WXDAI amount
        wxdaiAmount: findMaxBigNumber([
          ethers.BigNumber.from(yesToken1WxdaiAmount),
          ethers.BigNumber.from(noToken1WxdaiAmount),
          ethers.BigNumber.from(yesToken2WxdaiAmount),
          ethers.BigNumber.from(noToken2WxdaiAmount)
        ]).toString(),
        // Store outcome token amounts
        outcomeTokenAmounts: config.outcomeTokens.length >= 4 ? 
          [yesToken1Amount, noToken1Amount, yesToken2Amount, noToken2Amount] :
          [yesToken1Amount, noToken1Amount],
        // Add new property for pool-specific WXDAI amounts
        wxdaiAmountsPerPool: config.outcomeTokens.length >= 4 ?
          [yesToken1WxdaiAmount, noToken1WxdaiAmount, yesToken2WxdaiAmount, noToken2WxdaiAmount] :
          [yesToken1WxdaiAmount, noToken1WxdaiAmount]
      };
      
      // If we're using address input, save the config to a temporary file
      const tempConfigPath = `proposal_config_${Math.floor(Date.now() / 1000)}.json`;
      fs.writeFileSync(tempConfigPath, JSON.stringify(config, null, 2));
      printInfo(`Saved configuration to temporary file: ${tempConfigPath}`);
      configPathOrAddress = tempConfigPath;
      
      // Run the interactive V2 liquidity addition
      await addV2LiquidityInteractive(configPathOrAddress, { provider, signer });
    } else {
      // For config files, we'll still ask which method to use as before
      printInfo(`\nChoose a method to add liquidity:`);
      console.log('1. Interactive JavaScript (recommended for most users)');
      console.log('2. Run Forge script (requires Foundry to be installed)');
      
      const method = await askQuestion('\nSelect a method (1-2): ');
      
      if (method === '1') {
        // Run the interactive liquidity addition
        await addV2LiquidityInteractive(configPathOrAddress, { provider, signer });
      } else if (method === '2') {
        // Check if forge is installed
        try {
          await executeCommand('forge --version');
        } catch (error) {
          printError('Forge CLI not found. Please install Foundry to continue.');
          printInfo('Installation instructions: https://book.getfoundry.sh/getting-started/installation');
          return;
        }
        
        // Run the script with the configuration file
        printInfo('Running FutarchyProposalLiquidity.s.sol script to add liquidity...');
        
        const command = `forge script script/proposal/FutarchyProposalLiquidity.s.sol:FutarchyProposalLiquidity --sig "run(string)" "${configPathOrAddress}" --rpc-url ${process.env.RPC_URL} --broadcast --private-key ${process.env.PRIVATE_KEY}`;
        
        printInfo('Executing command:');
        console.log(command.replace(process.env.PRIVATE_KEY, '********'));
        
        try {
          const result = await executeCommand(command);
          console.log(result);
          printSuccess('Liquidity added successfully!');
        } catch (error) {
          printError('Failed to add liquidity:');
          console.error(error.message);
        }
      } else {
        printError('Invalid option selected.');
      }
    }
  } catch (error) {
    printError(`Error: ${error.message}`);
    
    // Return to main menu after an error
    setTimeout(() => {
      showMainMenu();
    }, 1000);
  }
};

/**
 * Creates a sample proposal configuration file
 */
const createSampleConfig = async () => {
  printHeader('CREATE SAMPLE PROPOSAL CONFIGURATION');
  
  const sampleConfig = getSampleProposalConfig();
  const filename = 'sample_proposal_config.json';
  
  fs.writeFileSync(filename, JSON.stringify(sampleConfig, null, 2));
  
  printSuccess(`Sample configuration saved to ${filename}`);
  
  console.log('\nThis sample configuration includes:');
  console.log('- Basic proposal parameters');
  console.log('- Default token addresses for Gnosis Chain');
  console.log('- Standard liquidity settings');
  console.log('\nYou can use this as a template for creating your own proposals.');
  
  setTimeout(() => {
    showMainMenu();
  }, 1000);
};

/**
 * Main menu for the application
 */
const showMainMenu = async () => {
  printHeader('FUTARCHY PROPOSAL TERMINAL');
  
  console.log('1. Create a new proposal');
  console.log('2. Add V2 liquidity to existing proposal');
  console.log('3. Add V3 liquidity to existing proposal');
  console.log('4. Create sample configuration file');
  console.log('5. Exit');
  
  const choice = await askQuestion('\nSelect an option (1-5): ');
  
  switch (choice) {
    case '1':
      await createProposal();
      break;
    case '2':
      await addLiquidityToProposal('v2');
      break;
    case '3':
      await addLiquidityToProposal('v3');
      break;
    case '4':
      await createSampleConfig();
      break;
    case '5':
      printInfo('Exiting...');
      rl.close();
      break;
    default:
      console.log(colors.red + 'Invalid option. Please try again.' + colors.reset);
      await showMainMenu();
  }
};

// Parse command line arguments for direct function calls
const args = process.argv.slice(2);
if (args.length > 0) {
  const command = args[0];
  
  if (command === 'create') {
    createProposal().catch(error => {
      printError(`Unexpected error: ${error.message}`);
      rl.close();
    });
  } else if (command === 'addLiquidity' || command === 'addV2Liquidity') {
    const configPath = args[1];
    addLiquidityToProposal('v2', configPath).catch(error => {
      printError(`Unexpected error: ${error.message}`);
      rl.close();
    });
  } else if (command === 'addV3Liquidity') {
    const configPath = args[1];
    addLiquidityToProposal('v3', configPath).catch(error => {
      printError(`Unexpected error: ${error.message}`);
      rl.close();
    });
  } else {
    showMainMenu().catch(error => {
      printError(`Unexpected error: ${error.message}`);
      rl.close();
    });
  }
} else {
  // No command line arguments, show the main menu
  showMainMenu().catch(error => {
    printError(`Unexpected error: ${error.message}`);
    rl.close();
  });
} 