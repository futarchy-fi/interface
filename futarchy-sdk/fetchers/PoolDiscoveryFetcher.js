// fetchers/PoolDiscoveryFetcher.js - Fetcher for discovering pools related to Futarchy proposals

import { BaseFetcher } from '../DataLayer.js';
import { createPublicClient, http, parseAbi } from 'viem';
import { gnosis, polygon, mainnet } from 'viem/chains';

// Algebra Factory ABI for finding pools
const ALGEBRA_FACTORY_ABI = parseAbi([
    'function poolByPair(address token0, address token1) view returns (address pool)',
    'function pools(address token0, address token1) view returns (address pool)'
]);

// Algebra Pool ABI - corrected globalState signature
const ALGEBRA_POOL_ABI = parseAbi([
    'function token0() view returns (address)',
    'function token1() view returns (address)',
    'function liquidity() view returns (uint128)',
    'function globalState() view returns (uint160 sqrtPriceX96, int24 tick, uint16 fee, uint16 timepointIndex, uint8 communityFeeToken0, uint8 communityFeeToken1, bool unlocked)',
    'function totalFeeGrowth0Token() view returns (uint256)',
    'function totalFeeGrowth1Token() view returns (uint256)'
]);

// Uniswap V3 Factory + Pool ABIs
const UNISWAP_FACTORY_ABI = parseAbi([
    'function getPool(address token0, address token1, uint24 fee) view returns (address)'
]);

const UNISWAP_POOL_ABI = parseAbi([
    'function token0() view returns (address)',
    'function token1() view returns (address)',
    'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)'
]);

// ERC20 ABI
const ERC20_ABI = parseAbi([
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)',
    'function balanceOf(address account) view returns (uint256)',
    'function totalSupply() view returns (uint256)'
]);

// Algebra Factory address on Gnosis Chain
// This is the Swapr Algebra factory used on Gnosis
const ALGEBRA_FACTORY = '0xA0864cCA6E114013AB0e27cbd5B6f4c8947da766';

// =============================================================================
// POOL DISCOVERY FETCHER - Discovers pools related to Futarchy proposals
// =============================================================================

class PoolDiscoveryFetcher extends BaseFetcher {
    constructor(options = 'https://rpc.gnosischain.com') {
        super();
        this.name = 'PoolDiscoveryFetcher';
        if (typeof options === 'string') {
            this.rpcUrl = options;
            this.mode = 'algebra';
            this.uniswapFactory = null;
            this.viemChain = gnosis;
        } else {
            const { rpcUrl = 'https://rpc.gnosischain.com', mode = 'algebra', uniswapFactory = null, chainId } = options || {};
            this.rpcUrl = rpcUrl;
            this.mode = mode; // 'algebra' | 'uniswap'
            this.uniswapFactory = uniswapFactory;
            this.viemChain = chainId === 137 ? polygon : (chainId === 1 ? mainnet : gnosis);
        }
        
        // Create public client for reading blockchain data
        this.publicClient = createPublicClient({ chain: this.viemChain, transport: http(this.rpcUrl) });
        
        // Register operations this fetcher supports
        this.registerOperation('pools.discover', this.discoverPools.bind(this));
        this.registerOperation('pools.conditional', this.fetchConditionalPools.bind(this));
        this.registerOperation('pools.probability', this.fetchProbabilityPools.bind(this));
        this.registerOperation('pools.details', this.fetchPoolDetails.bind(this));
        this.registerOperation('pools.liquidity', this.fetchPoolLiquidity.bind(this));
        this.registerOperation('pools.prices', this.fetchPoolPrices.bind(this));
        
        console.log(`🔧 ${this.name} initialized with ${this.supportedOperations.length} operations`);
    }
    
    async fetch(dataPath, args = {}) {
        console.log(`📡 ${this.name} handling '${dataPath}' with args:`, args);
        
        if (dataPath in this.operations) {
            return await this.operations[dataPath](args);
        } else {
            return { 
                status: "error", 
                reason: `Operation '${dataPath}' not supported by ${this.name}`,
                supportedOperations: this.supportedOperations
            };
        }
    }
    
