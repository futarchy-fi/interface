// ViemExecutor.js - Viem implementation of BaseExecutor

import { BaseExecutor } from './BaseExecutor.js';
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

/**
 * ViemExecutor - Web3 transaction executor using Viem
 * Supports common DeFi operations with real-time status updates
 */
class ViemExecutor extends BaseExecutor {
    constructor(options = {}) {
        super();
        
        this.chain = options.chain || gnosis;
        this.rpcUrl = options.rpcUrl || 'https://rpc.gnosischain.com';
        this.walletClient = options.walletClient || null;
        this.publicClient = options.publicClient || null;
        this.account = options.account || null;
        
        // Cartridge system for extensible operations
        this.cartridges = new Map();
        
        // Initialize clients
        this.initializeClients();
        
        // Register supported operations
        this.registerOperations();
    }
    
    initializeClients() {
        // Public client for reading blockchain data (if not provided)
        if (!this.publicClient) {
            this.publicClient = createPublicClient({
                chain: this.chain,
                transport: http(this.rpcUrl)
            });
        }
        
        console.log(`🌐 ViemExecutor connected to ${this.chain.name}`);
        if (this.account) {
            console.log(`👛 Using account: ${this.account.address || this.account}`);
        }
    }
    
    registerOperations() {
        // Register the operations this executor can handle
        this.registerOperation('web3.approve', this.handleApprove.bind(this));
        this.registerOperation('web3.transfer', this.handleTransfer.bind(this));
        this.registerOperation('web3.connect', this.handleConnect.bind(this));
        this.registerOperation('web3.getBalance', this.handleGetBalance.bind(this));
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
     * @param {string} dataPath - Operation path (e.g., 'web3.approve', 'futarchy.splitPosition')
     * @param {object} args - Operation arguments
     */
    async* execute(dataPath, args = {}) {
        console.log(`🚀 ViemExecutor.execute('${dataPath}') called`);
        
        // Check if it's a cartridge operation
        if (this.cartridges.has(dataPath)) {
            const cartridge = this.cartridges.get(dataPath);
            console.log(`📡 Routing to ${cartridge.name || 'Unknown'} cartridge`);
            
            // Provide viem clients to cartridge
            const viemClients = {
                publicClient: this.publicClient,
                walletClient: this.walletClient,
                account: this.account
            };
            
            yield* cartridge.execute(dataPath, args, viemClients);
            return;
        }
        
        // Check if it's a built-in operation
        if (dataPath in this.operations) {
            console.log(`📡 Routing to built-in operation handler`);
            yield* this.operations[dataPath](args);
            return;
        }
        
        // Operation not found
        yield {
            status: 'error',
            message: `Operation '${dataPath}' not supported`,
            error: `Available operations: ${this.getAvailableOperations().join(', ')}`
        };
    }
    
    /**
     * Get all available operations (built-in + cartridges)
     */
    getAvailableOperations() {
        const builtInOps = Object.keys(this.operations);
        const cartridgeOps = Array.from(this.cartridges.keys());
        return [...builtInOps, ...cartridgeOps];
    }
    
    /**
     * Connect to wallet (MetaMask/injected)
     */
    async* handleConnect(args = {}) {
        yield {
            status: 'pending',
            message: 'Connecting to wallet...',
            step: 'wallet_connection'
        };
        
        try {
            // Check for injected wallet
            if (!window.ethereum) {
                throw new Error('No injected wallet found (MetaMask required)');
            }
            
            // Request account access first
            const accounts = await window.ethereum.request({ 
                method: 'eth_requestAccounts' 
            });
            this.account = accounts[0];
            
            // Create wallet client with injected wallet transport
            this.walletClient = createWalletClient({
                account: this.account,
                chain: this.chain,
                transport: custom(window.ethereum)
            });
            
            yield {
                status: 'success',
                message: `Connected to ${this.account}`,
                step: 'wallet_connected',
                data: { account: this.account }
            };
            
        } catch (error) {
            yield {
                status: 'error',
                message: `Connection failed: ${error.message}`,
                step: 'wallet_connection_failed',
                error: error.message
            };
        }
    }
    
    /**
     * Handle token approval
     * @param {object} args - { tokenAddress, spenderAddress, amount }
     */
    async* handleApprove(args) {
        const { tokenAddress, spenderAddress, amount } = args;
        
        if (!this.account) {
            yield {
                status: 'error',
                message: 'Wallet not connected',
                step: 'approval_failed'
            };
            return;
        }
        
        // ERC20 ABI for approve function
        const erc20Abi = [
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
                name: 'allowance',
                type: 'function',
                stateMutability: 'view',
                inputs: [
                    { name: 'owner', type: 'address' },
                    { name: 'spender', type: 'address' }
                ],
                outputs: [{ name: '', type: 'uint256' }]
            }
        ];
        
        try {
            yield {
                status: 'pending',
                message: 'Preparing approval transaction...',
                step: 'approval_prep'
            };
            
            // Get contract instance
            const contract = getContract({
                address: tokenAddress,
                abi: erc20Abi,
                publicClient: this.publicClient,
                walletClient: this.walletClient
            });
            
            yield {
                status: 'pending',
                message: 'Waiting for user confirmation...',
                step: 'approval_confirmation'
            };
            
            // Execute approval
            const hash = await this.walletClient.writeContract({
                address: tokenAddress,
                abi: erc20Abi,
                functionName: 'approve',
                args: [spenderAddress, amount],
                account: this.account
            });
            
            yield {
                status: 'pending',
                message: 'Transaction submitted, waiting for confirmation...',
                step: 'approval_submitted',
                data: { transactionHash: hash }
            };
            
            // Wait for transaction receipt
            const receipt = await this.publicClient.waitForTransactionReceipt({ 
                hash 
            });
            
            yield {
                status: 'success',
                message: 'Approval successful!',
                step: 'approval_completed',
                data: { 
                    transactionHash: hash,
                    blockNumber: receipt.blockNumber,
                    gasUsed: receipt.gasUsed
                }
            };
            
        } catch (error) {
            yield {
                status: 'error',
                message: `Approval failed: ${error.message}`,
                step: 'approval_failed',
                error: error.message
            };
        }
    }
    
