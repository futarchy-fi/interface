import 'dotenv/config'
import {
  createWalletClient,
  createPublicClient,
  http,
  parseUnits,
  encodeAbiParameters,
  concatHex,
  toHex,
  formatUnits,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { polygon } from 'viem/chains'

const UNIVERSAL_ROUTER = '0x1095692a6237d83c6a72f3f5efedb9a670c49223'
const PERMIT2 = '0x000000000022D473030F116dDEE9F6B43aC78BA3'

const TOKEN_IN = '0xfaaD724286C3f774158a45a98B6F82Ae6e7F3E2D' // YES_DAI
const TOKEN_OUT = '0xC558183b4cC78465A2C00a8598bD9f310455966E' // YES_AAVE
const DEC_IN = 18
const DEC_OUT = 18
const AMOUNT_IN = '0.00000001'
const MIN_OUT = '0'

const FEE = 500
const TICK_SPACING = 10
const HOOKS = '0x0000000000000000000000000000000000000000'

let {
  RPC_URL,
  PRIVATE_KEY,
} = process.env

if (!PRIVATE_KEY) {
  console.error('❌ Missing PRIVATE_KEY in .env')
  process.exit(1)
}

// Override with Polygon RPC - ignoring the Gnosis RPC in .env
RPC_URL = 'https://polygon-rpc.com'

// Ensure private key has 0x prefix
if (!PRIVATE_KEY.startsWith('0x')) {
  PRIVATE_KEY = '0x' + PRIVATE_KEY
}

console.log('🚀 Initializing Uniswap v4 swap test...')
console.log('📍 Chain: Polygon (137)')
console.log(`🌐 RPC: ${RPC_URL}`)
console.log('💱 Swap: YES_DAI → YES_AAVE')
console.log(`📊 Amount: ${AMOUNT_IN} YES_DAI`)
console.log('---')

const account = privateKeyToAccount(PRIVATE_KEY)
const walletClient = createWalletClient({ 
  account, 
  chain: polygon, 
  transport: http(RPC_URL) 
})
const publicClient = createPublicClient({
  chain: polygon,
  transport: http(RPC_URL)
})

console.log('🔑 Wallet address:', account.address)

const [currency0, currency1] = [TOKEN_IN, TOKEN_OUT].sort((a, b) =>
  a.toLowerCase().localeCompare(b.toLowerCase())
)
const zeroForOne = TOKEN_IN.toLowerCase() === currency0.toLowerCase()

console.log('📝 Pool configuration:')
console.log('  Currency0:', currency0)
console.log('  Currency1:', currency1)
console.log('  ZeroForOne:', zeroForOne)
console.log('  Fee:', FEE)
console.log('  Tick Spacing:', TICK_SPACING)
console.log('---')

const amountIn = parseUnits(AMOUNT_IN, DEC_IN)
const minOut = parseUnits(MIN_OUT, DEC_OUT)

console.log('💰 Amounts (in wei):')
console.log('  Amount In:', amountIn.toString())
console.log('  Min Out:', minOut.toString())
console.log('---')

const actions = concatHex([
  toHex(0x06, { size: 1 }), // SWAP_EXACT_IN_SINGLE
  toHex(0x0c, { size: 1 }), // SETTLE_ALL
  toHex(0x0f, { size: 1 }), // TAKE_ALL
])

const exactInSingle = encodeAbiParameters(
  [{
    type: 'tuple',
    components: [
      { name: 'poolKey', type: 'tuple', components: [
        { name: 'currency0', type: 'address' },
        { name: 'currency1', type: 'address' },
        { name: 'fee', type: 'uint24' },
        { name: 'tickSpacing', type: 'int24' },
        { name: 'hooks', type: 'address' },
      ]},
      { name: 'zeroForOne', type: 'bool' },
      { name: 'amountIn', type: 'uint128' },
      { name: 'amountOutMinimum', type: 'uint128' },
      { name: 'hookData', type: 'bytes' },
    ]
  }],
  [{
    poolKey: {
      currency0,
      currency1,
      fee: BigInt(FEE),
      tickSpacing: Number(TICK_SPACING),
      hooks: HOOKS,
    },
    zeroForOne,
    amountIn,
    amountOutMinimum: minOut,
    hookData: '0x',
  }]
)

const settleAll = encodeAbiParameters(
  [{ type: 'address' }, { type: 'uint256' }],
  [zeroForOne ? currency0 : currency1, amountIn]
)

const takeAll = encodeAbiParameters(
  [{ type: 'address' }, { type: 'uint256' }],
  [zeroForOne ? currency1 : currency0, minOut]
)

const v4Input = encodeAbiParameters(
  [{ type: 'bytes' }, { type: 'bytes[]' }],
  [actions, [exactInSingle, settleAll, takeAll]]
)

const commands = toHex(0x10, { size: 1 }) // V4_SWAP

async function checkBalances() {
  console.log('📊 Checking token balances...')
  
  const erc20Abi = [
    {
      type: 'function',
      name: 'balanceOf',
      stateMutability: 'view',
      inputs: [{ name: 'account', type: 'address' }],
      outputs: [{ type: 'uint256' }],
    },
    {
      type: 'function',
      name: 'symbol',
      stateMutability: 'view',
      inputs: [],
      outputs: [{ type: 'string' }],
    },
    {
      type: 'function',
      name: 'decimals',
      stateMutability: 'view',
      inputs: [],
      outputs: [{ type: 'uint8' }],
    },
  ]

  try {
    const [balanceIn, balanceOut, symbolIn, symbolOut] = await Promise.all([
      publicClient.readContract({
        address: TOKEN_IN,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [account.address],
      }),
      publicClient.readContract({
        address: TOKEN_OUT,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [account.address],
      }),
      publicClient.readContract({
        address: TOKEN_IN,
        abi: erc20Abi,
        functionName: 'symbol',
      }),
      publicClient.readContract({
        address: TOKEN_OUT,
        abi: erc20Abi,
        functionName: 'symbol',
      }),
    ])

    console.log(`  ${symbolIn}: ${formatUnits(balanceIn, DEC_IN)}`)
    console.log(`  ${symbolOut}: ${formatUnits(balanceOut, DEC_OUT)}`)
    
    if (balanceIn < amountIn) {
      console.error(`❌ Insufficient ${symbolIn} balance!`)
      console.error(`   Required: ${AMOUNT_IN}`)
      console.error(`   Available: ${formatUnits(balanceIn, DEC_IN)}`)
      return false
    }
    
    return true
  } catch (error) {
    console.error('❌ Error checking balances:', error.message)
    return false
  }
}

async function checkAndApprove() {
  console.log('🔐 Checking and setting up approvals...')
  
  const erc20Abi = [
    {
      type: 'function',
      name: 'allowance',
      stateMutability: 'view',
      inputs: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
      ],
      outputs: [{ type: 'uint256' }],
    },
    {
      type: 'function',
      name: 'approve',
      stateMutability: 'nonpayable',
      inputs: [
        { name: 'spender', type: 'address' },
        { name: 'amount', type: 'uint256' },
      ],
      outputs: [{ type: 'bool' }],
    },
  ]

  try {
    const allowanceToPermit2 = await publicClient.readContract({
      address: TOKEN_IN,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [account.address, PERMIT2],
    })

    if (allowanceToPermit2 < amountIn) {
      console.log('  ⚠️  Need to approve YES_DAI to Permit2...')
      const hash = await walletClient.writeContract({
        address: TOKEN_IN,
        abi: erc20Abi,
        functionName: 'approve',
        args: [PERMIT2, 2n ** 256n - 1n],
      })
      console.log('  ✅ Approval tx:', hash)
      await publicClient.waitForTransactionReceipt({ hash })
    } else {
      console.log('  ✅ YES_DAI already approved to Permit2')
    }

    const permit2Abi = [
      {
        type: 'function',
        name: 'allowance',
        stateMutability: 'view',
        inputs: [
          { name: 'owner', type: 'address' },
          { name: 'token', type: 'address' },
          { name: 'spender', type: 'address' },
        ],
        outputs: [
          { name: 'amount', type: 'uint160' },
          { name: 'expiration', type: 'uint48' },
          { name: 'nonce', type: 'uint48' },
        ],
      },
      {
        type: 'function',
        name: 'approve',
        stateMutability: 'nonpayable',
        inputs: [
          { name: 'token', type: 'address' },
          { name: 'spender', type: 'address' },
          { name: 'amount', type: 'uint160' },
          { name: 'expiration', type: 'uint48' },
        ],
        outputs: [],
      },
    ]

    const [amount, expiration] = await publicClient.readContract({
      address: PERMIT2,
      abi: permit2Abi,
      functionName: 'allowance',
      args: [account.address, TOKEN_IN, UNIVERSAL_ROUTER],
    })

    const now = Math.floor(Date.now() / 1000)
    if (amount < amountIn || expiration < now) {
      console.log('  ⚠️  Need to approve Permit2 to Universal Router...')
      const hash = await walletClient.writeContract({
        address: PERMIT2,
        abi: permit2Abi,
        functionName: 'approve',
        args: [
          TOKEN_IN,
          UNIVERSAL_ROUTER,
          2n ** 160n - 1n,
          BigInt(now + 60 * 60 * 24 * 365),
        ],
      })
      console.log('  ✅ Permit2 approval tx:', hash)
      await publicClient.waitForTransactionReceipt({ hash })
    } else {
      console.log('  ✅ Permit2 already approved to Universal Router')
    }

    return true
  } catch (error) {
    console.error('❌ Error during approval setup:', error.message)
    return false
  }
}

