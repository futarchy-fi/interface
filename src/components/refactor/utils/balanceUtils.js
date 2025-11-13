import { ethers } from 'ethers';
import { ERC20_ABI } from '../abis';
import { 
  BASE_CURRENCY_TOKEN_ADDRESS,
  BASE_COMPANY_TOKEN_ADDRESS,
  POSITION_TOKENS
} from '../constants/addresses';
import { getProposalData } from './proposalUtils';

// Get provider
export const getWeb3Provider = () => {
  if (!window.ethereum) {
    throw new Error('Please install MetaMask!');
  }
  return new ethers.providers.Web3Provider(window.ethereum);
};

// Get native xDAI balance
export const getNativeBalance = async (userAddress) => {
  if (!userAddress) return '0';
  
  try {
    const provider = getWeb3Provider();
    const balance = await provider.getBalance(userAddress);
    return ethers.utils.formatUnits(balance, 18);
  } catch (error) {
    console.error('Error fetching native balance:', error);
    return '0';
  }
};

// Get ERC20 token balance
export const getTokenBalance = async (tokenAddress, userAddress) => {
  if (!userAddress || !tokenAddress) return '0';
  
  try {
    const provider = getWeb3Provider();
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const balance = await tokenContract.balanceOf(userAddress);
    return ethers.utils.formatUnits(balance, 18);
  } catch (error) {
    console.error(`Error fetching token balance for ${tokenAddress}:`, error);
    return '0';
  }
};

// Get token symbol with fallback
export const getTokenSymbol = async (tokenAddress) => {
  if (!tokenAddress) return 'UNKNOWN';
  
  try {
    const provider = getWeb3Provider();
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    
    // Add timeout to avoid hanging requests
    const symbolPromise = tokenContract.symbol();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), 5000)
    );
    
    const symbol = await Promise.race([symbolPromise, timeoutPromise]);
    return symbol || 'UNKNOWN';
  } catch (error) {
    console.error(`Error fetching token symbol for ${tokenAddress}:`, error);
    
    // Return fallback symbols based on known addresses
    if (tokenAddress.toLowerCase() === BASE_CURRENCY_TOKEN_ADDRESS.toLowerCase()) return 'SDAI';
    if (tokenAddress.toLowerCase() === BASE_COMPANY_TOKEN_ADDRESS.toLowerCase()) return 'GNO';
    if (tokenAddress.toLowerCase() === POSITION_TOKENS.currency.yes.toLowerCase()) return 'YES_SDAI';
    if (tokenAddress.toLowerCase() === POSITION_TOKENS.currency.no.toLowerCase()) return 'NO_SDAI';
    if (tokenAddress.toLowerCase() === POSITION_TOKENS.company.yes.toLowerCase()) return 'YES_GNO';
    if (tokenAddress.toLowerCase() === POSITION_TOKENS.company.no.toLowerCase()) return 'NO_GNO';
    
    return 'UNKNOWN';
  }
};

// Get token name with fallback
export const getTokenName = async (tokenAddress) => {
  if (!tokenAddress) return 'Unknown Token';
  
  try {
    const provider = getWeb3Provider();
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    
    // Add timeout to avoid hanging requests
    const namePromise = tokenContract.name();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), 5000)
    );
    
    const name = await Promise.race([namePromise, timeoutPromise]);
    return name || 'Unknown Token';
  } catch (error) {
    console.error(`Error fetching token name for ${tokenAddress}:`, error);
    
    // Return fallback names based on known addresses
    if (tokenAddress.toLowerCase() === BASE_CURRENCY_TOKEN_ADDRESS.toLowerCase()) return 'Savings DAI';
    if (tokenAddress.toLowerCase() === BASE_COMPANY_TOKEN_ADDRESS.toLowerCase()) return 'Gnosis';
    if (tokenAddress.toLowerCase() === POSITION_TOKENS.currency.yes.toLowerCase()) return 'YES Savings DAI';
    if (tokenAddress.toLowerCase() === POSITION_TOKENS.currency.no.toLowerCase()) return 'NO Savings DAI';
    if (tokenAddress.toLowerCase() === POSITION_TOKENS.company.yes.toLowerCase()) return 'YES Gnosis';
    if (tokenAddress.toLowerCase() === POSITION_TOKENS.company.no.toLowerCase()) return 'NO Gnosis';
    
    return 'Unknown Token';
  }
};