    /**
     * Handle getting token balance
     */
    async* handleGetBalance(args) {
        const { tokenAddress, userAddress } = args;
        const address = userAddress || this.account;
        
        if (!address) {
            yield {
                status: 'error',
                message: 'No address provided and wallet not connected',
                step: 'balance_failed'
            };
            return;
        }
        
        try {
            yield {
                status: 'pending',
                message: 'Fetching balance...',
                step: 'balance_fetch'
            };
            
            let balance;
            
            if (tokenAddress) {
                // ERC20 token balance
                const erc20Abi = [
                    {
                        name: 'balanceOf',
                        type: 'function',
                        stateMutability: 'view',
                        inputs: [{ name: 'account', type: 'address' }],
                        outputs: [{ name: '', type: 'uint256' }]
                    }
                ];
                
                balance = await this.publicClient.readContract({
                    address: tokenAddress,
                    abi: erc20Abi,
                    functionName: 'balanceOf',
                    args: [address]
                });
            } else {
                // Native token balance
                balance = await this.publicClient.getBalance({ 
                    address 
                });
            }
            
            yield {
                status: 'success',
                message: 'Balance retrieved successfully',
                step: 'balance_completed',
                data: { 
                    balance: balance.toString(),
                    formattedBalance: formatEther(balance),
                    address,
                    tokenAddress
                }
            };
            
        } catch (error) {
            yield {
                status: 'error',
                message: `Balance fetch failed: ${error.message}`,
                step: 'balance_failed',
                error: error.message
            };
        }
    }
    
    /**
     * Handle simple transfer (placeholder)
     */
    async* handleTransfer(args) {
        yield {
            status: 'error',
            message: 'Transfer not implemented yet',
            step: 'transfer_not_implemented'
        };
    }
    
    /**
     * Get current executor status
     */
    getStatus() {
        return {
            ...super.getStatus(),
            connected: !!this.account,
            account: this.account,
            chain: this.chain.name,
            rpcUrl: this.rpcUrl,
            cartridges: Array.from(this.cartridges.values()).map(c => c.name || 'Unknown'),
            totalOperations: this.getAvailableOperations().length
        };
    }
}

// Factory function for easy instantiation
export function createViemExecutor(options = {}) {
    return new ViemExecutor(options);
}

export { ViemExecutor }; 