async function executeSwap() {
  console.log('---')
  console.log('🔄 Executing swap...')
  
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20)
  
  try {
    console.log('  📤 Sending transaction...')
    const hash = await walletClient.writeContract({
      address: UNIVERSAL_ROUTER,
      abi: [{
        type: 'function',
        name: 'execute',
        stateMutability: 'payable',
        inputs: [
          { name: 'commands', type: 'bytes' },
          { name: 'inputs', type: 'bytes[]' },
          { name: 'deadline', type: 'uint256' },
        ],
        outputs: [],
      }],
      functionName: 'execute',
      args: [commands, [v4Input], deadline],
      value: 0n,
    })
    
    console.log('  🔗 Transaction hash:', hash)
    console.log(`  🔍 View on Polygonscan: https://polygonscan.com/tx/${hash}`)
    
    console.log('  ⏳ Waiting for confirmation...')
    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    
    if (receipt.status === 'success') {
      console.log('  ✅ Swap successful!')
      console.log('  📦 Block number:', receipt.blockNumber.toString())
      console.log('  ⛽ Gas used:', receipt.gasUsed.toString())
      return true
    } else {
      console.error('  ❌ Transaction failed!')
      return false
    }
  } catch (error) {
    console.error('❌ Error executing swap:', error.message)
    if (error.cause) {
      console.error('  Cause:', error.cause)
    }
    return false
  }
}

async function main() {
  console.log('===================================')
  console.log('   UNISWAP V4 SWAP TEST')
  console.log('===================================')
  
  const hasBalance = await checkBalances()
  if (!hasBalance) {
    console.log('❌ Exiting due to insufficient balance')
    process.exit(1)
  }
  
  console.log('---')
  const approvalSuccess = await checkAndApprove()
  if (!approvalSuccess) {
    console.log('❌ Exiting due to approval failure')
    process.exit(1)
  }
  
  const swapSuccess = await executeSwap()
  
  if (swapSuccess) {
    console.log('---')
    console.log('📊 Final balances:')
    await checkBalances()
    console.log('---')
    console.log('✨ Test completed successfully!')
  } else {
    console.log('❌ Swap failed!')
  }
}

main().catch((error) => {
  console.error('❌ Unexpected error:', error)
  process.exit(1)
})