    // Discover all pools related to a proposal
    async discoverPools(args) {
        const { proposalAddress } = args;
        
        if (!proposalAddress) {
            return {
                status: "error",
                reason: "proposalAddress is required",
                source: this.name
            };
        }
        
        console.log(`🔍 Discovering pools for proposal ${proposalAddress}`);
        
        try {
            // First, get the wrapped outcome tokens from the proposal
            const tokens = await this.getProposalTokens(proposalAddress);
            if (!tokens) {
                return {
                    status: "error",
                    reason: "Could not fetch proposal tokens",
                    source: this.name
                };
            }
            
            // Find all possible pool combinations (the 6 standard pools)
            const pools = await this.findAllPools(tokens);
            
            // Categorize pools according to algebra-cli structure
            const conditionalPools = pools.filter(p => p.type === 'conditional');
            const predictionPools = pools.filter(p => p.type === 'prediction');
            
            return {
                status: "success",
                data: {
                    proposalAddress,
                    totalPools: pools.length,
                    conditionalPools,
                    predictionPools,
                    allPools: pools,
                    tokens
                },
                source: this.name
            };
        } catch (error) {
            return {
                status: "error",
                reason: error.message,
                source: this.name
            };
        }
    }
    
    // Fetch only conditional token pools (YES/NO pairs)
    async fetchConditionalPools(args) {
        const { proposalAddress } = args;
        
        if (!proposalAddress) {
            return {
                status: "error",
                reason: "proposalAddress is required",
                source: this.name
            };
        }
        
        console.log(`🔍 Fetching conditional pools for proposal ${proposalAddress}`);
        
        try {
            const tokens = await this.getProposalTokens(proposalAddress);
            if (!tokens) {
                return {
                    status: "error",
                    reason: "Could not fetch proposal tokens",
                    source: this.name
                };
            }
            
            // Conditional pools are YES/NO pairs for same collateral
            const conditionalPools = [];
            
            // Check for YES_COMPANY/NO_COMPANY pool
            const companyPool = await this.findPool(tokens.yesCompany, tokens.noCompany);
            if (companyPool) {
                conditionalPools.push({
                    ...companyPool,
                    name: 'YES_COMPANY/NO_COMPANY',
                    type: 'conditional',
                    collateral: 'company'
                });
            }
            
            // Check for YES_CURRENCY/NO_CURRENCY pool
            const currencyPool = await this.findPool(tokens.yesCurrency, tokens.noCurrency);
            if (currencyPool) {
                conditionalPools.push({
                    ...currencyPool,
                    name: 'YES_CURRENCY/NO_CURRENCY',
                    type: 'conditional',
                    collateral: 'currency'
                });
            }
            
            return {
                status: "success",
                data: {
                    proposalAddress,
                    conditionalPools,
                    count: conditionalPools.length
                },
                source: this.name
            };
        } catch (error) {
            return {
                status: "error",
                reason: error.message,
                source: this.name
            };
        }
    }
    
    // Fetch probability pools (YES vs NO across different collaterals)
    async fetchProbabilityPools(args) {
        const { proposalAddress } = args;
        
        if (!proposalAddress) {
            return {
                status: "error",
                reason: "proposalAddress is required",
                source: this.name
            };
        }
        
        console.log(`🔍 Fetching probability pools for proposal ${proposalAddress}`);
        
        try {
            const tokens = await this.getProposalTokens(proposalAddress);
            if (!tokens) {
                return {
                    status: "error",
                    reason: "Could not fetch proposal tokens",
                    source: this.name
                };
            }
            
            // Probability pools show market sentiment
            const probabilityPools = [];
            
            // YES_COMPANY/YES_CURRENCY
            const yesPool = await this.findPool(tokens.yesCompany, tokens.yesCurrency);
            if (yesPool) {
                probabilityPools.push({
                    ...yesPool,
                    name: 'YES_COMPANY/YES_CURRENCY',
                    type: 'probability',
                    outcome: 'YES'
                });
            }
            
            // NO_COMPANY/NO_CURRENCY
            const noPool = await this.findPool(tokens.noCompany, tokens.noCurrency);
            if (noPool) {
                probabilityPools.push({
                    ...noPool,
                    name: 'NO_COMPANY/NO_CURRENCY',
                    type: 'probability',
                    outcome: 'NO'
                });
            }
            
            // YES_COMPANY/NO_CURRENCY (cross pool)
            const yesCrossPool = await this.findPool(tokens.yesCompany, tokens.noCurrency);
            if (yesCrossPool) {
                probabilityPools.push({
                    ...yesCrossPool,
                    name: 'YES_COMPANY/NO_CURRENCY',
                    type: 'probability',
                    outcome: 'CROSS'
                });
            }
            
            // NO_COMPANY/YES_CURRENCY (cross pool)
            const noCrossPool = await this.findPool(tokens.noCompany, tokens.yesCurrency);
            if (noCrossPool) {
                probabilityPools.push({
                    ...noCrossPool,
                    name: 'NO_COMPANY/YES_CURRENCY',
                    type: 'probability',
                    outcome: 'CROSS'
                });
            }
            
            return {
                status: "success",
                data: {
                    proposalAddress,
                    probabilityPools,
                    count: probabilityPools.length
                },
                source: this.name
            };
        } catch (error) {
            return {
                status: "error",
                reason: error.message,
                source: this.name
            };
        }
    }
    
