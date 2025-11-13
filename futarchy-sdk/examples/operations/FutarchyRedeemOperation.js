// FutarchyRedeemOperation.js - Redeem Outcome Tokens Operation

export const FutarchyRedeemOperation = {
  id: 'futarchy-redeem-outcomes',
  name: 'Redeem Outcome Tokens',
  description: 'Redeem winning outcome tokens after proposal resolution',
  cartridge: 'futarchy',
  operation: 'futarchy.completeRedeemOutcomes',
  
  // UI Step Configuration
  steps: [
    { 
      id: 'check_balances', 
      label: 'Check Token Balances',
      description: 'Check your outcome token balances'
    },
    { 
      id: 'approve_tokens', 
      label: 'Approve Tokens',
      description: 'Approve outcome tokens for redemption (if needed)'
    },
    { 
      id: 'redeem_tokens', 
      label: 'Redeem Tokens',
      description: 'Execute redemption of outcome tokens'
    }
  ],

  // Map cartridge step names to UI step IDs
  stepMapping: {
    'check_token1_balance': { stepId: 'check_balances', status: 'running' },
    'check_token2_balance': { stepId: 'check_balances', status: 'running' },
    'balances_checked': { stepId: 'check_balances', status: 'completed' },
    'check_token1_approval': { stepId: 'approve_tokens', status: 'running' },
    'check_token2_approval': { stepId: 'approve_tokens', status: 'running' },
    'approving_token1': { stepId: 'approve_tokens', status: 'running' },
    'approving_token2': { stepId: 'approve_tokens', status: 'running' },
    'tokens_approved': { stepId: 'approve_tokens', status: 'completed' },
    'redeeming': { stepId: 'redeem_tokens', status: 'running' },
    'complete': { stepId: 'redeem_tokens', status: 'completed' }
  },

  // Default parameters
  defaultParams: {
    proposal: '0xDA36a35CA4Fe6214C37a452159C0C9EAd45D5919',
    token1Address: '', // First outcome token (e.g., YES_GNO)
    token2Address: '', // Second outcome token (e.g., YES_SDAI)
    amount1: '0', // Amount of first token to redeem
    amount2: '0'  // Amount of second token to redeem
  },

  // Parameter schema for validation
  parameterSchema: {
    proposal: {
      type: 'address',
      required: true,
      label: 'Proposal Address',
      placeholder: '0x...'
    },
    token1Address: {
      type: 'address',
      required: false,
      label: 'First Outcome Token Address',
      placeholder: '0x... (e.g., YES_GNO - leave empty if amount1 is 0)'
    },
    token2Address: {
      type: 'address',
      required: false,
      label: 'Second Outcome Token Address', 
      placeholder: '0x... (e.g., YES_SDAI - leave empty if amount2 is 0)'
    },
    amount1: {
      type: 'string',
      required: true,
      label: 'Amount 1 (First Token)',
      placeholder: '0',
      default: '0'
    },
    amount2: {
      type: 'string',
      required: true,
      label: 'Amount 2 (Second Token)',
      placeholder: '0',
      default: '0'
    }
  },

  // Transform parameters before sending to cartridge
  transformParams: (formParams) => {
    return {
      proposal: formParams.proposal,
      token1Address: formParams.token1Address || null,
      token2Address: formParams.token2Address || null,
      amount1: formParams.amount1 || '0',
      amount2: formParams.amount2 || '0'
    };
  },

  // Validate parameters
  validateParams: (params) => {
    const errors = {};
    
    if (!params.proposal || !/^0x[a-fA-F0-9]{40}$/.test(params.proposal)) {
      errors.proposal = 'Invalid proposal address';
    }
    
    const amount1Num = Number(params.amount1 || '0');
    const amount2Num = Number(params.amount2 || '0');
    
    if (isNaN(amount1Num) || amount1Num < 0) {
      errors.amount1 = 'Amount 1 must be a non-negative number';
    }
    
    if (isNaN(amount2Num) || amount2Num < 0) {
      errors.amount2 = 'Amount 2 must be a non-negative number';
    }
    
    if (amount1Num === 0 && amount2Num === 0) {
      errors.amount2 = 'At least one amount must be greater than 0';
    }
    
    // If amount > 0, token address is required
    if (amount1Num > 0 && (!params.token1Address || !/^0x[a-fA-F0-9]{40}$/.test(params.token1Address))) {
      errors.token1Address = 'Token 1 address required when amount 1 > 0';
    }
    
    if (amount2Num > 0 && (!params.token2Address || !/^0x[a-fA-F0-9]{40}$/.test(params.token2Address))) {
      errors.token2Address = 'Token 2 address required when amount 2 > 0';
    }
    
    return Object.keys(errors).length > 0 ? errors : null;
  },

  // Success message customization
  getSuccessMessage: (result) => {
    return `Successfully redeemed outcome tokens! ${result.transactionHash ? `Transaction: ${result.transactionHash}` : ''}`;
  },

  // Transaction links
  getTransactionLink: (transactionHash) => {
    return `https://gnosisscan.io/tx/${transactionHash}`;
  },

  // Custom result handling
  handleResult: (result) => {
    return {
      ...result,
      explorerLink: `https://gnosisscan.io/tx/${result.transactionHash}`,
      explorerLinkLabel: 'View Transaction on Gnosis Scan'
    };
  }
};