// Get all token addresses from config (HARDCODED VERSION - for backward compatibility)
export const getTokenAddresses = () => {
  return {
    // Base tokens
    baseCurrency: BASE_CURRENCY_TOKEN_ADDRESS,
    baseCompany: BASE_COMPANY_TOKEN_ADDRESS,
    
    // Currency position tokens
    currencyYes: POSITION_TOKENS.currency.yes,
    currencyNo: POSITION_TOKENS.currency.no,
    
    // Company position tokens
    companyYes: POSITION_TOKENS.company.yes,
    companyNo: POSITION_TOKENS.company.no,
  };
};

// Get token addresses for a specific proposal (USING REAL PROPOSAL CONTRACT DATA)
export const getProposalTokenAddresses = async (proposalAddress) => {
  if (!proposalAddress) {
    console.warn('No proposal address provided, falling back to hardcoded addresses');
    return getTokenAddresses();
  }

  try {
    console.log(`🔍 Getting REAL token addresses from proposal contract: ${proposalAddress}`);
    
    // 🎯 USE EXISTING PROPOSAL READING FUNCTIONALITY!
    // This reads the actual wrappedOutcomes from the proposal contract
    const proposalData = await getProposalData(proposalAddress);
    
    console.log('✅ Got real proposal data:', proposalData);
    console.log('🎯 Real wrapped outcomes:', proposalData.wrappedOutcomes);
    console.log('🎯 Real token mapping:', proposalData.tokens);
    
    // Convert to the format expected by getAllBalances
    const tokenAddresses = {
      // Base tokens (collateral from proposal contract)
      baseCurrency: proposalData.tokens.currencyToken,  // Real currency token from proposal
      baseCompany: proposalData.tokens.companyToken,    // Real company token from proposal
      
      // Wrapped outcome tokens (YES/NO tokens specific to this proposal!)
      currencyYes: proposalData.tokens.yesCurrencyToken,  // Real YES_CURRENCY from wrappedOutcome[2]
      currencyNo: proposalData.tokens.noCurrencyToken,    // Real NO_CURRENCY from wrappedOutcome[3]
      companyYes: proposalData.tokens.yesCompanyToken,    // Real YES_COMPANY from wrappedOutcome[0]
      companyNo: proposalData.tokens.noCompanyToken,      // Real NO_COMPANY from wrappedOutcome[1]
    };
    
    console.log(`✅ Real proposal ${proposalAddress} token addresses:`, tokenAddresses);
    
    return tokenAddresses;
    
  } catch (error) {
    console.error('Error fetching real proposal token addresses:', error);
    console.log('🔄 Falling back to hardcoded addresses');
    return getTokenAddresses(); // Fallback to hardcoded
  }
};

