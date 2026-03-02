// FutarchyMergeOperation.js - Futarchy Merge Operation Configuration

export const FutarchyMergeOperation = {
  id: 'futarchy-merge',
  name: 'Futarchy Merge',
  description: 'Merge YES and NO tokens back to collateral',
  cartridge: 'futarchy',
  operation: 'futarchy.completeMerge',
  
  // UI Step Configuration
  steps: [
    { 
      id: 'approve_yes', 
      label: 'Approve YES Tokens',
      description: 'Allow the futarchy router to spend your YES tokens'
    },
    { 
      id: 'approve_no', 
      label: 'Approve NO Tokens',
      description: 'Allow the futarchy router to spend your NO tokens'
    },
    { 
      id: 'merge', 
      label: 'Merge Positions',
      description: 'Combine YES and NO tokens into collateral token'
    }
  ],

  // Map cartridge step names to UI step IDs
  stepMapping: {
    'check_yes_approval': { stepId: 'approve_yes', status: 'running' },
    'approving_yes': { stepId: 'approve_yes', status: 'running' },
    'yes_approved': { stepId: 'approve_yes', status: 'completed' },
    'check_no_approval': { stepId: 'approve_no', status: 'running' },
    'approving_no': { stepId: 'approve_no', status: 'running' },
    'no_approved': { stepId: 'approve_no', status: 'completed' },
    'merging': { stepId: 'merge', status: 'running' },
    'complete': { stepId: 'merge', status: 'completed' }
  },

  // Default parameters
  defaultParams: {
    proposal: '0xDA36a35CA4Fe6214C37a452159C0C9EAd45D5919',
    collateralToken: '0xaf204776c7245bF4147c2612BF6e5972Ee483701',
    amount: '100'
  },

  // Parameter schema for validation
  parameterSchema: {
    proposal: {
      type: 'address',
      required: true,
      label: 'Proposal Address',
      placeholder: '0x...'
    },
    collateralToken: {
      type: 'address', 
      required: true,
      label: 'Collateral Token',
      placeholder: '0x...'
    },
    amount: {
      type: 'string',
      required: true,
      label: 'Amount to Merge',
      placeholder: '100'
    }
  },

  // Transform parameters before sending to cartridge
  transformParams: (formParams) => {
    return {
      proposal: formParams.proposal,
      collateralToken: formParams.collateralToken,
      amount: formParams.amount
    };
  },

  // Validate parameters
  validateParams: (params) => {
    const errors = {};
    
    if (!params.proposal || !/^0x[a-fA-F0-9]{40}$/.test(params.proposal)) {
      errors.proposal = 'Invalid proposal address';
    }
    
    if (!params.collateralToken || !/^0x[a-fA-F0-9]{40}$/.test(params.collateralToken)) {
      errors.collateralToken = 'Invalid collateral token address';
    }
    
    if (!params.amount || isNaN(Number(params.amount))) {
      errors.amount = 'Amount must be a number';
    }
    
    return Object.keys(errors).length > 0 ? errors : null;
  },

  // Success message customization
  getSuccessMessage: (result) => {
    return `Successfully merged positions! ${result.transactionHash ? `Transaction: ${result.transactionHash}` : ''}`;
  },

  // Transaction links
  getTransactionLink: (transactionHash) => {
    return `https://gnosisscan.io/tx/${transactionHash}`;
  }
}; 