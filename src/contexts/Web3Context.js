import React, { createContext, useContext, useState, useEffect } from 'react';
import { ethers } from 'ethers';

export const Web3ContextStatus = {
  NotAsked: 'NotAsked',
  Connecting: 'Connecting',
  Connected: 'Connected',
  Error: 'Error'
};

const Web3Context = createContext(null);

export const Web3Provider = ({ children }) => {
  const [status, setStatus] = useState(Web3ContextStatus.NotAsked);
  const [address, setAddress] = useState(null);
  const [provider, setProvider] = useState(null);
  const [networkId, setNetworkId] = useState(null);

  const connect = async () => {
    if (!window.ethereum) {
      throw new Error('MetaMask not found');
    }

    try {
      setStatus(Web3ContextStatus.Connecting);
      
      // Request account access
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const userAddress = accounts[0];
      
      // Create ethers provider
      const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
      const network = await web3Provider.getNetwork();
      
      setAddress(userAddress);
      setProvider(web3Provider);
      setNetworkId(network.chainId);
      setStatus(Web3ContextStatus.Connected);
    } catch (error) {
      console.error('Failed to connect:', error);
      setStatus(Web3ContextStatus.Error);
      throw error;
    }
  };

  const disconnect = () => {
    setAddress(null);
    setProvider(null);
    setNetworkId(null);
    setStatus(Web3ContextStatus.NotAsked);
  };

  // Handle account changes
  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length === 0) {
          disconnect();
        } else {
          setAddress(accounts[0]);
        }
      });

      window.ethereum.on('chainChanged', () => {
        window.location.reload();
      });
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeAllListeners('accountsChanged');
        window.ethereum.removeAllListeners('chainChanged');
      }
    };
  }, []);

  const value = {
    status,
    address,
    provider,
    networkId,
    connect,
    disconnect
  };

  return <Web3Context.Provider value={value}>{children}</Web3Context.Provider>;
};

export const useWeb3ConnectedOrInfura = () => {
  const context = useContext(Web3Context);
  if (!context) {
    throw new Error('useWeb3ConnectedOrInfura must be used within a Web3Provider');
  }
  return context;
}; 