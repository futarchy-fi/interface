// CoWSwapCartridge.js - CoW Protocol Swap Operations Cartridge

import { parseEther, formatEther } from 'viem';

// =============================================================================
// COW PROTOCOL CONSTANTS
// =============================================================================

/**
 * CoW Protocol Vault Relayer address on Gnosis Chain (mainnet)
 */
export const COW_VAULT_RELAYER_ADDRESS = '0xC92E8bdf79f0507f65a392b0ab4667716BFE0110';

// ERC20 ABI for approval checks
export const ERC20_ABI = [
    {
        "name": "approve",
        "type": "function",
        "stateMutability": "nonpayable",
        "inputs": [
            {"name": "spender", "type": "address"},
            {"name": "amount", "type": "uint256"}
        ],
        "outputs": [{"name": "", "type": "bool"}]
    },
    {
        "name": "allowance",
        "type": "function",
        "stateMutability": "view",
        "inputs": [
            {"name": "owner", "type": "address"},
            {"name": "spender", "type": "address"}
        ],
        "outputs": [{"name": "", "type": "uint256"}]
    },
    {
        "name": "balanceOf",
        "type": "function",
        "stateMutability": "view",
        "inputs": [{"name": "account", "type": "address"}],
        "outputs": [{"name": "", "type": "uint256"}]
    }
];

// =============================================================================
// COW SWAP CARTRIDGE CLASS
// =============================================================================

export class CoWSwapCartridge {
    constructor() {
        this.name = 'CoWSwapCartridge';
        this.spenderAddress = COW_VAULT_RELAYER_ADDRESS;
        this.spenderName = 'CoW Protocol Vault Relayer';
        
        // Define operations this cartridge provides
        this.operations = {
            'cowswap.swap': this.swap.bind(this),
            'cowswap.checkApproval': this.checkApproval.bind(this),
            'cowswap.approve': this.approve.bind(this),
            'cowswap.completeSwap': this.completeSwap.bind(this)
        };
        
        console.log(`🐄 ${this.name} initialized with ${Object.keys(this.operations).length} operations`);
        console.log(`📍 CoW Protocol Vault Relayer: ${this.spenderAddress}`);
    }
    
    // Get list of supported operations
    getSupportedOperations() {
        return Object.keys(this.operations);
    }
    
    // Check if an operation is supported
    supports(operation) {
        return operation in this.operations;
    }
    
    // Execute an operation (called by ViemExecutor)
    async* execute(operation, args, viemClients) {
        if (!this.supports(operation)) {
            yield {
                status: 'error',
                message: `Operation '${operation}' not supported by ${this.name}`,
                error: `Supported operations: ${this.getSupportedOperations().join(', ')}`
            };
            return;
        }
        
        try {
            yield* this.operations[operation](args, viemClients);
        } catch (error) {
            yield {
                status: 'error',
                message: `${operation} failed: ${error.message}`,
                error: error.message
            };
        }
    }
    
    // =============================================================================
    // COW SWAP OPERATIONS
    // =============================================================================
    
    /**
     * Check token approval for CoW Protocol Vault Relayer
     */
    async* checkApproval(args, { publicClient, account }) {
        const { tokenAddress } = args;
        
        yield { status: 'pending', message: `Checking ${this.spenderName} approval...`, step: 'check' };
        
        try {
            const allowance = await publicClient.readContract({
                address: tokenAddress,
                abi: ERC20_ABI,
                functionName: 'allowance',
                args: [account, this.spenderAddress]
            });
            
            const balance = await publicClient.readContract({
                address: tokenAddress,
                abi: ERC20_ABI,
                functionName: 'balanceOf',
                args: [account]
            });
            
            yield {
                status: 'success',
                message: 'Approval status checked',
                step: 'complete',
                data: { 
                    allowance: allowance.toString(),
                    allowanceFormatted: formatEther(allowance),
                    balance: balance.toString(),
                    balanceFormatted: formatEther(balance),
                    isApproved: allowance > 0n,
                    tokenAddress,
                    spender: this.spenderAddress,
                    spenderName: this.spenderName
                }
            };
        } catch (error) {
            yield {
                status: 'error',
                message: `Failed to check approval: ${error.message}`,
                error: error.message
            };
        }
    }
    
