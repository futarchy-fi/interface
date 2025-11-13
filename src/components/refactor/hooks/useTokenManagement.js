import { useState, useCallback } from 'react';
import { 
  addTokenToMetaMask, 
  copyToClipboard, 
  isOnGnosisChain, 
  switchToGnosisChain,
  getEnhancedTokenMetadata,
  isValidEthereumAddress
} from '../utils/tokenUtils';

/**
 * React hook for token management
 * Provides MetaMask integration, clipboard functions, and token utilities
 */
export function useTokenManagement() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Clear messages after timeout
  const clearMessages = useCallback(() => {
    setTimeout(() => {
      setError(null);
      setSuccessMessage(null);
    }, 3000);
  }, []);

  // Add token to MetaMask
  const addToMetaMask = useCallback(async (tokenAddress, symbol, decimals = 18) => {
    if (!tokenAddress || tokenAddress === 'native') {
      setError('Cannot add native token to MetaMask');
      clearMessages();
      return false;
    }

    if (!isValidEthereumAddress(tokenAddress)) {
      setError('Invalid token address');
      clearMessages();
      return false;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const wasAdded = await addTokenToMetaMask(tokenAddress, symbol, decimals);
      
      if (wasAdded) {
        setSuccessMessage(`${symbol} token added to MetaMask successfully!`);
      } else {
        setError('Token addition was cancelled by user');
      }
      
      clearMessages();
      return wasAdded;
    } catch (err) {
      console.error('Error adding token to MetaMask:', err);
      setError(err.message || 'Failed to add token to MetaMask');
      clearMessages();
      return false;
    } finally {
      setLoading(false);
    }
  }, [clearMessages]);

  // Copy address to clipboard
  const copyAddress = useCallback(async (address, tokenSymbol = 'Token') => {
    if (!address || address === 'native') {
      setError('Cannot copy native token address');
      clearMessages();
      return false;
    }

    try {
      const success = await copyToClipboard(address);
      if (success) {
        setSuccessMessage(`${tokenSymbol} address copied to clipboard!`);
        clearMessages();
      } else {
        setError('Failed to copy to clipboard');
        clearMessages();
      }
      return success;
    } catch (err) {
      console.error('Error copying to clipboard:', err);
      setError('Failed to copy to clipboard');
      clearMessages();
      return false;
    }
  }, [clearMessages]);

  // Switch to Gnosis Chain
  const switchToGnosis = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await switchToGnosisChain();
      setSuccessMessage('Successfully switched to Gnosis Chain!');
      clearMessages();
      return true;
    } catch (err) {
      console.error('Error switching to Gnosis Chain:', err);
      setError(err.message || 'Failed to switch to Gnosis Chain');
      clearMessages();
      return false;
    } finally {
      setLoading(false);
    }
  }, [clearMessages]);

  // Check if on Gnosis Chain
  const checkGnosisChain = useCallback(async () => {
    try {
      return await isOnGnosisChain();
    } catch (err) {
      console.error('Error checking chain:', err);
      return false;
    }
  }, []);

  // Get enhanced token metadata
  const getTokenMetadata = useCallback((tokenType, address, proposalData = null) => {
    return getEnhancedTokenMetadata(tokenType, address, proposalData);
  }, []);

  // Bulk add multiple tokens to MetaMask
  const addMultipleTokens = useCallback(async (tokens) => {
    const results = [];
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      for (const token of tokens) {
        if (token.address && token.address !== 'native') {
          const result = await addTokenToMetaMask(
            token.address, 
            token.symbol, 
            token.decimals || 18
          );
          results.push({ ...token, added: result });
        }
      }

      const successCount = results.filter(r => r.added).length;
      const totalCount = results.length;

      if (successCount === totalCount) {
        setSuccessMessage(`All ${successCount} tokens added to MetaMask successfully!`);
      } else if (successCount > 0) {
        setSuccessMessage(`${successCount} of ${totalCount} tokens added to MetaMask`);
      } else {
        setError('No tokens were added to MetaMask');
      }

      clearMessages();
      return results;
    } catch (err) {
      console.error('Error adding multiple tokens:', err);
      setError('Failed to add tokens to MetaMask');
      clearMessages();
      return [];
    } finally {
      setLoading(false);
    }
  }, [clearMessages]);

  // Clear all messages manually
  const clearAllMessages = useCallback(() => {
    setError(null);
    setSuccessMessage(null);
  }, []);

  return {
    // State
    loading,
    error,
    successMessage,
    
    // Actions
    addToMetaMask,
    copyAddress,
    switchToGnosis,
    checkGnosisChain,
    getTokenMetadata,
    addMultipleTokens,
    clearAllMessages,
    
    // Utilities
    isValidAddress: isValidEthereumAddress,
    
    // Status checks
    hasError: !!error,
    hasSuccess: !!successMessage,
    isWorking: loading
  };
}

export default useTokenManagement; 