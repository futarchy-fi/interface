#!/usr/bin/env node

// Test script: Realtime pool candles via Supabase channel

import { DataLayer } from './DataLayer.js';
import { createSupabaseCandlesChannel, CANDLES_TOPIC } from './channels/SupabaseCandlesChannel.js';
import { config } from './config.js';

async function main() {
  const args = process.argv.slice(2);

  const idArg = args.find((a) => a.startsWith('--id='));
  const intervalArg = args.find((a) => a.startsWith('--interval='));
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const durationArg = args.find((a) => a.startsWith('--seconds='));

  const id = idArg ? idArg.split('=')[1] : config.defaultPools.base;
  const interval = intervalArg ? intervalArg.split('=')[1] : config.intervals['1h'];
  const maxMessages = limitArg ? parseInt(limitArg.split('=')[1], 10) : 10;
  const seconds = durationArg ? parseInt(durationArg.split('=')[1], 10) : 30;

  console.log('🔧 Config:', { url: config.supabaseUrl, usingDefaults: config.isUsingDefaultCredentials() });
  console.log('📡 Subscribing to realtime pool candles', { id, interval, maxMessages, seconds });

  const dl = new DataLayer();
  const channel = createSupabaseCandlesChannel();
  dl.registerChannel(channel);

  let count = 0;
  const deadline = Date.now() + seconds * 1000;

  try {
    for await (const evt of dl.subscribe(CANDLES_TOPIC, { id, interval })) {
      console.log('→', evt);
      if (evt?.step === 'update') count++;
      if (count >= maxMessages) {
        console.log(`✅ Received ${count} updates; exiting.`);
        break;
      }
      if (Date.now() > deadline) {
        console.log(`⏱️  Time limit reached (${seconds}s); exiting.`);
        break;
      }
    }
  } catch (err) {
    console.error('💥 Error while streaming:', err.message);
  }

  console.log('👋 Done.');
}

main();

