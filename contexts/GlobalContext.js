import React, { createContext, useState, useContext, useEffect } from "react";

// Create the context
export const GlobalContext = createContext();

// Custom hook to use the GlobalContext
export const useGlobalContext = () => useContext(GlobalContext);

// Create a provider component that reacts to changes in args
export const GlobalProvider = ({
  children,
  currencyMarketValue = 10000,
  selectedCurrency = "USD",
  selectedSymbol = "BTC",
  precision = { "crypto": 4, "dollar": 2 }
}) => {
 


  return (
    <GlobalContext.Provider
      value={{
        currencyMarketValue,
        selectedCurrency,
        selectedSymbol,
        precision,
    
      }}
    >
      {children}
    </GlobalContext.Provider>
  );
};