// Get all balances for a user
export const getAllBalances = async (userAddress, tokenAddresses = null) => {
  if (!userAddress) {
    return {
      native: '0',
      baseCurrency: '0',
      baseCompany: '0',
      currencyYes: '0',
      currencyNo: '0',
      companyYes: '0',
      companyNo: '0',
    };
  }

  try {
    const addresses = tokenAddresses || getTokenAddresses();
    
    // Fetch all balances in parallel
    const [
      nativeBalance,
      baseCurrencyBalance,
      baseCompanyBalance,
      currencyYesBalance,
      currencyNoBalance,
      companyYesBalance,
      companyNoBalance,
    ] = await Promise.all([
      getNativeBalance(userAddress),
      getTokenBalance(addresses.baseCurrency, userAddress),
      getTokenBalance(addresses.baseCompany, userAddress),
      getTokenBalance(addresses.currencyYes, userAddress),
      getTokenBalance(addresses.currencyNo, userAddress),
      getTokenBalance(addresses.companyYes, userAddress),
      getTokenBalance(addresses.companyNo, userAddress),
    ]);

    return {
      native: nativeBalance,
      baseCurrency: baseCurrencyBalance,
      baseCompany: baseCompanyBalance,
      currencyYes: currencyYesBalance,
      currencyNo: currencyNoBalance,
      companyYes: companyYesBalance,
      companyNo: companyNoBalance,
    };
  } catch (error) {
    console.error('Error fetching all balances:', error);
    return {
      native: '0',
      baseCurrency: '0',
      baseCompany: '0',
      currencyYes: '0',
      currencyNo: '0',
      companyYes: '0',
      companyNo: '0',
    };
  }
};

// Get all token metadata (symbols and names) with better error handling
export const getAllTokenMetadata = async (tokenAddresses = null) => {
  const addresses = tokenAddresses || getTokenAddresses();
  
  // Define fallback metadata
  const fallbackMetadata = {
    native: { symbol: 'xDAI', name: 'xDAI', address: 'native' },
    baseCurrency: { symbol: 'SDAI', name: 'Savings DAI', address: addresses.baseCurrency },
    baseCompany: { symbol: 'GNO', name: 'Gnosis', address: addresses.baseCompany },
    currencyYes: { symbol: 'YES_SDAI', name: 'YES Savings DAI', address: addresses.currencyYes },
    currencyNo: { symbol: 'NO_SDAI', name: 'NO Savings DAI', address: addresses.currencyNo },
    companyYes: { symbol: 'YES_GNO', name: 'YES Gnosis', address: addresses.companyYes },
    companyNo: { symbol: 'NO_GNO', name: 'NO Gnosis', address: addresses.companyNo },
  };

  try {
    // Try to fetch real metadata with timeout for each token
    const tokenPromises = [
      { key: 'baseCurrency', address: addresses.baseCurrency },
      { key: 'baseCompany', address: addresses.baseCompany },
      { key: 'currencyYes', address: addresses.currencyYes },
      { key: 'currencyNo', address: addresses.currencyNo },
      { key: 'companyYes', address: addresses.companyYes },
      { key: 'companyNo', address: addresses.companyNo },
    ].map(async ({ key, address }) => {
      try {
        const [symbol, name] = await Promise.all([
          getTokenSymbol(address),
          getTokenName(address)
        ]);
        return { key, symbol, name, address };
      } catch (error) {
        console.warn(`Failed to fetch metadata for ${key}, using fallback`);
        return { 
          key, 
          symbol: fallbackMetadata[key].symbol, 
          name: fallbackMetadata[key].name, 
          address 
        };
      }
    });

    const results = await Promise.allSettled(tokenPromises);
    const metadata = { ...fallbackMetadata };

    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        const { key, symbol, name, address } = result.value;
        metadata[key] = { symbol, name, address };
      }
    });

    return metadata;
  } catch (error) {
    console.error('Error fetching token metadata, using fallbacks:', error);
    return fallbackMetadata;
  }
};

// Format balance for display
export const formatBalance = (balance, decimals = 4) => {
  if (!balance || balance === '0') return '0';
  
  const num = parseFloat(balance);
  if (num === 0) return '0';
  
  // For very small numbers, use exponential notation but don't round
  if (num < 0.0001) {
    return num.toExponential();
  }
  
  // Return the full balance without rounding
  return balance.toString();
};

// Calculate total value (if you have price data)
export const calculateTotalValue = (balances, prices = {}) => {
  let total = 0;
  
  Object.entries(balances).forEach(([token, balance]) => {
    if (prices[token]) {
      total += parseFloat(balance) * parseFloat(prices[token]);
    }
  });
  
  // Return full precision, no rounding
  return total.toString();
}; 