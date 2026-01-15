import { ethers } from 'ethers';
import { SUSHISWAP_V2_ROUTER } from '../components/futarchyFi/marketPage/constants/contracts';

// Token addresses from the example transactions
const NO_GNO = "0x0c485ED641dBCA4Ed797B189Cd674925B3437eDC";
const NO_SDAI = "0x25eC0A3eA53df512694d0e7DDe57e962595a7b63";
const YES_GNO = "0xffF46469298c1E285981217a3D247A085Ab3ebA6";
const YES_SDAI = "0x2C7d00810FBBA8676954C66A0423FeDBbB8a3BfB";

// Exact routes from the example transactions
const ROUTES = {
  // NO_GNO to NO_SDAI route
  NO_GNO_TO_NO_SDAI: "0x020c485ed641dbca4ed797b189cd674925b3437edc01ffff01963afaaaa665abc1c2f89db6448c3315a8b9fa4301f2614a233c7c3e7f08b1f887ba133a13f1eb2c55",
  // NO_SDAI to NO_GNO route
  NO_SDAI_TO_NO_GNO: "0x0225ec0a3ea53df512694d0e7dde57e962595a7b6302fd7001963afaaaa665abc1c2f89db6448c3315a8b9fa4300f2614a233c7c3e7f08b1f887ba133a13f1eb2c55ffff0025d524bed130c9aaaa8d2085adbe08f6209b179c01d43ec295eacc1c63ca15a62e800964a6b395e4d2000bb804e91d153e0b41518a2ce8dd3d7944fa863463a97d00d43ec295eacc1c63ca15a62e800964a6b395e4d200f2614a233c7c3e7f08b1f887ba133a13f1eb2c55000bb8",
  // YES_GNO to YES_SDAI route
  YES_GNO_TO_YES_SDAI: "0x02fff46469298c1e285981217a3d247a085ab3eba601ffff01f513225d744464c95df69f8cb5068cdaeb3278db00f2614a233c7c3e7f08b1f887ba133a13f1eb2c55",
  // YES_SDAI to YES_GNO route
  YES_SDAI_TO_YES_GNO: "0x022c7d00810fbba8676954c66a0423fedbbb8a3bfb022e1400497a325a9358851f54f9c9e8aa672a70fb770d79015c58148039a6794afa84f3ac9a90521279b1ceb5000bb8ffff01f513225d744464c95df69f8cb5068cdaeb3278db01f2614a233c7c3e7f08b1f887ba133a13f1eb2c5504e91d153e0b41518a2ce8dd3d7944fa863463a97d005c58148039a6794afa84f3ac9a90521279b1ceb501f2614a233c7c3e7f08b1f887ba133a13f1eb2c55000bb8"
};

/**
 * Gets the mock route based on token addresses
 */
const getMockRoute = (tokenIn, tokenOut) => {
  const tokenInLower = tokenIn.toLowerCase();
  const tokenOutLower = tokenOut.toLowerCase();

  // NO_GNO to NO_SDAI
  if (tokenInLower === NO_GNO.toLowerCase() && 
      tokenOutLower === NO_SDAI.toLowerCase()) {
    return ROUTES.NO_GNO_TO_NO_SDAI;
  }
  
  // NO_SDAI to NO_GNO
  if (tokenInLower === NO_SDAI.toLowerCase() && 
      tokenOutLower === NO_GNO.toLowerCase()) {
    return ROUTES.NO_SDAI_TO_NO_GNO;
  }

  // YES_GNO to YES_SDAI
  if (tokenInLower === YES_GNO.toLowerCase() && 
      tokenOutLower === YES_SDAI.toLowerCase()) {
    return ROUTES.YES_GNO_TO_YES_SDAI;
  }

  // YES_SDAI to YES_GNO
  if (tokenInLower === YES_SDAI.toLowerCase() && 
      tokenOutLower === YES_GNO.toLowerCase()) {
    return ROUTES.YES_SDAI_TO_YES_GNO;
  }
  
  // For other token pairs, construct a basic route
  return "0x" + [
    "02",  // Command code must start with 02
    tokenIn.slice(2).toLowerCase(),  // Token in address without 0x
    "01",  // V2 pool command
    "ffff",  // Pool identifier
    "01",  // Command separator
    "f2614a233c7c3e7f08b1f887ba133a13f1eb2c55",  // Common intermediate address from example routes
    "01",  // Command separator
    tokenOut.slice(2).toLowerCase(),  // Token out address
    "01",  // Command separator
    "ffff",  // Pool identifier
    SUSHISWAP_V2_ROUTER.slice(2).toLowerCase()  // Router address
  ].join("");
};

/**
 * Fetches swap route data from Sushiswap V5 API
 */
