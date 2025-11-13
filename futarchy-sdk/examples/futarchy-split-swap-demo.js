// futarchy-split-swap-demo.js - Demo of Complete Futarchy Split + Swap Operation
//
// This example demonstrates how to:
// 1. Check your current YES SDAI balance 
// 2. Check your SDAI balance
// 3. Split the required amount to reach your target
// 4. Swap the target amount of YES SDAI for YES GNO

import { DataLayer } from '../DataLayer.js';

// =============================================================================
// DEMO CONFIGURATION
// =============================================================================

const DEMO_CONFIG = {
    // Proposal and collateral
    proposal: '0xDA36a35CA4Fe6214C37a452159C0C9EAd45D5919',
    collateralToken: '0xaf204776c7245bF4147c2612BF6e5972Ee483701', // SDAI
    
    // Token addresses (you need to configure these for your specific proposal)
    yesSdaiToken: '0x...', // YES SDAI token address - CONFIGURE THIS
    yesGnoToken: '0x...', // YES GNO token address - CONFIGURE THIS
    
    // Trading parameters
    targetAmount: '2.0', // Want to trade 2 YES SDAI
    slippageBps: '100'   // 1% slippage tolerance
};

// =============================================================================
// FUTARCHY SPLIT + SWAP DEMO CLASS
// =============================================================================

class FutarchySplitSwapDemo {
    constructor() {
        this.dataLayer = new DataLayer();
    }
    
    /**
     * Example scenario: User wants to trade 2 YES SDAI for YES GNO
     * They currently have 0.5 YES SDAI and 90 SDAI
     * System will split 1.5 SDAI to get to 2 YES SDAI, then swap to YES GNO
     */
    async demonstrateOperation() {
        console.log('🎯 Futarchy Split + Swap Demo');
        console.log('=====================================');
        console.log(`Target amount: ${DEMO_CONFIG.targetAmount} YES SDAI`);
        console.log(`Proposal: ${DEMO_CONFIG.proposal}`);
        console.log(`YES SDAI: ${DEMO_CONFIG.yesSdaiToken}`);
        console.log(`YES GNO: ${DEMO_CONFIG.yesGnoToken}`);
        console.log('');
        
        try {
            // Execute the complete split + swap operation
            for await (const status of this.dataLayer.execute('futarchy.completeSplitSwap', DEMO_CONFIG)) {
                this.logStatus(status);
                
                if (status.status === 'success') {
                    console.log('\n🎉 Operation completed successfully!');
                    if (status.data?.transactionHash) {
                        console.log(`📄 Transaction: https://gnosisscan.io/tx/${status.data.transactionHash}`);
                    }
                    break;
                } else if (status.status === 'error') {
                    console.error('\n❌ Operation failed:', status.error);
                    break;
                }
            }
            
        } catch (error) {
            console.error('💥 Demo failed:', error.message);
        }
    }
    
    /**
     * Step-by-step breakdown of what the operation does
     */
    explainOperation() {
        console.log('\n📚 How FutarchySplitSwap Works:');
        console.log('===============================');
        console.log('');
        console.log('1. 🔍 Check Current Balances:');
        console.log('   - Check your YES SDAI balance (e.g., 0.5)');
        console.log('   - Check your SDAI balance (e.g., 90)');
        console.log('');
        console.log('2. 🧮 Calculate Split Amount:');
        console.log('   - Target: 2 YES SDAI');
        console.log('   - Current: 0.5 YES SDAI');
        console.log('   - Need to split: 2 - 0.5 = 1.5 SDAI');
        console.log('');
        console.log('3. ✅ Approve SDAI (if needed):');
        console.log('   - Allow Futarchy Router to spend SDAI');
        console.log('');
        console.log('4. 🔀 Split Position:');
        console.log('   - Split 1.5 SDAI → 1.5 YES + 1.5 NO tokens');
        console.log('   - Now have: 0.5 + 1.5 = 2 YES SDAI');
        console.log('');
        console.log('5. ✅ Approve YES SDAI (if needed):');
        console.log('   - Allow Swapr Router to spend YES SDAI');
        console.log('');
        console.log('6. 🔄 Execute Swap:');
        console.log('   - Swap 2 YES SDAI → YES GNO');
        console.log('   - Using Swapr V3 with 1% slippage');
        console.log('');
    }
    
    /**
     * Format and display operation status
     */
    logStatus(status) {
        const icons = {
            pending: '⏳',
            success: '✅',
            error: '❌'
        };
        
        const icon = icons[status.status] || '📝';
        console.log(`${icon} ${status.status.toUpperCase()}: ${status.message}`);
        
        if (status.step && status.step !== 'start') {
            console.log(`   📍 Step: ${status.step}`);
        }
    }
}

// =============================================================================
// USAGE EXAMPLES
// =============================================================================

/**
 * Run the demo
 */
async function runDemo() {
    const demo = new FutarchySplitSwapDemo();
    
    // Show explanation first
    demo.explainOperation();
    
    // Then run the actual operation (uncomment when ready)
    // await demo.demonstrateOperation();
}

/**
 * Example of using the operation directly
 */
async function directUsageExample() {
    console.log('\n💻 Direct Usage Example:');
    console.log('========================');
    console.log('');
    console.log('import { DataLayer } from "./DataLayer.js";');
    console.log('');
    console.log('const dataLayer = new DataLayer();');
    console.log('');
    console.log('// Execute split + swap operation');
    console.log('for await (const status of dataLayer.execute("futarchy.completeSplitSwap", {');
    console.log('    proposal: "0xDA36a35CA4Fe6214C37a452159C0C9EAd45D5919",');
    console.log('    collateralToken: "0xaf204776c7245bF4147c2612BF6e5972Ee483701",');
    console.log('    yesSdaiToken: "0x...", // Configure your YES SDAI token');
    console.log('    yesGnoToken: "0x...",  // Configure your YES GNO token');
    console.log('    targetAmount: "2.0",');
    console.log('    slippageBps: "100"');
    console.log('})) {');
    console.log('    console.log(`${status.status}: ${status.message}`);');
    console.log('    if (status.status === "success") break;');
    console.log('}');
    console.log('');
}

// =============================================================================
// EXPORT AND RUN
// =============================================================================

export { FutarchySplitSwapDemo };

// Run demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runDemo();
    directUsageExample();
}