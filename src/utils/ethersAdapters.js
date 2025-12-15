import { ethers } from 'ethers';

export const getEthersProvider = (publicClient) => {
    if (!publicClient) return null;

    // Always try to use Web3Provider when window.ethereum is available
    if (typeof window !== 'undefined' && window.ethereum) {
        return new ethers.providers.Web3Provider(window.ethereum);
    }

    // For other cases, create a minimal provider adapter
    return {
        async getNetwork() {
            return {
                chainId: publicClient.chain.id,
                name: publicClient.chain.name
            };
        },
        async call(transaction, blockTag = 'latest') {
            try {
                return await publicClient.call({ ...transaction, blockTag });
            } catch (error) {
                console.error('Provider call failed:', error);
                throw error;
            }
        },
        async getBalance(address, blockTag = 'latest') {
            try {
                return await publicClient.getBalance({ address, blockTag });
            } catch (error) {
                console.error('Provider getBalance failed:', error);
                throw error;
            }
        },
        async getBlockNumber() {
            try {
                return await publicClient.getBlockNumber();
            } catch (error) {
                console.error('Provider getBlockNumber failed:', error);
                throw error;
            }
        },
        async getGasPrice() {
            try {
                return await publicClient.getGasPrice();
            } catch (error) {
                console.warn('Provider getGasPrice failed, using default:', error);
                return ethers.utils.parseUnits('1', 'gwei'); // Default fallback
            }
        },
        async estimateGas(transaction) {
            try {
                return await publicClient.estimateGas(transaction);
            } catch (error) {
                console.error('Provider estimateGas failed:', error);
                throw error;
            }
        },
        async getTransactionCount(address, blockTag = 'latest') {
            try {
                return await publicClient.getTransactionCount({ address, blockTag });
            } catch (error) {
                console.error('Provider getTransactionCount failed:', error);
                throw error;
            }
        },
        // Mark this as a provider
        _isProvider: true,
        // Store the public client for reference
        _publicClient: publicClient
    };
};

