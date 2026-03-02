const { ethers } = require('ethers');
const constants = require('../contracts/constants');

class TokenManager {
  constructor(provider, wallet) {
    this.provider = provider;
    this.wallet = wallet;
    this.tokenCache = new Map();
  }

  // Load token information and cache it
  async loadToken(address) {
    // Normalize address for consistent cache keys
    const checksum = ethers.getAddress(address);
    const key = checksum.toLowerCase();
    if (this.tokenCache.has(key)) {
      return this.tokenCache.get(key);
    }

    const contract = new ethers.Contract(
      checksum,
      [
        'function symbol() view returns (string)',
        'function decimals() view returns (uint8)',
        'function balanceOf(address) view returns (uint256)',
        'function allowance(address,address) view returns (uint256)',
        'function approve(address,uint256) returns (bool)'
      ],
      this.wallet
    );

    const [symbol, decimals] = await Promise.all([
      contract.symbol(),
      contract.decimals()
    ]);

    const token = {
      address: checksum,
      contract,
      symbol,
      decimals,
      balance: 0n
    };

    this.tokenCache.set(key, token);
    return token;
  }

  // Get fresh balance from blockchain
  async getBalance(tokenAddress, walletAddress = null) {
    const token = await this.loadToken(tokenAddress);
    const address = walletAddress || this.wallet.address;
    const balance = await token.contract.balanceOf(address);
    token.balance = balance;
    return balance;
  }

  // Refresh multiple token balances
  async refreshBalances(tokenAddresses) {
    const unique = Array.from(new Set(
      tokenAddresses.map(a => ethers.getAddress(a).toLowerCase())
    ));
    return Promise.all(unique.map(addr => this.getBalance(addr)));
  }

  // Ensure token allowance
  async ensureAllowance(tokenAddress, spenderAddress, amount, spenderName = 'Contract') {
    const token = await this.loadToken(tokenAddress);
    const currentAllowance = await token.contract.allowance(this.wallet.address, spenderAddress);
    
    if (currentAllowance < amount) {
      console.log(`\n📝 Approving ${spenderName} to spend ${ethers.formatUnits(amount, token.decimals)} ${token.symbol}`);
      
      // First reset to 0 if needed (for tokens that require it)
      if (currentAllowance > 0n) {
        // Use EIP-1559 fees if available; adjust minimum tip based on chain
        const feeData = await this.provider.getFeeData().catch(() => ({}));
        // Use lower minimums for Ethereum (chainId 1), higher for Polygon (chainId 137)
        const chainId = (await this.provider.getNetwork()).chainId;
        // Ultra-low for Ethereum when gas is cheap, normal for Polygon
        const minTipGwei = chainId === 1n ? '0.04' : (chainId === 137n ? '25' : '2');
        const minTip = ethers.parseUnits(minTipGwei, 'gwei');
        let maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ?? minTip;
        if (maxPriorityFeePerGas < minTip) maxPriorityFeePerGas = minTip;
        let maxFeePerGas = feeData.maxFeePerGas ?? (maxPriorityFeePerGas * 2n);
        if (maxFeePerGas < maxPriorityFeePerGas * 2n) maxFeePerGas = maxPriorityFeePerGas * 2n;
        const feeOpts = (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas)
          ? { maxFeePerGas, maxPriorityFeePerGas }
          : { gasPrice: ethers.parseUnits(String(Math.max(Number(constants.GAS_PRICE_GWEI), 25)), 'gwei') };
        const resetTx = await token.contract.approve(spenderAddress, 0, {
          gasLimit: constants.GAS_SETTINGS.APPROVE,
          ...feeOpts
        });
        await resetTx.wait();
      }
      
      // Approve the required amount
      const feeData2 = await this.provider.getFeeData().catch(() => ({}));
      // Use same chain-based minimum as above
      const chainId2 = (await this.provider.getNetwork()).chainId;
      const minTipGwei2 = chainId2 === 1n ? '0.04' : (chainId2 === 137n ? '25' : '2');
      const minTip2 = ethers.parseUnits(minTipGwei2, 'gwei');
      let maxPriorityFeePerGas2 = feeData2.maxPriorityFeePerGas ?? minTip2;
      if (maxPriorityFeePerGas2 < minTip2) maxPriorityFeePerGas2 = minTip2;
      let maxFeePerGas2 = feeData2.maxFeePerGas ?? (maxPriorityFeePerGas2 * 2n);
      if (maxFeePerGas2 < maxPriorityFeePerGas2 * 2n) maxFeePerGas2 = maxPriorityFeePerGas2 * 2n;
      const feeOpts2 = (feeData2.maxFeePerGas && feeData2.maxPriorityFeePerGas)
        ? { maxFeePerGas: maxFeePerGas2, maxPriorityFeePerGas: maxPriorityFeePerGas2 }
        : { gasPrice: ethers.parseUnits(String(Math.max(Number(constants.GAS_PRICE_GWEI), 25)), 'gwei') };
      const approveTx = await token.contract.approve(spenderAddress, amount, {
        gasLimit: constants.GAS_SETTINGS.APPROVE,
        ...feeOpts2
      });
      console.log(`   Approval tx: ${approveTx.hash}`);
      await approveTx.wait();
      console.log(`   ✅ Approved`);
    } else {
      console.log(`✅ ${spenderName} already approved to spend ${ethers.formatUnits(amount, token.decimals)} ${token.symbol} (current: ${ethers.formatUnits(currentAllowance, token.decimals)})`);
    }
  }

  // Token ordering for AMM
  getAMMOrder(token0Address, token1Address) {
    const addr0 = ethers.getAddress(token0Address);
    const addr1 = ethers.getAddress(token1Address);
    const isLogicalOrderSameAsAMM = addr0.toLowerCase() < addr1.toLowerCase();
    
    if (isLogicalOrderSameAsAMM) {
      return {
        ammToken0: addr0,
        ammToken1: addr1,
        needsReorder: false
      };
    } else {
      return {
        ammToken0: addr1,
        ammToken1: addr0,
        needsReorder: true
      };
    }
  }

  // Format token amount for display
  formatAmount(amount, decimals) {
    return ethers.formatUnits(amount, decimals);
  }

  // Parse token amount from string
  parseAmount(amountStr, decimals) {
    return ethers.parseUnits(amountStr, decimals);
  }
}

module.exports = TokenManager;
