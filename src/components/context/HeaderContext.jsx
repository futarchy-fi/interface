import React, { createContext, useContext } from 'react';

const HeaderContext = createContext({
  config: {
    companies: {
      additionalElements: [],
      // Add other default values here
    }
  }
});

export const HeaderProvider = ({ children, value }) => (
  <HeaderContext.Provider value={value}>
    {children}
  </HeaderContext.Provider>
);

export const useHeader = () => useContext(HeaderContext);

export default HeaderContext; 