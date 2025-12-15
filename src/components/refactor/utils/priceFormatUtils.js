/**
 * Price Formatting Utilities
 * 
 * Implements consistent price display rules:
 * - Conditional pools: Currency-based per Company-based (sDAI-based per GNO-based)
 * - Prediction pools: Position tokens per Base token (how much position currency can be bought with base currency)
 */

import { formatPrice } from './poolPriceUtils';

/**
 * Apply price display convention based on pool type and token classification
 * @param {Object} poolData - Pool data with classification and price info
 * @returns {Object} Standardized price display data
 */
export function standardizePriceDisplay(poolData) {
  console.log('=== standardizePriceDisplay called ===', poolData);
  
  const { classification, token0, token1, prices } = poolData;
  
  if (!prices) {
    return {
      primaryPrice: null,
      primaryLabel: 'No price data',
      secondaryPrice: null,
      secondaryLabel: '',
      convention: 'none'
    };
  }

  // Safety check for classification
  if (!classification) {
    console.log('No classification found, using unknown pool format');
    return formatUnknownPoolPrice(token0, token1, prices);
  }

  // Debug logging
  console.log('Pool classification debug:', {
    type: classification.type,
    token0Symbol: token0?.symbol,
    token1Symbol: token1?.symbol,
    hasTokens: !!classification.tokens,
    classification: classification
  });

  const { tokens } = classification;
  
  // For Conditional Pools: Currency-based per Company-based
  if (classification.type === 'CONDITIONAL') {
    console.log('Processing CONDITIONAL pool:', token0?.symbol, 'vs', token1?.symbol);
    return formatConditionalPoolPrice(token0, token1, tokens, prices);
  }
  
  // For Prediction Pools: Position tokens per Base token (how much position currency can be bought with base currency)
  if (classification.type === 'PREDICTION') {
    console.log('Processing PREDICTION pool:', token0?.symbol, 'vs', token1?.symbol);
    return formatPredictionPoolPrice(token0, token1, tokens, prices);
  }
  
  // For Unknown pools: Show both directions
  console.log('Using unknown pool format for:', token0?.symbol, 'vs', token1?.symbol);
  return formatUnknownPoolPrice(token0, token1, prices);
}

/**
 * Format conditional pool prices: Currency-based per Company-based
 */
function formatConditionalPoolPrice(token0, token1, tokens, prices) {
  console.log('formatConditionalPoolPrice called with:', {
    token0Symbol: token0?.symbol,
    token1Symbol: token1?.symbol,
    tokens: tokens
  });

  // Directly check token symbols to determine currency vs company
  let currencyToken, companyToken, currencyPerCompany, companyPerCurrency;
  
  // Check token0 and token1 symbols directly
  const token0IsCurrency = isCurrencyBasedBySymbol(token0.symbol);
  const token0IsCompany = isCompanyBasedBySymbol(token0.symbol);
  const token1IsCurrency = isCurrencyBasedBySymbol(token1.symbol);
  const token1IsCompany = isCompanyBasedBySymbol(token1.symbol);
  
  console.log('Token classification check:', {
    token0Symbol: token0.symbol,
    token0IsCurrency,
    token0IsCompany,
    token1Symbol: token1.symbol,
    token1IsCurrency,
    token1IsCompany
  });
  
  if (token0IsCurrency && token1IsCompany) {
    console.log('Match: token0 is currency, token1 is company');
    // token0 is currency, token1 is company
    currencyToken = token0;
    companyToken = token1;
    currencyPerCompany = prices.token1PerToken0; // How much currency (token0) per 1 company (token1)
    companyPerCurrency = prices.token0PerToken1; // How much company (token1) per 1 currency (token0)
  } else if (token0IsCompany && token1IsCurrency) {
    console.log('Match: token0 is company, token1 is currency');
    // token0 is company, token1 is currency
    currencyToken = token1;
    companyToken = token0;
    currencyPerCompany = prices.token0PerToken1; // How much currency (token1) per 1 company (token0)
    companyPerCurrency = prices.token1PerToken0; // How much company (token0) per 1 currency (token1)
  } else {
    console.log('No currency/company match, using default order');
    // Both same type or unknown - use default order
    return {
      primaryPrice: formatPrice(prices.token1PerToken0),
      primaryLabel: `1 ${token0.symbol} = ${formatPrice(prices.token1PerToken0)} ${token1.symbol}`,
      secondaryPrice: formatPrice(prices.token0PerToken1),
      secondaryLabel: `1 ${token1.symbol} = ${formatPrice(prices.token0PerToken1)} ${token0.symbol}`,
      convention: 'default_order',
      tag: 'DEFAULT ORDER'
    };
  }
  
  console.log('Returning CURRENCY PER COMPANY format');
  // Always show: "1 company token = X currency tokens" (how much currency to buy 1 company)
  return {
    primaryPrice: formatPrice(currencyPerCompany),
    primaryLabel: `1 ${companyToken.symbol} = ${formatPrice(currencyPerCompany)} ${currencyToken.symbol}`,
    secondaryPrice: formatPrice(companyPerCurrency),
    secondaryLabel: `1 ${currencyToken.symbol} = ${formatPrice(companyPerCurrency)} ${companyToken.symbol}`,
    convention: 'currency_per_company',
    tag: 'CURRENCY PER COMPANY'
  };
}

