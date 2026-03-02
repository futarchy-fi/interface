// getTradeHistory.js

const { ethers } = require('ethers');
const dayjs = require('dayjs');
const fetch = require('node-fetch'); // or your preferred fetch equivalent

const DEBUG_MODE = true; // <-- Add DEBUG_MODE flag

// Constants - API Endpoint & Bearer Token
const BEARER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52aHFkcXRsc2Rib2N0cWpjZWxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIxNDU3ODEsImV4cCI6MjA1NzcyMTc4MX0.6kjpxGVqSQNMz3DqycuNPv_ug8sdBNKeJsN0Z3X7oLg';
const API_ENDPOINT = 'https://nvhqdqtlsdboctqjcelq.supabase.co/functions/v1/Trade-History';
const USER_ADDRESS_TO_QUERY = '0x2403Cc666aFf9EE68467e097bB494ceE8cEEBD9F'; // Replace with the actual user address if different

// Base symbols for identifying company vs currency tokens
const BASE_COMPANY_SYMBOL = 'GNO'; // e.g., GNO or YES_GNO, NO_GNO
const BASE_CURRENCY_SYMBOL = 'sDAI'; // e.g., sDAI or YES_sDAI, NO_sDAI

const GNOSIS_RPC_URL = 'https://rpc.gnosischain.com';
const provider = new ethers.providers.JsonRpcProvider(GNOSIS_RPC_URL);
const tokenSymbolCache = new Map();

const POOLS_TO_QUERY = [
  { address: '0xac12a0c39266E0214cdbcEE98c53cC13E5722B8A', name: 'YES/YES Pool (GNO/sDAI)' },
  { address: '0x18DcF3B948B3c0B34e30392576f55c8815F11a96', name: 'NO/NO Pool (GNO/sDAI)' },
  { address: '0x67750A4c9E8d4987286DF84d351bAE8fC9EeF865', name: 'Prediction YES Pool (e.g., YES_sDAI/sDAI)' },
];

