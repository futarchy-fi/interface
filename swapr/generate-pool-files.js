const fs = require('fs');
const path = require('path');

// Function to read config from futarchy-config.json
function getConfigData() {
  const configPath = './futarchy-config.json';
  if (fs.existsSync(configPath)) {
    try {
      const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return {
        companyId: configData.companyId || null,
        companySymbol: configData.companyToken?.symbol || 'GNO',
        currencySymbol: configData.currencyToken?.symbol || 'sDAI'
      };
    } catch (error) {
      console.warn('Warning: Could not parse futarchy-config.json, proceeding with defaults');
      return {
        companyId: null,
        companySymbol: 'GNO',
        currencySymbol: 'sDAI'
      };
    }
  }
  return {
    companyId: null,
    companySymbol: 'GNO',
    currencySymbol: 'sDAI'
  };
}

// Function to find the latest futarchy-pool-setup file
function findLatestFutarchyFile() {
  const currentDir = './';
  if (!fs.existsSync(currentDir)) {
    throw new Error('Current directory not found');
  }
  
  const files = fs.readdirSync(currentDir)
    .filter(file => file.startsWith('futarchy-pool-setup-') && file.endsWith('.json'))
    .sort((a, b) => {
      // Extract timestamp from filename and sort by newest first
      const timestampA = a.match(/futarchy-pool-setup-(.+)\.json$/)?.[1];
      const timestampB = b.match(/futarchy-pool-setup-(.+)\.json$/)?.[1];
      return timestampB.localeCompare(timestampA);
    });
  
  if (files.length === 0) {
    throw new Error('No futarchy-pool-setup files found');
  }
  
  return files[0];
}

// Function to convert small decimal to integer string (for token amounts)
function convertToTokenAmount(decimalString, decimals = 18) {
  const num = parseFloat(decimalString);
  const multiplier = Math.pow(10, decimals);
  return Math.floor(num * multiplier).toString();
}

// Function to generate pool file
function generatePoolFile(poolData, proposalData, poolIndex, allPools, companyId = null, config = null) {
  // Use full address instead of just first 6 chars
  const proposalAddressShort = proposalData.proposalAddress.substring(2);
  
  // Convert deposited liquidity to reserves - keep as decimal strings for first pool
  let token0Reserve = "0";
  let token1Reserve = "0";
  
  if (poolData.depositedLiquidity) {
    if (poolIndex === 0) {
      // First pool: keep as decimal strings
      token0Reserve = poolData.depositedLiquidity.token0.amount;
      token1Reserve = poolData.depositedLiquidity.token1.amount;
    } else {
      // Other pools: convert to wei
      token0Reserve = convertToTokenAmount(poolData.depositedLiquidity.token0.amount);
      token1Reserve = convertToTokenAmount(poolData.depositedLiquidity.token1.amount);
    }
  }
  
  // Base payload structure - handle both poolAddress and address
  const basePayload = {
    address: poolData.poolAddress || poolData.address,
    type: "algebrapool",
    inverted_slot: poolData.invertedSlot,
    proposal_address: proposalData.proposalAddress,
    ...(companyId && { companyId: companyId })
  };
  
  // First pool gets full metadata, others get metadata: null
  if (poolIndex === 0) {
    // Find prediction pools dynamically based on token symbols
    const currencySymbol = config?.currencySymbol || 'sDAI';
    const predictionYes = allPools.find(p => (p.logicalPair || p.name) === `YES_${currencySymbol} / ${currencySymbol}`);
    const predictionNo = allPools.find(p => (p.logicalPair || p.name) === `NO_${currencySymbol} / ${currencySymbol}`);
    
    basePayload.metadata = {
      name: poolData.logicalPair || poolData.name,
      description: "Auto-generated pool for futarchy governance norm prediction.",
      display_title_0: proposalData.displayText.displayText1,
      display_title_1: proposalData.displayText.displayText2,
      routerAddress: proposalData.futarchyAdapterAddress,
      factoryAddress: "0xa6cB18FCDC17a2B44E5cAd2d80a6D5942d30a345",
      routerV2: "0x00",
      routerV3: "0x00",
      futarchyAdapter: proposalData.futarchyAdapterAddress,
      token0: poolData.ammToken0?.address || poolData.token0,
      token1: poolData.ammToken1?.address || poolData.token1,
      marketName: proposalData.marketName,
      ...(companyId && { companyId: companyId }),
      reality: {
        questionText: proposalData.marketName
      },
      proposal: {
        creator: "0x645a3d9208523bbfee980f7269ac72c61dd3b552",
        creationTimestamp: 1750444545
      },
      openingTime: proposalData.proposalOpeningTime,
      spotPrice: proposalData.settings.spotPrice,
      eventProbability: proposalData.settings.initialEventProbability,
      impact: proposalData.settings.expectedImpactPercentage,
      pools: [{
        reserves: {
          token0: token0Reserve,
          token1: token1Reserve
        },
        volume24h: 1000.0,
        volume7d: 7000.0
      }],
      analytics: { 
        offChain: { 
          clicks: 0, 
          pageViews: 0 
        } 
      },
      contractInfos: {
        futarchy: {
          router: "0x7495a583ba85875d59407781b4958ED6e0E1228f"
        },
        sushiswap: {
          factory: "0xc35DADB65012eC5796536bD9864eD8773aBc74C4",
          routerV2: "0xf2614A233c7C3e7f08b1F887Ba133a13f1eb2c55",
          routerV3: "0x592abc3734cd0d458e6e44a2db2992a3d00283a4"
        }
      },
      prediction_pools: {
        no: {
          address: predictionNo ? (predictionNo.poolAddress || predictionNo.address) : "0x00",
          tokenBaseSlot: predictionNo ? predictionNo.invertedSlot : 0
        },
        yes: {
          address: predictionYes ? (predictionYes.poolAddress || predictionYes.address) : "0x00",
          tokenBaseSlot: predictionYes ? predictionYes.invertedSlot : 1
        }
      },
      conditional_pools: {
        no: {
          address: allPools[1] ? (allPools[1].poolAddress || allPools[1].address) : "0x00", // NO_GNO / NO_sDAI
          tokenCompanySlot: allPools[1] ? allPools[1].invertedSlot : 0
        },
        yes: {
          address: poolData.poolAddress || poolData.address, // Current YES_GNO / YES_sDAI
          tokenCompanySlot: poolData.invertedSlot
        }
      }
    };
  } else {
    // Subsequent pools get minimal metadata
    basePayload.metadata = null;
  }
  
  const poolFile = {
    curl_command: `curl -X POST "http://localhost:8000/api/v1/pools/create_pool" -H "Content-Type: application/json" -d '${JSON.stringify(basePayload)}'`,
    payload: basePayload,
    // Alternative command formats for different scenarios
    curl_command_readable: `curl -X POST "http://localhost:8000/api/v1/pools/create_pool" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(basePayload, null, 2)}'`,
    // For use with file input
    curl_command_file: `curl -X POST "http://localhost:8000/api/v1/pools/create_pool" -H "Content-Type: application/json" -d @-`,
    // Verification info
    method: "POST",
    content_type: "application/json",
    endpoint: "http://localhost:8000/api/v1/pools/create_pool"
  };
  
  const filename = `output/futarchy-0x${proposalAddressShort}-pool-${poolIndex + 1}.json`;
  fs.writeFileSync(filename, JSON.stringify(poolFile, null, 2));
  console.log(`Generated: ${filename}`);
  console.log(`  Pool: ${poolData.logicalPair || poolData.name}`);
  console.log(`  Address: ${poolData.poolAddress || poolData.address}`);
  console.log(`  Inverted Slot: ${poolData.invertedSlot}`);
  console.log('');
}

