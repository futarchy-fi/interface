// UniswapV3Cartridge.js - Uniswap V3 Swap Router Operations Cartridge

import { parseEther, formatEther, parseUnits } from 'viem';

// =============================================================================
// UNISWAP V3 CONSTANTS
// =============================================================================

export const UNISWAP_V3_ROUTER_ABI = [
  {
    name: 'exactInputSingle',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'recipient', type: 'address' },
          { name: 'deadline', type: 'uint256' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'amountOutMinimum', type: 'uint256' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' }
        ]
      }
    ],
    outputs: [{ name: 'amountOut', type: 'uint256' }]
  },
  {
    name: 'exactOutputSingle',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'recipient', type: 'address' },
          { name: 'deadline', type: 'uint256' },
          { name: 'amountOut', type: 'uint256' },
          { name: 'amountInMaximum', type: 'uint256' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' }
        ]
      }
    ],
    outputs: [{ name: 'amountIn', type: 'uint256' }]
  }
];

export const ERC20_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool' }]
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' }
    ],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }]
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }]
  }
];

// =============================================================================
// UNISWAP V3 CARTRIDGE CLASS
// =============================================================================

export class UniswapV3Cartridge {
  constructor(routerAddress) {
    this.name = 'UniswapV3Cartridge';
    this.routerAddress = routerAddress; // e.g., 0xE592... on Polygon/Ethereum

    this.operations = {
      'uniswap.checkApproval': this.checkApproval.bind(this),
      'uniswap.approve': this.approve.bind(this),
      'uniswap.swap': this.swap.bind(this),
      'uniswap.swapExactOut': this.swapExactOut.bind(this),
      'uniswap.completeSwap': this.completeSwap.bind(this),
      'uniswap.completeSwapExactOut': this.completeSwapExactOut.bind(this)
    };

    console.log(`🦄 ${this.name} initialized (router: ${this.routerAddress})`);
  }

  getSupportedOperations() {
    return Object.keys(this.operations);
  }

  supports(operation) {
    return operation in this.operations;
  }

