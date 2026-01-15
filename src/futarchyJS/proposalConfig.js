/**
 * @fileoverview Futarchy Proposal Configuration Manager
 * 
 * Helper module for creating and validating proposal configuration files
 * that are compatible with the FutarchyProposalLiquidity.s.sol script.
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { ethers } from 'ethers';

// Load environment variables
dotenv.config();

/**
 * Validates an Ethereum address
 * @param {string} address - Address to validate
 * @returns {boolean} Whether the address is valid
 */
export const isValidAddress = (address) => {
  try {
    return ethers.utils.isAddress(address);
  } catch (e) {
    return false;
  }
};

/**
 * Validates a token amount (must be a valid decimal or wei string)
 * @param {string} amount - Amount to validate
 * @returns {boolean} Whether the amount is valid
 */
export const isValidTokenAmount = (amount) => {
  try {
    // Check if it's a valid decimal string
    if (/^\d+(\.\d+)?$/.test(amount)) {
      return true;
    }
    
    // Check if it's a valid wei string (large integer)
    if (/^\d+$/.test(amount)) {
      return true;
    }
    
    return false;
  } catch (e) {
    return false;
  }
};

/**
 * Creates a proposal configuration object
 * @param {Object} params - Parameters for the proposal
 * @returns {Object} Proposal configuration object
 */
export const createProposalConfig = ({
  name,
  question,
  category = process.env.DEFAULT_CATEGORY || 'governance',
  lang = process.env.DEFAULT_LANG || 'en',
  collateralToken1,
  collateralToken2,
  minBond = process.env.DEFAULT_MIN_BOND || '1000000000000000000',
  openingTime = process.env.DEFAULT_OPENING_TIME || 0,
  wxdaiAmount = process.env.DEFAULT_WXDAI_AMOUNT || '1000000000000000000',
  token1Amount = process.env.DEFAULT_TOKEN1_AMOUNT || '1000000000000000000',
  token2Amount = process.env.DEFAULT_TOKEN2_AMOUNT || '1000000000000000000'
}) => {
  // Validate required parameters
  if (!name) throw new Error('Proposal name is required');
  if (!question) throw new Error('Proposal question is required');
  if (!collateralToken1 || !isValidAddress(collateralToken1)) 
    throw new Error('Valid collateralToken1 address is required');
  if (!collateralToken2 || !isValidAddress(collateralToken2))
    throw new Error('Valid collateralToken2 address is required');
  
  // Validate token amounts
  if (!isValidTokenAmount(minBond)) throw new Error('Invalid minBond amount');
  if (!isValidTokenAmount(wxdaiAmount)) throw new Error('Invalid wxdaiAmount');
  if (!isValidTokenAmount(token1Amount)) throw new Error('Invalid token1Amount');
  if (!isValidTokenAmount(token2Amount)) throw new Error('Invalid token2Amount');
  
  // Create the configuration object
  return {
    name,
    question,
    category,
    lang,
    collateralToken1,
    collateralToken2,
    minBond: minBond.toString(),
    openingTime: parseInt(openingTime),
    liquidity: {
      wxdaiAmount: wxdaiAmount.toString(),
      token1Amount: token1Amount.toString(),
      token2Amount: token2Amount.toString()
    }
  };
};

/**
 * Saves a proposal configuration to a JSON file
 * @param {Object} config - Proposal configuration object
 * @param {string} filePath - Path to save the file
 * @returns {string} Path to the saved file
 */
export const saveProposalConfig = (config, filePath) => {
  const configJson = JSON.stringify(config, null, 2);
  
  if (!filePath) {
    const timestamp = Math.floor(Date.now() / 1000);
    filePath = path.join(process.cwd(), `proposal_config_${timestamp}.json`);
  }
  
  fs.writeFileSync(filePath, configJson);
  return filePath;
};

/**
 * Loads a proposal configuration from a JSON file
 * @param {string} filePath - Path to the configuration file
 * @returns {Object} Proposal configuration object
 */
export const loadProposalConfig = (filePath) => {
  try {
    const configJson = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(configJson);
  } catch (error) {
    throw new Error(`Failed to load proposal config from ${filePath}: ${error.message}`);
  }
};

/**
 * Validates a proposal configuration
 * @param {Object} config - Proposal configuration to validate
 * @returns {Object} Validation result
 */
export const validateProposalConfig = (config) => {
  const errors = [];
  
  // Check required fields
  if (!config.name) errors.push('Missing proposal name');
  if (!config.question) errors.push('Missing proposal question');
  if (!config.collateralToken1) errors.push('Missing collateralToken1');
  if (!config.collateralToken2) errors.push('Missing collateralToken2');
  
  // Validate addresses
  if (config.collateralToken1 && !isValidAddress(config.collateralToken1))
    errors.push('Invalid collateralToken1 address');
  if (config.collateralToken2 && !isValidAddress(config.collateralToken2))
    errors.push('Invalid collateralToken2 address');
  
  // Validate liquidity section
  if (!config.liquidity) {
    errors.push('Missing liquidity configuration');
  } else {
    if (!config.liquidity.wxdaiAmount) errors.push('Missing wxdaiAmount in liquidity');
    if (!config.liquidity.token1Amount) errors.push('Missing token1Amount in liquidity');
    if (!config.liquidity.token2Amount) errors.push('Missing token2Amount in liquidity');
    
    // Validate amounts
    if (config.liquidity.wxdaiAmount && !isValidTokenAmount(config.liquidity.wxdaiAmount))
      errors.push('Invalid wxdaiAmount');
    if (config.liquidity.token1Amount && !isValidTokenAmount(config.liquidity.token1Amount))
      errors.push('Invalid token1Amount');
    if (config.liquidity.token2Amount && !isValidTokenAmount(config.liquidity.token2Amount))
      errors.push('Invalid token2Amount');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Creates a proposal configuration with common tokens
 * @param {string} name - Proposal name
 * @param {string} question - Proposal question
 * @returns {Object} Proposal configuration object
 */
export const createCommonProposalConfig = (name, question) => {
  return createProposalConfig({
    name,
    question,
    collateralToken1: process.env.SDAI_ADDRESS,
    collateralToken2: process.env.GNO_ADDRESS
  });
};

/**
 * Gets a sample proposal configuration for testing
 * @returns {Object} Sample proposal configuration
 */
export const getSampleProposalConfig = () => {
  return {
    name: "Sample Proposal",
    question: "Should we implement feature X?",
    category: "governance",
    lang: "en",
    collateralToken1: "0xaf204776c7245bF4147c2612BF6e5972Ee483701", // SDAI on Gnosis
    collateralToken2: "0x9C58BAcC331c9aa871AFD802DB6379a98e80CEdb", // GNO on Gnosis
    minBond: "1000000000000000000", // 1 XDAI
    openingTime: 0, // Immediate
    liquidity: {
      wxdaiAmount: "1000000000000000000", // 1 WXDAI
      token1Amount: "1000000000000000000", // 1 Token1
      token2Amount: "1000000000000000000"  // 1 Token2
    }
  };
};

export default {
  createProposalConfig,
  saveProposalConfig,
  loadProposalConfig,
  validateProposalConfig,
  createCommonProposalConfig,
  getSampleProposalConfig,
  isValidAddress,
  isValidTokenAmount
}; 