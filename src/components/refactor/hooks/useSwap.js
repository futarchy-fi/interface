import { useState, useCallback, useEffect, useRef } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { SwapExecutor, SWAP_STRATEGIES } from '../strategies';
import { walletClientToSigner } from '../utils/signerUtils';

/**
 * React hook for swap execution using strategy pattern
 * Provides a unified interface for different swap strategies
 */
export function useSwap(defaultConfig = {}) {
  const { address: userAddress, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  
  // State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [currentStep, setCurrentStep] = useState(null);
  const [selectedStrategy, setSelectedStrategy] = useState(SWAP_STRATEGIES.ALGEBRA);
  
  // Quotes state
  const [quotes, setQuotes] = useState({});
  const [quotesLoading, setQuotesLoading] = useState(false);
  
  // External callbacks
  const [externalCallbacks, setExternalCallbacks] = useState({});
  
  // Ref for executor
  const executorRef = useRef(null);
  
  // Initialize executor when wallet client is available
  useEffect(() => {
    if (walletClient && userAddress) {
      try {
        // Convert wallet client to proper ethers signer
        const signer = walletClientToSigner(walletClient);

        executorRef.current = new SwapExecutor(signer, defaultConfig);
        
        // Set up callbacks - use current values, not state
        const updateCallbacks = () => {
          executorRef.current?.setCallbacks({
            onApprovalStart: (strategyName, tokenIn) => {
              setCurrentStep('Approving tokens...');
              // Access current external callbacks without state dependency
              const currentCallbacks = externalCallbacks;
              currentCallbacks.onApprovalStart?.(strategyName, tokenIn);
            },
            onApprovalComplete: (strategyName, tokenIn, txHash) => {
              setCurrentStep('Approval completed');
              console.log('useSwap: Approval completed, notifying external callbacks...');
              // Access current external callbacks without state dependency
              const currentCallbacks = externalCallbacks;
              currentCallbacks.onApprovalComplete?.(strategyName, tokenIn, txHash);
            },
            onSwapStart: (params) => {
              setCurrentStep('Executing swap...');
              const currentCallbacks = externalCallbacks;
              currentCallbacks.onSwapStart?.(params);
            },
            onSwapComplete: (result) => {
              setCurrentStep('Swap completed');
              setResult(result);
              const currentCallbacks = externalCallbacks;
              currentCallbacks.onSwapComplete?.(result);
            },
            onError: (error) => {
              setError(error.message);
              setCurrentStep(null);
              const currentCallbacks = externalCallbacks;
              currentCallbacks.onError?.(error);
            }
          });
        };

        updateCallbacks();
        
      } catch (err) {
        console.error('Failed to initialize swap executor:', err);
        setError('Failed to initialize wallet connection');
      }
    }
  }, [walletClient, userAddress, defaultConfig]); // Removed externalCallbacks from deps

  // Separate effect to update callbacks when external callbacks change
  useEffect(() => {
    if (executorRef.current && Object.keys(externalCallbacks).length > 0) {
      executorRef.current.setCallbacks({
        onApprovalStart: (strategyName, tokenIn) => {
          setCurrentStep('Approving tokens...');
          externalCallbacks.onApprovalStart?.(strategyName, tokenIn);
        },
        onApprovalComplete: (strategyName, tokenIn, txHash) => {
          setCurrentStep('Approval completed');
          console.log('useSwap: Approval completed, notifying external callbacks...');
          externalCallbacks.onApprovalComplete?.(strategyName, tokenIn, txHash);
        },
        onSwapStart: (params) => {
          setCurrentStep('Executing swap...');
          externalCallbacks.onSwapStart?.(params);
        },
        onSwapComplete: (result) => {
          setCurrentStep('Swap completed');
          setResult(result);
          externalCallbacks.onSwapComplete?.(result);
        },
        onError: (error) => {
          setError(error.message);
          setCurrentStep(null);
          externalCallbacks.onError?.(error);
        }
      });
    }
  }, [externalCallbacks]);

  // Execute swap
  const executeSwap = useCallback(async (params) => {
    if (!executorRef.current || !userAddress) {
      throw new Error('Wallet not connected or executor not initialized');
    }

    try {
      setLoading(true);
      setError(null);
      setResult(null);
      setCurrentStep('Preparing swap...');

      const swapParams = {
        ...params,
        userAddress,
        strategyType: selectedStrategy
      };

      const result = await executorRef.current.executeSwap(swapParams);
      
      setCurrentStep('Swap completed successfully');
      setResult(result);
      return result;
      
    } catch (err) {
      console.error('Swap execution failed:', err);
      setError(err.message);
      setCurrentStep(null);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [executorRef, userAddress, selectedStrategy]);

  // Get single quote
  const getQuote = useCallback(async (params) => {
    if (!executorRef.current || !userAddress) return null;

    try {
      return await executorRef.current.getQuote({
        ...params,
        userAddress,
        strategyType: selectedStrategy
      });
    } catch (error) {
      console.error('Quote failed:', error);
      return null;
    }
  }, [executorRef, userAddress, selectedStrategy]);

  // Get multiple quotes
  const getMultipleQuotes = useCallback(async (params, strategies = null) => {
    if (!executorRef.current || !userAddress) return {};

    setQuotesLoading(true);
    try {
      const availableStrategies = strategies || executorRef.current.getAvailableStrategies();
      const quotes = await executorRef.current.getMultipleQuotes(
        { ...params, userAddress },
        availableStrategies
      );
      
      setQuotes(quotes);
      return quotes;
    } catch (error) {
      console.error('Multiple quotes failed:', error);
      return {};
    } finally {
      setQuotesLoading(false);
    }
  }, [executorRef, userAddress]);

  // Check approval needed
  const checkApprovalNeeded = useCallback(async (params) => {
    if (!executorRef.current || !userAddress) return true;

    try {
      return await executorRef.current.checkApprovalNeeded({
        ...params,
        userAddress,
        strategyType: selectedStrategy
      });
    } catch (error) {
      console.error('Approval check failed:', error);
      return true;
    }
  }, [executorRef, userAddress, selectedStrategy]);

  // Execute swap with fallback
  const executeSwapWithFallback = useCallback(async (params, fallbackStrategies = []) => {
    if (!executorRef.current || !userAddress) {
      throw new Error('Wallet not connected or executor not initialized');
    }

    try {
      setLoading(true);
      setError(null);
      setResult(null);
      setCurrentStep('Preparing swap with fallback...');

      const swapParams = {
        ...params,
        userAddress,
        strategyType: selectedStrategy
      };

      const result = await executorRef.current.executeSwapWithFallback(
        swapParams,
        fallbackStrategies
      );
      
      setCurrentStep('Swap completed successfully');
      setResult(result);
      return result;
      
    } catch (err) {
      console.error('Swap with fallback failed:', err);
      setError(err.message);
      setCurrentStep(null);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [executorRef, userAddress, selectedStrategy]);

  // Reset state
  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setResult(null);
    setCurrentStep(null);
    setQuotes({});
    executorRef.current?.reset();
  }, []);

  // Get available strategies
  const getAvailableStrategies = useCallback(() => {
    return executorRef.current?.getAvailableStrategies() || [];
  }, []);

  // Get strategy info
  const getStrategyInfo = useCallback((strategyType) => {
    return executorRef.current?.getStrategyInfo(strategyType) || null;
  }, []);

  // Check transaction status using strategy-specific method
  const checkTransactionStatus = useCallback(async (hashOrOrderId) => {
    if (!executorRef.current) return null;

    try {
      return await executorRef.current.checkTransactionStatus(hashOrOrderId, selectedStrategy);
    } catch (error) {
      console.error('Failed to check transaction status:', error);
      return { status: 'error', error: error.message };
    }
  }, [selectedStrategy]);

  // Method to set external callbacks
  const setSwapCallbacks = useCallback((callbacks) => {
    setExternalCallbacks(callbacks);
  }, []);

  return {
    // State
    loading,
    error,
    result,
    currentStep,
    selectedStrategy,
    quotes,
    quotesLoading,
    isConnected,
    userAddress,

    // Actions
    executeSwap,
    executeSwapWithFallback,
    getQuote,
    getMultipleQuotes,
    checkApprovalNeeded,
    checkTransactionStatus,
    reset,

    // Strategy management
    setSelectedStrategy,
    getAvailableStrategies,
    getStrategyInfo,
    setSwapCallbacks,

    // Constants
    strategies: SWAP_STRATEGIES,
    
    // Utils
    currentStrategyName: executorRef.current?.getCurrentStrategyName() || null
  };
} 