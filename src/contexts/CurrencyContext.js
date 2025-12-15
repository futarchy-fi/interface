import React, { createContext, useState, useContext, useMemo, useEffect } from 'react';
import { useAccount } from 'wagmi';

// Configuration flag to hide wXDAI option
const HIDE_WXDAI_OPTION = true; // Set to false to show wXDAI option

// Create the context
const CurrencyContext = createContext();

// Create a provider component
export const CurrencyProvider = ({ children, baseTokenSymbol = null }) => {
  const { chain } = useAccount();
  const isGnosisChain = chain?.id === 100;

  // Initialize with null - will be set when baseTokenSymbol is provided
  const [selectedCurrency, setSelectedCurrency] = useState(null);

  // Set initial currency when baseTokenSymbol is available
  useEffect(() => {
    if (baseTokenSymbol && !selectedCurrency) {
      setSelectedCurrency(baseTokenSymbol);
    }
  }, [baseTokenSymbol, selectedCurrency]);

  // Fallback to chain-based default if no baseTokenSymbol is provided
  useEffect(() => {
    if (!baseTokenSymbol && !selectedCurrency) {
      const isMainnet = chain?.id === 1;
      setSelectedCurrency(isMainnet ? 'USDS' : 'SDAI');
    }
  }, [chain, baseTokenSymbol, selectedCurrency]);

  // WXDAI toggle is only available on Gnosis Chain (100) and when not hidden by flag
  const allowWXDAI = isGnosisChain && !HIDE_WXDAI_OPTION;

  // Memoize the context value to prevent unnecessary re-renders
  // baseTokenSymbol for display should be the selected currency if it's not WXDAI
  const effectiveBaseTokenSymbol = selectedCurrency === 'WXDAI' ? baseTokenSymbol : selectedCurrency;

  const value = useMemo(() => ({
    selectedCurrency,
    setSelectedCurrency,
    baseTokenSymbol: effectiveBaseTokenSymbol || baseTokenSymbol,
    allowWXDAI
  }), [selectedCurrency, effectiveBaseTokenSymbol, baseTokenSymbol, allowWXDAI]);

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
};

// Create a custom hook for easy context consumption
export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
};

// Hook to update base token symbol from market config
// Call this hook in market pages to sync currency with market's base token
export const useUpdateCurrencyFromConfig = (config) => {
  const { setSelectedCurrency, selectedCurrency } = useCurrency();
  const [hasInitialized, setHasInitialized] = useState(false);

  useEffect(() => {
    const baseSymbol = config?.BASE_TOKENS_CONFIG?.currency?.symbol || config?.metadata?.baseToken?.symbol;

    // Only update if we have a base symbol and haven't initialized yet or currency is null
    if (baseSymbol && (!hasInitialized || !selectedCurrency)) {
      setSelectedCurrency(baseSymbol);
      setHasInitialized(true);
    }
  }, [config, setSelectedCurrency, selectedCurrency, hasInitialized]);
}; 