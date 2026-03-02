// test-market-events.js - Test Market Events Fetcher

import { DataLayer } from './DataLayer.js';
import { createSupabasePoolFetcher } from './fetchers/SupabasePoolFetcher.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// =============================================================================
// MARKET EVENTS TEST
// =============================================================================

async function testMarketEvents() {
    console.log('🏛️ Testing Market Events Fetcher...');
    
    try {
        // Check if Supabase credentials are available
        console.log('🔍 Checking environment variables...');
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_ANON_KEY;
        
        console.log(`   SUPABASE_URL: ${supabaseUrl ? '✅ Found' : '❌ Missing'}`);
        console.log(`   SUPABASE_ANON_KEY: ${supabaseKey ? '✅ Found' : '❌ Missing'}`);
        
        if (!supabaseUrl || !supabaseKey) {
            console.log('⚠️ Supabase credentials not found in environment variables');
            console.log('   Add SUPABASE_URL and SUPABASE_ANON_KEY to .env file');
            console.log('   Example .env content:');
            console.log('   SUPABASE_URL=https://your-project.supabase.co');
            console.log('   SUPABASE_ANON_KEY=your-anon-key-here');
            return;
        }
        
        // Setup DataLayer with Supabase fetcher
        console.log('🔧 Setting up DataLayer...');
        const dataLayer = new DataLayer();
        
        console.log('🔧 Creating Supabase fetcher...');
        const supabaseFetcher = createSupabasePoolFetcher(supabaseUrl, supabaseKey);
        
        console.log('🔧 Registering fetcher with DataLayer...');
        dataLayer.registerFetcher(supabaseFetcher);
        
        console.log('✅ Setup complete, fetching market events...\n');
        
        // Test 1: Fetch all market events (limited to 10)
        console.log('📋 Test 1: Fetch Latest Market Events');
        console.log('=====================================');
        
        console.log('🔄 Calling dataLayer.fetch("markets.events", { limit: 10 })...');
        const allEvents = await dataLayer.fetch('markets.events', { 
            limit: 10 
        });
        
        console.log('📊 Fetch result status:', allEvents.status);
        
        if (allEvents.status === 'success') {
            console.log(`✅ Found ${allEvents.count} market events`);
            
            allEvents.data.forEach((event, index) => {
                console.log(`\n${index + 1}. ${event.title}`);
                console.log(`   📍 ID: ${event.id}`);
                console.log(`   📊 Status: ${event.event_status} | Resolution: ${event.resolution_status}`);
                console.log(`   👁️ Visibility: ${event.visibility}`);
                console.log(`   📅 End Date: ${event.end_date}`);
                
                if (event.tokenAddresses) {
                    console.log(`   🎯 Proposal: ${event.tokenAddresses.proposalAddress}`);
                    console.log(`   🏢 Company: ${event.tokenAddresses.companyToken?.slice(0, 8)}...`);
                    console.log(`   💰 Currency: ${event.tokenAddresses.currencyToken?.slice(0, 8)}...`);
                }
                
                if (event.summary) {
                    const status = event.summary.isResolved ? 
                        `Resolved (${event.summary.outcome})` : 
                        event.summary.isOpen ? 'Open' : 'Pending';
                    console.log(`   📈 Status Summary: ${status}`);
                }
            });
        } else {
            console.error('❌ Failed to fetch market events:', allEvents.reason);
        }
        
        // Test 2: Fetch only open events
        console.log('\n\n🔄 Test 2: Fetch Only Open Events');
        console.log('===================================');
        
        const openEvents = await dataLayer.fetch('markets.events', { 
            status: 'open',
            limit: 5
        });
        
        if (openEvents.status === 'success') {
            console.log(`✅ Found ${openEvents.count} open events`);
            
            openEvents.data.forEach((event, index) => {
                console.log(`\n${index + 1}. ${event.title}`);
                console.log(`   📊 End Date: ${event.end_date}`);
                console.log(`   💰 Tokens: ${event.tokens}`);
            });
        } else {
            console.error('❌ Failed to fetch open events:', openEvents.reason);
        }
        
        // Test 3: Fetch only public events
        console.log('\n\n👁️ Test 3: Fetch Only Public Events');
        console.log('====================================');
        
        const publicEvents = await dataLayer.fetch('markets.events', { 
            visibility: 'public',
            limit: 5
        });
        
        if (publicEvents.status === 'success') {
            console.log(`✅ Found ${publicEvents.count} public events`);
            
            publicEvents.data.forEach((event, index) => {
                console.log(`\n${index + 1}. ${event.title}`);
                console.log(`   📊 Approval: ${event.approval_status}`);
                console.log(`   🎯 Company ID: ${event.company_id}`);
            });
        } else {
            console.error('❌ Failed to fetch public events:', publicEvents.reason);
        }
        
        // Test 4: Show token addresses for integration
        console.log('\n\n🔗 Test 4: Token Addresses for Integration');
        console.log('==========================================');
        
        if (allEvents.status === 'success' && allEvents.data.length > 0) {
            const firstEvent = allEvents.data[0];
            console.log(`📋 Example Event: ${firstEvent.title}`);
            
            if (firstEvent.tokenAddresses) {
                console.log('\n🎯 Token Addresses:');
                console.log(`   Proposal: ${firstEvent.tokenAddresses.proposalAddress}`);
                console.log(`   Company Token: ${firstEvent.tokenAddresses.companyToken}`);
                console.log(`   Currency Token: ${firstEvent.tokenAddresses.currencyToken}`);
                console.log(`   YES Company: ${firstEvent.tokenAddresses.yesCompany}`);
                console.log(`   NO Company: ${firstEvent.tokenAddresses.noCompany}`);
                console.log(`   YES Currency: ${firstEvent.tokenAddresses.yesCurrency}`);
                console.log(`   NO Currency: ${firstEvent.tokenAddresses.noCurrency}`);
            }
            
            if (firstEvent.poolAddresses) {
                console.log('\n🏊 Pool Addresses:');
                console.log(`   YES Pool: ${firstEvent.poolAddresses.yesPool}`);
                console.log(`   NO Pool: ${firstEvent.poolAddresses.noPool}`);
                console.log(`   YES Conditional: ${firstEvent.poolAddresses.yesConditional}`);
                console.log(`   NO Conditional: ${firstEvent.poolAddresses.noConditional}`);
            }
            
            console.log('\n💡 Usage Example:');
            console.log('// Use this proposal address with FutarchyFetcher:');
            console.log(`const result = await dataLayer.fetch('futarchy.complete', {`);
            console.log(`    proposalAddress: '${firstEvent.tokenAddresses?.proposalAddress}',`);
            console.log(`    userAddress: 'YOUR_WALLET_ADDRESS'`);
            console.log(`});`);
        }
        
        console.log('\n🎉 Market Events test completed!');
        
    } catch (error) {
        console.error('💥 Test failed:', error.message);
    }
}

