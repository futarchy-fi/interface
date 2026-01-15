import React, { useState, useEffect, useCallback } from 'react';

const DEFAULT_PRICE_TIERS = [
  { threshold: 0.2, price: 0.01 }, // First 20% of tokens
  { threshold: 0.5, price: 0.05 }, // Next 30% (up to 50%)
  { threshold: 0.8, price: 0.10 }, // Next 30% (up to 80%)
  { threshold: 1.0, price: 0.20 }, // Final 20% (up to 100%)
];

// Mock bounding curve calculation
const calculateMintCost = (tokensToMint, totalTokens, priceTiers) => {
  if (tokensToMint <= 0 || totalTokens <= 0 || tokensToMint > totalTokens) {
    return 0;
  }

  let cost = 0;
  let tokensProcessed = 0;
  let remainingTokensToMint = tokensToMint;

  console.log('[TokenCreator] Calculating mint cost for:', { tokensToMint, totalTokens });

  for (let i = 0; i < priceTiers.length; i++) {
    const tier = priceTiers[i];
    const previousTierThresholdAbsolute = i === 0 ? 0 : priceTiers[i-1].threshold * totalTokens;
    const currentTierThresholdAbsolute = tier.threshold * totalTokens;
    
    const tokensInThisTierMax = currentTierThresholdAbsolute - previousTierThresholdAbsolute;
    const tokensToPriceInThisTier = Math.min(remainingTokensToMint, tokensInThisTierMax);

    if (tokensToPriceInThisTier <= 0) break;

    cost += tokensToPriceInThisTier * tier.price;
    remainingTokensToMint -= tokensToPriceInThisTier;
    tokensProcessed += tokensToPriceInThisTier;

    console.log(`[TokenCreator] Tier ${i + 1}: Priced ${tokensToPriceInThisTier} tokens at ${tier.price}. Remaining to mint: ${remainingTokensToMint}. Current cost: ${cost}`);
    
    if (remainingTokensToMint <= 0) break;
  }
  
  // Sanity check, should not happen if logic is correct and tokensToMint <= totalTokens
  if (remainingTokensToMint > 0) {
    console.warn("[TokenCreator] Warning: Not all tokens could be priced. This might indicate an issue with tier setup or total supply.", { remainingTokensToMint });
    // Apply a default high price for any overflow, or handle as an error
    // For this mock, we'll assume it's an error state and cost calculation might be incomplete.
  }

  console.log('[TokenCreator] Total calculated mint cost:', cost.toFixed(4));
  return parseFloat(cost.toFixed(4)); // Return with fixed precision
};


const defaultEmptyData = { 
  totalTokensToCreate: '', 
  tokensToMint: '',
  calculatedMintCost: 0,
  // Future: add fields for token name, symbol, bounding curve config, etc.
};

