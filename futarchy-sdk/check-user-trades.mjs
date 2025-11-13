import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('Checking trades for user: 0xea820f6fea20a06af94b291c393c68956199cbe9\n');

// Check if any trades exist for this user (any case)
const queries = [
    // Try lowercase
    {
        user: '0xea820f6fea20a06af94b291c393c68956199cbe9',
        proposal: '0x9590daf4d5cd4009c3f9767c5e7668175cfd37cf'
    },
    // Try mixed case as provided
    {
        user: '0xea820f6fea20a06af94b291c393c68956199cbe9',
        proposal: '0x9590dAF4d5cd4009c3F9767C5E7668175cFd37CF'
    },
];

// First check what trades exist for this user at all
console.log('1. Checking all trades for user...');
const { data: userTrades, error: userError } = await supabase
    .from('trade_history')
    .select('proposal_id, evt_block_time')
    .eq('user_address', '0xea820f6fea20a06af94b291c393c68956199cbe9')
    .limit(10);

if (userError) {
    console.error('Error:', userError);
} else {
    console.log(`Found ${userTrades?.length || 0} trades for user`);
    if (userTrades && userTrades.length > 0) {
        console.log('Unique proposals traded:');
        const uniqueProposals = [...new Set(userTrades.map(t => t.proposal_id))];
        uniqueProposals.forEach(p => console.log(`  - ${p}`));
    }
}

console.log('\n2. Checking specific proposal (various cases)...');
for (const query of queries) {
    const { data, error } = await supabase
        .from('trade_history')
        .select('*')
        .eq('user_address', query.user)
        .eq('proposal_id', query.proposal)
        .limit(1);

    if (!error && data && data.length > 0) {
        console.log(`✅ Found trades with proposal: ${query.proposal}`);
        console.log('   Sample trade:', {
            token0: data[0].token0,
            token1: data[0].token1,
            amount0: data[0].amount0,
            amount1: data[0].amount1,
            evt_block_time: data[0].evt_block_time
        });
        break;
    } else {
        console.log(`❌ No trades with proposal: ${query.proposal}`);
    }
}

// Check if the proposal exists at all in the database
console.log('\n3. Checking if proposal exists in database...');
const { data: proposalTrades, error: proposalError } = await supabase
    .from('trade_history')
    .select('user_address')
    .eq('proposal_id', '0x9590daf4d5cd4009c3f9767c5e7668175cfd37cf')
    .limit(5);

if (proposalError) {
    console.error('Error:', proposalError);
} else if (proposalTrades && proposalTrades.length > 0) {
    console.log(`✅ Proposal exists with ${proposalTrades.length} trades`);
    console.log('Sample users who traded:');
    proposalTrades.forEach(t => console.log(`  - ${t.user_address}`));
} else {
    console.log('❌ Proposal not found in database');
}