/**
 * Explore Supabase Table Structures
 * 
 * Usage: node explore-supabase-structure.js
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://nvhqdqtlsdboctqjcelq.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseKey) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_ANON_KEY not found in environment');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function exploreTable(tableName, limit = 3) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 TABLE: ${tableName}`);
    console.log('='.repeat(60));

    try {
        const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .limit(limit);

        if (error) {
            console.log(`❌ Error: ${error.message}`);
            return null;
        }

        if (!data || data.length === 0) {
            console.log('⚠️ No rows found');
            return null;
        }

        // Show columns
        const columns = Object.keys(data[0]);
        console.log(`\n📋 Columns (${columns.length}):`);
        columns.forEach(col => {
            const sampleValue = data[0][col];
            const type = sampleValue === null ? 'null' : typeof sampleValue;
            const preview = type === 'object' ? JSON.stringify(sampleValue).slice(0, 50) + '...' : String(sampleValue).slice(0, 50);
            console.log(`   • ${col}: ${type} → ${preview}`);
        });

        // Show sample rows
        console.log(`\n📄 Sample Rows (${data.length}):`);
        data.forEach((row, i) => {
            console.log(`\n--- Row ${i + 1} ---`);
            console.log(JSON.stringify(row, null, 2));
        });

        return data;
    } catch (err) {
        console.log(`❌ Exception: ${err.message}`);
        return null;
    }
}

async function main() {
    console.log('🔍 Exploring Supabase Table Structures\n');
    console.log(`URL: ${supabaseUrl}`);
    console.log(`Time: ${new Date().toISOString()}`);

    // Explore company table
    await exploreTable('company', 3);

    // Explore market_event table
    await exploreTable('market_event', 3);

    // Get unique company_ids from market_event
    console.log(`\n${'='.repeat(60)}`);
    console.log('🔗 RELATIONSHIP: market_event.company_id → company.id');
    console.log('='.repeat(60));

    const { data: companyIds } = await supabase
        .from('market_event')
        .select('company_id')
        .not('company_id', 'is', null);

    if (companyIds) {
        const uniqueIds = [...new Set(companyIds.map(e => e.company_id))].sort();
        console.log(`\nUnique company_id values in market_event: ${uniqueIds.join(', ')}`);
    }

    // Get all companies
    const { data: companies } = await supabase
        .from('company')
        .select('id, name, status');

    if (companies) {
        console.log('\nCompanies in company table:');
        companies.forEach(c => {
            console.log(`   • ID: ${c.id} | Name: ${c.name} | Status: ${c.status}`);
        });
    }

    // Count market events per company
    console.log(`\n${'='.repeat(60)}`);
    console.log('📈 MARKET EVENTS PER COMPANY');
    console.log('='.repeat(60));

    if (companies) {
        for (const company of companies) {
            const { count } = await supabase
                .from('market_event')
                .select('*', { count: 'exact', head: true })
                .eq('company_id', company.id);

            const { count: activeCount } = await supabase
                .from('market_event')
                .select('*', { count: 'exact', head: true })
                .eq('company_id', company.id)
                .in('approval_status', ['ongoing', 'on_going']);

            console.log(`   ${company.name} (ID: ${company.id}): ${count || 0} total, ${activeCount || 0} active`);
        }
    }

    console.log('\n✅ Exploration complete!');
}

main().catch(console.error);
