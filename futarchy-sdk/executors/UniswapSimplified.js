// executors/UniswapSimplified.js - Simple Uniswap v4 Universal Router cartridge

import { parseEther, formatEther, parseUnits } from 'viem';
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
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint8' }] }
];

const V4_QUOTER_ABI = [
  {
    name: 'quoteExactInputSingle',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{
      name: 'params', type: 'tuple', components: [
        { name: 'poolKey', type: 'tuple', components: [
          { name: 'currency0', type: 'address' },
          { name: 'currency1', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'tickSpacing', type: 'int24' },
          { name: 'hooks', type: 'address' }
        ]},
        { name: 'zeroForOne', type: 'bool' },
        { name: 'exactAmount', type: 'uint256' },
        { name: 'hookData', type: 'bytes' }
      ]
    }],
    outputs: [{ name: 'amountOut', type: 'uint256' }, { name: 'gasEstimate', type: 'uint256' }]
  }
];

export default class UniswapSimplified {
  constructor(cfg) {
    this.name = 'UniswapSimplified';
    this.universalRouter = cfg?.universalRouter;
    this.permit2 = cfg?.permit2 || '0x000000000022D473030F116dDEE9F6B43aC78BA3';
    this.quoterV4 = cfg?.quoterV4 || null;
    try {
      // Lightweight init log for visibility
      // eslint-disable-next-line no-console
      console.log(`[UniswapSimplified] UR: ${this.universalRouter}, Permit2: ${this.permit2}${this.quoterV4 ? `, QuoterV4: ${this.quoterV4}` : ''}`);
    } catch {}
    this.operations = {
      'uniswap.checkApproval': this.checkApproval.bind(this),
      'uniswap.approve': this.approve.bind(this),
      'uniswap.quote': this.quote.bind(this),
      'uniswap.completeSwap': this.completeSwap.bind(this)
    };
  }
  getSupportedOperations() { return Object.keys(this.operations); }
  supports(op) { return op in this.operations; }
  async* execute(op, args, viem) { if (!this.supports(op)) { yield { status: 'error', message: `Unsupported op ${op}` }; return; } yield* this.operations[op](args, viem); }

  async _decimals(publicClient, token) { try { return await publicClient.readContract({ address: token, abi: ERC20_ABI, functionName: 'decimals' }); } catch { return 18; } }

  async* checkApproval(args, { publicClient, account }) {
    const { tokenAddress } = args;
    const owner = (typeof account === 'string') ? account : (account?.address || account);
    yield { status: 'pending', message: 'Checking Permit2 approvals...', step: 'check' };
    try {
      const erc20Allowance = await publicClient.readContract({ address: tokenAddress, abi: ERC20_ABI, functionName: 'allowance', args: [owner, this.permit2] });
      let permit2Allowance = 0n; 
      try { 
        const result = await publicClient.readContract({ address: this.permit2, abi: PERMIT2_ABI, functionName: 'allowance', args: [owner, tokenAddress, this.universalRouter] }); 
        // Handle both array and object return formats
        const amt = Array.isArray(result) ? result[0] : (result?.amount ?? result);
        if (amt !== undefined && amt !== null) {
          try {
            permit2Allowance = BigInt(amt);
          } catch (e) {
            console.error('[UniswapSimplified] Failed to convert permit2 amount to BigInt:', amt, e);
          }
        }
      } catch {}
      yield { status: 'success', step: 'complete', message: 'Approval checked', data: { isApproved: (erc20Allowance > 0n) && (permit2Allowance > 0n), erc20Allowance: erc20Allowance.toString(), permit2Allowance: permit2Allowance.toString(), spenderERC20: this.permit2, spenderUR: this.universalRouter } };
    } catch (e) { yield { status: 'error', message: `Approval check failed: ${e.message}` }; }
  }

