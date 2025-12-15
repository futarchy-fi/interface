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

// Reality.io ABI for opening time (complete ABI from working refactor)
const REALITY_ETH_ABI = [
  {"inputs":[],"stateMutability":"nonpayable","type":"constructor"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"question_id","type":"bytes32"},{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":true,"internalType":"bytes32","name":"answer_hash","type":"bytes32"},{"indexed":false,"internalType":"bytes32","name":"answer","type":"bytes32"},{"indexed":false,"internalType":"uint256","name":"nonce","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"bond","type":"uint256"}],"name":"LogAnswerReveal","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"question_id","type":"bytes32"}],"name":"LogCancelArbitration","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"question_id","type":"bytes32"},{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"LogClaim","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"question_id","type":"bytes32"},{"indexed":true,"internalType":"bytes32","name":"answer","type":"bytes32"}],"name":"LogFinalize","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"question_id","type":"bytes32"},{"indexed":false,"internalType":"uint256","name":"bounty_added","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"bounty","type":"uint256"},{"indexed":true,"internalType":"address","name":"user","type":"address"}],"name":"LogFundAnswerBounty","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"question_id","type":"bytes32"},{"indexed":false,"internalType":"uint256","name":"min_bond","type":"uint256"}],"name":"LogMinimumBond","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":false,"internalType":"bytes32","name":"answer","type":"bytes32"},{"indexed":true,"internalType":"bytes32","name":"question_id","type":"bytes32"},{"indexed":false,"internalType":"bytes32","name":"history_hash","type":"bytes32"},{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":false,"internalType":"uint256","name":"bond","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"ts","type":"uint256"},{"indexed":false,"internalType":"bool","name":"is_commitment","type":"bool"}],"name":"LogNewAnswer","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"question_id","type":"bytes32"},{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":false,"internalType":"uint256","name":"template_id","type":"uint256"},{"indexed":false,"internalType":"string","name":"question","type":"string"},{"indexed":true,"internalType":"bytes32","name":"content_hash","type":"bytes32"},{"indexed":false,"internalType":"address","name":"arbitrator","type":"address"},{"indexed":false,"internalType":"uint32","name":"timeout","type":"uint32"},{"indexed":false,"internalType":"uint32","name":"opening_ts","type":"uint32"},{"indexed":false,"internalType":"uint256","name":"nonce","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"created","type":"uint256"}],"name":"LogNewQuestion","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"template_id","type":"uint256"},{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":false,"internalType":"string","name":"question_text","type":"string"}],"name":"LogNewTemplate","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"question_id","type":"bytes32"},{"indexed":true,"internalType":"address","name":"user","type":"address"}],"name":"LogNotifyOfArbitrationRequest","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"question_id","type":"bytes32"},{"indexed":true,"internalType":"bytes32","name":"reopened_question_id","type":"bytes32"}],"name":"LogReopenQuestion","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"arbitrator","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"LogSetQuestionFee","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"LogWithdraw","type":"event"},
  {"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"arbitrator_question_fees","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"template_id","type":"uint256"},{"internalType":"string","name":"question","type":"string"},{"internalType":"address","name":"arbitrator","type":"address"},{"internalType":"uint32","name":"timeout","type":"uint32"},{"internalType":"uint32","name":"opening_ts","type":"uint32"},{"internalType":"uint256","name":"nonce","type":"uint256"}],"name":"askQuestion","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"payable","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"template_id","type":"uint256"},{"internalType":"string","name":"question","type":"string"},{"internalType":"address","name":"arbitrator","type":"address"},{"internalType":"uint32","name":"timeout","type":"uint32"},{"internalType":"uint32","name":"opening_ts","type":"uint32"},{"internalType":"uint256","name":"nonce","type":"uint256"},{"internalType":"uint256","name":"min_bond","type":"uint256"}],"name":"askQuestionWithMinBond","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"payable","type":"function"},
  {"inputs":[{"internalType":"bytes32","name":"question_id","type":"bytes32"},{"internalType":"bytes32","name":"answer","type":"bytes32"},{"internalType":"address","name":"payee_if_wrong","type":"address"},{"internalType":"bytes32","name":"last_history_hash","type":"bytes32"},{"internalType":"bytes32","name":"last_answer_or_commitment_id","type":"bytes32"},{"internalType":"address","name":"last_answerer","type":"address"}],"name":"assignWinnerAndSubmitAnswerByArbitrator","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"bytes32","name":"question_id","type":"bytes32"}],"name":"cancelArbitration","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"bytes32[]","name":"question_ids","type":"bytes32[]"},{"internalType":"uint256[]","name":"lengths","type":"uint256[]"},{"internalType":"bytes32[]","name":"hist_hashes","type":"bytes32[]"},{"internalType":"address[]","name":"addrs","type":"address[]"},{"internalType":"uint256[]","name":"bonds","type":"uint256[]"},{"internalType":"bytes32[]","name":"answers","type":"bytes32[]"}],"name":"claimMultipleAndWithdrawBalance","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"bytes32","name":"question_id","type":"bytes32"},{"internalType":"bytes32[]","name":"history_hashes","type":"bytes32[]"},{"internalType":"address[]","name":"addrs","type":"address[]"},{"internalType":"uint256[]","name":"bonds","type":"uint256[]"},{"internalType":"bytes32[]","name":"answers","type":"bytes32[]"}],"name":"claimWinnings","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"name":"commitments","outputs":[{"internalType":"uint32","name":"reveal_ts","type":"uint32"},{"internalType":"bool","name":"is_revealed","type":"bool"},{"internalType":"bytes32","name":"revealed_answer","type":"bytes32"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"string","name":"content","type":"string"}],"name":"createTemplate","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"string","name":"content","type":"string"},{"internalType":"string","name":"question","type":"string"},{"internalType":"address","name":"arbitrator","type":"address"},{"internalType":"uint32","name":"timeout","type":"uint32"},{"internalType":"uint32","name":"opening_ts","type":"uint32"},{"internalType":"uint256","name":"nonce","type":"uint256"}],"name":"createTemplateAndAskQuestion","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"payable","type":"function"},
  {"inputs":[{"internalType":"bytes32","name":"question_id","type":"bytes32"}],"name":"fundAnswerBounty","outputs":[],"stateMutability":"payable","type":"function"},
  {"inputs":[{"internalType":"bytes32","name":"question_id","type":"bytes32"}],"name":"getArbitrator","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"bytes32","name":"question_id","type":"bytes32"}],"name":"getBestAnswer","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"bytes32","name":"question_id","type":"bytes32"}],"name":"getBond","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"bytes32","name":"question_id","type":"bytes32"}],"name":"getBounty","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"bytes32","name":"question_id","type":"bytes32"}],"name":"getContentHash","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"bytes32","name":"question_id","type":"bytes32"}],"name":"getFinalAnswer","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"bytes32","name":"question_id","type":"bytes32"},{"internalType":"bytes32","name":"content_hash","type":"bytes32"},{"internalType":"address","name":"arbitrator","type":"address"},{"internalType":"uint32","name":"min_timeout","type":"uint32"},{"internalType":"uint256","name":"min_bond","type":"uint256"}],"name":"getFinalAnswerIfMatches","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"bytes32","name":"question_id","type":"bytes32"}],"name":"getFinalizeTS","outputs":[{"internalType":"uint32","name":"","type":"uint32"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"bytes32","name":"question_id","type":"bytes32"}],"name":"getHistoryHash","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"bytes32","name":"question_id","type":"bytes32"}],"name":"getMinBond","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"bytes32","name":"question_id","type":"bytes32"}],"name":"getOpeningTS","outputs":[{"internalType":"uint32","name":"","type":"uint32"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"bytes32","name":"question_id","type":"bytes32"}],"name":"getTimeout","outputs":[{"internalType":"uint32","name":"","type":"uint32"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"bytes32","name":"question_id","type":"bytes32"}],"name":"isFinalized","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"bytes32","name":"question_id","type":"bytes32"}],"name":"isPendingArbitration","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"bytes32","name":"question_id","type":"bytes32"}],"name":"isSettledTooSoon","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"bytes32","name":"question_id","type":"bytes32"},{"internalType":"address","name":"requester","type":"address"},{"internalType":"uint256","name":"max_previous","type":"uint256"}],"name":"notifyOfArbitrationRequest","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"name":"question_claims","outputs":[{"internalType":"address","name":"payee","type":"address"},{"internalType":"uint256","name":"last_bond","type":"uint256"},{"internalType":"uint256","name":"queued_funds","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"name":"questions","outputs":[{"internalType":"bytes32","name":"content_hash","type":"bytes32"},{"internalType":"address","name":"arbitrator","type":"address"},{"internalType":"uint32","name":"opening_ts","type":"uint32"},{"internalType":"uint32","name":"timeout","type":"uint32"},{"internalType":"uint32","name":"finalize_ts","type":"uint32"},{"internalType":"bool","name":"is_pending_arbitration","type":"bool"},{"internalType":"uint256","name":"bounty","type":"uint256"},{"internalType":"bytes32","name":"best_answer","type":"bytes32"},{"internalType":"bytes32","name":"history_hash","type":"bytes32"},{"internalType":"uint256","name":"bond","type":"uint256"},{"internalType":"uint256","name":"min_bond","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"template_id","type":"uint256"},{"internalType":"string","name":"question","type":"string"},{"internalType":"address","name":"arbitrator","type":"address"},{"internalType":"uint32","name":"timeout","type":"uint32"},{"internalType":"uint32","name":"opening_ts","type":"uint32"},{"internalType":"uint256","name":"nonce","type":"uint256"},{"internalType":"uint256","name":"min_bond","type":"uint256"},{"internalType":"bytes32","name":"reopens_question_id","type":"bytes32"}],"name":"reopenQuestion","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"payable","type":"function"},
  {"inputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"name":"reopened_questions","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"name":"reopener_questions","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"bytes32","name":"question_id","type":"bytes32"}],"name":"resultFor","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"bytes32","name":"question_id","type":"bytes32"}],"name":"resultForOnceSettled","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"fee","type":"uint256"}],"name":"setQuestionFee","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"bytes32","name":"question_id","type":"bytes32"},{"internalType":"bytes32","name":"answer","type":"bytes32"},{"internalType":"uint256","name":"max_previous","type":"uint256"}],"name":"submitAnswer","outputs":[],"stateMutability":"payable","type":"function"},
  {"inputs":[{"internalType":"bytes32","name":"question_id","type":"bytes32"},{"internalType":"bytes32","name":"answer","type":"bytes32"},{"internalType":"address","name":"answerer","type":"address"}],"name":"submitAnswerByArbitrator","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"bytes32","name":"question_id","type":"bytes32"},{"internalType":"bytes32","name":"answer_hash","type":"bytes32"},{"internalType":"uint256","name":"max_previous","type":"uint256"},{"internalType":"address","name":"_answerer","type":"address"}],"name":"submitAnswerCommitment","outputs":[],"stateMutability":"payable","type":"function"},
  {"inputs":[{"internalType":"bytes32","name":"question_id","type":"bytes32"},{"internalType":"bytes32","name":"answer","type":"bytes32"},{"internalType":"uint256","name":"max_previous","type":"uint256"},{"internalType":"address","name":"answerer","type":"address"}],"name":"submitAnswerFor","outputs":[],"stateMutability":"payable","type":"function"},
  {"inputs":[{"internalType":"bytes32","name":"question_id","type":"bytes32"},{"internalType":"bytes32","name":"answer","type":"bytes32"},{"internalType":"uint256","name":"nonce","type":"uint256"},{"internalType":"uint256","name":"bond","type":"uint256"}],"name":"submitAnswerReveal","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"template_hashes","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"templates","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"withdraw","outputs":[],"stateMutability":"nonpayable","type":"function"}
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
 * Get proposal opening time from Reality.io (improved version matching refactor)
 */
async function getOpeningTime(questionId, provider) {
  try {
    console.log('🔍 [Reality.io] Input questionId:', questionId);
    console.log('🔍 [Reality.io] Input questionId type:', typeof questionId);
    console.log('🔍 [Reality.io] Input questionId toString:', questionId.toString());
    console.log('🔍 [Reality.io] Input questionId as hex:', questionId);
    console.log('🔍 [Reality.io] Input questionId length:', questionId.length);
    console.log('🔍 [Reality.io] HashZero comparison:', ethers.constants.HashZero);
    console.log('🔍 [Reality.io] HashZero equals check:', questionId === ethers.constants.HashZero);
    
    if (!questionId || questionId === ethers.constants.HashZero) {
      console.log('❌ [Reality.io] QuestionId is null or HashZero, returning null');
      return null;
    }
    
    console.log('🔍 [Reality.io] Creating provider...');
    console.log('🔍 [Reality.io] Creating contract with address:', REALITY_ETH_ADDRESS);
    const realityContract = getRealityContract(provider);
    
    console.log('🔍 [Reality.io] About to call getOpeningTS with questionId:', questionId.toString());
    console.log('🔍 [Reality.io] Exact parameter being sent:', JSON.stringify(questionId));
    console.log('🔍 [Reality.io] Parameter as bytes32:', questionId);
    
    // Get opening timestamp from Reality.io
    const openingTs = await realityContract.getOpeningTS(questionId);
    console.log('🔍 [Reality.io] Raw response from getOpeningTS:', openingTs);
    console.log('🔍 [Reality.io] Response type:', typeof openingTs);
    console.log('🔍 [Reality.io] Response toString:', openingTs.toString());
    
    // Handle the response - it might be a BigNumber or regular number
    let openingTimeNumber;
    if (typeof openingTs === 'object' && openingTs.toNumber) {
      // It's a BigNumber
      openingTimeNumber = openingTs.toNumber();
    } else {
      // It's already a regular number
      openingTimeNumber = Number(openingTs);
    }
    
    console.log('🔍 [Reality.io] Final openingTimeNumber:', openingTimeNumber);
    
    // Check if opening time is set (0 means not set)
    if (openingTimeNumber === 0) {
      console.log('⚠️ [Reality.io] Opening time is 0 - question has no opening time set');
      return null;
    }
    
    const openingTime = new Date(openingTimeNumber * 1000);
    const now = new Date();
    const isOpen = now >= openingTime;
    
    console.log('🔍 [Reality.io] Final openingTime as Date:', openingTime);
    
    return {
      timestamp: openingTimeNumber,
      date: openingTime,
      isOpen,
      timeUntil: isOpen ? 0 : openingTime.getTime() - now.getTime()
    };
    
  } catch (error) {
    console.error('❌ [Reality.io] Error getting opening time:', error);
    console.error('❌ [Reality.io] Error details:', error.message);
    console.error('❌ [Reality.io] Error stack:', error.stack);
    return null; // Don't fail the entire proposal load if opening time fails
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