// Standard ERC20 ABI for symbol
const erc20Abi = [
  {
    "constant": true,
    "inputs": [],
    "name": "symbol",
    "outputs": [
      {
        "name": "",
        "type": "string"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  }
];

function parseTokenSymbol(symbol) {
  if (!symbol || typeof symbol !== 'string') return { prefix: null, base: null, original: symbol };
  const parts = symbol.split('_');
  if (parts.length >= 2) { // Allow for symbols like PREFIX_BASE_EXTRA
    return { prefix: parts[0], base: parts[1], original: symbol };
  }
  return { prefix: null, base: symbol, original: symbol }; // If no underscore or only one part, assume base
}

async function getTokenSymbol(tokenAddress) {
  if (DEBUG_MODE) console.log(`DEBUG: getTokenSymbol called for address: ${tokenAddress}`);
  if (!tokenAddress || tokenAddress === '0x0000000000000000000000000000000000000000') {
    if (DEBUG_MODE) console.log(`DEBUG: getTokenSymbol returning null for invalid or zero address: ${tokenAddress}`);
    return null; 
  }
  if (tokenSymbolCache[tokenAddress]) {
    if (DEBUG_MODE) console.log(`DEBUG: Cache hit for ${tokenAddress}: ${tokenSymbolCache[tokenAddress]}`);
    return tokenSymbolCache[tokenAddress];
  }
  try {
    const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, provider);
    const symbol = await tokenContract.symbol();
    tokenSymbolCache[tokenAddress] = symbol;
    if (DEBUG_MODE) console.log(`DEBUG: Fetched and cached symbol for ${tokenAddress}: ${symbol}`);
    return symbol;
  } catch (error) {
    console.error(`Error fetching symbol for token ${tokenAddress}:`, error.message);
    if (DEBUG_MODE) console.log(`DEBUG: Error details for ${tokenAddress}:`, error);
    tokenSymbolCache[tokenAddress] = null; // Cache null on error to avoid refetching bad addresses repeatedly
    return null;
  }
}

async function enrichTradeData(trades, poolAddressForLog) {
  if (DEBUG_MODE) console.log(`DEBUG: enrichTradeData called for pool: ${poolAddressForLog}, with ${trades.length} trades.`);
  const enrichedTrades = [];
  for (const trade of trades) {
    if (DEBUG_MODE) console.log(`DEBUG: Enriching trade: ${trade.evt_tx_hash}, token0: ${trade.token0}, token1: ${trade.token1}`);
    const token0SymbolStr = tokenSymbolCache.get(trade.token0) || await getTokenSymbol(trade.token0);
    const token1SymbolStr = tokenSymbolCache.get(trade.token1) || await getTokenSymbol(trade.token1);

    tokenSymbolCache.set(trade.token0, token0SymbolStr);
    tokenSymbolCache.set(trade.token1, token1SymbolStr);

    const parsedToken0 = parseTokenSymbol(token0SymbolStr);
    const parsedToken1 = parseTokenSymbol(token1SymbolStr);

    let conditionalCompanyTokenSymbol = 'N/A';
    let conditionalCurrencyTokenSymbol = 'N/A';
    let companyTokenAddress = null;
    let currencyTokenAddress = null;
    let amountForCompanyToken = null;
    let amountForCurrencyToken = null;
    let poolType = 'UNKNOWN_POOL';

    // Identify company and currency tokens and their roles
    if (parsedToken0.base === BASE_COMPANY_SYMBOL && parsedToken1.base === BASE_CURRENCY_SYMBOL) {
      conditionalCompanyTokenSymbol = parsedToken0.original;
      companyTokenAddress = trade.token0;
      amountForCompanyToken = parseFloat(trade.amount0);
      conditionalCurrencyTokenSymbol = parsedToken1.original;
      currencyTokenAddress = trade.token1;
      amountForCurrencyToken = parseFloat(trade.amount1);
    } else if (parsedToken1.base === BASE_COMPANY_SYMBOL && parsedToken0.base === BASE_CURRENCY_SYMBOL) {
      conditionalCompanyTokenSymbol = parsedToken1.original;
      companyTokenAddress = trade.token1;
      amountForCompanyToken = parseFloat(trade.amount1);
      conditionalCurrencyTokenSymbol = parsedToken0.original;
      currencyTokenAddress = trade.token0;
      amountForCurrencyToken = parseFloat(trade.amount0);
    }

    // Set poolType based on either token's prefix
    if (parsedToken0.prefix === 'YES' || parsedToken1.prefix === 'YES') {
      poolType = 'YES_POOL';
    } else if (parsedToken0.prefix === 'NO' || parsedToken1.prefix === 'NO') {
      poolType = 'NO_POOL';
    }

    let transactionDescription = 'N/A';
    let transactionSide = 'N/A';

    if (amountForCompanyToken !== null && conditionalCompanyTokenSymbol !== 'N/A' && conditionalCurrencyTokenSymbol !== 'N/A') {
      const companyTokenBaseSymbol = (parsedToken0.base === BASE_COMPANY_SYMBOL) ? parsedToken0.base : parsedToken1.base;
      if (amountForCompanyToken < 0) { 
        transactionSide = `BOUGHT_${conditionalCompanyTokenSymbol.replace(`_${companyTokenBaseSymbol}`, '')}_${companyTokenBaseSymbol}`; // e.g. BOUGHT_YES_GNO
        transactionDescription = `User BOUGHT ${Math.abs(amountForCompanyToken).toExponential(3)} ${conditionalCompanyTokenSymbol} WITH ${Math.abs(amountForCurrencyToken).toExponential(3)} ${conditionalCurrencyTokenSymbol}`;
      } else if (amountForCompanyToken > 0) { 
        transactionSide = `SOLD_${conditionalCompanyTokenSymbol.replace(`_${companyTokenBaseSymbol}`, '')}_${companyTokenBaseSymbol}`; // e.g. SOLD_YES_GNO
        transactionDescription = `User SOLD ${amountForCompanyToken.toExponential(3)} ${conditionalCompanyTokenSymbol} FOR ${Math.abs(amountForCurrencyToken).toExponential(3)} ${conditionalCurrencyTokenSymbol}`;
      } else {
        transactionDescription = "No change in company token amount.";
      }
    }

    // --- Prediction Pool Special Handling ---
    let marketCategory = 'Conditional';
    let outcome = 'N/A';
    let side = transactionSide;
    let price = null;
    
    // Check if either token contains YES_ or NO_ prefix and the other is sDAI
    const token0HasYesPrefix = token0SymbolStr && token0SymbolStr.startsWith('YES_');
    const token0HasNoPrefix = token0SymbolStr && token0SymbolStr.startsWith('NO_');
    const token1HasYesPrefix = token1SymbolStr && token1SymbolStr.startsWith('YES_');
    const token1HasNoPrefix = token1SymbolStr && token1SymbolStr.startsWith('NO_');
    const token0IsSDAI = token0SymbolStr === 'sDAI';
    const token1IsSDAI = token1SymbolStr === 'sDAI';
    
    // Guarantee we identify all prediction pools correctly
    if (
      // YES token vs sDAI case
      (token0HasYesPrefix && token1IsSDAI) || (token1HasYesPrefix && token0IsSDAI) ||
      // NO token vs sDAI case
      (token0HasNoPrefix && token1IsSDAI) || (token1HasNoPrefix && token0IsSDAI) ||
      // Also check poolType as fallback
      ((poolType === 'YES_POOL' || poolType === 'NO_POOL') && (token0IsSDAI || token1IsSDAI))
    ) {
      // This is definitely a prediction pool
      marketCategory = 'Prediction';
      
      // Set outcome based on token prefixes
      if (token0HasYesPrefix || token1HasYesPrefix || poolType === 'YES_POOL') {
        outcome = 'Yes';
      } else if (token0HasNoPrefix || token1HasNoPrefix || poolType === 'NO_POOL') {
        outcome = 'No';
      }
      
      // Calculate amounts
      const amount0 = parseFloat(trade.amount0);
      const amount1 = parseFloat(trade.amount1);
      
      // Calculate price - never null
      if (amount0 && amount1) {
        price = Math.abs(amount1 / amount0); 
      } else {
        price = 1.0; // Default fallback
      }
      
      // Set side based on flow direction (sDAI to conditional token or vice versa)
      // Side is from user perspective - buying or selling the prediction
      if (token0IsSDAI) {
        // If sDAI is flowing out (negative), user is buying prediction tokens
        side = amount0 < 0 ? 'buy' : 'sell';
      } else if (token1IsSDAI) {
        // If sDAI is flowing out (negative), user is selling prediction tokens 
        side = amount1 < 0 ? 'sell' : 'buy';
      } else {
        // Should never get here, but just in case
        side = amount0 < 0 ? 'buy' : 'sell';
      }
    }

    enrichedTrades.push({
      ...trade,
      token0_symbol: token0SymbolStr,
      token1_symbol: token1SymbolStr,
      parsed_token0_prefix: parsedToken0.prefix, // Added for marketCategory logic
      parsed_token1_prefix: parsedToken1.prefix, // Added for marketCategory logic
      pool_type: poolType,
      conditional_company_token_symbol: conditionalCompanyTokenSymbol,
      conditional_currency_token_symbol: conditionalCurrencyTokenSymbol,
      transaction_side: side,
      transaction_description: transactionDescription,
      amount0_float: parseFloat(trade.amount0),
      amount1_float: parseFloat(trade.amount1),
      company_token_address: companyTokenAddress,
      currency_token_address: currencyTokenAddress,
      amount_company_token_float: amountForCompanyToken,
      amount_currency_token_float: amountForCurrencyToken,
      marketCategory,
      outcome,
      price
    });
  }

  return enrichedTrades;
}

async function main() {
  console.log('Starting trade history fetching process...');
  let allRawTrades = [];

  for (const pool of POOLS_TO_QUERY) {
    console.log(`Fetching trade history for pool: ${pool.name} (${pool.address}) for user: ${USER_ADDRESS_TO_QUERY}`);
    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${BEARER_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ pool_address: pool.address, user_address: USER_ADDRESS_TO_QUERY })
      });

      if (!response.ok) {
        console.error(`Error fetching trades for pool ${pool.address}: ${response.status} ${response.statusText}`);
        const errorBody = await response.text();
        console.error('Error body:', errorBody);
        continue; // Skip to the next pool
      }

      const responseData = await response.json();
      if (responseData && responseData.success && responseData.data && responseData.data.length > 0) {
        const tradesArray = responseData.data; 
        if (DEBUG_MODE && pool.address === '0x67750A4c9E8d4987286DF84d351bAE8fC9EeF865') {
          console.log(`DEBUG: Raw trades for Prediction Pool (${pool.address}):`, JSON.stringify(tradesArray, null, 2));
        }
        const tradesWithPoolContext = tradesArray.map(t => ({ ...t, queried_pool_address: pool.address }));
        allRawTrades.push(...tradesWithPoolContext);
        console.log(`Fetched ${tradesArray.length} trades from pool ${pool.address}.`);
      } else if (responseData && responseData.message) {
        console.log(`No trades found for pool ${pool.address}. API Message: ${responseData.message}`);
      } else {
        console.log(`No trades found or unexpected response structure for pool ${pool.address}.`);
      }
    } catch (error) {
      console.error(`Exception fetching trades for pool ${pool.address}:`, error);
    }
  }

  if (allRawTrades.length === 0) {
    console.log('No trades fetched from any pool. Exiting.');
    return;
  }

  console.log(`Total raw trades fetched from all pools: ${allRawTrades.length}`);

  // Enrich all collected trades
  const fullyEnrichedTrades = await enrichTradeData(allRawTrades, 'all_aggregated_pools');

  if (!fullyEnrichedTrades || fullyEnrichedTrades.length === 0) {
    console.log('No trades to process after enrichment. Exiting.');
    return;
  }

  // Transform for ViewModel
  const transformedForViewModel = fullyEnrichedTrades.map((trade, index) => {
    const {
      evt_block_number,
      evt_tx_hash,
      evt_block_time,
      token0_symbol, // This can be null
      token1_symbol, // This can be null
      pool_type, // from enrichment
      transaction_side, // from enrichment, e.g., BOUGHT_YES_GNO
      amount_company_token_float, // from enrichment
      amount_currency_token_float, // from enrichment
      price_float, // from enrichment
      queried_pool_address
    } = trade;

    const eventId = evt_block_number; 
    const timestamp = dayjs(evt_block_time).toISOString();
    // Use the real tx_hash if available, otherwise generate a placeholder
    const txHash = trade.evt_tx_hash ? trade.evt_tx_hash : `0xPLACEHOLDER_TX_HASH_${eventId}_${timestamp}`;

    // Initialize with defaults, but respect existing marketCategory
    let outcome = "N/A";
    // IMPORTANT: Check if marketCategory was already set in enrichTradeData
    let marketCategory = trade.marketCategory || "Standard";
    let side = trade.transaction_side !== "N/A" ? trade.transaction_side : "N/A"; // Respect side from enrichTradeData

    // Guard against null symbols before splitting
    // This is where the error at line 215 likely occurs if not guarded
    const [parsedToken0Prefix, parsedToken0BaseSymbol] = token0_symbol ? token0_symbol.split('_') : [null, token0_symbol];
    const [parsedToken1Prefix, parsedToken1BaseSymbol] = token1_symbol ? token1_symbol.split('_') : [null, token1_symbol];

    if (DEBUG_MODE && queried_pool_address === '0x67750A4c9E8d4987286DF84d351bAE8fC9EeF865') {
      console.log(`DEBUG (ViewModel Transform - Prediction Pool Trade ${index}):`);
      console.log(`  Raw Symbols: token0_symbol='${token0_symbol}', token1_symbol='${token1_symbol}'`);
      console.log(`  Pool Type: ${pool_type}`);
    }

    if (parsedToken0Prefix && parsedToken1Prefix && parsedToken0Prefix === parsedToken1Prefix && (parsedToken0Prefix === 'YES' || parsedToken0Prefix === 'NO')) {
      let conditionalTokenSymbol, baseCurrencySymbol;
      if (parsedToken0Prefix === 'YES' || parsedToken0Prefix === 'NO') {
        // token0 is the conditional one, token1 is base
        conditionalTokenSymbol = token0_symbol;
      } else if (parsedToken1Prefix === 'YES' || parsedToken1Prefix === 'NO') {
        // token1 is the conditional one, token0 is base
        conditionalTokenSymbol = token1_symbol;
      } else {
        // Fallback if symbols are unusual but one must be conditional from earlier check.
        // This case implies one has a prefix and the other doesn't, but the above didn't catch it cleanly.
        // Defaulting to token0 as conditional if logic is ambiguous here.
        conditionalTokenSymbol = token0_symbol; 
      }

      if (conditionalTokenSymbol) { // Ensure conditionalTokenSymbol is not null
        outcome = conditionalTokenSymbol.startsWith('YES') ? "Yes" : "No";
        if (transaction_side) { // ensure transaction_side is not null
          if (transaction_side.startsWith('BOUGHT_')) {
            side = "buy";
          } else if (transaction_side.startsWith('SOLD_')) {
            side = "sell";
          }
        }
      }
    } else {
      // Fallback for Standard or unhandled cases - try to infer from pool_type if possible
      if (pool_type === 'YES_POOL') outcome = 'Yes';
      if (pool_type === 'NO_POOL') outcome = 'No';
      // Side for standard might be harder to infer without clear buy/sell of outcome token
      // For now, it might remain N/A or be based on raw amounts if logic was added
      // The current transaction_side (e.g. BOUGHT_X_FOR_Y) is pool-centric.
      // We need to map it to outcome-centric buy/sell.
      if (transaction_side) { // ensure transaction_side is not null
        if (outcome === 'Yes') {
          if (transaction_side.includes('BOUGHT_YES')) side = 'buy';
          if (transaction_side.includes('SOLD_YES')) side = 'sell';
        }
        if (outcome === 'No') {
          if (transaction_side.includes('BOUGHT_NO')) side = 'buy';
          if (transaction_side.includes('SOLD_NO')) side = 'sell';
        }
      }
    }

    let token0Base = token0_symbol ? token0_symbol.split('_').pop() : null;
    let token1Base = token1_symbol ? token1_symbol.split('_').pop() : null;

    if (DEBUG_MODE && queried_pool_address === '0x67750A4c9E8d4987286DF84d351bAE8fC9EeF865') {
      console.log(`  Parsed Symbols: T0_Prefix='${parsedToken0Prefix}', T0_Base='${parsedToken0BaseSymbol}', T1_Prefix='${parsedToken1Prefix}', T1_Base='${parsedToken1BaseSymbol}'`);
    }

    // Determine marketCategory and outcome based on parsed symbols and pool_type
    if (parsedToken0Prefix && parsedToken1Prefix && parsedToken0Prefix === parsedToken1Prefix && (parsedToken0Prefix === 'YES' || parsedToken0Prefix === 'NO')) {
      marketCategory = 'Conditional';
    } else {
      const token0IsCond = !!parsedToken0Prefix;
      const token1IsCond = !!parsedToken1Prefix;
      const token0IsBaseCompany = token0Base === BASE_COMPANY_SYMBOL && !token0IsCond;
      const token1IsBaseCompany = token1Base === BASE_COMPANY_SYMBOL && !token1IsCond;
      const token0IsBaseCurrency = token0Base === BASE_CURRENCY_SYMBOL && !token0IsCond;
      const token1IsBaseCurrency = token1Base === BASE_CURRENCY_SYMBOL && !token1IsCond;

      // Prediction: one conditional token vs. its non-conditional base (company or currency)
      if (token0IsCond && ( (parsedToken0Prefix + "_" + token0Base === token0_symbol && token0Base === token1Base && !token1IsCond && (token1IsBaseCompany || token1IsBaseCurrency) ) ) ){
         marketCategory = 'Prediction';
         if (parsedToken0Prefix === 'YES') outcome = 'Yes';
         if (parsedToken0Prefix === 'NO') outcome = 'No';
      } else if (token1IsCond && ( (parsedToken1Prefix + "_" + token1Base === token1_symbol && token0Base === token1Base && !token0IsCond && (token0IsBaseCompany || token0IsBaseCurrency) ) ) ){
         marketCategory = 'Prediction';
         if (parsedToken1Prefix === 'YES') outcome = 'Yes';
         if (parsedToken1Prefix === 'NO') outcome = 'No';
      }
      if (DEBUG_MODE && queried_pool_address === '0x67750A4c9E8d4987286DF84d351bAE8fC9EeF865') {
        console.log(`  Derived Category Logic: marketCategory='${marketCategory}', outcome='${outcome}', side='${side}' (after prediction check)`);
      }
    }

    // Price calculation (ensure price_float is not NaN or undefined)
    let price = 0;
    
    // Special case for prediction pools - always calculate a price
    if (marketCategory === 'Prediction' && (token0_symbol === 'sDAI' || token1_symbol === 'sDAI')) {
        // For prediction pools with sDAI, try to set meaningful price
        if (trade.price !== null && trade.price !== undefined) {
            // If we already calculated a price in enrichTradeData, use it
            price = trade.price;
        } else if (amount_company_token_float !== 0) {
            // Otherwise calculate from amounts
            price = Math.abs(amount_currency_token_float) / Math.abs(amount_company_token_float);
        } else {
            // Default price for redeem/merge actions
            price = 1.0;
        }
    } else {
        // Normal price calculation for other trade types
        if (amount_company_token_float !== 0) { // Calculate price from scaled amount and cost
            price = Math.abs(amount_currency_token_float) / Math.abs(amount_company_token_float);
        } else if (trade.amount_company_token_float && trade.amount_currency_token_float && trade.amount_company_token_float !== 0) {
            // Fallback to original price calculation if new scaled amount is zero (e.g. very small raw amount formatted to 0.0 after scaling)
            // This uses unscaled raw floats, so the ratio is the same.
            price = Math.abs(trade.amount_currency_token_float) / Math.abs(trade.amount_company_token_float);
        }
    }

    if (DEBUG_MODE && queried_pool_address === '0x67750A4c9E8d4987286DF84d351bAE8fC9EeF865') {
      console.log(`  Final ViewModel Item for Prediction Pool Trade ${index}:`, {
        eventId, outcome, side, price, amount: Math.abs(parseFloat(ethers.utils.formatUnits(trade.company_token_address === trade.token0 ? trade.amount0 : trade.amount1, 18))), cost: Math.abs(parseFloat(ethers.utils.formatUnits(trade.currency_token_address === trade.token0 ? trade.amount0 : trade.amount1, 18))), timestamp, txHash, poolType: pool_type, marketCategory, token0Symbol: token0_symbol, token1Symbol: token1_symbol, queriedPoolAddress: queried_pool_address
      });
    }

    return {
      eventId,
      outcome: outcome, 
      side: side,
      price: price,
      amount: Math.abs(parseFloat(ethers.utils.formatUnits(trade.company_token_address === trade.token0 ? trade.amount0 : trade.amount1, 18))),
      cost: Math.abs(parseFloat(ethers.utils.formatUnits(trade.currency_token_address === trade.token0 ? trade.amount0 : trade.amount1, 18))),
      timestamp: trade.evt_block_time,
      txHash: txHash,
      poolType: trade.pool_type,
      marketCategory: marketCategory,
      // For debugging/verification, include original symbols and pool address
      token0Symbol: trade.token0_symbol,
      token1Symbol: trade.token1_symbol,
      queriedPoolAddress: trade.queried_pool_address 
    };
  });

  // Sort by timestamp (descending, most recent first)
  transformedForViewModel.sort((a, b) => dayjs(b.timestamp).valueOf() - dayjs(a.timestamp).valueOf());

  console.log('\n--- Fully Processed and Sorted Trade History for ViewModel ---');
  console.log(JSON.stringify(transformedForViewModel, null, 2));
  console.log(`\nTotal trades processed and formatted: ${transformedForViewModel.length}`);
  console.log('--- End of Process ---');
}

main().catch(console.error);