    // Fetch detailed information about a specific pool
    async fetchPoolDetails(args) {
        const { poolAddress } = args;
        
        if (!poolAddress) {
            return {
                status: "error",
                reason: "poolAddress is required",
                source: this.name
            };
        }
        
        console.log(`🔍 Fetching details for pool ${poolAddress}`);
        
        try {
            const poolAbi = this.mode === 'uniswap' ? UNISWAP_POOL_ABI : ALGEBRA_POOL_ABI;
            const stateFn = this.mode === 'uniswap' ? 'slot0' : 'globalState';
            const [token0, token1, liquidity, globalState] = await Promise.all([
                this.publicClient.readContract({ address: poolAddress, abi: poolAbi, functionName: 'token0' }),
                this.publicClient.readContract({ address: poolAddress, abi: poolAbi, functionName: 'token1' }),
                this.mode === 'uniswap' ? Promise.resolve(0n) : this.publicClient.readContract({ address: poolAddress, abi: poolAbi, functionName: 'liquidity' }),
                this.publicClient.readContract({ address: poolAddress, abi: poolAbi, functionName: stateFn })
            ]);
            
            // Get token symbols
            const [token0Symbol, token1Symbol] = await Promise.all([
                this.publicClient.readContract({
                    address: token0,
                    abi: ERC20_ABI,
                    functionName: 'symbol'
                }).catch(() => 'UNKNOWN'),
                this.publicClient.readContract({
                    address: token1,
                    abi: ERC20_ABI,
                    functionName: 'symbol'
                }).catch(() => 'UNKNOWN')
            ]);
            
            const sqrtPriceX96 = globalState[0];
            const tick = Number(globalState[1]);
            
            return {
                status: "success",
                data: {
                    poolAddress,
                    token0: {
                        address: token0,
                        symbol: token0Symbol
                    },
                    token1: {
                        address: token1,
                        symbol: token1Symbol
                    },
                    liquidity: (liquidity ?? 0n).toString(),
                    sqrtPriceX96: sqrtPriceX96.toString(),
                    tick,
                    pair: `${token0Symbol}/${token1Symbol}`
                },
                source: this.name
            };
        } catch (error) {
            return {
                status: "error",
                reason: error.message,
                source: this.name
            };
        }
    }
    
    // Fetch liquidity information for pools
    async fetchPoolLiquidity(args) {
        const { poolAddresses } = args;
        
        if (!poolAddresses || !Array.isArray(poolAddresses)) {
            return {
                status: "error",
                reason: "poolAddresses array is required",
                source: this.name
            };
        }
        
        console.log(`🔍 Fetching liquidity for ${poolAddresses.length} pools`);
        
        try {
            const liquidityData = [];
            
            for (const poolAddress of poolAddresses) {
                try {
                    const liquidity = await this.publicClient.readContract({
                        address: poolAddress,
                        abi: ALGEBRA_POOL_ABI,
                        functionName: 'liquidity'
                    });
                    
                    liquidityData.push({
                        poolAddress,
                        liquidity: liquidity.toString(),
                        hasLiquidity: liquidity > 0n
                    });
                } catch (err) {
                    liquidityData.push({
                        poolAddress,
                        liquidity: "0",
                        hasLiquidity: false,
                        error: err.message
                    });
                }
            }
            
            return {
                status: "success",
                data: {
                    pools: liquidityData,
                    totalPools: liquidityData.length,
                    poolsWithLiquidity: liquidityData.filter(p => p.hasLiquidity).length
                },
                source: this.name
            };
        } catch (error) {
            return {
                status: "error",
                reason: error.message,
                source: this.name
            };
        }
    }
    
