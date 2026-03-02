// fetchers/SdaiRateFetcher.js - sDAI Rate Fetcher Module

import { createPublicClient, http } from 'viem';
import { gnosis } from 'viem/chains';
import { BaseFetcher } from '../DataLayer.js';

// =============================================================================
// SDAI RATE FETCHER - Pluggable Module
// =============================================================================

// sDAI Rate Provider Contract ABI
const SDAI_RATE_PROVIDER_ABI = [
    {
        "inputs": [],
        "name": "getRate",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
];

// Contract Configuration
const SDAI_RATE_PROVIDER_CONTRACT = "0x89C80A4540A00b5270347E02e2E144c71da2EceD";
const GNOSIS_CHAIN_ID = 100;

// RPC Endpoints for Gnosis Chain (with fallback)
const GNOSIS_RPC_ENDPOINTS = [
    'https://rpc.ankr.com/gnosis',
    'https://gnosis-mainnet.public.blastapi.io',
    'https://gnosis.drpc.org',
    'https://gnosis-rpc.publicnode.com',
    'https://1rpc.io/gnosis'
];

// Timing Configuration
const REFRESH_INTERVAL = 60000; // 60 seconds
const TIMEOUT_DURATION = 15000; // 15 seconds
const BASE_RETRY_DELAY = 30000; // 30 seconds
const RANDOM_RETRY_RANGE = 10000; // 1-10 seconds

class SdaiRateFetcher extends BaseFetcher {
    constructor(options = {}) {
        super();
        this.name = 'SdaiRateFetcher';
        
        // Use existing publicClient if provided, otherwise create fallback clients
        this.publicClient = options.publicClient;
        this.contractAddress = options.contractAddress || SDAI_RATE_PROVIDER_CONTRACT;
        this.refreshInterval = options.refreshInterval || REFRESH_INTERVAL;
        this.timeoutDuration = options.timeoutDuration || TIMEOUT_DURATION;
        
        // Fallback RPC endpoints for creating clients if none provided
        this.rpcEndpoints = options.rpcEndpoints || GNOSIS_RPC_ENDPOINTS;
        this.fallbackClients = [];
        
        // State management
        this.currentRpcIndex = 0;
        this.rpcCooldowns = new Map(); // Track cooldown periods for failed RPCs
        this.cachedRate = null;
        this.lastFetchTime = 0;
        this.isLoading = false;
        
        // Register operations this fetcher supports
        this.registerOperation('sdai.rate', this.fetchSdaiRate.bind(this));
        this.registerOperation('sdai.rate.cached', this.getCachedRate.bind(this));
        this.registerOperation('sdai.rate.refresh', this.refreshRate.bind(this));
        
        // Initialize fallback clients if no publicClient provided
        if (!this.publicClient) {
            this.initializeFallbackClients();
        }
        
        console.log(`🔧 ${this.name} initialized with ${this.supportedOperations.length} operations`);
        if (this.publicClient) {
            console.log(`📡 Using provided viem publicClient`);
        } else {
            console.log(`📡 Using ${this.fallbackClients.length} fallback RPC clients`);
        }
    }
    
    /**
     * Initialize fallback viem clients
     */
    initializeFallbackClients() {
        this.fallbackClients = this.rpcEndpoints.map(rpcUrl => {
            return createPublicClient({
                chain: gnosis,
                transport: http(rpcUrl)
            });
        });
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
     * Main method to fetch sDAI rate with caching and fallback
     */
    async fetchSdaiRate(args = {}) {
        const { forceRefresh = false } = args;
        
        // Check if we have a cached rate that's still valid
        if (!forceRefresh && this.isCacheValid()) {
            console.log(`📊 [SDAI CACHED] Returning cached rate: ${this.cachedRate}`);
            return {
                status: "success",
                data: {
                    rate: this.cachedRate,
                    cached: true,
                    fetchTime: this.lastFetchTime,
                    source: this.name
                }
            };
        }
        
        // Prevent multiple simultaneous fetches
        if (this.isLoading) {
            console.log(`⏳ [SDAI LOADING] Rate fetch already in progress`);
            return {
                status: "loading",
                message: "Rate fetch in progress",
                source: this.name
            };
        }
        
        this.isLoading = true;
        
        try {
            const rate = await this.fetchRateFromContract();
            
            // Cache the successful result
            this.cachedRate = rate;
            this.lastFetchTime = Date.now();
            
            console.log(`✅ [SDAI SUCCESS] Fetched fresh rate: ${rate}`);
            
            return {
                status: "success",
                data: {
                    rate: rate,
                    cached: false,
                    fetchTime: this.lastFetchTime,
                    source: this.name
                }
            };
            
        } catch (error) {
            console.error(`❌ [SDAI ERROR] Failed to fetch rate: ${error.message}`);
            
            // Return cached rate if available, even if stale
            if (this.cachedRate !== null) {
                console.log(`🔄 [SDAI FALLBACK] Using stale cached rate: ${this.cachedRate}`);
                return {
                    status: "warning",
                    data: {
                        rate: this.cachedRate,
                        cached: true,
                        stale: true,
                        fetchTime: this.lastFetchTime,
                        source: this.name
                    },
                    message: `Using cached rate due to fetch error: ${error.message}`
                };
            }
            
            return {
                status: "error",
                reason: `Failed to fetch sDAI rate: ${error.message}`,
                source: this.name
            };
            
        } finally {
            this.isLoading = false;
        }
    }
    
    /**
     * Get cached rate without attempting to fetch
     */
    async getCachedRate() {
        if (this.cachedRate === null) {
            return {
                status: "error",
                reason: "No cached rate available",
                source: this.name
            };
        }
        
        return {
            status: "success",
            data: {
                rate: this.cachedRate,
                cached: true,
                stale: !this.isCacheValid(),
                fetchTime: this.lastFetchTime,
                source: this.name
            }
        };
    }
    
    /**
     * Force refresh the rate
     */
    async refreshRate() {
        return await this.fetchSdaiRate({ forceRefresh: true });
    }
    
    /**
     * Core method to fetch rate from contract with client fallback
     */
    async fetchRateFromContract() {
        // Try primary client first if available
        if (this.publicClient) {
            try {
                console.log(`🔄 [SDAI ATTEMPT] Fetching sDAI rate via primary viem client`);
                const rate = await this.fetchFromViemClient(this.publicClient);
                console.log(`✅ [SDAI SUCCESS] Got rate ${rate} from primary client`);
                return rate;
            } catch (error) {
                console.log(`❌ [SDAI ERROR] Primary client failed: ${error.message}`);
                // Continue to fallback clients
            }
        }
        
        // Try fallback clients
        if (this.fallbackClients.length === 0) {
            throw new Error("No viem clients available");
        }
        
        let lastError;
        let attempts = 0;
        const maxAttempts = this.fallbackClients.length;
        
        while (attempts < maxAttempts) {
            const clientIndex = this.getNextAvailableClientIndex();
            
            if (clientIndex === null) {
                throw new Error("All RPC clients are in cooldown");
            }
            
            const client = this.fallbackClients[clientIndex];
            const rpcUrl = this.rpcEndpoints[clientIndex];
            
            attempts++;
            console.log(`🔄 [SDAI ATTEMPT ${attempts}] Fetching sDAI rate via fallback client: ${this.truncateUrl(rpcUrl)}`);
            
            try {
                const rate = await this.fetchFromViemClient(client);
                console.log(`✅ [SDAI SUCCESS] Got rate ${rate} from fallback client: ${this.truncateUrl(rpcUrl)}`);
                return rate;
                
            } catch (error) {
                console.log(`❌ [SDAI ERROR] Attempt ${attempts} failed for client ${this.truncateUrl(rpcUrl)}: ${error.message}`);
                lastError = error;
                
                // Check if this is a rate limit or network error that should trigger rotation
                if (this.shouldRotateRpc(error)) {
                    console.log(`🔄 [SDAI RPC ROTATE] Client failed: ${this.truncateUrl(rpcUrl)}, rotating to next`);
                    this.setCooldownByIndex(clientIndex);
                }
            }
        }
        
        throw new Error(`All RPC clients failed. Last error: ${lastError?.message || 'Unknown error'}`);
    }
    
    /**
     * Fetch rate from a viem client
     */
    async fetchFromViemClient(client) {
        return new Promise(async (resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error(`Request timeout after ${this.timeoutDuration}ms`));
            }, this.timeoutDuration);
            
            try {
                // Call getRate function using viem
                const rateRaw = await client.readContract({
                    address: this.contractAddress,
                    abi: SDAI_RATE_PROVIDER_ABI,
                    functionName: 'getRate'
                });
                
                // Convert from wei to decimal (18 decimals) - viem returns bigint
                const rate = Number(rateRaw) / Math.pow(10, 18);
                
                clearTimeout(timeoutId);
                resolve(rate);
                
            } catch (error) {
                clearTimeout(timeoutId);
                reject(error);
            }
        });
    }
    
    /**
     * Get next available client index (not in cooldown)
     */
    getNextAvailableClientIndex() {
        const now = Date.now();
        
        // Try to find a client not in cooldown
        for (let i = 0; i < this.fallbackClients.length; i++) {
            const clientIndex = (this.currentRpcIndex + i) % this.fallbackClients.length;
            const rpcUrl = this.rpcEndpoints[clientIndex];
            
            const cooldownEnd = this.rpcCooldowns.get(clientIndex) || 0;
            
            if (now >= cooldownEnd) {
                this.currentRpcIndex = (clientIndex + 1) % this.fallbackClients.length;
                return clientIndex;
            } else {
                const remainingCooldown = Math.ceil((cooldownEnd - now) / 1000);
                console.log(`⏳ [SDAI RPC COOLDOWN] Client ${this.truncateUrl(rpcUrl)} in cooldown for ${remainingCooldown}s`);
            }
        }
        
        return null; // All clients are in cooldown
    }
    
    /**
     * Set cooldown for a client by index
     */
    setCooldownByIndex(clientIndex) {
        const cooldownDuration = BASE_RETRY_DELAY + Math.random() * RANDOM_RETRY_RANGE;
        const cooldownEnd = Date.now() + cooldownDuration;
        this.rpcCooldowns.set(clientIndex, cooldownEnd);
        
        const rpcUrl = this.rpcEndpoints[clientIndex];
        console.log(`🕒 [SDAI RPC COOLDOWN] Set cooldown for ${this.truncateUrl(rpcUrl)}: ${Math.ceil(cooldownDuration / 1000)}s`);
    }
    
    /**
     * Check if error should trigger RPC rotation
     */
    shouldRotateRpc(error) {
        const errorMessage = error.message.toLowerCase();
        
        // Rate limit errors
        if (errorMessage.includes('429') || 
            errorMessage.includes('too many requests') ||
            errorMessage.includes('rate limit')) {
            return true;
        }
        
        // Network errors
        if (errorMessage.includes('network') ||
            errorMessage.includes('cors') ||
            errorMessage.includes('fetch') ||
            errorMessage.includes('timeout')) {
            return true;
        }
        
        return false;
    }
    
    /**
     * Check if cached rate is still valid
     */
    isCacheValid() {
        if (this.cachedRate === null || this.lastFetchTime === 0) {
            return false;
        }
        
        const age = Date.now() - this.lastFetchTime;
        return age < this.refreshInterval;
    }
    
    /**
     * Utility method to truncate RPC URLs for logging
     */
    truncateUrl(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname;
        } catch {
            return url.substring(0, 30) + '...';
        }
    }
    
    /**
     * Get fetcher status and configuration
     */
    getStatus() {
        return {
            name: this.name,
            cachedRate: this.cachedRate,
            lastFetchTime: this.lastFetchTime,
            cacheValid: this.isCacheValid(),
            isLoading: this.isLoading,
            currentRpcIndex: this.currentRpcIndex,
            activeCooldowns: Array.from(this.rpcCooldowns.entries()).map(([url, cooldownEnd]) => ({
                url: this.truncateUrl(url),
                cooldownRemaining: Math.max(0, cooldownEnd - Date.now())
            })).filter(item => item.cooldownRemaining > 0),
            supportedOperations: this.supportedOperations
        };
    }
}

// =============================================================================
// EXPORTS
// =============================================================================

export { 
    SdaiRateFetcher, 
    SDAI_RATE_PROVIDER_ABI, 
    SDAI_RATE_PROVIDER_CONTRACT,
    GNOSIS_RPC_ENDPOINTS 
};
