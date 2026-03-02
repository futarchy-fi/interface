import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config();

async function testRawQuery() {
    console.log('======================================');
    console.log('   RAW QUERY RESPONSE');
    console.log('======================================');
    console.log();

    const userAddress = '0xea820f6fea20a06af94b291c393c68956199cbe9';
    const proposalId = '0x9590dAF4d5cd4009c3F9767C5E7668175cFd37CF';

    console.log('Query: select * from trade_history');
    console.log(`       where user_address = '${userAddress}'`);
    console.log(`       and proposal_id = '${proposalId}'`);
    console.log('──────────────────────────────────────────────────\n');

    // Get Supabase credentials
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error('❌ Missing Supabase credentials');
        return;
    }

    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    try {
        // Execute the raw query
        const { data, error } = await supabaseClient
            .from('trade_history')
            .select('*')
            .eq('user_address', userAddress.toLowerCase())
            .eq('proposal_id', proposalId)
            .order('evt_block_time', { ascending: false })
            .limit(2); // Get just 2 records to show the full structure

        if (error) {
            console.error('❌ Query Error:', error);
            return;
        }

        console.log(`✅ Found ${data?.length || 0} records\n`);

        if (!data || data.length === 0) {
            console.log('No records found');
            return;
        }

        // Display the raw response
        console.log('RAW DATABASE RESPONSE (First 2 records):');
        console.log('──────────────────────────────────────────────────\n');
        console.log(JSON.stringify(data, null, 2));

        console.log('\n──────────────────────────────────────────────────');
        console.log('FIELD BREAKDOWN (First Record):');
        console.log('──────────────────────────────────────────────────\n');

        const firstRecord = data[0];
        Object.entries(firstRecord).forEach(([key, value]) => {
            const valueType = typeof value;
            const displayValue = value === null ? 'null' :
                               valueType === 'string' && value.length > 50 ?
                               value.substring(0, 50) + '...' : value;

            console.log(`${key.padEnd(20)} : ${displayValue} (${valueType})`);
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
    }

    console.log('\n======================================');
    console.log('✨ Complete');
    console.log('======================================');
}

// Run the test
testRawQuery().catch(console.error);