#!/usr/bin/env node

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Check for chain selection from command line
const args = process.argv.slice(2);
const chainArg = args.find(arg => arg.startsWith('--chain='));
if (chainArg) {
  const chainId = chainArg.split('=')[1];
  process.env.CHAIN_ID = chainId;
  console.log(`\n🔗 Using chain ${chainId}`);
}

// Load modules that are chain/AMM-agnostic here; AMM/chain-dependent modules
// are required dynamically inside setupModules() to pick up updated constants.
const PriceCalculator = require('./utils/priceCalculations');
const TransactionLogger = require('./utils/transactionLogger');

// Load environment variables
dotenv.config();

class FutarchyCLI {
  constructor() {
    // Prefer chain RPC when chain selected via CLI
    this.useChainRpc = !!chainArg;
    this.setupProvider();
    this.setupModules();
  }

  setupProvider() {
    // Setup provider and wallet
    const constants = require('./contracts/constants');
    // When a chain is explicitly selected (via --chain or config.chainId),
    // prefer the chain's configured RPC and ignore environment overrides
    const rpcUrl = this.useChainRpc
      ? constants.NETWORK.CHAIN_RPC_URL
      : (process.env.RPC_URL || constants.NETWORK.RPC_URL);
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    
    if (!process.env.PRIVATE_KEY) {
      console.error('❌ PRIVATE_KEY not found in environment variables');
      console.error('Please create a .env file with your private key');
      process.exit(1);
    }
    
    this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
    console.log(`\n🔑 Wallet: ${this.wallet.address}`);
    console.log(`🌐 Network: ${constants.NETWORK.NAME} (Chain ID: ${constants.NETWORK.CHAIN_ID})`);
    console.log(`⚙️  AMM: ${constants.SELECTED_AMM}`);
    console.log(`📡 RPC: ${rpcUrl}`);
    console.log(`🏭 Contracts:`);
    console.log(`   Factory: ${constants.FUTARCHY_FACTORY}`);
    console.log(`   Position Manager: ${constants.POSITION_MANAGER}`);
  }

  setupModules() {
    // Initialize all modules (require dynamically to reflect latest constants)
    const TokenManager = require('./utils/tokens');
    const PoolManager = require('./modules/poolManager');
    const FutarchyAdapter = require('./modules/futarchyAdapter');
    const ProposalCreator = require('./modules/proposalCreator');
    const LiquidityOrchestrator = require('./modules/liquidityOrchestrator');

    this.tokenManager = new TokenManager(this.provider, this.wallet);
    this.priceCalculator = PriceCalculator; // Static class
    // Preserve logger across re-inits so we don't lose earlier entries
    this.transactionLogger = this.transactionLogger || new TransactionLogger();
    this.poolManager = new PoolManager(this.wallet, this.tokenManager, this.priceCalculator);
    this.futarchyAdapter = new FutarchyAdapter(this.wallet, this.tokenManager);
    this.proposalCreator = new ProposalCreator(this.wallet);
    
    this.orchestrator = new LiquidityOrchestrator({
      tokenManager: this.tokenManager,
      poolManager: this.poolManager,
      futarchyAdapter: this.futarchyAdapter,
      proposalCreator: this.proposalCreator,
      priceCalculator: this.priceCalculator,
      transactionLogger: this.transactionLogger,
      wallet: this.wallet
    });
  }

