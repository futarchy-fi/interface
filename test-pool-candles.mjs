import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nvhqdqtlsdboctqjcelq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52aHFkcXRsc2Rib2N0cWpjZWxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIxNDU3ODEsImV4cCI6MjA1NzcyMTc4MX0.6kjpxGVqSQNMz3DqycuNPv_ug8sdBNKeJsN0Z3X7oLg';

const supabase = createClient(supabaseUrl, supabaseKey);

const POOLS = {
  yesCompanyPool: '0xE0717A77a871942076E43226c2474FD20062Ad34',
  noCompanyPool: '0xabD38E58c3AF10255b7A822E077806b7b262ED88',
  spotPool: '0xd1d7fa8871d84d0e77020fc28b7cd5718c446522'
};

const INTERVAL = '3600000'; // 1 hour

async function fetchAllCandles(poolAddress, poolName) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Fetching ALL candles for ${poolName}: ${poolAddress}`);
  console.log('='.repeat(80));

  try {
    const { data, error, count } = await supabase
      .from('pool_candles')
      .select('timestamp, price', { count: 'exact' })
      .eq('address', poolAddress)
      .eq('interval', INTERVAL)
      .order('timestamp', { ascending: true }); // Get oldest first

    if (error) {
      console.error(`Error fetching ${poolName}:`, error);
      return;
    }

    console.log(`\nTotal candles found: ${data?.length || 0}`);

    if (data && data.length > 0) {
      // Find where prices change
      const priceChanges = [];
      let lastPrice = null;

      data.forEach((candle, index) => {
        if (lastPrice === null || candle.price !== lastPrice) {
          priceChanges.push({
            index,
            timestamp: candle.timestamp,
            date: new Date(candle.timestamp * 1000).toISOString(),
            price: candle.price,
            change: lastPrice ? ((candle.price - lastPrice) / lastPrice * 100).toFixed(4) + '%' : 'Initial'
          });
          lastPrice = candle.price;
        }
      });

      console.log(`\nPrice changes detected: ${priceChanges.length}`);
      console.log('\nFirst 10 candles:');
      data.slice(0, 10).forEach((candle, i) => {
        console.log(`  ${i}: ${new Date(candle.timestamp * 1000).toISOString()} - ${candle.price}`);
      });

      console.log(`\nLast 10 candles:`);
      data.slice(-10).forEach((candle, i) => {
        console.log(`  ${data.length - 10 + i}: ${new Date(candle.timestamp * 1000).toISOString()} - ${candle.price}`);
      });

      console.log(`\nAll price changes:`);
      priceChanges.forEach(change => {
        console.log(`  Index ${change.index}: ${change.date} - Price: ${change.price} (${change.change})`);
      });

      // Check if last N candles are identical
      const last50Prices = data.slice(-50).map(d => d.price);
      const allSame = last50Prices.every(p => p === last50Prices[0]);
      console.log(`\nLast 50 candles all same price? ${allSame ? 'YES ⚠️' : 'NO ✓'}`);

      if (allSame) {
        // Find the last time the price changed
        const lastChange = priceChanges[priceChanges.length - 1];
        console.log(`\n⚠️ Market appears CLOSED - Price has been flat since:`);
        console.log(`   ${lastChange.date} (index ${lastChange.index})`);
        console.log(`   Active period: indices 0 to ${lastChange.index}`);
        console.log(`   Frozen period: indices ${lastChange.index} to ${data.length - 1}`);
      }

      return {
        poolName,
        poolAddress,
        totalCandles: data.length,
        firstTimestamp: data[0].timestamp,
        lastTimestamp: data[data.length - 1].timestamp,
        priceChanges: priceChanges.length,
        isFlat: allSame,
        lastActiveIndex: priceChanges[priceChanges.length - 1]?.index || 0,
        allData: data
      };
    }
  } catch (err) {
    console.error(`Exception for ${poolName}:`, err);
  }
}

async function main() {
  console.log('Starting pool candle analysis...\n');
  console.log(`Interval: ${INTERVAL} (${INTERVAL === '3600000' ? '1 hour' : INTERVAL})`);

  const results = {};

  // Fetch all pools
  for (const [key, address] of Object.entries(POOLS)) {
    const result = await fetchAllCandles(address, key);
    if (result) {
      results[key] = result;
    }
  }

  // Summary comparison
  console.log(`\n\n${'='.repeat(80)}`);
  console.log('SUMMARY COMPARISON');
  console.log('='.repeat(80));

  Object.values(results).forEach(result => {
    console.log(`\n${result.poolName}:`);
    console.log(`  Total candles: ${result.totalCandles}`);
    console.log(`  Date range: ${new Date(result.firstTimestamp * 1000).toISOString()} to ${new Date(result.lastTimestamp * 1000).toISOString()}`);
    console.log(`  Price changes: ${result.priceChanges}`);
    console.log(`  Status: ${result.isFlat ? '⚠️ FLAT (Market Closed)' : '✓ Active'}`);
    if (result.isFlat) {
      console.log(`  Last active candle: index ${result.lastActiveIndex}`);
    }
  });

  // Check timestamp overlap
  if (Object.keys(results).length >= 2) {
    console.log(`\n\nTIMESTAMP OVERLAP ANALYSIS:`);
    console.log('='.repeat(80));

    const timestamps = {};
    Object.entries(results).forEach(([name, result]) => {
      timestamps[name] = new Set(result.allData.map(d => d.timestamp));
    });

    // Find common timestamps between pools
    const poolNames = Object.keys(timestamps);
    for (let i = 0; i < poolNames.length; i++) {
      for (let j = i + 1; j < poolNames.length; j++) {
        const pool1 = poolNames[i];
        const pool2 = poolNames[j];
        const common = [...timestamps[pool1]].filter(t => timestamps[pool2].has(t));
        console.log(`\n${pool1} ∩ ${pool2}: ${common.length} overlapping timestamps`);

        if (common.length === 0) {
          console.log(`  ⚠️ NO OVERLAP! This will cause cropSpot filtering issues.`);
          console.log(`  ${pool1} range: ${new Date(results[pool1].firstTimestamp * 1000).toISOString()} - ${new Date(results[pool1].lastTimestamp * 1000).toISOString()}`);
          console.log(`  ${pool2} range: ${new Date(results[pool2].firstTimestamp * 1000).toISOString()} - ${new Date(results[pool2].lastTimestamp * 1000).toISOString()}`);
        }
      }
    }
  }
}

main().catch(console.error);
