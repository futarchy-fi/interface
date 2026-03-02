// UniswapV4Cartridge.js - Uniswap v4 Universal Router Operations Cartridge (Polygon)

import { parseEther, formatEther, parseUnits } from 'viem';
// SDK builders (now installed via package.json)
import { Actions, V4Planner } from '@uniswap/v4-sdk';
import { RoutePlanner, CommandType } from '@uniswap/universal-router-sdk';

// Minimal ABIs
const UNIVERSAL_ROUTER_ABI = [
  {
    name: 'execute',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'commands', type: 'bytes' },
      { name: 'inputs', type: 'bytes[]' },
      { name: 'deadline', type: 'uint256' }
    ],
    outputs: []
  }
];

const PERMIT2_ABI = [
  {
    // approve(address token, address spender, uint160 amount, uint48 expiration)
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint160' },
      { name: 'expiration', type: 'uint48' }
    ],
    outputs: []
  },
  {
    // allowance(address owner, address token, address spender) -> (uint160 amount, uint48 expiration, uint48 nonce)
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'token', type: 'address' },
      { name: 'spender', type: 'address' }
    ],
    outputs: [
      { name: 'amount', type: 'uint160' },
      { name: 'expiration', type: 'uint48' },
      { name: 'nonce', type: 'uint48' }
    ]
  }
];

const ERC20_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [ { name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' } ],
    outputs: [ { name: '', type: 'bool' } ]
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [ { name: 'owner', type: 'address' }, { name: 'spender', type: 'address' } ],
    outputs: [ { name: '', type: 'uint256' } ]
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [ { name: 'account', type: 'address' } ],
    outputs: [ { name: '', type: 'uint256' } ]
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [ { name: '', type: 'uint8' } ]
  }
];

const V4_QUOTER_ABI = [
  {
    name: 'quoteExactInputSingle',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          {
            name: 'poolKey',
            type: 'tuple',
            components: [
              { name: 'currency0', type: 'address' },
              { name: 'currency1', type: 'address' },
              { name: 'fee', type: 'uint24' },
              { name: 'tickSpacing', type: 'int24' },
              { name: 'hooks', type: 'address' }
            ]
          },
          { name: 'zeroForOne', type: 'bool' },
          { name: 'exactAmount', type: 'uint256' },
          { name: 'hookData', type: 'bytes' }
        ]
      }
    ],
    outputs: [ { name: 'amountOut', type: 'uint256' }, { name: 'gasEstimate', type: 'uint256' } ]
  }
];

export class UniswapV4Cartridge {
  constructor(configOrRouter) {
    this.name = 'UniswapV4Cartridge';

    // Accept a config object or a router address string
    if (typeof configOrRouter === 'string') {
      this.universalRouter = configOrRouter;
      this.permit2 = '0x000000000022D473030F116dDEE9F6B43aC78BA3';
      this.quoterV4 = null;
    } else {
      const cfg = configOrRouter || {};
      this.universalRouter = cfg.universalRouter || cfg.router || null;
      this.permit2 = cfg.permit2 || '0x000000000022D473030F116dDEE9F6B43aC78BA3';
      this.quoterV4 = cfg.quoterV4 || null;
    }

    this.operations = {
      'uniswap.checkApproval': this.checkApproval.bind(this),
      'uniswap.approve': this.approve.bind(this),
      'uniswap.quote': this.quote.bind(this),
      'uniswap.swap': this.swap.bind(this),
      'uniswap.completeSwap': this.completeSwap.bind(this)
    };

    console.log(`🦄 ${this.name} initialized (UR: ${this.universalRouter}, Permit2: ${this.permit2}${this.quoterV4 ? `, QuoterV4: ${this.quoterV4}` : ''})`);
  }

  getSupportedOperations() { return Object.keys(this.operations); }
  supports(op) { return op in this.operations; }
  async* execute(operation, args, viem) { if (!this.supports(operation)) { yield { status: 'error', message: `Operation '${operation}' not supported by ${this.name}` }; return; } yield* this.operations[operation](args, viem); }

