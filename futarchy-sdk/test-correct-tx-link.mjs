import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config();

async function testCorrectTxLink() {
    console.log('======================================');
    console.log('   CHECKING TRANSACTION LINK FORMAT');
    console.log('======================================');
    console.log();

    const userAddress = '0xea820f6fea20a06af94b291c393c68956199cbe9';
    const proposalId = '0x9590dAF4d5cd4009c3F9767C5E7668175cFd37CF';

    // Get Supabase credentials
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    // Get a few trades to check the transaction hash format
    const { data, error } = await supabaseClient
        .from('trade_history')
        .select('evt_tx_hash, evt_block_time')
        .eq('user_address', userAddress.toLowerCase())
        .eq('proposal_id', proposalId)
        .limit(5);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Raw Transaction Hashes from Database:\n');
    data.forEach((trade, index) => {
        console.log(`Trade ${index + 1}:`);
        console.log(`  Raw evt_tx_hash: ${trade.evt_tx_hash}`);

        // Check if it has a suffix (like _121)
        const hasSuffix = trade.evt_tx_hash.includes('_');

        if (hasSuffix) {
            const [txHash, logIndex] = trade.evt_tx_hash.split('_');
            console.log(`  → Actual TX Hash: ${txHash}`);
            console.log(`  → Log Index: ${logIndex}`);
            console.log(`  → Correct Link: https://gnosisscan.io/tx/${txHash}`);
        } else {
            console.log(`  → Correct Link: https://gnosisscan.io/tx/${trade.evt_tx_hash}`);
        }
        console.log();
    });

    // Function to properly format transaction link
    function getCorrectTransactionLink(evt_tx_hash) {
        // Remove log index suffix if present (e.g., "_121")
        const actualTxHash = evt_tx_hash.split('_')[0];
        return `https://gnosisscan.io/tx/${actualTxHash}`;
    }

    console.log('──────────────────────────────────────────────────');
    console.log('CORRECT FORMAT FUNCTION:\n');
    console.log('function getCorrectTransactionLink(evt_tx_hash) {');
    console.log('    const actualTxHash = evt_tx_hash.split("_")[0];');
    console.log('    return `https://gnosisscan.io/tx/${actualTxHash}`;');
    console.log('}');
}

testCorrectTxLink().catch(console.error);