import { ethers } from "ethers";

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

// SDAI Rate Provider contract address on Gnosis Chain
const SDAI_CONTRACT_RATE = "0x89C80A4540A00b5270347E02e2E144c71da2EceD";

// Cache for SDAI rate to avoid excessive blockchain calls
let cachedSdaiRate = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Fetches the current SDAI to DAI exchange rate from the blockchain
 * Uses caching to minimize RPC calls
 *
 * @param {ethers.providers.Provider} provider - Ethers provider instance
 * @returns {Promise<number>} - SDAI rate (e.g., 1.02 means 1 SDAI = 1.02 DAI)
 */
export const fetchSdaiRate = async (provider) => {
  console.log("[getSdaiRate] fetchSdaiRate called with provider:", provider ? "Provider available" : "No provider");

  // Check cache first
  const now = Date.now();
  if (cachedSdaiRate !== null && cacheTimestamp !== null && (now - cacheTimestamp) < CACHE_DURATION) {
    console.log(`[getSdaiRate] Using cached SDAI rate: ${cachedSdaiRate} (age: ${Math.floor((now - cacheTimestamp) / 1000)}s)`);
    return cachedSdaiRate;
  }

  try {
    if (!provider) {
      console.warn("[getSdaiRate] No provider available, using default SDAI rate of 1.02");
      return 1.02;
    }

    const currencyDecimals = 18; // SDAI uses 18 decimals
    let sdaiRateRaw = ethers.utils.parseUnits("1.02", currencyDecimals); // Default fallback value

    try {
      // Check if SDAI contract address is valid
      if (SDAI_CONTRACT_RATE && SDAI_CONTRACT_RATE !== "0x") {
        console.log(`[getSdaiRate] Fetching SDAI rate from contract: ${SDAI_CONTRACT_RATE}`);

        try {
          // Create the contract instance
          const sdaiRateContract = new ethers.Contract(SDAI_CONTRACT_RATE, SDAI_RATE_PROVIDER_ABI, provider);

          // Call getRate with timeout protection (10 seconds)
          const getRateWithTimeout = async () => {
            return await Promise.race([
              sdaiRateContract.getRate(),
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error("getRate timeout after 10 seconds")), 10000)
              )
            ]);
          };

          // Get the rate
          sdaiRateRaw = await getRateWithTimeout();
          console.log('[getSdaiRate] SDAI rate successfully fetched from contract:', sdaiRateRaw.toString());
        } catch (contractError) {
          console.error("[getSdaiRate] Error calling SDAI contract:", contractError.message);
          console.warn("[getSdaiRate] Using default SDAI rate due to contract error");
        }
      } else {
        console.warn("[getSdaiRate] Invalid SDAI contract address, using default rate");
      }
    } catch (rateError) {
      console.warn("[getSdaiRate] Error in SDAI rate fetch process, using default:", rateError.message);
    }

    // Format the SDAI rate using the correct token decimals
    const sdaiRateFormatted = Number(ethers.utils.formatUnits(sdaiRateRaw, currencyDecimals));
    console.log('[getSdaiRate] Final SDAI rate (formatted):', sdaiRateFormatted);

    // Update cache
    cachedSdaiRate = sdaiRateFormatted;
    cacheTimestamp = now;

    return sdaiRateFormatted;
  } catch (error) {
    console.error("[getSdaiRate] Critical error in fetchSdaiRate:", error.message);
    return 1.02; // Return default value in case of error
  }
};

/**
 * Converts SDAI amount to USD/DAI equivalent
 *
 * @param {number} sdaiAmount - Amount in SDAI
 * @param {number} sdaiRate - SDAI exchange rate (1 SDAI = X DAI)
 * @returns {number} - Equivalent amount in USD/DAI
 */
export const convertSdaiToUsd = (sdaiAmount, sdaiRate) => {
  if (sdaiAmount === null || sdaiAmount === undefined || sdaiRate === null || sdaiRate === undefined) {
    return null;
  }
  return sdaiAmount * sdaiRate;
};

/**
 * Clears the SDAI rate cache (useful for testing or manual refresh)
 */
export const clearSdaiRateCache = () => {
  cachedSdaiRate = null;
  cacheTimestamp = null;
  console.log("[getSdaiRate] Cache cleared");
};