  // Helpers
  async _erc20Decimals(publicClient, token) {
    try { return await publicClient.readContract({ address: token, abi: ERC20_ABI, functionName: 'decimals' }); } catch { return 18; }
  }

  // ---------------------------------------------------------------------------
  // Approvals (Permit2 flow)
  // ---------------------------------------------------------------------------

  async* checkApproval(args, { publicClient, account }) {
    const { tokenAddress } = args;
    const owner = (typeof account === 'string') ? account : (account?.address || account);
    yield { status: 'pending', message: 'Checking Permit2 approvals...', step: 'check' };
    try {
      const erc20Allowance = await publicClient.readContract({ address: tokenAddress, abi: ERC20_ABI, functionName: 'allowance', args: [owner, this.permit2] });
      let permit2Allowance = 0n;
      let permit2Expiration = 0n;
      try {
        const [amt, exp] = await publicClient.readContract({ address: this.permit2, abi: PERMIT2_ABI, functionName: 'allowance', args: [owner, tokenAddress, this.universalRouter] });
        permit2Allowance = BigInt(amt);
        permit2Expiration = BigInt(exp);
      } catch {}

      const balance = await publicClient.readContract({ address: tokenAddress, abi: ERC20_ABI, functionName: 'balanceOf', args: [owner] });
      const approved = (erc20Allowance > 0n) && (permit2Allowance > 0n);
      yield {
        status: 'success',
        message: 'Approval status checked',
        step: 'complete',
        data: {
          erc20Allowance: erc20Allowance.toString(),
          permit2Allowance: permit2Allowance.toString(),
          permit2Expiration: permit2Expiration.toString(),
          balance: balance.toString(),
          balanceFormatted: formatEther(balance),
          isApproved: approved,
          tokenAddress,
          spenderERC20: this.permit2,
          spenderPermit2: this.universalRouter
        }
      };
    } catch (e) {
      yield { status: 'error', message: `Approval check failed: ${e.message}` };
    }
  }

  async* approve(args, { publicClient, walletClient, account }) {
    const { tokenAddress, amount } = args;
    const owner = (typeof account === 'string') ? account : (account?.address || account);
    const amountWei = (amount === 'max' || amount === 'unlimited') ? (2n ** 256n - 1n) : (typeof amount === 'string' ? parseEther(amount) : amount);
    const amount160 = (amount === 'max' || amount === 'unlimited') ? (2n ** 160n - 1n) : (amountWei > (2n ** 160n - 1n) ? (2n ** 160n - 1n) : amountWei);

    yield { status: 'pending', message: 'Approving ERC20 -> Permit2...', step: 'erc20_approve' };
    try {
      const tx1 = await walletClient.writeContract({ address: tokenAddress, abi: ERC20_ABI, functionName: 'approve', args: [this.permit2, amountWei], account });
      yield { status: 'pending', message: 'Waiting for ERC20 approval confirmation...', step: 'erc20_confirm', data: { transactionHash: tx1 } };
      const rcpt1 = await publicClient.waitForTransactionReceipt({ hash: tx1 });
      yield { status: 'pending', message: 'Approving Permit2 -> Universal Router...', step: 'permit2_approve' };

      const nowSec = BigInt(Math.floor(Date.now() / 1000));
      const oneYear = 365n * 24n * 3600n;
      const expiration = nowSec + oneYear;
      const cappedExp = expiration > (2n ** 48n - 1n) ? (2n ** 48n - 1n) : expiration;
      const tx2 = await walletClient.writeContract({ address: this.permit2, abi: PERMIT2_ABI, functionName: 'approve', args: [tokenAddress, this.universalRouter, BigInt(amount160), Number(cappedExp)] , account });
      yield { status: 'pending', message: 'Waiting for Permit2 approval confirmation...', step: 'permit2_confirm', data: { transactionHash: tx2 } };
      const rcpt2 = await publicClient.waitForTransactionReceipt({ hash: tx2 });

      yield { status: 'success', message: 'Token approved for Universal Router via Permit2', step: 'complete', data: { txERC20: tx1, txPermit2: tx2, receipts: [rcpt1, rcpt2] } };
    } catch (e) {
      yield { status: 'error', message: `Approval failed: ${e.message}` };
    }
  }