// =============================================================================
// USAGE GUIDE
// =============================================================================

function showUsageGuide() {
    console.log('\n💻 Market Events Fetcher Usage Guide:');
    console.log('=====================================');
    console.log('');
    console.log('// Basic usage - get all recent events');
    console.log('const events = await dataLayer.fetch("markets.events", { limit: 20 });');
    console.log('');
    console.log('// Filter by status');
    console.log('const openEvents = await dataLayer.fetch("markets.events", { status: "open" });');
    console.log('const resolvedEvents = await dataLayer.fetch("markets.events", { status: "resolved" });');
    console.log('');
    console.log('// Filter by visibility');
    console.log('const publicEvents = await dataLayer.fetch("markets.events", { visibility: "public" });');
    console.log('const testEvents = await dataLayer.fetch("markets.events", { visibility: "test" });');
    console.log('');
    console.log('// Combine filters');
    console.log('const openPublicEvents = await dataLayer.fetch("markets.events", {');
    console.log('    status: "open",');
    console.log('    visibility: "public",');
    console.log('    limit: 10');
    console.log('});');
    console.log('');
    console.log('// Access processed data');
    console.log('events.data.forEach(event => {');
    console.log('    console.log(event.title);');
    console.log('    console.log(event.tokenAddresses.proposalAddress);');
    console.log('    console.log(event.summary.isOpen);');
    console.log('});');
    console.log('');
}

// =============================================================================
// EXPORT AND RUN
// =============================================================================

export { testMarketEvents };

// Auto-run test
console.log('🚀 Starting Market Events Test...\n');
showUsageGuide();

try {
    await testMarketEvents();
} catch (error) {
    console.error('💥 Top-level error:', error);
    process.exit(1);
}