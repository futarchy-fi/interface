// Chain Configuration
export const GNOSIS_CHAIN_ID = 100;

// Contract Addresses
export const FUTARCHY_ROUTER_ADDRESS = '0x7495a583ba85875d59407781b4958ED6e0E1228f';
export const MARKET_ADDRESS = '0xDA36a35CA4Fe6214C37a452159C0C9EAd45D5919';

// Futarchy Factory Configuration
export const FUTARCHY_FACTORY_ADDRESS = '0xa6cB18FCDC17a2B44E5cAd2d80a6D5942d30a345';
export const FUTARCHY_ADAPTER_ADDRESS = '0x7495a583ba85875d59407781b4958ED6e0E1228f';

// Proposal Creation Defaults
export const PROPOSAL_DEFAULTS = {
  COMPANY_TOKEN: '0x9C58BAcC331c9aa871AFD802DB6379a98e80CEdb', // GNO
  CURRENCY_TOKEN: '0xaf204776c7245bF4147c2612BF6e5972Ee483701', // SDAI
  MIN_BOND: '1000000000000000000', // 1 ETH
  CATEGORY: 'crypto',
  LANGUAGE: 'en',
  OPENING_TIME_MONTHS: 3 // Default: 3 months from now
};

// Base Token Addresses
export const BASE_CURRENCY_TOKEN_ADDRESS = '0xaf204776c7245bF4147c2612BF6e5972Ee483701'; // SDAI
export const BASE_COMPANY_TOKEN_ADDRESS = '0x9C58BAcC331c9aa871AFD802DB6379a98e80CEdb'; // GNO

// Swap Router Addresses
export const SWAPR_V3_ROUTER_ADDRESS = '0xffb643e73f280b97809a8b41f7232ab401a04ee1'; // Algebra/Swapr V3 Router
export const SUSHISWAP_V3_ROUTER_ADDRESS = '0x592abc3734cd0d458e6e44a2db2992a3d00283a4'; // SushiSwap V3 Router

// CoW Protocol Addresses
export const COW_VAULT_RELAYER_ADDRESS = '0xC92E8bdf79f0507f65a392b0ab4667716BFE0110'; // CoW Protocol Vault Relayer
export const COW_SETTLEMENT_ADDRESS = '0x9008D19f58AAbD9eD0D60971565AA8510560ab41'; // CoW Settlement Contract

// Position Token Addresses (YES/NO tokens)
export const POSITION_TOKENS = {
  currency: {
    yes: '0x9ea98d3f845c3b3bdb2310aa5c301505b61402c7', // YES_SDAI
    no: '0x24334a29a324ed40a08aaf035bbedff374313145',  // NO_SDAI
  },
  company: {
    yes: '0x481c7bfaf541d3c42a841a752c19c4664708ff5d', // YES_GNO
    no: '0x5cde0e3d8b69345b7a6143cfb3fdf4d4a6659d5d',  // NO_GNO
  }
};

// Algebra Pool Addresses
export const PREDICTION_POOLS = {
  no: {
    address: "0xb0F38743e0d55D60d5F84112eDFb15d985a4415e",
    description: "Base token vs NO position token"
  },
  yes: {
    address: "0x19109DB1e35a9Ba50807aedDa244dCfFc634EF6F",
    description: "Base token vs YES position token"
  }
};

export const CONDITIONAL_POOLS = {
  no: {
    address: "0xfbf1BE5CE2f9056dAaB1C368EC241ad7Be3507A8",
    description: "YES vs NO conditional tokens cross-asset"
  },
  yes: {
    address: "0xF336F812Db1ad142F22A9A4dd43D40e64B478361",
    description: "YES vs NO conditional tokens cross-asset"
  },
  base: {
    address: "0xd1d7fa8871d84d0e77020fc28b7cd5718c446522",
    description: "Base pool for conditional tokens"
  }
};

// All Known Pool Addresses
export const ALL_KNOWN_POOLS = {
  prediction_no: PREDICTION_POOLS.no,
  prediction_yes: PREDICTION_POOLS.yes,
  conditional_no: CONDITIONAL_POOLS.no,
  conditional_yes: CONDITIONAL_POOLS.yes,
  conditional_base: CONDITIONAL_POOLS.base
};

// Base Token Configuration
export const BASE_TOKENS_CONFIG = {
  currency: {
    address: BASE_CURRENCY_TOKEN_ADDRESS,
    symbol: "SDAI",
    name: "Savings DAI",
    decimals: 18
  },
  company: {
    address: BASE_COMPANY_TOKEN_ADDRESS,
    symbol: "GNO", 
    name: "Gnosis",
    decimals: 18
  }
};

// All token addresses for easy access in SwapManager
export const ALL_TOKENS = {
  'sDAI': BASE_CURRENCY_TOKEN_ADDRESS,
  'GNO': BASE_COMPANY_TOKEN_ADDRESS,
  'YES_sDAI': POSITION_TOKENS.currency.yes,
  'YES_GNO': POSITION_TOKENS.company.yes,
  'NO_sDAI': POSITION_TOKENS.currency.no,
  'NO_GNO': POSITION_TOKENS.company.no
}; 