    // Fetch current prices from pools
    async fetchPoolPrices(args) {
        const { proposalAddress } = args;
        
        if (!proposalAddress) {
            return {
                status: "error",
                reason: "proposalAddress is required",
                source: this.name
            };
        }
        
        console.log(`🔍 Fetching pool prices for proposal ${proposalAddress}`);
        
        try {
            // Get all pools
            const allPools = await this.discoverPools({ proposalAddress });
            if (allPools.status !== 'success') {
                return allPools;
            }
            
            const prices = {};
            const pools = [
                ...allPools.data.conditionalPools,
                ...allPools.data.predictionPools
            ];
            
            for (const pool of pools) {
                if (pool.address) {
                    try {
                        const poolAbi = this.mode === 'uniswap' ? UNISWAP_POOL_ABI : ALGEBRA_POOL_ABI;
                        const stateFn = this.mode === 'uniswap' ? 'slot0' : 'globalState';
                        const state = await this.publicClient.readContract({ address: pool.address, abi: poolAbi, functionName: stateFn });
                        const sqrtPriceX96 = state[0];
                        const tick = state[1];
                        
                        // Get token info to properly calculate price
                        const [token0, token1] = await Promise.all([
                            this.publicClient.readContract({ address: pool.address, abi: poolAbi, functionName: 'token0' }),
                            this.publicClient.readContract({ address: pool.address, abi: poolAbi, functionName: 'token1' })
                        ]);
                        
                        // Get decimals for proper price calculation
                        const [decimals0, decimals1] = await Promise.all([
                            this.publicClient.readContract({
                                address: token0,
                                abi: ERC20_ABI,
                                functionName: 'decimals'
                            }).catch(() => 18),
                            this.publicClient.readContract({
                                address: token1,
                                abi: ERC20_ABI,
                                functionName: 'decimals'
                            }).catch(() => 18)
                        ]);
                        
                        // Calculate prices
                        const price0to1 = this.sqrtPriceX96ToPrice(sqrtPriceX96, decimals0, decimals1);
                        const price1to0 = 1 / price0to1;
                        
                        prices[pool.name] = {
                            poolAddress: pool.address,
                            sqrtPriceX96: sqrtPriceX96.toString(),
                            tick: Number(tick),
                            price: price0to1,
                            priceInverse: price1to0,
                            token0,
                            token1,
                            fee: pool.fee || null
                        };
                    } catch (err) {
                        console.log(`Could not fetch price for ${pool.name}`);
                    }
                }
            }
            
            // Get tokens for reference
            const tokens = allPools.data.tokens;
            
            // Calculate implied probabilities from prediction pools (YES/NO vs collateral)
            const impliedProbability = {};
            
            // Method 1: From conditional pools (YES/NO direct comparison)
            if (prices['YES_COMPANY/NO_COMPANY']) {
                const companyPrice = prices['YES_COMPANY/NO_COMPANY'].price;
                impliedProbability.fromConditionalCompany = {
                    yes: companyPrice / (1 + companyPrice),
                    no: 1 / (1 + companyPrice),
                    method: 'YES_COMPANY/NO_COMPANY ratio'
                };
            }
            
            if (prices['YES_CURRENCY/NO_CURRENCY']) {
                const currencyPrice = prices['YES_CURRENCY/NO_CURRENCY'].price;
                impliedProbability.fromConditionalCurrency = {
                    yes: currencyPrice / (1 + currencyPrice),
                    no: 1 / (1 + currencyPrice),
                    method: 'YES_CURRENCY/NO_CURRENCY ratio'
                };
            }
            
            // Method 2: From prediction pools against BASE_CURRENCY (collateralToken2)
            // Need to check token ordering to get correct price direction
            const yesCurrencyPool = prices['YES_CURRENCY/BASE_CURRENCY'];
            const noCurrencyPool = prices['NO_CURRENCY/BASE_CURRENCY'];
            
            if (yesCurrencyPool && noCurrencyPool) {
                // Determine correct price based on token ordering
                // sqrtPriceX96 gives us token1/token0
                // If conditional is token0 and collateral is token1: price = collateral/conditional (what we want)
                // If conditional is token1 and collateral is token0: price = conditional/collateral (need inverse)
                
                // Check if YES_CURRENCY is token0 or token1
                const yesIsToken0 = yesCurrencyPool.token0.toLowerCase() === tokens.yesCurrency.toLowerCase();
                const yesPrice = yesIsToken0 ? yesCurrencyPool.price : yesCurrencyPool.priceInverse;
                
                // Check if NO_CURRENCY is token0 or token1
                const noIsToken0 = noCurrencyPool.token0.toLowerCase() === tokens.noCurrency.toLowerCase();
                const noPrice = noIsToken0 ? noCurrencyPool.price : noCurrencyPool.priceInverse;
                
                // Now we have correct prices: 1 conditional = X collateral
                const total = yesPrice + noPrice;
                if (total > 0) {
                    impliedProbability.fromPredictionCurrency = {
                        yes: yesPrice,  // Direct price in collateral
                        no: noPrice,    // Direct price in collateral
                        yesNormalized: yesPrice / total,  // Normalized probability
                        noNormalized: noPrice / total,    // Normalized probability
                        yesPrice,
                        noPrice,
                        total,
                        method: 'YES_CURRENCY and NO_CURRENCY prices vs BASE_CURRENCY',
                        collateralToken: tokens.currencyToken
                    };
                }
            }
            
            // Alternative with company pools (checking token ordering)
            const yesCompanyPool = prices['YES_COMPANY/BASE_CURRENCY'];
            const noCompanyPool = prices['NO_COMPANY/BASE_CURRENCY'];
            
            if (yesCompanyPool && noCompanyPool) {
                // Check token ordering for correct price direction
                const yesIsToken0 = yesCompanyPool.token0.toLowerCase() === tokens.yesCompany.toLowerCase();
                const yesPrice = yesIsToken0 ? yesCompanyPool.price : yesCompanyPool.priceInverse;
                
                const noIsToken0 = noCompanyPool.token0.toLowerCase() === tokens.noCompany.toLowerCase();
                const noPrice = noIsToken0 ? noCompanyPool.price : noCompanyPool.priceInverse;
                
                const total = yesPrice + noPrice;
                if (total > 0) {
                    impliedProbability.fromPredictionCompany = {
                        yes: yesPrice,
                        no: noPrice,
                        yesNormalized: yesPrice / total,
                        noNormalized: noPrice / total,
                        yesPrice,
                        noPrice,
                        total,
                        method: 'YES_COMPANY and NO_COMPANY prices vs BASE_CURRENCY',
                        collateralToken: tokens.currencyToken
                    };
                }
            }
            
            return {
                status: "success",
                data: {
                    proposalAddress,
                    prices,
                    impliedProbability,
                    tokens
                },
                source: this.name
            };
        } catch (error) {
            return {
                status: "error",
                reason: error.message,
                source: this.name
            };
        }
    }
    
