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

// Function to find all pool files
function findPoolFiles() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    throw new Error('Output directory not found. Run generate-pools first.');
  }
  
  const files = fs.readdirSync(OUTPUT_DIR)
    .filter(file => file.startsWith('futarchy-') && file.includes('-pool-') && file.endsWith('.json'))
    .sort(); // Sort by filename to maintain order
  
  if (files.length === 0) {
    throw new Error('No pool files found. Run generate-pools first.');
  }
  
  return files.map(file => path.join(OUTPUT_DIR, file));
}

// Function to make API call for a single pool
async function callPoolAPI(poolFile, index) {
  try {
    const data = JSON.parse(fs.readFileSync(poolFile, 'utf8'));
    
    console.log(`\n────────────────────────────────`);
    console.log(`POOL ${index + 1} – ${data.payload.metadata.name}`);
    console.log(`────────────────────────────────`);
    console.log(`Address: ${data.payload.address}`);
    console.log(`Inverted Slot: ${data.payload.inverted_slot}`);
    
    // Prepare headers
    const headers = {
      'Content-Type': 'application/json',
    };
    
    // Add Bearer token if provided and not empty
    if (BEARER_TOKEN && BEARER_TOKEN.trim()) {
      headers['Authorization'] = `Bearer ${BEARER_TOKEN.trim()}`;
    }
    
    const response = await axios.post(API_BASE_URL, data.payload, {
      headers,
      timeout: 10000, // 10 second timeout
    });
    
    console.log(`✅ SUCCESS: Pool created successfully`);
    console.log(`Response status: ${response.status}`);
    
    if (response.data) {
      console.log(`Response data:`, JSON.stringify(response.data, null, 2));
    }
    
    return { success: true, pool: data.payload.metadata.name, response: response.data };
    
  } catch (error) {
    console.log(`❌ ERROR: Failed to create pool`);
    
    if (error.response) {
      console.log(`Status: ${error.response.status}`);
      console.log(`Error:`, error.response.data);
    } else if (error.request) {
      console.log(`Network error: ${error.message}`);
    } else {
      console.log(`Error: ${error.message}`);
    }
    
    return { success: false, pool: 'unknown', error: error.message };
  }
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  
  console.log('🚀 Pool API Caller');
  console.log('==================');
  console.log(`📡 API URL: ${API_BASE_URL}`);
  console.log(`🔐 Bearer Token: ${(BEARER_TOKEN && BEARER_TOKEN.trim()) ? '***configured***' : 'not set (JWT field empty)'}`);
  
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No actual API calls will be made');
  }
  
  const poolFiles = findPoolFiles();
  console.log(`\nFound ${poolFiles.length} pool files to process:`);
  
  poolFiles.forEach((file, index) => {
    console.log(`  ${index + 1}. ${path.basename(file)}`);
  });
  
  if (dryRun) {
    console.log('\n🔍 DRY RUN: Showing what would be called...');
    poolFiles.forEach((file, index) => {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      console.log(`\n────────────────────────────────`);
      console.log(`POOL ${index + 1} – ${data.payload.metadata.name}`);
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
    
    // Add a small delay between requests to be nice to the API
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
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('\n💥 Fatal error:', error.message);
    process.exit(1);
  });
} 