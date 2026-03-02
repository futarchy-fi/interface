// ERC20Fetcher.js - Fetcher for ERC20 token information from blockchain

import { BaseFetcher } from '../DataLayer.js';
import { createPublicClient, http, formatUnits } from 'viem';
import { gnosis, mainnet, polygon, arbitrum, optimism, base } from 'viem/chains';

// =============================================================================
// ERC20 ABI - Standard ERC20 Token Interface
// =============================================================================

const ERC20_ABI = [
    {
        name: 'name',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'string' }]
    },
    {
        name: 'symbol',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'string' }]
    },
    {
        name: 'decimals',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint8' }]
    },
    {
        name: 'totalSupply',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }]
    },
    {
        name: 'balanceOf',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }]
    },
    {
        name: 'allowance',
        type: 'function',
        stateMutability: 'view',
        inputs: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' }
        ],
        outputs: [{ name: '', type: 'uint256' }]
    },
    {
        name: 'approve',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'uint256' }
        ],
        outputs: [{ name: '', type: 'bool' }]
    },
    {
        name: 'transfer',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'to', type: 'address' },
            { name: 'amount', type: 'uint256' }
        ],
        outputs: [{ name: '', type: 'bool' }]
    },
    {
        name: 'transferFrom',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'from', type: 'address' },
            { name: 'to', type: 'address' },
            { name: 'amount', type: 'uint256' }
        ],
        outputs: [{ name: '', type: 'bool' }]
    }
];

// =============================================================================
// CHAIN CONFIGURATION
// =============================================================================

const CHAIN_MAP = {
    1: mainnet,
    100: gnosis,
    137: polygon,
    42161: arbitrum,
    10: optimism,
    8453: base
};

const CHAIN_NAMES = {
    1: 'Ethereum',
    100: 'Gnosis',
    137: 'Polygon',
    42161: 'Arbitrum',
    10: 'Optimism',
    8453: 'Base'
};

// =============================================================================
// ERC20 FETCHER CLASS
// =============================================================================

class ERC20Fetcher extends BaseFetcher {
    constructor(rpcUrl = null, chainId = 100) {
        super();
        this.name = 'ERC20Fetcher';
        this.rpcUrl = rpcUrl;
        this.chainId = chainId;
        this.chain = CHAIN_MAP[chainId] || gnosis;
        this.publicClient = null;
        this.tokenCache = new Map(); // Cache token info to avoid repeated calls

        // Initialize the public client
        this.initializeClient();

        // Register supported operations
        this.registerOperation('erc20.info', this.getTokenInfo.bind(this));
        this.registerOperation('erc20.balance', this.getTokenBalance.bind(this));
        this.registerOperation('erc20.allowance', this.getTokenAllowance.bind(this));
        this.registerOperation('erc20.supply', this.getTotalSupply.bind(this));
        this.registerOperation('erc20.metadata', this.getTokenMetadata.bind(this));
        this.registerOperation('erc20.multi', this.getMultipleTokenInfo.bind(this));

        console.log(`🔧 ${this.name} initialized for ${CHAIN_NAMES[chainId] || 'Unknown'} chain`);
        console.log(`📡 RPC: ${this.rpcUrl || 'Default'}`);
    }

    initializeClient() {
        const transport = this.rpcUrl
            ? http(this.rpcUrl)
            : http(); // Use default RPC for the chain

        this.publicClient = createPublicClient({
            chain: this.chain,
            transport
        });
    }

    async fetch(dataPath, args = {}) {
        console.log(`📡 ${this.name} handling '${dataPath}' with args:`, args);

        if (dataPath in this.operations) {
            try {
                return await this.operations[dataPath](args);
            } catch (error) {
                return {
                    status: 'error',
                    reason: error.message,
                    source: this.name
                };
            }
        } else {
            return {
                status: 'error',
                reason: `Operation '${dataPath}' not supported by ${this.name}`,
                supportedOperations: this.supportedOperations
            };
        }
    }