    // Helper: Get proposal tokens
    async getProposalTokens(proposalAddress) {
        // console.log(`\n📦 Fetching tokens from proposal ${proposalAddress}...`);
        try {
            const proposalAbi = parseAbi([
                'function wrappedOutcome(uint256 index) view returns (address wrapped1155, bytes data)',
                'function collateralToken1() view returns (address)',
                'function collateralToken2() view returns (address)'
            ]);
            
            const [
                [yesCompany],
                [noCompany],
                [yesCurrency],
                [noCurrency],
                companyToken,
                currencyToken
            ] = await Promise.all([
                this.publicClient.readContract({
                    address: proposalAddress,
                    abi: proposalAbi,
                    functionName: 'wrappedOutcome',
                    args: [0]
                }),
                this.publicClient.readContract({
                    address: proposalAddress,
                    abi: proposalAbi,
                    functionName: 'wrappedOutcome',
                    args: [1]
                }),
                this.publicClient.readContract({
                    address: proposalAddress,
                    abi: proposalAbi,
                    functionName: 'wrappedOutcome',
                    args: [2]
                }),
                this.publicClient.readContract({
                    address: proposalAddress,
                    abi: proposalAbi,
                    functionName: 'wrappedOutcome',
                    args: [3]
                }),
                this.publicClient.readContract({
                    address: proposalAddress,
                    abi: proposalAbi,
                    functionName: 'collateralToken1'
                }),
                this.publicClient.readContract({
                    address: proposalAddress,
                    abi: proposalAbi,
                    functionName: 'collateralToken2'
                })
            ]);
            
            // console.log(`  ✓ Tokens fetched:`);
            // console.log(`    YES_COMPANY:  ${yesCompany}`);
            // console.log(`    NO_COMPANY:   ${noCompany}`);
            // console.log(`    YES_CURRENCY: ${yesCurrency}`);
            // console.log(`    NO_CURRENCY:  ${noCurrency}`);
            // console.log(`    COMPANY_TOKEN (collateral1): ${companyToken}`);
            // console.log(`    CURRENCY_TOKEN (collateral2/BASE): ${currencyToken}`);
            
            return {
                yesCompany,
                noCompany,
                yesCurrency,
                noCurrency,
                companyToken,
                currencyToken
            };
        } catch (error) {
            console.error(`Error fetching proposal tokens: ${error.message}`);
            return null;
        }
    }
    
