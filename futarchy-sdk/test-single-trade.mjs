import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

// Get a single trade to examine
const { data, error } = await supabase
    .from('trade_history')
    .select('*')
    .eq('user_address', '0xea820f6fea20a06af94b291c393c68956199cbe9')
    .eq('proposal_id', '0x9590dAF4d5cd4009c3F9767C5E7668175cFd37CF')
    .limit(3);

if (error) {
    console.error('Error:', error);
} else if (data && data.length > 0) {
    console.log('Sample trades from database:\n');
    data.forEach((trade, index) => {
        console.log(`Trade ${index + 1}:`);
        console.log('  Token 0:', trade.token0);
        console.log('  Token 1:', trade.token1);
        console.log('  Amount 0:', trade.amount0);
        console.log('  Amount 1:', trade.amount1);
        console.log('  Pool ID:', trade.pool_id);
        console.log('  Block Time:', trade.evt_block_time);
        console.log('  TX Hash:', trade.evt_tx_hash);
        console.log('');
    });

    // Try to get token info from API
    console.log('Checking token addresses on Gnosis chain...');
    const tokens = [
        { addr: data[0].token0, name: 'Token 0' },
        { addr: data[0].token1, name: 'Token 1' }
    ];

    for (const token of tokens) {
        console.log(`\n${token.name}: ${token.addr}`);
        console.log(`  Explorer: https://gnosisscan.io/address/${token.addr}`);
    }
}