const fs = require('fs');
const https = require('https');

// Supabase configuration
const SUPABASE_URL = 'https://nvhqdqtlsdboctqjcelq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52aHFkcXRsc2Rib2N0cWpjZWxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIxNDU3ODEsImV4cCI6MjA1NzcyMTc4MX0.6kjpxGVqSQNMz3DqycuNPv_ug8sdBNKeJsN0Z3X7oLg';

// Function to clean text of all known problematic characters
function cleanText(text) {
  if (typeof text !== 'string') {
    return text;
  }
  return text
    // Replace different kinds of apostrophes and quotes
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    // Replace various dash and hyphen characters
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015]/g, '-')
    // Replace various space characters with a standard space
    .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
    // Remove other non-standard characters (including control characters but preserving essentials)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '')
    // Remove Byte Order Mark
    .replace(/\uFEFF/g, '');
}

// Function to read and parse JSON file
function readJsonFile(filePath) {
  try {
    let fileContent = fs.readFileSync(filePath, 'utf8');

    // First, apply aggressive cleaning to the entire file content
    let cleanedContent = cleanText(fileContent);

    // Remove any leading text/junk before the first '{'
    const jsonStart = cleanedContent.indexOf('{');
    if (jsonStart === -1) {
      throw new Error('No JSON object found in file.');
    }
    cleanedContent = cleanedContent.substring(jsonStart);

    // Remove any trailing text/junk after the last '}'
    const jsonEnd = cleanedContent.lastIndexOf('}');
    if (jsonEnd === -1) {
      throw new Error('JSON object is not properly closed.');
    }
    cleanedContent = cleanedContent.substring(0, jsonEnd + 1);

    // At this point, the string should be valid JSON.
    return JSON.parse(cleanedContent);

  } catch (error) {
    console.error(`Error processing file: ${filePath}`);
    console.error('Error message:', error.message);
    
    // Provide more debugging information
    try {
      const rawData = fs.readFileSync(filePath, 'utf8');
      console.error('\n--- Raw File Content (first 300 chars) ---');
      console.error(rawData.substring(0, 300) + '...');
      const errorPosMatch = error.message.match(/position (\d+)/);
      if (errorPosMatch) {
        const pos = parseInt(errorPosMatch[1], 10);
        console.error(`\n--- Characters around error position ${pos} ---`);
        const snippet = rawData.substring(Math.max(0, pos - 20), pos + 20);
        console.error(`Snippet: "${snippet}"`);
        for (let i = 0; i < snippet.length; i++) {
            const char = snippet[i];
            const code = snippet.charCodeAt(i);
            console.error(`  - Char '${char}' (Code: ${code}) at position ${Math.max(0, pos - 20) + i}`);
        }
      }
    } catch (debugError) {
      console.error('Could not read file for debugging.', debugError);
    }
    
    return null;
  }
}

// Function to send data to Supabase edge function
function sendToSupabase(data, edgeFunctionName = 'pools-create') {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: 'nvhqdqtlsdboctqjcelq.supabase.co',
      port: 443,
      path: `/functions/v1/${edgeFunctionName}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        console.log('Response Status:', res.statusCode);
        console.log('Response Headers:', res.headers);
        console.log('Response Body:', responseData);
        
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({
            statusCode: res.statusCode,
            data: responseData
          });
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error('Request error:', error);
      reject(error);
    });

    // Write data to request body
    req.write(postData);
    req.end();
  });
}

// Alternative function using fetch (if you prefer modern approach)
async function sendToSupabaseFetch(data, edgeFunctionName = 'pools-create') {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/${edgeFunctionName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify(data)
    });

    const responseData = await response.text();
    
    console.log('Response Status:', response.status);
    console.log('Response Body:', responseData);
    
    if (response.ok) {
      return {
        statusCode: response.status,
        data: responseData
      };
    } else {
      throw new Error(`HTTP ${response.status}: ${responseData}`);
    }
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const jsonFile = args[0] || 'request.json';
  const edgeFunction = args[1] || 'pools-create';
  
  console.log(`Reading JSON from: ${jsonFile}`);
  console.log(`Sending to edge function: ${edgeFunction}`);
  
  // Read the JSON file
  const jsonData = readJsonFile(jsonFile);
  
  if (!jsonData) {
    console.error('Failed to read or parse JSON file');
    process.exit(1);
  }
  
  console.log('JSON Data to send:', JSON.stringify(jsonData, null, 2));
  
  try {
    // Choose which method to use
    const useModernFetch = process.env.USE_FETCH === 'true';
    
    if (useModernFetch) {
      // Using fetch (requires Node.js 18+ or install node-fetch)
      const result = await sendToSupabaseFetch(jsonData, edgeFunction);
      console.log('✅ Successfully sent to Supabase:', result);
    } else {
      // Using native https module
      const result = await sendToSupabase(jsonData, edgeFunction);
      console.log('✅ Successfully sent to Supabase:', result);
    }
  } catch (error) {
    console.error('❌ Error sending to Supabase:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = {
  readJsonFile,
  sendToSupabase,
  sendToSupabaseFetch
}; 