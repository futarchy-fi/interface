import { createClient } from '@supabase/supabase-js';
import { ethers } from "ethers";
// POOL_CONFIG_THIRD is now available in useContractConfig
import { getAlgebraPoolPrice } from '../../../../../utils/getAlgebraPoolPrice';
import { generateFallbackImage } from '../../../../refactor/utils/imageUtils';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://nvhqdqtlsdboctqjcelq.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Cache for company data
let companyCache = null;
let companyCacheTime = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch company data from company table and cache it
 * Returns: { 9: {logo, metadata}, 10: {logo, metadata}, ... }
 */
async function fetchCompanyCache() {
  // Return cached if valid
  if (companyCache && companyCacheTime && (Date.now() - companyCacheTime) < CACHE_DURATION) {
    return companyCache;
  }

  try {
    console.log('[ProposalsPageDataTransformer] Fetching company data...');
    const { data: companies, error } = await supabase
      .from('company')
      .select('*');

    if (error) throw error;

    // Build cache: company_id -> company data
    const cache = {};
    companies.forEach(c => {
      cache[c.id] = {
        id: c.id,
        name: c.name,
        description: c.description,
        logo: c.logo, // For proposal cards (small circular logo)
        currency_token: c.currency_token,
        metadata: c.metadata || {},
        background_image: c.metadata?.background_image, // For company cards (large bg)
      };
    });

    companyCache = cache;
    companyCacheTime = Date.now();
    console.log('[ProposalsPageDataTransformer] Cached companies:', Object.keys(cache));
    return cache;
  } catch (err) {
    console.error('[ProposalsPageDataTransformer] Error fetching companies:', err);
    return {};
  }
}

