const fs = require('fs');
const axios = require('axios');
const path = require('path');

// Load environment variables
require('dotenv').config();

// Configuration from environment variables or defaults
const API_BASE_URL = process.env.POOL_CREATION_URL || 'http://localhost:8000/api/v1/pools/create_pool';
// Check for JWT field first (your .env format), then fallback to BEARER_TOKEN
const BEARER_TOKEN = process.env.JWT || process.env.BEARER_TOKEN || '';
const OUTPUT_DIR = './output';

// Function to find pool files for a specific proposal
function findPoolFilesForProposal(proposalAddress) {
  if (!fs.existsSync(OUTPUT_DIR)) {
    throw new Error('Output directory not found. Run generate-pools first.');
  }
  
  // Extract address without 0x prefix
  const addressWithout0x = proposalAddress.startsWith('0x') ? proposalAddress.substring(2) : proposalAddress;
  
  const files = fs.readdirSync(OUTPUT_DIR)
    .filter(file => {
      // Match files with the proposal address in the name
      return file.startsWith(`futarchy-0x${addressWithout0x}`) && 
             file.includes('-pool-') && 
             file.endsWith('.json');
    })
    .sort(); // Sort by filename to maintain order
  
  if (files.length === 0) {
    // Try with partial address (first 6 chars) for backward compatibility
    const shortAddress = addressWithout0x.substring(0, 6);
    const fallbackFiles = fs.readdirSync(OUTPUT_DIR)
      .filter(file => {
        return file.startsWith(`futarchy-0x${shortAddress}`) && 
               file.includes('-pool-') && 
               file.endsWith('.json');
      })
      .sort();
    
    if (fallbackFiles.length === 0) {
      throw new Error(`No pool files found for proposal ${proposalAddress}. Available files: ${fs.readdirSync(OUTPUT_DIR).join(', ')}`);
    }
    
    console.log(`⚠️  Using partial address match (backward compatibility)`);
    return fallbackFiles.map(file => path.join(OUTPUT_DIR, file));
  }
  
  return files.map(file => path.join(OUTPUT_DIR, file));
}

