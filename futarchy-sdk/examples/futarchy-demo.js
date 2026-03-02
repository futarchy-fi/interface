// futarchy-demo.js - Complete Futarchy SDK Demo

import { createViemExecutor } from '../executors/ViemExecutor.js';
import { FutarchyCartridge } from '../executors/FutarchyCartridge.js';
import { parseEther } from 'viem';

// Contract addresses on Gnosis Chain
const CONTRACTS = {
    SDAI: '0xaf204776c7245bF4147c2612BF6e5972Ee483701',
    FUTARCHY_ROUTER: '0x7495a583ba85875d59407781b4958ED6e0E1228f'
};

/**
 * Complete Futarchy Demo showing all cartridge operations
 */
class CompleteFutarchyDemo {
    constructor() {
        // Create ViemExecutor
        this.executor = createViemExecutor({
            rpcUrl: 'https://rpc.gnosischain.com'
        });
        
        // Create and register FutarchyCartridge
        this.futarchyCartridge = new FutarchyCartridge(CONTRACTS.FUTARCHY_ROUTER);
        this.executor.registerCartridge(this.futarchyCartridge);
        
        console.log('🏛️ Complete Futarchy Demo initialized');
        console.log('📍 Available operations:', this.executor.getAvailableOperations());
    }
    
    /**
     * Step 1: Connect wallet
     */
    async connectWallet() {
        console.log('\n🔗 Step 1: Connecting wallet...');
        
        for await (const status of this.executor.execute('web3.connect')) {
            console.log(`   ${status.status}: ${status.message}`);
            
            if (status.status === 'success') {
                this.account = status.data.account;
                return status.data.account;
            } else if (status.status === 'error') {
                throw new Error(status.error);
            }
        }
    }
    
    /**
     * Step 2: Check collateral approval
     */
    async checkCollateralApproval(collateralToken) {
        console.log('\n🔍 Step 2: Checking collateral approval...');
        
        for await (const status of this.executor.execute('futarchy.checkApproval', {
            collateralToken
        })) {
            console.log(`   ${status.status}: ${status.message}`);
            
            if (status.status === 'success') {
                const { isApproved, allowanceFormatted, balanceFormatted } = status.data;
                console.log(`   📊 Balance: ${balanceFormatted} tokens`);
                console.log(`   📊 Allowance: ${allowanceFormatted} tokens`);
                console.log(`   📊 Approved: ${isApproved ? 'Yes ✅' : 'No ❌'}`);
                return status.data;
            } else if (status.status === 'error') {
                throw new Error(status.error);
            }
        }
    }
    
    /**
     * Step 3: Approve collateral if needed
     */
    async approveCollateralIfNeeded(collateralToken, amount = 'max') {
        console.log('\n✅ Step 3: Approving collateral...');
        
        for await (const status of this.executor.execute('futarchy.approveCollateral', {
            collateralToken,
            amount
        })) {
            console.log(`   ${status.status}: ${status.message}`);
            
            if (status.data?.transactionHash) {
                console.log(`   🔗 TX: ${status.data.transactionHash}`);
            }
            
            if (status.status === 'success') {
                console.log('   🎉 Collateral approved successfully!');
                return status.data;
            } else if (status.status === 'error') {
                throw new Error(status.error);
            }
        }
    }
    
    /**
     * Step 4: Split position into YES/NO tokens
     */
    async splitPosition(proposal, collateralToken, amount) {
        console.log(`\n🔀 Step 4: Splitting ${amount} tokens into YES/NO positions...`);
        
        for await (const status of this.executor.execute('futarchy.splitPosition', {
            proposal,
            collateralToken,
            amount
        })) {
            console.log(`   ${status.status}: ${status.message}`);
            
            if (status.data?.transactionHash) {
                console.log(`   🔗 TX: ${status.data.transactionHash}`);
            }
            
            if (status.status === 'success') {
                console.log('   🎉 Position split successfully!');
                return status.data;
            } else if (status.status === 'error') {
                throw new Error(status.error);
            }
        }
    }
    