  async loadConfig(configPath) {
    try {
      const configFile = fs.readFileSync(path.resolve(configPath), 'utf8');
      const config = JSON.parse(configFile);
      
      // If config has chainId and no --chain flag was provided, use config's chainId
      if (config.chainId && !process.argv.some(arg => arg.startsWith('--chain='))) {
        process.env.CHAIN_ID = config.chainId.toString();
        
        // Reload constants with new chain
        delete require.cache[require.resolve('./contracts/constants')];
        const newConstants = require('./contracts/constants');
        
        console.log(`\n🔗 Using chain ${config.chainId} from config file`);
        console.log(`🌐 Network: ${newConstants.NETWORK.NAME}`);

        // Purge module caches that bind constants and rebuild provider + modules
        ;['./utils/tokens','./modules/poolManager','./modules/futarchyAdapter','./modules/proposalCreator','./modules/liquidityOrchestrator']
          .forEach(m => { try { delete require.cache[require.resolve(m)]; } catch {} });
        if (this.orchestrator) {
          try { this.orchestrator.close(); } catch {}
        }
        // When chain is selected by config, prefer chain RPC over env
        this.useChainRpc = true;
        this.setupProvider();
        this.setupModules();
      }

      // If config has amm, apply it (e.g., 'swapr' or 'uniswap')
      if (config.amm && typeof config.amm === 'string') {
        process.env.AMM = config.amm.toLowerCase();
        // Reload constants to reflect AMM change (keeps current chain)
        delete require.cache[require.resolve('./contracts/constants')];
        const newConstants2 = require('./contracts/constants');
        console.log(`\n⚙️  Using AMM: ${newConstants2.SELECTED_AMM}`);
        console.log(`   Position Manager: ${newConstants2.POSITION_MANAGER}`);
        console.log(`   Swap Router: ${newConstants2.SWAP_ROUTER || 'N/A'}`);

        // Purge dependent caches and re-init modules so new AMM ABIs/addresses take effect
        ;['./utils/tokens','./modules/poolManager','./modules/futarchyAdapter','./modules/proposalCreator','./modules/liquidityOrchestrator']
          .forEach(m => { try { delete require.cache[require.resolve(m)]; } catch {} });
        if (this.orchestrator) {
          try { this.orchestrator.close(); } catch {}
        }
        this.setupModules();
      }
      
      return config;
    } catch (error) {
      console.error(`❌ Error loading config file: ${error.message}`);
      process.exit(1);
    }
  }

  async createProposal(configOrPath = null) {
    let config;
    
    if (typeof configOrPath === 'string') {
      // It's a path, load the config
      config = await this.loadConfig(configOrPath);
    } else if (configOrPath && typeof configOrPath === 'object') {
      // It's already a config object
      config = configOrPath;
    } else {
      // Interactive mode
      const marketName = await this.orchestrator.ask('Enter market name: ');
      const companyToken = await this.orchestrator.ask(
        `Company token address [${constants.DEFAULT_COMPANY_SYMBOL}: ${constants.DEFAULT_COMPANY_TOKEN}]: `,
        constants.DEFAULT_COMPANY_TOKEN
      );
      const currencyToken = await this.orchestrator.ask(
        `Currency token address [${constants.DEFAULT_CURRENCY_SYMBOL}: ${constants.DEFAULT_CURRENCY_TOKEN}]: `,
        constants.DEFAULT_CURRENCY_TOKEN
      );
      
      config = {
        marketName,
        companyTokenAddress: companyToken,
        currencyTokenAddress: currencyToken
      };
    }

    // Map config properties to what proposalCreator expects
    const proposalConfig = {
      marketName: config.marketName,
      companyTokenAddress: config.companyToken?.address || config.companyTokenAddress,
      currencyTokenAddress: config.currencyToken?.address || config.currencyTokenAddress,
      openingTime: config.openingTime,
      category: config.category, // Use category from config if provided
      language: config.language  // Use language from config if provided
    };

    const result = await this.proposalCreator.createProposal(proposalConfig);
    
    // Log transaction
    this.transactionLogger.log(
      'Create Proposal',
      result.transactionHash,
      {
        proposalAddress: result.proposalAddress,
        marketName: result.marketName
      }
    );

    console.log('\n✅ Proposal Created Successfully!');
    console.log(`Address: ${result.proposalAddress}`);
    
    return result.proposalAddress;
  }