    /**
     * Approve token for CoW Protocol Vault Relayer
     */
    async* approve(args, { publicClient, walletClient, account }) {
        const { tokenAddress, amount } = args;
        
        yield { status: 'pending', message: `Preparing ${this.spenderName} approval...`, step: 'prepare' };
        
        const amountWei = (amount === 'max' || amount === 'unlimited') ? 
            2n ** 256n - 1n : // Max uint256 for unlimited approval
            (typeof amount === 'string' ? parseEther(amount) : amount);
        
        yield { 
            status: 'pending', 
            message: `Approving ${(amount === 'max' || amount === 'unlimited') ? 'unlimited' : formatEther(amountWei)} tokens for ${this.spenderName}...`,
            step: 'approve'
        };
        
        const hash = await walletClient.writeContract({
            address: tokenAddress,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [this.spenderAddress, amountWei],
            account
        });
        
        yield {
            status: 'pending',
            message: 'Approval transaction submitted, waiting for confirmation...',
            step: 'confirm',
            data: { transactionHash: hash }
        };
        
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        
        yield {
            status: 'success',
            message: `Token approved for ${this.spenderName} successfully!`,
            step: 'complete',
            data: { 
                transactionHash: hash,
                receipt,
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed,
                approvedAmount: amountWei.toString(),
                approvedAmountFormatted: (amount === 'max' || amount === 'unlimited') ? 'unlimited' : formatEther(amountWei),
                spender: this.spenderAddress,
                spenderName: this.spenderName
            }
        };
    }
    
