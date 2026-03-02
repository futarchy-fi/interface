// sdai-approval.js - Simple SDAI approval example for Futarchy

import { createViemExecutor } from '../executors/ViemExecutor.js';
import { parseEther } from 'viem';

// Contract addresses on Gnosis Chain
const CONTRACTS = {
    SDAI: '0xaf204776c7245bF4147c2612BF6e5972Ee483701', // sDAI on Gnosis
    FUTARCHY_ROUTER: '0x7495a583ba85875d59407781b4958ED6e0E1228f' // Your futarchy contract
};

/**
 * Simple SDAI Approval Example
 * Shows the modular executor pattern in action
 */
class SDAIApprovalExample {
    constructor() {
        this.executor = createViemExecutor({
            // Using Gnosis chain by default
            rpcUrl: 'https://rpc.gnosischain.com'
        });
        
        console.log('🚀 SDAI Approval Example initialized');
        console.log('📍 Contracts:');
        console.log(`   sDAI: ${CONTRACTS.SDAI}`);
        console.log(`   Futarchy Router: ${CONTRACTS.FUTARCHY_ROUTER}`);
    }
    
    /**
     * Step 1: Connect wallet
     */
    async connectWallet() {
        console.log('\n🔗 Step 1: Connecting wallet...');
        
        for await (const status of this.executor.execute('web3.connect')) {
            console.log(`   ${status.status}: ${status.message}`);
            
            if (status.status === 'success') {
                return status.data.account;
            } else if (status.status === 'error') {
                throw new Error(status.error);
            }
        }
    }
    
    /**
     * Step 2: Check current sDAI balance
     */
    async checkBalance(userAddress) {
        console.log('\n💰 Step 2: Checking sDAI balance...');
        
        for await (const status of this.executor.execute('web3.getBalance', {
            tokenAddress: CONTRACTS.SDAI,
            userAddress
        })) {
            console.log(`   ${status.status}: ${status.message}`);
            
            if (status.status === 'success') {
                const balance = status.data.formattedBalance;
                console.log(`   📊 Your sDAI balance: ${balance} sDAI`);
                return status.data.balance;
            } else if (status.status === 'error') {
                throw new Error(status.error);
            }
        }
    }
    
    /**
     * Step 3: Approve sDAI for Futarchy Router
     */
    async approveSDAI(amount = '1000') {
        console.log(`\n✅ Step 3: Approving ${amount} sDAI for Futarchy Router...`);
        
        const approvalAmount = parseEther(amount);
        
        for await (const status of this.executor.execute('web3.approve', {
            tokenAddress: CONTRACTS.SDAI,
            spenderAddress: CONTRACTS.FUTARCHY_ROUTER,
            amount: approvalAmount
        })) {
            console.log(`   ${status.status}: ${status.message}`);
            
            if (status.data?.transactionHash) {
                console.log(`   🔗 TX: ${status.data.transactionHash}`);
            }
            
            if (status.status === 'success') {
                console.log('   🎉 Approval completed successfully!');
                return status.data;
            } else if (status.status === 'error') {
                throw new Error(status.error);
            }
        }
    }
    
    /**
     * Run the complete example
     */
    async run(approvalAmount = '1000') {
        try {
            console.log('🏁 Starting SDAI Approval Example...');
            console.log('═══════════════════════════════════════════');
            
            // Step 1: Connect
            const account = await this.connectWallet();
            console.log(`✅ Connected: ${account}`);
            
            // Step 2: Check balance
            const balance = await this.checkBalance(account);
            
            // Step 3: Approve
            const result = await this.approveSDAI(approvalAmount);
            
            console.log('\n🎊 EXAMPLE COMPLETED SUCCESSFULLY!');
            console.log('═══════════════════════════════════════════');
            console.log(`📝 Summary:`);
            console.log(`   Account: ${account}`);
            console.log(`   Approved: ${approvalAmount} sDAI`);
            console.log(`   For: Futarchy Router`);
            console.log(`   TX Hash: ${result.transactionHash}`);
            
            return result;
            
        } catch (error) {
            console.error('\n❌ Example failed:', error.message);
            throw error;
        }
    }
    
    /**
     * Get executor status for debugging
     */
    getStatus() {
        return this.executor.getStatus();
    }
}

// Export for use in HTML or other modules
export { SDAIApprovalExample, CONTRACTS };

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
    const example = new SDAIApprovalExample();
    
    // Get approval amount from command line or use default
    const amount = process.argv[2] || '1000';
    
    example.run(amount).catch(console.error);
} 