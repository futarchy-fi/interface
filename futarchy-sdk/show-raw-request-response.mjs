import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config();

async function showRawRequestResponse() {
    console.log('======================================');
    console.log('   RAW REQUEST AND RESPONSE DETAILS');
    console.log('======================================');
    console.log();

    const userAddress = '0x645A3D9208523bbFEE980f7269ac72C61Dd3b552';
    const proposalId = '0x2A4b52B47625431Fdc6fE58CeD3086E76c1f6bbf';

    // Get Supabase credentials
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error('❌ Missing Supabase credentials');
        return;
    }

    // Build the query using Supabase client
    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    // Build the query to show what will be sent
    const query = supabaseClient
        .from('trade_history')
        .select('*')
        .eq('user_address', userAddress.toLowerCase())
        .eq('proposal_id', proposalId.toLowerCase())
        .order('evt_block_time', { ascending: false })
        .limit(10);

    // Show the constructed query details
    console.log('🔷 SUPABASE QUERY DETAILS:');
    console.log('──────────────────────────────────────────────────\n');

    console.log('Table: trade_history');
    console.log('Select: *');
    console.log('Filters:');
    console.log(`  - user_address = '${userAddress.toLowerCase()}'`);
    console.log(`  - proposal_id = '${proposalId.toLowerCase()}'`);
    console.log('Order: evt_block_time DESC');
    console.log('Limit: 10');

    // The actual HTTP request that Supabase sends
    console.log('\n🔷 RAW HTTP REQUEST (equivalent):');
    console.log('──────────────────────────────────────────────────\n');

    const apiUrl = `${supabaseUrl}/rest/v1/trade_history`;
    const queryParams = new URLSearchParams({
        select: '*',
        user_address: `eq.${userAddress.toLowerCase()}`,
        proposal_id: `eq.${proposalId.toLowerCase()}`,
        order: 'evt_block_time.desc',
        limit: '10'
    });

    console.log('Method: GET');
    console.log(`URL: ${apiUrl}?${queryParams}`);
    console.log('\nHeaders:');
    console.log(`  apikey: ${supabaseKey.substring(0, 20)}...`);
    console.log(`  Authorization: Bearer ${supabaseKey.substring(0, 20)}...`);
    console.log('  Content-Type: application/json');
    console.log('  Prefer: return=representation');

    // Now execute the actual query to get the response
    console.log('\n🔷 EXECUTING QUERY...');
    console.log('──────────────────────────────────────────────────\n');

    try {
        // Execute with fetch to see raw response
        const response = await fetch(`${apiUrl}?${queryParams}`, {
            method: 'GET',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            }
        });

        // Get response details
        console.log('🔷 RAW HTTP RESPONSE:');
        console.log('──────────────────────────────────────────────────\n');
        console.log(`Status: ${response.status} ${response.statusText}`);
        console.log('Headers:');
        response.headers.forEach((value, key) => {
            if (!key.toLowerCase().includes('key') && !key.toLowerCase().includes('auth')) {
                console.log(`  ${key}: ${value}`);
            }
        });

        // Get the raw response body
        const rawBody = await response.text();
        const data = JSON.parse(rawBody);

        console.log('\n🔷 RAW RESPONSE BODY:');
        console.log('──────────────────────────────────────────────────\n');
        console.log(rawBody);

        console.log('\n🔷 PARSED RESPONSE:');
        console.log('──────────────────────────────────────────────────\n');
        console.log(`Records returned: ${data.length}`);

        if (data.length > 0) {
            console.log('\nFirst record:');
            console.log(JSON.stringify(data[0], null, 2));
        } else {
            console.log('Empty result set: []');
        }

        // Also show what Supabase client returns
        console.log('\n🔷 SUPABASE CLIENT RESPONSE:');
        console.log('──────────────────────────────────────────────────\n');

        const { data: supabaseData, error: supabaseError } = await query;

        if (supabaseError) {
            console.log('Error:', supabaseError);
        } else {
            console.log('Data:', JSON.stringify(supabaseData, null, 2));
        }

    } catch (error) {
        console.error('❌ Request failed:', error.message);
    }

    console.log('\n======================================');
    console.log('✨ Complete');
    console.log('======================================');
}

// Run the function
showRawRequestResponse().catch(console.error);