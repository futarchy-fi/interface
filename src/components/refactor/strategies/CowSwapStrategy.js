import { ethers } from 'ethers';
import { BaseSwapStrategy } from './BaseSwapStrategy';
import { CowSdk, OrderKind } from '@gnosis.pm/cow-sdk';
import { COW_VAULT_RELAYER_ADDRESS, BASE_TOKENS_CONFIG } from '../constants/addresses';

/**
 * CoW Swap Strategy
 * Uses CoW Protocol for gasless, MEV-protected swaps
 */
export class CowSwapStrategy extends BaseSwapStrategy {
  constructor(signer, config = {}) {
    super(signer, config);
    this.name = 'CowSwap';
    this.vaultRelayer = COW_VAULT_RELAYER_ADDRESS;
    this.validityDuration = config.validityDuration || 3600; // 1 hour default
  }

  getRequiredApprovalAddress() {
    return this.vaultRelayer;
  }

  async performSwap(params) {
    const { tokenIn, tokenOut, amount, userAddress } = params;
    
    console.log('Executing CoW swap:', { tokenIn, tokenOut, amount: amount.toString() });
    
    const chainId = await this.getChainId();
    
    // Only support Gnosis Chain for now
    if (chainId !== 100) {
      throw new Error(`CoW Swap not supported on chain ID ${chainId}. Use Gnosis Chain (100).`);
    }

    const cowSdk = new CowSdk(chainId, { signer: this.signer });
    
    // Step 1: Get quote from CoW API
    const quote = await this.getQuote(params, cowSdk);
    
    // Step 2: Create order from quote
    const order = await this.createOrder(quote, params);
    
    // Step 3: Sign order
    const signedOrder = await cowSdk.signOrder(order);
    
    // Step 4: Submit order
    const orderId = await cowSdk.cowApi.sendOrder({
      order: { ...order, ...signedOrder },
      owner: userAddress
    });

    console.log(`CoW order submitted: ${orderId}`);
    
    // Return order-based result for tracking
    return {
      hash: orderId, // Use orderId as hash for consistency
      orderId,
      order: { ...order, ...signedOrder },
      isOrderBased: true,
      wait: () => this.createOrderWaitFunction(orderId) // Custom wait for orders
    };
  }

  async trackTransaction(result, params) {
    if (!result.isOrderBased) {
      return super.trackTransaction(result, params);
    }

    console.log(`${this.name}: Tracking CoW order ${result.orderId}...`);
    
    try {
      // For CoW orders, we track the order status rather than transaction receipt
      const orderStatus = await this.pollOrderStatus(result.orderId);
      
      return {
        ...result,
        orderStatus,
        confirmed: orderStatus.status === 'fulfilled',
        explorerUrl: this.getExplorerUrl(result.orderId),
        timestamp: Date.now()
      };
    } catch (error) {
      console.error(`${this.name}: Order tracking failed:`, error);
      throw new Error(`Order tracking failed: ${error.message}`);
    }
  }

