/**
 * useCreatePool Hook
 * 
 * Handles pool creation for Futarchy markets via Uniswap V3 (Chain 1) or Algebra (Chain 100).
 * No token approval needed for pool creation - only creates and initializes the pool.
 */

import { useState, useCallback } from 'react';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { ethers } from 'ethers';
import { CHAIN_CONFIG, getExplorerTxUrl } from '../components/debug/constants/chainConfig';

// Position Manager ABI - different for Uniswap V3 vs Algebra
const UNISWAP_V3_NFPM_ABI = [
    'function createAndInitializePoolIfNecessary(address token0, address token1, uint24 fee, uint160 sqrtPriceX96) external payable returns (address pool)'
];

const ALGEBRA_NFPM_ABI = [
    'function createAndInitializePoolIfNecessary(address token0, address token1, uint160 sqrtPriceX96) external payable returns (address pool)'
];

/**
 * Convert price to sqrtPriceX96
 * @param {number} price - Price as token1 per token0
 * @returns {bigint} sqrtPriceX96
 */
function priceToSqrtPriceX96(price) {
    const sqrtPrice = Math.sqrt(price);
    const Q96 = 2n ** 96n;
    return BigInt(Math.floor(sqrtPrice * Number(Q96)));
}

/**
 * Get AMM token order (lower address first)
 * @param {string} token0 - Logical token0 address
 * @param {string} token1 - Logical token1 address
 * @returns {{ ammToken0: string, ammToken1: string, needsReorder: boolean }}
 */
function getAMMOrder(token0, token1) {
    const t0Lower = token0.toLowerCase();
    const t1Lower = token1.toLowerCase();
    const needsReorder = t0Lower > t1Lower;

    return {
        ammToken0: needsReorder ? token1 : token0,
        ammToken1: needsReorder ? token0 : token1,
        needsReorder
    };
}

