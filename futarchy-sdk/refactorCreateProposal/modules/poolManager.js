const { ethers } = require('ethers');
const constants = require('../contracts/constants');

class PoolManager {
  constructor(wallet, tokenManager, priceCalculator) {
    this.wallet = wallet;
    this.tokenManager = tokenManager;
    this.priceCalculator = priceCalculator;
    this.amm = (constants.SELECTED_AMM || 'swapr').toLowerCase();
    
    // Initialize Position Manager contract with AMM-aware ABI
    const nfpmAbi = this.amm === 'uniswap'
      ? [
          'function createAndInitializePoolIfNecessary(address,address,uint24,uint160) returns (address)',
          'function mint((address token0,address token1,uint24 fee,int24 tickLower,int24 tickUpper,uint256 amount0Desired,uint256 amount1Desired,uint256 amount0Min,uint256 amount1Min,address recipient,uint256 deadline)) returns (uint256 tokenId,uint128 liquidity,uint256 amount0,uint256 amount1)'
        ]
      : [
          'function createAndInitializePoolIfNecessary(address,address,uint160) returns (address)',
          'function mint((address token0,address token1,int24 tickLower,int24 tickUpper,uint256 amount0Desired,uint256 amount1Desired,uint256 amount0Min,uint256 amount1Min,address recipient,uint256 deadline)) returns (uint256,uint128,uint256,uint256)'
        ];

    // Common selectors used by both
    nfpmAbi.push(
      'function positions(uint256) view returns (uint96,address,address,address,int24,int24,uint128,uint256,uint256,uint128,uint128)'
    );
    // Not all versions expose factory(); we will try/catch on call
    nfpmAbi.push('function factory() view returns (address)');

    this.positionManager = new ethers.Contract(
      constants.POSITION_MANAGER,
      nfpmAbi,
      wallet
    );

    // We'll get the factory address dynamically or set it as null for now
    this.poolFactory = null;
  }

  // Helper to get token symbol safely
  async getTokenSymbol(address) {
    try {
      const info = await this.tokenManager.loadToken(address);
      return info.symbol || (address.slice(0, 8) + '...');
    } catch {
      return address.slice(0, 8) + '...';
    }
  }

  // Initialize factory if needed
  async initFactory() {
    if (!this.poolFactory) {
      try {
        // Prefer configured factory from constants when available (more robust across chains/clones)
        const configuredFactory = require('../contracts/constants').POOL_FACTORY;
        const factoryAddress = configuredFactory && configuredFactory !== ''
          ? configuredFactory
          : await this.positionManager.factory();

        if (factoryAddress && factoryAddress !== ethers.ZeroAddress) {
          this.poolFactory = new ethers.Contract(
            factoryAddress,
            this.amm === 'uniswap'
              ? ['function getPool(address,address,uint24) view returns (address)']
              : ['function poolByPair(address,address) view returns (address)'],
            this.wallet
          );
        } else {
          console.log('Note: Pool factory address unavailable; pool existence checks disabled');
        }
      } catch (error) {
        // If we can't get factory, pools will always be created new
        console.log('Note: Cannot determine factory address, will create new pools');
      }
    }
  }

  // Check if pool exists
  async getPool(token0Address, token1Address, feeTier = 3000) {
    try {
      await this.initFactory();
      if (!this.poolFactory) {
        // Can't check, assume pool doesn't exist
        return null;
      }
      
      const { ammToken0, ammToken1 } = this.tokenManager.getAMMOrder(token0Address, token1Address);
      const poolAddress = this.amm === 'uniswap'
        ? await this.poolFactory.getPool(ammToken0, ammToken1, feeTier)
        : await this.poolFactory.poolByPair(ammToken0, ammToken1);
      return poolAddress !== ethers.ZeroAddress ? poolAddress : null;
    } catch (error) {
      // Silently fail - just means pool doesn't exist or can't be checked
      return null;
    }
  }

