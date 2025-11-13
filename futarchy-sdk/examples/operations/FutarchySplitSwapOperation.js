// FutarchySplitSwapOperation.js - Complete Futarchy Split + Swap Operation

export const FutarchySplitSwapOperation = {
  id: 'futarchy-split-swap',
  name: 'Futarchy Split + Swap',
  description: 'Split SDAI to get enough YES SDAI, then swap to YES GNO',
  cartridge: 'futarchy',
  operation: 'futarchy.completeSplitSwap',
  
  // UI Step Configuration
  steps: [
    { 
      id: 'check_balances', 
      label: 'Check Balances',
      description: 'Check your current YES SDAI and SDAI balances'
    },
    { 
      id: 'calculate_split', 
      label: 'Calculate Split Amount',
      description: 'Determine how much SDAI needs to be split'
    },
    { 
      id: 'approve_sdai', 
      label: 'Approve SDAI',
      description: 'Allow the futarchy router to spend your SDAI'
    },
    { 
      id: 'split_position', 
      label: 'Split SDAI',
      description: 'Split SDAI into YES/NO tokens to reach target amount'
    },
    { 
      id: 'approve_yes_sdai', 
      label: 'Approve YES SDAI',
      description: 'Allow the swap router to spend your YES SDAI'
    },
    { 
      id: 'execute_swap', 
      label: 'Swap to YES GNO',
      description: 'Swap YES SDAI for YES GNO'
    }
  ],

  // Map cartridge step names to UI step IDs
  stepMapping: {
    'check_yes_balance': { stepId: 'check_balances', status: 'running' },
    'check_sdai_balance': { stepId: 'check_balances', status: 'running' },
    'balances_checked': { stepId: 'check_balances', status: 'completed' },
    'calculating_split': { stepId: 'calculate_split', status: 'running' },
    'split_calculated': { stepId: 'calculate_split', status: 'completed' },
    'check_sdai_approval': { stepId: 'approve_sdai', status: 'running' },
    'approving_sdai': { stepId: 'approve_sdai', status: 'running' },
    'sdai_approved': { stepId: 'approve_sdai', status: 'completed' },
    'splitting': { stepId: 'split_position', status: 'running' },
    'split_complete': { stepId: 'split_position', status: 'completed' },
    'check_yes_approval': { stepId: 'approve_yes_sdai', status: 'running' },
    'approving_yes': { stepId: 'approve_yes_sdai', status: 'running' },
    'yes_approved': { stepId: 'approve_yes_sdai', status: 'completed' },
    'swapping': { stepId: 'execute_swap', status: 'running' },
    'complete': { stepId: 'execute_swap', status: 'completed' }
  },

  // Default parameters
  defaultParams: {
    proposal: '0xDA36a35CA4Fe6214C37a452159C0C9EAd45D5919',
    collateralToken: '0xaf204776c7245bF4147c2612BF6e5972Ee483701', // SDAI
    yesSdaiToken: '', // User configurable YES SDAI address
    yesGnoToken: '', // User configurable YES GNO address
    targetAmount: '2', // Target amount of YES SDAI to trade
    slippageBps: '100' // 1% slippage
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
      label: 'Collateral Token (SDAI)',
      placeholder: '0x...'
    },
    yesSdaiToken: {
      type: 'address',
      required: true,
      label: 'YES SDAI Token Address',
      placeholder: '0x... (YES SDAI token)'
    },
    yesGnoToken: {
      type: 'address',
      required: true,
      label: 'YES GNO Token Address',
      placeholder: '0x... (YES GNO token)'
    },
    targetAmount: {
      type: 'string',
      required: true,
      label: 'Target YES SDAI Amount',
      placeholder: '2.0'
    },
    slippageBps: {
      type: 'string',
      required: false,
      label: 'Slippage (basis points)',
      placeholder: '100 (1% slippage)',
      default: '100'
    }
  },

  // Transform parameters before sending to cartridge
  transformParams: (formParams) => {
    return {
      proposal: formParams.proposal,
      collateralToken: formParams.collateralToken,
      yesSdaiToken: formParams.yesSdaiToken,
      yesGnoToken: formParams.yesGnoToken,
      targetAmount: formParams.targetAmount,
      slippageBps: formParams.slippageBps || '100'
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
    
    if (!params.yesSdaiToken || !/^0x[a-fA-F0-9]{40}$/.test(params.yesSdaiToken)) {
      errors.yesSdaiToken = 'Invalid YES SDAI token address';
    }
    
    if (!params.yesGnoToken || !/^0x[a-fA-F0-9]{40}$/.test(params.yesGnoToken)) {
      errors.yesGnoToken = 'Invalid YES GNO token address';
    }
    
    if (params.yesSdaiToken === params.yesGnoToken) {
      errors.yesGnoToken = 'YES GNO token must be different from YES SDAI token';
    }
    
    if (!params.targetAmount || isNaN(Number(params.targetAmount)) || Number(params.targetAmount) <= 0) {
      errors.targetAmount = 'Target amount must be a positive number';
    }
    
    if (params.slippageBps && (isNaN(Number(params.slippageBps)) || Number(params.slippageBps) < 0)) {
      errors.slippageBps = 'Slippage must be a non-negative number';
    }
    
    return Object.keys(errors).length > 0 ? errors : null;
  },

  // Success message customization
  getSuccessMessage: (result) => {
    return `Successfully completed split + swap operation! ${result.transactionHash ? `Final transaction: ${result.transactionHash}` : ''}`;
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
      explorerLinkLabel: 'View Final Transaction on Gnosis Scan'
    };
  }
};