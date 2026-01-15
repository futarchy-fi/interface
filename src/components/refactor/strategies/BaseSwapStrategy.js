import { ethers } from 'ethers';
import { ERC20_ABI } from '../abis';

/**
 * Base Strategy Class - Template Method Pattern
 * Defines the common interface and workflow for all swap strategies
 */
export class BaseSwapStrategy {
  constructor(signer, config = {}) {
    this.signer = signer;
    this.config = config;
    this.name = 'BaseSwap';
    this.callbacks = config.callbacks || {};
  }

  /**
   * Set callbacks for notifications
   */
  setCallbacks(callbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Template Method - Common swap execution flow
   * This is the main public method that orchestrates the swap
   */
  async executeSwap(params) {
    try {
      // Step 1: Validate parameters
      await this.validateParams(params);
      
      // Step 2: Check and handle approvals
      const approvalNeeded = await this.checkApproval(params);
      if (approvalNeeded) {
        await this.handleApproval(params);
      }
      
      // Step 3: Execute the actual swap (strategy-specific)
      const result = await this.performSwap(params);
      
      // Step 4: Track transaction (strategy-specific)
      const trackedResult = await this.trackTransaction(result, params);
      
      // Step 5: Process result
      return this.processResult(trackedResult, params);
      
    } catch (error) {
      throw this.handleError(error, params);
    }
  }

  /**
   * Abstract Methods - Must be implemented by concrete strategies
   */
  async performSwap(params) {
    throw new Error(`performSwap() must be implemented by ${this.constructor.name}`);
  }

  async estimateOutput(params) {
    throw new Error(`estimateOutput() must be implemented by ${this.constructor.name}`);
  }

  getRequiredApprovalAddress() {
    throw new Error(`getRequiredApprovalAddress() must be implemented by ${this.constructor.name}`);
  }

  /**
   * Transaction Tracking Methods - Can be overridden by strategies
   */
  async trackTransaction(result, params) {
    // Default implementation for regular transactions
    if (result.wait) {
      console.log(`${this.name}: Waiting for transaction confirmation...`);
      const receipt = await result.wait();
      return {
        ...result,
        receipt,
        confirmed: receipt.status === 1,
        explorerUrl: this.getExplorerUrl(result.hash)
      };
    }
    return result;
  }

  getExplorerUrl(hash) {
    // Default to Gnosis Scan
    return `https://gnosisscan.io/tx/${hash}`;
  }

  async getTransactionStatus(hash) {
    // Default implementation for checking transaction status
    try {
      const chainId = await this.getChainId();
      if (chainId === 100) { // Gnosis Chain
        const provider = new ethers.providers.JsonRpcProvider('https://rpc.gnosischain.com');
        const receipt = await provider.getTransactionReceipt(hash);
        return {
          status: receipt ? (receipt.status === 1 ? 'success' : 'failed') : 'pending',
          receipt,
          explorerUrl: this.getExplorerUrl(hash)
        };
      }
      return { status: 'unknown', explorerUrl: this.getExplorerUrl(hash) };
    } catch (error) {
      console.error('Error checking transaction status:', error);
      return { status: 'error', error: error.message };
    }
  }

  /**
   * Common Methods - Can be overridden by strategies if needed
   */
  async validateParams(params) {
    const { tokenIn, tokenOut, amount, userAddress } = params;
    
    if (!tokenIn || !tokenOut || !amount || !userAddress) {
      throw new Error('Missing required parameters: tokenIn, tokenOut, amount, userAddress');
    }
    
    if (!ethers.utils.isAddress(tokenIn) || !ethers.utils.isAddress(tokenOut)) {
      throw new Error('Invalid token addresses');
    }
    
    if (tokenIn.toLowerCase() === tokenOut.toLowerCase()) {
      throw new Error('Cannot swap token to itself');
    }
    
    if (ethers.BigNumber.from(amount).lte(0)) {
      throw new Error('Amount must be greater than 0');
    }
  }

  async checkApproval(params) {
    try {
      const { tokenIn, amount, userAddress } = params;
      const spenderAddress = this.getRequiredApprovalAddress();
      
      const tokenContract = new ethers.Contract(tokenIn, ERC20_ABI, this.signer);
      const allowance = await tokenContract.allowance(userAddress, spenderAddress);
      
      return allowance.lt(amount);
    } catch (error) {
      console.error('Error checking approval:', error);
      return true; // Default to requiring approval if check fails
    }
  }

  async handleApproval(params) {
    const { tokenIn, amount } = params;
    const spenderAddress = this.getRequiredApprovalAddress();
    
    console.log(`Approving ${this.name} for token:`, tokenIn);
    
    // Notify approval start
    this.callbacks.onApprovalStart?.(this.name, tokenIn);
    
    const tokenContract = new ethers.Contract(tokenIn, ERC20_ABI, this.signer);
    
    // Use max approval to avoid future approvals
    const tx = await tokenContract.approve(spenderAddress, ethers.constants.MaxUint256);
    
    // Track approval transaction
    console.log(`${this.name}: Approval transaction sent:`, tx.hash);
    const receipt = await tx.wait();
    
    if (receipt.status !== 1) {
      throw new Error('Approval transaction failed');
    }
    
    console.log(`${this.name} approval completed successfully`);
    
    // Notify approval completion
    this.callbacks.onApprovalComplete?.(this.name, tokenIn, tx.hash);
  }

  processResult(result, params) {
    // Default processing - can be overridden
    return {
      success: result.confirmed !== false, // Default to true unless explicitly false
      hash: result.hash,
      strategy: this.name,
      result,
      explorerUrl: result.explorerUrl,
      timestamp: Date.now(),
      // Include tracking info
      trackingInfo: {
        canTrack: !!result.wait || !!result.orderId,
        trackingMethod: result.orderId ? 'order_based' : 'transaction_based',
        trackingId: result.orderId || result.hash
      }
    };
  }

  handleError(error, params) {
    console.error(`${this.name} Error:`, error);
    
    // Common error processing
    let message = error.message || 'Unknown error occurred';
    
    if (message.includes('user rejected') || message.includes('User denied')) {
      message = 'Transaction rejected by user';
    } else if (message.includes('insufficient funds')) {
      message = 'Insufficient funds for transaction';
    }
    
    return new Error(`${this.name}: ${message}`);
  }

  /**
   * Helper method to get user address
   */
  async getUserAddress() {
    return await this.signer.getAddress();
  }

  /**
   * Helper method to get chain ID
   */
  async getChainId() {
    return await this.signer.getChainId();
  }
} 