    /**
     * Get comprehensive token information
     * @param {object} args
     * @param {string} args.tokenAddress - ERC20 token contract address
     * @param {string} args.userAddress - Optional user address for balance
     */
    async getTokenInfo(args) {
        const { tokenAddress, userAddress } = args;

        if (!tokenAddress) {
            throw new Error('tokenAddress is required for erc20.info operation');
        }

        console.log(`🔍 Fetching ERC20 info for ${tokenAddress}`);

        // Check cache first
        const cacheKey = `${this.chainId}:${tokenAddress}`;
        if (this.tokenCache.has(cacheKey) && !userAddress) {
            console.log(`📦 Using cached data for ${tokenAddress}`);
            return {
                status: 'success',
                data: this.tokenCache.get(cacheKey),
                source: this.name,
                cached: true,
                timestamp: Date.now()
            };
        }

        // Create contract instance using publicClient directly
        const contract = {
            read: {
                name: () => this.publicClient.readContract({
                    address: tokenAddress,
                    abi: ERC20_ABI,
                    functionName: 'name'
                }),
                symbol: () => this.publicClient.readContract({
                    address: tokenAddress,
                    abi: ERC20_ABI,
                    functionName: 'symbol'
                }),
                decimals: () => this.publicClient.readContract({
                    address: tokenAddress,
                    abi: ERC20_ABI,
                    functionName: 'decimals'
                }),
                totalSupply: () => this.publicClient.readContract({
                    address: tokenAddress,
                    abi: ERC20_ABI,
                    functionName: 'totalSupply'
                }),
                balanceOf: (args) => this.publicClient.readContract({
                    address: tokenAddress,
                    abi: ERC20_ABI,
                    functionName: 'balanceOf',
                    args
                })
            }
        };

        // Fetch all token data in parallel
        const [name, symbol, decimals, totalSupply] = await Promise.all([
            this.safeCall(() => contract.read.name(), 'Unknown'),
            this.safeCall(() => contract.read.symbol(), 'UNKNOWN'),
            this.safeCall(() => contract.read.decimals(), 18),
            this.safeCall(() => contract.read.totalSupply(), 0n)
        ]);

        // Fetch user balance if address provided
        let userBalance = null;
        let userBalanceFormatted = null;
        if (userAddress) {
            userBalance = await this.safeCall(
                () => contract.read.balanceOf([userAddress]),
                0n
            );
            userBalanceFormatted = formatUnits(userBalance, decimals);
        }

        const tokenInfo = {
            address: tokenAddress,
            name,
            symbol,
            decimals,
            totalSupply: totalSupply.toString(),
            totalSupplyFormatted: formatUnits(totalSupply, decimals),
            chainId: this.chainId,
            chainName: CHAIN_NAMES[this.chainId] || 'Unknown',
            userBalance: userBalance?.toString(),
            userBalanceFormatted,
            userAddress
        };

        // Cache the basic token info (without user-specific data)
        if (!userAddress) {
            this.tokenCache.set(cacheKey, tokenInfo);
        }

        console.log(`✅ Successfully fetched info for ${symbol} (${name})`);

        return {
            status: 'success',
            data: tokenInfo,
            source: this.name,
            timestamp: Date.now()
        };
    }

    /**
     * Get token balance for a specific address
     */
    async getTokenBalance(args) {
        const { tokenAddress, userAddress } = args;

        if (!tokenAddress || !userAddress) {
            throw new Error('tokenAddress and userAddress are required for erc20.balance operation');
        }

        console.log(`🔍 Fetching balance for ${userAddress}`);

        const [balance, decimals, symbol] = await Promise.all([
            this.publicClient.readContract({
                address: tokenAddress,
                abi: ERC20_ABI,
                functionName: 'balanceOf',
                args: [userAddress]
            }),
            this.safeCall(() => this.publicClient.readContract({
                address: tokenAddress,
                abi: ERC20_ABI,
                functionName: 'decimals'
            }), 18),
            this.safeCall(() => this.publicClient.readContract({
                address: tokenAddress,
                abi: ERC20_ABI,
                functionName: 'symbol'
            }), 'UNKNOWN')
        ]);

        const balanceData = {
            tokenAddress,
            userAddress,
            symbol,
            decimals,
            balance: balance.toString(),
            balanceFormatted: formatUnits(balance, decimals),
            balanceNumber: parseFloat(formatUnits(balance, decimals))
        };

        console.log(`✅ Balance: ${balanceData.balanceFormatted} ${symbol}`);

        return {
            status: 'success',
            data: balanceData,
            source: this.name,
            timestamp: Date.now()
        };
    }

    /**
     * Get token allowance
     */
    async getTokenAllowance(args) {
        const { tokenAddress, ownerAddress, spenderAddress } = args;

        if (!tokenAddress || !ownerAddress || !spenderAddress) {
            throw new Error('tokenAddress, ownerAddress, and spenderAddress are required');
        }

        console.log(`🔍 Fetching allowance from ${ownerAddress} to ${spenderAddress}`);

        const [allowance, decimals, symbol] = await Promise.all([
            this.publicClient.readContract({
                address: tokenAddress,
                abi: ERC20_ABI,
                functionName: 'allowance',
                args: [ownerAddress, spenderAddress]
            }),
            this.safeCall(() => this.publicClient.readContract({
                address: tokenAddress,
                abi: ERC20_ABI,
                functionName: 'decimals'
            }), 18),
            this.safeCall(() => this.publicClient.readContract({
                address: tokenAddress,
                abi: ERC20_ABI,
                functionName: 'symbol'
            }), 'UNKNOWN')
        ]);

        const allowanceData = {
            tokenAddress,
            ownerAddress,
            spenderAddress,
            symbol,
            decimals,
            allowance: allowance.toString(),
            allowanceFormatted: formatUnits(allowance, decimals),
            isApproved: allowance > 0n,
            isUnlimited: allowance > BigInt(2 ** 255) // Check if it's max approval
        };

        console.log(`✅ Allowance: ${allowanceData.allowanceFormatted} ${symbol}`);

        return {
            status: 'success',
            data: allowanceData,
            source: this.name,
            timestamp: Date.now()
        };
    }

