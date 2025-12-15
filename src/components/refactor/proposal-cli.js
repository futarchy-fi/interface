#!/usr/bin/env node

/**
 * Simple Terminal Proposal Data Fetcher
 * Run with: node proposal-cli.js
 * 
 * This script allows you to input a proposal address and get basic proposal data
 * using pure JavaScript and ethers without the React components.
 */

const { ethers } = require('ethers');
const readline = require('readline');

// Configuration
const GNOSIS_RPC_URL = 'https://rpc.gnosischain.com';
const GNOSIS_CHAIN_ID = 100;

// Proposal Contract ABI (minimal for data reading)
const FUTARCHY_PROPOSAL_ABI = [
  {
    "inputs": [],
    "name": "marketName",
    "outputs": [{"internalType": "string", "name": "", "type": "string"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "collateralToken1",
    "outputs": [{"internalType": "contract IERC20", "name": "", "type": "address"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "collateralToken2", 
    "outputs": [{"internalType": "contract IERC20", "name": "", "type": "address"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "conditionId",
    "outputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "questionId",
    "outputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "numOutcomes",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "index", "type": "uint256"}],
    "name": "wrappedOutcome",
    "outputs": [
      {"internalType": "contract IERC20", "name": "wrapped1155", "type": "address"},
      {"internalType": "bytes", "name": "data", "type": "bytes"}
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

// ERC20 ABI for token details
const ERC20_ABI = [
  {
    "inputs": [],
    "name": "name",
    "outputs": [{"internalType": "string", "name": "", "type": "string"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "symbol",
    "outputs": [{"internalType": "string", "name": "", "type": "string"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "decimals",
    "outputs": [{"internalType": "uint8", "name": "", "type": "uint8"}],
    "stateMutability": "view",
    "type": "function"
  }
];

// Reality.io ABI for opening time
const REALITY_ETH_ABI = [
  {
    "inputs": [{"internalType": "bytes32", "name": "question_id", "type": "bytes32"}],
    "name": "getOpeningTS",
    "outputs": [{"internalType": "uint32", "name": "", "type": "uint32"}],
    "stateMutability": "view",
    "type": "function"
  }
];

const REALITY_ETH_ADDRESS = '0xE78996A233895bE74a66F451f1019cA9734205cc';

/**
 * Get provider for Gnosis Chain
 */
function getProvider() {
  return new ethers.providers.JsonRpcProvider(GNOSIS_RPC_URL, {
    chainId: GNOSIS_CHAIN_ID,
    name: 'gnosis'
  });
}

/**
 * Get proposal contract instance
 */
function getProposalContract(proposalAddress, provider) {
  return new ethers.Contract(proposalAddress, FUTARCHY_PROPOSAL_ABI, provider);
}

/**
 * Get ERC20 contract instance
 */
function getERC20Contract(tokenAddress, provider) {
  return new ethers.Contract(tokenAddress, ERC20_ABI, provider);
}

/**
 * Get Reality.io contract instance
 */
function getRealityContract(provider) {
  return new ethers.Contract(REALITY_ETH_ADDRESS, REALITY_ETH_ABI, provider);
}

/**
 * Get token metadata
 */
async function getTokenMetadata(tokenAddress, provider) {
  try {
    const contract = getERC20Contract(tokenAddress, provider);
    const [name, symbol, decimals] = await Promise.all([
      contract.name(),
      contract.symbol(),
      contract.decimals()
    ]);
    
    return { name, symbol, decimals, address: tokenAddress };
  } catch (error) {
    console.warn(`Warning: Could not read token metadata for ${tokenAddress}:`, error.message);
    return { 
      name: 'Unknown Token', 
      symbol: 'UNKNOWN', 
      decimals: 18, 
      address: tokenAddress 
    };
  }
}

/**
 * Get proposal opening time from Reality.io
 */
async function getOpeningTime(questionId, provider) {
  try {
    const realityContract = getRealityContract(provider);
    const openingTs = await realityContract.getOpeningTS(questionId);
    
    if (openingTs.toNumber() === 0) {
      return null;
    }
    
    const openingTime = new Date(openingTs.toNumber() * 1000);
    const now = new Date();
    const isOpen = now >= openingTime;
    
    return {
      timestamp: openingTs.toNumber(),
      date: openingTime,
      isOpen,
      timeUntil: isOpen ? 0 : openingTime.getTime() - now.getTime()
    };
  } catch (error) {
    console.warn('Warning: Could not read opening time from Reality.io:', error.message);
    return null;
  }
}

/**
 * Fetch and display proposal data
 */
async function fetchProposalData(proposalAddress) {
  console.log('\n🔍 Fetching proposal data...\n');
  
  try {
    const provider = getProvider();
    const contract = getProposalContract(proposalAddress, provider);
    
    // Get basic proposal data
    console.log('📋 Reading basic proposal info...');
    const [
      marketName,
      collateralToken1,
      collateralToken2,
      conditionId,
      questionId,
      numOutcomes
    ] = await Promise.all([
      contract.marketName(),
      contract.collateralToken1(),
      contract.collateralToken2(),
      contract.conditionId(),
      contract.questionId(),
      contract.numOutcomes()
    ]);
    
    // Get token metadata
    console.log('🪙 Reading token metadata...');
    const [companyToken, currencyToken] = await Promise.all([
      getTokenMetadata(collateralToken1, provider),
      getTokenMetadata(collateralToken2, provider)
    ]);
    
    // Get wrapped outcomes
    console.log('🎯 Reading wrapped outcomes...');
    const wrappedOutcomes = [];
    for (let i = 0; i < numOutcomes.toNumber(); i++) {
      const outcome = await contract.wrappedOutcome(i);
      wrappedOutcomes.push({
        index: i,
        address: outcome.wrapped1155,
        data: outcome.data
      });
    }
    
    // Get opening time
    console.log('⏰ Reading opening time from Reality.io...');
    const openingTime = await getOpeningTime(questionId, provider);
    
    // Display results
    console.log('\n' + '='.repeat(60));
    console.log('📊 PROPOSAL DATA SUMMARY');
    console.log('='.repeat(60));
    
    console.log(`\n📋 Basic Info:`);
    console.log(`   Market Name: ${marketName}`);
    console.log(`   Proposal Address: ${proposalAddress}`);
    console.log(`   Condition ID: ${conditionId}`);
    console.log(`   Question ID: ${questionId}`);
    console.log(`   Number of Outcomes: ${numOutcomes.toString()}`);
    
    console.log(`\n🪙 Collateral Tokens:`);
    console.log(`   Company Token: ${companyToken.name} (${companyToken.symbol})`);
    console.log(`      Address: ${companyToken.address}`);
    console.log(`      Decimals: ${companyToken.decimals}`);
    console.log(`   Currency Token: ${currencyToken.name} (${currencyToken.symbol})`);
    console.log(`      Address: ${currencyToken.address}`);
    console.log(`      Decimals: ${currencyToken.decimals}`);
    
    console.log(`\n🎯 Wrapped Outcome Tokens:`);
    wrappedOutcomes.forEach((outcome, index) => {
      const tokenType = index < 2 ? 'Company' : 'Currency';
      const position = index % 2 === 0 ? 'YES' : 'NO';
      console.log(`   [${outcome.index}] ${position}_${tokenType}: ${outcome.address}`);
    });
    
    if (openingTime) {
      console.log(`\n⏰ Voting Schedule:`);
      console.log(`   Opening Time: ${openingTime.date.toISOString()}`);
      console.log(`   Local Time: ${openingTime.date.toLocaleString()}`);
      console.log(`   Status: ${openingTime.isOpen ? '🟢 OPEN FOR VOTING' : '🔴 NOT YET OPEN'}`);
      if (!openingTime.isOpen) {
        const days = Math.floor(openingTime.timeUntil / (1000 * 60 * 60 * 24));
        const hours = Math.floor((openingTime.timeUntil % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        console.log(`   Time Until Opening: ${days}d ${hours}h`);
      }
    } else {
      console.log(`\n⏰ Voting Schedule: ❓ Opening time not available`);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Data fetch completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Error fetching proposal data:');
    console.error(error.message);
    
    if (error.message.includes('INVALID_ARGUMENT')) {
      console.error('\n💡 Tip: Make sure the proposal address is valid and checksummed');
    } else if (error.message.includes('CALL_EXCEPTION')) {
      console.error('\n💡 Tip: The address might not be a valid proposal contract');
    }
  }
}

/**
 * Prompt user for proposal address
 */
function promptForProposal() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  console.log('🏛️ Futarchy Proposal Data Fetcher');
  console.log('================================\n');
  console.log('Enter a proposal address to fetch its data from Gnosis Chain.');
  console.log('Example: 0xDA36a35CA4Fe6214C37a452159C0C9EAd45D5919\n');
  
  rl.question('Proposal Address: ', async (proposalAddress) => {
    if (!proposalAddress.trim()) {
      console.log('❌ Please enter a valid proposal address');
      rl.close();
      return;
    }
    
    // Validate address format
    if (!ethers.utils.isAddress(proposalAddress.trim())) {
      console.log('❌ Invalid Ethereum address format');
      rl.close();
      return;
    }
    
    await fetchProposalData(proposalAddress.trim());
    
    // Ask if they want to fetch another proposal
    rl.question('\nFetch another proposal? (y/n): ', (answer) => {
      if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
        rl.close();
        promptForProposal(); // Recursive call
      } else {
        console.log('\n👋 Goodbye!');
        rl.close();
      }
    });
  });
}

// Main execution
if (require.main === module) {
  promptForProposal();
}

module.exports = {
  fetchProposalData,
  getProvider,
  getProposalContract,
  getTokenMetadata,
  getOpeningTime
}; 