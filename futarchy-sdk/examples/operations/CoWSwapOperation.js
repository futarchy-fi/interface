// CoWSwapOperation.js - CoW Protocol Swap Operation Configuration

export const CoWSwapOperation = {
  id: 'cow-swap',
  name: 'CoW Protocol Swap',
  description: 'MEV-protected swap via CoW Protocol',
  cartridge: 'cowswap',
  operation: 'cowswap.completeSwap',
  
  // UI Step Configuration
  steps: [
    { 
      id: 'approve_token', 
      label: 'Approve Token for CoW',
      description: 'Allow CoW Vault Relayer to spend your tokens'
    },
    { 
      id: 'create_order', 
      label: 'Create CoW Order',
      description: 'Submit order to CoW Protocol for execution'
    }
  ],

  // Map cartridge step names to UI step IDs
  stepMapping: {
    'check_approval': { stepId: 'approve_token', status: 'running' },
    'approving': { stepId: 'approve_token', status: 'running' },
    'approved': { stepId: 'approve_token', status: 'completed' },
    'swapping': { stepId: 'create_order', status: 'running' },
    'complete': { stepId: 'create_order', status: 'completed' }
  },

  // Default parameters
  defaultParams: {
    sellToken: '0xaf204776c7245bF4147c2612BF6e5972Ee483701', // sDAI
    buyToken: '0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d',  // wxDAI
    amount: '1'
  },

  // Parameter schema for validation
  parameterSchema: {
    sellToken: {
      type: 'address',
      required: true,
      label: 'Sell Token',
      placeholder: '0x... (e.g., sDAI)'
    },
    buyToken: {
      type: 'address',
      required: true,
      label: 'Buy Token', 
      placeholder: '0x... (e.g., wxDAI)'
    },
    amount: {
      type: 'string',
      required: true,
      label: 'Amount to Swap',
      placeholder: '1.0'
    }
  },

  // Transform parameters before sending to cartridge
  transformParams: (formParams) => {
    return {
      sellToken: formParams.sellToken,
      buyToken: formParams.buyToken,
      amount: formParams.amount
    };
  },

  // Validate parameters
  validateParams: (params) => {
    const errors = {};
    
    if (!params.sellToken || !/^0x[a-fA-F0-9]{40}$/.test(params.sellToken)) {
      errors.sellToken = 'Invalid sell token address';
    }
    
    if (!params.buyToken || !/^0x[a-fA-F0-9]{40}$/.test(params.buyToken)) {
      errors.buyToken = 'Invalid buy token address';
    }
    
    if (params.sellToken === params.buyToken) {
      errors.buyToken = 'Buy token must be different from sell token';
    }
    
    if (!params.amount || isNaN(Number(params.amount))) {
      errors.amount = 'Amount must be a number';
    }
    
    return Object.keys(errors).length > 0 ? errors : null;
  },

  // Success message customization
  getSuccessMessage: (result) => {
    if (result.orderId) {
      return `CoW order created successfully! Order ID: ${result.orderId}`;
    }
    return 'CoW swap completed successfully!';
  },

  // Transaction/Order links
  getTransactionLink: (transactionHashOrOrderId) => {
    // CoW orders use order IDs, not transaction hashes
    if (transactionHashOrOrderId.startsWith('0x') && transactionHashOrOrderId.length === 66) {
      return `https://gnosisscan.io/tx/${transactionHashOrOrderId}`;
    } else {
      return `https://explorer.cow.fi/orders/${transactionHashOrOrderId}`;
    }
  },

  // Custom result handling for CoW orders
  handleResult: (result) => {
    if (result.orderId) {
      return {
        ...result,
        trackingLink: `https://explorer.cow.fi/orders/${result.orderId}`,
        trackingLinkLabel: 'Track on CoW Explorer'
      };
    }
    return result;
  }
}; 