  // Optional: quote via v4 Quoter
  async* quote(args, { publicClient }) {
    const { tokenIn, tokenOut, amountIn, fee, tickSpacing, hooks = '0x0000000000000000000000000000000000000000' } = args;
    if (!this.quoterV4) { yield { status: 'error', message: 'QuoterV4 address not configured' }; return; }
    try {
      const decIn = await this._erc20Decimals(publicClient, tokenIn);
      const amountInWei = typeof amountIn === 'string' ? parseUnits(amountIn, decIn) : amountIn;
      const [currency0, currency1] = [tokenIn.toLowerCase() < tokenOut.toLowerCase() ? tokenIn : tokenOut, tokenIn.toLowerCase() < tokenOut.toLowerCase() ? tokenOut : tokenIn];
      const zeroForOne = tokenIn.toLowerCase() === currency0.toLowerCase();

      const params = {
        poolKey: { currency0, currency1, fee: Number(fee), tickSpacing: Number(tickSpacing), hooks },
        zeroForOne,
        exactAmount: amountInWei,
        hookData: '0x'
      };
      const [amountOut] = await publicClient.readContract({ address: this.quoterV4, abi: V4_QUOTER_ABI, functionName: 'quoteExactInputSingle', args: [params] });
      yield { status: 'success', message: 'Quoted via v4 Quoter', step: 'complete', data: { amountOut: amountOut.toString() } };
    } catch (e) { yield { status: 'error', message: `Quote failed: ${e.message}` }; }
  }

  // Execute a v4 swap via Universal Router using pre-encoded payload
  // Args:
  // - commands: bytes (0x...)
  // - inputs: bytes[] ([0x..., 0x...]) where the first is abi.encode(bytes actions, bytes[] params)
  // - deadline?: number (unix seconds). If omitted, uses 20 minutes from now
  // - value?: bigint|string (wei) when swapping native POL as input
  async* swap(args, { publicClient, walletClient, account }) {
    const { commands, inputs, deadline, value } = args || {};
    const useDeadline = deadline ?? Math.floor(Date.now() / 1000) + 60 * 20;
    const txOpts = {};
    if (value && value !== '0') txOpts.value = typeof value === 'string' ? BigInt(value) : value;

    if (!commands || !inputs || !Array.isArray(inputs) || inputs.length === 0) {
      yield { status: 'error', message: 'Missing commands/inputs. Provide pre-encoded Universal Router V4 payload.' };
      return;
    }

    try {
      yield { status: 'pending', message: 'Submitting Universal Router execute...', step: 'execute' };
      const hash = await walletClient.writeContract({
        address: this.universalRouter,
        abi: UNIVERSAL_ROUTER_ABI,
        functionName: 'execute',
        args: [commands, inputs, BigInt(useDeadline)],
        account,
        ...txOpts
      });
      yield { status: 'pending', message: 'Waiting for confirmation...', step: 'confirm', data: { transactionHash: hash } };
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      yield { status: 'success', message: 'Uniswap v4 swap executed', step: 'complete', data: { transactionHash: hash, receipt } };
    } catch (e) {
      yield { status: 'error', message: `Universal Router execute failed: ${e.message}` };
    }
  }

