import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nvhqdqtlsdboctqjcelq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52aHFkcXRsc2Rib2N0cWpjZWxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIxNDU3ODEsImV4cCI6MjA1NzcyMTc4MX0.6kjpxGVqSQNMz3DqycuNPv_ug8sdBNKeJsN0Z3X7oLg';

const supabase = createClient(supabaseUrl, supabaseKey);

const POOLS = {
  yes: '0xf811dc52684e828f52bbbb61d1e9a00eE7d185e1',
  no: '0x3a3a892F057e22d2B0F2fEdF3a77989d5eB365d5',
  spot: '0x2613cb099c12cecb1bd290fd0ef6833949374165'
};

const INTERVAL = '3600000'; // 1 hour

/**
 * Remove flat/duplicate candles from the end of the data
 */
const removeFlatTail = (data, maxDuplicates = 100) => {
  if (!data || data.length === 0) return data;

  let duplicateCount = 1;
  let lastPrice = data[data.length - 1].price;

  // Iterate backwards from the end
  for (let i = data.length - 2; i >= 0; i--) {
    if (Math.abs(data[i].price - lastPrice) < 0.0001) {
      duplicateCount++;
      if (duplicateCount > maxDuplicates) {
        // Found more than maxDuplicates - truncate here
        console.log(`[removeFlatTail] Detected ${duplicateCount} flat candles at price ${lastPrice}, truncating at index ${i + maxDuplicates}`);
        return data.slice(0, i + maxDuplicates + 1);
      }
    } else {
      // Price changed, reset counter
      duplicateCount = 1;
      lastPrice = data[i].price;
    }
  }

  return data; // No significant flat period found
};

async function fetchWithLimit500(poolAddress, poolName) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`[LIMIT 500] Fetching ${poolName}: ${poolAddress}`);
  console.log('='.repeat(80));

  const { data, error } = await supabase
    .from('pool_candles')
    .select('timestamp, price')
    .eq('address', poolAddress)
    .eq('interval', INTERVAL)
    .order('timestamp', { ascending: false })
    .limit(500);

  if (error) {
    console.error('Error:', error);
    return null;
  }

  // Reverse to chronological order
  const chronological = data.slice().reverse();

  console.log(`Total candles: ${chronological.length}`);
  console.log(`First: ${new Date(chronological[0].timestamp * 1000).toISOString()} - ${chronological[0].price}`);
  console.log(`Last: ${new Date(chronological[chronological.length - 1].timestamp * 1000).toISOString()} - ${chronological[chronological.length - 1].price}`);

  return chronological;
}

async function fetchAllAndFilter(poolAddress, poolName) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`[FETCH ALL + FILTER] Fetching ${poolName}: ${poolAddress}`);
  console.log('='.repeat(80));

  // Fetch ALL candles (no limit)
  const { data, error } = await supabase
    .from('pool_candles')
    .select('timestamp, price')
    .eq('address', poolAddress)
    .eq('interval', INTERVAL)
    .order('timestamp', { ascending: false });

  if (error) {
    console.error('Error:', error);
    return null;
  }

  // Reverse to chronological order
  const chronological = data.slice().reverse();

  console.log(`Total candles fetched: ${chronological.length}`);

  // Apply flat tail removal
  const filtered = removeFlatTail(chronological, 100);

  console.log(`After filtering: ${filtered.length} candles`);
  console.log(`Removed: ${chronological.length - filtered.length} flat candles`);
  console.log(`First: ${new Date(filtered[0].timestamp * 1000).toISOString()} - ${filtered[0].price}`);
  console.log(`Last: ${new Date(filtered[filtered.length - 1].timestamp * 1000).toISOString()} - ${filtered[filtered.length - 1].price}`);

  return filtered;
}

