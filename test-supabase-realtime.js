import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://nvhqdqtlsdboctqjcelq.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52aHFkcXRsc2Rib2N0cWpjZWxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzI1NjMzNzYsImV4cCI6MjA0ODEzOTM3Nn0.yaot_JulAapartenența9Vx8k9xJYQGZWfPqLx0Y8BQQeQGZfM';

const proposalId = '0x757fAF022abf920E110d6C4DbC2477A99788F447';

console.log('🚀 Starting Supabase Realtime Test');
console.log('📍 Proposal ID:', proposalId);
console.log('🌐 Supabase URL:', supabaseUrl);
console.log('');

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔴 Setting up realtime subscription...');

// FIXED: Table is trade_history, not swaps!
const channel = supabase
  .channel(`realtime-trades-test-${proposalId}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'trade_history'
  }, (payload) => {
    // Filter manually in the callback
    if (payload.new && payload.new.pool_id !== proposalId) {
      console.log('⏭️  Skipping trade from different proposal:', payload.new.pool_id);
      return;
    }
    console.log('');
    console.log('🎉 ========================================');
    console.log('🎉 NEW TRADE RECEIVED!');
    console.log('🎉 ========================================');
    console.log('📦 Full Payload:', JSON.stringify(payload, null, 2));
    console.log('');
    console.log('📝 Trade Details:');
    console.log('  - Event Type:', payload.eventType);
    console.log('  - Transaction Hash:', payload.new?.evt_tx_hash);
    console.log('  - Block Number:', payload.new?.evt_block_number);
    console.log('  - Sender:', payload.new?.sender);
    console.log('  - Recipient:', payload.new?.recipient);
    console.log('  - Amount0:', payload.new?.amount0);
    console.log('  - Amount1:', payload.new?.amount1);
    console.log('  - Token0:', payload.new?.token0);
    console.log('  - Token1:', payload.new?.token1);
    console.log('  - Timestamp:', payload.new?.evt_block_time);
    console.log('🎉 ========================================');
    console.log('');
  })
  .subscribe((status) => {
    console.log('📡 Subscription Status:', status);
    if (status === 'SUBSCRIBED') {
      console.log('✅ Successfully subscribed to realtime updates!');
      console.log('⏳ Waiting for trades on proposal:', proposalId);
      console.log('👀 Make a trade now and watch for updates...');
      console.log('');
    } else if (status === 'CHANNEL_ERROR') {
      console.error('❌ Channel error!');
    } else if (status === 'TIMED_OUT') {
      console.error('❌ Subscription timed out!');
    } else if (status === 'CLOSED') {
      console.log('🔌 Channel closed');
    }
  });

// Keep the script running
console.log('🔄 Script is running... Press Ctrl+C to exit');
console.log('');

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('');
  console.log('🛑 Shutting down...');
  supabase.removeChannel(channel);
  process.exit(0);
});
