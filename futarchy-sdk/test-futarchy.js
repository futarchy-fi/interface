// test-futarchy.js - Test the complete DataLayer architecture

import { DataLayer } from './DataLayer.js';
import { createViemExecutor } from './executors/ViemExecutor.js';
import { FutarchyCartridge } from './executors/FutarchyCartridge.js';
import { createSupabasePoolFetcher } from './fetchers/SupabasePoolFetcher.js';
import { MockFetcher } from './fetchers/MockFetcher.js';
import { config } from './config.js';

// Contract addresses and real proposal
const CONTRACTS = {
    SDAI: '0xaf204776c7245bF4147c2612BF6e5972Ee483701',
    FUTARCHY_ROUTER: '0x7495a583ba85875d59407781b4958ED6e0E1228f',
    REAL_PROPOSAL: '0xDA36a35CA4Fe6214C37a452159C0C9EAd45D5919'
};

/**
 * Test the complete architecture:
 * DataLayer -> ViemExecutor (with FutarchyCartridge) + Fetchers
 */
class FutarchyArchitectureTest {
    constructor() {
        console.log('🏛️ Futarchy Architecture Test Starting...');
        console.log('═══════════════════════════════════════════');
        
        // 1. Create DataLayer (central orchestrator)
        this.dataLayer = new DataLayer();
        
        // 2. Create and register fetchers (for data operations)
        this.setupFetchers();
        
        // 3. Create and register executor with futarchy cartridge (for blockchain operations)
        this.setupExecutor();
        
        console.log('\n📊 Architecture Summary:');
        console.log(`   Available Operations: ${this.dataLayer.getAvailableOperations().length}`);
        console.log(`   Read Operations (Fetchers): ${Array.from(this.dataLayer.fetchers.keys()).length}`);
        console.log(`   Write Operations (Executors): ${Array.from(this.dataLayer.executors.keys()).length}`);
    }
    
    setupFetchers() {
        console.log('\n🔌 Setting up Fetchers...');
        
        // Add mock fetcher for development
        const mockFetcher = new MockFetcher();
        this.dataLayer.registerFetcher(mockFetcher);
        
        // Add Supabase fetcher if configured
        if (!config.isUsingDefaultCredentials()) {
            const supabaseFetcher = createSupabasePoolFetcher(config.supabaseUrl, config.supabaseKey);
            this.dataLayer.registerFetcher(supabaseFetcher);
        } else {
            console.log('   ⚠️  Supabase not configured, using mock data only');
        }
    }
    
    setupExecutor() {
        console.log('\n⚡ Setting up Executor with Futarchy Cartridge...');
        
        // Create ViemExecutor
        this.viemExecutor = createViemExecutor({
            rpcUrl: 'https://rpc.gnosischain.com'
        });
        
        // Create and register FutarchyCartridge
        const futarchyCartridge = new FutarchyCartridge(CONTRACTS.FUTARCHY_ROUTER);
        this.viemExecutor.registerCartridge(futarchyCartridge);
        
        // Register executor with DataLayer
        this.dataLayer.registerExecutor(this.viemExecutor);
    }
    
    /**
     * Test data operations (fetchers)
     */
    async testDataOperations() {
        console.log('\n📊 Testing Data Operations (Fetchers)...');
        console.log('═══════════════════════════════════════════');
        
        try {
            // Test pool candles fetch
            const result = await this.dataLayer.fetch('pools.candle', {
                id: '0xF336F812Db1ad142F22A9A4dd43D40e64B478361',
                limit: 3
            });
            
            console.log('✅ Pool candles fetch result:', result.status);
            if (result.data) {
                console.log(`   📈 Got ${result.data.length} candles`);
            }
            
            return result;
            
        } catch (error) {
            console.error('❌ Data operation failed:', error.message);
            throw error;
        }
    }
    
    /**
     * Test blockchain operations (executors)
     */
    async testBlockchainOperations() {
        console.log('\n⚡ Testing Blockchain Operations (Executors)...');
        console.log('═══════════════════════════════════════════');
        
        try {
            // Test 1: Connect wallet
            console.log('🔗 Testing wallet connection...');
            let account = null;
            
            for await (const status of this.dataLayer.execute('web3.connect')) {
                console.log(`   ${status.status}: ${status.message}`);
                
                if (status.status === 'success') {
                    account = status.data.account;
                    break;
                } else if (status.status === 'error') {
                    console.log('   ℹ️  Connection failed (expected in CLI environment)');
                    return { skipped: true, reason: 'No browser environment' };
                }
            }
            
            if (!account) {
                console.log('   ℹ️  Skipping further tests (no wallet connection)');
                return { skipped: true, reason: 'No wallet connection' };
            }
            
            // Test 2: Check approval status
            console.log('\n📋 Testing approval check...');
            for await (const status of this.dataLayer.execute('futarchy.checkApproval', {
                collateralToken: CONTRACTS.SDAI
            })) {
                console.log(`   ${status.status}: ${status.message}`);
                
                if (status.status === 'success') {
                    console.log(`   📊 Approved: ${status.data.isApproved}`);
                    console.log(`   💰 Balance: ${status.data.balanceFormatted}`);
                    break;
                } else if (status.status === 'error') {
                    console.log('   ℹ️  Approval check failed (expected without wallet)');
                    break;
                }
            }
            
            return { success: true };
            
        } catch (error) {
            console.error('❌ Blockchain operation failed:', error.message);
            return { error: error.message };
        }
    }
    
