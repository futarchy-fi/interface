import { ethers } from 'ethers';
import { BaseSwapStrategy } from './BaseSwapStrategy';
import { SWAPR_V3_ROUTER_ADDRESS } from '../constants/addresses';

const SWAPR_V3_ROUTER_ABI = [
  'function exactInputSingle((address tokenIn,address tokenOut,address recipient,uint256 deadline,uint256 amountIn,uint256 amountOutMinimum,uint160 limitSqrtPrice)) payable returns (uint256)'
];

const UNISWAP_V3_POOL_ABI = [
  "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
  "function token0() external view returns (address)",
  "function token1() external view returns (address)"
];

/**
 * Algebra (Swapr) Swap Strategy
 * Uses Swapr's V3 router for direct pool swaps
 */
export class AlgebraSwapStrategy extends BaseSwapStrategy {
  constructor(signer, config = {}) {
    super(signer, config);
    this.name = 'AlgebraSwap';
    this.routerAddress = SWAPR_V3_ROUTER_ADDRESS;
    this.slippageBps = config.slippageBps || 50; // Default 0.5% slippage
  }

  getRequiredApprovalAddress() {
    return this.routerAddress;
  }

  async performSwap(params) {
    const { tokenIn, tokenOut, amount, userAddress } = params;
    
    console.log('Executing Algebra swap:', { tokenIn, tokenOut, amount: amount.toString() });
    
    const routerContract = new ethers.Contract(
      this.routerAddress,
      SWAPR_V3_ROUTER_ABI,
      this.signer
    );

    // Convert amount to BigNumber if needed
    const amountIn = ethers.BigNumber.isBigNumber(amount) 
      ? amount 
      : ethers.utils.parseUnits(amount.toString(), 18);

    // Calculate minimum output amount with slippage protection
    const amountOutMinimum = await this.calculateMinOutput(params);

    const swapParams = {
      tokenIn,
      tokenOut,
      recipient: userAddress,
      deadline: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      amountIn,
      amountOutMinimum,
      limitSqrtPrice: 0 // No price limit
    };

    console.log('Algebra swap params:', swapParams);

    const tx = await routerContract.exactInputSingle(swapParams, {
      gasLimit: 350000,
      ...this.config.gasOptions
    });

    console.log(`Algebra swap transaction sent: ${tx.hash}`);
    return tx;
  }

  async trackTransaction(result, params) {
    console.log(`${this.name}: Tracking transaction ${result.hash}...`);
    
    try {
      // Wait for transaction confirmation
      const receipt = await result.wait();
      
      const success = receipt.status === 1;
      console.log(`${this.name}: Transaction ${success ? 'confirmed' : 'failed'} - ${result.hash}`);
      
      return {
        ...result,
        receipt,
        confirmed: success,
        explorerUrl: this.getExplorerUrl(result.hash),
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed?.toString(),
        timestamp: Date.now()
      };
    } catch (error) {
      console.error(`${this.name}: Transaction tracking failed:`, error);
      throw new Error(`Transaction failed: ${error.message}`);
    }
  }

  getExplorerUrl(hash) {
    // Gnosis Scan for Algebra/Swapr transactions
    return `https://gnosisscan.io/tx/${hash}`;
  }

  async getTransactionStatus(hash) {
    try {
      const provider = new ethers.providers.JsonRpcProvider('https://rpc.gnosischain.com');
      const receipt = await provider.getTransactionReceipt(hash);
      
      if (!receipt) {
        return {
          status: 'pending',
          explorerUrl: this.getExplorerUrl(hash)
        };
      }
      
      return {
        status: receipt.status === 1 ? 'success' : 'failed',
        receipt,
        explorerUrl: this.getExplorerUrl(hash),
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed?.toString()
      };
    } catch (error) {
      console.error('Error checking Algebra transaction status:', error);
      return { 
        status: 'error', 
        error: error.message,
        explorerUrl: this.getExplorerUrl(hash)
      };
    }
  }

  async estimateOutput(params) {
    try {
      // For Algebra, we need to calculate based on pool state
      const minOut = await this.calculateMinOutput(params);
      const estimatedOut = minOut.mul(10000).div(10000 - this.slippageBps); // Reverse slippage calculation
      
      return {
        estimatedOutput: estimatedOut.toString(),
        minOutput: minOut.toString(),
        slippageBps: this.slippageBps
      };
    } catch (error) {
      console.error('Error estimating Algebra output:', error);
      return null;
    }
  }

  async calculateMinOutput(params) {
    const { tokenIn, tokenOut, amount } = params;
    
    try {
      // Get pool price (this would need pool address mapping)
      const poolPrice = await this.getPoolPrice(tokenIn, tokenOut);
      
      if (!poolPrice) {
        // Fallback to zero minimum (market order)
        return ethers.BigNumber.from(0);
      }

      const amountIn = ethers.BigNumber.isBigNumber(amount) 
        ? amount 
        : ethers.utils.parseUnits(amount.toString(), 18);

      // Calculate expected output with slippage
      const expectedOutput = amountIn.mul(ethers.utils.parseUnits(poolPrice.toString(), 18))
        .div(ethers.constants.WeiPerEther);
      
      const minOutput = expectedOutput.mul(10000 - this.slippageBps).div(10000);
      
      return minOutput;
    } catch (error) {
      console.error('Error calculating min output:', error);
      return ethers.BigNumber.from(0); // Fallback to market order
    }
  }

  async getPoolPrice(tokenIn, tokenOut) {
    try {
      // This would need a mapping of token pairs to pool addresses
      // For now, return null to use market orders
      console.log('Pool price lookup not implemented for:', { tokenIn, tokenOut });
      return null;
    } catch (error) {
      console.error('Error getting pool price:', error);
      return null;
    }
  }

  processResult(result, params) {
    return {
      ...super.processResult(result, params),
      type: 'direct_swap',
      router: this.routerAddress,
      slippageBps: this.slippageBps,
      waitForConfirmation: true, // Algebra swaps need confirmation
      // Additional tracking info for direct transactions
      trackingInfo: {
        ...super.processResult(result, params).trackingInfo,
        blockNumber: result.blockNumber,
        gasUsed: result.gasUsed,
        explorerUrl: result.explorerUrl
      }
    };
  }

  handleError(error, params) {
    // Add Algebra-specific error handling
    let message = error.message;
    
    if (message.includes('STF')) {
      message = 'Insufficient liquidity or slippage too high';
    } else if (message.includes('Too little received')) {
      message = 'Slippage exceeded, try increasing slippage tolerance';
    } else if (message.includes('Transaction failed')) {
      message = 'Transaction was reverted on-chain';
    }
    
    return new Error(`AlgebraSwap: ${message}`);
  }
} 