#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import dotenv from 'dotenv';

dotenv.config();

async function testAllProposals() {
    console.log(chalk.cyan.bold('\n🔍 Fetching ALL proposals from Supabase\n'));
    
    const supabaseUrl = process.env.SUPABASE_URL || 'https://nvhqdqtlsdboctqjcelq.supabase.co';
    const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52aHFkcXRsc2Rib2N0cWpjZWxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIxNDU3ODEsImV4cCI6MjA1NzcyMTc4MX0.6kjpxGVqSQNMz3DqycuNPv_ug8sdBNKeJsN0Z3X7oLg';
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    try {
        // Get total count first
        const { count, error: countError } = await supabase
            .from('market_event')
            .select('*', { count: 'exact', head: true });
            
        if (countError) {
            throw countError;
        }
        
        console.log(chalk.yellow(`Total proposals in database: ${chalk.bold(count)}\n`));
        
        // Now fetch all with no filters
        const { data, error } = await supabase
            .from('market_event')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1000); // Very high limit to get everything
            
        if (error) {
            throw error;
        }
        
        console.log(chalk.green(`Actually fetched: ${data.length} proposals\n`));
        
        // Group by status
        const byStatus = {};
        const byVisibility = {};
        const byResolution = {};
        
        data.forEach(proposal => {
            // Count by event_status
            byStatus[proposal.event_status] = (byStatus[proposal.event_status] || 0) + 1;
            
            // Count by visibility
            byVisibility[proposal.visibility] = (byVisibility[proposal.visibility] || 0) + 1;
            
            // Count by resolution_status
            byResolution[proposal.resolution_status] = (byResolution[proposal.resolution_status] || 0) + 1;
        });
        
        console.log(chalk.cyan('By Event Status:'));
        Object.entries(byStatus).forEach(([status, count]) => {
            console.log(chalk.gray(`  ${status}: ${count}`));
        });
        
        console.log(chalk.cyan('\nBy Visibility:'));
        Object.entries(byVisibility).forEach(([visibility, count]) => {
            console.log(chalk.gray(`  ${visibility}: ${count}`));
        });
        
        console.log(chalk.cyan('\nBy Resolution Status:'));
        Object.entries(byResolution).forEach(([status, count]) => {
            console.log(chalk.gray(`  ${status}: ${count}`));
        });
        
        // Show first few proposals
        console.log(chalk.cyan('\nFirst 5 proposals:'));
        data.slice(0, 5).forEach((proposal, i) => {
            console.log(chalk.gray(`${i + 1}. ${proposal.title.substring(0, 60)}...`));
            console.log(chalk.gray(`   ID: ${proposal.id}`));
            console.log(chalk.gray(`   Status: ${proposal.event_status} | Visibility: ${proposal.visibility}`));
        });
        
    } catch (error) {
        console.error(chalk.red('Error:'), error);
    }
}

testAllProposals();