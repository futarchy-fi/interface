// futarchy-fetcher-demo.js - Demo of FutarchyFetcher functionality

import { DataLayer } from '../DataLayer.js';
import { createPublicClient, http } from 'viem';
import { gnosis } from 'viem/chains';
import { createFutarchyFetcher } from '../fetchers/FutarchyFetcher.js';

// =============================================================================
// DEMO CONFIGURATION
// =============================================================================

const DEMO_CONFIG = {
    proposalAddress: '0xDA36a35CA4Fe6214C37a452159C0C9EAd45D5919',
    userAddress: '0xF863Da42f750A9a792a2c13c1Fc8E6Edaa81CA28',
    rpcUrl: 'https://rpc.gnosischain.com'
};

// =============================================================================
// FUTARCHY FETCHER DEMO CLASS
// =============================================================================

class FutarchyFetcherDemo {
    constructor() {
        this.publicClient = createPublicClient({
            chain: gnosis,
            transport: http(DEMO_CONFIG.rpcUrl)
        });
        
        this.dataLayer = new DataLayer();
        this.futarchyFetcher = createFutarchyFetcher(this.publicClient);
        this.dataLayer.registerFetcher(this.futarchyFetcher);
        
        console.log('🔧 FutarchyFetcher demo initialized');
    }
    
    /**
     * Demo 1: Fetch proposal information
     */
    async demoProposalInfo() {
        console.log('\n📋 Demo 1: Fetching Proposal Information');
        console.log('========================================');
        
        try {
            const result = await this.dataLayer.fetch('futarchy.proposal', {
                proposalAddress: DEMO_CONFIG.proposalAddress
            });
            
            if (result.status === 'success') {
                const { marketName, collateralTokens, outcomeTokens } = result.data;
                
                console.log(`✅ Market Name: ${marketName}`);
                console.log(`🏢 Company Token: ${collateralTokens.company}`);
                console.log(`💰 Currency Token: ${collateralTokens.currency}`);
                console.log(`📈 YES_COMPANY: ${outcomeTokens.yesCompany}`);
                console.log(`📉 NO_COMPANY: ${outcomeTokens.noCompany}`);
                console.log(`📈 YES_CURRENCY: ${outcomeTokens.yesCurrency}`);
                console.log(`📉 NO_CURRENCY: ${outcomeTokens.noCurrency}`);
            } else {
                console.error('❌ Failed to fetch proposal info:', result.reason);
            }
        } catch (error) {
            console.error('💥 Error:', error.message);
        }
    }
    
    /**
     * Demo 2: Fetch user balances (requires user address)
     */
    async demoUserBalances() {
        console.log('\n💰 Demo 2: Fetching User Balances');
        console.log('=================================');
        
        if (!DEMO_CONFIG.userAddress || DEMO_CONFIG.userAddress === '0x...') {
            console.log('⚠️ Skipping user balance demo - no user address provided');
            console.log('   Set DEMO_CONFIG.userAddress to test this feature');
            return;
        }
        
        try {
            const result = await this.dataLayer.fetch('futarchy.balances', {
                proposalAddress: DEMO_CONFIG.proposalAddress,
                userAddress: DEMO_CONFIG.userAddress
            });
            
            if (result.status === 'success') {
                const { outcomeTokens, collateralTokens } = result.data;
                
                console.log('📊 Outcome Token Balances:');
                console.log(`   YES_COMPANY: ${outcomeTokens.yesCompany.formatted}`);
                console.log(`   NO_COMPANY: ${outcomeTokens.noCompany.formatted}`);
                console.log(`   YES_CURRENCY: ${outcomeTokens.yesCurrency.formatted}`);
                console.log(`   NO_CURRENCY: ${outcomeTokens.noCurrency.formatted}`);
                
                console.log('🏦 Collateral Token Balances:');
                console.log(`   COMPANY: ${collateralTokens.company.formatted}`);
                console.log(`   CURRENCY: ${collateralTokens.currency.formatted}`);
            } else {
                console.error('❌ Failed to fetch user balances:', result.reason);
            }
        } catch (error) {
            console.error('💥 Error:', error.message);
        }
    }
    
    /**
     * Demo 3: Calculate user positions
     */
    async demoUserPositions() {
        console.log('\n📊 Demo 3: Calculating User Positions');
        console.log('=====================================');
        
        if (!DEMO_CONFIG.userAddress || DEMO_CONFIG.userAddress === '0x...') {
            console.log('⚠️ Skipping user positions demo - no user address provided');
            return;
        }
        
        try {
            const result = await this.dataLayer.fetch('futarchy.positions', {
                proposalAddress: DEMO_CONFIG.proposalAddress,
                userAddress: DEMO_CONFIG.userAddress
            });
            
            if (result.status === 'success') {
                const { mergeable, positions, summary } = result.data;
                
                console.log('🔄 Mergeable Amounts:');
                console.log(`   Company: ${mergeable.company.formatted}`);
                console.log(`   Currency: ${mergeable.currency.formatted}`);
                
                console.log('🎯 Net Positions:');
                console.log(`   Company: ${positions.company.description}`);
                console.log(`   Currency: ${positions.currency.description}`);
                
                console.log('📈 Summary:');
                console.log(`   Has Positions: ${summary.hasPositions}`);
                console.log(`   Has Mergeable: ${summary.hasMergeable}`);
                console.log(`   Total Value: ${summary.totalValue}`);
            } else {
                console.error('❌ Failed to calculate positions:', result.reason);
            }
        } catch (error) {
            console.error('💥 Error:', error.message);
        }
    }
    
