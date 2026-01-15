/**
 * Test script to check company vs companies table in Supabase
 */

const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://nvhqdqtlsdboctqjcelq.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseKey) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_ANON_KEY not found in environment');
  console.log('Please set it in .env.local file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testTables() {
  console.log('🔍 Testing Supabase company tables...\n');

  // Test 1: Try 'company' table (singular)
  console.log('1️⃣ Testing "company" table (singular)...');
  try {
    const { data: companyData, error: companyError } = await supabase
      .from('company')
      .select('*')
      .limit(5);

    if (companyError) {
      console.log(`❌ Error: ${companyError.message}`);
      console.log(`   Code: ${companyError.code}`);
    } else {
      console.log(`✅ "company" table exists!`);
      console.log(`   Rows found: ${companyData.length}`);
      if (companyData.length > 0) {
        console.log(`   Columns:`, Object.keys(companyData[0]));
        console.log(`   Sample data:`, JSON.stringify(companyData[0], null, 2));
      }
    }
  } catch (err) {
    console.log(`❌ Exception: ${err.message}`);
  }

  console.log('\n---\n');

  // Test 2: Try 'companies' table (plural)
  console.log('2️⃣ Testing "companies" table (plural)...');
  try {
    const { data: companiesData, error: companiesError } = await supabase
      .from('companies')
      .select('*')
      .limit(5);

    if (companiesError) {
      console.log(`❌ Error: ${companiesError.message}`);
      console.log(`   Code: ${companiesError.code}`);
    } else {
      console.log(`✅ "companies" table exists!`);
      console.log(`   Rows found: ${companiesData.length}`);
      if (companiesData.length > 0) {
        console.log(`   Columns:`, Object.keys(companiesData[0]));
        console.log(`   Sample data:`, JSON.stringify(companiesData[0], null, 2));
      }
    }
  } catch (err) {
    console.log(`❌ Exception: ${err.message}`);
  }

  console.log('\n---\n');

  // Test 3: Check market_event company_id values
  console.log('3️⃣ Checking company_id values in market_event...');
  try {
    const { data: marketEvents, error: marketError } = await supabase
      .from('market_event')
      .select('company_id')
      .limit(10);

    if (marketError) {
      console.log(`❌ Error: ${marketError.message}`);
    } else {
      console.log(`✅ market_event table accessible`);
      const companyIds = [...new Set(marketEvents.map(e => e.company_id))].filter(id => id);
      console.log(`   Unique company_id values:`, companyIds);
      console.log(`   Type of company_id:`, typeof marketEvents[0]?.company_id);
    }
  } catch (err) {
    console.log(`❌ Exception: ${err.message}`);
  }

  console.log('\n---\n');

  // Test 4: If company table exists, check if it has matching IDs
  console.log('4️⃣ Testing if company table has matching IDs...');
  try {
    const { data: companyRows, error } = await supabase
      .from('company')
      .select('id, name, metadata')
      .limit(10);

    if (!error && companyRows) {
      console.log(`✅ Found ${companyRows.length} rows in "company" table:`);
      companyRows.forEach(row => {
        console.log(`   - ID: ${row.id} | Name: ${row.name}`);
        if (row.metadata) {
          console.log(`     Metadata:`, JSON.stringify(row.metadata, null, 2));
        }
      });

      // Check if any market_event.company_id matches company.id
      console.log('\n   Checking if company_id matches...');
      const { data: marketEvents } = await supabase
        .from('market_event')
        .select('company_id')
        .in('company_id', companyRows.map(c => c.id))
        .limit(5);

      if (marketEvents && marketEvents.length > 0) {
        console.log(`   ✅ Found ${marketEvents.length} market_events matching company.id`);
      } else {
        console.log(`   ⚠️ No market_events match company.id`);
        console.log(`   💡 You might need to use company.metadata->>'company_id' instead`);
      }
    }
  } catch (err) {
    console.log(`   (Skipping - company table might not exist)`);
  }

  console.log('\n---\n');
  console.log('✅ Tests complete!\n');

  // Summary
  console.log('📋 SUMMARY:');
  console.log('Based on your Supabase screenshot, you likely have:');
  console.log('  - "company" table (singular) with UUID ids');
  console.log('  - "market_event" table with integer company_id (9, 10, 11, 12)');
  console.log('\nThe issue: company.id (UUID) ≠ market_event.company_id (integer)');
  console.log('\nSolution: Store integer company_id in company.metadata JSON');
}

testTables().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
