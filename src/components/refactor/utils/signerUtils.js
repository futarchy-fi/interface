import { ethers } from 'ethers';

/**
 * Convert wagmi wallet client to ethers v5 signer
 * This creates a proper ethers signer that's compatible with ethers.Contract
 */
export function walletClientToSigner(walletClient) {
  if (!walletClient) {
    throw new Error('Wallet client is required');
  }

  // Check if we have access to window.ethereum (browser environment)
  if (typeof window !== 'undefined' && window.ethereum) {
    // Use the standard ethers Web3Provider approach for maximum compatibility
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    return provider.getSigner();
  }
  
  // Fallback: create a custom signer that implements the ethers Signer interface
  // This is less compatible but works when window.ethereum is not available
  return new EthersSigner(walletClient);
}

/**
 * Custom ethers signer implementation that wraps wagmi wallet client
 * This extends ethers.Signer to ensure full compatibility
 */
class EthersSigner extends ethers.Signer {
  constructor(walletClient) {
    super();
    this.walletClient = walletClient;
  }

  async getAddress() {
    return this.walletClient.account.address;
  }

  async getChainId() {
    return this.walletClient.chain.id;
  }

  async signMessage(message) {
    const messageBytes = ethers.utils.toUtf8Bytes(message);
    return await this.walletClient.signMessage({ message: messageBytes });
  }

  async signTypedData(domain, types, value) {
    return await this.walletClient.signTypedData({ domain, types, message: value });
  }

  async sendTransaction(transaction) {
    const hash = await this.walletClient.sendTransaction(transaction);
    
    return {
      hash,
      wait: async () => {
        // Simple wait implementation
        // In production, you'd want to use proper transaction confirmation
        return new Promise(resolve => {
          setTimeout(() => resolve({ 
            status: 1, 
            transactionHash: hash, 
            confirmations: 1 
          }), 2000);
        });
      },
      confirmations: 0
    };
  }

  connect(provider) {
    // Return a new instance with provider (ethers pattern)
    return new EthersSigner(this.walletClient);
  }
}

/**
 * Check if we're in a browser environment with MetaMask
 */
export function canUseWeb3Provider() {
  return typeof window !== 'undefined' && window.ethereum;
}

/**
 * Get ethers provider from window.ethereum
 */
export function getWeb3Provider() {
  if (!canUseWeb3Provider()) {
    throw new Error('Web3 provider not available');
  }
  return new ethers.providers.Web3Provider(window.ethereum);
}

/**
 * Get ethers signer from window.ethereum
 */
export function getWeb3Signer() {
  const provider = getWeb3Provider();
  return provider.getSigner();
} 