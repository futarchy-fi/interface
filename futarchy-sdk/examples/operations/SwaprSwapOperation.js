// SwaprSwapOperation.js - Swapr V3 Algebra Swap Operation Configuration

export const SwaprSwapOperation = {
  id: 'swapr-swap',
  name: 'Swapr V3 Algebra Swap',
  description: 'Direct execution via Swapr V3 Algebra pools',
  cartridge: 'swapr',
  operation: 'swapr.completeSwap',
  
  // UI Step Configuration
  steps: [
    { 
      id: 'approve_token', 
      label: 'Approve Token for Swapr',
      description: 'Allow Swapr V3 Router to spend your tokens'
    },
    { 
      id: 'execute_swap', 
      label: 'Execute Swap',
      description: 'Execute swap directly on Swapr V3 pools'
    }
  ],

  // Map cartridge step names to UI step IDs
  stepMapping: {
    'check_approval': { stepId: 'approve_token', status: 'running' },
    'approving': { stepId: 'approve_token', status: 'running' },
    'approved': { stepId: 'approve_token', status: 'completed' },
    'swapping': { stepId: 'execute_swap', status: 'running' },
    'complete': { stepId: 'execute_swap', status: 'completed' }
  },

  // Default parameters
  defaultParams: {
    tokenIn: '0xaf204776c7245bF4147c2612BF6e5972Ee483701',  // sDAI
    tokenOut: '0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d', // wxDAI
    amount: '1',
    slippageBps: '0'
  },

  // Parameter schema for validation
  parameterSchema: {
    tokenIn: {
      type: 'address',
      required: true,
      label: 'Input Token',
      placeholder: '0x... (e.g., sDAI)'
    },
    tokenOut: {
      type: 'address',
      required: true,
      label: 'Output Token',
      placeholder: '0x... (e.g., wxDAI)'
    },
    amount: {
      type: 'string',
      required: true,
      label: 'Amount to Swap',
      placeholder: '1.0'
    },
    slippageBps: {
      type: 'string',
      required: false,
      label: 'Slippage (basis points)',
      placeholder: '0 (0% slippage)',
      default: '0'
    }
  },

  // Transform parameters before sending to cartridge
  transformParams: (formParams) => {
    return {
      tokenIn: formParams.tokenIn,
      tokenOut: formParams.tokenOut,
      amount: formParams.amount,
      slippageBps: formParams.slippageBps || '0'
    };
  },

  // Validate parameters
  validateParams: (params) => {
    const errors = {};
    
    if (!params.tokenIn || !/^0x[a-fA-F0-9]{40}$/.test(params.tokenIn)) {
      errors.tokenIn = 'Invalid input token address';
    }
    
    if (!params.tokenOut || !/^0x[a-fA-F0-9]{40}$/.test(params.tokenOut)) {
      errors.tokenOut = 'Invalid output token address';
    }
    
    if (params.tokenIn === params.tokenOut) {
      errors.tokenOut = 'Output token must be different from input token';
    }
    
    if (!params.amount || isNaN(Number(params.amount))) {
      errors.amount = 'Amount must be a number';
    }
    
    if (params.slippageBps && (isNaN(Number(params.slippageBps)) || Number(params.slippageBps) < 0)) {
      errors.slippageBps = 'Slippage must be a non-negative number';
    }
    
    return Object.keys(errors).length > 0 ? errors : null;
  },

  // Success message customization
  getSuccessMessage: (result) => {
    return `Swapr swap executed successfully! ${result.transactionHash ? `Transaction: ${result.transactionHash}` : ''}`;
  },

  // Transaction links
  getTransactionLink: (transactionHash) => {
    return `https://gnosisscan.io/tx/${transactionHash}`;
  },

  // Custom result handling for Swapr swaps
  handleResult: (result) => {
    return {
      ...result,
      explorerLink: `https://gnosisscan.io/tx/${result.transactionHash}`,
      explorerLinkLabel: 'View on Gnosis Scan'
    };
  }
}; 