/**
 * Format prediction pool prices: Position tokens per Base token (how much position currency can be bought with base currency)
 */
function formatPredictionPoolPrice(token0, token1, tokens, prices) {
  // Safety check for tokens structure
  if (!tokens || !tokens.base || !tokens.position) {
    return formatUnknownPoolPrice(token0, token1, prices);
  }

  const { base, position } = tokens;
  
  let baseToken, positionToken, positionPerBase, basePerPosition;
  
  // Determine which actual token corresponds to base vs position
  if (token0.address.toLowerCase() === base.address?.toLowerCase() || 
      token0.symbol === base.symbol) {
    baseToken = token0;
    positionToken = token1;
    positionPerBase = prices.token1PerToken0;    // Position per base (what we want as primary)
    basePerPosition = prices.token0PerToken1;    // Base per position (alternative)
  } else {
    baseToken = token1;
    positionToken = token0;
    positionPerBase = prices.token0PerToken1;    // Position per base (what we want as primary)
    basePerPosition = prices.token1PerToken0;    // Base per position (alternative)
  }
  
  return {
    primaryPrice: formatPrice(positionPerBase),
    primaryLabel: `${formatPrice(positionPerBase)} ${positionToken.symbol}/${baseToken.symbol}`,
    secondaryPrice: formatPrice(basePerPosition),
    secondaryLabel: `${formatPrice(basePerPosition)} ${baseToken.symbol}/${positionToken.symbol}`,
    convention: 'position_per_base',
    tag: 'POSITION PER BASE'
  };
}

/**
 * Format unknown pool prices: Show both directions with default order
 */
function formatUnknownPoolPrice(token0, token1, prices) {
  return {
    primaryPrice: formatPrice(prices.token1PerToken0),
    primaryLabel: `1 ${token0.symbol} = ${formatPrice(prices.token1PerToken0)} ${token1.symbol}`,
    secondaryPrice: formatPrice(prices.token0PerToken1),
    secondaryLabel: `1 ${token1.symbol} = ${formatPrice(prices.token0PerToken1)} ${token0.symbol}`,
    convention: 'both_directions',
    tag: 'BOTH DIRECTIONS'
  };
}

/**
 * Check if token is currency-based by symbol (sDAI, DAI related)
 */
function isCurrencyBasedBySymbol(symbol) {
  if (!symbol) return false;
  
  const upperSymbol = symbol.toUpperCase();
  return upperSymbol.includes('SDAI') || 
         upperSymbol.includes('DAI') ||
         upperSymbol.includes('CURRENCY');
}

/**
 * Check if token is company-based by symbol (GNO related)
 */
function isCompanyBasedBySymbol(symbol) {
  if (!symbol) return false;
  
  const upperSymbol = symbol.toUpperCase();
  return upperSymbol.includes('GNO') || 
         upperSymbol.includes('GNOSIS') ||
         upperSymbol.includes('COMPANY');
}

/**
 * Check if token is currency-based (sDAI, DAI related)
 */
function isCurrencyBased(tokenInfo) {
  if (!tokenInfo) return false;
  
  const symbol = tokenInfo.symbol?.toUpperCase() || '';
  return tokenInfo.asset === 'currency' || 
         symbol.includes('SDAI') || 
         symbol.includes('DAI') ||
         symbol.includes('CURRENCY');
}

/**
 * Get convention tag style
 */
export function getConventionTagStyle(convention) {
  switch (convention) {
    case 'currency_per_company':
      return 'bg-green-100 text-green-800';
    case 'position_per_base':
      return 'bg-blue-100 text-blue-800';
    case 'both_directions':
      return 'bg-gray-100 text-gray-800';
    case 'default_order':
      return 'bg-yellow-100 text-yellow-800';
    default:
      return 'bg-gray-100 text-gray-600';
  }
} 