    // Helper: Find pool for a token pair
    async findPool(token0, token1) {
        // console.log(`    Checking pair: ${token0.slice(0,6)}...${token0.slice(-4)} / ${token1.slice(0,6)}...${token1.slice(-4)}`);
        // console.log(`    Factory: ${ALGEBRA_FACTORY}`);
        
        try {
            if (this.mode === 'uniswap') {
                const FACTORY = this.uniswapFactory;
                if (!FACTORY) return null;
                const FEE_TIERS = [500, 3000, 10000];
                for (const FEE of FEE_TIERS) {
                    let poolAddress = await this.publicClient.readContract({ address: FACTORY, abi: UNISWAP_FACTORY_ABI, functionName: 'getPool', args: [token0, token1, FEE] }).catch(() => null);
                    if (!poolAddress || poolAddress === '0x0000000000000000000000000000000000000000') {
                        poolAddress = await this.publicClient.readContract({ address: FACTORY, abi: UNISWAP_FACTORY_ABI, functionName: 'getPool', args: [token1, token0, FEE] }).catch(() => null);
                    }
                    if (poolAddress && poolAddress !== '0x0000000000000000000000000000000000000000') {
                        return { address: poolAddress, factory: FACTORY, token0: token0 < token1 ? token0 : token1, token1: token0 < token1 ? token1 : token0, fee: FEE };
                    }
                }
                return null;
            }

            // Try poolByPair with the exact order (Algebra)
            let poolAddress = await this.publicClient.readContract({ address: ALGEBRA_FACTORY, abi: ALGEBRA_FACTORY_ABI, functionName: 'poolByPair', args: [token0, token1] }).catch(() => null);
            
            // console.log(`      First try (${token0.slice(0,6)}.../${token1.slice(0,6)}...): ${poolAddress || 'null'}`);
            
            // If not found, try the reverse order (poolByPair is order-sensitive)
            if (!poolAddress || poolAddress === '0x0000000000000000000000000000000000000000') {
                poolAddress = await this.publicClient.readContract({
                    address: ALGEBRA_FACTORY,
                    abi: ALGEBRA_FACTORY_ABI,
                    functionName: 'poolByPair',
                    args: [token1, token0]
                }).catch(() => null);
                // console.log(`      Reverse try (${token1.slice(0,6)}.../${token0.slice(0,6)}...): ${poolAddress || 'null'}`);
            }
            
            if (poolAddress && poolAddress !== '0x0000000000000000000000000000000000000000') {
                // console.log(`    ✓ POOL FOUND at ${poolAddress}`);
                return { address: poolAddress, factory: ALGEBRA_FACTORY, token0: token0 < token1 ? token0 : token1, token1: token0 < token1 ? token1 : token0 };
            }
        } catch (err) {
            // console.log(`    Error querying pool: ${err.message}`);
        }
        // console.log(`    ✗ Pool not found for this pair`);
        return null;
    }
    