  async setupPools(configPath, mode = 'manual') {
    const config = await this.loadConfig(configPath);
    
    if (!config.proposalAddress) {
      console.log('\n📝 No proposal address found in config.');
      
      if (mode === 'automatic') {
        // In automatic mode, create without asking
        console.log('🤖 AUTO MODE: Creating new proposal...');
        config.proposalAddress = await this.createProposal(config);
      } else {
        // In other modes, ask first
        const create = await this.orchestrator.ask('Create new proposal? (Y/n): ', 'Y');
        
        if (create.toLowerCase() === 'y') {
          config.proposalAddress = await this.createProposal(config);
        } else {
          console.error('❌ Proposal address required');
          process.exit(1);
        }
      }
    }

    console.log(`\n🚀 Setting up pools for proposal: ${config.proposalAddress}`);
    console.log(`Mode: ${mode}`);
    // Show AMM + fee tier summary after loading config
    try {
      const amm = (require('./contracts/constants').SELECTED_AMM || 'swapr').toLowerCase();
      if (amm === 'uniswap') {
        const tier = config.feeTier || 3000;
        console.log(`AMM: Uniswap V3  |  Fee Tier: ${tier}`);
      } else {
        console.log(`AMM: Swapr/Algebra V3`);
      }
    } catch {}
    
    const results = await this.orchestrator.setupFutarchyPools(config, mode);
    
    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('SETUP COMPLETE');
    console.log('='.repeat(60));
    
    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;
    
    results.forEach(result => {
      if (result.skipped) {
        skipCount++;
        console.log(`Pool ${result.poolNumber}: SKIPPED`);
      } else if (result.success) {
        successCount++;
        console.log(`Pool ${result.poolNumber}: ✅ SUCCESS (${result.poolAddress})`);
      } else {
        failCount++;
        console.log(`Pool ${result.poolNumber}: ❌ FAILED`);
      }
    });
    
    console.log(`\nSummary: ${successCount} success, ${skipCount} skipped, ${failCount} failed`);
    
    // Export transactions with comprehensive data
    this.transactionLogger.printSummary();
    const exportPath = this.transactionLogger.exportToJSON(null, {
      wallet: this.wallet.address,
      proposal: {
        address: config.proposalAddress,
        marketName: config.marketName
      },
      marketName: config.marketName,
      spotPrice: config.spotPrice,
      eventProbability: config.eventProbability,
      impact: config.impact,
      liquidityAmounts: config.liquidityAmounts
    });
    
    // Also export CSV for easy viewing
    this.transactionLogger.exportToCSV();
  }

  async addLiquidity(token0, token1, amount0, amount1) {
    const constants = require('./contracts/constants');
    console.log('\n💧 Adding Liquidity');
    console.log(`Token0: ${token0}`);
    console.log(`Token1: ${token1}`);
    
    // Parse amounts
    const token0Info = await this.tokenManager.loadToken(token0);
    const token1Info = await this.tokenManager.loadToken(token1);
    
    const amount0Wei = ethers.parseUnits(amount0, token0Info.decimals);
    const amount1Wei = ethers.parseUnits(amount1, token1Info.decimals);
    
    // Ensure allowances
    await this.tokenManager.ensureAllowance(
      token0,
      constants.POSITION_MANAGER,
      amount0Wei,
      'Position Manager'
    );
    await this.tokenManager.ensureAllowance(
      token1,
      constants.POSITION_MANAGER,
      amount1Wei,
      'Position Manager'
    );
    
    // Add liquidity
    const result = await this.poolManager.createPoolAndAddLiquidity({
      token0Address: token0,
      token1Address: token1,
      amount0: amount0Wei,
      amount1: amount1Wei
    });
    
    // Log transaction
    this.transactionLogger.log(
      'Add Liquidity',
      result.transactionHash,
      {
        poolAddress: result.poolAddress,
        token0,
        token1,
        amount0: amount0Wei.toString(),
        amount1: amount1Wei.toString()
      }
    );
    
    console.log('\n✅ Liquidity Added Successfully!');
    console.log(`Pool: ${result.poolAddress}`);
    if (result.tokenId) {
      console.log(`NFT ID: ${result.tokenId}`);
    }
  }

