const { ethers } = require('ethers');
const constants = require('../contracts/constants');

class FutarchyAdapter {
  constructor(wallet, tokenManager, adapterAddress = null) {
    this.wallet = wallet;
    this.tokenManager = tokenManager;
    this.adapterAddress = adapterAddress || constants.DEFAULT_ADAPTER;
    
    // Initialize adapter contract
    this.adapter = new ethers.Contract(
      this.adapterAddress,
      [
        'function splitPosition(address,address,uint256)',
        'function mergePositions(address,address,uint256)'
      ],
      wallet
    );
  }

  // Split collateral into YES/NO tokens
  async splitTokens(params) {
    const {
      proposalAddress,
      collateralAddress,
      amount,
      collateralSymbol = 'Token',
      gasOptions = {}
    } = params;

    // Load collateral token metadata for correct decimals in logs
    let collDecimals = 18;
    try {
      const info = await this.tokenManager.loadToken(collateralAddress);
      collDecimals = info.decimals;
    } catch {}

    console.log(`\n🔄 Splitting ${collateralSymbol} into YES/NO tokens:`);
    console.log(`  Amount: ${ethers.formatUnits(amount, collDecimals)} ${collateralSymbol}`);
    
    // Ensure allowance for adapter
    await this.tokenManager.ensureAllowance(
      collateralAddress,
      this.adapterAddress,
      amount,
      'Futarchy Adapter'
    );

    // Execute split
    // Use EIP-1559 with chain-appropriate minimum priority fee
    const feeData = await this.wallet.provider.getFeeData().catch(() => ({}));
    const chainId = (await this.wallet.provider.getNetwork()).chainId;
    // Ultra-low for Ethereum when gas is cheap, higher for Polygon
    const minTipGwei = chainId === 1n ? '0.04' : (chainId === 137n ? '25' : '2');
    const minTip = ethers.parseUnits(minTipGwei, 'gwei');
    let maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ?? minTip;
    if (maxPriorityFeePerGas < minTip) maxPriorityFeePerGas = minTip;
    let maxFeePerGas = feeData.maxFeePerGas ?? (maxPriorityFeePerGas * 2n);
    if (maxFeePerGas < maxPriorityFeePerGas * 2n) maxFeePerGas = maxPriorityFeePerGas * 2n;

    // Estimate gas and add buffer
    let splitGasLimit = gasOptions.gasLimit || constants.GAS_SETTINGS.SPLIT;
    try {
      if (this.adapter.estimateGas && this.adapter.estimateGas.splitPosition) {
        const est = await this.adapter.estimateGas.splitPosition(proposalAddress, collateralAddress, amount);
        // 30% buffer + 50k fixed overhead
        splitGasLimit = ((est * 130n) / 100n) + 50000n;
      }
    } catch (_) {}

    const tx = await this.adapter.splitPosition(
      proposalAddress,
      collateralAddress,
      amount,
      {
        gasLimit: splitGasLimit,
        maxFeePerGas,
        maxPriorityFeePerGas,
        ...gasOptions
      }
    );

    console.log(`  Transaction: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`  ✅ Split complete - received YES and NO tokens`);

    return {
      transactionHash: tx.hash,
      receipt,
      yesAmount: amount,
      noAmount: amount
    };
  }

  // Merge YES/NO tokens back to collateral
  async mergeTokens(params) {
    const {
      proposalAddress,
      collateralAddress,
      amount,
      yesTokenAddress,
      noTokenAddress,
      collateralSymbol = 'Token',
      gasOptions = {}
    } = params;

    let collDecimals = 18;
    try {
      const info = await this.tokenManager.loadToken(collateralAddress);
      collDecimals = info.decimals;
    } catch {}

    console.log(`\n🔄 Merging YES/NO tokens back to ${collateralSymbol}:`);
    console.log(`  Amount: ${ethers.formatUnits(amount, collDecimals)} each`);

    // Ensure allowances for both YES and NO tokens
    await Promise.all([
      this.tokenManager.ensureAllowance(
        yesTokenAddress,
        this.adapterAddress,
        amount,
        'Futarchy Adapter (YES)'
      ),
      this.tokenManager.ensureAllowance(
        noTokenAddress,
        this.adapterAddress,
        amount,
        'Futarchy Adapter (NO)'
      )
    ]);

    // Execute merge with chain-appropriate gas settings
    const feeData2 = await this.wallet.provider.getFeeData().catch(() => ({}));
    const chainId = (await this.wallet.provider.getNetwork()).chainId;
    const minTipGwei = chainId === 1n ? '0.04' : (chainId === 137n ? '25' : '2');
    const minTip = ethers.parseUnits(minTipGwei, 'gwei');
    let maxPriorityFeePerGas2 = feeData2.maxPriorityFeePerGas ?? minTip;
    if (maxPriorityFeePerGas2 < minTip) maxPriorityFeePerGas2 = minTip;
    let maxFeePerGas2 = feeData2.maxFeePerGas ?? (maxPriorityFeePerGas2 * 2n);
    if (maxFeePerGas2 < maxPriorityFeePerGas2 * 2n) maxFeePerGas2 = maxPriorityFeePerGas2 * 2n;

    // Estimate gas and add buffer for merge
    let mergeGasLimit = gasOptions.gasLimit || constants.GAS_SETTINGS.MERGE;
    try {
      if (this.adapter.estimateGas && this.adapter.estimateGas.mergePositions) {
        const est2 = await this.adapter.estimateGas.mergePositions(proposalAddress, collateralAddress, amount);
        mergeGasLimit = ((est2 * 130n) / 100n) + 50000n;
      }
    } catch (_) {}

    const tx = await this.adapter.mergePositions(
      proposalAddress,
      collateralAddress,
      amount,
      {
        gasLimit: mergeGasLimit,
        maxFeePerGas: maxFeePerGas2,
        maxPriorityFeePerGas: maxPriorityFeePerGas2,
        ...gasOptions
      }
    );

    console.log(`  Transaction: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`  ✅ Merge complete - received ${collateralSymbol}`);

    return {
      transactionHash: tx.hash,
      receipt,
      collateralAmount: amount
    };
  }

