import React from 'react';
import { useMetaMask } from '../../hooks/useMetaMask';

const ProviderStatus = ({ showDetails = false }) => {
  const { account, chainId, isMetaMaskDetected, provider } = useMetaMask();

  // Don't render anything if not showing details and everything is working
  if (!showDetails && account && chainId === 100 && isMetaMaskDetected) {
    return null;
  }

  const getStatusColor = () => {
    if (!isMetaMaskDetected) return 'text-red-600 dark:text-red-400';
    if (!account) return 'text-yellow-600 dark:text-yellow-400';
    if (chainId !== 100) return 'text-orange-600 dark:text-orange-400';
    return 'text-green-600 dark:text-green-400';
  };

  const getStatusIcon = () => {
    if (!isMetaMaskDetected) return '❌';
    if (!account) return '⚠️';
    if (chainId !== 100) return '🔄';
    return '✅';
  };

  const getStatusText = () => {
    if (!isMetaMaskDetected) return 'MetaMask not detected';
    if (!account) return 'MetaMask not connected';
    if (chainId !== 100) return `Wrong network (Chain ID: ${chainId})`;
    return 'Connected to Gnosis Chain';
  };

  const getProviderInfo = () => {
    if (!provider) return 'No provider';
    
    // Try to detect provider type
    if (provider._provider?.isMetaMask) return 'MetaMask Provider';
    if (provider._provider?.constructor?.name) return provider._provider.constructor.name;
    return 'Unknown Provider';
  };

  return (
    <div className={`flex items-center gap-2 text-sm ${getStatusColor()}`}>
      <span>{getStatusIcon()}</span>
      <span>{getStatusText()}</span>
      
      {showDetails && (
        <div className="ml-4 text-xs opacity-75">
          <div>Provider: {getProviderInfo()}</div>
          {account && (
            <div>Account: {account.slice(0, 6)}...{account.slice(-4)}</div>
          )}
          {chainId && (
            <div>Chain: {chainId}</div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProviderStatus; 