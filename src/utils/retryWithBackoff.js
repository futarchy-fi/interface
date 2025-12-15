/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Maximum number of retries (default: 3)
 * @param {number} options.baseDelay - Base delay in milliseconds (default: 1000)
 * @param {number} options.maxDelay - Maximum delay in milliseconds (default: 30000)
 * @param {Function} options.shouldRetry - Function to determine if error should trigger retry
 * @returns {Promise} - Promise that resolves with the result or rejects with the last error
 */
export async function retryWithExponentialBackoff(fn, options = {}) {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    shouldRetry = (error) => true // Default: retry all errors
  } = options;

  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      
      // Log successful retry if it wasn't the first attempt
      if (attempt > 0) {
        console.log(`[retryWithBackoff] Success on attempt ${attempt + 1}`);
      }
      
      return result;
    } catch (error) {
      lastError = error;
      
      // Check if we should retry this error
      if (!shouldRetry(error)) {
        console.log(`[retryWithBackoff] Error not retryable:`, error.message);
        throw error;
      }
      
      // If this was the last attempt, throw the error
      if (attempt === maxRetries) {
        console.error(`[retryWithBackoff] All ${maxRetries + 1} attempts failed. Last error:`, error.message);
        throw error;
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
      
      console.warn(`[retryWithBackoff] Attempt ${attempt + 1} failed: ${error.message}. Retrying in ${delay}ms...`);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Enhanced retry function with exponential backoff specifically optimized for MetaMask RPC calls
 * @param {Function} fn - Function to retry
 * @param {Object} options - Retry options
 * @returns {Promise} - Promise that resolves with the result or rejects after all retries
 */
export const retryRpcCall = async (fn, options = {}) => {
  const {
    maxRetries = 3,
    baseDelay = 500,
    maxDelay = 5000,
    exponentialBase = 2,
    jitter = true,
    onRetry = null,
    retryCondition = null
  } = options;

  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      
      // Log successful retry if not first attempt
      if (attempt > 1) {
        console.log(`✅ RPC call succeeded on attempt ${attempt}/${maxRetries}`);
      }
      
      return result;
    } catch (error) {
      lastError = error;
      
      // Check if we should retry this error
      const shouldRetry = retryCondition ? retryCondition(error) : isRetryableError(error);
      
      if (attempt === maxRetries || !shouldRetry) {
        break;
      }
      
      // Calculate delay with exponential backoff and optional jitter
      let delay = Math.min(baseDelay * Math.pow(exponentialBase, attempt - 1), maxDelay);
      
      if (jitter) {
        // Add ±25% jitter to prevent thundering herd
        const jitterAmount = delay * 0.25;
        delay += (Math.random() - 0.5) * 2 * jitterAmount;
      }
      
      console.warn(`🔄 RPC attempt ${attempt}/${maxRetries} failed, retrying in ${Math.round(delay)}ms:`, {
        error: error.message,
        code: error.code,
        method: error.method || 'unknown'
      });
      
      // Call retry callback if provided
      if (onRetry) {
        onRetry(error, attempt);
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  console.error(`❌ All ${maxRetries} RPC attempts failed:`, lastError);
  throw lastError;
};

/**
 * Determine if an error is retryable
 * @param {Error} error - The error to check
 * @returns {boolean} - Whether the error is retryable
 */
const isRetryableError = (error) => {
  // Don't retry user rejections or invalid requests
  if (error.code === 4001 || error.code === 4100 || error.code === 4200) {
    return false;
  }
  
  // Don't retry method not found errors
  if (error.code === -32601) {
    return false;
  }
  
  // Retry network errors, timeouts, and temporary failures
  const retryableCodes = [
    -32000, // Generic server error
    -32002, // Resource unavailable
    -32005, // Limit exceeded
    -32603, // Internal error
    429,    // Too many requests
    502,    // Bad gateway
    503,    // Service unavailable
    504,    // Gateway timeout
  ];
  
  if (retryableCodes.includes(error.code)) {
    return true;
  }
  
  // Retry network-related errors
  const retryableMessages = [
    'network error',
    'timeout',
    'connection reset',
    'connection refused',
    'socket hang up',
    'enotfound',
    'econnreset',
    'econnrefused',
    'etimedout'
  ];
  
  const errorMessage = error.message?.toLowerCase() || '';
  return retryableMessages.some(msg => errorMessage.includes(msg));
};

/**
 * Specific retry wrapper for MetaMask provider calls
 * @param {Object} provider - MetaMask provider
 * @param {string} method - RPC method
 * @param {Array} params - RPC parameters
 * @param {Object} options - Retry options
 * @returns {Promise} - Promise that resolves with the result
 */
export const retryMetaMaskCall = async (provider, method, params = [], options = {}) => {
  return retryRpcCall(
    () => provider.request({ method, params }),
    {
      ...options,
      onRetry: (error, attempt) => {
        console.warn(`🔄 MetaMask ${method} attempt ${attempt} failed:`, error.message);
        if (options.onRetry) {
          options.onRetry(error, attempt);
        }
      }
    }
  );
};

/**
 * Enhanced contract call wrapper with automatic retry
 * @param {Object} contract - Ethers contract instance
 * @param {string} methodName - Contract method name
 * @param {Array} args - Method arguments
 * @param {Object} options - Retry and transaction options
 * @returns {Promise} - Promise that resolves with the result
 */
export const retryContractCall = async (contract, methodName, args = [], options = {}) => {
  const { txOptions = {}, ...retryOptions } = options;
  
  return retryRpcCall(
    async () => {
      if (contract[methodName].estimateGas) {
        // For state-changing methods, try to estimate gas first
        try {
          const gasEstimate = await contract.estimateGas[methodName](...args, txOptions);
          const finalTxOptions = {
            ...txOptions,
            gasLimit: gasEstimate.mul(120).div(100) // Add 20% buffer
          };
          return contract[methodName](...args, finalTxOptions);
        } catch (gasError) {
          console.warn(`⚠️ Gas estimation failed for ${methodName}, using default:`, gasError.message);
          return contract[methodName](...args, txOptions);
        }
      } else {
        // For view methods, call directly
        return contract[methodName](...args);
      }
    },
    {
      ...retryOptions,
      onRetry: (error, attempt) => {
        console.warn(`🔄 Contract ${methodName} attempt ${attempt} failed:`, error.message);
        if (retryOptions.onRetry) {
          retryOptions.onRetry(error, attempt);
        }
      }
    }
  );
};

/**
 * Get the best available provider with preference for MetaMask
 * @returns {Object|null} - The best available provider
 */
export const getBestProvider = () => {
  // First, try to get MetaMask specifically
  if (window.ethereum?.isMetaMask) {
    console.log('✅ Using MetaMask provider');
    return window.ethereum;
  }
  
  // Handle multiple providers
  if (window.ethereum?.providers?.length > 0) {
    const metaMaskProvider = window.ethereum.providers.find(p => p.isMetaMask);
    if (metaMaskProvider) {
      console.log('✅ Using MetaMask from multiple providers');
      return metaMaskProvider;
    }
  }
  
  // Fallback to any available provider
  if (window.ethereum) {
    console.log('⚠️ Using fallback provider (not confirmed MetaMask)');
    return window.ethereum;
  }
  
  console.error('❌ No Ethereum provider available');
  return null;
};

// Legacy exports for backward compatibility
export const retryWithBackoff = retryRpcCall; 