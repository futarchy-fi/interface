import { useState } from 'react';
import { ethers } from 'ethers';
import { useFutarchy } from './useFutarchy';

export const useSmartSwap = (contractConfig) => {
  const [status, setStatus] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState('');

  const {
    addCollateral,
    marketSwaps,
    balances,
    getPosition
  } = useFutarchy(contractConfig);

  const getRequiredCollateral = (amount, tokenType, eventHappens) => {
    // Get current position
    const position = getPosition(tokenType);
    const currentBalance = eventHappens ? position.yes : position.no;
    
    // Convert to numbers for comparison (using ethers to maintain precision)
    const amountBN = ethers.utils.parseUnits(amount, 18);
    const currentBalanceBN = ethers.utils.parseUnits(currentBalance, 18);
    
    // If we have enough balance, return 0
    if (currentBalanceBN.gte(amountBN)) {
      return '0';
    }
    
    // Otherwise, return the difference
    const diffBN = amountBN.sub(currentBalanceBN);
    return ethers.utils.formatUnits(diffBN, 18);
  };

  const smartSwap = async (params) => {
    const {
      amount,
      eventHappens,
      action,
      onStart,
      onCollateralNeeded,
      onCollateralAdded,
      onSwapStart,
      onSwapComplete,
      onError
    } = params;

    try {
      setLoading(true);
      setError(null);
      onStart?.();

      // Validate input
      if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
        throw new Error('Invalid amount');
      }

      // For buy actions, we need to check/add collateral
      if (action === 'buy') {
        const tokenType = 'currency';
        const requiredCollateral = getRequiredCollateral(amount, tokenType, eventHappens);

        console.log('Collateral check:', {
          amount,
          eventHappens,
          currentBalance: getPosition(tokenType)[eventHappens ? 'yes' : 'no'],
          requiredCollateral
        });

        // If we need more collateral
        if (parseFloat(requiredCollateral) > 0) {
          onCollateralNeeded?.(requiredCollateral);
          setStatus('Adding required collateral...');

          // Add the required collateral
          await addCollateral(tokenType, requiredCollateral, {
            onStart: () => setStatus('Starting collateral addition...'),
            onApprove: () => setStatus('Approving token...'),
            onSplit: (tx) => {
              setStatus('Splitting position...');
              setTxHash(tx.hash);
            },
            onComplete: () => {
              setStatus('Collateral added successfully');
              onCollateralAdded?.();
            }
          });
        }
      }

      // Execute the swap
      const swaps = marketSwaps();
      const outcome = eventHappens ? swaps.yes : swaps.no;
      const swapMethod = action === 'buy' 
        ? outcome.swapCurrencyToCompany 
        : outcome.swapCompanyToCurrency;

      onSwapStart?.();
      setStatus('Starting swap...');

      await swapMethod(amount, {
        onStart: () => setStatus('Initializing swap...'),
        onApprove: () => setStatus('Approving token for swap...'),
        onFetchRoute: () => setStatus('Finding best swap route...'),
        onSwap: () => setStatus('Executing swap...'),
        onSwapSent: (tx) => {
          setStatus('Swap transaction sent...');
          setTxHash(tx.hash);
        },
        onComplete: (tx) => {
          setStatus('Swap completed successfully!');
          setTxHash(tx.hash);
          onSwapComplete?.(tx);
        }
      });

      setLoading(false);
      return true;

    } catch (err) {
      console.error('Smart swap failed:', err);
      setError(err);
      setLoading(false);
      setStatus(`Error: ${err.message}`);
      onError?.(err);
      return false;
    }
  };

  return {
    smartSwap,
    status,
    error,
    loading,
    txHash,
    getRequiredCollateral
  };
}; 