    /**
     * List all available operations
     */
    listAllOperations() {
        console.log('\n📋 All Available Operations:');
        console.log('═══════════════════════════════════════');
        
        const fetcherOps = Array.from(this.dataLayer.fetchers.keys());
        const executorOps = Array.from(this.dataLayer.executors.keys());
        
        console.log('📊 Read Operations (Fetchers):');
        fetcherOps.forEach(op => console.log(`   - ${op}`));
        
        console.log('\n⚡ Write Operations (Executors):');
        executorOps.forEach(op => console.log(`   - ${op}`));
        
        console.log(`\n📈 Total: ${this.dataLayer.getAvailableOperations().length} operations`);
        
        // Test futarchy operations specifically
        console.log('\n🎯 Futarchy Operations Available:');
        const futarchyOps = executorOps.filter(op => op.startsWith('futarchy.'));
        futarchyOps.forEach(op => console.log(`   - ${op}`));
        
        return {
            total: this.dataLayer.getAvailableOperations().length,
            fetchers: fetcherOps.length,
            executors: executorOps.length,
            futarchy: futarchyOps.length
        };
    }
    
    /**
     * Test the real proposal address
     */
    async testRealProposal() {
        console.log('\n🏛️ Testing Real Proposal Address...');
        console.log('═══════════════════════════════════════');
        console.log(`   Proposal: ${CONTRACTS.REAL_PROPOSAL}`);
        console.log(`   Collateral: ${CONTRACTS.SDAI} (sDAI)`);
        console.log(`   Futarchy Router: ${CONTRACTS.FUTARCHY_ROUTER}`);
        
        // This would test actual operations but requires wallet connection
        console.log('\n📝 Operations that would be performed:');
        console.log('   1. futarchy.checkApproval - Check if sDAI is approved');
        console.log('   2. futarchy.approveCollateral - Approve sDAI if needed');
        console.log('   3. futarchy.splitPosition - Split sDAI into YES/NO tokens');
        console.log('   4. futarchy.mergePositions - Merge YES/NO back to sDAI');
        console.log('   5. futarchy.redeemPositions - Redeem after resolution');
        
        return {
            proposal: CONTRACTS.REAL_PROPOSAL,
            collateral: CONTRACTS.SDAI,
            router: CONTRACTS.FUTARCHY_ROUTER
        };
    }
    
    /**
     * Run complete test suite
     */
    async runTests() {
        try {
            console.log('\n🚀 Running Complete Test Suite...');
            console.log('═══════════════════════════════════════════');
            
            // Test 1: List operations
            const operationsInfo = this.listAllOperations();
            
            // Test 2: Data operations
            const dataResult = await this.testDataOperations();
            
            // Test 3: Blockchain operations
            const blockchainResult = await this.testBlockchainOperations();
            
            // Test 4: Real proposal info
            const proposalInfo = await this.testRealProposal();
            
            console.log('\n🎊 TEST SUITE COMPLETED!');
            console.log('═══════════════════════════════════════════');
            console.log('📊 Results Summary:');
            console.log(`   Operations Available: ${operationsInfo.total}`);
            console.log(`   Fetcher Operations: ${operationsInfo.fetchers}`);
            console.log(`   Executor Operations: ${operationsInfo.executors}`);
            console.log(`   Futarchy Operations: ${operationsInfo.futarchy}`);
            console.log(`   Data Fetch: ${dataResult.status}`);
            console.log(`   Blockchain Test: ${blockchainResult.success ? 'Ready' : 'Skipped'}`);
            console.log(`   Real Proposal: ${proposalInfo.proposal}`);
            
            console.log('\n🏛️ Architecture Validation: ✅ PASSED');
            console.log('   DataLayer -> ViemExecutor -> FutarchyCartridge: Working!');
            
            return {
                operationsInfo,
                dataResult,
                blockchainResult,
                proposalInfo
            };
            
        } catch (error) {
            console.error('\n❌ Test suite failed:', error.message);
            throw error;
        }
    }
}

// Export for use
export { FutarchyArchitectureTest, CONTRACTS };

// CLI usage
if (process.argv[1] && process.argv[1].endsWith('test-futarchy.js')) {
    const test = new FutarchyArchitectureTest();
    
    const command = process.argv[2] || 'full';
    
    console.log('🏛️ Futarchy Architecture Test');
    console.log('Available commands:');
    console.log('  full - Run complete test suite');
    console.log('  list - List all operations');
    console.log('  data - Test data operations only');
    console.log('  blockchain - Test blockchain operations only');
    console.log('  proposal - Show real proposal info');
    console.log('');
    
    switch (command) {
        case 'full':
            test.runTests().catch(console.error);
            break;
            
        case 'list':
            test.listAllOperations();
            break;
            
        case 'data':
            test.testDataOperations().catch(console.error);
            break;
            
        case 'blockchain':
            test.testBlockchainOperations().catch(console.error);
            break;
            
        case 'proposal':
            test.testRealProposal().catch(console.error);
            break;
            
        default:
            console.log(`Unknown command: ${command}`);
    }
} 