// SDAI Rate Provider ABI
const SDAI_RATE_PROVIDER_ABI = [
  {
    "inputs": [],
    "name": "getRate",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

// SDAI Rate Provider contract address
const SDAI_CONTRACT_RATE = "0x89C80A4540A00b5270347E02e2E144c71da2EceD";

// Uniswap V3 Pool ABI (minimal version for slot0 function)
const UNISWAP_V3_POOL_ABI = [
  {
    "inputs": [],
    "name": "slot0",
    "outputs": [
      {
        "internalType": "uint160",
        "name": "sqrtPriceX96",
        "type": "uint160"
      },
      {
        "internalType": "int24",
        "name": "tick",
        "type": "int24"
      },
      {
        "internalType": "uint16",
        "name": "observationIndex",
        "type": "uint16"
      },
      {
        "internalType": "uint16",
        "name": "observationCardinality",
        "type": "uint16"
      },
      {
        "internalType": "uint16",
        "name": "observationCardinalityNext",
        "type": "uint16"
      },
      {
        "internalType": "uint8",
        "name": "feeProtocol",
        "type": "uint8"
      },
      {
        "internalType": "bool",
        "name": "unlocked",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

// Mock company data for debug mode
const mockCompanies = {
  "gnosis": {
    name: "Gnosis DAO",
    description: "Gnosis builds new market mechanisms for decentralized finance. Our trading protocols empower users with the most secure and usable tools to participate in prediction markets.",
    logo: generateFallbackImage("Gnosis DAO", 9), // ✅ Dynamic fallback instead of hardcoded
    currencyToken: "GNO",
    stats: {
      volume: "$2.1B",
      activeTraders: 12500,
      proposals: 23
    },
    proposals: [
      {
        proposalID: "GNO-1",
        approvalStatus: "ongoing",
        countdownFinish: false,
        timestamp: Date.now() / 1000 - 86400 * 5,  // Created 5 days ago
        endTime: Date.now() / 1000 + 86400 * 10,   // Ends in 10 days
        tags: ["Treasury", "DeFi"],
        prices: { approval: "$2.15", refusal: "$1.85" },
        proposalTitle: "Gnosis Chain Bridge Upgrade",
        proposalsDocMarket: [{ proposalsDoc: "doc1", proposalMarket: "market1" }],
        participatingUsers: [
          { address: "0xabcd...ef12", amount: "5,000 GNO" },
          { address: "0x3456...789a", amount: "3,200 GNO" },
        ],
      },
      {
        proposalID: "GNO-2",
        approvalStatus: "approved",
        countdownFinish: true,
        timestamp: Date.now() / 1000 - 86400 * 20,  // Created 20 days ago
        endTime: Date.now() / 1000 - 86400 * 5,     // Ended 5 days ago
        tags: ["Governance", "Protocol"],
        prices: { approval: "$1.95", refusal: "$1.45" },
        proposalTitle: "GnosisDAO Treasury Diversification",
        proposalsDocMarket: [{ proposalsDoc: "doc2", proposalMarket: "market2" }],
        participatingUsers: [
          { address: "0xdef0...1234", amount: "8,000 GNO" },
          { address: "0x5678...9abc", amount: "4,500 GNO" },
        ],
      },
      {
        proposalID: "GNO-3",
        approvalStatus: "refused",
        countdownFinish: true,
        timestamp: Date.now() / 1000 - 86400 * 45,
        endTime: Date.now() / 1000 - 86400 * 30,
        tags: ["Development", "Infrastructure"],
        prices: { approval: "$1.25", refusal: "$1.75" },
        proposalTitle: "Gnosis Safe Mobile App Development",
        proposalsDocMarket: [{ proposalsDoc: "doc3", proposalMarket: "market3" }],
        participatingUsers: [
          { address: "0x9012...3456", amount: "6,000 GNO" },
          { address: "0xcdef...7890", amount: "2,800 GNO" },
        ],
      },
      {
        proposalID: "GNO-4",
        approvalStatus: "ongoing",
        countdownFinish: false,
        timestamp: Date.now() / 1000 - 86400 * 4,
        endTime: Date.now() / 1000 + 86400 * 6,
        tags: ["Protocol", "Development"],
        prices: { approval: "$1.78", refusal: "$1.23" },
        proposalTitle: "Gnosis Protocol V3 Implementation",
        proposalsDocMarket: [{ proposalsDoc: "doc4", proposalMarket: "market4" }],
        participatingUsers: [
          { address: "0xefgh...ijkl", amount: "4,200 GNO" },
          { address: "0xmnop...qrst", amount: "3,100 GNO" },
        ],
      }
    ]
  },
  "kleros": {
    name: "Kleros",
    description: "Kleros is a decentralized dispute resolution platform that uses blockchain and crowdsourcing to fairly adjudicate disputes.",
    logo: generateFallbackImage("Kleros", 10), // ✅ Dynamic fallback instead of hardcoded
    currencyToken: "PNK",
    stats: {
      volume: "$850K",
      activeTraders: 3200,
      proposals: 8
    },
    proposals: [
      {
        proposalID: "KLR-1",
        approvalStatus: "ongoing",
        countdownFinish: false,
        timestamp: Date.now() / 1000 - 86400 * 3,  // Created 3 days ago
        endTime: Date.now() / 1000 + 86400 * 12,   // Ends in 12 days
        tags: ["Governance", "Justice"],
        prices: { approval: "$0.85", refusal: "$0.65" },
        proposalTitle: "Kleros Court Staking Rewards Update",
        proposalsDocMarket: [{ proposalsDoc: "doc1", proposalMarket: "market1" }],
        participatingUsers: [
          { address: "0x1234...abcd", amount: "15,000 PNK" },
          { address: "0x5678...efgh", amount: "8,500 PNK" },
        ],
      }
    ]
  },
  "10": {
    name: "Kleros",
    description: "Kleros is a decentralized dispute resolution platform that uses blockchain and crowdsourcing to fairly adjudicate disputes.",
    logo: generateFallbackImage("Kleros", 10), // ✅ Dynamic fallback instead of hardcoded
    currencyToken: "PNK",
    stats: {
      volume: "$850K",
      activeTraders: 3200,
      proposals: 8
    },
    proposals: [
      {
        proposalID: "KLR-1",
        approvalStatus: "ongoing",
        countdownFinish: false,
        timestamp: Date.now() / 1000 - 86400 * 3,
        endTime: Date.now() / 1000 + 86400 * 12,
        tags: ["Governance", "Justice"],
        prices: { approval: "$0.85", refusal: "$0.65" },
        proposalTitle: "Kleros Court Staking Rewards Update",
        proposalsDocMarket: [{ proposalsDoc: "doc1", proposalMarket: "market1" }],
        participatingUsers: [
          { address: "0x1234...abcd", amount: "15,000 PNK" },
          { address: "0x5678...efgh", amount: "8,500 PNK" },
        ],
      }
    ]
  }
};

// Function to simulate API delay
const simulateDelay = () => {
  const minDelay = 500;
  const maxDelay = 2000;
  const randomDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
  return new Promise((resolve) => setTimeout(resolve, randomDelay));
};

// Update the API configuration object
const API_CONFIG = {
  endpoints: {
    companyInfo: {
      path: '/v4/company_info',
      defaultCompanyId: 9, // Use ID 9 as shown in the working API call
    }
  },
  // Add more configuration as needed
};

// Default mock metadata to use when API doesn't provide it and flag is enabled
const DEFAULT_MOCK_METADATA = {
  pools: {
    yes: {
      address: "0xC7405C82cFc9A652a469fAf21B7FE88D6E7d675c",
      token_slot: 1
    },
    no: {
      address: "0x9Db56ed695082E16AA7DA773177622473f3F70e6",
      token_slot: 0
    }
  }
};

// Helper function to fetch SDAI rate
const fetchSdaiRate = async (provider) => {
  console.log("fetchSdaiRate called with provider:", provider ? "Provider available" : "No provider");
  try {
    if (!provider) {
      // Return default value if no provider
      console.warn("No provider available, using default SDAI rate of 1.02");
      return 1.02;
    }

    const currencyDecimals = 18; // Assuming 18 decimals for currency
    let sdaiRateRaw = ethers.utils.parseUnits("1.02", currencyDecimals); // Default fallback value
    
    try {
      // Check if SDAI contract address is valid
      if (SDAI_CONTRACT_RATE && SDAI_CONTRACT_RATE !== "0x") {
        console.log(`Attempting to fetch SDAI rate from contract: ${SDAI_CONTRACT_RATE}`);
        try {
          // Try to create the contract instance
          const sdaiRateContract = new ethers.Contract(SDAI_CONTRACT_RATE, SDAI_RATE_PROVIDER_ABI, provider);
          
          // Try to call getRate with timeout protection
          const getRate = async () => {
            return await Promise.race([
              sdaiRateContract.getRate(),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error("getRate timeout after 15 seconds")), 15000)
              )
            ]);
          };
          
          // Get the rate
          sdaiRateRaw = await getRate();
          console.log('SDAI rate successfully fetched:', sdaiRateRaw.toString());
        } catch (contractError) {
          console.error("Error creating or calling SDAI contract:", contractError);
          console.warn("Using default SDAI rate due to contract error");
        }
      } else {
        console.warn("Invalid SDAI contract address, using default rate");
      }
    } catch (rateError) {
      console.warn("Error in SDAI rate fetch process, using default:", rateError);
    }
    
    // Format the SDAI rate using the correct token decimals
    const sdaiRateFormatted = Number(ethers.utils.formatUnits(sdaiRateRaw, currencyDecimals));
    console.log('Final SDAI rate (formatted):', sdaiRateFormatted);
    return sdaiRateFormatted;
  } catch (error) {
    console.error("Critical error in fetchSdaiRate:", error);
    return 1.02; // Return default value in case of error
  }
};

// Helper function to calculate price from V3 pool
const fetchUniswapV3Price = async (poolAddress, tokenBaseSlot, provider) => {
  try {
    if (!poolAddress || !provider) {
      return null;
    }

    console.log(`Fetching price for pool ${poolAddress} with token_slot ${tokenBaseSlot}`);
    
    const poolContract = new ethers.Contract(poolAddress, UNISWAP_V3_POOL_ABI, provider);
    const slot0Result = await poolContract.slot0();
    const sqrtPriceX96 = slot0Result[0]; // Get sqrtPriceX96
    
    // Calculate price using the approach from futarchy.js
    const sqrtPriceStr = ethers.utils.formatUnits(sqrtPriceX96, 0);
    const sqrtPrice = parseFloat(sqrtPriceStr);
    const priceRaw = (sqrtPrice * sqrtPrice) / 2**192;
    
    // Apply token ordering logic
    const price = tokenBaseSlot === 1 ? priceRaw : 1 / priceRaw;
    
    console.log(`Pool calculation details:
      - Pool address: ${poolAddress}
      - token_slot: ${tokenBaseSlot}
      - sqrtPriceX96: ${sqrtPriceX96.toString()}
      - sqrtPrice (parsed): ${sqrtPrice}
      - Raw price: ${priceRaw}
      - Final price (after token_slot adjustment): ${price}
    `);
    
    return price;
  } catch (error) {
    console.error("Error fetching Uniswap V3 price:", error, { poolAddress, tokenBaseSlot });
    return null;
  }
};

// Main function to fetch company data
export const fetchCompanyData = async (companyId = "gnosis", useNewPrices = true, poolConfigYes = null, poolConfigNo = null, poolConfigThird = null) => {
  let algebraPrices = {
    newYesPriceAlgebra: null,
    newNoPriceAlgebra: null,
    newThirdPriceAlgebra: null
  };

  if (useNewPrices) {
    try {
      console.log('[ProposalsPageDataTransformer] Fetching Algebra prices for proposals list...');
      const [yes, no, third] = await Promise.all([
        poolConfigYes ? getAlgebraPoolPrice(poolConfigYes) : Promise.resolve(null),
        poolConfigNo ? getAlgebraPoolPrice(poolConfigNo) : Promise.resolve(null),
        poolConfigThird ? getAlgebraPoolPrice(poolConfigThird) : Promise.resolve(null)
      ]);
      algebraPrices.newYesPriceAlgebra = yes;
      algebraPrices.newNoPriceAlgebra = no;
      algebraPrices.newThirdPriceAlgebra = third;
      console.log('[ProposalsPageDataTransformer] Fetched Algebra prices:', algebraPrices);
    } catch (e) {
      console.error('[ProposalsPageDataTransformer] Failed to fetch Algebra prices for proposals list:', e);
      // Keep prices as null if fetching fails
    }
  }

  try {
    // Add detailed request logging
    console.log("Fetching company data:", {
      companyId,
      isDebugMode: process.env.NEXT_PUBLIC_DEBUG_MODE?.toLowerCase() === "true",
      apiUrl: process.env.NEXT_PUBLIC_API_URL
    });

    const isDebugMode = process.env.NEXT_PUBLIC_DEBUG_MODE?.toLowerCase() === "true";
    
    // Always return mock data in debug mode
    if (isDebugMode) {
      console.log("Using mock data (debug mode)");
      await simulateDelay();
      // Get the mock company data - check by ID first, then by name, then default to gnosis
      const mockCompany = mockCompanies[companyId.toString()] || 
                         mockCompanies[companyId.toLowerCase()] || 
                         mockCompanies["gnosis"];
      return transformCompanyData(
        mockCompany, 
        true, 
        useNewPrices, 
        algebraPrices.newYesPriceAlgebra, 
        algebraPrices.newNoPriceAlgebra, 
        algebraPrices.newThirdPriceAlgebra
      );
    }

    // Use the passed companyId parameter or fall back to default
    // Try to convert string company names to IDs if needed
    let effectiveCompanyId;
    if (companyId === "gnosis" || companyId === "1") {
      effectiveCompanyId = 9; // Assuming Gnosis has ID 9
    } else if (companyId === "kleros" || companyId === "10") {
      effectiveCompanyId = 10; // Kleros has ID 10
    } else if (typeof companyId === 'number') {
      effectiveCompanyId = companyId;
    } else if (typeof companyId === 'string' && !isNaN(parseInt(companyId))) {
      effectiveCompanyId = parseInt(companyId);
    } else {
      effectiveCompanyId = API_CONFIG.endpoints.companyInfo.defaultCompanyId;
    }

    console.log(`Using company ID: ${effectiveCompanyId} (original parameter: ${companyId})`);

    // Make the direct Supabase table query
    try {
      console.log(`Querying Supabase table directly with company_id: ${effectiveCompanyId}`);
      
      // Query the table directly - assuming the table is called 'market_event' or 'company_info'
      // Based on your API call, it looks like we should query 'market_event' table
      const { data, error } = await supabase
        .from('market_event')
        .select('*')
        .eq('company_id', effectiveCompanyId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error querying Supabase table:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        throw new Error(`No data found for company_id ${effectiveCompanyId}. Please check if this ID exists in your database.`);
      }

      console.log('Supabase table query response:', data);

      // ✅ Fetch company data from cache
      const companies = await fetchCompanyCache();
      const companyInfo = companies[effectiveCompanyId];

      if (!companyInfo) {
        console.error(`❌ Company ${effectiveCompanyId} not found in cache!`);
      }

      // ✅ Use company data from cache (NO FALLBACK)
      const companyData = {
        company_id: effectiveCompanyId,
        name: companyInfo?.name || "Unknown Company",
        description: companyInfo?.description || "No description available",
        // ❌ NO FALLBACK - Only use logo from company table
        logo: companyInfo?.logo || null,
        currency_token: companyInfo?.currency_token || "GNO",
        stats: {
          active_traders: 0,
          proposals: data.filter(event => 
            event.approval_status === "ongoing" || 
            event.approval_status === "on_going" ||
            event.approval_status === "pending_review"
          ).length,
          volume: ""
        },
        proposals: data.map(event => {
          // Convert ISO date string to Unix timestamp
          const convertToTimestamp = (isoString) => {
            if (!isoString) return null;
            try {
              return Math.floor(new Date(isoString).getTime() / 1000);
            } catch (e) {
              console.warn("Failed to convert timestamp:", isoString);
              return null;
            }
          };

          return {
            proposal_id: event.id,
            proposal_title: event.title || `Event ${event.id}`,
            // Map the new approval status values - include pending_review as a valid status for active milestones
            approval_status: event.approval_status || "pending_review", 
            countdown_finish: event.countdown_finish || false,
            timestamp: convertToTimestamp(event.created_at),
            end_time: convertToTimestamp(event.end_date),
            tags: event.tags || [],
            // Map the new price fields to the expected structure
            prices: { 
              approval: event.approval_price ? `${event.approval_price} SDAI` : "$250.00", 
              refusal: event.refusal_price ? `${event.refusal_price} SDAI` : "$230.00"
            },
            proposals_markdown_market: [
              {
                proposal_markdown: event.proposal_markdown || "",
                proposal_market: "market"
              }
            ],
            participating_users: [],
            // Include the rich metadata from the API and add company_id
            metadata: {
              ...event.metadata,
              companyId: effectiveCompanyId
            },
            // Map pool addresses
            pool_yes: event.pool_yes,
            pool_no: event.pool_no,
            condition_id: event.condition_id,
            question_id: event.question_id,
            tokens: event.tokens,
            resolution_status: event.resolution_status, // Add resolution status for market state logic
            resolution_outcome: event.resolution_outcome, // Add resolution outcome for displaying final result
            // Extract prediction pools from metadata if available
            predictionPools: event.metadata?.prediction_pools ? {
              yes: event.metadata.prediction_pools.yes,
              no: event.metadata.prediction_pools.no
            } : null
          };
        })
      };


      return await transformCompanyData(
        companyData, 
        false, 
        useNewPrices, 
        algebraPrices.newYesPriceAlgebra, 
        algebraPrices.newNoPriceAlgebra, 
        algebraPrices.newThirdPriceAlgebra
      );

    } catch (apiError) {
      console.error("Supabase table query failed:", {
        table: 'market_event',
        company_id: effectiveCompanyId,
        error: apiError.message,
        details: apiError
      });

      // Fall back to mock data if allowed
      if (process.env.NEXT_PUBLIC_ALLOW_MOCK_FALLBACK === "true") {
        console.warn("Falling back to mock data");
        const fallbackCompany = mockCompanies[effectiveCompanyId.toString()] || 
                               mockCompanies[companyId.toString()] || 
                               mockCompanies[companyId.toLowerCase()] || 
                               mockCompanies["gnosis"];
        return await transformCompanyData(
          fallbackCompany, 
          true, 
          useNewPrices, 
          algebraPrices.newYesPriceAlgebra, 
          algebraPrices.newNoPriceAlgebra, 
          algebraPrices.newThirdPriceAlgebra
        );
      }
      throw apiError;
    }

  } catch (error) {
    console.error("Operation failed:", error.message);
    // Fall back to mock data in case of any error if allowed
    if (process.env.NEXT_PUBLIC_ALLOW_MOCK_FALLBACK === "true") {
      return await transformCompanyData(
        mockCompanies["gnosis"], 
        true, 
        useNewPrices, 
        algebraPrices.newYesPriceAlgebra, 
        algebraPrices.newNoPriceAlgebra, 
        algebraPrices.newThirdPriceAlgebra
      );
    }
    throw error;
  }
};

// Helper function to transform data consistently
const transformCompanyData = async (data, isMockData, useNewPrices, newYesPriceAlgebra, newNoPriceAlgebra, newThirdPriceAlgebra) => {
  // Extract the actual data from the API response structure
  const companyData = data.data || data; // Handle both raw data and API response structure

  // Initialize ethers provider
  let provider = null;
  if (useNewPrices) { // Only initialize provider if we might fetch live prices in the transformer
  try {
    if (typeof window !== 'undefined') {
      console.log("Running in browser environment");
      if (window.ethereum) {
        console.log("MetaMask detected, using Web3Provider");
        try {
          provider = new ethers.providers.Web3Provider(window.ethereum);
          console.log("Successfully initialized Web3Provider");
        } catch (web3Error) {
            console.error("Failed to initialize Web3Provider:", web3Error);
          }
        }
      if (!provider) {
        const envRpcUrl = process.env.NEXT_PUBLIC_RPC_URL;
        console.log(`Trying to use environment RPC URL: ${envRpcUrl}`);
        if (envRpcUrl) {
          try {
              provider = new ethers.providers.JsonRpcProvider({ url: envRpcUrl, timeout: 10000 });
            const blockNumber = await provider.getBlockNumber();
            console.log(`Successfully connected to RPC with block number: ${blockNumber}`);
          } catch (rpcError) {
            console.error("Environment RPC connection failed:", rpcError);
            provider = null;
          }
        } else {
            console.warn("No NEXT_PUBLIC_RPC_URL found");
        }
        if (!provider) {
          console.log("Trying hardcoded fallback RPC URL");
          try {
              provider = new ethers.providers.JsonRpcProvider({ url: "https://rpc.gnosischain.com", timeout: 10000 });
            const blockNumber = await provider.getBlockNumber();
            console.log(`Successfully connected to fallback RPC with block number: ${blockNumber}`);
          } catch (fallbackError) {
            console.error("Fallback RPC connection failed:", fallbackError);
            provider = null;
          }
        }
      }
    } else {
        console.log("Running in server-side environment - cannot connect to blockchain for transformer-level price fetching if useNewPrices is true.");
    }
  } catch (mainError) {
      console.error("Critical error initializing provider in transformer:", mainError);
    provider = null;
    }
  }


  // Fetch SDAI rate once for all proposals (only if provider might be used for V3 prices)
  // If useNewPrices is false, this sdaiRate might not be strictly necessary here,
  // but keeping it for now as it doesn't add much overhead if provider is null.
  const sdaiRate = provider ? await fetchSdaiRate(provider) : 1.02; // Default if no provider
  console.log("Using SDAI rate for proposals (transformer):", sdaiRate);

  const parsePriceFromString = (priceStr) => {
    if (typeof priceStr === 'number') return priceStr;
    if (typeof priceStr === 'string') {
      // Remove " SDAI" and then parse
      const num = parseFloat(priceStr.replace(/\\s*SDAI/i, '').replace('$', '').trim());
      return isNaN(num) ? null : num;
    }
    return null;
  };

  const transformed = {
    source: isMockData ? 'MOCK_DATA' : 'SUPABASE_TABLE_QUERY',
    name: companyData.name,
    description: companyData.description,
    logo: companyData.logo,
    currencyToken: companyData.currency_token,
    stats: {
      volume: companyData.stats?.volume || "$0",
      activeTraders: companyData.stats?.active_traders || 0,
      proposals: companyData.stats?.proposals || 0
    },
    proposals: (await Promise.all((companyData.proposals || []).map(async (proposal) => {
      const now = new Date();
      try {
        console.log(`[transformCompanyData] Processing proposal:`, {
          proposal_id: proposal.proposal_id,
          title: proposal.proposal_title?.substring(0, 50),
          pool_yes: proposal.pool_yes,
          pool_no: proposal.pool_no,
          rawProposal: proposal
        });

        let endTimeDate = null;
        
        // Handle different end time formats
        if (proposal.end_date) {
          // New API format: ISO 8601 string
          endTimeDate = new Date(proposal.end_date);
        } else if (proposal.end_time) {
          // Check if end_time is already a Unix timestamp (number) or ISO string
          if (typeof proposal.end_time === 'number') {
            // If it's a large number (> 1e10), it's likely milliseconds, otherwise seconds
            if (proposal.end_time > 1e10) {
              endTimeDate = new Date(proposal.end_time); // Already in milliseconds
            } else {
              endTimeDate = new Date(proposal.end_time * 1000); // Convert seconds to milliseconds
            }
          } else {
            // It's a string, treat as ISO format
            endTimeDate = new Date(proposal.end_time);
          }
        }
        
        console.log(`[transformCompanyData] End time conversion for ${proposal.proposal_id}:`, {
          raw_end_date: proposal.end_date,
          raw_end_time: proposal.end_time,
          end_time_type: typeof proposal.end_time,
          is_large_number: typeof proposal.end_time === 'number' && proposal.end_time > 1e10,
          parsed_endTimeDate: endTimeDate,
          unix_timestamp: endTimeDate ? Math.floor(endTimeDate.getTime() / 1000) : null
        });

        // Fallback: If end_time is not available, try to parse it from the proposal title
        if ((!endTimeDate || isNaN(endTimeDate.getTime())) && proposal.proposal_title) {
          const dateRegex = /(?:ending on or before|on|by)\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})/i;
          const match = proposal.proposal_title.match(dateRegex);
          if (match && match[1]) {
            // Appending UTC avoids timezone issues during parsing
            const parsedDate = new Date(`${match[1]} 23:59:59 UTC`);
            if (!isNaN(parsedDate.getTime())) {
              endTimeDate = parsedDate;
            }
          }
        }
        
        const timestampDate = proposal.timestamp ? new Date(proposal.timestamp) : now;
        const countdownFinish = proposal.countdown_finish || false;
        const approvalStatus = proposal.approval_status || "ongoing";
        
        let predictionPools = null;
        let initialImpact = null; // Renamed from impact
        let initialEventProbability = null; // Renamed from eventProbability
        let yesPriceNum = null; // Numerical yes price
        let noPriceNum = null;  // Numerical no price
        
        let tokenImages = { company: null, currency: null };
        if (proposal.metadata && proposal.metadata.token_images) {
          tokenImages = {
            company: proposal.metadata.token_images.company || null,
            currency: proposal.metadata.token_images.currency || null
          };
        }
        
        const useDefaultMockMetadata = process.env.NEXT_PUBLIC_USE_DEFAULT_MOCK_METADATA === "true";
        if (proposal.metadata && proposal.metadata.prediction_pools) {
          predictionPools = {
            yes: { 
              address: proposal.metadata.prediction_pools.yes.address, 
              tokenBaseSlot: proposal.metadata.prediction_pools.yes.tokenBaseSlot || proposal.metadata.prediction_pools.yes.token_slot 
            },
            no: { 
              address: proposal.metadata.prediction_pools.no.address, 
              tokenBaseSlot: proposal.metadata.prediction_pools.no.tokenBaseSlot || proposal.metadata.prediction_pools.no.token_slot 
            }
          };
        } else if (proposal.metadata && proposal.metadata.pools) {
          // Fallback to old format
          predictionPools = {
            yes: { address: proposal.metadata.pools.yes.address, tokenBaseSlot: proposal.metadata.pools.yes.token_slot },
            no: { address: proposal.metadata.pools.no.address, tokenBaseSlot: proposal.metadata.pools.no.token_slot }
          };
        } else if (useDefaultMockMetadata) {
          predictionPools = {
            yes: { address: DEFAULT_MOCK_METADATA.pools.yes.address, tokenBaseSlot: DEFAULT_MOCK_METADATA.pools.yes.token_slot },
            no: { address: DEFAULT_MOCK_METADATA.pools.no.address, tokenBaseSlot: DEFAULT_MOCK_METADATA.pools.no.token_slot }
          };
        }

        if (useNewPrices) {
          // This block executes if the page *wants* the transformer to fetch new prices.
          // For the card-based fetching, this part will be largely done by the card itself.
          // The newYesPriceAlgebra, newNoPriceAlgebra, newThirdPriceAlgebra are passed from fetchCompanyData
          if (newYesPriceAlgebra !== null) yesPriceNum = newYesPriceAlgebra;
          if (newNoPriceAlgebra !== null) noPriceNum = (newNoPriceAlgebra !== 0) ? (1 / newNoPriceAlgebra) : null;
          if (newThirdPriceAlgebra !== null) {
            initialEventProbability = typeof newThirdPriceAlgebra === 'number' 
              ? (newThirdPriceAlgebra * 100).toFixed(2) + '%' 
              : null;
          }

          // If Algebra prices aren't complete, and we have a provider and pools, try V3
          if ((yesPriceNum === null || noPriceNum === null) && predictionPools && provider) {
            console.log(`[transformCompanyData useNewPrices=true] Attempting V3 for ${proposal.proposal_id}`);
            if (yesPriceNum === null && predictionPools.yes?.address) {
              const v3Yes = await fetchUniswapV3Price(predictionPools.yes.address, predictionPools.yes.tokenBaseSlot, provider);
              if (v3Yes !== null) yesPriceNum = v3Yes;
            }
            if (noPriceNum === null && predictionPools.no?.address) {
              const v3No = await fetchUniswapV3Price(predictionPools.no.address, predictionPools.no.tokenBaseSlot, provider);
              if (v3No !== null) noPriceNum = v3No;
            }
          }
        }
        
        // Fallback/initial prices from API if not set by live fetching (or if useNewPrices is false)
        if (yesPriceNum === null && proposal.prices?.approval) {
          yesPriceNum = parsePriceFromString(proposal.prices.approval);
          console.log(`[transformCompanyData] Using API approval price for ${proposal.proposal_id || 'unknown'} as numerical: ${yesPriceNum}`);
        }
        if (noPriceNum === null && proposal.prices?.refusal) {
          noPriceNum = parsePriceFromString(proposal.prices.refusal);
          console.log(`[transformCompanyData] Using API refusal price for ${proposal.proposal_id || 'unknown'} as numerical: ${noPriceNum}`);
        }

        // Calculate initialImpact based on currently resolved numerical prices
        if (typeof yesPriceNum === 'number' && typeof noPriceNum === 'number' && noPriceNum !== null) {
          const maxPrice = Math.max(yesPriceNum, noPriceNum);
          if (maxPrice !== 0) {
            initialImpact = ((yesPriceNum - noPriceNum) / maxPrice) * 100;
          } else {
            initialImpact = null;
          }
        } else {
          initialImpact = null;
        }
        
        // Calculate initialEventProbability (if not already set by newThirdPriceAlgebra and useNewPrices=true)
        if (initialEventProbability === null) {
          if (yesPriceNum !== null && noPriceNum !== null && (yesPriceNum + noPriceNum) !== 0) {
            initialEventProbability = (yesPriceNum / (yesPriceNum + noPriceNum) * 100).toFixed(2) + '%';
          } else {
            initialEventProbability = null;
          }
        }

        // The 'prices' field in the output will hold the original string values for display/fallback
        // The card will receive these as initialPrices and then fetch its own.
        const displayPrices = {
          approval: proposal.prices?.approval || (typeof yesPriceNum === 'number' ? `$${yesPriceNum.toFixed(2)} SDAI` : null),
          refusal: proposal.prices?.refusal || (typeof noPriceNum === 'number' ? `$${noPriceNum.toFixed(2)} SDAI` : null),
        };
        
        // If useNewPrices was true and we got live prices, format them for the main prices fields
        // Otherwise, the original strings are already in displayPrices
         if (useNewPrices && typeof yesPriceNum === 'number') {
            displayPrices.approval = `${yesPriceNum.toFixed(2)} SDAI`;
        }
        if (useNewPrices && typeof noPriceNum === 'number') {
            displayPrices.refusal = `${noPriceNum.toFixed(2)} SDAI`;
        }


        return {
          proposalID: proposal.proposal_id?.toString() || "",
          approvalStatus,
          countdownFinish,
          timestamp: Math.floor(timestampDate.getTime() / 1000),
          endTime: endTimeDate ? Math.floor(endTimeDate.getTime() / 1000) : null,
          tags: proposal.tags || [],
          resolution_status: proposal.resolution_status,
          resolution_outcome: proposal.resolution_outcome,
          
          // Pass the original string prices (or formatted from numerical if that's all we have)
          // The card will use these as initialPrices
          prices: displayPrices,

          // Add for new cards
          approvalPrice: yesPriceNum,
          refusalPrice: noPriceNum,

          token_images: tokenImages,
          
          // Pass initial calculated values, card will recalculate with live prices
          impact: initialImpact !== null ? `${initialImpact.toFixed(2)}%` : null,
          eventProbability: initialEventProbability,
          
          proposalTitle: proposal.proposal_title || "Untitled Proposal",
          proposalsDocMarket: (proposal.proposals_markdown_market || []).map(item => ({
            proposalsDoc: item.proposal_markdown || "",
            proposalMarket: item.proposal_market || ""
          })),
          participatingUsers: (proposal.participating_users || []).map(user => ({
            address: user.address || "Anonymous",
            amount: user.amount || "0"
          })),
          predictionPools, // Crucial for card-based fetching
          
          // Debug logging for pool addresses - prioritize conditional pools
          poolAddresses: (() => {
            const poolAddresses = {
              // Use conditional pools from metadata (more consistent for price fetching)
              yes: proposal.metadata?.conditional_pools?.yes?.address || proposal.pool_yes || null,
              no: proposal.metadata?.conditional_pools?.no?.address || proposal.pool_no || null
            };
            console.log(`[transformCompanyData] Final pool addresses for ${proposal.proposal_id}:`, {
              'proposal.pool_yes': proposal.pool_yes,
              'proposal.pool_no': proposal.pool_no,
              'conditional_pools.yes': proposal.metadata?.conditional_pools?.yes?.address,
              'conditional_pools.no': proposal.metadata?.conditional_pools?.no?.address,
              'final poolAddresses': poolAddresses
            });
            return poolAddresses;
          })(),
          
          // Create poolConfig objects for ProposalsCard Algebra pool fetching
          poolConfigYes: (() => {
            const yesAddress = proposal.metadata?.conditional_pools?.yes?.address || proposal.pool_yes;
            if (!yesAddress) return null;
            return {
              address: yesAddress,
              tokenCompanySlot: proposal.metadata?.conditional_pools?.yes?.tokenCompanySlot || 1
            };
          })(),
          
          poolConfigNo: (() => {
            const noAddress = proposal.metadata?.conditional_pools?.no?.address || proposal.pool_no;
            if (!noAddress) return null;
            return {
              address: noAddress,
              tokenCompanySlot: proposal.metadata?.conditional_pools?.no?.tokenCompanySlot || 0
            };
          })(),
          
          // Also preserve the full metadata for components that need it
          metadata: proposal.metadata,
        };
      } catch (mapError) {
        console.error("Error processing proposal in transformer:", mapError, proposal);
        return null;
      }
    }))).filter(Boolean)
  };
  
  if (transformed.proposals) {
    transformed.proposals.sort((a, b) => b.timestamp - a.timestamp);
  }
  
  console.log("Transformed company data (ProposalsPageDataTransformer):", {
    source: transformed.source,
    useNewPricesFlag: useNewPrices, // Log how it was called
    // dataSnapshot: transformed // Avoid logging full data for brevity in this context
  });
  
  return transformed;
};

// Helper function to test if a company ID exists
export const testCompanyId = async (companyId) => {
  try {
    console.log(`Testing if company ID ${companyId} exists in market_event table...`);
    const { data, error } = await supabase
      .from('market_event')
      .select('*')
      .eq('company_id', companyId)
      .limit(1);

    if (error) {
      console.error(`Company ID ${companyId} test failed:`, error);
      return { exists: false, error: error.message };
    }

    if (data && data.length > 0) {
      console.log(`Company ID ${companyId} exists with ${data.length} records`);
      return { exists: true, data: data[0] };
    }

    console.log(`Company ID ${companyId} not found in market_event table`);
    return { exists: false, error: 'No records found for this company_id' };
  } catch (error) {
    console.error(`Error testing company ID ${companyId}:`, error);
    return { exists: false, error: error.message };
  }
};

// Optional: Function to get list of available companies
export const getAvailableCompanies = async () => {
  const isDebugMode = process.env.NEXT_PUBLIC_DEBUG_MODE?.toLowerCase() === "true";
  
  if (isDebugMode) {
    await simulateDelay();
    return Object.keys(mockCompanies);
  }

  // Use direct Supabase table query to get distinct company IDs
  try {
    const { data, error } = await supabase
      .from('market_event')
      .select('company_id')
      .order('company_id');

    if (error) {
      console.error('Error querying available companies:', error);
      throw error;
    }

    // Get unique company IDs
    const allCompanyIds = data.map(item => item.company_id);
    const uniqueCompanyIds = [...new Set(allCompanyIds)];
    
    console.log('Raw company IDs from database:', allCompanyIds);
    console.log('Raw company IDs count:', allCompanyIds.length);
    console.log('Unique company IDs:', uniqueCompanyIds);
    console.log('Unique company IDs count:', uniqueCompanyIds.length);
    console.log('Duplicates removed:', allCompanyIds.length - uniqueCompanyIds.length);
    
    return uniqueCompanyIds;
  } catch (error) {
    console.error('Failed to fetch companies list:', error);
    // Fallback to mock data if allowed
    if (process.env.NEXT_PUBLIC_ALLOW_MOCK_FALLBACK === "true") {
      return Object.keys(mockCompanies);
    }
    throw error;
  }
}; 