    /**
     * Step 5: Merge YES/NO positions back to collateral
     */
    async mergePositions(proposal, collateralToken, amount) {
        console.log(`\n🔀 Step 5: Merging ${amount} YES/NO positions back to collateral...`);
        
        for await (const status of this.executor.execute('futarchy.mergePositions', {
            proposal,
            collateralToken,
            amount
        })) {
            console.log(`   ${status.status}: ${status.message}`);
            
            if (status.data?.transactionHash) {
                console.log(`   🔗 TX: ${status.data.transactionHash}`);
            }
            
            if (status.status === 'success') {
                console.log('   🎉 Positions merged successfully!');
                return status.data;
            } else if (status.status === 'error') {
                throw new Error(status.error);
            }
        }
    }
    
    /**
     * Step 6: Redeem winning positions (after proposal resolution)
     */
    async redeemPositions(proposal, collateralToken, amount) {
        console.log(`\n💰 Step 6: Redeeming ${amount} winning positions...`);
        
        for await (const status of this.executor.execute('futarchy.redeemPositions', {
            proposal,
            collateralToken,
            amount
        })) {
            console.log(`   ${status.status}: ${status.message}`);
            
            if (status.data?.transactionHash) {
                console.log(`   🔗 TX: ${status.data.transactionHash}`);
            }
            
            if (status.status === 'success') {
                console.log('   🎉 Positions redeemed successfully!');
                return status.data;
            } else if (status.status === 'error') {
                throw new Error(status.error);
            }
        }
    }
    
    /**
     * Step 7: Get winning outcomes for a condition
     */
    async getWinningOutcomes(conditionId) {
        console.log(`\n🏆 Step 7: Getting winning outcomes for condition...`);
        
        for await (const status of this.executor.execute('futarchy.getWinningOutcomes', {
            conditionId
        })) {
            console.log(`   ${status.status}: ${status.message}`);
            
            if (status.status === 'success') {
                const { outcomes, winningIndexes } = status.data;
                console.log(`   📊 Outcomes: ${outcomes}`);
                console.log(`   🏆 Winning indexes: ${winningIndexes}`);
                return status.data;
            } else if (status.status === 'error') {
                throw new Error(status.error);
            }
        }
    }
    
