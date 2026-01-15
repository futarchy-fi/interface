import { ethers } from 'ethers';
import { FUTARCHY_PROPOSAL_ABI } from '../abis';
import { CONDITIONAL_POOLS } from '../constants/addresses';

/**
 * Utility functions for reading proposal contract data dynamically
 * Replaces hardcoded constants with dynamic contract reads
 */

// Reality.io contract address and ABI for opening time
const REALITY_ETH_ADDRESS = '0xE78996A233895bE74a66F451f1019cA9734205cc';
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

// Get Web3 provider
export const getWeb3Provider = () => {
  if (!window.ethereum) {
    throw new Error('Please install MetaMask!');
  }
  return new ethers.providers.Web3Provider(window.ethereum);
};

/**
 * Get proposal contract instance
 */
export const getProposalContract = (proposalAddress) => {
  if (!proposalAddress) {
    throw new Error('Proposal address is required');
  }
  
  const provider = getWeb3Provider();
  return new ethers.Contract(proposalAddress, FUTARCHY_PROPOSAL_ABI, provider);
};

/**
 * Read all proposal data from contract
 * Returns market name, tokens, wrapped outcomes, and opening time
 */
export const getProposalData = async (proposalAddress) => {
  try {
    const contract = getProposalContract(proposalAddress);
    
    // Read basic proposal info
    const [
      marketName,
      collateralToken1, // Company token
      collateralToken2, // Currency token
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

    console.log('🔍 Raw questionId from contract:', questionId);
    console.log('🔍 QuestionId type:', typeof questionId);
    console.log('🔍 QuestionId toString:', questionId.toString());

    // Get opening time from Reality.io (async)
    console.log('🔍 About to get opening time for questionId:', questionId);
    const openingTime = await getProposalOpeningTime(questionId);
    console.log('🔍 Got openingTime from Reality.io:', openingTime);

    // Read wrapped outcomes (should always be 4)
    const wrappedOutcomes = [];
    for (let i = 0; i < numOutcomes; i++) {
      const outcome = await contract.wrappedOutcome(i);
      wrappedOutcomes.push({
        index: i,
        address: outcome.wrapped1155,
        data: outcome.data
      });
    }

    // Map outcomes to standard naming convention
    // Index 0,1 = Company outcomes (YES_COMPANY, NO_COMPANY)
    // Index 2,3 = Currency outcomes (YES_CURRENCY, NO_CURRENCY)
    const tokenMapping = {
      // Base tokens
      companyToken: collateralToken1,
      currencyToken: collateralToken2,
      
      // Wrapped outcome tokens
      yesCompanyToken: wrappedOutcomes[0]?.address,
      noCompanyToken: wrappedOutcomes[1]?.address,
      yesCurrencyToken: wrappedOutcomes[2]?.address,
      noCurrencyToken: wrappedOutcomes[3]?.address
    };

    return {
      proposalAddress,
      marketName,
      conditionId,
      questionId,
      openingTime, // Unix timestamp from Reality.io
      numOutcomes: numOutcomes.toNumber(),
      wrappedOutcomes,
      tokens: tokenMapping,
      
      // Pool addresses for realtime monitoring - use conditional pools for trading data
      poolAddresses: [
        CONDITIONAL_POOLS.yes.address,    // YES conditional pool
        CONDITIONAL_POOLS.no.address,     // NO conditional pool
        CONDITIONAL_POOLS.base.address    // Base pool
      ].filter(Boolean) // Remove any undefined addresses
    };
    
  } catch (error) {
    console.error('Error reading proposal data:', error);
    throw new Error(`Failed to read proposal data: ${error.message}`);
  }
};

/**
 * Get token metadata for a proposal
 */
export const getProposalTokenMetadata = async (proposalAddress) => {
  try {
    const proposalData = await getProposalData(proposalAddress);
    
    return {
      // Base tokens
      company: {
        symbol: 'COMPANY', // We could read this from ERC20 contract
        name: 'Company Token',
        address: proposalData.tokens.companyToken
      },
      currency: {
        symbol: 'CURRENCY', // We could read this from ERC20 contract  
        name: 'Currency Token',
        address: proposalData.tokens.currencyToken
      },
      
      // Outcome tokens
      yesCompany: {
        symbol: 'YES_COMPANY',
        name: 'YES Company Token',
        address: proposalData.tokens.yesCompanyToken
      },
      noCompany: {
        symbol: 'NO_COMPANY', 
        name: 'NO Company Token',
        address: proposalData.tokens.noCompanyToken
      },
      yesCurrency: {
        symbol: 'YES_CURRENCY',
        name: 'YES Currency Token', 
        address: proposalData.tokens.yesCurrencyToken
      },
      noCurrency: {
        symbol: 'NO_CURRENCY',
        name: 'NO Currency Token',
        address: proposalData.tokens.noCurrencyToken
      }
    };
    
  } catch (error) {
    console.error('Error getting token metadata:', error);
    throw error;
  }
};

/**
 * Validate proposal address format
 */
export const isValidProposalAddress = (address) => {
  if (!address) return false;
  return ethers.utils.isAddress(address);
};

/**
 * Get proposal info for display
 */
export const getProposalDisplayInfo = async (proposalAddress) => {
  try {
    const contract = getProposalContract(proposalAddress);
    
    const [marketName, encodedQuestion] = await Promise.all([
      contract.marketName(),
      contract.encodedQuestion()
    ]);
    
    return {
      marketName,
      encodedQuestion,
      proposalAddress,
      shortAddress: `${proposalAddress.slice(0, 6)}...${proposalAddress.slice(-4)}`
    };
    
  } catch (error) {
    console.error('Error getting proposal display info:', error);
    throw error;
  }
};

/**
 * Check if proposal contract exists and is valid
 */
export const validateProposalContract = async (proposalAddress) => {
  try {
    if (!isValidProposalAddress(proposalAddress)) {
      throw new Error('Invalid proposal address format');
    }
    
    const provider = getWeb3Provider();
    const code = await provider.getCode(proposalAddress);
    
    if (code === '0x') {
      throw new Error('No contract found at this address');
    }
    
    // Try to call a basic function to verify it's a proposal contract
    const contract = getProposalContract(proposalAddress);
    await contract.marketName(); // This will throw if not a valid proposal contract
    
    return true;
    
  } catch (error) {
    console.error('Proposal contract validation failed:', error);
    throw new Error(`Invalid proposal contract: ${error.message}`);
  }
};

/**
 * Get opening time from Reality.io contract
 */
export const getProposalOpeningTime = async (questionId) => {
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
    const provider = getWeb3Provider();
    console.log('🔍 [Reality.io] Creating contract with address:', REALITY_ETH_ADDRESS);
    const realityContract = new ethers.Contract(REALITY_ETH_ADDRESS, REALITY_ETH_ABI, provider);
    
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
    
    console.log('🔍 [Reality.io] Final openingTime as Date:', new Date(openingTimeNumber * 1000));
    
    return openingTimeNumber; // Unix timestamp
    
  } catch (error) {
    console.error('❌ [Reality.io] Error getting opening time:', error);
    console.error('❌ [Reality.io] Error details:', error.message);
    console.error('❌ [Reality.io] Error stack:', error.stack);
    return null; // Don't fail the entire proposal load if opening time fails
  }
}; 