  // Get pool price (token1 per token0)
  async getPoolPrice(poolAddress) {
    try {
      const poolAbi = this.amm === 'uniswap'
        ? [
            'function slot0() view returns (uint160 sqrtPriceX96,int24 tick,uint16 observationIndex,uint16 observationCardinality,uint16 observationCardinalityNext,uint8 feeProtocol,bool unlocked)',
            'function token0() view returns (address)',
            'function token1() view returns (address)'
          ]
        : [
            'function globalState() view returns (uint160 sqrtPriceX96,int24 tick,uint16 feeZto,uint16 feeOtz,uint16 communityFeeLastTimestamp,bool unlocked)',
            'function token0() view returns (address)',
            'function token1() view returns (address)'
          ];
      const pool = new ethers.Contract(poolAddress, poolAbi, this.wallet);
      const sqrtPriceX96 = this.amm === 'uniswap'
        ? (await pool.slot0()).sqrtPriceX96
        : (await pool.globalState()).sqrtPriceX96;
      const price = (Number(sqrtPriceX96) / (2 ** 96)) ** 2;
      return price;
    } catch (error) {
      throw new Error(`Failed to get pool price: ${error.message}`);
    }
  }

  // Get current pool price adjusted for logical token order
  async getCurrentPoolPrice(poolAddress, logicalToken0, logicalToken1) {
    try {
      const ammPrice = await this.getPoolPrice(poolAddress);

      // Check if tokens are in AMM order
      const { needsReorder } = this.tokenManager.getAMMOrder(logicalToken0, logicalToken1);

      // If tokens are reordered in AMM, we need to invert the price to get logical price
      const logicalPrice = needsReorder ? (1 / ammPrice) : ammPrice;

      return logicalPrice;
    } catch (error) {
      throw new Error(`Failed to get current pool price: ${error.message}`);
    }
  }

