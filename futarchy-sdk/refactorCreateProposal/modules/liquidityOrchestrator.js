const { ethers } = require('ethers');
const readline = require('readline');
const constants = require('../contracts/constants');

class LiquidityOrchestrator {
  constructor(modules) {
    this.tokenManager = modules.tokenManager;
    this.poolManager = modules.poolManager;
    this.futarchyAdapter = modules.futarchyAdapter;
    this.proposalCreator = modules.proposalCreator;
    this.priceCalculator = modules.priceCalculator;
    this.transactionLogger = modules.transactionLogger;
    this.wallet = modules.wallet;

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  // Helper to ask questions
  async ask(question, defaultValue = '') {
    return new Promise(resolve => {
      this.rl.question(question, answer => {
        resolve(answer || defaultValue);
      });
    });
  }

  // Setup all pools for a futarchy proposal
  async setupFutarchyPools(config, mode = 'manual') {
    const {
      proposalAddress,
      marketName,
      companyToken,
      currencyToken,
      spotPrice,
      eventProbability,
      impact,
      liquidityAmounts,
      forceAddLiquidity = [],
      adapterAddress,
      category,
      language
    } = config;

    console.log('\n' + '='.repeat(60));
    console.log('FUTARCHY POOL SETUP');
    console.log('='.repeat(60));
    console.log(`Proposal: ${proposalAddress}`);
    console.log(`Market: ${marketName}`);
    console.log(`Category: ${category || 'Using default'}`);
    console.log(`Language: ${language || 'Using default'}`);
    console.log(`Mode: ${mode.toUpperCase()}`);
    // AMM + Fee Tier context
    const amm = (constants.SELECTED_AMM || 'swapr').toLowerCase();
    if (amm === 'uniswap') {
      console.log(`AMM: Uniswap V3  |  Fee Tier: ${(config.feeTier || 3000)}`);
    } else {
      console.log(`AMM: Swapr/Algebra V3`);
    }
    console.log('='.repeat(60));

    // Load proposal details; if ABI differs on chain, fall back to discovery
    let proposal;
    try {
      proposal = await this.proposalCreator.loadProposal(proposalAddress);
    } catch (e) {
      console.log('Error loading proposal via ABI, falling back to wrapped token discovery...');
      proposal = await this.discoverWrappedTokens({
        proposalAddress,
        companyToken,
        currencyToken
      });
      console.log('Discovered wrapped tokens:');
      console.log(`  YES Company: ${proposal.yesCompanyToken}`);
      console.log(`  NO  Company: ${proposal.noCompanyToken}`);
      console.log(`  YES Currency: ${proposal.yesCurrencyToken}`);
      console.log(`  NO  Currency: ${proposal.noCurrencyToken}`);
    }

    // Initialize adapter with specific address if provided
    if (adapterAddress) {
      this.futarchyAdapter = new (require('./futarchyAdapter'))(
        this.wallet,
        this.tokenManager,
        adapterAddress
      );
    }

    // Show initial configuration
    console.log('\n📊 PRICE CALCULATIONS:');
    console.log('─'.repeat(40));
    console.log(`Spot Price: ${spotPrice}`);
    console.log(`Event Probability: ${eventProbability * 100}%`);
    console.log(`Impact: ${impact}%`);
    console.log('\nCalculated Prices:');

    const conditionalPrices = this.priceCalculator.calculateConditionalPrices(spotPrice, eventProbability, impact);
    console.log(`  YES Price: ${conditionalPrices.yesPriceFormatted}`);
    console.log(`  NO Price: ${conditionalPrices.noPriceFormatted}`);
    console.log('─'.repeat(40));

    // Calculate pool configurations (default 18 decimals for both tokens)
    const poolConfigs = this.priceCalculator.calculatePoolConfigurations({
      spotPrice,
      eventProbability,
      impactPercentage: impact,
      liquidityAmounts,
      companyTokenDecimals: 18,
      currencyTokenDecimals: 18
    });

    // Capture global fee tier once to avoid shadowing inside loop
    const globalFeeTier = (config.feeTier || 3000);

    // Define token addresses for each pool (matching createProposals.js)
    const poolTokens = [
      { token0: proposal.yesCompanyToken, token1: proposal.yesCurrencyToken },  // Pool 1: YES-PNK / YES-sDAI
      { token0: proposal.noCompanyToken, token1: proposal.noCurrencyToken },   // Pool 2: NO-PNK / NO-sDAI
      { token0: proposal.yesCompanyToken, token1: currencyToken.address },     // Pool 3: YES-PNK / sDAI
      { token0: proposal.noCompanyToken, token1: currencyToken.address },      // Pool 4: NO-PNK / sDAI
      { token0: proposal.yesCurrencyToken, token1: currencyToken.address },    // Pool 5: YES-sDAI / sDAI
      { token0: proposal.noCurrencyToken, token1: currencyToken.address }      // Pool 6: NO-sDAI / sDAI
    ];

    // Show all pool configurations upfront
    console.log('\n📋 POOL CONFIGURATIONS:');
    console.log('='.repeat(60));
    for (let i = 0; i < poolConfigs.length; i++) {
      const config = poolConfigs[i];
      console.log(`\nPool ${i + 1}: ${config.name}`);
      console.log(`  Price: 1 ${config.token0} = ${config.targetPrice.toFixed(6)} ${config.token1}`);
      console.log(`  Liquidity (${config.token1}): ${config.liquidity}`);
      console.log(`  Required amounts:`);
      console.log(`    ${config.token0}: ${ethers.formatEther(config.amount0Wei)}`);
      console.log(`    ${config.token1}: ${ethers.formatEther(config.amount1Wei)}`);
    }
    console.log('='.repeat(60));

    // Ask for confirmation in semi-automatic mode
    if (mode === 'semi-automatic') {
      const proceed = await this.ask(
        `\nReview the pool configurations above. Proceed with setup? (Y/n): `,
        'Y'
      );
      if (proceed.toLowerCase() !== 'y') {
        console.log('⏭️  Setup cancelled by user');
        return [];
      }
    }

    const results = [];

    for (let i = 0; i < poolConfigs.length; i++) {
      const config = poolConfigs[i];
      const tokens = poolTokens[i];
      const poolNumber = i + 1;

      console.log(`\n${'─'.repeat(40)}`);
      console.log(`PROCESSING POOL ${poolNumber}: ${config.name}`);
      console.log(`${'─'.repeat(40)}`);

      // Check if pool exists
      const existingPool = await this.poolManager.getPool(tokens.token0, tokens.token1, globalFeeTier);

      if (existingPool) {
        console.log(`\n📍 Pool Status: EXISTS at ${existingPool}`);

        // Get and display current pool price in logical order (matching createProposals.js)
        let currentLogicalPrice;
        try {
          const currentAMMPrice = await this.poolManager.getPoolPrice(existingPool);

          // Determine if tokens are inverted in AMM vs logical order
          const logicalToken0Addr = ethers.getAddress(tokens.token0);
          const logicalToken1Addr = ethers.getAddress(tokens.token1);
          const isLogicalOrderSameAsAMM = logicalToken0Addr.toLowerCase() < logicalToken1Addr.toLowerCase();

          // Calculate the price in logical order
          currentLogicalPrice = isLogicalOrderSameAsAMM ? currentAMMPrice : (1 / currentAMMPrice);

          // Get token symbols for display
          const token0Symbol = await this.poolManager.getTokenSymbol(tokens.token0);
          const token1Symbol = await this.poolManager.getTokenSymbol(tokens.token1);

          console.log(`  🎯 PRICE STRATEGY: USING EXISTING POOL PRICE`);
          console.log(`  ❌ IGNORING: Calculated target price (${config.targetPrice.toFixed(6)})`);
          console.log(`  ✅ USING: Current pool price = ${currentLogicalPrice.toFixed(6)}`);
          console.log(`     1 ${token0Symbol} = ${currentLogicalPrice.toFixed(6)} ${token1Symbol}`);

          // CRITICAL LOGGING FOR TOKEN ORDER VERIFICATION
          console.log(`\n  🔍 TOKEN ORDER VERIFICATION:`);
          console.log(`    Logical Token0: ${token0Symbol} (${tokens.token0})`);
          console.log(`    Logical Token1: ${token1Symbol} (${tokens.token1})`);
          console.log(`    Address comparison: ${logicalToken0Addr.toLowerCase()} vs ${logicalToken1Addr.toLowerCase()}`);
          console.log(`    Is logical order same as AMM? ${isLogicalOrderSameAsAMM ? 'YES ✅' : 'NO ⚠️ (INVERTED)'}`);
          console.log(`    AMM internal price: ${currentAMMPrice.toFixed(6)}`);
          console.log(`    Logical price shown: ${currentLogicalPrice.toFixed(6)}`);

          // Calculate deviation from target
          const deviation = Math.abs(currentLogicalPrice - config.targetPrice) / config.targetPrice * 100;
          console.log(`  📊 Deviation from target: ${deviation.toFixed(2)}%`);

          // Store the current price to use if adding liquidity
          config.currentPoolPrice = currentLogicalPrice;
          config.existingPoolAddress = existingPool;

        } catch (error) {
          console.log(`  ⚠️ Could not fetch current pool price: ${error.message}`);
        }

        if (mode === 'automatic' && !forceAddLiquidity.includes(poolNumber)) {
          console.log(`⏭️  Skipping existing pool (automatic mode)`);
          results.push({
            poolNumber,
            skipped: true,
            poolAddress: existingPool,
            token0: tokens.token0,
            token1: tokens.token1,
            targetPrice: config.targetPrice,
            currentPrice: config.currentPoolPrice
          });
          continue;
        }

        // If we're here, we're adding liquidity to existing pool
        console.log(`\n  💧 WILL ADD LIQUIDITY TO EXISTING POOL`);

        // CRITICAL: Adjust amounts to match existing pool price
        if (config.currentPoolPrice) {
          const token0Symbol = await this.poolManager.getTokenSymbol(tokens.token0);
          const token1Symbol = await this.poolManager.getTokenSymbol(tokens.token1);

          console.log(`\n  ⚠️ ADJUSTING AMOUNTS FOR EXISTING POOL PRICE:`);
          console.log(`    Target price was: ${config.targetPrice.toFixed(6)}`);
          console.log(`    Actual pool price: ${config.currentPoolPrice.toFixed(6)}`);
          console.log(`    Original amounts:`);
          const t0info = await this.tokenManager.loadToken(tokens.token0);
          const t1info = await this.tokenManager.loadToken(tokens.token1);
          const d0 = Number(t0info.decimals);
          const d1 = Number(t1info.decimals);
          console.log(`      ${token0Symbol}: ${ethers.formatUnits(config.amount0Wei, d0)}`);
          console.log(`      ${token1Symbol}: ${ethers.formatUnits(config.amount1Wei, d1)}`);

          // Recalculate token1 amount based on pool price: amount1 = amount0 * price (converted across decimals)
          const amount0Float = parseFloat(ethers.formatUnits(config.amount0Wei, d0));
          const amount1Float = amount0Float * config.currentPoolPrice;
          const newAmount1Wei = ethers.parseUnits(amount1Float.toFixed(d1), d1);

          console.log(`    Adjusted amounts:`);
          console.log(`      ${token0Symbol}: ${ethers.formatUnits(config.amount0Wei, d0)} (unchanged)`);
          console.log(`      ${token1Symbol}: ${ethers.formatUnits(newAmount1Wei, d1)} (adjusted)`);
          console.log(`    Ratio: 1:${config.currentPoolPrice.toFixed(6)}`);

          // Update config
          config.amount1Wei = newAmount1Wei;
          config.targetPrice = config.currentPoolPrice;
        }
      } else {
        console.log(`\n📍 Pool Status: DOES NOT EXIST - will create`);

        // In semi-automatic mode, offer option to provide existing pool address
        if (mode === 'semi-automatic') {
          const useExisting = await this.ask(
            `Do you have an existing pool address to use? (y/N): `,
            'N'
          );

          if (useExisting.toLowerCase() === 'y') {
            const manualPoolAddress = await this.ask(
              `Enter the pool address (0x...): `,
              ''
            );

            if (manualPoolAddress && manualPoolAddress.startsWith('0x') && manualPoolAddress.length === 42) {
              console.log(`\n✅ Using manually provided pool: ${manualPoolAddress}`);
              config.existingPoolAddress = manualPoolAddress;

              // Try to fetch current price from the provided pool
              try {
                const currentLogicalPrice = await this.poolManager.getCurrentPoolPrice(
                  manualPoolAddress,
                  tokens.token0,
                  tokens.token1
                );

                console.log(`  📊 Current pool price: ${currentLogicalPrice.toFixed(6)}`);
                config.currentPoolPrice = currentLogicalPrice;

                // Adjust amounts if needed
                if (Math.abs(currentLogicalPrice - config.targetPrice) > 0.001) {
                  console.log(`  ⚠️ Pool price differs from target, adjusting amounts...`);
                  const t0info = await this.tokenManager.loadToken(tokens.token0);
                  const t1info = await this.tokenManager.loadToken(tokens.token1);
                  const d0 = Number(t0info.decimals);
                  const d1 = Number(t1info.decimals);

                  const amount0Float = parseFloat(ethers.formatUnits(config.amount0Wei, d0));
                  const amount1Float = amount0Float * currentLogicalPrice;
                  config.amount1Wei = ethers.parseUnits(amount1Float.toFixed(d1), d1);
                  config.targetPrice = currentLogicalPrice;
                }
              } catch (error) {
                console.log(`  ⚠️ Could not fetch price from pool: ${error.message}`);
                console.log(`  Will proceed with original amounts`);
              }
            } else {
              console.log('❌ Invalid address format, will create new pool');
            }
          }
        }
      }

      // In semi-automatic mode, ask for confirmation per pool
      if (mode === 'semi-automatic') {
        const proceed = await this.ask(
          `\nProceed with Pool ${poolNumber} (${config.name})? (Y/n): `,
          'Y'
        );
        if (proceed.toLowerCase() !== 'y') {
          console.log('⏭️  Skipped by user');
          results.push({
            poolNumber,
            skipped: true,
            poolAddress: config.existingPoolAddress || existingPool,
            token0: tokens.token0,
            token1: tokens.token1,
            targetPrice: config.targetPrice,
            currentPrice: config.currentPoolPrice
          });
          continue;
        }
      }

      // Check and obtain conditional tokens if needed
      await this.ensureTokensForPool(
        tokens,
        config,
        proposal,
        companyToken,
        currencyToken
      );

      // Create pool and add liquidity
      try {
        // Determine if we're adding to existing pool or creating new
        const isExistingPool = config.existingPoolAddress && config.existingPoolAddress !== ethers.ZeroAddress;

        if (isExistingPool) {
          console.log(`\n  🎯 ADDING LIQUIDITY TO EXISTING POOL:`);
          console.log(`    Pool address: ${config.existingPoolAddress}`);
          console.log(`    Using pool's current price: ${config.currentPoolPrice ? config.currentPoolPrice.toFixed(6) : 'N/A'}`);

          // CRITICAL: Recalculate amounts based on CURRENT pool price, not target price
          if (config.currentPoolPrice) {
            // Recalculate amount0 based on current price to maintain ratio (amount0 = amount1 / price)
            const t0info2 = await this.tokenManager.loadToken(tokens.token0);
            const t1info2 = await this.tokenManager.loadToken(tokens.token1);
            const d0b = Number(t0info2.decimals);
            const d1b = Number(t1info2.decimals);
            const amt1Float = parseFloat(ethers.formatUnits(config.amount1Wei, d1b));
            const amt0Float = amt1Float / config.currentPoolPrice;
            const recalculatedAmount0 = ethers.parseUnits(amt0Float.toFixed(d0b), d0b);

            console.log(`\n  ⚠️ AMOUNT RECALCULATION FOR EXISTING POOL:`);
            console.log(`    Original amount0: ${ethers.formatUnits(config.amount0Wei, d0b)}`);
            console.log(`    Original amount1: ${ethers.formatUnits(config.amount1Wei, d1b)}`);
            console.log(`    Recalculated amount0 (based on current price): ${ethers.formatUnits(recalculatedAmount0, d0b)}`);
            const ratioCheck = parseFloat(ethers.formatUnits(config.amount1Wei, d1b)) / parseFloat(ethers.formatUnits(recalculatedAmount0, d0b));
            console.log(`    Price ratio check: ${ratioCheck} should equal ${config.currentPoolPrice.toFixed(6)}`);

            config.amount0Wei = recalculatedAmount0;
          }
        }

        const result = await this.poolManager.createPoolAndAddLiquidity({
          token0Address: tokens.token0,
          token1Address: tokens.token1,
          amount0: config.amount0Wei,
          amount1: config.amount1Wei,
          logicalPrice: isExistingPool ? config.currentPoolPrice : config.targetPrice,
          existingPoolAddress: config.existingPoolAddress,
          feeTier: globalFeeTier,
          tickWidthSteps: (config.tickWidthSteps || 10)
        });

        // Log transaction (ensure BigInt is converted to string)
        this.transactionLogger.log(
          `Pool ${poolNumber} Creation/Liquidity`,
          result.transactionHash,
          {
            poolNumber,
            poolAddress: result.poolAddress,
            token0: tokens.token0,
            token1: tokens.token1,
            amount0: config.amount0Wei.toString(),
            amount1: config.amount1Wei.toString(),
            tokensInverted: result.tokensInverted,
            targetPrice: config.targetPrice
          }
        );

        // Verify price
        const actualPrice = await this.poolManager.getPoolPrice(result.poolAddress);
        const verification = this.priceCalculator.verifyPoolPrice(
          actualPrice,
          config.targetPrice
        );

        console.log(`\n✅ Pool ${poolNumber} Complete:`);
        console.log(`  Address: ${result.poolAddress}`);
        console.log(`  Price Accuracy: ${verification.deviationFormatted}`);

        results.push({
          poolNumber,
          success: true,
          poolAddress: result.poolAddress,
          verification
        });

      } catch (error) {
        console.error(`\n❌ Pool ${poolNumber} Failed: ${error.message}`);
        if (error.stack) {
          console.error('Stack trace:', error.stack);
        }
        results.push({
          poolNumber,
          success: false,
          error: error.message
        });
      }

      // (Notification logic moved to after loop)
    }

    // Send final notifications with rich metadata for the first pool
    await this.sendFinalNotifications(results, config, proposal, amm);

    return results;
  }

  // Attempt to discover YES/NO token addresses by splitting tiny amounts and parsing emitted ERC20 Transfers
  async discoverWrappedTokens({ proposalAddress, companyToken, currencyToken }) {
    const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

    const discoverForCollateral = async (collateral) => {
      // Use 1 base unit of collateral to minimize cost
      const amountWei = 1n;
      const res = await this.futarchyAdapter.splitTokens({
        proposalAddress,
        collateralAddress: collateral.address,
        amount: amountWei,
        collateralSymbol: collateral.symbol
      });

      const receipt = res.receipt;
      const candidates = new Set();
      for (const log of receipt.logs) {
        // Only consider ERC20 Transfer events
        if (!log.topics || log.topics.length === 0) continue;
        if ((log.topics[0] || '').toLowerCase() !== TRANSFER_TOPIC) continue;
        // Ignore MATIC/native logs (0x000...1010) and the adapter itself
        const addr = (log.address || '').toLowerCase();
        if (addr === '0x0000000000000000000000000000000000001010') continue;
        candidates.add(log.address);
      }

      // Load token symbols and classify YES/NO
      let yes = null, no = null;
      for (const addr of candidates) {
        try {
          const info = await this.tokenManager.loadToken(addr);
          const sym = (info.symbol || '').toUpperCase();
          if (!yes && (sym.startsWith('YES') || sym.includes('YES'))) yes = addr;
          if (!no && (sym.startsWith('NO') || sym.includes('NO'))) no = addr;
        } catch { }
      }
      if (!yes || !no) {
        console.warn('⚠️ Could not reliably classify YES/NO tokens from logs; candidates:', Array.from(candidates));
      }
      return { yes, no };
    };

    // Discover for both collaterals
    const company = await discoverForCollateral(companyToken);
    const currency = await discoverForCollateral(currencyToken);

    return {
      proposalAddress,
      marketName: 'unknown',
      companyToken: companyToken.address,
      currencyToken: currencyToken.address,
      openingTime: Math.floor(Date.now() / 1000),
      yesCompanyToken: company.yes,
      noCompanyToken: company.no,
      yesCurrencyToken: currency.yes,
      noCurrencyToken: currency.no
    };
  }

  // Ensure required tokens are available (split if needed)
  async ensureTokensForPool(tokens, config, proposal, companyToken, currencyToken) {
    console.log('\n📋 Checking token requirements for pool...');

    // Check if tokens are conditional tokens
    const isToken0Conditional = tokens.token0 !== companyToken.address &&
      tokens.token0 !== currencyToken.address;
    const isToken1Conditional = tokens.token1 !== companyToken.address &&
      tokens.token1 !== currencyToken.address;

    // For token0
    if (isToken0Conditional) {
      // Determine collateral type based on token type
      const isCompanyToken = tokens.token0 === proposal.yesCompanyToken ||
        tokens.token0 === proposal.noCompanyToken;
      const collateral = isCompanyToken ? companyToken : currencyToken;

      console.log(`  Token0 is conditional: ${isCompanyToken ? 'Company' : 'Currency'} type`);

      await this.futarchyAdapter.ensureConditionalTokens({
        proposalAddress: proposal.proposalAddress,
        collateralAddress: collateral.address,
        conditionalTokenAddress: tokens.token0,
        requiredAmount: config.amount0Wei,
        isYesToken: tokens.token0 === proposal.yesCompanyToken ||
          tokens.token0 === proposal.yesCurrencyToken,
        collateralSymbol: collateral.symbol
      });
    } else {
      // Regular token - just check balance
      console.log(`  Token0 is base token: ${tokens.token0 === companyToken.address ? companyToken.symbol : currencyToken.symbol}`);
      const balance = await this.tokenManager.getBalance(tokens.token0);
      if (balance < config.amount0Wei) {
        throw new Error(`Insufficient ${tokens.token0 === companyToken.address ? companyToken.symbol : currencyToken.symbol} balance`);
      }
      console.log(`  ✅ Sufficient balance`);
    }

    // For token1
    if (isToken1Conditional) {
      const isCompanyToken = tokens.token1 === proposal.yesCompanyToken ||
        tokens.token1 === proposal.noCompanyToken;
      const collateral = isCompanyToken ? companyToken : currencyToken;

      console.log(`  Token1 is conditional: ${isCompanyToken ? 'Company' : 'Currency'} type`);

      await this.futarchyAdapter.ensureConditionalTokens({
        proposalAddress: proposal.proposalAddress,
        collateralAddress: collateral.address,
        conditionalTokenAddress: tokens.token1,
        requiredAmount: config.amount1Wei,
        isYesToken: tokens.token1 === proposal.yesCompanyToken ||
          tokens.token1 === proposal.yesCurrencyToken,
        collateralSymbol: collateral.symbol
      });
    } else {
      // Regular token - just check balance
      console.log(`  Token1 is base token: ${tokens.token1 === companyToken.address ? companyToken.symbol : currencyToken.symbol}`);
      const balance = await this.tokenManager.getBalance(tokens.token1);
      if (balance < config.amount1Wei) {
        throw new Error(`Insufficient ${tokens.token1 === companyToken.address ? companyToken.symbol : currencyToken.symbol} balance`);
      }
      console.log(`  ✅ Sufficient balance`);
    }

    console.log('  ✅ All token requirements verified');
  }

  // Send final notifications for pools 1, 2, and 3
  async sendFinalNotifications(results, config, proposal, ammType) {
    const apiUrl = process.env.BACKEND_API_URL;
    const apiKey = process.env.BACKEND_API_KEY;

    if (!apiUrl || !apiKey) {
      console.log('  ⚠️ Backend notification skipped: Missing API URL or Key in .env');
      return;
    }

    // Helper to find pool result by number
    const getPoolResult = (num) => results.find(r => r.poolNumber === num && r.success);

    // We need pools 1, 2, 5, 6 for the metadata of pool 1
    const pool1 = getPoolResult(1);
    const pool2 = getPoolResult(2);
    const pool5 = getPoolResult(5);
    const pool6 = getPoolResult(6);

    if (!pool1) {
      console.log('  ⚠️ Cannot send notification: Pool 1 creation failed or skipped');
      return;
    }

    // Notify Pool 1 with Rich Metadata
    console.log(`\n  📨 Notifying backend for Pool 1 (Rich Metadata)...`);
    const metadata = await this.constructPoolMetadata(pool1, pool2, pool5, pool6, config, proposal, ammType);
    await this.notifyBackend(pool1.poolAddress, 'uniswapv3', config, proposal, metadata);

    // Notify Pool 2 (No Metadata)
    if (pool2) {
      console.log(`  📨 Notifying backend for Pool 2...`);
      await this.notifyBackend(pool2.poolAddress, 'uniswapv3', config, proposal, null);
    }

    // Notify Pool 3 (No Metadata)
    const pool3 = getPoolResult(3);
    if (pool3) {
      console.log(`  📨 Notifying backend for Pool 3...`);
      await this.notifyBackend(pool3.poolAddress, 'uniswapv3', config, proposal, null);
    }
  }

  async constructPoolMetadata(pool1, pool2, pool5, pool6, config, proposal, ammType) {
    // Helper to determine slot (0 or 1) based on token address order
    // In Uniswap/Algebra, token0 is the smaller address
    const getSlot = (poolAddress, targetToken) => {
      if (!poolAddress) return 0; // Default
      // We don't have the pool instance here easily to check token0/token1 directly from contract
      // But we know the logic: token0 is always the smaller address
      // We need to know if targetToken is token0 or token1
      // However, we need to know what the OTHER token in the pool is to compare
      return 0; // Placeholder - logic below is better
    };

    // Calculate slots
    // Pool 1: YES Company / YES Currency
    // We need 'tokenCompanySlot'. This is the index of YES Company token.
    // Compare YES Company vs YES Currency addresses
    const yesCompany = proposal.yesCompanyToken;
    const yesCurrency = proposal.yesCurrencyToken;
    const pool1Token0 = yesCompany.toLowerCase() < yesCurrency.toLowerCase() ? yesCompany : yesCurrency;
    const tokenCompanySlot1 = (pool1Token0.toLowerCase() === yesCompany.toLowerCase()) ? 0 : 1;

    // Pool 2: NO Company / NO Currency
    // We need 'tokenCompanySlot'. Index of NO Company token.
    const noCompany = proposal.noCompanyToken;
    const noCurrency = proposal.noCurrencyToken;
    const pool2Token0 = noCompany.toLowerCase() < noCurrency.toLowerCase() ? noCompany : noCurrency;
    const tokenCompanySlot2 = (pool2Token0.toLowerCase() === noCompany.toLowerCase()) ? 0 : 1;

    // Pool 5: YES Currency / Currency
    // We need 'tokenBaseSlot'. Index of Currency (Base).
    const currency = config.currencyToken.address || config.currencyTokenAddress; // Handle both formats
    const pool5Token0 = yesCurrency.toLowerCase() < currency.toLowerCase() ? yesCurrency : currency;
    const tokenBaseSlot5 = (pool5Token0.toLowerCase() === currency.toLowerCase()) ? 0 : 1;

    // Pool 6: NO Currency / Currency
    // We need 'tokenBaseSlot'. Index of Currency (Base).
    const pool6Token0 = noCurrency.toLowerCase() < currency.toLowerCase() ? noCurrency : currency;
    const tokenBaseSlot6 = (pool6Token0.toLowerCase() === currency.toLowerCase()) ? 0 : 1;

    // Get symbols
    const getSymbol = async (addr) => (await this.tokenManager.loadToken(addr)).symbol;
    const yesCompanySymbol = await getSymbol(yesCompany);
    const noCompanySymbol = await getSymbol(noCompany);
    const yesCurrencySymbol = await getSymbol(yesCurrency);
    const noCurrencySymbol = await getSymbol(noCurrency);
    const currencySymbol = await getSymbol(currency);
    const companySymbol = await getSymbol(config.companyToken.address || config.companyTokenAddress);

    return {
      name: `${yesCompanySymbol} / ${yesCurrencySymbol}`,
      chain: config.chainId || 100,
      pools: [
        {
          reserves: {
            token0: "0", // Initial placeholder
            token1: "0"
          },
          volume7d: 0,
          volume24h: 0
        }
      ],
      title: config.marketName,
      impact: config.impact,
      token0: pool1Token0,
      token1: (pool1Token0.toLowerCase() === yesCompany.toLowerCase()) ? yesCurrency : yesCompany,
      reality: {
        questionText: config.marketName
      },
      outcomes: ["Yes", "No"],
      proposal: {
        creator: this.wallet.address,
        creationTimestamp: Math.floor(Date.now() / 1000)
      },
      routerV2: "0x00",
      routerV3: "0x00", // TODO: Add if available
      spotPool: "0x00", // TODO: Add if available
      analytics: {
        offChain: { clicks: 0, pageViews: 0 }
      },
      companyId: config.companyId ? parseInt(config.companyId) : 9,
      spotPrice: config.spotPrice,
      marketName: config.marketName,
      questionId: "0x00", // TODO: Fetch from Reality if possible
      conditionId: "0x00", // TODO: Fetch from conditional tokens
      description: config.marketName,
      numOutcomes: 2,
      openingTime: config.openingTime,
      questionLink: "",
      companyTokens: {
        no: {
          tokenName: noCompanySymbol,
          tokenSymbol: noCompanySymbol,
          wrappedCollateralTokenAddress: noCompany
        },
        yes: {
          tokenName: yesCompanySymbol,
          tokenSymbol: yesCompanySymbol,
          wrappedCollateralTokenAddress: yesCompany
        },
        base: {
          tokenName: companySymbol,
          tokenSymbol: companySymbol,
          wrappedCollateralTokenAddress: config.companyToken.address || config.companyTokenAddress
        }
      },
      contractInfos: {
        futarchy: {
          router: this.futarchyAdapter.adapterAddress || "0x..."
        }
      },
      routerAddress: this.futarchyAdapter.adapterAddress || "0x...",
      currencyTokens: {
        no: {
          tokenName: noCurrencySymbol,
          tokenSymbol: noCurrencySymbol,
          wrappedCollateralTokenAddress: noCurrency
        },
        yes: {
          tokenName: yesCurrencySymbol,
          tokenSymbol: yesCurrencySymbol,
          wrappedCollateralTokenAddress: yesCurrency
        },
        base: {
          tokenName: currencySymbol,
          tokenSymbol: currencySymbol,
          wrappedCollateralTokenAddress: currency
        }
      },
      factoryAddress: "0x...", // TODO
      display_title_0: config.display_text_1 || "",
      display_title_1: config.display_text_2 || "",
      futarchyAdapter: this.futarchyAdapter.adapterAddress || "0x...",
      proposalAddress: proposal.proposalAddress,
      background_image: config.background_image || "",
      eventProbability: config.eventProbability,
      prediction_pools: {
        no: {
          address: pool6 ? pool6.poolAddress : "0x00",
          tokenBaseSlot: tokenBaseSlot6
        },
        yes: {
          address: pool5 ? pool5.poolAddress : "0x00",
          tokenBaseSlot: tokenBaseSlot5
        }
      },
      conditional_pools: {
        no: {
          address: pool2 ? pool2.poolAddress : "0x00",
          tokenCompanySlot: tokenCompanySlot2
        },
        yes: {
          address: pool1.poolAddress,
          tokenCompanySlot: tokenCompanySlot1
        }
      }
    };
  }

  // Core notification sender
  async notifyBackend(poolAddress, type, config, proposal, metadata) {
    const apiUrl = process.env.BACKEND_API_URL;
    const apiKey = process.env.BACKEND_API_KEY;

    const payload = {
      address: poolAddress,
      type: type,
      proposal_address: proposal.proposalAddress || config.proposalAddress,
      metadata: metadata,
      company_id: config.companyId ? parseInt(config.companyId) : 9,
      chain_id: config.chainId || (process.env.CHAIN_ID ? parseInt(process.env.CHAIN_ID) : 100)
    };

    console.log(`\n  📨 NOTIFICATION DETAILS:`);
    console.log(`  🔗 URL: ${apiUrl}`);
    console.log(`  🔑 Token: ${apiKey ? 'Bearer ...' + apiKey.slice(-6) : 'Missing'}`);
    console.log(`  📦 Payload Preview:`);
    console.log(JSON.stringify(payload, null, 2));

    // Save payload to file for inspection
    try {
      const fs = require('fs');
      const path = require('path');
      const dumpPath = path.resolve(process.cwd(), 'last_backend_payload.json');
      fs.writeFileSync(dumpPath, JSON.stringify(payload, null, 2));
      console.log(`\n  💾 Payload saved to: ${dumpPath}`);
    } catch (err) {
      console.error('  ⚠️ Failed to save payload dump:', err.message);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      if (response.ok) {
        console.log(`  ✅ Backend notified successfully for ${poolAddress}`);
      } else {
        const text = await response.text();
        console.log(`  ⚠️ Backend notification failed: ${response.status} ${response.statusText}`);
        console.log(`  Response: ${text}`);
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log(`  ⚠️ Backend notification timed out after 60s`);
      } else {
        console.log(`  ⚠️ Error notifying backend: ${error.message}`);
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  // Close readline interface
  close() {
    this.rl.close();
  }
}

module.exports = LiquidityOrchestrator;