  async run() {
    const args = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
    const command = args[0];
    
    try {
      switch (command) {
        case 'create-proposal':
          await this.createProposal(args[1]);
          break;
          
        case 'setup-pools':
          if (!args[1]) {
            console.error('❌ Config file required. Usage: cli.js setup-pools <config.json> [mode]');
            break;
          }
          const mode = args[2] || 'manual';
          await this.setupPools(args[1], mode);
          break;
          
        case 'setup-auto':
          if (!args[1]) {
            console.error('❌ Config file required. Usage: cli.js setup-auto <config.json>');
            break;
          }
          await this.setupPools(args[1], 'automatic');
          break;
          
        case 'setup-semi':
          if (!args[1]) {
            console.error('❌ Config file required. Usage: cli.js setup-semi <config.json>');
            break;
          }
          await this.setupPools(args[1], 'semi-automatic');
          break;
          
        case 'add-liquidity':
          if (args.length < 5) {
            console.error('❌ Usage: cli.js add-liquidity <token0> <token1> <amount0> <amount1>');
            break;
          }
          await this.addLiquidity(args[1], args[2], args[3], args[4]);
          break;
          
        case 'help':
        default:
          this.printHelp();
      }
    } catch (error) {
      console.error(`\n❌ Error: ${error.message}`);
      if (error.stack) {
        console.error(error.stack);
      }
    } finally {
      this.orchestrator.close();
    }
  }

  printHelp() {
    console.log(`
Futarchy Proposal CLI
=====================

Commands:
  create-proposal [config.json]           Create a new futarchy proposal
  setup-pools <config.json> [mode]        Setup all pools for a proposal
  setup-auto <config.json>                Automatic setup (no confirmations)
  setup-semi <config.json>                Semi-automatic (confirm each pool)
  add-liquidity <token0> <token1> <amt0> <amt1>  Add liquidity to a pool
  help                                    Show this help message

Chain Selection:
  --chain=1      Use Ethereum Mainnet
  --chain=100    Use Gnosis Chain (default)
  
  Or add "chainId" to your config file:
  { "chainId": 100, ... }  // No --chain flag needed!

Examples:
  cli.js --chain=1 create-proposal config.json
  cli.js setup-pools config.json automatic  // Uses chainId from config

Modes:
  manual         Interactive mode with prompts (default)
  automatic      No confirmations, skip existing pools
  semi-automatic Confirm each pool before creation

Config File Format:
{
  "chainId": 100,                        // Optional, specifies which chain to use
  "amm": "swapr",                       // Optional: 'swapr' (Gnosis) or 'uniswap' (ETH/Polygon)
  "proposalAddress": "0x...",           // Optional, creates new if empty
  "marketName": "Your proposal name",
  "companyToken": {
    "symbol": "TOKEN",                  // Will use chain default if not specified
    "address": "0x..."
  },
  "currencyToken": {
    "symbol": "CURRENCY",               // Will use chain default if not specified
    "address": "0x..."
  },
  "spotPrice": 0.0054,
  "eventProbability": 0.20,
  "impact": 10,                         // Percentage
  "liquidityAmounts": [100,100,100,100,100,100],
  "forceAddLiquidity": [1,2,3],        // Pool numbers to always add liquidity
  "adapterAddress": "0x...",
  "feeTier": 3000                      // Uniswap only: 500, 3000, or 10000
}

Environment Variables (.env):
  PRIVATE_KEY=your_private_key
  RPC_URL=https://rpc.gnosischain.com
    `);
  }
}

// Run CLI
const cli = new FutarchyCLI();
cli.run().catch(console.error);