  async pollOrderStatus(orderId, maxAttempts = 20, intervalMs = 5000) {
    const chainId = await this.getChainId();
    const cowSdk = new CowSdk(chainId);
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const orderStatus = await cowSdk.cowApi.getOrder(orderId);
        console.log(`${this.name}: Order ${orderId} status: ${orderStatus.status}`);
        
        // Check if order is in a final state
        if (['fulfilled', 'cancelled', 'expired'].includes(orderStatus.status)) {
          return orderStatus;
        }
        
        // If still pending, wait before next check
        if (attempt < maxAttempts - 1) {
          console.log(`${this.name}: Order pending, checking again in ${intervalMs/1000}s...`);
          await new Promise(resolve => setTimeout(resolve, intervalMs));
        }
      } catch (error) {
        console.error(`${this.name}: Error checking order status:`, error);
        if (attempt === maxAttempts - 1) {
          throw error;
        }
      }
    }
    
    // If we've exhausted attempts, return pending status
    return { status: 'pending', orderId };
  }

  createOrderWaitFunction(orderId) {
    return async () => {
      const orderStatus = await this.pollOrderStatus(orderId);
      return {
        status: orderStatus.status === 'fulfilled' ? 1 : 0,
        transactionHash: orderStatus.txHash || orderId,
        confirmations: orderStatus.status === 'fulfilled' ? 1 : 0,
        orderStatus
      };
    };
  }

  getExplorerUrl(orderIdOrHash) {
    // CoW Protocol explorer for orders
    if (orderIdOrHash.startsWith('0x') && orderIdOrHash.length === 66) {
      // This looks like an order ID
      return `https://explorer.cow.fi/gc/orders/${orderIdOrHash}`;
    } else {
      // This might be a transaction hash
      return `https://gnosisscan.io/tx/${orderIdOrHash}`;
    }
  }

  async getTransactionStatus(orderIdOrHash) {
    try {
      const chainId = await this.getChainId();
      const cowSdk = new CowSdk(chainId);
      
      // Try to get order status first
      try {
        const orderStatus = await cowSdk.cowApi.getOrder(orderIdOrHash);
        return {
          status: orderStatus.status === 'fulfilled' ? 'success' : 
                  orderStatus.status === 'cancelled' ? 'failed' : 'pending',
          orderStatus,
          explorerUrl: this.getExplorerUrl(orderIdOrHash),
          txHash: orderStatus.txHash
        };
      } catch (orderError) {
        // If order lookup fails, try as transaction hash
        return super.getTransactionStatus(orderIdOrHash);
      }
    } catch (error) {
      console.error('Error checking CoW order/transaction status:', error);
      return { 
        status: 'error', 
        error: error.message,
        explorerUrl: this.getExplorerUrl(orderIdOrHash)
      };
    }
  }

  async getQuote(params, cowSdk) {
    const { tokenIn, tokenOut, amount, userAddress } = params;
    
    const amountStr = ethers.BigNumber.isBigNumber(amount) 
      ? amount.toString() 
      : ethers.utils.parseUnits(amount.toString(), 18).toString();

    // Use direct API call for more control
    const quoteParams = {
      kind: OrderKind.SELL,
      sellToken: tokenIn,
      buyToken: tokenOut,
      sellAmountBeforeFee: amountStr,
      from: userAddress,
      receiver: userAddress,
      appData: JSON.stringify({
        appCode: 'FutarchyRefactor',
        environment: 'production',
        metadata: { orderClass: { orderClass: 'market' } }
      }),
      partiallyFillable: false,
      sellTokenBalance: 'erc20',
      buyTokenBalance: 'erc20',
      signingScheme: 'eip712',
      onchainOrder: false,
      priceQuality: 'verified',
      validTo: Math.floor(Date.now() / 1000) + this.validityDuration
    };

    console.log('CoW quote params:', quoteParams);

    const response = await fetch('https://api.cow.fi/xdai/api/v1/quote', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(quoteParams)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`CoW quote failed: ${response.status} ${errorText.substring(0, 200)}`);
    }

    const responseData = await response.json();
    const quote = responseData.quote;

    if (!quote || !quote.buyAmount || !quote.sellAmount) {
      throw new Error('Invalid CoW quote received');
    }

    console.log('CoW quote received:', quote);
    return quote;
  }

  async createOrder(quote, params) {
    const { amount } = params;
    
    const amountStr = ethers.BigNumber.isBigNumber(amount) 
      ? amount.toString() 
      : ethers.utils.parseUnits(amount.toString(), 18).toString();

    return {
      kind: OrderKind.SELL,
      partiallyFillable: false,
      sellToken: quote.sellToken,
      buyToken: quote.buyToken,
      receiver: quote.receiver,
      sellAmount: amountStr,
      buyAmount: quote.buyAmount,
      validTo: quote.validTo,
      appData: quote.appData,
      feeAmount: "0" // Force fee to 0 as per existing logic
    };
  }

  async estimateOutput(params) {
    try {
      const chainId = await this.getChainId();
      if (chainId !== 100) return null;

      const cowSdk = new CowSdk(chainId, { signer: this.signer });
      const quote = await this.getQuote(params, cowSdk);
      
      return {
        estimatedOutput: quote.buyAmount,
        sellAmount: quote.sellAmount,
        feeAmount: quote.feeAmount,
        price: this.calculatePrice(quote.sellAmount, quote.buyAmount)
      };
    } catch (error) {
      console.error('Error estimating CoW output:', error);
      return null;
    }
  }

  calculatePrice(sellAmount, buyAmount) {
    if (!sellAmount || !buyAmount) return '0';
    
    const sellBN = ethers.BigNumber.from(sellAmount);
    const buyBN = ethers.BigNumber.from(buyAmount);
    
    if (sellBN.isZero()) return '0';
    
    const price = buyBN.mul(ethers.constants.WeiPerEther).div(sellBN);
    return ethers.utils.formatUnits(price, 18);
  }

  processResult(result, params) {
    return {
      ...super.processResult(result, params),
      type: 'order_based',
      orderId: result.orderId,
      vaultRelayer: this.vaultRelayer,
      needsPolling: true, // CoW orders need status polling
      waitForConfirmation: false, // Don't wait in the standard way
      // Additional tracking info for orders
      trackingInfo: {
        ...super.processResult(result, params).trackingInfo,
        orderId: result.orderId,
        orderStatus: result.orderStatus,
        explorerUrl: result.explorerUrl,
        trackingMethod: 'order_based'
      }
    };
  }

  handleError(error, params) {
    let message = error.message;
    
    // CoW-specific error handling
    if (error.response?.data?.description) {
      message = `CoW API Error: ${error.response.data.description}`;
    } else if (message.includes('insufficient liquidity')) {
      message = 'Insufficient liquidity for this trade size';
    } else if (message.includes('price too low')) {
      message = 'Current market price is below your minimum acceptable price';
    } else if (message.includes('Order tracking failed')) {
      message = 'Unable to track order status - order may still be processing';
    }
    
    return new Error(`CowSwap: ${message}`);
  }
} 