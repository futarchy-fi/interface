import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config();

async function checkEthereumProposal() {
    console.log('======================================');
    console.log('   CHECKING ETHEREUM PROPOSAL DATA');
    console.log('======================================');
    console.log();

    const proposalId = '0x2A4b52B47625431Fdc6fE58CeD3086E76c1f6bbf';
    const userAddress = '0x645A3D9208523bbFEE980f7269ac72C61Dd3b552';

    // Get Supabase credentials
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    try {
        // 1. Check if this proposal exists in the database at all
        console.log(`1. Checking if proposal ${proposalId} exists...\n`);

        const { data: proposalTrades, error: proposalError } = await supabaseClient
            .from('trade_history')
            .select('user_address, evt_block_time')
            .eq('proposal_id', proposalId.toLowerCase())
            .limit(10);

        if (proposalError) {
            console.error('Error:', proposalError);
            return;
        }

        if (!proposalTrades || proposalTrades.length === 0) {
            console.log('❌ No trades found for this proposal');

            // Check with different case variations
            console.log('\n2. Checking with original case...\n');
            const { data: caseCheck } = await supabaseClient
                .from('trade_history')
                .select('proposal_id')
                .eq('proposal_id', proposalId) // Original case
                .limit(1);

            if (caseCheck && caseCheck.length > 0) {
                console.log('✅ Found with original case');
            } else {
                console.log('❌ Not found with original case either');
            }

            // Check if there are ANY Ethereum mainnet proposals
            console.log('\n3. Looking for sample Ethereum proposals in database...\n');
            const { data: sampleProposals } = await supabaseClient
                .from('trade_history')
                .select('proposal_id, user_address')
                .limit(10);

            if (sampleProposals && sampleProposals.length > 0) {
                console.log('Sample proposals in database:');
                const uniqueProposals = [...new Set(sampleProposals.map(t => t.proposal_id))];
                uniqueProposals.slice(0, 5).forEach(p => console.log(`  - ${p}`));
            }

        } else {
            console.log(`✅ Found ${proposalTrades.length} trades for this proposal`);
            console.log('\nUsers who traded:');
            const uniqueUsers = [...new Set(proposalTrades.map(t => t.user_address))];
            uniqueUsers.forEach(u => console.log(`  - ${u}`));
        }

        // 2. Check if this specific user has ANY trades
        console.log(`\n4. Checking if user ${userAddress} has any trades...\n`);

        const { data: userTrades, error: userError } = await supabaseClient
            .from('trade_history')
            .select('proposal_id')
            .eq('user_address', userAddress.toLowerCase())
            .limit(10);

        if (userError) {
            console.error('Error:', userError);
            return;
        }

        if (!userTrades || userTrades.length === 0) {
            console.log('❌ No trades found for this user');

            // Try original case
            const { data: userCaseCheck } = await supabaseClient
                .from('trade_history')
                .select('proposal_id')
                .eq('user_address', userAddress) // Original case
                .limit(1);

            if (userCaseCheck && userCaseCheck.length > 0) {
                console.log('✅ Found with original case');
                console.log('Proposals traded by this user:');
                const uniqueProposals = [...new Set(userCaseCheck.map(t => t.proposal_id))];
                uniqueProposals.forEach(p => console.log(`  - ${p}`));
            }

        } else {
            console.log(`✅ Found ${userTrades.length} trades for this user`);
            console.log('\nProposals traded by this user:');
            const uniqueProposals = [...new Set(userTrades.map(t => t.proposal_id))];
            uniqueProposals.forEach(p => console.log(`  - ${p}`));
        }

        // 3. Final check - get a sample trade to understand the data structure
        console.log('\n5. Getting a sample trade from the database...\n');
        const { data: sampleTrade } = await supabaseClient
            .from('trade_history')
            .select('*')
            .limit(1);

        if (sampleTrade && sampleTrade.length > 0) {
            console.log('Sample trade structure:');
            console.log(JSON.stringify(sampleTrade[0], null, 2));
        }

    } catch (error) {
        console.error('Error:', error);
    }

    console.log('\n======================================');
    console.log('✨ Check Complete');
    console.log('======================================');
}

checkEthereumProposal().catch(console.error);