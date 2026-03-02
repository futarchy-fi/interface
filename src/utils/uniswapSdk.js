import { ethers } from "ethers";
import { isSafeWallet } from './ethersAdapters';

// Universal Router addresses by chain
const UNIVERSAL_ROUTER_ADDRESSES = {
  1: '0x66a9893cc07d91d95644aedd05d03f95e1dba8af',      // Ethereum Mainnet
  137: '0x1095692a6237d83c6a72f3f5efedb9a670c49223',    // Polygon
  10: '0xb555edF5dcF85f42cEeF1f3630a52A108E55A654',     // Optimism
  42161: '0x4C60051384bd2d3C01bfc845Cf5F4b44bcbE9de5', // Arbitrum
  100: '0x1095692a6237d83c6a72f3f5efedb9a670c49223',    // Gnosis (if deployed)
};

// QuoterV2 addresses by chain
const QUOTER_V2_ADDRESSES = {
  1: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',      // Ethereum Mainnet
  137: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',    // Polygon
  10: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',     // Optimism
  42161: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e', // Arbitrum
  8453: '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a',  // Base
  100: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',    // Gnosis (assuming same pattern)
};

// Permit2 address (same on all chains)
const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3';

// Universal Router Commands
const Commands = {
  V3_SWAP_EXACT_IN: 0x00,
  V3_SWAP_EXACT_OUT: 0x01,
  PERMIT2_PERMIT: 0x0a,
  WRAP_ETH: 0x0b,
  UNWRAP_WETH: 0x0c,
  PERMIT2_TRANSFER_FROM_BATCH: 0x0d,
  V4_SWAP: 0x10,
  SWEEP: 0x04,
  PAY_PORTION: 0x06,
};

// Recipients
const RECIPIENT_MSG_SENDER = '0x0000000000000000000000000000000000000002';

// Max values
const MAX_UINT256 = ethers.constants.MaxUint256;
const MAX_UINT160 = ethers.BigNumber.from("0xffffffffffffffffffffffffffffffffffffffff");
const MAX_UINT48 = ethers.BigNumber.from("0xffffffffffff");
const PERMIT2_MAX_EXPIRATION = MAX_UINT48.toNumber();

// Runtime config gas limits (from runtime-chains.config.json)
const GAS_CONFIG = {
  1: {
    minPriorityFeeGwei: "0.04",
    maxFeeGwei: "150",
    gasLimits: {
      split: 1000000,
      merge: 1500000,
      swap: 350000,
      approve: 100000
    }
  },
  137: {
    minPriorityFeeGwei: "30",
    maxFeeGwei: "500",
    gasLimits: {
      split: 1500000,
      merge: 1500000,
      swap: 500000,
      approve: 100000
    }
  },
  100: {
    minPriorityFeeGwei: "1",
    maxFeeGwei: "50",
    gasLimits: {
      split: 1500000,
      merge: 1500000,
      swap: 500000,
      approve: 100000
    }
  }
};

// ABI fragments
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)"
];

// Viem-compatible ABI
const ERC20_ABI_VIEM = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ type: 'bool' }]
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' }
    ],
    outputs: [{ type: 'uint256' }]
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint8' }]
  },
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }]
  }
];

const PERMIT2_ABI = [
  "function allowance(address owner, address token, address spender) view returns (uint160 amount, uint48 expiration, uint48 nonce)",
  "function approve(address token, address spender, uint160 amount, uint48 expiration)"
];

const PERMIT2_ABI_VIEM = [
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
  },
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
  }
];

const UNIVERSAL_ROUTER_ABI = [
  "function execute(bytes commands, bytes[] inputs, uint256 deadline) payable"
];