    /**
     * Get total supply of a token
     */
    async getTotalSupply(args) {
        const { tokenAddress } = args;

        if (!tokenAddress) {
            throw new Error('tokenAddress is required for erc20.supply operation');
        }

        console.log(`🔍 Fetching total supply for ${tokenAddress}`);

        const [totalSupply, decimals, symbol, name] = await Promise.all([
            this.publicClient.readContract({
                address: tokenAddress,
                abi: ERC20_ABI,
                functionName: 'totalSupply'
            }),
            this.safeCall(() => this.publicClient.readContract({
                address: tokenAddress,
                abi: ERC20_ABI,
                functionName: 'decimals'
            }), 18),
            this.safeCall(() => this.publicClient.readContract({
                address: tokenAddress,
                abi: ERC20_ABI,
                functionName: 'symbol'
            }), 'UNKNOWN'),
            this.safeCall(() => this.publicClient.readContract({
                address: tokenAddress,
                abi: ERC20_ABI,
                functionName: 'name'
            }), 'Unknown')
        ]);

        const supplyData = {
            tokenAddress,
            name,
            symbol,
            decimals,
            totalSupply: totalSupply.toString(),
            totalSupplyFormatted: formatUnits(totalSupply, decimals),
            totalSupplyNumber: parseFloat(formatUnits(totalSupply, decimals))
        };

        console.log(`✅ Total Supply: ${supplyData.totalSupplyFormatted} ${symbol}`);

        return {
            status: 'success',
            data: supplyData,
            source: this.name,
            timestamp: Date.now()
        };
    }

    /**
     * Get just the metadata (name, symbol, decimals)
     */
    async getTokenMetadata(args) {
        const { tokenAddress } = args;

        if (!tokenAddress) {
            throw new Error('tokenAddress is required for erc20.metadata operation');
        }

        console.log(`🔍 Fetching metadata for ${tokenAddress}`);

        const [name, symbol, decimals] = await Promise.all([
            this.safeCall(() => this.publicClient.readContract({
                address: tokenAddress,
                abi: ERC20_ABI,
                functionName: 'name'
            }), 'Unknown'),
            this.safeCall(() => this.publicClient.readContract({
                address: tokenAddress,
                abi: ERC20_ABI,
                functionName: 'symbol'
            }), 'UNKNOWN'),
            this.safeCall(() => this.publicClient.readContract({
                address: tokenAddress,
                abi: ERC20_ABI,
                functionName: 'decimals'
            }), 18)
        ]);

        const metadata = {
            address: tokenAddress,
            name,
            symbol,
            decimals,
            chainId: this.chainId,
            chainName: CHAIN_NAMES[this.chainId] || 'Unknown'
        };

        console.log(`✅ Token: ${symbol} - ${name} (${decimals} decimals)`);

        return {
            status: 'success',
            data: metadata,
            source: this.name,
            timestamp: Date.now()
        };
    }

    /**
     * Get info for multiple tokens at once
     */
    async getMultipleTokenInfo(args) {
        const { tokenAddresses, userAddress } = args;

        if (!tokenAddresses || !Array.isArray(tokenAddresses)) {
            throw new Error('tokenAddresses array is required for erc20.multi operation');
        }

        console.log(`🔍 Fetching info for ${tokenAddresses.length} tokens`);

        const results = await Promise.all(
            tokenAddresses.map(async (tokenAddress) => {
                try {
                    const result = await this.getTokenInfo({ tokenAddress, userAddress });
                    return result.data;
                } catch (error) {
                    return {
                        address: tokenAddress,
                        error: error.message,
                        name: 'Error',
                        symbol: 'ERROR',
                        decimals: 0
                    };
                }
            })
        );

        console.log(`✅ Fetched info for ${results.length} tokens`);

        return {
            status: 'success',
            data: results,
            source: this.name,
            count: results.length,
            timestamp: Date.now()
        };
    }

    /**
     * Safe call wrapper to handle contract call failures
     */
    async safeCall(fn, defaultValue) {
        try {
            return await fn();
        } catch (error) {
            console.log(`⚠️ Call failed, using default: ${defaultValue}`);
            return defaultValue;
        }
    }

    /**
     * Clear the token cache
     */
    clearCache() {
        this.tokenCache.clear();
        console.log('🗑️ Token cache cleared');
    }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create an ERC20Fetcher instance
 * @param {string} rpcUrl - RPC endpoint URL (optional, uses default if not provided)
 * @param {number} chainId - Chain ID (default: 100 for Gnosis)
 */
function createERC20Fetcher(rpcUrl = null, chainId = 100) {
    return new ERC20Fetcher(rpcUrl, chainId);
}

// =============================================================================
// EXPORTS
// =============================================================================

export { ERC20Fetcher, createERC20Fetcher, ERC20_ABI, CHAIN_MAP, CHAIN_NAMES };