  // Create and initialize pool
  async createPool(token0Address, token1Address, amount0, amount1, gasOptions = {}, logicalPrice = null, feeTier = 3000) {
    const { ammToken0, ammToken1, needsReorder } = this.tokenManager.getAMMOrder(token0Address, token1Address);
    
    // Ensure amounts are BigInt - handle case where they might already be BigInt
    const toBigInt = (value) => {
      if (typeof value === 'bigint') return value;
      if (typeof value === 'string') return BigInt(value);
      if (typeof value === 'number') return BigInt(Math.floor(value));
      return BigInt(value.toString());
    };
    
    const amt0 = toBigInt(amount0);
    const amt1 = toBigInt(amount1);
    
    // Calculate sqrt price based on target price when provided
    let sqrtPriceX96;
    if (logicalPrice && Number(logicalPrice) > 0) {
      // AMM price is token1 per token0 in AMM order; convert from logical price if needed
      const ammPrice = needsReorder ? (1 / Number(logicalPrice)) : Number(logicalPrice);
      // sqrtPriceX96 = sqrt(ammPrice) * 2^96
      const sqrtRatio = Math.sqrt(ammPrice);
      sqrtPriceX96 = BigInt(Math.floor(sqrtRatio * (2 ** 96)));
    } else {
      // Fallback to amount ratio if no logical price provided
      if (needsReorder) {
        sqrtPriceX96 = this.priceCalculator.sqrtPriceX96(amt1, amt0);
      } else {
        sqrtPriceX96 = this.priceCalculator.sqrtPriceX96(amt0, amt1);
      }
    }

    console.log(`\n🏗️  Creating new pool:`);
    console.log(`  AMM: ${this.amm}${this.amm === 'uniswap' ? `  |  Fee Tier: ${feeTier}` : ''}`);
    
    // CRITICAL: Alert about token ordering - matching createProposals.js approach
    console.log(`\n⚠️  TOKEN ORDERING ALERT (matching createProposals.js):`);
    console.log(`  📋 INTENDED/LOGICAL ORDER:`);
    console.log(`    Token A: ${await this.getTokenSymbol(token0Address)} (${token0Address})`);
    console.log(`    Token B: ${await this.getTokenSymbol(token1Address)} (${token1Address})`);
    
    if (!needsReorder) {
      console.log(`  ✅ AMM ORDER MATCHES LOGICAL ORDER:`);
      console.log(`    AMM Token0: ${await this.getTokenSymbol(ammToken0)} (${ammToken0})`);
      console.log(`    AMM Token1: ${await this.getTokenSymbol(ammToken1)} (${ammToken1})`);
      if (logicalPrice) {
        console.log(`  🎯 Pool price will show: 1 ${await this.getTokenSymbol(token0Address)} = ${logicalPrice.toFixed(6)} ${await this.getTokenSymbol(token1Address)}`);
      }
    } else {
      console.log(`  ⚠️  AMM WILL INVERT TOKEN ORDER (address-based sorting):`);
      console.log(`    AMM Token0: ${await this.getTokenSymbol(ammToken0)} (${ammToken0}) [was Token B]`);
      console.log(`    AMM Token1: ${await this.getTokenSymbol(ammToken1)} (${ammToken1}) [was Token A]`);
      if (logicalPrice) {
        // When tokens are reordered, AMM shows the INVERSE of our logical price
        // logicalPrice = Token A / Token B (intended: NO_GNO / NO_sDAI)
        // But AMM has Token B as token0, Token A as token1
        // So AMM shows: 1 Token B = (1/logicalPrice) Token A
        const ammInternalPrice = 1 / logicalPrice; // AMM will show: 1 ammToken0 = (1/logicalPrice) ammToken1
        console.log(`  🔄 AMM will show: 1 ${await this.getTokenSymbol(ammToken0)} = ${ammInternalPrice.toFixed(6)} ${await this.getTokenSymbol(ammToken1)}`);
        console.log(`  🎯 BUT intended price achieved: 1 ${await this.getTokenSymbol(token0Address)} = ${logicalPrice.toFixed(6)} ${await this.getTokenSymbol(token1Address)} ✅`);
      }
    }
    
    console.log(`  💡 Note: Like createProposals.js, we handle reordering automatically`);
    console.log(`  📊 AMM Internal Details:`);
    console.log(`    AMM Token0: ${ammToken0}`);
    console.log(`    AMM Token1: ${ammToken1}`);
    console.log(`    Initial sqrt price X96: ${sqrtPriceX96}`);
    console.log(`    Type of sqrtPriceX96: ${typeof sqrtPriceX96}`);

    // EIP-1559 fee with chain-appropriate minimums
    const feeData = await this.wallet.provider.getFeeData().catch(() => ({}));
    const chainId = (await this.wallet.provider.getNetwork()).chainId;
    const minTipGwei = chainId === 1n ? '0.04' : (chainId === 137n ? '25' : '2');
    const minTip = ethers.parseUnits(minTipGwei, 'gwei');
    let maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ?? minTip;
    if (maxPriorityFeePerGas < minTip) maxPriorityFeePerGas = minTip;
    let maxFeePerGas = feeData.maxFeePerGas ?? (maxPriorityFeePerGas * 2n);
    if (maxFeePerGas < maxPriorityFeePerGas * 2n) maxFeePerGas = maxPriorityFeePerGas * 2n;

    // Estimate gas with buffer
    let createGasLimit = gasOptions.gasLimit || constants.GAS_SETTINGS.CREATE_POOL;
    try {
      if (this.amm === 'uniswap') {
        const est = await this.positionManager.estimateGas.createAndInitializePoolIfNecessary(
          ammToken0, ammToken1, feeTier, sqrtPriceX96
        );
        createGasLimit = ((est * 130n) / 100n) + 100000n;
      } else {
        const est = await this.positionManager.estimateGas.createAndInitializePoolIfNecessary(
          ammToken0, ammToken1, sqrtPriceX96
        );
        createGasLimit = ((est * 130n) / 100n) + 100000n;
      }
    } catch (_) {}

    let tx;
    try {
      if (this.amm === 'uniswap') {
        tx = await this.positionManager.createAndInitializePoolIfNecessary(
          ammToken0,
          ammToken1,
          feeTier,
          sqrtPriceX96,
          { 
            gasLimit: createGasLimit,
            maxFeePerGas,
            maxPriorityFeePerGas,
            ...gasOptions 
          }
        );
      } else {
        tx = await this.positionManager.createAndInitializePoolIfNecessary(
          ammToken0,
          ammToken1,
          sqrtPriceX96,
          { 
            gasLimit: createGasLimit,
            maxFeePerGas,
            maxPriorityFeePerGas,
            ...gasOptions 
          }
        );
      }
    } catch (err) {
      console.log('  ⚠️ NFPM createAndInitialize failed, trying factory.createPool + pool.initialize');
      // Manual fallback using factory + direct initialize
      await this.initFactory();
      const factoryAddress = this.poolFactory?.target || this.poolFactory?.address || require('../contracts/constants').POOL_FACTORY;
      if (!factoryAddress || factoryAddress === ethers.ZeroAddress) {
        throw err; // no factory available; rethrow original error
      }
      const factoryAbi = ['function createPool(address,address,uint24) returns (address)'];
      const factory = new ethers.Contract(factoryAddress, factoryAbi, this.wallet);
      let newPoolAddress;
      try {
        const txCreate = await factory.createPool(ammToken0, ammToken1, feeTier, {
          gasLimit: constants.GAS_SETTINGS.CREATE_POOL,
          maxFeePerGas,
          maxPriorityFeePerGas,
          ...gasOptions
        });
        const rc = await txCreate.wait();
        // Try to parse event
        try {
          const iface = new ethers.Interface(['event PoolCreated(address token0,address token1,uint24 fee,int24 tickSpacing,address pool)']);
          for (const log of rc.logs) {
            try {
              const parsed = iface.parseLog(log);
              if (parsed && parsed.name === 'PoolCreated') {
                newPoolAddress = parsed.args.pool;
                break;
              }
            } catch {}
          }
        } catch {}
        if (!newPoolAddress) {
          // fallback to factory view
          newPoolAddress = await factory.getPool?.(ammToken0, ammToken1, feeTier) || null;
        }
      } catch (e2) {
        console.log('  ❌ Factory createPool failed:', e2.message);
        throw err;
      }
      if (!newPoolAddress || newPoolAddress === ethers.ZeroAddress) {
        console.log('  ❌ Could not resolve new pool address after createPool');
        throw err;
      }
      // Initialize directly
      const poolAbi = ['function initialize(uint160 sqrtPriceX96)'];
      const pool = new ethers.Contract(newPoolAddress, poolAbi, this.wallet);
      tx = await pool.initialize(sqrtPriceX96, {
        gasLimit: constants.GAS_SETTINGS.CREATE_POOL,
        maxFeePerGas,
        maxPriorityFeePerGas,
        ...gasOptions
      });
    }

    console.log(`  Transaction: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`  ✅ Pool created`);

    // Get the created pool address - retry a few times if needed 
    let poolAddress = null; 
    // First try to infer from Initialize event emitted by the pool itself
    try {
      const initTopic = ethers.id('Initialize(uint160,int24)');
      for (const log of (receipt.logs || [])) {
        if (log.topics && log.topics[0] === initTopic && log.address) {
          poolAddress = log.address;
          console.log(`  ✅ Found pool address from Initialize event: ${poolAddress}`);
          break;
        }
      }
    } catch {}
    for (let i = 0; i < 8 && !poolAddress; i++) { 
      poolAddress = await this.getPool(token0Address, token1Address, feeTier);
      if (poolAddress) break;
      if (i < 7) {
        console.log(`  ⏳ Waiting for pool to be indexed...`);
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    if (!poolAddress) {
      // If we still can't get it, try to extract from event logs via Factory PoolCreated
      console.log(`  🔍 Extracting pool address from transaction logs...`);
      // Prefer configured factory; fall back to NFPM.factory()
      let factoryAddress = require('../contracts/constants').POOL_FACTORY;
      if (!factoryAddress || factoryAddress === ethers.ZeroAddress || factoryAddress === '') {
        try { factoryAddress = await this.positionManager.factory(); } catch {}
      }
      if (factoryAddress && factoryAddress !== ethers.ZeroAddress && factoryAddress !== '') {
        const factoryIface = new ethers.Interface([
          'event PoolCreated(address token0,address token1,uint24 fee,int24 tickSpacing,address pool)'
        ]);
        for (const log of receipt.logs) {
          try {
            const parsed = factoryIface.parseLog({ topics: log.topics, data: log.data });
            if (parsed && parsed.name === 'PoolCreated') {
              poolAddress = parsed.args.pool;
              console.log(`  ✅ Found pool address from event: ${poolAddress}`);
              break;
            }
          } catch {}
        }
      }
    }

    // One last attempt using factory view (in case logs were not parsable yet)
    if (!poolAddress) {
      try {
        await this.initFactory();
        const { ammToken0, ammToken1 } = this.tokenManager.getAMMOrder(token0Address, token1Address);
        if (this.amm === 'uniswap' && this.poolFactory?.getPool) {
          const p = await this.poolFactory.getPool(ammToken0, ammToken1, feeTier);
          if (p && p !== ethers.ZeroAddress) {
            poolAddress = p;
          }
        }
      } catch {}
    }
    
    if (!poolAddress) {
      throw new Error('Failed to get pool address after creation');
    }
    
    return { poolAddress, transactionHash: tx.hash, receipt };
  }

  // Get tick spacing for a pool
  async getTickSpacing(poolAddress) {
    const pool = new ethers.Contract(
      poolAddress,
      ['function tickSpacing() view returns (int24)'],
      this.wallet
    );
    return await pool.tickSpacing();
  }

  // Align tick to spacing (matching createProposals.js logic)
  alignTick(tick, spacing, direction = 'down') {
    const s = Number(spacing);
    const t = Number(tick);
    
    if (direction === 'down') {
      return Math.floor(t / s) * s;
    } else {
      return Math.ceil(t / s) * s;
    }
  }

  // Add liquidity to pool
  async mintPosition(params) {
    const {
      token0Address,
      token1Address,
      amount0,
      amount1,
      poolAddress,
      feeTier = 3000,
      tickLower = constants.TICK_LOWER_FULL,
      tickUpper = constants.TICK_UPPER_FULL,
      tickWidthSteps = 10,
      slippage = constants.SLIPPAGE_TOLERANCE,
      deadline = Math.floor(Date.now() / 1000) + (constants.DEADLINE_MINUTES * 60),
      gasOptions = {}
    } = params;

    // Get AMM ordering
    const { ammToken0, ammToken1, needsReorder } = this.tokenManager.getAMMOrder(token0Address, token1Address);
    
    // Reorder amounts if needed - ensure they are BigInt
    // Handle case where amounts might already be BigInt
    const toBigInt = (value) => {
      if (typeof value === 'bigint') return value;
      if (typeof value === 'string') return BigInt(value);
      if (typeof value === 'number') return BigInt(Math.floor(value));
      return BigInt(value.toString());
    };
    
    const ammAmount0 = toBigInt(needsReorder ? amount1 : amount0);
    const ammAmount1 = toBigInt(needsReorder ? amount0 : amount1);

    // Get tick spacing and compute tick range
    const tickSpacing = await this.getTickSpacing(poolAddress);
    let alignedTickLower, alignedTickUpper;
    if (this.amm === 'uniswap' && tickWidthSteps && tickWidthSteps > 0) {
      // Center the range around the current tick to concentrate tiny liquidity
      const poolForTick = new ethers.Contract(
        poolAddress,
        ['function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16,uint16,uint16,uint8,bool)'],
        this.wallet
      );
      const slot0 = await poolForTick.slot0();
      const currentTick = Number(slot0.tick ?? slot0[1]);
      const width = Number(tickSpacing) * Number(tickWidthSteps);
      alignedTickLower = this.alignTick(currentTick - width, tickSpacing, 'down');
      alignedTickUpper = this.alignTick(currentTick + width, tickSpacing, 'up');
      if (alignedTickLower >= alignedTickUpper) {
        alignedTickLower = this.alignTick(currentTick - Number(tickSpacing), tickSpacing, 'down');
        alignedTickUpper = this.alignTick(currentTick + Number(tickSpacing), tickSpacing, 'up');
      }
    } else {
      // Full range (Algebra/Swapr or when centering disabled)
      alignedTickLower = this.alignTick(tickLower, tickSpacing, 'up');
      alignedTickUpper = this.alignTick(tickUpper, tickSpacing, 'down');
    }

    // Calculate minimum amounts with slippage
    // Handle BigInt properly - convert to string first
    const amount0Min = 0n; // For minimal test amounts, use 0 min
    const amount1Min = 0n; // For minimal test amounts, use 0 min

    // Ensure deadline is a regular number, not BigInt
    const deadlineNum = typeof deadline === 'bigint' ? Number(deadline) : deadline;
    
    // Create mint params as an object with named parameters
    const mintParams = this.amm === 'uniswap'
      ? {
          token0: ammToken0,
          token1: ammToken1,
          fee: feeTier,
          tickLower: alignedTickLower,
          tickUpper: alignedTickUpper,
          amount0Desired: ammAmount0,
          amount1Desired: ammAmount1,
          amount0Min,
          amount1Min,
          recipient: this.wallet.address,
          deadline: deadlineNum
        }
      : {
          token0: ammToken0,
          token1: ammToken1,
          tickLower: alignedTickLower,
          tickUpper: alignedTickUpper,
          amount0Desired: ammAmount0,
          amount1Desired: ammAmount1,
          amount0Min,
          amount1Min,
          recipient: this.wallet.address,
          deadline: deadlineNum
        };
    
    console.log(`\n🔍 Mint params types:`);
    console.log(`  amount0Desired: ${typeof ammAmount0}`);
    console.log(`  amount1Desired: ${typeof ammAmount1}`);
    console.log(`  deadline: ${typeof deadlineNum}`);

    // Ensure tokens are approved for the Position Manager
    console.log(`\n📝 Ensuring token approvals for Position Manager...`);
    await this.tokenManager.ensureAllowance(
      ammToken0, 
      constants.POSITION_MANAGER, 
      ammAmount0, 
      'Position Manager (token0)'
    );
    await this.tokenManager.ensureAllowance(
      ammToken1, 
      constants.POSITION_MANAGER, 
      ammAmount1, 
      'Position Manager (token1)'
    );
    
    console.log(`\n💧 Minting liquidity position:`);
    console.log(`  AMM: ${this.amm}${this.amm === 'uniswap' ? `  |  Fee Tier: ${feeTier}` : ''}`);
    console.log(`  Pool: ${poolAddress}`);
    console.log(`  Tick range: [${alignedTickLower}, ${alignedTickUpper}]${this.amm === 'uniswap' ? ` (centered ±${tickWidthSteps} steps)` : ''}`);
    // Pretty-print amounts using token decimals
    try {
      const t0 = await this.tokenManager.loadToken(ammToken0);
      const t1 = await this.tokenManager.loadToken(ammToken1);
      console.log(`  AMM amounts: ${ethers.formatUnits(ammAmount0, t0.decimals)} ${t0.symbol} / ${ethers.formatUnits(ammAmount1, t1.decimals)} ${t1.symbol}`);
    } catch {
      console.log(`  AMM amounts: ${ammAmount0.toString()} / ${ammAmount1.toString()}`);
    }

    // EIP-1559 fee data with chain-appropriate minimums
    const feeData = await this.wallet.provider.getFeeData().catch(() => ({}));
    const chainId = (await this.wallet.provider.getNetwork()).chainId;
    const minTipGwei = chainId === 1n ? '0.04' : (chainId === 137n ? '25' : '2');
    const minTip = ethers.parseUnits(minTipGwei, 'gwei');
    let maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ?? minTip;
    if (maxPriorityFeePerGas < minTip) maxPriorityFeePerGas = minTip;
    let maxFeePerGas = feeData.maxFeePerGas ?? (maxPriorityFeePerGas * 2n);
    if (maxFeePerGas < maxPriorityFeePerGas * 2n) maxFeePerGas = maxPriorityFeePerGas * 2n;

    // Estimate gas with buffer
    let mintGasLimit = gasOptions.gasLimit || constants.GAS_SETTINGS.MINT_POSITION;
    try {
      const est = await this.positionManager.estimateGas.mint(mintParams);
      mintGasLimit = ((est * 130n) / 100n) + 100000n;
    } catch (_) {}

    const tx = await this.positionManager.mint(
      mintParams,
      { 
        gasLimit: mintGasLimit,
        maxFeePerGas,
        maxPriorityFeePerGas,
        ...gasOptions 
      }
    );

    console.log(`  Transaction: ${tx.hash}`);
    const receipt = await tx.wait();
    
    // Extract token ID from event logs
    const mintEvent = receipt.logs.find(log => {
      try {
        const parsed = this.positionManager.interface.parseLog(log);
        return parsed && parsed.name === 'Transfer';
      } catch {
        return false;
      }
    });

    const tokenId = mintEvent ? mintEvent.args[2] : null;
    console.log(`  ✅ Position minted${tokenId ? ` (NFT ID: ${tokenId})` : ''}`);

    return { 
      tokenId, 
      transactionHash: tx.hash, 
      receipt,
      actualAmount0: ammAmount0,
      actualAmount1: ammAmount1
    };
  }

  // Combined function to create pool if needed and add liquidity
  async createPoolAndAddLiquidity(params) {
    const {
      token0Address,
      token1Address,
      amount0,
      amount1,
      logicalPrice,
      existingPool,
      existingPoolAddress,  // Also accept this parameter name
      feeTier = 3000,
      tickWidthSteps = 10,
      ...otherParams
    } = params;

    // Use either existingPool or existingPoolAddress
    const providedPoolAddress = existingPool || existingPoolAddress;

    console.log(`\n📊 createPoolAndAddLiquidity VERIFICATION:`);
    console.log(`  Operation: ${providedPoolAddress ? 'ADD LIQUIDITY TO EXISTING' : 'CREATE NEW POOL'}`);
    console.log(`  amount0: ${typeof amount0} = ${amount0}`);
    console.log(`  amount1: ${typeof amount1} = ${amount1}`);
    console.log(`  Logical price target: ${logicalPrice ? logicalPrice.toFixed(6) : 'not set'}`);

    let poolAddress;

    if (providedPoolAddress) {
      // Use the manually provided pool address
      poolAddress = providedPoolAddress;
      console.log(`\n✅ Using provided pool address: ${poolAddress}`);
      console.log(`  Skipping pool creation - going directly to add liquidity`);
    } else {
      // Check if pool exists
      poolAddress = await this.getPool(token0Address, token1Address, feeTier);

      if (!poolAddress) {
        // Create pool
        const createResult = await this.createPool(
          token0Address,
          token1Address,
          amount0,
          amount1,
          otherParams.gasOptions,
          logicalPrice,
          feeTier
        );
        poolAddress = createResult.poolAddress;
      } else {
        console.log(`\n✅ Pool already exists: ${poolAddress}`);
      }
    }

    // Add liquidity
    console.log(`\n➡️  Calling mintPosition with pool: ${poolAddress}`);
    const mintResult = await this.mintPosition({
      ...params,
      feeTier,
      tickWidthSteps,
      poolAddress
    });

    // FINAL PRICE VERIFICATION (matching createProposals.js approach)
    if (logicalPrice) {
      console.log(`\n📊 FINAL PRICE VERIFICATION (like createProposals.js):`);
      try {
        const actualPoolPrice = await this.getPoolPrice(poolAddress);
        const logicalToken0Addr = ethers.getAddress(token0Address);
        const logicalToken1Addr = ethers.getAddress(token1Address);
        const isLogicalOrderSameAsAMM = logicalToken0Addr.toLowerCase() < logicalToken1Addr.toLowerCase();
        
        // Calculate final displayed price
        let finalDisplayedPrice;
        if (isLogicalOrderSameAsAMM) {
          finalDisplayedPrice = actualPoolPrice; // AMM price = logical price
          console.log(`  ✅ TOKENS NOT INVERTED - Direct AMM price`);
        } else {
          finalDisplayedPrice = 1 / actualPoolPrice; // Invert AMM price to get logical price
          console.log(`  🔄 TOKENS INVERTED - Converting AMM price to logical`);
        }
        
        const priceAccuracy = Math.abs(finalDisplayedPrice - logicalPrice) / logicalPrice * 100;
        
        console.log(`  📊 Final Pool Price: 1 ${await this.getTokenSymbol(token0Address)} = ${finalDisplayedPrice.toFixed(6)} ${await this.getTokenSymbol(token1Address)}`);
        console.log(`  🎯 Target Price Was: 1 ${await this.getTokenSymbol(token0Address)} = ${logicalPrice.toFixed(6)} ${await this.getTokenSymbol(token1Address)}`);
        console.log(`  📈 Price Accuracy: ${priceAccuracy < 1 ? '✅ ACCURATE' : '⚠️ CHECK REQUIRED'} (${priceAccuracy.toFixed(2)}% deviation)`);
        
      } catch (error) {
        console.log(`  ⚠️ Could not verify final price: ${error.message}`);
      }
    }

    // Calculate token inversion information for logging
    const logicalToken0Addr = ethers.getAddress(token0Address);
    const logicalToken1Addr = ethers.getAddress(token1Address);
    const tokensInverted = logicalToken0Addr.toLowerCase() > logicalToken1Addr.toLowerCase();

    return {
      poolAddress,
      tokensInverted,
      ...mintResult
    };
  }
}

module.exports = PoolManager;