  async* approve(args, { publicClient, walletClient, account }) {
    const { tokenAddress, amount = 'unlimited' } = args;
    const amountWei = (amount === 'unlimited' || amount === 'max') ? (2n ** 256n - 1n) : (typeof amount === 'string' ? parseEther(amount) : amount);
    const owner = account;
    try {
      yield { status: 'pending', message: 'Approving ERC20 → Permit2...', step: 'erc20' };
      const tx1 = await walletClient.writeContract({ address: tokenAddress, abi: ERC20_ABI, functionName: 'approve', args: [this.permit2, amountWei], account: owner });
      yield { status: 'pending', message: 'Waiting ERC20 approval...', step: 'erc20_wait', data: { transactionHash: tx1 } };
      await publicClient.waitForTransactionReceipt({ hash: tx1 });
      const now = BigInt(Math.floor(Date.now() / 1000)); const oneYear = 365n * 24n * 3600n; const exp = now + oneYear; const capped = exp > (2n ** 48n - 1n) ? (2n ** 48n - 1n) : exp;
      yield { status: 'pending', message: 'Approving Permit2 → Universal Router...', step: 'permit2' };
      const tx2 = await walletClient.writeContract({ address: this.permit2, abi: PERMIT2_ABI, functionName: 'approve', args: [tokenAddress, this.universalRouter, (2n ** 160n - 1n), Number(capped)], account: owner });
      yield { status: 'pending', message: 'Waiting Permit2 approval...', step: 'permit2_wait', data: { transactionHash: tx2 } };
      await publicClient.waitForTransactionReceipt({ hash: tx2 });
      yield { status: 'success', message: 'Approvals done', step: 'complete' };
    } catch (e) { yield { status: 'error', message: `Approve failed: ${e.message}` }; }
  }

  async* quote(args, { publicClient }) {
    const { tokenIn, tokenOut, amountIn, fee = 500, tickSpacing = 10, hooks = '0x0000000000000000000000000000000000000000' } = args;
    if (!this.quoterV4) { yield { status: 'error', message: 'QuoterV4 not configured' }; return; }
    try {
      const dec = await this._decimals(publicClient, tokenIn);
      const amt = typeof amountIn === 'string' ? parseUnits(amountIn, dec) : amountIn;
      const [c0, c1] = tokenIn.toLowerCase() < tokenOut.toLowerCase() ? [tokenIn, tokenOut] : [tokenOut, tokenIn];
      const zf1 = tokenIn.toLowerCase() === c0.toLowerCase();
      const result = await publicClient.readContract({ address: this.quoterV4, abi: V4_QUOTER_ABI, functionName: 'quoteExactInputSingle', args: [{ poolKey: { currency0: c0, currency1: c1, fee: Number(fee), tickSpacing: Number(tickSpacing), hooks }, zeroForOne: zf1, exactAmount: amt, hookData: '0x' }] });
      // Handle both array and object return formats
      const amountOut = Array.isArray(result) ? result[0] : (result?.amountOut ?? result);
      yield { status: 'success', message: 'Quote ok', step: 'complete', data: { amountOut: amountOut?.toString() || '0' } };
    } catch (e) { yield { status: 'error', message: `Quote failed: ${e.message}` }; }
  }