    // Helper: Find all possible pools (following algebra-cli's 6-pool structure)
    async findAllPools(tokens) {
        const pools = [];
        
        // console.log(`\n🔍 Looking for the 6 standard futarchy pools...`);
        // console.log(`  Using Algebra Factory at: ${ALGEBRA_FACTORY}`);
        
        // The 6 standard futarchy pools according to algebra-cli:
        const pairs = [
            // Pool 1: Price-Correlated Conditional for YES outcomes
            { 
                t0: tokens.yesCompany, 
                t1: tokens.yesCurrency, 
                type: 'conditional', 
                name: 'YES_COMPANY/YES_CURRENCY',
                description: 'Price-correlated conditional tokens pool for YES outcomes'
            },
            // Pool 2: Price-Correlated Conditional for NO outcomes
            { 
                t0: tokens.noCompany, 
                t1: tokens.noCurrency, 
                type: 'conditional', 
                name: 'NO_COMPANY/NO_CURRENCY',
                description: 'Price-correlated conditional tokens pool for NO outcomes'
            },
            // Pool 3: YES Company Expected Value (prediction market)
            { 
                t0: tokens.yesCompany, 
                t1: tokens.currencyToken, // BASE_CURRENCY (e.g., sDAI)
                type: 'prediction', 
                name: 'YES_COMPANY/BASE_CURRENCY',
                description: 'YES company token expected value pool'
            },
            // Pool 4: NO Company Expected Value (prediction market)
            { 
                t0: tokens.noCompany, 
                t1: tokens.currencyToken, // BASE_CURRENCY (e.g., sDAI)
                type: 'prediction', 
                name: 'NO_COMPANY/BASE_CURRENCY',
                description: 'NO company token expected value pool'
            },
            // Pool 5: YES Currency Prediction Market
            { 
                t0: tokens.yesCurrency, 
                t1: tokens.currencyToken, // BASE_CURRENCY (e.g., sDAI)
                type: 'prediction', 
                name: 'YES_CURRENCY/BASE_CURRENCY',
                description: 'Prediction market for YES currency token outcome probability'
            },
            // Pool 6: NO Currency Prediction Market
            { 
                t0: tokens.noCurrency, 
                t1: tokens.currencyToken, // BASE_CURRENCY (e.g., sDAI)
                type: 'prediction', 
                name: 'NO_CURRENCY/BASE_CURRENCY',
                description: 'Prediction market for NO currency token outcome probability'
            }
        ];
        
        for (const [index, pair] of pairs.entries()) {
            const poolNumber = index + 1;
            // console.log(`\n  === Pool ${poolNumber}: ${pair.name} ===`);
            // console.log(`  Token 0: ${pair.t0}`);
            // console.log(`  Token 1: ${pair.t1}`);
            
            const pool = await this.findPool(pair.t0, pair.t1);
            if (pool) {
                pools.push({
                    ...pool,
                    type: pair.type,
                    name: pair.name,
                    description: pair.description,
                    poolNumber
                });
            }
        }
        
        // console.log(`\n📊 Summary: Found ${pools.length} out of 6 standard pools`);
        return pools;
    }
    
    // Helper: Convert sqrtPriceX96 to human-readable price
    sqrtPriceX96ToPrice(sqrtPriceX96, decimals0 = 18, decimals1 = 18) {
        // sqrtPriceX96 = sqrt(price) * 2^96
        // price = (sqrtPriceX96 / 2^96)^2
        const price = (Number(sqrtPriceX96) / (2 ** 96)) ** 2;
        // Adjust for decimal differences
        return price * (10 ** (decimals0 - decimals1));
    }
}

// Factory function for easy instantiation
export function createPoolDiscoveryFetcher(options) {
    return new PoolDiscoveryFetcher(options);
}

export { PoolDiscoveryFetcher };
