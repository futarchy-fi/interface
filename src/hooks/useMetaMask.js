import { useState, useCallback, useEffect } from 'react';
import { ethers } from 'ethers';

// Enhanced MetaMask detection
const detectMetaMask = () => {
  // Check if MetaMask is specifically available
  if (window.ethereum?.isMetaMask) {
    console.log('✅ MetaMask detected and confirmed');
    return window.ethereum;
  }
  
  // Fallback detection for cases where isMetaMask might not be set
  if (window.ethereum && !window.ethereum.providers) {
    console.log('🔍 Single provider detected, assuming MetaMask');
    return window.ethereum;
  }
  
  // Handle multiple providers (e.g., MetaMask + other wallets)
  if (window.ethereum?.providers?.length > 0) {
    const metaMaskProvider = window.ethereum.providers.find(provider => provider.isMetaMask);
    if (metaMaskProvider) {
      console.log('✅ MetaMask found among multiple providers');
      return metaMaskProvider;
    }
  }
  
  console.warn('⚠️ MetaMask not detected');
  return null;
};

// Enhanced provider creation with better RPC handling
const createEnhancedProvider = (ethereumProvider) => {
  if (!ethereumProvider) {
    throw new Error('No Ethereum provider available');
  }
  
  // Create Web3Provider with MetaMask's provider
  const provider = new ethers.providers.Web3Provider(ethereumProvider, "any");
  
  // Add retry logic for RPC calls
  const originalSend = provider.send.bind(provider);
  provider.send = async (method, params) => {
    const maxRetries = 3;
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await originalSend(method, params);
        if (attempt > 1) {
          console.log(`✅ RPC call succeeded on attempt ${attempt}: ${method}`);
        }
        return result;
      } catch (error) {
        lastError = error;
        console.warn(`🔄 RPC attempt ${attempt}/${maxRetries} failed for ${method}:`, error.message);
        
        if (attempt < maxRetries) {
          // Exponential backoff: 500ms, 1s, 2s
          const delay = 500 * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    console.error(`❌ All RPC attempts failed for ${method}:`, lastError);
    throw lastError;
  };
  
  return provider;
};

export const useMetaMask = () => {
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [isMetaMaskDetected, setIsMetaMaskDetected] = useState(false);

  // Initialize provider and signer with enhanced MetaMask detection
  const initializeProvider = useCallback(async () => {
    try {
      const metaMaskProvider = detectMetaMask();
      
      if (metaMaskProvider) {
        setIsMetaMaskDetected(true);
        const enhancedProvider = createEnhancedProvider(metaMaskProvider);
        setProvider(enhancedProvider);
        
        try {
          const signer = enhancedProvider.getSigner();
          const address = await signer.getAddress();
          setSigner(signer);
          setAccount(address);
          
          const network = await enhancedProvider.getNetwork();
          setChainId(network.chainId);
          
          console.log('✅ MetaMask provider initialized successfully', {
            address: address.slice(0, 6) + '...' + address.slice(-4),
            chainId: network.chainId,
            networkName: network.name
          });
        } catch (error) {
          console.log("ℹ️ MetaMask detected but no account connected");
          // Clear account state but keep provider for connection attempts
          setAccount(null);
          setSigner(null);
          setChainId(null);
        }
      } else {
        setIsMetaMaskDetected(false);
        console.warn('⚠️ MetaMask not available');
      }
    } catch (error) {
      console.error('❌ Failed to initialize MetaMask provider:', error);
      setIsMetaMaskDetected(false);
    }
  }, []);

  // Connect to MetaMask with enhanced error handling
  const connect = useCallback(async () => {
    const metaMaskProvider = detectMetaMask();
    
    if (!metaMaskProvider) {
      throw new Error('MetaMask not detected. Please install MetaMask browser extension.');
    }

    try {
      console.log('🔗 Requesting MetaMask connection...');
      
      // Request account access using the detected MetaMask provider
      const accounts = await metaMaskProvider.request({ method: 'eth_requestAccounts' });
      
      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts returned from MetaMask');
      }
      
      const account = accounts[0];
      
      // Initialize enhanced provider and signer
      const enhancedProvider = createEnhancedProvider(metaMaskProvider);
      const signer = enhancedProvider.getSigner();
      
      // Get network info with retry
      const network = await enhancedProvider.getNetwork();
      
      setProvider(enhancedProvider);
      setSigner(signer);
      setAccount(account);
      setChainId(network.chainId);
      setIsMetaMaskDetected(true);

      console.log('✅ Successfully connected to MetaMask', {
        account: account.slice(0, 6) + '...' + account.slice(-4),
        chainId: network.chainId,
        networkName: network.name
      });

      return signer;
    } catch (error) {
      console.error('❌ Failed to connect to MetaMask:', error);
      
      // Provide more specific error messages
      if (error.code === 4001) {
        throw new Error('Connection rejected by user');
      } else if (error.code === -32002) {
        throw new Error('MetaMask connection request already pending. Please check MetaMask.');
      } else {
        throw new Error(`MetaMask connection failed: ${error.message}`);
      }
    }
  }, []);

  // Check and switch chain with enhanced error handling
  const checkAndSwitchChain = useCallback(async (requiredChainId) => {
    const metaMaskProvider = detectMetaMask();
    
    if (!metaMaskProvider) {
      throw new Error('MetaMask not detected');
    }

    try {
      const currentChainIdHex = await metaMaskProvider.request({ method: 'eth_chainId' });
      const currentChainId = parseInt(currentChainIdHex, 16);
      const requiredChainIdInt = typeof requiredChainId === 'string' 
        ? parseInt(requiredChainId, 16) 
        : requiredChainId;
      
      console.log(`🔗 Chain check: current=${currentChainId}, required=${requiredChainIdInt}`);
      
      if (currentChainId !== requiredChainIdInt) {
        const requiredChainIdHex = typeof requiredChainId === 'string' 
          ? requiredChainId 
          : `0x${requiredChainId.toString(16)}`;
          
        try {
          console.log(`🔄 Switching to chain ${requiredChainIdHex}...`);
          await metaMaskProvider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: requiredChainIdHex }],
          });
        } catch (switchError) {
          // Chain hasn't been added to MetaMask
          if (switchError.code === 4902) {
            console.log('➕ Adding Gnosis Chain to MetaMask...');
            await metaMaskProvider.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: requiredChainIdHex,
                chainName: 'Gnosis Chain',
                nativeCurrency: {
                  name: 'xDAI',
                  symbol: 'xDAI',
                  decimals: 18
                },
                rpcUrls: ['https://rpc.gnosischain.com'],
                blockExplorerUrls: ['https://gnosisscan.io']
              }],
            });
          } else {
            throw switchError;
          }
        }
        
        // Re-initialize provider and signer after chain switch
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for chain switch
        await initializeProvider();
      }
    } catch (error) {
      console.error('❌ Failed to switch chain:', error);
      throw error;
    }
  }, [initializeProvider]);

  // Check and approve token with enhanced error handling
  const checkAndApproveToken = useCallback(async (tokenAddress, spenderAddress, amount) => {
    if (!signer) {
      throw new Error('No signer available - please connect MetaMask first');
    }

    try {
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ['function approve(address spender, uint256 amount) returns (bool)',
         'function allowance(address owner, address spender) view returns (uint256)',
         'function symbol() view returns (string)'],
        signer
      );

      const userAddress = await signer.getAddress();
      
      // Get token symbol for better logging
      let tokenSymbol = 'Unknown';
      try {
        tokenSymbol = await tokenContract.symbol();
      } catch (e) {
        console.warn('Could not fetch token symbol:', e.message);
      }
      
      console.log(`🔍 Checking ${tokenSymbol} allowance...`);
      const currentAllowance = await tokenContract.allowance(userAddress, spenderAddress);

      if (currentAllowance.lt(amount)) {
        console.log(`📝 Approving ${tokenSymbol} for spending...`);
        const tx = await tokenContract.approve(spenderAddress, ethers.constants.MaxUint256);
        console.log(`⏳ Waiting for ${tokenSymbol} approval confirmation...`);
        await tx.wait();
        console.log(`✅ ${tokenSymbol} approval confirmed`);
      } else {
        console.log(`✅ ${tokenSymbol} already approved`);
      }
    } catch (error) {
      console.error('❌ Token approval failed:', error);
      throw error;
    }
  }, [signer]);

  // Listen for account and chain changes with enhanced handling
  useEffect(() => {
    const metaMaskProvider = detectMetaMask();
    
    if (metaMaskProvider) {
      console.log('👂 Setting up MetaMask event listeners...');
      initializeProvider();

      const handleAccountsChanged = (accounts) => {
        console.log('🔄 Accounts changed:', accounts.length > 0 ? 'Connected' : 'Disconnected');
        if (accounts.length === 0) {
          setAccount(null);
          setSigner(null);
          setChainId(null);
        } else {
          setAccount(accounts[0]);
          initializeProvider();
        }
      };

      const handleChainChanged = (chainId) => {
        console.log('🔄 Chain changed to:', parseInt(chainId, 16));
        initializeProvider();
      };

      const handleConnect = (connectInfo) => {
        console.log('✅ MetaMask connected:', connectInfo);
        initializeProvider();
      };

      const handleDisconnect = (error) => {
        console.log('❌ MetaMask disconnected:', error);
        setAccount(null);
        setSigner(null);
        setChainId(null);
      };

      metaMaskProvider.on('accountsChanged', handleAccountsChanged);
      metaMaskProvider.on('chainChanged', handleChainChanged);
      metaMaskProvider.on('connect', handleConnect);
      metaMaskProvider.on('disconnect', handleDisconnect);

      return () => {
        metaMaskProvider.removeListener('accountsChanged', handleAccountsChanged);
        metaMaskProvider.removeListener('chainChanged', handleChainChanged);
        metaMaskProvider.removeListener('connect', handleConnect);
        metaMaskProvider.removeListener('disconnect', handleDisconnect);
      };
    }
  }, [initializeProvider]);

  return {
    account,
    chainId,
    signer,
    provider,
    connect,
    checkAndSwitchChain,
    checkAndApproveToken,
    isMetaMaskDetected, // New: boolean indicating if MetaMask is available
  };
}; 