  async* execute(operation, args, viemClients) {
    if (!this.supports(operation)) {
      yield { status: 'error', message: `Operation '${operation}' not supported by ${this.name}` };
      return;
    }
    yield* this.operations[operation](args, viemClients);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  async* checkApproval(args, { publicClient, account }) {
    const { tokenAddress } = args;

    yield { status: 'pending', message: 'Checking Uniswap approval...', step: 'check' };
    try {
      const allowance = await publicClient.readContract({ address: tokenAddress, abi: ERC20_ABI, functionName: 'allowance', args: [account, this.routerAddress] });
      const balance = await publicClient.readContract({ address: tokenAddress, abi: ERC20_ABI, functionName: 'balanceOf', args: [account] });
      yield {
        status: 'success',
        message: 'Approval status checked',
        step: 'complete',
        data: {
          allowance: allowance.toString(),
          allowanceFormatted: formatEther(allowance),
          balance: balance.toString(),
          balanceFormatted: formatEther(balance),
          isApproved: allowance > 0n,
          tokenAddress,
          spender: this.routerAddress
        }
      };
    } catch (error) {
      yield { status: 'error', message: `Failed to check approval: ${error.message}` };
    }
  }

  async* approve(args, { publicClient, walletClient, account }) {
    const { tokenAddress, amount } = args;

    yield { status: 'pending', message: 'Preparing Uniswap approval...', step: 'prepare' };
    const amountWei = (amount === 'max' || amount === 'unlimited') ? (2n ** 256n - 1n) : (typeof amount === 'string' ? parseEther(amount) : amount);
    try {
      const hash = await walletClient.writeContract({ address: tokenAddress, abi: ERC20_ABI, functionName: 'approve', args: [this.routerAddress, amountWei], account });
      yield { status: 'pending', message: 'Approval submitted, waiting for confirmation...', step: 'confirm', data: { transactionHash: hash } };
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      yield { status: 'success', message: 'Token approved for Uniswap', step: 'complete', data: { transactionHash: hash, receipt } };
    } catch (error) {
      yield { status: 'error', message: `Approval failed: ${error.message}` };
    }
  }

  // exact input single: amountIn known
  async* swap(args, { publicClient, walletClient, account }) {
    const { tokenIn, tokenOut, amount, fee = 500, deadline, forceSend = false } = args;

    yield { status: 'pending', message: 'Preparing Uniswap exact input swap...', step: 'prepare' };
    try {
      let amountIn;
      if (typeof amount === 'string') {
        const dec = await publicClient.readContract({ address: tokenIn, abi: ERC20_ABI, functionName: 'decimals' }).catch(() => 18);
        amountIn = parseUnits(amount, dec);
      } else {
        amountIn = amount;
      }
      const swapDeadline = deadline || Math.floor(Date.now() / 1000) + 3600; // 1h

      const params = {
        tokenIn,
        tokenOut,
        fee,
        recipient: account,
        deadline: swapDeadline,
        amountIn,
        amountOutMinimum: 0n, // note: set to 0; caller can enforce slippage off-chain
        sqrtPriceLimitX96: 0n
      };

      yield { status: 'pending', message: 'Executing Uniswap exactInputSingle...', step: 'execute', data: { params } };
      const txOpts = forceSend ? { gas: 500000n } : {};
      const hash = await walletClient.writeContract({ address: this.routerAddress, abi: UNISWAP_V3_ROUTER_ABI, functionName: 'exactInputSingle', args: [params], account, ...txOpts });
      yield { status: 'pending', message: 'Swap submitted, waiting for confirmation...', step: 'confirm', data: { transactionHash: hash } };
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      yield { status: 'success', message: 'Uniswap exact input swap completed', step: 'complete', data: { transactionHash: hash, receipt, amountIn: amountIn.toString() } };
    } catch (error) {
      yield { status: 'error', message: `Uniswap exact input swap failed: ${error.message}` };
    }
  }

  // exact output single: amountOut known
  async* swapExactOut(args, { publicClient, walletClient, account }) {
    const { tokenIn, tokenOut, amountOut, amountInMaximum, fee = 500, deadline, forceSend = false } = args;

    yield { status: 'pending', message: 'Preparing Uniswap exact output swap...', step: 'prepare' };
    try {
      let outWei;
      if (typeof amountOut === 'string') {
        const decOut = await publicClient.readContract({ address: tokenOut, abi: ERC20_ABI, functionName: 'decimals' }).catch(() => 18);
        outWei = parseUnits(amountOut, decOut);
      } else { outWei = amountOut; }
      let inMaxWei;
      if (typeof amountInMaximum === 'string') {
        const decIn = await publicClient.readContract({ address: tokenIn, abi: ERC20_ABI, functionName: 'decimals' }).catch(() => 18);
        inMaxWei = parseUnits(amountInMaximum, decIn);
      } else { inMaxWei = amountInMaximum; }
      const swapDeadline = deadline || Math.floor(Date.now() / 1000) + 3600;

      const params = {
        tokenIn,
        tokenOut,
        fee,
        recipient: account,
        deadline: swapDeadline,
        amountOut: outWei,
        amountInMaximum: inMaxWei,
        sqrtPriceLimitX96: 0n
      };

      yield { status: 'pending', message: 'Executing Uniswap exactOutputSingle...', step: 'execute', data: { params } };
      const txOpts = forceSend ? { gas: 700000n } : {};
      const hash = await walletClient.writeContract({ address: this.routerAddress, abi: UNISWAP_V3_ROUTER_ABI, functionName: 'exactOutputSingle', args: [params], account, ...txOpts });
      yield { status: 'pending', message: 'Swap submitted, waiting for confirmation...', step: 'confirm', data: { transactionHash: hash } };
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      yield { status: 'success', message: 'Uniswap exact output swap completed', step: 'complete', data: { transactionHash: hash, receipt, amountOut: outWei.toString() } };
    } catch (error) {
      yield { status: 'error', message: `Uniswap exact output swap failed: ${error.message}` };
    }
  }

  // Composed convenience: checkApproval → approve if needed → exact input swap
  async* completeSwap(args, viem) {
    const { tokenIn } = args;
    let isApproved = false;

    for await (const st of this.checkApproval({ tokenAddress: tokenIn }, viem)) {
      if (st.status === 'success') { isApproved = st.data.isApproved; break; }
      if (st.status === 'error') throw new Error(st.message);
      yield st;
    }

    if (!isApproved) {
      for await (const st of this.approve({ tokenAddress: tokenIn, amount: 'unlimited' }, viem)) {
        if (st.status === 'success') break;
        if (st.status === 'error') throw new Error(st.message);
        yield st;
      }
    }

    for await (const st of this.swap(args, viem)) { yield st; if (st.status !== 'pending') break; }
  }

  // Composed convenience: checkApproval → approve if needed → exact output swap
  async* completeSwapExactOut(args, viem) {
    const { tokenIn } = args;
    let isApproved = false;

    for await (const st of this.checkApproval({ tokenAddress: tokenIn }, viem)) {
      if (st.status === 'success') { isApproved = st.data.isApproved; break; }
      if (st.status === 'error') throw new Error(st.message);
      yield st;
    }

    if (!isApproved) {
      for await (const st of this.approve({ tokenAddress: tokenIn, amount: 'unlimited' }, viem)) {
        if (st.status === 'success') break;
        if (st.status === 'error') throw new Error(st.message);
        yield st;
      }
    }

    for await (const st of this.swapExactOut(args, viem)) { yield st; if (st.status !== 'pending') break; }
  }
}

export default UniswapV3Cartridge;