  async* completeSwap(args, { publicClient, walletClient, account }) {
    const { tokenIn, tokenOut, amount, slippageBps = 50, fee = 500, tickSpacing = 10, hooks = '0x0000000000000000000000000000000000000000', value } = args || {};
    yield { status: 'pending', message: 'Preparing swap...', step: 'prepare' };
    const isNative = tokenIn?.toLowerCase?.() === '0x0000000000000000000000000000000000000000';

    // approvals
    if (!isNative) {
      for await (const st of this.checkApproval({ tokenAddress: tokenIn }, { publicClient, account })) {
        yield st; 
        if (st.status === 'success') {
          if (!st.data?.isApproved) {
            // Need approval
            for await (const ap of this.approve({ tokenAddress: tokenIn, amount: 'unlimited' }, { publicClient, walletClient, account })) { 
              yield ap; 
              if (ap.status !== 'pending') break; 
            }
          }
          break; // Break after successful check (approved or not)
        } else if (st.status === 'error') {
          return; // Exit on error
        }
      }
    }

    // parse amount
    yield { status: 'pending', message: 'Validating input args...', step: 'args', data: { tokenIn, tokenOut, amount, amountType: typeof amount } };
    // Validate inputs and normalize amount
    if (!tokenIn || !tokenOut) {
      yield { status: 'error', message: 'Missing tokenIn or tokenOut' }; return;
    }
    if (amount === undefined || amount === null) {
      yield { status: 'error', message: 'Missing amount for swap' }; return;
    }
    const decRaw = isNative ? 18 : await this._decimals(publicClient, tokenIn);
    const dec = Number(decRaw ?? 18);
    let amountIn;
    try {
      if (typeof amount === 'string') amountIn = parseUnits(amount, dec);
      else if (typeof amount === 'bigint') amountIn = amount;
      else if (typeof amount === 'number') amountIn = parseUnits(String(amount), dec);
      else throw new Error('Unsupported amount type');
    } catch (e) {
      yield { status: 'error', message: `Failed to parse amount: ${e.message}` }; return;
    }
    yield { status: 'pending', message: `AmountIn (wei): ${amountIn?.toString?.() || amountIn}`, step: 'amount_in', data: { decimals: dec } };

    // minOut via quoter
    let minOut = 0n;
    try {
      if (this.quoterV4) {
        const [c0, c1] = tokenIn.toLowerCase() < tokenOut.toLowerCase() ? [tokenIn, tokenOut] : [tokenOut, tokenIn];
        const zf1 = tokenIn.toLowerCase() === c0.toLowerCase();
        const result = await publicClient.readContract({ address: this.quoterV4, abi: V4_QUOTER_ABI, functionName: 'quoteExactInputSingle', args: [{ poolKey: { currency0: c0, currency1: c1, fee: Number(fee), tickSpacing: Number(tickSpacing), hooks }, zeroForOne: zf1, exactAmount: amountIn, hookData: '0x' }] });
        // Handle both array and object return formats
        const q = Array.isArray(result) ? result[0] : (result?.amountOut ?? result);
        if (q !== undefined && q !== null) {
          try {
            minOut = (BigInt(q) * BigInt(10000 - Number(slippageBps))) / 10000n;
          } catch (e) {
            console.error('[UniswapSimplified] Failed to calculate minOut:', q, slippageBps, e);
          }
        }
      }
    } catch {}
    yield { status: 'pending', message: `MinOut: ${formatEther(minOut)}`, step: 'minout' };

    // Build actions/commands
    const [c0, c1] = tokenIn.toLowerCase() < tokenOut.toLowerCase() ? [tokenIn, tokenOut] : [tokenOut, tokenIn];
    const zf1 = tokenIn.toLowerCase() === c0.toLowerCase();
    yield { status: 'pending', message: 'PoolKey selected', step: 'pool_key', data: { currency0: c0, currency1: c1, fee, tickSpacing, hooks, zeroForOne: zf1 } };
    const v4 = new V4Planner();
    v4.addAction(Actions.SWAP_EXACT_IN_SINGLE, [{ poolKey: { currency0: c0, currency1: c1, fee: Number(fee), tickSpacing: Number(tickSpacing), hooks }, zeroForOne: zf1, amountIn: amountIn.toString(), amountOutMinimum: minOut.toString(), hookData: '0x' }]);
    v4.addAction(Actions.SETTLE_ALL, [zf1 ? c0 : c1, amountIn.toString()]);
    v4.addAction(Actions.TAKE_ALL, [zf1 ? c1 : c0, minOut.toString()]);
    const encoded = v4.finalize();
    yield { status: 'pending', message: 'Actions built', step: 'actions_built', data: { encodedLength: (encoded?.length || 0) } };
    const rp = new RoutePlanner(); rp.addCommand(CommandType.V4_SWAP, [v4.actions, v4.params]);
    const commands = rp.commands; const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
    yield { status: 'pending', message: 'Commands built', step: 'commands_built', data: { commandsLength: (commands?.length || 0), deadline } };

    // Execute
    yield { status: 'pending', message: 'Submitting Universal Router execute...', step: 'execute' };
    let txHash;
    try {
      const deadlineBigInt = BigInt(deadline);
      txHash = await walletClient.writeContract({ 
        address: this.universalRouter, 
        abi: UNIVERSAL_ROUTER_ABI, 
        functionName: 'execute', 
        args: [commands, [encoded], deadlineBigInt], 
        account, 
        ...(isNative ? { value: amountIn } : {}) 
      });
    } catch (e) {
      console.error('[UniswapSimplified] Execute failed:', e);
      yield { status: 'error', message: `Transaction failed: ${e.message}` };
      return;
    }
    yield { status: 'pending', message: 'Waiting for confirmation...', step: 'confirm', data: { transactionHash: txHash } };
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    yield { status: 'success', message: 'Swap executed', step: 'complete', data: { transactionHash: txHash, receipt } };
  }
}
