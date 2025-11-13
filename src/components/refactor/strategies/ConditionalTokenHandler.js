import { ethers } from 'ethers';
import { getTokenBalance } from '../utils/balanceUtils';

/**
 * Smart Conditional Token Handler
 * Chain of Responsibility pattern for handling conditional token swaps
 * 
 * Flow: Check Balance → Check Collateral → Suggest Split → Execute Split → Proceed to Swap
 */
export class ConditionalTokenHandler {
  constructor(balancesHook, collateralHook) {
    this.balancesHook = balancesHook;
    this.collateralHook = collateralHook;
    this.callbacks = {};
  }

  setCallbacks(callbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Main entry point - analyze token requirements and suggest actions
   * @param {Object} params - Swap parameters
   * @returns {Promise<Object>} Analysis result with suggested actions
   */
  async analyzeTokenRequirements(params) {
    const { tokenIn, amount, userAddress } = params;

    // Step 1: Identify token type
    const tokenType = this.identifyTokenType(tokenIn);
    
    if (tokenType.isConditional) {
      return await this.handleConditionalToken(params, tokenType);
    } else {
      return await this.handleRegularToken(params);
    }
  }

  /**
   * Handle conditional token (YES_/NO_ tokens) requirements
   */
  async handleConditionalToken(params, tokenType) {
    const { tokenIn, amount, userAddress } = params;
    
    try {
      // Step 1: Check current conditional token balance
      const currentBalance = await this.getCurrentBalance(tokenIn, userAddress);
      const requiredAmount = ethers.BigNumber.from(amount);
      const currentBalanceBN = ethers.utils.parseUnits(currentBalance, 18);

      console.log(`Conditional token analysis:`, {
        token: tokenType,
        required: ethers.utils.formatUnits(requiredAmount, 18),
        current: currentBalance
      });

      if (currentBalanceBN.gte(requiredAmount)) {
        // Sufficient balance - proceed normally
        return {
          sufficient: true,
          tokenType,
          currentBalance,
          actions: []
        };
      }

      // Step 2: Calculate shortage and check collateral availability
      const shortage = requiredAmount.sub(currentBalanceBN);
      const collateralAnalysis = await this.analyzeCollateralAvailability(tokenType, shortage, userAddress);

      if (collateralAnalysis.canSplit) {
        // We can split collateral to get the missing tokens
        return {
          sufficient: false,
          tokenType,
          currentBalance,
          shortage: ethers.utils.formatUnits(shortage, 18),
          canAutoSplit: true,
          collateralAvailable: collateralAnalysis.available,
          splitAmount: ethers.utils.formatUnits(shortage, 18),
          actions: [
            {
              type: 'SPLIT_COLLATERAL',
              description: `Split ${ethers.utils.formatUnits(shortage, 18)} ${collateralAnalysis.collateralSymbol} to get missing ${tokenType.symbol}`,
              collateralType: collateralAnalysis.collateralType,
              amount: ethers.utils.formatUnits(shortage, 18),
              executable: true
            }
          ]
        };
      } else {
        // Not enough collateral to split
        return {
          sufficient: false,
          tokenType,
          currentBalance,
          shortage: ethers.utils.formatUnits(shortage, 18),
          canAutoSplit: false,
          collateralAvailable: collateralAnalysis.available,
          actions: [
            {
              type: 'INSUFFICIENT_FUNDS',
              description: `Need ${ethers.utils.formatUnits(shortage, 18)} more ${tokenType.symbol}. Consider acquiring more ${collateralAnalysis.collateralSymbol} first.`,
              collateralType: collateralAnalysis.collateralType,
              executable: false
            }
          ]
        };
      }

    } catch (error) {
      console.error('Error analyzing conditional token requirements:', error);
      return {
        sufficient: false,
        error: error.message,
        actions: []
      };
    }
  }

  /**
   * Handle regular token requirements
   */
  async handleRegularToken(params) {
    const { tokenIn, amount, userAddress } = params;
    
    try {
      const currentBalance = await this.getCurrentBalance(tokenIn, userAddress);
      const requiredAmount = ethers.BigNumber.from(amount);
      const currentBalanceBN = ethers.utils.parseUnits(currentBalance, 18);

      return {
        sufficient: currentBalanceBN.gte(requiredAmount),
        tokenType: { isConditional: false, symbol: 'REGULAR' },
        currentBalance,
        actions: currentBalanceBN.gte(requiredAmount) ? [] : [
          {
            type: 'INSUFFICIENT_FUNDS',
            description: `Insufficient balance. Need ${ethers.utils.formatUnits(requiredAmount.sub(currentBalanceBN), 18)} more tokens.`,
            executable: false
          }
        ]
      };
    } catch (error) {
      return {
        sufficient: false,
        error: error.message,
        actions: []
      };
    }
  }

  /**
   * Execute suggested actions (like collateral splitting)
   */
  async executeAction(action, params) {
    try {
      console.log('ConditionalTokenHandler: Starting executeAction:', action.type);
      this.callbacks.onActionStart?.(action);

      let result;
      switch (action.type) {
        case 'SPLIT_COLLATERAL':
          result = await this.executeSplitCollateral(action, params);
          break;
        
        default:
          throw new Error(`Unknown action type: ${action.type}`);
      }

      console.log('ConditionalTokenHandler: executeAction completed:', result);
      return result;
    } catch (error) {
      console.error('ConditionalTokenHandler: executeAction failed:', error);
      this.callbacks.onActionError?.(error, action);
      throw error;
    }
  }

  /**
   * Execute collateral splitting
   */
  async executeSplitCollateral(action, params) {
    try {
      this.callbacks.onActionProgress?.('Preparing collateral split...');
      
      // Use the collateral hook to split
      console.log('Executing collateral split action:', action);
      this.callbacks.onActionProgress?.('Executing collateral split transaction...');
      
      const success = await this.collateralHook.handleAddCollateral(
        action.collateralType,
        action.amount
      );

      if (success) {
        this.callbacks.onActionProgress?.('Collateral split completed successfully');
        this.callbacks.onActionComplete?.(action);
        return { success: true, action };
      } else {
        throw new Error('Collateral splitting transaction failed');
      }
    } catch (error) {
      console.error('Split collateral execution failed:', error);
      this.callbacks.onActionProgress?.(`Split failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Identify token type (conditional vs regular)
   */
  identifyTokenType(tokenAddress) {
    const metadata = this.balancesHook.metadata;
    
    // Check if it's a YES token
    if (metadata.currencyYes?.address?.toLowerCase() === tokenAddress.toLowerCase()) {
      return {
        isConditional: true,
        type: 'YES',
        category: 'currency',
        symbol: metadata.currencyYes.symbol,
        name: metadata.currencyYes.name,
        underlyingToken: metadata.baseCurrency,
        balanceKey: 'currencyYes'
      };
    }
    
    if (metadata.currencyNo?.address?.toLowerCase() === tokenAddress.toLowerCase()) {
      return {
        isConditional: true,
        type: 'NO',
        category: 'currency',
        symbol: metadata.currencyNo.symbol,
        name: metadata.currencyNo.name,
        underlyingToken: metadata.baseCurrency,
        balanceKey: 'currencyNo'
      };
    }
    
    if (metadata.companyYes?.address?.toLowerCase() === tokenAddress.toLowerCase()) {
      return {
        isConditional: true,
        type: 'YES',
        category: 'company',
        symbol: metadata.companyYes.symbol,
        name: metadata.companyYes.name,
        underlyingToken: metadata.baseCompany,
        balanceKey: 'companyYes'
      };
    }
    
    if (metadata.companyNo?.address?.toLowerCase() === tokenAddress.toLowerCase()) {
      return {
        isConditional: true,
        type: 'NO',
        category: 'company',
        symbol: metadata.companyNo.symbol,
        name: metadata.companyNo.name,
        underlyingToken: metadata.baseCompany,
        balanceKey: 'companyNo'
      };
    }

    return {
      isConditional: false,
      type: 'REGULAR',
      symbol: 'UNKNOWN'
    };
  }

  /**
   * Analyze collateral availability for splitting
   */
  async analyzeCollateralAvailability(tokenType, shortageAmount, userAddress) {
    if (!tokenType.isConditional) {
      return { canSplit: false, available: '0' };
    }

    // Get the underlying collateral balance
    const collateralKey = tokenType.category === 'currency' ? 'baseCurrency' : 'baseCompany';
    const collateralBalance = this.balancesHook.getBalance(collateralKey);
    const collateralBalanceBN = ethers.utils.parseUnits(collateralBalance, 18);

    const canSplit = collateralBalanceBN.gte(shortageAmount);

    return {
      canSplit,
      available: collateralBalance,
      collateralType: tokenType.category,
      collateralSymbol: tokenType.underlyingToken?.symbol || 'UNKNOWN',
      collateralAddress: tokenType.underlyingToken?.address
    };
  }

  /**
   * Get current balance for a token
   */
  async getCurrentBalance(tokenAddress, userAddress) {
    try {
      // First try to get from the balances hook cache
      const tokenType = this.identifyTokenType(tokenAddress);
      if (tokenType.isConditional && tokenType.balanceKey) {
        return this.balancesHook.getBalance(tokenType.balanceKey);
      }

      // Fallback to direct blockchain call
      return await getTokenBalance(tokenAddress, userAddress);
    } catch (error) {
      console.error('Error getting current balance:', error);
      return '0';
    }
  }

  /**
   * Get comprehensive token analysis for UI
   */
  async getTokenAnalysis(tokenAddress, amount, userAddress) {
    const analysis = await this.analyzeTokenRequirements({
      tokenIn: tokenAddress,
      amount,
      userAddress
    });

    // Add additional UI-friendly information
    return {
      ...analysis,
      recommendations: this.generateRecommendations(analysis),
      estimatedTime: this.estimateExecutionTime(analysis.actions),
      gasEstimate: await this.estimateGasCosts(analysis.actions)
    };
  }

  /**
   * Generate user-friendly recommendations
   */
  generateRecommendations(analysis) {
    if (analysis.sufficient) {
      return ['✅ You have sufficient balance to proceed with the swap.'];
    }

    const recommendations = [];
    
    if (analysis.canAutoSplit) {
      recommendations.push(
        `💡 You can automatically split ${analysis.splitAmount} ${analysis.collateralAvailable} to get the missing ${analysis.tokenType.symbol} tokens.`,
        '🔄 This will be done automatically before the swap.',
        '⚡ The process requires two transactions: split + swap.'
      );
    } else {
      recommendations.push(
        `❌ Insufficient ${analysis.tokenType.symbol} tokens.`,
        `💰 You need ${analysis.shortage} more tokens.`,
        analysis.collateralAvailable > 0 
          ? `💡 Consider acquiring more collateral to split.`
          : `💡 Acquire ${analysis.tokenType.underlyingToken?.symbol} tokens first, then split them.`
      );
    }

    return recommendations;
  }

  /**
   * Estimate execution time for actions
   */
  estimateExecutionTime(actions) {
    if (!actions.length) return '< 1 minute';
    
    const splitActions = actions.filter(a => a.type === 'SPLIT_COLLATERAL');
    if (splitActions.length > 0) {
      return '2-3 minutes'; // Split + swap
    }
    
    return '1-2 minutes';
  }

  /**
   * Estimate gas costs for actions
   */
  async estimateGasCosts(actions) {
    // This would integrate with gas estimation utilities
    const splitActions = actions.filter(a => a.type === 'SPLIT_COLLATERAL');
    
    if (splitActions.length > 0) {
      return {
        estimated: '~0.015 xDAI',
        breakdown: ['Split collateral: ~0.008 xDAI', 'Swap execution: ~0.007 xDAI']
      };
    }
    
    return {
      estimated: '~0.007 xDAI',
      breakdown: ['Swap execution: ~0.007 xDAI']
    };
  }
} 