// Function to make API call for a single pool
async function callPoolAPI(poolFile, index) {
  try {
    const data = JSON.parse(fs.readFileSync(poolFile, 'utf8'));
    
    console.log(`\n────────────────────────────────`);
    console.log(`POOL ${index + 1} – ${data.payload.metadata?.name || 'Unknown Pool'}`);
    console.log(`────────────────────────────────`);
    console.log(`📁 File: ${path.basename(poolFile)}`);
    console.log(`📍 Address: ${data.payload.address}`);
    console.log(`🔢 Inverted Slot: ${data.payload.inverted_slot}`);
    console.log(`📋 Type: ${data.payload.type}`);
    
    // Debug: Show the URL and headers
    console.log(`\n🌐 DEBUG: REQUEST DETAILS`);
    console.log(`URL: ${API_BASE_URL}`);
    
    // Prepare headers
    const headers = {
      'Content-Type': 'application/json',
    };
    
    // Add Bearer token if provided and not empty
    if (BEARER_TOKEN && BEARER_TOKEN.trim()) {
      headers['Authorization'] = `Bearer ${BEARER_TOKEN.trim()}`;
      console.log(`🔐 Authorization: Bearer ${BEARER_TOKEN.trim().substring(0, 10)}...`);
    } else {
      console.log(`🔐 Authorization: Not provided (JWT/BEARER_TOKEN empty or missing)`);
    }
    
    // Debug: Show complete request body
    console.log(`\n📦 REQUEST BODY:`);
    console.log(JSON.stringify(data.payload, null, 2));
    
    console.log(`\n🚀 Making API call...`);
    console.log(`⏰ Timeout set to 60 seconds (server may take time to process)`);
    
    const startTime = Date.now();
    const response = await axios.post(API_BASE_URL, data.payload, {
      headers,
      timeout: 60000, // 60 second timeout (increased from 10 seconds)
    });
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log(`\n✅ SUCCESS: Pool created successfully`);
    console.log(`⏰ Request took ${duration} seconds`);
    console.log(`📊 Response Status: ${response.status} ${response.statusText}`);
    console.log(`📋 Response Headers:`, response.headers);
    
    console.log(`\n📥 RESPONSE BODY:`);
    if (response.data) {
      console.log(JSON.stringify(response.data, null, 2));
    } else {
      console.log('(No response body)');
    }
    
    return { success: true, pool: data.payload.metadata?.name || 'Unknown', response: response.data };
    
  } catch (error) {
    console.log(`\n❌ ERROR: Failed to create pool`);
    
    if (error.response) {
      console.log(`📊 Response Status: ${error.response.status} ${error.response.statusText}`);
      console.log(`📋 Response Headers:`, error.response.headers);
      console.log(`\n📥 ERROR RESPONSE BODY:`);
      console.log(JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.log(`🌐 Network Error: ${error.message}`);
      console.log(`📡 Request was made but no response received`);
      console.log(`🔍 Request details:`, error.request);
    } else {
      console.log(`⚠️  Error: ${error.message}`);
    }
    
    return { success: false, pool: 'unknown', error: error.message };
  }
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  
  // Remove --dry-run from args to get proposal address
  const cleanArgs = args.filter(arg => arg !== '--dry-run');
  
  if (cleanArgs.length === 0) {
    console.error('❌ Error: Please provide a proposal address');
    console.log('\nUsage:');
    console.log('  npm run call-proposal-pools 0x8931595B426B9404CbF1E4804DE3A5897ea9cce4');
    console.log('  npm run call-proposal-pools-dry 0x8931595B426B9404CbF1E4804DE3A5897ea9cce4');
    console.log('  node call-pools-by-proposal.js 0x8931595B426B9404CbF1E4804DE3A5897ea9cce4 --dry-run');
    process.exit(1);
  }
  
  const proposalAddress = cleanArgs[0];
  
  console.log('🚀 Proposal-Specific Pool API Caller');
  console.log('====================================');
  console.log(`🎯 Proposal: ${proposalAddress}`);
  console.log(`📡 API URL: ${API_BASE_URL}`);
  console.log(`🔐 Bearer Token: ${(BEARER_TOKEN && BEARER_TOKEN.trim()) ? '***configured***' : 'not set (JWT field empty)'}`);
  
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No actual API calls will be made');
  }
  
  try {
    const poolFiles = findPoolFilesForProposal(proposalAddress);
    console.log(`\nFound ${poolFiles.length} pool files for this proposal:`);
    
    poolFiles.forEach((file, index) => {
      console.log(`  ${index + 1}. ${path.basename(file)}`);
    });
    
    if (dryRun) {
      console.log('\n🔍 DRY RUN: Showing what would be called...');
      poolFiles.forEach((file, index) => {
        const data = JSON.parse(fs.readFileSync(file, 'utf8'));
        console.log(`\n────────────────────────────────`);
        console.log(`POOL ${index + 1} – ${data.payload.metadata?.name || 'Unknown Pool'}`);
        console.log(`────────────────────────────────`);
        console.log(`Would call: ${API_BASE_URL}`);
        console.log(`Address: ${data.payload.address}`);
        console.log(`Inverted Slot: ${data.payload.inverted_slot}`);
      });
      return;
    }
    
    console.log('\n🌟 Starting API calls...');
    
    const results = [];
    
    for (let i = 0; i < poolFiles.length; i++) {
      const result = await callPoolAPI(poolFiles[i], i);
      results.push(result);
      
      // Add a small delay between requests
      if (i < poolFiles.length - 1) {
        console.log('⏳ Waiting 1 second before next request...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Summary
    console.log('\n\n📊 SUMMARY');
    console.log('==========');
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`🎯 Proposal: ${proposalAddress}`);
    console.log(`✅ Successful: ${successful}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📊 Total: ${results.length}`);
    
    if (failed > 0) {
      console.log('\n❌ Failed pools:');
      results.filter(r => !r.success).forEach((result, index) => {
        console.log(`  - ${result.pool}: ${result.error}`);
      });
    }
    
    console.log('\n🎉 Done!');
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('\n💥 Fatal error:', error.message);
    process.exit(1);
  });
} 