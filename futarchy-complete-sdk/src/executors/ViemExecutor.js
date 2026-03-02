// ViemExecutor.js - Viem implementation of BaseExecutor

import { BaseExecutor } from '../core/BaseExecutor.js';
import {
    createWalletClient,
    createPublicClient,
    http,
    custom,
    parseEther,
    formatEther,
    getContract
} from 'viem';
import { gnosis } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

/**
 * ViemExecutor - Web3 transaction executor using Viem
 * Supports common DeFi operations and Cartridge loading
 */
export class ViemExecutor extends BaseExecutor {
    constructor(options = {}) {
        super();

        this.chain = options.chain || gnosis;
        // Default RPC if none provided.
        // NOTE: In production/CLI, we should probably pull from ENV here or options.
        this.rpcUrl = options.rpcUrl || process.env.RPC_URL || 'https://rpc.gnosischain.com';

        this.walletClient = options.walletClient || null;
        this.publicClient = options.publicClient || null;
        this.account = options.account || null;

        // Cartridge system for extensible operations
        this.cartridges = new Map();

        // Initialize clients
        this.initializeClients();

        // If private key is provided in env and we don't have a wallet client, setup account
        // This is useful for CLI usage
        if (!this.walletClient && process.env.PRIVATE_KEY) {
            this.setupPrivateKeyWallet();
        }
    }

    setupPrivateKeyWallet() {
        try {
            const privateKey = process.env.PRIVATE_KEY;
            if (!privateKey) return;

            const account = privateKeyToAccount(privateKey);
            this.account = account;
            this.walletClient = createWalletClient({
                account,
                chain: this.chain,
                transport: http(this.rpcUrl)
            });
            console.log(`🔑 Wallet initialized from Private Key: ${account.address}`);
        } catch (error) {
            console.warn(`⚠️ Could not initialize wallet from PRIVATE_KEY: ${error.message}`);
        }
    }

    initializeClients() {
        // Public client for reading blockchain data (if not provided)
        if (!this.publicClient) {
            this.publicClient = createPublicClient({
                chain: this.chain,
                transport: http(this.rpcUrl)
            });
        }

        console.log(`🌐 ViemExecutor connected to ${this.chain.name} (${this.rpcUrl})`);
    }

    /**
     * Register a cartridge for additional operations
     * @param {object} cartridge - Cartridge instance with operations
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
     * Main execute method - routes to built-in operations or cartridges
     */
    async* execute(dataPath, args = {}) {
        // console.log(`🚀 ViemExecutor.execute('${dataPath}') called`);

        // Check if it's a cartridge operation
        if (this.cartridges.has(dataPath)) {
            const cartridge = this.cartridges.get(dataPath);

            // Provide viem clients to cartridge
            const viemClients = {
                publicClient: this.publicClient,
                walletClient: this.walletClient,
                account: this.account
            };

            yield* cartridge.execute(dataPath, args, viemClients);
            return;
        }

        // Operation not found
        yield {
            status: 'error',
            message: `Operation '${dataPath}' not supported`,
            error: `Available operations: ${this.getAvailableOperations().join(', ')}`
        };
    }

    getAvailableOperations() {
        const cartridgeOps = Array.from(this.cartridges.keys());
        return [...this.supportedOperations, ...cartridgeOps];
    }
}
