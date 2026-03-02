import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config();

async function testSupabaseConnection() {
    console.log('Testing Supabase Connection...\n');

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error('❌ Missing Supabase credentials in .env');
        return;
    }

    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    // Test 1: Get any 5 records from trade_history
    console.log('Test 1: Fetching any 5 records from trade_history...');
    const { data: anyTrades, error: anyError } = await supabaseClient
        .from('trade_history')
        .select('*')
        .limit(5);

    if (anyError) {
        console.error('❌ Error:', anyError.message);
    } else {
        console.log(`✅ Found ${anyTrades?.length || 0} trades`);
        if (anyTrades && anyTrades.length > 0) {
            console.log('Sample trade:', JSON.stringify(anyTrades[0], null, 2));
        }
    }

    // Test 2: Get trades for specific user
    console.log('\nTest 2: Fetching trades for user 0xea820f6fea20a06af94b291c393c68956199cbe9...');
    const { data: userTrades, error: userError } = await supabaseClient
        .from('trade_history')
        .select('*')
        .eq('user_address', '0xea820f6fea20a06af94b291c393c68956199cbe9')
        .limit(5);

    if (userError) {
        console.error('❌ Error:', userError.message);
    } else {
        console.log(`✅ Found ${userTrades?.length || 0} trades for this user`);
    }

    // Test 3: Get count of all trades
    console.log('\nTest 3: Counting total trades...');
    const { count, error: countError } = await supabaseClient
        .from('trade_history')
        .select('*', { count: 'exact', head: true });

    if (countError) {
        console.error('❌ Error:', countError.message);
    } else {
        console.log(`✅ Total trades in database: ${count}`);
    }

    // Test 4: Check column names
    console.log('\nTest 4: Checking available columns...');
    const { data: sampleData, error: sampleError } = await supabaseClient
        .from('trade_history')
        .select('*')
        .limit(1);

    if (!sampleError && sampleData && sampleData.length > 0) {
        console.log('Available columns:', Object.keys(sampleData[0]));
    }
}

testSupabaseConnection().catch(console.error);