const ProposalTokenCreator = ({ initialData, onCompletionChange, stepId, priceTiers = DEFAULT_PRICE_TIERS }) => {
  const [totalTokensToCreate, setTotalTokensToCreate] = useState('');
  const [tokensToMint, setTokensToMint] = useState('');
  const [calculatedMintCost, setCalculatedMintCost] = useState(0);

  const [totalTokensError, setTotalTokensError] = useState('');
  const [tokensToMintError, setTokensToMintError] = useState('');

  // Memoize onCompletionChange to prevent unnecessary effect runs if parent passes a new function instance
  const stableOnCompletionChange = useCallback(onCompletionChange, []); 

  // Effect to initialize form with initialData
  useEffect(() => {
    const dataToUse = initialData || defaultEmptyData;
    console.log('[TokenCreator] Initializing with data:', dataToUse);
    
    setTotalTokensToCreate(String(dataToUse.totalTokensToCreate || ''));
    setTokensToMint(String(dataToUse.tokensToMint || ''));
    setCalculatedMintCost(dataToUse.calculatedMintCost || 0);

    // Initial validation and completion status
    const initialTotal = parseInt(dataToUse.totalTokensToCreate, 10);
    const initialMint = parseInt(dataToUse.tokensToMint, 10);
    const isValid = initialTotal > 0 && initialMint > 0 && initialMint <= initialTotal;
    
    stableOnCompletionChange(isValid, {
      totalTokensToCreate: initialTotal || '',
      tokensToMint: initialMint || '',
      calculatedMintCost: dataToUse.calculatedMintCost || 0,
    });
    setTotalTokensError('');
    setTokensToMintError('');

  }, [initialData, stableOnCompletionChange]);


  // Effect to recalculate cost and update parent on input changes
  useEffect(() => {
    const currentTotal = parseInt(totalTokensToCreate, 10);
    const currentMint = parseInt(tokensToMint, 10);

    let newCost = 0;
    let currentTotalError = '';
    let currentMintError = '';
    let isStepComplete = false;

    if (isNaN(currentTotal) || currentTotal <= 0) {
      if (totalTokensToCreate !== '') currentTotalError = 'Total tokens must be a positive number.';
    } else {
      currentTotalError = ''; // Clear error if valid
    }

    if (isNaN(currentMint) || currentMint <= 0) {
      if (tokensToMint !== '') currentMintError = 'Tokens to mint must be a positive number.';
    } else if (currentTotal > 0 && currentMint > currentTotal) {
      currentMintError = 'Cannot mint more tokens than created.';
    } else {
      currentMintError = ''; // Clear error if valid
    }
    
    setTotalTokensError(currentTotalError);
    setTokensToMintError(currentMintError);

    if (!isNaN(currentTotal) && currentTotal > 0 && !isNaN(currentMint) && currentMint > 0 && currentMint <= currentTotal) {
      console.log('[TokenCreator] Valid inputs, calculating cost for:', { currentMint, currentTotal });
      newCost = calculateMintCost(currentMint, currentTotal, priceTiers);
      isStepComplete = true; // Step is complete if inputs are valid and cost is calculated
    } else {
      console.log('[TokenCreator] Invalid inputs, cost calculation skipped.');
      newCost = 0; // Reset cost if inputs are invalid
      isStepComplete = false;
    }
    
    setCalculatedMintCost(newCost);

    if (stableOnCompletionChange) {
      const dataPayload = {
        totalTokensToCreate: totalTokensToCreate, // Send string to keep user input format
        tokensToMint: tokensToMint,             // Send string
        calculatedMintCost: newCost,
      };
      console.log('[TokenCreator] Calling onCompletionChange with:', { isStepComplete, dataPayload });
      stableOnCompletionChange(isStepComplete, dataPayload);
    }
  }, [totalTokensToCreate, tokensToMint, priceTiers, stableOnCompletionChange]);

  const handleInputChange = (setter, value) => {
    // Allow only numbers or empty string
    if (/^\d*$/.test(value)) {
      setter(value);
    }
  };

  return (
    <div className="space-y-6 p-4">
      <div>
        <label 
          htmlFor={`${stepId}-totalTokens`} 
          className="block text-sm font-medium text-futarchyGray11 dark:text-futarchyGray112 mb-1"
        >
          Total Tokens to Create (Max Supply)
        </label>
        <input
          type="text" // Using text to control input with regex, apply inputMode for numeric keyboard
          inputMode="numeric"
          pattern="[0-9]*"
          name="totalTokensToCreate"
          id={`${stepId}-totalTokens`}
          value={totalTokensToCreate}
          onChange={(e) => handleInputChange(setTotalTokensToCreate, e.target.value)}
          placeholder="e.g., 10000"
          className={`w-full px-3 py-2 bg-white dark:bg-futarchyDarkGray4 border rounded-md shadow-sm transition-colors duration-150 ease-in-out
                     text-futarchyGray12 dark:text-futarchyGray3 placeholder-futarchyGray9 dark:placeholder-futarchyGray8
                     focus:outline-none focus:ring-2 focus:ring-futarchyViolet7 dark:focus:ring-futarchyViolet6
                     ${totalTokensError ? 'border-futarchyCrimson9 dark:border-futarchyCrimson9 focus:ring-futarchyCrimson7' : 'border-futarchyGray6 dark:border-futarchyDarkGray5'}`}
        />
        {totalTokensError && <p className="mt-1 text-xs text-futarchyCrimson9 dark:text-futarchyCrimson9">{totalTokensError}</p>}
        <p className="mt-1 text-xs text-futarchyGray9 dark:text-futarchyGray10">
          Define the maximum number of tokens that can ever exist for this proposal.
        </p>
      </div>

      <div>
        <label 
          htmlFor={`${stepId}-tokensToMint`} 
          className="block text-sm font-medium text-futarchyGray11 dark:text-futarchyGray112 mb-1"
        >
          Tokens to Mint Now
        </label>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          name="tokensToMint"
          id={`${stepId}-tokensToMint`}
          value={tokensToMint}
          onChange={(e) => handleInputChange(setTokensToMint, e.target.value)}
          placeholder="e.g., 100"
          className={`w-full px-3 py-2 bg-white dark:bg-futarchyDarkGray4 border rounded-md shadow-sm transition-colors duration-150 ease-in-out
                     text-futarchyGray12 dark:text-futarchyGray3 placeholder-futarchyGray9 dark:placeholder-futarchyGray8
                     focus:outline-none focus:ring-2 focus:ring-futarchyViolet7 dark:focus:ring-futarchyViolet6
                     ${tokensToMintError ? 'border-futarchyCrimson9 dark:border-futarchyCrimson9 focus:ring-futarchyCrimson7' : 'border-futarchyGray6 dark:border-futarchyDarkGray5'}`}
        />
        {tokensToMintError && <p className="mt-1 text-xs text-futarchyCrimson9 dark:text-futarchyCrimson9">{tokensToMintError}</p>}
         <p className="mt-1 text-xs text-futarchyGray9 dark:text-futarchyGray10">
          Specify how many tokens you wish to mint initially. This cannot exceed the total tokens created.
        </p>
      </div>

      {tokensToMint > 0 && !tokensToMintError && !totalTokensError && totalTokensToCreate > 0 && (
        <div className="p-4 bg-futarchyGray2 dark:bg-futarchyDarkGray2 rounded-md border border-futarchyGray5 dark:border-futarchyDarkGray5">
          <h3 className="text-md font-semibold text-futarchyGray12 dark:text-futarchyGray3 mb-2">
            Minting Cost Summary
          </h3>
          <p className="text-sm text-futarchyGray11 dark:text-futarchyGray112">
            Tokens to Mint: <span className="font-medium text-futarchyViolet11 dark:text-futarchyViolet9">{parseInt(tokensToMint, 10) || 0}</span>
          </p>
          <p className="text-sm text-futarchyGray11 dark:text-futarchyGray112">
            Estimated Cost: <span className="font-medium text-futarchyViolet11 dark:text-futarchyViolet9">{calculatedMintCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</span> (Mock Units)
          </p>
          <p className="mt-2 text-xs text-futarchyGray9 dark:text-futarchyGray10">
            This is an estimated cost based on the current bonding curve configuration. Actual costs may vary with network conditions upon MetaMask integration.
          </p>
        </div>
      )}
      
      {/* Future: Placeholder for MetaMask integration button/status */}
      {/* <div className="mt-6 pt-4 border-t border-futarchyGray6 dark:border-futarchyDarkGray5">
        <button 
          type="button"
          // onClick={handleInitiateMetaMaskTx} // Example future function
          disabled={!isStepComplete} // Enable when inputs are valid
          className="w-full px-6 py-3 text-base font-medium rounded-md text-white bg-futarchyGreen10 hover:bg-futarchyGreen9 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-futarchyGreen8 dark:bg-futarchyGreen9 dark:hover:bg-futarchyGreen8 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Proceed to Mint with MetaMask (Future)
        </button>
      </div> */}
    </div>
  );
};

export default ProposalTokenCreator;