    /**
     * Demo 4: Fetch complete data
     */
    async demoCompleteData() {
        console.log('\n🔄 Demo 4: Fetching Complete Data');
        console.log('=================================');
        
        try {
            const result = await this.dataLayer.fetch('futarchy.complete', {
                proposalAddress: DEMO_CONFIG.proposalAddress,
                userAddress: DEMO_CONFIG.userAddress
            });
            
            if (result.status === 'success') {
                const { proposal, balances, positions, hasUserData } = result.data;
                
                console.log(`✅ Market: ${proposal.marketName}`);
                console.log(`📍 Proposal: ${proposal.proposalAddress}`);
                console.log(`👤 User Data: ${hasUserData ? 'Available' : 'Not provided'}`);
                
                if (hasUserData && positions) {
                    console.log('📊 Quick Position Summary:');
                    console.log(`   Company Position: ${positions.positions.company.description}`);
                    console.log(`   Currency Position: ${positions.positions.currency.description}`);
                }
            } else {
                console.error('❌ Failed to fetch complete data:', result.reason);
            }
        } catch (error) {
            console.error('💥 Error:', error.message);
        }
    }
    
    /**
     * Demo 5: Simulated polling (runs a few times)
     */
    async demoPolling() {
        console.log('\n⏰ Demo 5: Simulated Polling (5 times, 3s intervals)');
        console.log('===================================================');
        
        let count = 0;
        const maxPolls = 5;
        
        const pollInterval = setInterval(async () => {
            count++;
            console.log(`\n🔄 Poll ${count}/${maxPolls} - ${new Date().toLocaleTimeString()}`);
            
            try {
                const result = await this.dataLayer.fetch('futarchy.proposal', {
                    proposalAddress: DEMO_CONFIG.proposalAddress
                });
                
                if (result.status === 'success') {
                    console.log(`✅ Market: ${result.data.marketName} ${result.cached ? '(cached)' : '(fresh)'}`);
                } else {
                    console.log(`❌ Error: ${result.reason}`);
                }
            } catch (error) {
                console.log(`💥 Error: ${error.message}`);
            }
            
            if (count >= maxPolls) {
                clearInterval(pollInterval);
                console.log('\n🏁 Polling demo completed');
            }
        }, 3000);
    }
    
    /**
     * Run all demos
     */
    async runAllDemos() {
        console.log('🎯 Futarchy Fetcher Demo');
        console.log('========================');
        console.log(`📍 Proposal: ${DEMO_CONFIG.proposalAddress}`);
        console.log(`👤 User: ${DEMO_CONFIG.userAddress}`);
        console.log(`🌐 RPC: ${DEMO_CONFIG.rpcUrl}`);
        
        await this.demoProposalInfo();
        await this.demoUserBalances();
        await this.demoUserPositions();
        await this.demoCompleteData();
        await this.demoPolling();
    }
}

// =============================================================================
// USAGE EXAMPLES
// =============================================================================

/**
 * Example of direct fetcher usage
 */
function showDirectUsageExample() {
    console.log('\n💻 Direct Usage Example:');
    console.log('========================');
    console.log('');
    console.log('import { DataLayer } from "./DataLayer.js";');
    console.log('import { createFutarchyFetcher } from "./fetchers/FutarchyFetcher.js";');
    console.log('import { createPublicClient, http } from "viem";');
    console.log('import { gnosis } from "viem/chains";');
    console.log('');
    console.log('// Setup');
    console.log('const publicClient = createPublicClient({');
    console.log('    chain: gnosis,');
    console.log('    transport: http("https://rpc.gnosischain.com")');
    console.log('});');
    console.log('');
    console.log('const dataLayer = new DataLayer();');
    console.log('const fetcher = createFutarchyFetcher(publicClient);');
    console.log('dataLayer.registerFetcher(fetcher);');
    console.log('');
    console.log('// Get complete futarchy data');
    console.log('const result = await dataLayer.fetch("futarchy.complete", {');
    console.log('    proposalAddress: "0xDA36a35CA4Fe6214C37a452159C0C9EAd45D5919",');
    console.log('    userAddress: "0x..."');
    console.log('});');
    console.log('');
    console.log('// Access calculated positions');
    console.log('if (result.status === "success") {');
    console.log('    const { positions } = result.data;');
    console.log('    console.log(positions.positions.company.description);');
    console.log('    console.log(positions.mergeable.currency.formatted);');
    console.log('}');
    console.log('');
}

// =============================================================================
// EXPORT AND RUN
// =============================================================================

export { FutarchyFetcherDemo };

// Run demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const demo = new FutarchyFetcherDemo();
    
    // Show usage example first
    showDirectUsageExample();
    
    // Run all demos
    await demo.runAllDemos();
}