export const fetchSushiSwapRoute = async ({
  tokenIn,
  tokenOut,
  amount,
  userAddress,
  feeReceiver,
  options = {}
}) => {
  const {
    maxSlippage = '0.005',
    gasPrice = '1000000008',
    fee = '0.0025',
    mockMode = false
  } = options;

  console.log('USEFUTARCHY tokenIn', tokenIn);
  console.log('USEFUTARCHY tokenOut', tokenOut);
  console.log('USEFUTARCHY amount', amount.toString());
  console.log('USEFUTARCHY userAddress', userAddress);
  console.log('USEFUTARCHY feeReceiver', "0xca226bd9c754F1283123d32B2a7cF62a722f8ADa");

  try {
    // Validate amount
    if (!amount || amount === '0') {
      throw new Error('Invalid amount provided');
    }

    // Ensure amount is a valid BigNumber
    const amountBN = ethers.BigNumber.from(amount.toString());
    if (amountBN.lte(0)) {
      throw new Error('Amount must be greater than 0');
    }

    // Create URL with parameters properly encoded
    const params = new URLSearchParams({
      referrer: 'sushi',
      tokenIn,
      tokenOut,
      amount: amountBN.toString(),
      maxSlippage,
      gasPrice,
      to: userAddress,
      enableFee: 'false',
      fee,
      feeBy: 'output',
      includeTransaction: 'true',
      includeRoute: 'true'
    });

    // Conditionally add feeReceiver only if it's provided and valid
    if (feeReceiver && typeof feeReceiver === 'string' && feeReceiver.startsWith('0x')) {
        params.set('feeReceiver', feeReceiver);
    } else {
         // Optional: Log if feeReceiver is invalid/missing, but still proceed without it
         console.log('[SushiSwap Helper] feeReceiver not provided or invalid, omitting from API request.');
    }

    const sushiApiUrl = `https://api.sushi.com/swap/v5/100?${params.toString()}`;
    
    console.log('Requesting Sushiswap API:', {
      url: sushiApiUrl,
      params: {
        tokenIn,
        tokenOut,
        amount: amountBN.toString(),
        userAddress,
        feeReceiver,
        options
      }
    });

    if (mockMode) {
      // Use existing mock logic when mockMode is true
      const mockRoute = getMockRoute(tokenIn, tokenOut);
      return {
        transferValueTo: feeReceiver,
        amountValueTransfer: ethers.BigNumber.from("0"),
        tokenIn,
        amountIn: ethers.BigNumber.from(amount),
        tokenOut,
        amountOutMin: ethers.BigNumber.from(amount).mul(95).div(100), // 5% slippage
        to: userAddress,
        route: mockRoute,
        swapPrice: "1",
        priceImpact: "0",
        assumedAmountOut: amount,
        tokens: [
          { address: tokenIn, symbol: "TOKEN_IN", decimals: 18 },
          { address: tokenOut, symbol: "TOKEN_OUT", decimals: 18 }
        ],
        gasSpent: "158604",
        status: "Success"
      };
    }
    
    const response = await fetch(sushiApiUrl);
    const swapData = await response.json();
    
    if (swapData.status !== "Success") {
      console.error('Sushiswap API Error:', swapData);
      throw new Error(swapData.message || 'Failed to get swap route from Sushi API');
    }

    // Just pass through the API data with minimal processing
    const formattedData = {
      // Keep original API data
      ...swapData,
      // Add the exact transaction data needed for execution
      txData: swapData.tx.data,
      methodId: swapData.tx.data.slice(0, 10),
      routerAddress: swapData.routeProcessorAddr
    };

    console.log('Using exact API data:', formattedData);

    return formattedData;
  } catch (error) {
    console.error('Error in fetchSushiSwapRoute:', error);
    throw error;
  }
};

/**
 * Check and handle token approval for the swap
 */
const checkAndApproveToken = async (signer, tokenAddress, spenderAddress, amount) => {
  const tokenContract = new ethers.Contract(
    tokenAddress,
    [
      "function allowance(address owner, address spender) view returns (uint256)",
      "function approve(address spender, uint256 amount) returns (bool)"
    ],
    signer
  );

  const userAddress = await signer.getAddress();
  const currentAllowance = await tokenContract.allowance(userAddress, spenderAddress);

  console.log('Checking allowance:', {
    token: tokenAddress,
    owner: userAddress,
    spender: spenderAddress,
    currentAllowance: currentAllowance.toString(),
    requiredAmount: amount.toString()
  });

  if (currentAllowance.lt(amount)) {
    console.log('Insufficient allowance, approving...');
    const approveTx = await tokenContract.approve(
      spenderAddress,
      ethers.constants.MaxUint256 // Infinite approval
    );
    console.log('Waiting for approval transaction:', approveTx.hash);
    await approveTx.wait();
    console.log('Approval confirmed');
  } else {
    console.log('Sufficient allowance exists');
  }
};

/**
 * Execute a swap using Sushiswap Route Processor with exact API method
 */
export const executeSushiSwapRoute = async ({
  signer,
  routeData,
  options = {}
}) => {
  if (!routeData.routeProcessorAddr) {
    throw new Error("Router address not found in route data");
  }

  const txOptions = {
    gasLimit: options.gasLimit || routeData.gasSpent || 400000,
    gasPrice: options.gasPrice || ethers.utils.parseUnits("0.97", "gwei"),
    ...options
  };

  // Use the exact transaction data from the API
  return signer.sendTransaction({
    to: routeData.routeProcessorAddr,
    data: routeData.txData,
    ...txOptions
  });
}; 