  // Check and split if needed to obtain required conditional tokens
  async ensureConditionalTokens(params) {
    const {
      proposalAddress,
      collateralAddress,
      conditionalTokenAddress,
      requiredAmount,
      isYesToken,
      collateralSymbol = 'Token'
    } = params;

    const tokenSymbol = `${isYesToken ? 'YES' : 'NO'}-${collateralSymbol}`;
    console.log(`\n🔍 PRECISE BALANCE CHECK FOR ${tokenSymbol}...`);

    // STEP 0: Load token metadata for proper decimals handling
    const condInfo = await this.tokenManager.loadToken(conditionalTokenAddress);
    const collInfo = await this.tokenManager.loadToken(collateralAddress);

    // STEP 1: Refresh balances for both tokens
    console.log(`  📊 Refreshing balances before calculations...`);
    await this.tokenManager.refreshBalances([conditionalTokenAddress, collateralAddress]);
    
    // STEP 2: Get fresh balance from blockchain
    const currentBalance = await this.tokenManager.getBalance(conditionalTokenAddress);
    const collateralBalance = await this.tokenManager.getBalance(collateralAddress);
    
    console.log(`  🔍 Balance verification:`);
    console.log(`    ${tokenSymbol}: ${ethers.formatUnits(currentBalance, condInfo.decimals)} (${condInfo.decimals}d)`);
    console.log(`    ${collateralSymbol}: ${ethers.formatUnits(collateralBalance, collInfo.decimals)} (${collInfo.decimals}d)`);
    
    // STEP 3: Check if we already have enough
    if (currentBalance >= requiredAmount) {
      console.log(`  ✅ Sufficient ${tokenSymbol} balance already available`);
      return currentBalance;
    }

    // STEP 4: Calculate how much to split (convert conditional shortfall to collateral units)
    const shortfallConditional = requiredAmount - currentBalance;
    // Scale amount from conditional decimals to collateral decimals
    const scale = (amt, fromD, toD) => {
      const diff = Number(toD) - Number(fromD);
      if (diff === 0) return amt;
      if (diff > 0) return amt * (10n ** BigInt(diff));
      return amt / (10n ** BigInt(-diff));
    };
    let shortfallCollateral = scale(shortfallConditional, condInfo.decimals, collInfo.decimals);
    if (shortfallCollateral === 0n) shortfallCollateral = 1n; // ensure non-zero minimal split

    console.log(`\n⚠️  Insufficient ${tokenSymbol}:`);
    console.log(`  Required (cond): ${ethers.formatUnits(requiredAmount, condInfo.decimals)}`);
    console.log(`  Current  (cond): ${ethers.formatUnits(currentBalance, condInfo.decimals)}`);
    console.log(`  Need to split (coll): ${ethers.formatUnits(shortfallCollateral, collInfo.decimals)} ${collateralSymbol}`);

    // STEP 5: Check if we have enough collateral
    if (collateralBalance < shortfallCollateral) {
      console.error(`  ❌ INSUFFICIENT ${collateralSymbol} BALANCE:`);
      console.error(`    Have: ${ethers.formatUnits(collateralBalance, collInfo.decimals)}`);
      console.error(`    Need: ${ethers.formatUnits(shortfallCollateral, collInfo.decimals)}`);
      throw new Error(
        `Insufficient ${collateralSymbol} balance. Have: ${ethers.formatUnits(collateralBalance, collInfo.decimals)}, Need: ${ethers.formatUnits(shortfallCollateral, collInfo.decimals)}`
      );
    }

    // STEP 6: Split the required amount
    console.log(`\n🔄 SPLITTING ${collateralSymbol} TO OBTAIN ${tokenSymbol}...`);
    await this.splitTokens({
      proposalAddress,
      collateralAddress,
      amount: shortfallCollateral,
      collateralSymbol
    });

    // STEP 7: Refresh and verify new balances
    console.log(`\n📊 Verifying balances after split...`);
    
    // Refresh balances for the tokens we care about
    await this.tokenManager.refreshBalances([conditionalTokenAddress, collateralAddress]);
    
    const newConditionalBalance = await this.tokenManager.getBalance(conditionalTokenAddress);
    const newCollateralBalance = await this.tokenManager.getBalance(collateralAddress);
    
    console.log(`  📊 Updated balances after split:`);
    console.log(`    ${tokenSymbol}: ${ethers.formatUnits(newConditionalBalance, condInfo.decimals)}`);
    console.log(`    ${collateralSymbol}: ${ethers.formatUnits(newCollateralBalance, collInfo.decimals)}`);
    
    // STEP 8: Final verification
    if (newConditionalBalance >= requiredAmount) {
      console.log(`  ✅ SUCCESS: Now have sufficient ${tokenSymbol} balance for operation`);
    } else {
      console.warn(`  ⚠️  WARNING: Split completed but still insufficient ${tokenSymbol}`);
      console.warn(`    Have: ${ethers.formatUnits(newConditionalBalance, condInfo.decimals)}`);
      console.warn(`    Need: ${ethers.formatUnits(requiredAmount, condInfo.decimals)}`);
    }
    
    return newConditionalBalance;
  }
}

module.exports = FutarchyAdapter;