    /**
     * Execute a CoW Protocol swap
     */
    async* swap(args, { publicClient, walletClient, account }) {
        const { sellToken, buyToken, amount } = args;
        
        yield { status: 'pending', message: 'Preparing CoW Protocol swap...', step: 'prepare' };
        
        try {
            const chainId = await publicClient.getChainId();
            
            if (chainId !== 100) {
                throw new Error(`CoW Protocol only supported on Gnosis Chain (chainId: 100), current chain: ${chainId}`);
            }
            
            const amountWei = typeof amount === 'string' ? parseEther(amount) : amount;
            const userAddress = account;
            
            yield { 
                status: 'pending', 
                message: `Swapping ${formatEther(amountWei)} tokens via CoW Protocol...`,
                step: 'quote'
            };
            
            // Prepare quote parameters  
            const quoteParams = {
                kind: 'sell',
                sellToken: sellToken,
                buyToken: buyToken,
                sellAmountBeforeFee: amountWei.toString(),
                userAddress: userAddress,
                validTo: Math.floor(Date.now() / 1000) + 3600, // Valid for 1 hour
                receiver: userAddress,
                partiallyFillable: false,
                sellTokenBalance: 'erc20',
                buyTokenBalance: 'erc20',
                signingScheme: 'eip712',
                onchainOrder: false,
                priceQuality: 'verified',
                from: userAddress,
                appData: JSON.stringify({
                    appCode: 'Futarchy',
                    environment: 'production',
                    metadata: {}
                })
            };
            
            console.log('[CoW Swap Debug] Quote Params:', quoteParams);
            
            // Get quote from CoW API
            const quoteApiUrl = `https://api.cow.fi/xdai/api/v1/quote`;
            const fetchResponse = await fetch(quoteApiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(quoteParams)
            });
            
            if (!fetchResponse.ok) {
                const errorText = await fetchResponse.text();
                throw new Error(`CoW API error: ${fetchResponse.status} ${errorText.substring(0, 100)}`);
            }
            
            const quoteResponseData = await fetchResponse.json();
            const quote = quoteResponseData.quote;
            
            console.log('[CoW Debug] Full quote response:', quoteResponseData);
            console.log('[CoW Debug] Quote object:', quote);
            
            if (!quote || !quote.sellAmount || !quote.buyAmount) {
                throw new Error('Received invalid quote from CoW Protocol API');
            }
            
            yield {
                status: 'pending',
                message: `Quote received: ${formatEther(quote.sellAmount)} → ${formatEther(quote.buyAmount)}`,
                step: 'sign',
                data: { quote }
            };
            
            // Construct the order
            const order = {
                kind: 'sell', // Will be updated to OrderKind.SELL when SDK is available
                partiallyFillable: false,
                sellToken: quote.sellToken,
                buyToken: quote.buyToken,
                receiver: quote.receiver,
                sellAmount: amountWei.toString(),
                buyAmount: quote.buyAmount,
                validTo: quote.validTo,
                appData: quote.appData,
                feeAmount: "0" // Force to 0 as per previous findings
            };
            
            yield {
                status: 'pending',
                message: 'Signing order with wallet...',
                step: 'signing',
                data: { order }
            };
            
            // CoW Protocol integration using correct SDK APIs
            try {
                console.log('[CoW Debug] Importing CoW SDK components...');
                
                // Import the actual available components
                const { OrderBookApi, OrderKind, OrderSigningUtils } = await import('@cowprotocol/cow-sdk');
                
                console.log('[CoW Debug] OrderBookApi:', !!OrderBookApi);
                console.log('[CoW Debug] OrderKind:', OrderKind);
                console.log('[CoW Debug] OrderSigningUtils:', !!OrderSigningUtils);
                
                // Create OrderBook API instance for Gnosis Chain
                const orderBookApi = new OrderBookApi({
                    chainId: 100,
                    env: 'prod'
                });
                
                // Construct the order object using the new SDK format
                const order = {
                    kind: OrderKind.SELL, // Use the actual OrderKind enum
                    partiallyFillable: false,
                    sellToken: quote.sellToken,
                    buyToken: quote.buyToken,
                    receiver: quote.receiver,
                    sellAmount: amountWei.toString(),
                    buyAmount: quote.buyAmount,
                    validTo: quote.validTo,
                    appData: '0x0000000000000000000000000000000000000000000000000000000000000000', // Use zero bytes32 (like swap-cli)
                    feeAmount: "0", // Force fee to 0
                    sellTokenBalance: 'erc20',
                    buyTokenBalance: 'erc20'
                };
                
                console.log('[CoW Debug] Original quote.appData:', quote.appData);
                console.log('[CoW Debug] Using zero appData for EIP-712 compatibility');
                
                console.log('[CoW Debug] Order object BEFORE signing:', order);
                
                yield {
                    status: 'pending',
                    message: 'Signing CoW order with MetaMask...',
                    step: 'signing',
                    data: { order }
                };
                
                // Sign the order using OrderSigningUtils and viem
                let signature;
                try {
                    // Create the signing hash and domain
                    const domain = {
                        name: 'Gnosis Protocol',
                        version: 'v2',
                        chainId: 100,
                        verifyingContract: '0x9008D19f58AAbD9eD0D60971565AA8510560ab41'
                    };
                    
                    // Use viem's EIP-712 signing
                    signature = await walletClient.signTypedData({
                        account,
                        domain,
                        types: {
                            Order: [
                                { name: 'sellToken', type: 'address' },
                                { name: 'buyToken', type: 'address' },
                                { name: 'receiver', type: 'address' },
                                { name: 'sellAmount', type: 'uint256' },
                                { name: 'buyAmount', type: 'uint256' },
                                { name: 'validTo', type: 'uint32' },
                                { name: 'appData', type: 'bytes32' },
                                { name: 'feeAmount', type: 'uint256' },
                                { name: 'kind', type: 'string' },
                                { name: 'partiallyFillable', type: 'bool' },
                                { name: 'sellTokenBalance', type: 'string' },
                                { name: 'buyTokenBalance', type: 'string' }
                            ]
                        },
                        primaryType: 'Order',
                        message: {
                            ...order,
                            kind: 'sell' // Convert enum to string for signing
                        }
                    });
                    
                    console.log('[CoW Debug] Order signed successfully:', signature);
                } catch (signError) {
                    console.error('[CoW Debug] Signing failed:', signError);
                    throw signError;
                }
                
                const orderToSend = {
                    ...order,
                    signature,
                    signingScheme: 'eip712',
                    from: account
                };
                
                console.log('[CoW Debug] Order object BEFORE sending:', orderToSend);
                
                yield {
                    status: 'pending',
                    message: 'Order signed! Submitting to CoW Protocol...',
                    step: 'submit',
                    data: { signature }
                };
                
                // Submit using OrderBookApi
                let orderId;
                try {
                    orderId = await orderBookApi.sendOrder(orderToSend);
                    console.log('[CoW Debug] Order submitted successfully:', orderId);
                } catch (sendError) {
                    console.error('[CoW Debug] Sending failed:', sendError);
                    throw sendError;
                }
                
                // Generate CoW Explorer link
                const cowExplorerLink = `https://explorer.cow.fi/orders/${orderId}?tab=overview`;
                
                yield {
                    status: 'success',
                    message: 'CoW Protocol swap order submitted successfully!',
                    step: 'complete',
                    data: { 
                        orderId,
                        quote,
                        order: orderToSend,
                        sellTokenFormatted: formatEther(amountWei),
                        buyTokenEstimated: formatEther(quote.buyAmount),
                        cowExplorerLink,
                        transactionHash: orderId
                    }
                };
                
            } catch (signingError) {
                console.error('CoW Protocol execution failed:', signingError);
                
                // Check if it's a user rejection
                if (signingError.message?.includes('User rejected') || signingError.code === 4001) {
                    yield {
                        status: 'error',
                        message: 'User rejected the order signing',
                        error: 'User cancelled the transaction'
                    };
                    return;
                }
                
                // Re-throw other errors
                throw signingError;
            }
            
        } catch (error) {
            yield {
                status: 'error',
                message: `CoW Protocol swap failed: ${error.message}`,
                error: error.message
            };
        }
    }
    
    /**
     * Complete Swap Operation: Check approval → Approve if needed → Swap
     */
    async* completeSwap(args, { publicClient, walletClient, account }) {
        const { sellToken, buyToken, amount } = args;
        
        yield { 
            status: 'pending', 
            message: '🚀 Starting complete CoW swap operation...', 
            step: 'start' 
        };

        try {
            // Step 1: Check approval
            yield { 
                status: 'pending', 
                message: '🔍 Checking token approval...', 
                step: 'check_approval' 
            };
            
            let isApproved = false;
            for await (const status of this.checkApproval({ tokenAddress: sellToken }, { publicClient, walletClient, account })) {
                if (status.status === 'success') {
                    isApproved = status.data.isApproved;
                    yield {
                        status: 'pending',
                        message: `📊 Approval status: ${isApproved ? 'Already approved' : 'Not approved'}`,
                        step: 'approval_checked',
                        data: status.data
                    };
                    break;
                } else if (status.status === 'error') {
                    throw new Error(`Approval check failed: ${status.error}`);
                }
            }

            // Step 2: Approve if needed
            if (!isApproved) {
                yield { 
                    status: 'pending', 
                    message: '⏳ Approving token for CoW Protocol (unlimited)...', 
                    step: 'approving' 
                };
                
                for await (const status of this.approve({ tokenAddress: sellToken, amount: 'unlimited' }, { publicClient, walletClient, account })) {
                    yield {
                        status: 'pending',
                        message: `${status.message}`,
                        step: `approve_${status.step}`,
                        data: status.data
                    };
                    
                    if (status.status === 'success') {
                        yield {
                            status: 'pending',
                            message: '✅ Token approved for CoW Protocol successfully!',
                            step: 'approved'
                        };
                        break;
                    } else if (status.status === 'error') {
                        throw new Error(`Approval failed: ${status.error}`);
                    }
                }
            } else {
                yield { 
                    status: 'pending', 
                    message: '✅ Token already approved - skipping approval step', 
                    step: 'already_approved' 
                };
            }

            // Step 3: Execute swap
            yield { 
                status: 'pending', 
                message: '🐄 Executing CoW Protocol swap...', 
                step: 'swapping' 
            };
            
            for await (const status of this.swap({ sellToken, buyToken, amount }, { publicClient, walletClient, account })) {
                yield {
                    status: status.status,
                    message: `${status.message}`,
                    step: `swap_${status.step}`,
                    data: status.data
                };
                
                if (status.status === 'success') {
                    yield {
                        status: 'success',
                        message: '🎉 Complete CoW swap operation successful!',
                        step: 'complete',
                        data: status.data
                    };
                    return;
                } else if (status.status === 'error') {
                    throw new Error(`Swap failed: ${status.error}`);
                }
            }

        } catch (error) {
            yield {
                status: 'error',
                message: `Complete CoW swap failed: ${error.message}`,
                error: error.message
            };
        }
    }
}

// =============================================================================
// EXPORTS
// =============================================================================

export { CoWSwapCartridge as default }; 