export function useCreatePool() {
    const { address, isConnected } = useAccount();
    const chainId = useChainId();
    const { switchChainAsync } = useSwitchChain();

    const [status, setStatus] = useState({ type: 'idle', message: '' });
    const [txHash, setTxHash] = useState(null);
    const [poolAddress, setPoolAddress] = useState(null);
    const [isCreating, setIsCreating] = useState(false);

    /**
     * Create a pool with the given token pair and initial price
     * @param {Object} params
     * @param {string} params.token0 - First token address (logical)
     * @param {string} params.token1 - Second token address (logical)
     * @param {number} params.initialPrice - Price as token1 per token0
     * @param {number} params.targetChainId - Target chain ID (1 or 100)
     * @param {number} [params.feeTier=3000] - Fee tier for Uniswap V3 (ignored for Algebra)
     */
    const createPool = useCallback(async ({
        token0,
        token1,
        initialPrice,
        targetChainId,
        feeTier = 3000
    }) => {
        if (!isConnected || !address) {
            setStatus({ type: 'error', message: 'Please connect your wallet' });
            return null;
        }

        const config = CHAIN_CONFIG[targetChainId];
        if (!config) {
            setStatus({ type: 'error', message: `Unsupported chain: ${targetChainId}` });
            return null;
        }

        setIsCreating(true);
        setTxHash(null);
        setPoolAddress(null);

        try {
            // Switch chain if needed
            if (chainId !== targetChainId) {
                setStatus({ type: 'pending', message: `Switching to ${config.name}...` });
                await switchChainAsync({ chainId: targetChainId });
                // Wait a bit for chain switch to propagate
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            // Get fresh provider/signer after chain switch
            if (!window.ethereum) {
                throw new Error('No wallet provider found');
            }

            const provider = new ethers.providers.Web3Provider(window.ethereum);
            const signer = provider.getSigner();

            // Verify chain
            const network = await provider.getNetwork();
            if (network.chainId !== targetChainId) {
                throw new Error(`Chain mismatch: expected ${targetChainId}, got ${network.chainId}`);
            }

            // Get AMM token order
            const { ammToken0, ammToken1, needsReorder } = getAMMOrder(token0, token1);

            // Calculate sqrtPriceX96 (adjust for token order)
            const ammPrice = needsReorder ? (1 / initialPrice) : initialPrice;
            const sqrtPriceX96 = priceToSqrtPriceX96(ammPrice);

            console.log('[useCreatePool] Creating pool:', {
                ammToken0,
                ammToken1,
                logicalPrice: initialPrice,
                ammPrice,
                sqrtPriceX96: sqrtPriceX96.toString(),
                needsReorder,
                amm: config.amm
            });

            // Create position manager contract
            const abi = config.amm === 'uniswap' ? UNISWAP_V3_NFPM_ABI : ALGEBRA_NFPM_ABI;
            const positionManager = new ethers.Contract(
                config.positionManager,
                abi,
                signer
            );

            setStatus({ type: 'pending', message: 'Creating pool transaction...' });

            // Call createAndInitializePoolIfNecessary
            let tx;
            if (config.amm === 'uniswap') {
                const fee = feeTier || config.defaultFeeTier || 3000;
                tx = await positionManager.createAndInitializePoolIfNecessary(
                    ammToken0,
                    ammToken1,
                    fee,
                    sqrtPriceX96,
                    { gasLimit: 5000000 }
                );
            } else {
                // Algebra (no fee tier)
                tx = await positionManager.createAndInitializePoolIfNecessary(
                    ammToken0,
                    ammToken1,
                    sqrtPriceX96,
                    { gasLimit: 16000000 } // Algebra needs higher gas
                );
            }

            setTxHash(tx.hash);
            setStatus({ type: 'pending', message: 'Waiting for confirmation...' });

            console.log('[useCreatePool] Transaction submitted:', tx.hash);

            // Wait for confirmation
            const receipt = await tx.wait();

            // Try to extract pool address from Initialize event
            let createdPoolAddress = null;
            const initTopic = ethers.utils.id('Initialize(uint160,int24)');
            for (const log of (receipt.logs || [])) {
                if (log.topics && log.topics[0] === initTopic && log.address) {
                    createdPoolAddress = log.address;
                    console.log('[useCreatePool] Found pool from Initialize event:', createdPoolAddress);
                    break;
                }
            }

            setPoolAddress(createdPoolAddress);
            setStatus({
                type: 'success',
                message: `Pool created successfully!${createdPoolAddress ? ` Address: ${createdPoolAddress.slice(0, 10)}...` : ''}`
            });

            return {
                txHash: tx.hash,
                poolAddress: createdPoolAddress,
                receipt
            };

        } catch (error) {
            console.error('[useCreatePool] Error:', error);

            let errorMessage = 'Pool creation failed';
            if (error.reason) {
                errorMessage = error.reason;
            } else if (error.message) {
                if (error.message.includes('user rejected')) {
                    errorMessage = 'Transaction rejected by user';
                } else if (error.message.includes('insufficient funds')) {
                    errorMessage = 'Insufficient funds for gas';
                } else {
                    errorMessage = error.message.slice(0, 100);
                }
            }

            setStatus({ type: 'error', message: errorMessage });
            return null;
        } finally {
            setIsCreating(false);
        }
    }, [isConnected, address, chainId, switchChainAsync]);

    /**
     * Reset the hook state
     */
    const reset = useCallback(() => {
        setStatus({ type: 'idle', message: '' });
        setTxHash(null);
        setPoolAddress(null);
        setIsCreating(false);
    }, []);

    /**
     * Get explorer link for transaction
     */
    const getExplorerLink = useCallback((targetChainId) => {
        if (!txHash || !targetChainId) return null;
        return getExplorerTxUrl(targetChainId, txHash);
    }, [txHash]);

    return {
        createPool,
        reset,
        getExplorerLink,
        status,
        txHash,
        poolAddress,
        isCreating,
        isConnected
    };
}

export default useCreatePool;
