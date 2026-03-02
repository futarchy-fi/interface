/**
 * Token Management Utilities
 * Handles MetaMask integration, blockchain links, and token categorization
 */

// Gnosis Chain configuration
export const GNOSIS_CHAIN_CONFIG = {
  chainId: '0x64', // 100 in hex
  chainName: 'Gnosis Chain',
  nativeCurrency: {
    name: 'xDAI',
    symbol: 'XDAI',
    decimals: 18
  },
  rpcUrls: ['https://rpc.gnosischain.com'],
  blockExplorerUrls: ['https://gnosisscan.io']
};

/**
 * Get Gnosis Scan URL for token address
 */
export const getGnosisScanUrl = (address, type = 'token') => {
  if (!address || address === 'native') return null;
  const baseUrl = 'https://gnosisscan.io';
  switch (type) {
    case 'token':
      return `${baseUrl}/token/${address}`;
    case 'address':
      return `${baseUrl}/address/${address}`;
    case 'tx':
      return `${baseUrl}/tx/${address}`;
    default:
      return `${baseUrl}/token/${address}`;
  }
};

/**
 * Format token address for display
 */
export const formatTokenAddress = (address) => {
  if (!address || address === 'native') return 'Native Token';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

/**
 * Get token category and metadata
 */
export const getTokenCategory = (tokenType) => {
  const categories = {
    // Native
    native: {
      category: 'Native',
      symbol: 'XDAI',
      name: 'Gnosis Chain Native Token',
      description: 'Native gas token for Gnosis Chain',
      color: '#1E40AF',
      bgColor: '#EBF4FF',
      icon: '💎'
    },
    
    // Base tokens
    baseCurrency: {
      category: 'Base Currency',
      symbol: 'CURRENCY',
      name: 'Base Currency Token',
      description: 'The currency collateral token for this proposal',
      color: '#059669',
      bgColor: '#D1FAE5',
      icon: '💰'
    },
    baseCompany: {
      category: 'Base Company',
      symbol: 'COMPANY',
      name: 'Base Company Token',
      description: 'The company collateral token for this proposal',
      color: '#7C3AED',
      bgColor: '#EDE9FE',
      icon: '🏢'
    },
    
    // Currency outcome tokens
    currencyYes: {
      category: 'Currency Position',
      symbol: 'YES_CURRENCY',
      name: 'YES Currency Token',
      description: 'Represents YES position in currency market',
      color: '#10B981',
      bgColor: '#D1FAE5',
      icon: '✅💰'
    },
    currencyNo: {
      category: 'Currency Position',
      symbol: 'NO_CURRENCY',
      name: 'NO Currency Token',
      description: 'Represents NO position in currency market',
      color: '#EF4444',
      bgColor: '#FEE2E2',
      icon: '❌💰'
    },
    
    // Company outcome tokens
    companyYes: {
      category: 'Company Position',
      symbol: 'YES_COMPANY',
      name: 'YES Company Token',
      description: 'Represents YES position in company market',
      color: '#10B981',
      bgColor: '#D1FAE5',
      icon: '✅🏢'
    },
    companyNo: {
      category: 'Company Position',
      symbol: 'NO_COMPANY',
      name: 'NO Company Token',
      description: 'Represents NO position in company market',
      color: '#EF4444',
      bgColor: '#FEE2E2',
      icon: '❌🏢'
    }
  };
  
  return categories[tokenType] || {
    category: 'Unknown',
    symbol: 'UNKNOWN',
    name: 'Unknown Token',
    description: 'Token type not recognized',
    color: '#6B7280',
    bgColor: '#F3F4F6',
    icon: '❓'
  };
};

/**
 * Add token to MetaMask wallet
 */
export const addTokenToMetaMask = async (tokenAddress, symbol, decimals = 18, image = null) => {
  if (!window.ethereum) {
    throw new Error('MetaMask is not installed');
  }

  if (!tokenAddress || tokenAddress === 'native') {
    throw new Error('Cannot add native token to MetaMask');
  }

  try {
    // First ensure we're on Gnosis Chain
    await switchToGnosisChain();
    
    // Add token to MetaMask
    const wasAdded = await window.ethereum.request({
      method: 'wallet_watchAsset',
      params: {
        type: 'ERC20',
        options: {
          address: tokenAddress,
          symbol: symbol,
          decimals: decimals,
          image: image || undefined
        }
      }
    });

    return wasAdded;
  } catch (error) {
    console.error('Error adding token to MetaMask:', error);
    throw error;
  }
};

/**
 * Switch to Gnosis Chain in MetaMask
 */
export const switchToGnosisChain = async () => {
  if (!window.ethereum) {
    throw new Error('MetaMask is not installed');
  }

  try {
    // Try to switch to Gnosis Chain
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: GNOSIS_CHAIN_CONFIG.chainId }]
    });
  } catch (switchError) {
    // Chain not added to MetaMask, add it
    if (switchError.code === 4902) {
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [GNOSIS_CHAIN_CONFIG]
        });
      } catch (addError) {
        console.error('Error adding Gnosis Chain to MetaMask:', addError);
        throw addError;
      }
    } else {
      console.error('Error switching to Gnosis Chain:', switchError);
      throw switchError;
    }
  }
};

/**
 * Check if user is on Gnosis Chain
 */
export const isOnGnosisChain = async () => {
  if (!window.ethereum) return false;
  
  try {
    const chainId = await window.ethereum.request({ method: 'eth_chainId' });
    return chainId === GNOSIS_CHAIN_CONFIG.chainId;
  } catch (error) {
    console.error('Error checking chain:', error);
    return false;
  }
};

/**
 * Get enhanced token metadata with category info
 */
export const getEnhancedTokenMetadata = (tokenType, address, proposalData = null) => {
  const category = getTokenCategory(tokenType);
  
  return {
    ...category,
    address,
    tokenType,
    formattedAddress: formatTokenAddress(address),
    gnosisScanUrl: getGnosisScanUrl(address),
    canAddToMetaMask: address && address !== 'native',
    proposalMarket: proposalData?.marketName || null,
    isProposalToken: !!proposalData
  };
};

/**
 * Copy address to clipboard
 */
export const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      document.body.removeChild(textArea);
      return true;
    } catch (fallbackError) {
      document.body.removeChild(textArea);
      console.error('Failed to copy to clipboard:', fallbackError);
      return false;
    }
  }
};

/**
 * Validate if address looks like a valid Ethereum address
 */
export const isValidEthereumAddress = (address) => {
  if (!address || typeof address !== 'string') return false;
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

export default {
  getGnosisScanUrl,
  formatTokenAddress,
  getTokenCategory,
  addTokenToMetaMask,
  switchToGnosisChain,
  isOnGnosisChain,
  getEnhancedTokenMetadata,
  copyToClipboard,
  isValidEthereumAddress,
  GNOSIS_CHAIN_CONFIG
}; 