// WagmiExecutor.js - Uses existing wagmi providers with DataLayer

import { BaseExecutor } from './BaseExecutor.js';
import { 
    getAccount, 
    getPublicClient, 
    getWalletClient
} from '@wagmi/core';

/**
 * WagmiExecutor - Uses existing wagmi providers to work with DataLayer
 * No new connections - just uses what's already there
 */
class WagmiExecutor extends BaseExecutor {
    constructor(config = null) {
        super();
        
        // Store wagmi config if provided (can be any wagmi config object)
        this.wagmiConfig = config;
        
        // Just track cartridges, let wagmi handle everything else
        this.cartridges = new Map();
        
        // No operations of our own - we just route to cartridges
        console.log(`🔗 WagmiExecutor initialized - using existing wagmi providers`);
    }
    
    /**
     * Register a cartridge for operations
     */
    registerCartridge(cartridge) {
        if (!cartridge.getSupportedOperations) {
            throw new Error('Cartridge must implement getSupportedOperations() method');
        }
        
        console.log(`🎯 Registering ${cartridge.name || 'Unknown'} cartridge`);
        
        const operations = cartridge.getSupportedOperations();
        operations.forEach(operation => {
            this.cartridges.set(operation, cartridge);
            this.supportedOperations.push(operation);
        });
        
        console.log(`✅ Added ${operations.length} operations: ${operations.join(', ')}`);
        return this;
    }
    
    /**
     * Execute operation - get fresh wagmi clients and pass to cartridge
     */
    async* execute(dataPath, args = {}) {
        console.log(`🚀 WagmiExecutor.execute('${dataPath}') called`);
        
        // Check if we have this operation
        if (!this.cartridges.has(dataPath)) {
            yield {
                status: 'error',
                message: `Operation '${dataPath}' not supported`,
                error: `Available operations: ${Array.from(this.cartridges.keys()).join(', ')}`
            };
            return;
        }
        
        try {
            // Get fresh wagmi state with config if available
            const account = this.wagmiConfig ? getAccount(this.wagmiConfig) : getAccount();
            const publicClient = this.wagmiConfig ? getPublicClient(this.wagmiConfig) : getPublicClient();
            
            console.log('🔍 WagmiExecutor - Account state:', { 
                isConnected: account.isConnected, 
                address: account.address,
                chainId: account.chainId 
            });
            
            if (!account.isConnected) {
                yield {
                    status: 'error',
                    message: 'Wallet not connected via wagmi',
                    step: 'connection_check'
                };
                return;
            }
            
            // Get wallet client - this might be async
            let walletClient;
            try {
                walletClient = this.wagmiConfig ? 
                    await getWalletClient(this.wagmiConfig) : 
                    await getWalletClient();
                    
                console.log('🔍 WagmiExecutor - Wallet client obtained:', !!walletClient);
                
                if (!walletClient) {
                    yield {
                        status: 'error',
                        message: 'Could not get wallet client from wagmi',
                        step: 'wallet_client_error'
                    };
                    return;
                }
            } catch (walletError) {
                console.error('🔍 WagmiExecutor - Wallet client error:', walletError);
                yield {
                    status: 'error',
                    message: `Wallet client error: ${walletError.message}`,
                    step: 'wallet_client_error'
                };
                return;
            }
            
            // Get the cartridge
            const cartridge = this.cartridges.get(dataPath);
            console.log(`📡 Routing to ${cartridge.name || 'Unknown'} cartridge`);
            
            // Pass wagmi clients to cartridge (same interface as ViemExecutor)
            const viemClients = {
                publicClient: publicClient,
                walletClient: walletClient,
                account: account.address
            };
            
            yield* cartridge.execute(dataPath, args, viemClients);
            
        } catch (error) {
            yield {
                status: 'error',
                message: `Failed to execute ${dataPath}: ${error.message}`,
                error: error.message
            };
        }
    }
    
    /**
     * Check if operation is supported
     */
    supports(dataPath) {
        return this.cartridges.has(dataPath);
    }
    
    /**
     * Get all available operations
     */
    getAvailableOperations() {
        return Array.from(this.cartridges.keys());
    }
    
    /**
     * Get status
     */
    getStatus() {
        const account = this.wagmiConfig ? getAccount(this.wagmiConfig) : getAccount();
        return {
            ...super.getStatus(),
            connected: account.isConnected,
            account: account.address,
            chainId: account.chainId,
            cartridges: Array.from(this.cartridges.values()).map(c => c.name || 'Unknown'),
            totalOperations: this.getAvailableOperations().length,
            type: 'WagmiExecutor'
        };
    }
}

// Factory function
export function createWagmiExecutor(config) {
    return new WagmiExecutor(config);
}

export { WagmiExecutor }; 