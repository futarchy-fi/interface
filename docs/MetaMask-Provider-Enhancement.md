# MetaMask Provider Enhancement

## Overview

This enhancement improves RPC stability by prioritizing MetaMask's native provider over other injected providers or unstable RPC endpoints. MetaMask's provider is generally more stable because it's directly connected to the user's wallet and uses MetaMask's own RPC infrastructure.

## Key Features

### 1. Enhanced MetaMask Detection

The `useMetaMask` hook now includes:
- **Intelligent Detection**: Specifically detects MetaMask among multiple wallet providers
- **Fallback Handling**: Gracefully handles cases where MetaMask isn't available
- **Provider Validation**: Confirms that the detected provider is actually MetaMask

### 2. RPC Retry Logic

The provider now includes automatic retry logic with:
- **Exponential Backoff**: Retries failed RPC calls with increasing delays
- **Smart Error Detection**: Only retries network/temporary errors, not user rejections
- **Jitter**: Adds randomness to prevent thundering herd effects
- **Detailed Logging**: Provides clear feedback about retry attempts

### 3. Provider Status Component

A new `ProviderStatus` component provides:
- **Visual Feedback**: Shows connection status with icons and colors
- **Debugging Info**: Displays provider type, account, and chain details
- **User Guidance**: Recommends MetaMask installation for better stability

## Usage

### Basic Usage

```jsx
import { useMetaMask } from './hooks/useMetaMask';
import ProviderStatus from './components/common/ProviderStatus';

function MyComponent() {
  const { account, provider, isMetaMaskDetected, connect } = useMetaMask();
  
  return (
    <div>
      <ProviderStatus showDetails={true} />
      {!account && (
        <button onClick={connect}>
          Connect {isMetaMaskDetected ? 'MetaMask' : 'Wallet'}
        </button>
      )}
    </div>
  );
}
```

### Advanced RPC Calls

```jsx
import { retryRpcCall, retryMetaMaskCall, getBestProvider } from './utils/retryWithBackoff';

// For general RPC calls with retry
const result = await retryRpcCall(async () => {
  return provider.getBalance(address);
}, {
  maxRetries: 3,
  baseDelay: 500
});

// For MetaMask-specific calls
const provider = getBestProvider();
const chainId = await retryMetaMaskCall(provider, 'eth_chainId');

// For contract calls with automatic gas estimation
import { retryContractCall } from './utils/retryWithBackoff';

const tx = await retryContractCall(contract, 'transfer', [to, amount], {
  maxRetries: 3,
  txOptions: { gasLimit: 100000 }
});
```

## Provider Detection Logic

The enhanced detection follows this priority:

1. **Direct MetaMask**: `window.ethereum.isMetaMask === true`
2. **Multiple Providers**: Find MetaMask in `window.ethereum.providers`
3. **Single Provider**: Assume MetaMask if only one provider exists
4. **Fallback**: Use any available provider as last resort
5. **No Provider**: Return null and show error

## Error Handling

### Retryable Errors
- Network timeouts
- Server errors (5xx)
- Rate limiting (429)
- Connection issues

### Non-Retryable Errors
- User rejections (4001)
- Method not found (-32601)
- Invalid parameters (4100, 4200)

## Visual Indicators

The `ProviderStatus` component shows:
- ✅ **Green**: Connected to MetaMask on Gnosis Chain
- 🔄 **Orange**: Connected but wrong network
- ⚠️ **Yellow**: MetaMask detected but not connected
- ❌ **Red**: MetaMask not detected

## Benefits

1. **Improved Stability**: Direct MetaMask connection is more reliable than third-party RPC
2. **Better User Experience**: Clear feedback about connection issues
3. **Automatic Recovery**: Retries handle temporary network issues
4. **Developer Friendly**: Enhanced logging for debugging
5. **Future Proof**: Handles multiple wallet scenarios

## Migration Notes

The enhanced hook is backward compatible. Existing code using `useMetaMask()` will continue to work, but you'll get additional benefits:

- Better error handling
- Automatic retries
- Provider validation
- Enhanced logging

## Configuration

You can customize retry behavior:

```jsx
const customRetryOptions = {
  maxRetries: 5,        // Number of retry attempts
  baseDelay: 1000,      // Initial delay in ms
  maxDelay: 10000,      // Maximum delay in ms
  jitter: true,         // Add randomness to delays
  retryCondition: (error) => {
    // Custom logic for when to retry
    return error.code !== 4001; // Don't retry user rejections
  }
};
```

## Troubleshooting

### Common Issues

1. **"MetaMask not detected"**: User needs to install MetaMask extension
2. **"Wrong network"**: User needs to switch to Gnosis Chain
3. **RPC failures**: Check network connection and MetaMask settings
4. **Connection pending**: Previous connection request might be pending in MetaMask

### Debug Mode

Enable detailed logging by opening browser console. The enhanced provider logs all retry attempts and provider detection steps with emoji icons for easy identification. 