  // Composed convenience: approvals → (build payload if needed) → execute
  async* completeSwap(args, viem) {
    const { tokenIn, tokenOut, amount, slippageBps = 50, fee = 500, tickSpacing = 10, hooks = '0x0000000000000000000000000000000000000000', value } = args || {};
    yield { status: 'pending', message: 'Preparing Uniswap v4 swap...', step: 'prepare' };
    const isNativeIn = (tokenIn?.toLowerCase?.() === '0x0000000000000000000000000000000000000000');

    // Approvals for ERC-20 input
    if (!isNativeIn) {
      let approved = false;
      for await (const st of this.checkApproval({ tokenAddress: tokenIn }, viem)) {
        if (st.status === 'success') { approved = !!st.data?.isApproved; break; }
        if (st.status === 'error') { throw new Error(st.message); }
        yield st;
      }
      if (!approved) {
        yield { status: 'pending', message: 'Approving input token via Permit2...', step: 'approve_start' };
        for await (const st of this.approve({ tokenAddress: tokenIn, amount: 'unlimited' }, viem)) {
          if (st.status === 'success') break;
          if (st.status === 'error') throw new Error(st.message);
          yield st;
        }
      }
    }

    // If pre-encoded payload provided, just execute
    if (args.commands && args.inputs) {
      yield { status: 'pending', message: 'Executing provided Universal Router payload...', step: 'execute_provided' };
      for await (const st of this.swap({ commands: args.commands, inputs: args.inputs, deadline: args.deadline, value }, viem)) {
        yield st; if (st.status !== 'pending') break;
      }
      return;
    }

    // Build payload in-code (single hop exact-in)
    const { publicClient } = viem;
    const decIn = isNativeIn ? 18 : await this._erc20Decimals(publicClient, tokenIn);
    const amountIn = typeof amount === 'string' ? parseUnits(amount, decIn) : amount;

    // Compute minOut via QuoterV4 if configured
    let amountOutMinimum = 0n;
    try {
      if (this.quoterV4) {
        yield { status: 'pending', message: 'Quoting via v4 Quoter...', step: 'quote' };
        const [currency0, currency1] = tokenIn.toLowerCase() < tokenOut.toLowerCase()
          ? [tokenIn, tokenOut] : [tokenOut, tokenIn];
        const zeroForOne = tokenIn.toLowerCase() === currency0.toLowerCase();
        const [quotedOut] = await publicClient.readContract({
          address: this.quoterV4,
          abi: V4_QUOTER_ABI,
          functionName: 'quoteExactInputSingle',
          args: [{
            poolKey: { currency0, currency1, fee: Number(fee), tickSpacing: Number(tickSpacing), hooks },
            zeroForOne,
            exactAmount: amountIn,
            hookData: '0x'
          }]
        });
        const bps = BigInt(10000 - Number(slippageBps));
        amountOutMinimum = (quotedOut * bps) / 10000n;
        yield { status: 'pending', message: `Quoted minOut: ${amountOutMinimum.toString()}`, step: 'quote_done', data: { amountOutMinimum: amountOutMinimum.toString() } };
      }
    } catch {}

    const [currency0, currency1] = tokenIn.toLowerCase() < tokenOut.toLowerCase()
      ? [tokenIn, tokenOut] : [tokenOut, tokenIn];
    const zeroForOne = tokenIn.toLowerCase() === currency0.toLowerCase();

    yield { status: 'pending', message: 'Building v4 actions...', step: 'build_actions' };
    const v4 = new V4Planner();
    v4.addAction(Actions.SWAP_EXACT_IN_SINGLE, [{
      poolKey: { currency0, currency1, fee: Number(fee), tickSpacing: Number(tickSpacing), hooks },
      zeroForOne,
      amountIn: amountIn.toString(),
      amountOutMinimum: amountOutMinimum.toString(),
      hookData: '0x'
    }]);
    v4.addAction(Actions.SETTLE_ALL, [zeroForOne ? currency0 : currency1, amountIn.toString()]);
    v4.addAction(Actions.TAKE_ALL, [zeroForOne ? currency1 : currency0, amountOutMinimum.toString()]);

    const encodedActions = v4.finalize();
    yield { status: 'pending', message: 'Building UR commands...', step: 'build_commands' };
    const rp = new RoutePlanner();
    rp.addCommand(CommandType.V4_SWAP, [v4.actions, v4.params]);
    const commands = rp.commands;
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

    yield { status: 'pending', message: 'Executing Universal Router...', step: 'execute' };
    for await (const st of this.swap({ commands, inputs: [encodedActions], deadline, value }, viem)) {
      yield st; if (st.status !== 'pending') break;
    }
  }
}

export default UniswapV4Cartridge;