const UNIVERSAL_ROUTER_ABI_VIEM = [
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

const QUOTER_V2_ABI = [
  "function quoteExactInputSingle(tuple(address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
  "function quoteExactInput(bytes path, uint256 amountIn) external returns (uint256 amountOut, uint160[] sqrtPriceX96AfterList, uint32[] initializedTicksCrossedList, uint256 gasEstimate)"
];

/**
 * Get gas configuration for a specific chain
 */
function getGasConfig(chainId) {
  return GAS_CONFIG[chainId] || GAS_CONFIG[1]; // Default to Ethereum if chain not found
}

/**
 * Calculate gas price following SDK pattern
 */
async function calculateGasPrice(provider, chainId = 1) {
  const config = getGasConfig(chainId);
  const minPriorityFee = ethers.utils.parseUnits(config.minPriorityFeeGwei, "gwei");

  try {
    const feeData = await provider.getFeeData();

    // Use network's priority fee but ensure it meets minimum
    let maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || minPriorityFee;
    if (maxPriorityFeePerGas.lt(minPriorityFee)) {
      maxPriorityFeePerGas = minPriorityFee;
    }

    // Calculate max fee with buffer
    let maxFeePerGas = feeData.maxFeePerGas;
    if (!maxFeePerGas) {
      // If no EIP-1559, use gas price + priority fee
      const gasPrice = feeData.gasPrice || ethers.utils.parseUnits("20", "gwei");
      maxFeePerGas = gasPrice.add(maxPriorityFeePerGas);
    }

    // Apply max fee cap from config
    const maxFeeCap = ethers.utils.parseUnits(config.maxFeeGwei, "gwei");
    if (maxFeePerGas.gt(maxFeeCap)) {
      maxFeePerGas = maxFeeCap;
    }

    return { maxPriorityFeePerGas, maxFeePerGas };
  } catch (error) {
    console.warn("Error calculating gas price, using defaults:", error);
    return {
      maxPriorityFeePerGas: minPriorityFee,
      maxFeePerGas: ethers.utils.parseUnits(config.maxFeeGwei, "gwei")
    };
  }
}

/**
 * Check ERC20 approval to Permit2
 */
async function checkERC20Approval(tokenAddress, ownerAddress, provider, publicClient = null) {
  if (publicClient) {
    // Use viem
    const allowanceResult = await publicClient.readContract({
      address: tokenAddress,
      abi: ERC20_ABI_VIEM,
      functionName: 'allowance',
      args: [ownerAddress, PERMIT2_ADDRESS]
    });
    return ethers.BigNumber.from(allowanceResult.toString());
  } else {
    // Use ethers
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const allowance = await tokenContract.allowance(ownerAddress, PERMIT2_ADDRESS);
    return allowance;
  }
}

/**
 * Check Permit2 approval to Universal Router
 */
async function checkPermit2Approval(tokenAddress, ownerAddress, provider, chainId = 1, publicClient = null) {
  const routerAddress = UNIVERSAL_ROUTER_ADDRESSES[chainId];

  try {
    let amount, expiration, nonce;

    if (publicClient) {
      // Use viem
      const result = await publicClient.readContract({
        address: PERMIT2_ADDRESS,
        abi: PERMIT2_ABI_VIEM,
        functionName: 'allowance',
        args: [ownerAddress, tokenAddress, routerAddress]
      });
      [amount, expiration, nonce] = result;
    } else {
      // Use ethers
      const permit2Contract = new ethers.Contract(PERMIT2_ADDRESS, PERMIT2_ABI, provider);
      [amount, expiration, nonce] = await permit2Contract.allowance(
        ownerAddress,
        tokenAddress,
        routerAddress
      );
    }

    const now = Math.floor(Date.now() / 1000);

    // Convert to appropriate types (handle both BigNumber and BigInt)
    let amountBN, expirationNum;

    // Handle amount (could be BigNumber or BigInt)
    if (typeof amount === 'bigint') {
      amountBN = ethers.BigNumber.from(amount.toString());
    } else {
      amountBN = amount; // Already a BigNumber
    }

    // Handle expiration (could be BigNumber, BigInt, or number)
    if (typeof expiration === 'bigint') {
      expirationNum = Number(expiration);
    } else if (typeof expiration === 'object' && expiration.toNumber) {
      expirationNum = expiration.toNumber();
    } else {
      expirationNum = Number(expiration);
    }

    // Check if approved: amount > 0 and not expired
    const isApproved = amountBN.gt(0) && expirationNum > now;

    // Check if this is a MAX approval
    const isMaxApproval = amountBN.gte(MAX_UINT160) && expirationNum >= Number(MAX_UINT48);

    console.log('[Permit2] Approval check:', {
      token: tokenAddress,
      owner: ownerAddress,
      router: routerAddress,
      amount: amountBN.toString(),
      amountHex: amountBN.toHexString(),
      expiration: expirationNum,
      expirationHex: '0x' + expirationNum.toString(16),
      now,
      isApproved,
      isMaxApproval,
      timeUntilExpiry: expirationNum - now,
      MAX_UINT160: MAX_UINT160.toString(),
      MAX_UINT48: MAX_UINT48.toString()
    });

    return {
      amount: amountBN,
      expiration: expirationNum,
      nonce: typeof nonce === 'object' && nonce.toNumber ? nonce.toNumber() : Number(nonce),
      isApproved
    };
  } catch (error) {
    console.error("Error checking Permit2 approval:", error);
    return {
      amount: ethers.BigNumber.from(0),
      expiration: 0,
      nonce: 0,
      isApproved: false
    };
  }
}

/**
 * Approve token to Permit2 (Step 1 of cartridge flow)
 */
export async function approveTokenToPermit2(tokenAddress, signer, walletClient = null, publicClient = null, amount = MAX_UINT256) {
  const isEthersSigner = signer && signer.getChainId && typeof signer.getChainId === 'function' && !signer._isSigner;

  let chainId;
  if (isEthersSigner) {
    chainId = await signer.getChainId();
  } else {
    chainId = await publicClient.getChainId();
  }

  const config = getGasConfig(chainId);

  if (isEthersSigner) {
    // Use ethers
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
    const gasPrice = await calculateGasPrice(signer.provider, chainId);

    const tx = await tokenContract.approve(PERMIT2_ADDRESS, amount, {
      gasLimit: config.gasLimits.approve,
      ...gasPrice
    });

    return tx;
  } else {
    // Use viem
    const hash = await walletClient.writeContract({
      address: tokenAddress,
      abi: ERC20_ABI_VIEM,
      functionName: 'approve',
      args: [PERMIT2_ADDRESS, amount.toString()]
    });

    // Check for Safe wallet
    if (walletClient && isSafeWallet(walletClient)) {
      console.log('[approveTokenToPermit2] Safe wallet detected - skipping wait() and throwing SAFE_TRANSACTION_SENT');
      throw new Error("SAFE_TRANSACTION_SENT");
    }

    return { hash };
  }
}

/**
 * Approve Permit2 to Universal Router (Step 2 of cartridge flow)
 */
export async function approvePermit2ToRouter(tokenAddress, signer, amount = MAX_UINT160, duration = 'max', walletClient = null, publicClient = null, chainId = null) {
  const isEthersSigner = signer && signer.getChainId && typeof signer.getChainId === 'function' && !signer._isSigner;

  if (!chainId) {
    chainId = isEthersSigner ? await signer.getChainId() : await publicClient.getChainId();
  }

  const routerAddress = UNIVERSAL_ROUTER_ADDRESSES[chainId];
  const config = getGasConfig(chainId);

  // Calculate expiration
  let expiration;
  if (duration === 'max') {
    expiration = PERMIT2_MAX_EXPIRATION;
  } else {
    const now = Math.floor(Date.now() / 1000);
    const durationSeconds = typeof duration === 'number' ? duration : 31536000; // 1 year default
    expiration = Math.min(now + durationSeconds, PERMIT2_MAX_EXPIRATION);
  }

  let tx;

  if (isEthersSigner) {
    // Use ethers
    const permit2Contract = new ethers.Contract(PERMIT2_ADDRESS, PERMIT2_ABI, signer);
    const gasPrice = await calculateGasPrice(signer.provider, chainId);

    tx = await permit2Contract.approve(
      tokenAddress,
      routerAddress,
      amount,
      expiration,
      {
        gasLimit: config.gasLimits.approve,
        ...gasPrice
      }
    );
  } else {
    // Use viem
    const hash = await walletClient.writeContract({
      address: PERMIT2_ADDRESS,
      abi: PERMIT2_ABI_VIEM,
      functionName: 'approve',
      args: [tokenAddress, routerAddress, amount.toString(), expiration]
    });

    tx = { hash };

    // Check for Safe wallet
    if (walletClient && isSafeWallet(walletClient)) {
      console.log('[approvePermit2ToRouter] Safe wallet detected - skipping wait() and throwing SAFE_TRANSACTION_SENT');
      throw new Error("SAFE_TRANSACTION_SENT");
    }
  }

  return tx;
}

/**
 * Execute swap through Universal Router (Step 3 of cartridge flow)
 */
export async function executeUniswapV3Swap({
  tokenIn,
  tokenOut,
  amountIn,
  minAmountOut = "0",
  fee = 500, // 0.05% for conditional tokens
  recipient,
  signer,
  walletClient = null,
  publicClient = null,
  account = null
}) {
  const isEthersSigner = signer && signer.getChainId && typeof signer.getChainId === 'function' && !signer._isSigner;

  let chainId, routerAddress, ownerAddress;

  if (isEthersSigner) {
    chainId = await signer.getChainId();
    ownerAddress = await signer.getAddress();
  } else {
    chainId = await publicClient.getChainId();
    ownerAddress = account;
  }

  routerAddress = UNIVERSAL_ROUTER_ADDRESSES[chainId];
  const config = getGasConfig(chainId);

  // Check Permit2 approval before executing swap
  const permit2Status = await checkPermit2Approval(tokenIn, ownerAddress, isEthersSigner ? signer.provider : null, chainId, publicClient);

  if (!permit2Status.isApproved) {
    console.log('[UniswapSDK] Permit2 approval expired or missing, renewing...');

    // First check ERC20 approval to Permit2
    const erc20Allowance = await checkERC20Approval(tokenIn, ownerAddress, isEthersSigner ? signer.provider : null, publicClient);
    const amountInWei = ethers.utils.parseUnits(amountIn.toString(), 18); // Will be adjusted later

    if (erc20Allowance.lt(amountInWei)) {
      console.log('[UniswapSDK] ERC20 approval to Permit2 needed, approving...');
      const approveTx = await approveTokenToPermit2(tokenIn, signer, walletClient, publicClient);

      if (isEthersSigner) {
        await approveTx.wait();
      } else {
        await publicClient.waitForTransactionReceipt({ hash: approveTx.hash });
      }
      console.log('[UniswapSDK] ERC20 approval to Permit2 completed');
    }

    // Now approve Permit2 to Universal Router
    console.log('[UniswapSDK] Approving Permit2 to Universal Router...');
    const permit2Tx = await approvePermit2ToRouter(tokenIn, signer, MAX_UINT160, 'max', walletClient, publicClient, chainId);

    if (isEthersSigner) {
      await permit2Tx.wait();
    } else {
      await publicClient.waitForTransactionReceipt({ hash: permit2Tx.hash });
    }
    console.log('[UniswapSDK] Permit2 approval to Router completed');
  } else {
    console.log('[UniswapSDK] Permit2 already approved, proceeding with swap');
  }

  // Get token decimals
  let decimalsIn, decimalsOut, symbolIn, symbolOut;

  if (isEthersSigner) {
    const tokenInContract = new ethers.Contract(tokenIn, ERC20_ABI, signer.provider);
    const tokenOutContract = new ethers.Contract(tokenOut, ERC20_ABI, signer.provider);

    [decimalsIn, decimalsOut, symbolIn, symbolOut] = await Promise.all([
      tokenInContract.decimals(),
      tokenOutContract.decimals(),
      tokenInContract.symbol(),
      tokenOutContract.symbol()
    ]);
  } else {
    // Use viem
    [decimalsIn, decimalsOut, symbolIn, symbolOut] = await Promise.all([
      publicClient.readContract({ address: tokenIn, abi: ERC20_ABI_VIEM, functionName: 'decimals' }),
      publicClient.readContract({ address: tokenOut, abi: ERC20_ABI_VIEM, functionName: 'decimals' }),
      publicClient.readContract({ address: tokenIn, abi: ERC20_ABI_VIEM, functionName: 'symbol' }),
      publicClient.readContract({ address: tokenOut, abi: ERC20_ABI_VIEM, functionName: 'symbol' })
    ]);
  }

  // Parse amounts
  const amountInWei = ethers.utils.parseUnits(amountIn.toString(), decimalsIn);
  const minAmountOutWei = ethers.utils.parseUnits(minAmountOut.toString(), decimalsOut);

  // Build the path: tokenIn + fee (3 bytes) + tokenOut
  // Using ethers encodePacked equivalent
  const path = ethers.utils.solidityPack(
    ['address', 'uint24', 'address'],
    [tokenIn, fee, tokenOut]
  );

  // Encode V3_SWAP_EXACT_IN parameters
  const v3SwapParams = ethers.utils.defaultAbiCoder.encode(
    ['address', 'uint256', 'uint256', 'bytes', 'bool'],
    [
      recipient || RECIPIENT_MSG_SENDER,
      amountInWei,
      minAmountOutWei,
      path,
      true // payerIsUser
    ]
  );

  // Encode SWEEP parameters
  const sweepParams = ethers.utils.defaultAbiCoder.encode(
    ['address', 'address', 'uint256'],
    [
      tokenOut,
      recipient || ownerAddress,
      minAmountOutWei
    ]
  );

  // Build commands (following exact SDK pattern)
  const commands = ethers.utils.hexlify([Commands.V3_SWAP_EXACT_IN, Commands.SWEEP]);
  const inputs = [v3SwapParams, sweepParams];
  const deadline = ethers.BigNumber.from(Math.floor(Date.now() / 1000) + 1200); // 20 minutes

  let tx;

  if (isEthersSigner) {
    // Use ethers
    const gasPrice = await calculateGasPrice(signer.provider, chainId);
    const routerContract = new ethers.Contract(routerAddress, UNIVERSAL_ROUTER_ABI, signer);

    tx = await routerContract.execute(commands, inputs, deadline, {
      value: 0,
      gasLimit: config.gasLimits.swap,
      ...gasPrice
    });
  } else {
    // Use viem
    const hash = await walletClient.writeContract({
      address: routerAddress,
      abi: UNIVERSAL_ROUTER_ABI_VIEM,
      functionName: 'execute',
      args: [commands, inputs, deadline],
      value: BigInt(0)
    });

    tx = { hash };

    // Check for Safe wallet
    if (walletClient && isSafeWallet(walletClient)) {
      console.log('[executeUniswapV3Swap] Safe wallet detected - skipping wait() and throwing SAFE_TRANSACTION_SENT');
      throw new Error("SAFE_TRANSACTION_SENT");
    }
  }

  console.log(`🔄 Swap executed: ${amountIn} ${symbolIn} → ${symbolOut}`);
  console.log(`📝 Transaction: ${tx.hash}`);

  return tx;
}

/**
 * Complete swap flow with all approvals (following cartridge pattern)
 */
export async function completeSwapFlow({
  tokenIn,
  tokenOut,
  amountIn,
  minAmountOut,
  fee = 500,
  recipient,
  signer,
  onProgress
}) {
  const chainId = await signer.getChainId();
  const ownerAddress = await signer.getAddress();

  try {
    // Step 1: Check ERC20 approval to Permit2
    if (onProgress) onProgress({ step: 'checking', message: 'Checking approvals...' });

    const erc20Allowance = await checkERC20Approval(tokenIn, ownerAddress, signer.provider);
    const amountInWei = ethers.utils.parseUnits(amountIn.toString(), 18); // Will be adjusted with actual decimals

    if (erc20Allowance.lt(amountInWei)) {
      if (onProgress) onProgress({ step: 'erc20_approve', message: 'Approving token to Permit2...' });

      const approveTx = await approveTokenToPermit2(tokenIn, signer);
      await approveTx.wait();

      if (onProgress) onProgress({ step: 'erc20_approved', message: 'Token approved to Permit2!' });
    }

    // Step 2: Check Permit2 approval to Universal Router
    const permit2Status = await checkPermit2Approval(tokenIn, ownerAddress, signer.provider, chainId);

    if (!permit2Status.isApproved) {
      if (onProgress) onProgress({ step: 'permit2_approve', message: 'Approving Permit2 to Universal Router...' });

      const permit2Tx = await approvePermit2ToRouter(tokenIn, signer);
      await permit2Tx.wait();

      if (onProgress) onProgress({ step: 'permit2_approved', message: 'Permit2 approved to Router!' });
    }

    // Step 3: Execute the swap
    if (onProgress) onProgress({ step: 'swapping', message: 'Executing swap...' });

    const swapTx = await executeUniswapV3Swap({
      tokenIn,
      tokenOut,
      amountIn,
      minAmountOut,
      fee,
      recipient,
      signer
    });

    const receipt = await swapTx.wait();

    if (onProgress) onProgress({
      step: 'complete',
      message: 'Swap completed!',
      receipt
    });

    return receipt;

  } catch (error) {
    if (onProgress) onProgress({
      step: 'error',
      message: `Error: ${error.message}`,
      error
    });
    throw error;
  }
}

/**
 * Get quote from QuoterV2 for accurate pricing with price impact
 * Returns amountOut and sqrtPriceX96After for price impact calculation
 */
export async function getUniswapV3QuoteWithPriceImpact({
  tokenIn,
  tokenOut,
  amountIn,
  fee = 500,
  provider,
  chainId = 100
}) {
  const quoterAddress = QUOTER_V2_ADDRESSES[chainId];

  if (!quoterAddress) {
    throw new Error(`QuoterV2 not available for chain ${chainId}`);
  }

  const quoterContract = new ethers.Contract(quoterAddress, QUOTER_V2_ABI, provider);

  // Get token decimals first
  const tokenInContract = new ethers.Contract(tokenIn, ERC20_ABI, provider);
  const tokenOutContract = new ethers.Contract(tokenOut, ERC20_ABI, provider);

  const [decimalsIn, decimalsOut] = await Promise.all([
    tokenInContract.decimals(),
    tokenOutContract.decimals()
  ]);

  // Parse amount to wei
  const amountInWei = ethers.utils.parseUnits(amountIn.toString(), decimalsIn);

  // Try multiple fee tiers in case the specified one doesn't have a pool
  const feeTiers = [fee, 500, 3000, 10000]; // Try user-specified first, then common tiers
  const uniqueFeeTiers = [...new Set(feeTiers)]; // Remove duplicates

  let lastError = null;

  for (const feeTier of uniqueFeeTiers) {
    try {
      console.log(`[QuoterV2] Trying fee tier: ${feeTier} (${feeTier / 10000}%)`);

      // Call QuoterV2
      const params = {
        tokenIn,
        tokenOut,
        amountIn: amountInWei,
        fee: feeTier,
        sqrtPriceLimitX96: 0 // No price limit
      };

      // Use callStatic for off-chain simulation
      const result = await quoterContract.callStatic.quoteExactInputSingle(params);

      // Result is [amountOut, sqrtPriceX96After, initializedTicksCrossed, gasEstimate]
      const [amountOut, sqrtPriceX96After, initializedTicksCrossed, gasEstimate] = result;

      // Get current pool price (before trade) - we can derive from the quote
      // For simplicity, calculate price from input/output ratio
      const amountOutFormatted = ethers.utils.formatUnits(amountOut, decimalsOut);
      const amountInFormatted = parseFloat(amountIn);

      // Effective price (how much output per input)
      const effectivePrice = parseFloat(amountOutFormatted) / amountInFormatted;

      console.log(`[QuoterV2] Success with fee tier ${feeTier}! Quote result:`, {
        feeTier,
        amountIn: amountIn.toString(),
        amountOut: amountOut.toString(),
        amountOutFormatted,
        sqrtPriceX96After: sqrtPriceX96After.toString(),
        initializedTicksCrossed: initializedTicksCrossed.toString(),
        gasEstimate: gasEstimate.toString(),
        effectivePrice
      });

      return {
        amountOut: amountOut.toString(),
        amountOutFormatted,
        sqrtPriceX96After: sqrtPriceX96After.toString(),
        initializedTicksCrossed: initializedTicksCrossed.toString(),
        gasEstimate: gasEstimate.toString(),
        effectivePrice,
        decimalsIn,
        decimalsOut,
        feeTier // Return the fee tier that worked
      };
    } catch (error) {
      console.warn(`[QuoterV2] Fee tier ${feeTier} failed:`, error.message);
      lastError = error;
      // Continue to next fee tier
    }
  }

  // If all fee tiers failed, throw the last error
  console.error('[QuoterV2] All fee tiers failed. Last error:', lastError);
  throw new Error(`No Uniswap V3 pool found for this token pair. Tried fee tiers: ${uniqueFeeTiers.join(', ')}`);
}

/**
 * Calculate price from sqrtPriceX96
 * Price = (sqrtPriceX96 / 2^96)^2
 */
export function sqrtPriceX96ToPrice(sqrtPriceX96) {
  const Q96 = ethers.BigNumber.from(2).pow(96);
  const sqrtPrice = ethers.BigNumber.from(sqrtPriceX96);

  // Price = (sqrtPrice / 2^96)^2
  // To avoid precision loss, we calculate: (sqrtPrice^2) / (2^192)
  const sqrtPriceSquared = sqrtPrice.mul(sqrtPrice);
  const Q192 = Q96.mul(Q96);

  // Convert to decimal for display
  const price = parseFloat(sqrtPriceSquared.toString()) / parseFloat(Q192.toString());

  return price;
}

/**
 * Calculate price impact from before/after sqrt prices
 * Price impact % = ((priceAfter - priceBefore) / priceBefore) * 100
 */
export function calculatePriceImpactFromSqrtPrice(sqrtPriceX96Before, sqrtPriceX96After) {
  try {
    const priceBefore = sqrtPriceX96ToPrice(sqrtPriceX96Before);
    const priceAfter = sqrtPriceX96ToPrice(sqrtPriceX96After);

    const priceImpact = ((priceAfter - priceBefore) / priceBefore) * 100;

    console.log('[PriceImpact] Calculation:', {
      sqrtPriceX96Before: sqrtPriceX96Before.toString(),
      sqrtPriceX96After: sqrtPriceX96After.toString(),
      priceBefore,
      priceAfter,
      priceImpact: priceImpact.toFixed(4) + '%'
    });

    return priceImpact;
  } catch (error) {
    console.error('[PriceImpact] Error calculating:', error);
    return null;
  }
}

/**
 * Get current pool sqrt price (for before-trade comparison)
 */
export async function getPoolSqrtPrice(tokenIn, tokenOut, fee, provider, chainId) {
  try {
    // Uniswap V3 Pool ABI (just the slot0 function)
    const POOL_ABI = [
      "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)"
    ];

    // Uniswap V3 Factory to get pool address
    const FACTORY_ABI = [
      "function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)"
    ];

    const FACTORY_ADDRESSES = {
      1: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
      137: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
      10: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
      42161: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
      100: '0x1F98431c8aD98523631AE4a59f267346ea31F984'
    };

    const factoryAddress = FACTORY_ADDRESSES[chainId];
    if (!factoryAddress) {
      throw new Error(`No Uniswap V3 factory for chain ${chainId}`);
    }

    const factory = new ethers.Contract(factoryAddress, FACTORY_ABI, provider);
    const poolAddress = await factory.getPool(tokenIn, tokenOut, fee);

    if (poolAddress === ethers.constants.AddressZero) {
      throw new Error(`No pool found for ${tokenIn}/${tokenOut} with fee ${fee}`);
    }

    const pool = new ethers.Contract(poolAddress, POOL_ABI, provider);
    const slot0 = await pool.slot0();

    return {
      sqrtPriceX96: slot0.sqrtPriceX96.toString(),
      tick: slot0.tick.toString(),
      poolAddress
    };
  } catch (error) {
    console.error('[PoolSqrtPrice] Error:', error);
    throw error;
  }
}

/**
 * Check and approve if needed (helper for ConfirmSwapModal integration)
 */
export async function checkAndApproveForUniswapSDK(
  tokenAddress,
  spenderAddress, // Will be ignored, we use Permit2 flow
  amountToApprove,
  signer,
  onStepComplete,
  useUnlimitedApproval = false, // New parameter: false = exact amount, true = unlimited
  walletClient = null, // viem wallet client for mobile support
  publicClient = null, // viem public client for reading
  account = null // user address for viem
) {
  // Detect if we're using viem or ethers
  const isEthersSigner = signer && signer.getChainId && typeof signer.getChainId === 'function' && !signer._isSigner;

  let chainId;
  let ownerAddress;

  if (isEthersSigner) {
    chainId = await signer.getChainId();
    ownerAddress = await signer.getAddress();
  } else {
    // Using viem - get chainId from publicClient
    chainId = await publicClient.getChainId();
    ownerAddress = account;
  }

  try {
    console.log('[UniswapSDK] Checking approval status for token:', tokenAddress);

    // Check both ERC20 and Permit2 status upfront
    const [erc20Allowance, permit2Status] = await Promise.all([
      checkERC20Approval(tokenAddress, ownerAddress, isEthersSigner ? signer.provider : null, publicClient),
      checkPermit2Approval(tokenAddress, ownerAddress, isEthersSigner ? signer.provider : null, chainId, publicClient)
    ]);

    console.log('[UniswapSDK] Approval status:', {
      erc20ToPermit2: erc20Allowance.toString(),
      permit2Approved: permit2Status.isApproved,
      permit2Amount: permit2Status.amount.toString(),
      permit2Expiration: permit2Status.expiration
    });

    // If Permit2 is already approved and ERC20 has sufficient allowance, we're done
    if (permit2Status.isApproved && erc20Allowance.gte(amountToApprove)) {
      console.log('[UniswapSDK] All approvals already in place, skipping');
      if (onStepComplete) {
        onStepComplete(1, true); // Step 1 already done
        onStepComplete(2, true); // Step 2 already done
      }
      return true;
    }

    // Step 1: Approve ERC20 to Permit2 if needed
    const needsERC20Approval = useUnlimitedApproval
      ? erc20Allowance.lt(MAX_UINT256.div(2)) // For unlimited: check if not already max approved
      : erc20Allowance.lt(amountToApprove); // For exact: check if less than needed amount

    if (needsERC20Approval) {
      console.log(`[UniswapSDK] ERC20 approval needed (${useUnlimitedApproval ? 'unlimited' : 'exact amount'})`);
      if (onStepComplete) onStepComplete(1, false); // Step 1 starting

      const approvalAmount = useUnlimitedApproval ? MAX_UINT256 : amountToApprove;
      const permit2Address = PERMIT2_ADDRESS;

      if (isEthersSigner) {
        // Use ethers
        const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
        const approveTx = await tokenContract.approve(permit2Address, approvalAmount);
        await approveTx.wait();
      } else {
        // Use viem
        const hash = await walletClient.writeContract({
          address: tokenAddress,
          abi: ERC20_ABI_VIEM,
          functionName: 'approve',
          args: [permit2Address, approvalAmount.toString()]
        });
        await publicClient.waitForTransactionReceipt({ hash });
      }

      console.log(`[UniswapSDK] ERC20 approval completed (amount: ${approvalAmount.toString()})`);
      if (onStepComplete) onStepComplete(1, true); // Step 1 complete
    } else {
      console.log('[UniswapSDK] ERC20 approval sufficient, skipping step 1');
      if (onStepComplete) onStepComplete(1, true); // Step 1 already done
    }

    // Step 2: Approve Permit2 to Universal Router if needed
    if (!permit2Status.isApproved) {
      console.log('[UniswapSDK] Permit2 approval needed');
      if (onStepComplete) onStepComplete(2, false); // Step 2 starting

      const permit2Tx = await approvePermit2ToRouter(tokenAddress, signer, MAX_UINT160, 'max', walletClient, publicClient, chainId);

      if (isEthersSigner) {
        await permit2Tx.wait();
      } else {
        await publicClient.waitForTransactionReceipt({ hash: permit2Tx.hash });
      }

      console.log('[UniswapSDK] Permit2 approval completed');
      if (onStepComplete) onStepComplete(2, true); // Step 2 complete
    } else {
      console.log('[UniswapSDK] Permit2 already approved, skipping step 2');
      if (onStepComplete) onStepComplete(2, true); // Step 2 already done
    }

    return true;
  } catch (error) {
    console.error("Approval error:", error);
    throw error;
  }
}

/**
 * Execute swap for ConfirmSwapModal integration
 */
export async function executeSwapForUniswapSDK(
  inputToken,
  outputToken,
  inputAmount,
  minOutputAmount,
  recipient,
  signer,
  slippageTolerance = 0.005,
  walletClient = null,
  publicClient = null,
  account = null
) {
  const isEthersSigner = signer && signer.getChainId && typeof signer.getChainId === 'function' && !signer._isSigner;

  let chainId;
  if (isEthersSigner) {
    chainId = await signer.getChainId();
  } else {
    chainId = await publicClient.getChainId();
  }

  // Determine fee tier based on token type (conditional tokens use 500)
  const fee = 500; // 0.05% for conditional tokens

  // Calculate minimum output with slippage
  const minAmountWithSlippage = ethers.utils.parseUnits(
    (parseFloat(minOutputAmount) * (1 - slippageTolerance)).toString(),
    18
  );

  try {
    const tx = await executeUniswapV3Swap({
      tokenIn: inputToken,
      tokenOut: outputToken,
      amountIn: inputAmount,
      minAmountOut: ethers.utils.formatUnits(minAmountWithSlippage, 18),
      fee,
      recipient: recipient || (isEthersSigner ? await signer.getAddress() : account),
      signer,
      walletClient,
      publicClient,
      account
    });

    return tx;
  } catch (error) {
    console.error("Swap execution error:", error);
    throw error;
  }
}