// Main function
function main() {
  const args = process.argv.slice(2);
  let inputFile;
  
  // If filename is provided as argument, use it, otherwise find latest
  if (args.length > 0) {
    inputFile = args[0];
    if (!inputFile.startsWith('./') && !inputFile.startsWith('/')) {
      inputFile = `./${inputFile}`;
    }
  } else {
    inputFile = findLatestFutarchyFile();
  }
  
  console.log(`Processing file: ${inputFile}`);
  console.log('');
  
  // Read and parse the JSON file
  if (!fs.existsSync(inputFile)) {
    throw new Error(`File not found: ${inputFile}`);
  }
  
  const jsonData = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
  
  // Ensure output directory exists
  if (!fs.existsSync('output')) {
    fs.mkdirSync('output', { recursive: true });
  }
  
  // Generate pool files
  if (!jsonData.createdPools || jsonData.createdPools.length === 0) {
    throw new Error('No pools found in the JSON file');
  }
  
  // Get config data including token symbols
  const config = getConfigData();
  const { companySymbol, currencySymbol } = config;
  
  // Filter for only the 3 pools we need
  const targetPools = [
    `YES_${companySymbol} / YES_${currencySymbol}`,    // Pool 1 - Conditional YES
    `NO_${companySymbol} / NO_${currencySymbol}`,     // Pool 2 - Conditional NO  
    `YES_${currencySymbol} / ${currencySymbol}`       // Pool 3 - Prediction Market YES
  ];
  
  const filteredPools = jsonData.createdPools.filter(pool => 
    targetPools.includes(pool.logicalPair || pool.name)
  );
  
  if (filteredPools.length === 0) {
    throw new Error(`No target pools found. Available pools: ${jsonData.createdPools.map(p => p.logicalPair || p.name).join(', ')}`);
  }
  
  console.log(`Found ${filteredPools.length} target pools to process:`);
  filteredPools.forEach(pool => {
    console.log(`  - ${pool.logicalPair || pool.name}`);
  });
  console.log('');
  
  // Use company ID from config for the first pool
  if (config.companyId) {
    console.log(`Using companyId from config: ${config.companyId}`);
  }
  console.log('');
  
  filteredPools.forEach((pool, index) => {
    generatePoolFile(pool, jsonData, index, jsonData.createdPools, config.companyId, config);
  });
  
  console.log(`Successfully generated ${filteredPools.length} pool files in the output directory!`);
}

// Run the script
if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
} 