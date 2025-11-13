// fetchers/FutarchyFetcher.js - Futarchy Proposal Data Fetcher

import { BaseFetcher } from '../DataLayer.js';
import { formatEther } from 'viem';

// =============================================================================
// FUTARCHY PROPOSAL ABI
// =============================================================================

const FUTARCHY_PROPOSAL_ABI = [
    {
        "inputs": [],
        "name": "collateralToken1",
        "outputs": [{"internalType": "contract IERC20", "name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "collateralToken2", 
        "outputs": [{"internalType": "contract IERC20", "name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "conditionId",
        "outputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "marketName",
        "outputs": [{"internalType": "string", "name": "", "type": "string"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "uint256", "name": "index", "type": "uint256"}],
        "name": "wrappedOutcome",
        "outputs": [
            {"internalType": "contract IERC20", "name": "wrapped1155", "type": "address"},
            {"internalType": "bytes", "name": "data", "type": "bytes"}
        ],
        "stateMutability": "view",
        "type": "function"
    }
];

// ERC20 ABI for balance checking
const ERC20_ABI = [
    {
        "name": "balanceOf",
        "type": "function", 
        "stateMutability": "view",
        "inputs": [{"name": "account", "type": "address"}],
        "outputs": [{"name": "", "type": "uint256"}]
    }
];

// =============================================================================
// FUTARCHY FETCHER CLASS
// =============================================================================

class FutarchyFetcher extends BaseFetcher {
    constructor(publicClientOrOptions) {
        super();
        
        // Support both direct publicClient or options object
        if (publicClientOrOptions && typeof publicClientOrOptions.readContract === 'function') {
            // Direct publicClient passed (viem client)
            this.publicClient = publicClientOrOptions;
        } else if (publicClientOrOptions && publicClientOrOptions.publicClient) {
            // Options object with publicClient
            this.publicClient = publicClientOrOptions.publicClient;
        } else {
            // No valid client provided
            console.warn('⚠️ FutarchyFetcher: No valid publicClient provided, some operations may fail');
            this.publicClient = null;
        }
        
        this.name = 'FutarchyFetcher';
        
        // Cache for proposal info to reduce contract calls
        this.proposalCache = new Map();
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
        
        // Register operations this fetcher supports
        this.registerOperation('futarchy.proposal', this.fetchProposalInfo.bind(this));
        this.registerOperation('futarchy.balances', this.fetchUserBalances.bind(this));
        this.registerOperation('futarchy.positions', this.fetchUserPositions.bind(this));
        this.registerOperation('futarchy.market', this.fetchMarketData.bind(this));
        this.registerOperation('futarchy.complete', this.fetchCompleteData.bind(this));
        
        console.log(`🔧 ${this.name} initialized with ${this.supportedOperations.length} operations`);
    }
    
    async fetch(dataPath, args = {}) {
        console.log(`📡 ${this.name} handling '${dataPath}' with args:`, args);
        
        if (dataPath in this.operations) {
            try {
                return await this.operations[dataPath](args);
            } catch (error) {
                return {
                    status: "error",
                    reason: error.message,
                    source: this.name
                };
            }
        } else {
            return { 
                status: "error", 
                reason: `Operation '${dataPath}' not supported by ${this.name}`,
                supportedOperations: this.supportedOperations
            };
        }
    }
    
    /**
     * Fetch basic proposal information (cached)
     */
    async fetchProposalInfo(args) {
        const { proposalAddress } = args;
        
        if (!proposalAddress) {
            throw new Error('proposalAddress is required');
        }
        
        console.log(`🔍 Fetching proposal info for ${proposalAddress}`);
        
        // Check if publicClient is available
        if (!this.publicClient || typeof this.publicClient.readContract !== 'function') {
            console.error('❌ PublicClient not available or invalid');
            return {
                status: "error",
                reason: "PublicClient not configured for FutarchyFetcher",
                source: this.name
            };
        }
        
        // Check cache first
        const cacheKey = `proposal_${proposalAddress}`;
        const cached = this.proposalCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp < this.cacheExpiry)) {
            console.log(`💾 Using cached proposal data`);
            return {
                status: "success",
                data: cached.data,
                source: this.name,
                cached: true
            };
        }
        
        try {
            // Fetch all basic proposal data in parallel
            const [marketName, collateralToken1, collateralToken2, conditionId] = await Promise.all([
                this.publicClient.readContract({
                    address: proposalAddress,
                    abi: FUTARCHY_PROPOSAL_ABI,
                    functionName: 'marketName'
                }),
                this.publicClient.readContract({
                    address: proposalAddress,
                    abi: FUTARCHY_PROPOSAL_ABI,
                    functionName: 'collateralToken1'
                }),
                this.publicClient.readContract({
                    address: proposalAddress,
                    abi: FUTARCHY_PROPOSAL_ABI,
                    functionName: 'collateralToken2'
                }),
                this.publicClient.readContract({
                    address: proposalAddress,
                    abi: FUTARCHY_PROPOSAL_ABI,
                    functionName: 'conditionId'
                })
            ]);
            
            // Fetch wrapped outcome tokens
            const [
                yesCompany,    // index 0
                noCompany,     // index 1
                yesCurrency,   // index 2
                noCurrency     // index 3
            ] = await Promise.all([
                this.publicClient.readContract({
                    address: proposalAddress,
                    abi: FUTARCHY_PROPOSAL_ABI,
                    functionName: 'wrappedOutcome',
                    args: [0]
                }),
                this.publicClient.readContract({
                    address: proposalAddress,
                    abi: FUTARCHY_PROPOSAL_ABI,
                    functionName: 'wrappedOutcome',
                    args: [1]
                }),
                this.publicClient.readContract({
                    address: proposalAddress,
                    abi: FUTARCHY_PROPOSAL_ABI,
                    functionName: 'wrappedOutcome',
                    args: [2]
                }),
                this.publicClient.readContract({
                    address: proposalAddress,
                    abi: FUTARCHY_PROPOSAL_ABI,
                    functionName: 'wrappedOutcome',
                    args: [3]
                })
            ]);
            
            const proposalData = {
                proposalAddress,
                marketName,
                conditionId,
                collateralTokens: {
                    company: collateralToken1,    // Company token (e.g., GNO)
                    currency: collateralToken2    // Currency token (e.g., SDAI)
                },
                outcomeTokens: {
                    yesCompany: yesCompany[0],    // YES_COMPANY (YES_GNO)
                    noCompany: noCompany[0],      // NO_COMPANY (NO_GNO)
                    yesCurrency: yesCurrency[0],  // YES_CURRENCY (YES_SDAI)
                    noCurrency: noCurrency[0]     // NO_CURRENCY (NO_SDAI)
                }
            };
            
            // Cache the result
            this.proposalCache.set(cacheKey, {
                data: proposalData,
                timestamp: Date.now()
            });
            
            console.log(`✅ Successfully fetched proposal info for ${marketName}`);
            
            return {
                status: "success",
                data: proposalData,
                source: this.name,
                timestamp: Date.now()
            };
            
        } catch (error) {
            console.error(`❌ Error fetching proposal info:`, error);
            throw error;
        }
    }
    
    /**
     * Fetch user balances for all outcome tokens
     */
    async fetchUserBalances(args) {
        const { proposalAddress, userAddress } = args;
        
        if (!proposalAddress || !userAddress) {
            throw new Error('proposalAddress and userAddress are required');
        }
        
        console.log(`💰 Fetching user balances for ${userAddress}`);
        
        // Get proposal info first
        const proposalInfo = await this.fetchProposalInfo({ proposalAddress });
        if (proposalInfo.status !== 'success') {
            throw new Error('Failed to fetch proposal info');
        }
        
        const { outcomeTokens, collateralTokens } = proposalInfo.data;
        
        try {
            // Fetch all balances in parallel
            const [
                yesCompanyBalance,
                noCompanyBalance,
                yesCurrencyBalance,
                noCurrencyBalance,
                companyBalance,
                currencyBalance
            ] = await Promise.all([
                this.publicClient.readContract({
                    address: outcomeTokens.yesCompany,
                    abi: ERC20_ABI,
                    functionName: 'balanceOf',
                    args: [userAddress]
                }),
                this.publicClient.readContract({
                    address: outcomeTokens.noCompany,
                    abi: ERC20_ABI,
                    functionName: 'balanceOf',
                    args: [userAddress]
                }),
                this.publicClient.readContract({
                    address: outcomeTokens.yesCurrency,
                    abi: ERC20_ABI,
                    functionName: 'balanceOf',
                    args: [userAddress]
                }),
                this.publicClient.readContract({
                    address: outcomeTokens.noCurrency,
                    abi: ERC20_ABI,
                    functionName: 'balanceOf',
                    args: [userAddress]
                }),
                this.publicClient.readContract({
                    address: collateralTokens.company,
                    abi: ERC20_ABI,
                    functionName: 'balanceOf',
                    args: [userAddress]
                }),
                this.publicClient.readContract({
                    address: collateralTokens.currency,
                    abi: ERC20_ABI,
                    functionName: 'balanceOf',
                    args: [userAddress]
                })
            ]);
            
            const balances = {
                outcomeTokens: {
                    yesCompany: {
                        raw: yesCompanyBalance.toString(),
                        formatted: formatEther(yesCompanyBalance),
                        address: outcomeTokens.yesCompany
                    },
                    noCompany: {
                        raw: noCompanyBalance.toString(),
                        formatted: formatEther(noCompanyBalance),
                        address: outcomeTokens.noCompany
                    },
                    yesCurrency: {
                        raw: yesCurrencyBalance.toString(),
                        formatted: formatEther(yesCurrencyBalance),
                        address: outcomeTokens.yesCurrency
                    },
                    noCurrency: {
                        raw: noCurrencyBalance.toString(),
                        formatted: formatEther(noCurrencyBalance),
                        address: outcomeTokens.noCurrency
                    }
                },
                collateralTokens: {
                    company: {
                        raw: companyBalance.toString(),
                        formatted: formatEther(companyBalance),
                        address: collateralTokens.company
                    },
                    currency: {
                        raw: currencyBalance.toString(),
                        formatted: formatEther(currencyBalance),
                        address: collateralTokens.currency
                    }
                }
            };
            
            console.log(`✅ Successfully fetched user balances`);
            
            return {
                status: "success",
                data: balances,
                source: this.name,
                timestamp: Date.now()
            };
            
        } catch (error) {
            console.error(`❌ Error fetching user balances:`, error);
            throw error;
        }
    }
    
    /**
     * Calculate mergeable amounts and position amounts
     */
    async fetchUserPositions(args) {
        const { proposalAddress, userAddress } = args;
        
        console.log(`📊 Calculating user positions for ${userAddress}`);
        
        // Get balances first
        const balancesResult = await this.fetchUserBalances({ proposalAddress, userAddress });
        if (balancesResult.status !== 'success') {
            throw new Error('Failed to fetch user balances');
        }
        
        const { outcomeTokens } = balancesResult.data;
        
        // Parse balances to BigInt for calculations
        const yesCompany = BigInt(outcomeTokens.yesCompany.raw);
        const noCompany = BigInt(outcomeTokens.noCompany.raw);
        const yesCurrency = BigInt(outcomeTokens.yesCurrency.raw);
        const noCurrency = BigInt(outcomeTokens.noCurrency.raw);
        
        // Calculate mergeable amounts (minimum of YES and NO for each pair)
        const mergeableCompany = yesCompany < noCompany ? yesCompany : noCompany;
        const mergeableCurrency = yesCurrency < noCurrency ? yesCurrency : noCurrency;
        
        // Calculate position amounts (surplus after merging)
        const positionCompany = yesCompany - noCompany; // Can be negative (NO position)
        const positionCurrency = yesCurrency - noCurrency; // Can be negative (NO position)
        
        const positions = {
            mergeable: {
                company: {
                    raw: mergeableCompany.toString(),
                    formatted: formatEther(mergeableCompany),
                    description: `${formatEther(mergeableCompany)} mergeable company tokens`
                },
                currency: {
                    raw: mergeableCurrency.toString(),
                    formatted: formatEther(mergeableCurrency),
                    description: `${formatEther(mergeableCurrency)} mergeable currency tokens`
                }
            },
            positions: {
                company: {
                    raw: positionCompany.toString(),
                    formatted: formatEther(positionCompany < 0n ? -positionCompany : positionCompany),
                    side: positionCompany >= 0n ? 'YES' : 'NO',
                    isLong: positionCompany >= 0n,
                    description: `${formatEther(positionCompany < 0n ? -positionCompany : positionCompany)} ${positionCompany >= 0n ? 'YES' : 'NO'} company position`
                },
                currency: {
                    raw: positionCurrency.toString(),
                    formatted: formatEther(positionCurrency < 0n ? -positionCurrency : positionCurrency),
                    side: positionCurrency >= 0n ? 'YES' : 'NO',
                    isLong: positionCurrency >= 0n,
                    description: `${formatEther(positionCurrency < 0n ? -positionCurrency : positionCurrency)} ${positionCurrency >= 0n ? 'YES' : 'NO'} currency position`
                }
            },
            summary: {
                hasPositions: positionCompany !== 0n || positionCurrency !== 0n,
                hasMergeable: mergeableCompany > 0n || mergeableCurrency > 0n,
                totalValue: formatEther(yesCompany + noCompany + yesCurrency + noCurrency)
            }
        };
        
        console.log(`✅ Successfully calculated user positions`);
        
        return {
            status: "success",
            data: positions,
            source: this.name,
            timestamp: Date.now()
        };
    }
    
    /**
     * Fetch market data (combination of proposal info)
     */
    async fetchMarketData(args) {
        const { proposalAddress } = args;
        
        console.log(`🏛️ Fetching market data for ${proposalAddress}`);
        
        const proposalInfo = await this.fetchProposalInfo({ proposalAddress });
        if (proposalInfo.status !== 'success') {
            throw new Error('Failed to fetch proposal info');
        }
        
        return {
            status: "success",
            data: {
                ...proposalInfo.data,
                type: 'futarchy_proposal',
                lastUpdated: Date.now()
            },
            source: this.name,
            timestamp: Date.now()
        };
    }
    
    /**
     * Fetch complete data (proposal + user balances + positions)
     */
    async fetchCompleteData(args) {
        const { proposalAddress, userAddress } = args;
        
        console.log(`🔄 Fetching complete data for ${proposalAddress}`);
        
        try {
            // Fetch all data in parallel
            const [proposalInfo, userBalances, userPositions] = await Promise.all([
                this.fetchProposalInfo({ proposalAddress }),
                userAddress ? this.fetchUserBalances({ proposalAddress, userAddress }) : null,
                userAddress ? this.fetchUserPositions({ proposalAddress, userAddress }) : null
            ]);
            
            const completeData = {
                proposal: proposalInfo.status === 'success' ? proposalInfo.data : null,
                balances: userBalances?.status === 'success' ? userBalances.data : null,
                positions: userPositions?.status === 'success' ? userPositions.data : null,
                userAddress,
                hasUserData: !!userAddress
            };
            
            console.log(`✅ Successfully fetched complete futarchy data`);
            
            return {
                status: "success",
                data: completeData,
                source: this.name,
                timestamp: Date.now()
            };
            
        } catch (error) {
            console.error(`❌ Error fetching complete data:`, error);
            throw error;
        }
    }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

export function createFutarchyFetcher(publicClient) {
    console.log(`🔧 Creating FutarchyFetcher with viem client...`);
    return new FutarchyFetcher(publicClient);
}

// =============================================================================
// EXPORTS
// =============================================================================

export { FutarchyFetcher };