export const getEthersSigner = (walletClient, publicClient) => {
    console.log('[DEBUG] getEthersSigner called with:', {
        walletClient: !!walletClient,
        walletClientAccount: walletClient?.account?.address,
        publicClient: !!publicClient,
        connectorType: walletClient?.connector?.name || 'unknown'
    });

    if (!walletClient) {
        console.warn('[DEBUG] No walletClient provided to getEthersSigner');
        return null;
    }

    // Only use Web3Provider if the user actually connected via MetaMask injected wallet
    // Don't override their wallet choice with MetaMask if they chose WalletConnect, etc.
    const isMetaMaskConnector = walletClient?.connector?.name?.toLowerCase().includes('metamask') ||
        walletClient?.connector?.name?.toLowerCase().includes('injected');

    if (isMetaMaskConnector && typeof window !== 'undefined' && window.ethereum) {
        try {
            console.log('[DEBUG] User connected via MetaMask, attempting Web3Provider signer...');
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            const connectedAddr = walletClient?.account?.address;
            const providerSigner = connectedAddr ? provider.getSigner(connectedAddr) : provider.getSigner();

            // Override getAddress to return the known connected address
            providerSigner.getAddress = async function () {
                console.log('[DEBUG] getAddress called on Web3Provider signer, returning:', connectedAddr);
                return connectedAddr;
            };

            console.log('[DEBUG] Web3Provider signer setup complete for MetaMask connection');
            return providerSigner;
        } catch (error) {
            console.warn('[DEBUG] Failed to create Web3Provider signer, falling back to custom implementation:', error);
        }
    } else {
        console.log('[DEBUG] User connected via non-MetaMask wallet, using viem-based signer for:', walletClient?.connector?.name);
    }

    // Create a viem-based signer that respects the user's wallet choice
    console.log('[DEBUG] Creating viem-based signer...');
    const customSigner = {
        // Required ethers.js signer properties
        _isSigner: true,
        provider: null, // Will be set below

        // Core signer methods
        async getAddress() {
            const address = walletClient.account.address;
            console.log('[DEBUG] Custom signer getAddress called, returning:', address);
            return address;
        },
        async getChainId() {
            const chainId = walletClient.chain.id;
            console.log('[DEBUG] Custom signer getChainId called, returning:', chainId);
            return chainId;
        },
        async sendTransaction(transaction) {
            const hash = await walletClient.sendTransaction(transaction);
            console.log('Transaction sent via viem walletClient:', hash);

            return {
                hash,
                wait: async (confirmations = 1) => {
                    try {
                        console.log(`Waiting for transaction ${hash} confirmation...`);

                        // Increased timeout to 5 minutes for Safe transactions
                        const receipt = await publicClient.waitForTransactionReceipt({
                            hash,
                            timeout: 300000,
                            confirmations,
                            // Poll every 4 seconds
                            pollingInterval: 4000
                        });

                        console.log('Transaction confirmed:', receipt);
                        return {
                            status: receipt.status === 'success' ? 1 : 0,
                            transactionHash: receipt.transactionHash,
                            blockNumber: receipt.blockNumber,
                            gasUsed: receipt.gasUsed,
                            confirmations: confirmations,
                            logs: receipt.logs
                        };
                    } catch (error) {
                        console.error('Transaction confirmation error:', error);

                        // If it's a timeout, we might want to check if the transaction exists
                        if (error.name === 'TimeoutError' || error.message?.includes('timed out')) {
                            console.warn('Transaction wait timed out. It might still be pending or executed on Safe.');
                            // We could try to fetch the receipt one last time without waiting
                            try {
                                const receipt = await publicClient.getTransactionReceipt({ hash });
                                if (receipt) {
                                    return {
                                        status: receipt.status === 'success' ? 1 : 0,
                                        transactionHash: receipt.transactionHash,
                                        blockNumber: receipt.blockNumber,
                                        gasUsed: receipt.gasUsed,
                                        confirmations: confirmations,
                                        logs: receipt.logs
                                    };
                                }
                            } catch (retryError) {
                                console.warn('Retry fetch receipt failed:', retryError);
                            }
                        }

                        throw error;
                    }
                }
            };
        },
        async signMessage(message) {
            return await walletClient.signMessage({
                account: walletClient.account,
                message
            });
        },

        // Add provider methods directly to the signer
        async call(transaction, blockTag = 'latest') {
            try {
                return await publicClient.call({ ...transaction, blockTag });
            } catch (error) {
                console.error('Signer call failed:', error);
                throw error;
            }
        },
        async estimateGas(transaction) {
            try {
                return await publicClient.estimateGas(transaction);
            } catch (error) {
                console.error('Signer estimateGas failed:', error);
                throw error;
            }
        },
        async getBalance(address, blockTag = 'latest') {
            try {
                return await publicClient.getBalance({ address, blockTag });
            } catch (error) {
                console.error('Signer getBalance failed:', error);
                throw error;
            }
        },
        async getGasPrice() {
            try {
                return await publicClient.getGasPrice();
            } catch (error) {
                console.warn('Signer getGasPrice failed, using default:', error);
                return ethers.utils.parseUnits('1', 'gwei'); // Default fallback
            }
        },
        async getTransactionCount(address, blockTag = 'latest') {
            try {
                return await publicClient.getTransactionCount({ address, blockTag });
            } catch (error) {
                console.error('Signer getTransactionCount failed:', error);
                throw error;
            }
        },
        async getBlockNumber() {
            try {
                return await publicClient.getBlockNumber();
            } catch (error) {
                console.error('Signer getBlockNumber failed:', error);
                throw error;
            }
        },
        async getNetwork() {
            return {
                chainId: publicClient.chain.id,
                name: publicClient.chain.name
            };
        },

        // Connect to a provider for compatibility
        connect(provider) {
            const newSigner = { ...customSigner };
            newSigner.provider = provider;
            return newSigner;
        }
    };

    // Link to the public client provider
    if (publicClient) {
        customSigner.provider = getEthersProvider(publicClient);
    }

    return customSigner;
};

export const isSafeWallet = (walletClient) => {
    const connectorName = walletClient?.connector?.name?.toLowerCase() || '';
    const connectorId = walletClient?.connector?.id?.toLowerCase() || '';

    // 1. Check Wagmi connector
    if (connectorName.includes('safe') || connectorId.includes('safe') || connectorName.includes('gnosis')) {
        return true;
    }

    // 2. Check window.ethereum (Safe Apps SDK)
    if (typeof window !== 'undefined' && window.ethereum) {
        // Safe Provider usually sets isSafe = true
        if (window.ethereum.isSafe === true) return true;
        // Also check for Safe-specific properties in the provider
        if (window.ethereum.isSafeApp === true) return true;
    }

    // 3. Check document referrer (Safe App)
    if (typeof document !== 'undefined' && document.referrer?.includes('safe.global')) {
        return true;
    }

    return false;
};
