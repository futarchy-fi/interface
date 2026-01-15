/**
 * Test script to check market_event data and company_id associations
 */

const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://nvhqdqtlsdboctqjcelq.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseKey) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_ANON_KEY not found in environment');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testMarketEvents() {
  console.log('🔍 Testing market_event data and company associations...\n');

  try {
    // Test 1: Get all active proposals with KIP in title
    console.log('1️⃣ Testing KIP-81 proposal...');
    const { data: kipProposal, error: kipError } = await supabase
      .from('market_event')
      .select('*')
      .ilike('title', '%KIP-81%')
      .limit(5);

    if (kipError) throw kipError;

    if (kipProposal && kipProposal.length > 0) {
      console.log(`✅ Found ${kipProposal.length} KIP-81 proposal(s):\n`);
      kipProposal.forEach(p => {
        console.log(`   Title: ${p.title}`);
        console.log(`   Company ID: ${p.company_id}`);
        console.log(`   Status: ${p.approval_status}`);
        console.log(`   Metadata:`, JSON.stringify(p.metadata, null, 2));
        console.log('');
      });
    } else {
      console.log('⚠️ No KIP-81 proposals found');
    }

    console.log('---\n');

    // Test 2: Get all active proposals grouped by company_id
    console.log('2️⃣ Testing all active proposals by company...');
    const { data: activeProposals, error: activeError } = await supabase
      .from('market_event')
      .select('id, title, company_id, approval_status')
      .in('approval_status', ['ongoing', 'on_going']);

    if (activeError) throw activeError;

    // Group by company_id
    const byCompany = {};
    activeProposals.forEach(p => {
      if (!byCompany[p.company_id]) {
        byCompany[p.company_id] = [];
      }
      byCompany[p.company_id].push(p);
    });

    console.log(`✅ Found ${activeProposals.length} active proposals:\n`);
    Object.keys(byCompany).sort().forEach(companyId => {
      console.log(`   Company ID ${companyId}:`);
      byCompany[companyId].forEach(p => {
        console.log(`     - ${p.title}`);
      });
      console.log('');
    });

    console.log('---\n');

    // Test 3: Check if company table has matching data
    console.log('3️⃣ Cross-checking with company table...');
    const { data: companies, error: compError } = await supabase
      .from('company')
      .select('id, name, logo, metadata')
      .in('id', Object.keys(byCompany));

    if (compError) throw compError;

    console.log('✅ Company data:\n');
    companies.forEach(c => {
      const proposalCount = byCompany[c.id]?.length || 0;
      console.log(`   ID ${c.id}: ${c.name}`);
      console.log(`      Logo: ${c.logo || '❌ MISSING'}`);
      console.log(`      Background: ${c.metadata?.background_image || '❌ MISSING'}`);
      console.log(`      Active proposals: ${proposalCount}`);
      console.log('');
    });

    console.log('---\n');

    // Test 4: Verify specific proposal company_id
    console.log('4️⃣ Verifying PNK/KIP-81 proposal company_id...');
    const { data: pnkProposal, error: pnkError } = await supabase
      .from('market_event')
      .select('*')
      .ilike('title', '%PNK%')
      .in('approval_status', ['ongoing', 'on_going'])
      .limit(5);

    if (pnkError) throw pnkError;

    if (pnkProposal && pnkProposal.length > 0) {
      console.log(`✅ Found ${pnkProposal.length} PNK proposal(s):\n`);
      pnkProposal.forEach(p => {
        const expectedCompanyId = 10; // Kleros
        const isCorrect = p.company_id === expectedCompanyId;

        console.log(`   Title: ${p.title}`);
        console.log(`   Company ID: ${p.company_id} ${isCorrect ? '✅ CORRECT (Kleros)' : '❌ WRONG (should be 10 for Kleros)'}`);
        console.log(`   Status: ${p.approval_status}`);
        console.log('');
      });
    } else {
      console.log('⚠️ No PNK proposals found');
    }

    console.log('---\n');

    // Test 5: Show summary
    console.log('📋 SUMMARY:\n');
    console.log('Expected company_id mappings:');
    console.log('   9  = Gnosis DAO');
    console.log('   10 = Kleros DAO (PNK, KIP proposals)');
    console.log('   11 = Tesla (TSLA)');
    console.log('   12 = Starbucks (SBUX)');
    console.log('');
    console.log('Actual proposals:');
    Object.keys(byCompany).sort().forEach(companyId => {
      const count = byCompany[companyId].length;
      const companyName = companies.find(c => c.id == companyId)?.name || 'Unknown';
      console.log(`   ${companyId} (${companyName}): ${count} active proposals`);
    });

    console.log('\n✅ Tests complete!\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

// Run tests
testMarketEvents();
