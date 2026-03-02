#!/usr/bin/env node
/**
 * Export Companies from Supabase for Organization Creation
 * 
 * This script fetches companies from the Supabase database and exports them
 * in a JSON format ready for creating organizations in the CLI.
 * 
 * Usage: node scripts/export-supabase-companies.js
 * Output: companies_for_orgs.json
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import 'dotenv/config';

// Supabase config - uses NEXT_PUBLIC env vars from .env
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function main() {
    console.log('🔌 Connecting to Supabase...');
    console.log(`   URL: ${SUPABASE_URL}`);

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env');
        process.exit(1);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    console.log('📦 Fetching companies from "company" table...');

    // Use 'company' table (singular) - matching CompaniesDataTransformer.jsx
    const { data: companies, error } = await supabase
        .from('company')
        .select('*')
        .order('name', { ascending: true });

    if (error) {
        console.error('❌ Error fetching companies:', error.message);
        process.exit(1);
    }

    console.log(`✅ Found ${companies.length} companies\n`);

    // Format for organization creation
    const orgsForCreation = companies.map(company => {
        const metadata = company.metadata || {};

        return {
            // Fields for createOrganization (matching ABI)
            companyName: company.name || '',
            description: company.description || '',
            metadata: JSON.stringify({
                ticker: metadata.ticker || '',
                logoUrl: metadata.logo || company.logo || '',
                backgroundImage: metadata.background_image || '',
                website: metadata.website || '',
                colors: metadata.colors || {},
                supabaseId: company.id
            }),
            metadataURI: '',

            // Reference info (not used in creation, just for reference)
            _ref: {
                supabaseId: company.id,
                slug: company.slug,
                status: company.status,
                currencyToken: company.currency_token || metadata.currency_token,
                rawMetadata: metadata
            }
        };
    });

    // Save to file
    const outputFile = 'companies_for_orgs.json';
    fs.writeFileSync(outputFile, JSON.stringify(orgsForCreation, null, 2));

    console.log(`📄 Saved to: ${outputFile}\n`);

    // Also print a summary
    console.log('╭────────────────────────────────────────────────────────────');
    console.log('│ COMPANIES READY FOR ORG CREATION');
    console.log('├────────────────────────────────────────────────────────────');

    for (const org of orgsForCreation) {
        console.log(`│`);
        console.log(`│ 📦 ${org.companyName}`);
        console.log(`│    Description: ${org.description || '(none)'}`);
        console.log(`│    Ticker: ${org._ref.ticker || '(none)'}`);
    }

    console.log('╰────────────────────────────────────────────────────────────\n');

    console.log('💡 To create an org, copy/paste these values in the CLI:');
    console.log('   node cli.js → Create Organization\n');
}

main().catch(console.error);
