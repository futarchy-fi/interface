import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nvhqdqtlsdboctqjcelq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52aHFkcXRsc2Rib2N0cWpjZWxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIxNDU3ODEsImV4cCI6MjA1NzcyMTc4MX0.6kjpxGVqSQNMz3DqycuNPv_ug8sdBNKeJsN0Z3X7oLg';

const supabase = createClient(supabaseUrl, supabaseKey);

const POOL = '0xf811dc52684e828f52bbbb61d1e9a00eE7d185e1'; // YES pool
const INTERVAL = '3600000';

async function fetchAllPaginated(poolAddress) {
  console.log('Fetching ALL candles with pagination...\n');

  let allData = [];
  let offset = 0;
  const limit = 1000; // Max per request
  let hasMore = true;

  while (hasMore) {
    console.log(`Fetching batch: offset=${offset}, limit=${limit}`);

    const { data, error, count } = await supabase
      .from('pool_candles')
      .select('timestamp, price', { count: 'exact' })
      .eq('address', poolAddress)
      .eq('interval', INTERVAL)
      .order('timestamp', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error:', error);
      break;
    }

    console.log(`  Received: ${data?.length || 0} candles`);
    console.log(`  Total in DB: ${count}`);

    if (data && data.length > 0) {
      allData = allData.concat(data);
      offset += data.length;

      // Check if we got less than limit (meaning we reached the end)
      if (data.length < limit) {
        hasMore = false;
        console.log('  Reached end of data\n');
      }
    } else {
      hasMore = false;
    }

    // Safety limit to prevent infinite loop
    if (allData.length >= 10000) {
      console.log('  Safety limit reached (10000 candles)');
      break;
    }
  }

  console.log(`\nTotal fetched: ${allData.length} candles`);

  // Convert to chronological order
  const chronological = allData.slice().reverse();

  console.log(`First: ${new Date(chronological[0].timestamp * 1000).toISOString()} - ${chronological[0].price}`);
  console.log(`Last: ${new Date(chronological[chronological.length - 1].timestamp * 1000).toISOString()} - ${chronological[chronological.length - 1].price}`);

  // Check for duplicates
  const uniqueTimestamps = new Set(chronological.map(d => d.timestamp));
  console.log(`Unique timestamps: ${uniqueTimestamps.size}`);

  // Detect flat period
  let flatCount = 1;
  const lastPrice = chronological[chronological.length - 1].price;
  for (let i = chronological.length - 2; i >= 0; i--) {
    if (Math.abs(chronological[i].price - lastPrice) < 0.0001) {
      flatCount++;
    } else {
      break;
    }
  }

  console.log(`\nFlat candles at end: ${flatCount} (price: ${lastPrice})`);
  console.log(`Active candles: ${chronological.length - flatCount}`);

  return chronological;
}

fetchAllPaginated(POOL).catch(console.error);