    /**
     * Run complete demo flow
     */
    async runCompleteDemo(options = {}) {
        const {
            proposal = '0xDA36a35CA4Fe6214C37a452159C0C9EAd45D5919', // Real proposal example
            collateralToken = CONTRACTS.SDAI,
            amount = '100',
            conditionId = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
        } = options;
        
        try {
            console.log('🏁 Starting Complete Futarchy Demo...');
            console.log('═══════════════════════════════════════════════');
            
            // Step 1: Connect
            const account = await this.connectWallet();
            console.log(`✅ Connected: ${account}`);
            
            // Step 2: Check approval
            const approvalStatus = await this.checkCollateralApproval(collateralToken);
            
            // Step 3: Approve if needed
            if (!approvalStatus.isApproved) {
                await this.approveCollateralIfNeeded(collateralToken);
            } else {
                console.log('\n✅ Collateral already approved, skipping...');
            }
            
            // Step 4: Split position
            const splitResult = await this.splitPosition(proposal, collateralToken, amount);
            
            // Wait a bit for demo purposes
            console.log('\n⏳ Waiting 3 seconds before merge...');
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Step 5: Merge positions (for demo - normally you'd trade them)
            const mergeResult = await this.mergePositions(proposal, collateralToken, amount);
            
            // Step 6: Demo redeem (would be after proposal resolution)
            console.log('\n📝 Note: Redeem operations would be used after proposal resolution');
            console.log('   - redeemPositions: for winning outcome tokens');
            console.log('   - redeemProposal: for proposal tokens');
            
            // Step 7: Get winning outcomes (example)
            if (conditionId && conditionId !== '') {
                try {
                    await this.getWinningOutcomes(conditionId);
                } catch (error) {
                    console.log(`   ℹ️  Note: getWinningOutcomes failed (expected for example condition): ${error.message}`);
                }
            }
            
            console.log('\n🎊 COMPLETE FUTARCHY DEMO FINISHED!');
            console.log('═══════════════════════════════════════════════');
            console.log('📝 Summary:');
            console.log(`   Account: ${account}`);
            console.log(`   Proposal: ${proposal}`);
            console.log(`   Collateral: ${collateralToken}`);
            console.log(`   Amount: ${amount} tokens`);
            console.log(`   Split TX: ${splitResult.transactionHash}`);
            console.log(`   Merge TX: ${mergeResult.transactionHash}`);
            console.log('\n🏛️ All futarchy operations completed successfully!');
            
            return {
                account,
                proposal,
                collateralToken,
                amount,
                splitResult,
                mergeResult
            };
            
        } catch (error) {
            console.error('\n❌ Demo failed:', error.message);
            throw error;
        }
    }
    
    /**
     * Run approval-only demo
     */
    async runApprovalDemo(collateralToken = CONTRACTS.SDAI) {
        try {
            console.log('🏁 Starting Approval Demo...');
            console.log('═══════════════════════════════════');
            
            const account = await this.connectWallet();
            const approvalStatus = await this.checkCollateralApproval(collateralToken);
            
            if (!approvalStatus.isApproved) {
                await this.approveCollateralIfNeeded(collateralToken);
                console.log('\n🎉 Approval demo completed!');
            } else {
                console.log('\n✅ Token already approved!');
            }
            
            return { account, approvalStatus };
            
        } catch (error) {
            console.error('\n❌ Approval demo failed:', error.message);
            throw error;
        }
    }
    
    /**
     * Get executor status for debugging
     */
    getStatus() {
        return this.executor.getStatus();
    }
    
    /**
     * List all available operations
     */
    listOperations() {
        console.log('\n📋 Available Operations:');
        console.log('════════════════════════');
        
        const builtInOps = Object.keys(this.executor.operations);
        const cartridgeOps = Array.from(this.executor.cartridges.keys());
        
        console.log('🔧 Built-in Operations:');
        builtInOps.forEach(op => console.log(`   - ${op}`));
        
        console.log('\n🎯 Futarchy Cartridge Operations:');
        cartridgeOps.forEach(op => console.log(`   - ${op}`));
        
        console.log(`\n📊 Total: ${builtInOps.length + cartridgeOps.length} operations available`);
    }
}

// Export for use in other modules or HTML
export { CompleteFutarchyDemo, CONTRACTS };

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
    const demo = new CompleteFutarchyDemo();
    
    // Parse command line arguments
    const command = process.argv[2] || 'complete';
    const proposal = process.argv[3];
    const amount = process.argv[4] || '100';
    
    console.log('🏛️ Futarchy SDK - Complete Demo');
    console.log('Available commands:');
    console.log('  complete [proposal] [amount] - Run complete demo');
    console.log('  approval - Run approval-only demo');
    console.log('  status - Show executor status');
    console.log('  list - List all available operations');
    console.log('');
    
    switch (command) {
        case 'complete':
            demo.runCompleteDemo({ 
                proposal: proposal || '0x1234567890123456789012345678901234567890',
                amount 
            }).catch(console.error);
            break;
            
        case 'approval':
            demo.runApprovalDemo().catch(console.error);
            break;
            
        case 'status':
            console.log(demo.getStatus());
            break;
            
        case 'list':
            demo.listOperations();
            break;
            
        default:
            console.log(`Unknown command: ${command}`);
            console.log('Use "complete", "approval", "status", or "list"');
    }
} 