async function main() {
  console.log('COMPARISON TEST: LIMIT 500 vs FETCH ALL + FILTER\n');
  console.log(`Interval: ${INTERVAL} (1 hour)`);

  // Test YES pool
  console.log('\n\n' + '█'.repeat(80));
  console.log('YES POOL');
  console.log('█'.repeat(80));

  const yesLimit500 = await fetchWithLimit500(POOLS.yes, 'YES');
  const yesFiltered = await fetchAllAndFilter(POOLS.yes, 'YES');

  // Test NO pool
  console.log('\n\n' + '█'.repeat(80));
  console.log('NO POOL');
  console.log('█'.repeat(80));

  const noLimit500 = await fetchWithLimit500(POOLS.no, 'NO');
  const noFiltered = await fetchAllAndFilter(POOLS.no, 'NO');

  // Test SPOT pool
  console.log('\n\n' + '█'.repeat(80));
  console.log('SPOT POOL');
  console.log('█'.repeat(80));

  const spotLimit500 = await fetchWithLimit500(POOLS.spot, 'SPOT');
  const spotFiltered = await fetchAllAndFilter(POOLS.spot, 'SPOT');

  // Compare results
  console.log('\n\n' + '█'.repeat(80));
  console.log('COMPARISON SUMMARY');
  console.log('█'.repeat(80));

  console.log('\n--- YES POOL ---');
  console.log(`LIMIT 500: ${yesLimit500?.length} candles`);
  console.log(`  Range: ${new Date(yesLimit500?.[0]?.timestamp * 1000).toISOString()} to ${new Date(yesLimit500?.[yesLimit500.length - 1]?.timestamp * 1000).toISOString()}`);
  console.log(`FILTERED: ${yesFiltered?.length} candles`);
  console.log(`  Range: ${new Date(yesFiltered?.[0]?.timestamp * 1000).toISOString()} to ${new Date(yesFiltered?.[yesFiltered.length - 1]?.timestamp * 1000).toISOString()}`);
  console.log(`  Difference: ${(yesFiltered?.length || 0) - (yesLimit500?.length || 0)} candles`);

  console.log('\n--- NO POOL ---');
  console.log(`LIMIT 500: ${noLimit500?.length} candles`);
  console.log(`  Range: ${new Date(noLimit500?.[0]?.timestamp * 1000).toISOString()} to ${new Date(noLimit500?.[noLimit500.length - 1]?.timestamp * 1000).toISOString()}`);
  console.log(`FILTERED: ${noFiltered?.length} candles`);
  console.log(`  Range: ${new Date(noFiltered?.[0]?.timestamp * 1000).toISOString()} to ${new Date(noFiltered?.[noFiltered.length - 1]?.timestamp * 1000).toISOString()}`);
  console.log(`  Difference: ${(noFiltered?.length || 0) - (noLimit500?.length || 0)} candles`);

  console.log('\n--- SPOT POOL ---');
  console.log(`LIMIT 500: ${spotLimit500?.length} candles`);
  console.log(`  Range: ${new Date(spotLimit500?.[0]?.timestamp * 1000).toISOString()} to ${new Date(spotLimit500?.[spotLimit500.length - 1]?.timestamp * 1000).toISOString()}`);
  console.log(`FILTERED: ${spotFiltered?.length} candles`);
  console.log(`  Range: ${new Date(spotFiltered?.[0]?.timestamp * 1000).toISOString()} to ${new Date(spotFiltered?.[spotFiltered.length - 1]?.timestamp * 1000).toISOString()}`);
  console.log(`  Difference: ${(spotFiltered?.length || 0) - (spotLimit500?.length || 0)} candles`);

  // Check overlap
  console.log('\n--- TIMESTAMP OVERLAP ---');

  if (yesFiltered && noFiltered && spotFiltered) {
    const yesTimestamps = new Set(yesFiltered.map(d => d.timestamp));
    const noTimestamps = new Set(noFiltered.map(d => d.timestamp));
    const spotTimestamps = new Set(spotFiltered.map(d => d.timestamp));

    const yesNoOverlap = [...yesTimestamps].filter(t => noTimestamps.has(t)).length;
    const yesSpotOverlap = [...yesTimestamps].filter(t => spotTimestamps.has(t)).length;
    const noSpotOverlap = [...noTimestamps].filter(t => spotTimestamps.has(t)).length;

    console.log(`YES ∩ NO (FILTERED): ${yesNoOverlap} overlapping timestamps`);
    console.log(`YES ∩ SPOT (FILTERED): ${yesSpotOverlap} overlapping timestamps`);
    console.log(`NO ∩ SPOT (FILTERED): ${noSpotOverlap} overlapping timestamps`);
  }

  if (yesLimit500 && noLimit500 && spotLimit500) {
    const yesTimestamps = new Set(yesLimit500.map(d => d.timestamp));
    const noTimestamps = new Set(noLimit500.map(d => d.timestamp));
    const spotTimestamps = new Set(spotLimit500.map(d => d.timestamp));

    const yesNoOverlap = [...yesTimestamps].filter(t => noTimestamps.has(t)).length;
    const yesSpotOverlap = [...yesTimestamps].filter(t => spotTimestamps.has(t)).length;
    const noSpotOverlap = [...noTimestamps].filter(t => spotTimestamps.has(t)).length;

    console.log(`YES ∩ NO (LIMIT 500): ${yesNoOverlap} overlapping timestamps`);
    console.log(`YES ∩ SPOT (LIMIT 500): ${yesSpotOverlap} overlapping timestamps`);
    console.log(`NO ∩ SPOT (LIMIT 500): ${noSpotOverlap} overlapping timestamps`);
  }
}

main().catch(console.error);
