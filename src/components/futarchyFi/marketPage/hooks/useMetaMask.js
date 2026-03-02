import { useState, useEffect, useCallback } from 'react';

export const useMetaMask = () => {
    const [account, setAccount] = useState(null);
    const [chainId, setChainId] = useState(null);
    const [provider, setProvider] = useState(null);
    const [signer, setSigner] = useState(null);

    // Initialize provider and check connection
    useEffect(() => {
        const init = async () => {
            if (typeof window.ethereum !== 'undefined') {
                const provider = window.ethereum;
                setProvider(provider);

                // Get current account if already connected
                const accounts = await provider.request({ method: 'eth_accounts' });
                if (accounts.length > 0) {
                    setAccount(accounts[0]);
                }

                // Get current chain
                const chainId = await provider.request({ method: 'eth_chainId' });
                setChainId(chainId);

                // Set up event listeners
                provider.on('accountsChanged', handleAccountsChanged);
                provider.on('chainChanged', handleChainChanged);
            }
        };

        init();

        return () => {
            if (provider) {
                provider.removeListener('accountsChanged', handleAccountsChanged);
                provider.removeListener('chainChanged', handleChainChanged);
            }
        };
    }, []);

    const handleAccountsChanged = (accounts) => {
        if (accounts.length === 0) {
            setAccount(null);
            setSigner(null);
        } else {
            setAccount(accounts[0]);
        }
    };

    const handleChainChanged = (chainId) => {
        setChainId(chainId);
    };

    const connect = useCallback(async () => {
        if (!provider) {
            throw new Error('MetaMask not installed');
        }

        try {
            const accounts = await provider.request({
                method: 'eth_requestAccounts'
            });
            setAccount(accounts[0]);

            // Get signer
            const ethersProvider = new ethers.providers.Web3Provider(provider);
            const signer = ethersProvider.getSigner();
            setSigner(signer);

            return accounts[0];
        } catch (error) {
            console.error('Error connecting to MetaMask:', error);
            throw error;
        }
    }, [provider]);

    const checkAndSwitchChain = useCallback(async (requiredChainId) => {
        if (chainId !== requiredChainId) {
            try {
                await provider.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: requiredChainId }],
                });
                return true;
            } catch (error) {
                console.error('Error switching chain:', error);
                throw error;
            }
        }
        return true;
    }, [chainId, provider]);

    const checkAndApproveToken = useCallback(async (tokenAddress, spenderAddress, amount) => {
        if (!signer) throw new Error('No signer available');

        const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
        const currentAllowance = await token.allowance(account, spenderAddress);

        if (currentAllowance.lt(amount)) {
            try {
                const tx = await token.approve(spenderAddress, amount);
                await tx.wait();
                return true;
            } catch (error) {
                console.error('Error approving token:', error);
                throw error;
            }
        }
        return true;
    }, [signer, account]);

    return {
        account,
        chainId,
        provider,
        signer,
        connect,
        checkAndSwitchChain,
        checkAndApproveToken
    };
}; 