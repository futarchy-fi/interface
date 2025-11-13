import { useState, useCallback, useEffect } from 'react';
import { ethers } from 'ethers';
import { CowSdk, OrderKind } from '@gnosis.pm/cow-sdk';
import { useMetaMask } from './useMetaMask'; // Assuming this path is correct relative to src/hooks
import { BASE_TOKENS_CONFIG as DEFAULT_BASE_TOKENS_CONFIG } from '../components/futarchyFi/marketPage/constants/contracts'; // Adjust path if needed

// Constants for Gnosis Chain (Chain ID 100)
const GNOSIS_CHAIN_ID = 100;
const WXDAI_ADDRESS = '0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d'; // Explicit WXDAI Address
const COW_VAULT_RELAYER_ADDRESS = '0xC92E8bdf79f0507f65a392b0ab4667716BFE0110'; // CoW Swap Vault Relayer

// Minimal ERC20 ABI for approval
const ERC20_ABI_MINIMAL = [
    "function allowance(address owner, address spender) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)"
];

/**
 * Hook to manage swapping WXDAI to the currency token (e.g., SDAI) via CoW Swap.
 *
 * Assumes target chain is Gnosis Chain (ID 100).
 * Handles quote fetching, WXDAI approval, order signing/submission, and status polling.
 *
 * @param {object} [baseTokensConfig=DEFAULT_BASE_TOKENS_CONFIG] - Configuration for base tokens.
 */
export const useSwapNativeToCurrency = (baseTokensConfig = DEFAULT_BASE_TOKENS_CONFIG) => {
    const { signer, account, chainId } = useMetaMask();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [quoteData, setQuoteData] = useState(null);
    const [orderId, setOrderId] = useState(null);
    // Updated lifecycle: null -> fetching_quote -> quote_received/quote_error -> checking_allowance -> awaiting_approval -> signing_order -> submitted/submission_error -> tracking -> fulfilled/expired/cancelled/failed
    const [orderStatus, setOrderStatus] = useState(null);
    const [pollingIntervalId, setPollingIntervalId] = useState(null);
    const [executedBuyAmount, setExecutedBuyAmount] = useState(null);

    const currencyToken = baseTokensConfig?.currency;
    const sellTokenSymbol = 'WXDAI'; // Explicitly WXDAI
    const sellTokenDecimals = 18; // WXDAI has 18 decimals

    // --- Clean up polling ---
    const stopPolling = useCallback(() => {
        if (pollingIntervalId) {
            console.log("[useSwapWxdaiToCurrency] Stopping polling for Order ID:", orderId);
            clearInterval(pollingIntervalId);
            setPollingIntervalId(null);
        }
    }, [pollingIntervalId, orderId]);

    // --- Fetch CoW Swap Quote ---
    const fetchQuote = useCallback(async (sellAmountWei) => {
        if (!account || !currencyToken?.address) {
            setError("Wallet not connected or currency token config missing.");
            return null;
        }
        if (chainId !== GNOSIS_CHAIN_ID) {
            setError(`Unsupported chain ID: ${chainId}. Please connect to Gnosis Chain (ID ${GNOSIS_CHAIN_ID}).`);
            return null;
        }
        if (!sellAmountWei || ethers.BigNumber.from(sellAmountWei).isZero()) {
            setError("Amount must be greater than zero.");
            return null;
        }

        setIsLoading(true);
        setError(null);
        setQuoteData(null);
        setOrderId(null);
        setOrderStatus('fetching_quote');
        stopPolling();

        try {
            const cowSdk = new CowSdk(GNOSIS_CHAIN_ID);
            const quoteParams = {
                kind: OrderKind.SELL,
                sellToken: WXDAI_ADDRESS, // Sell WXDAI
                buyToken: currencyToken.address,
                sellAmountBeforeFee: sellAmountWei.toString(),
                from: account,
                receiver: account,
                appData: JSON.stringify({
                    appCode: 'FutarchyWxdaiSwap', // Updated appCode
                    environment: 'production',
                    metadata: { orderClass: { orderClass: 'market' } }
                }),
                partiallyFillable: false,
                sellTokenBalance: 'erc20',
                buyTokenBalance: 'erc20',
                signingScheme: 'eip712',
                onchainOrder: false,
                priceQuality: 'verified',
                validTo: Math.floor(Date.now() / 1000) + 3600
            };

            console.log("[useSwapWxdaiToCurrency] Fetching CoW Quote with params:", quoteParams);

            const quoteApiUrl = `https://api.cow.fi/xdai/api/v1/quote`;
            const response = await fetch(quoteApiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify(quoteParams)
            });
            const responseText = await response.text();
            if (!response.ok) {
                throw new Error(`CoW Quote API Error: ${response.status} | ${responseText.substring(0, 200)}`);
            }
            const quoteResponse = JSON.parse(responseText);
            const { quote } = quoteResponse;

            if (!quote || !quote.buyAmount || !quote.sellAmount || !quote.feeAmount) {
                console.error("Incomplete CoW quote received:", quoteResponse);
                throw new Error('Incomplete CoW quote received from API.');
            }

            console.log("[useSwapWxdaiToCurrency] CoW Quote Received:", quote);
            setQuoteData({
                buyAmount: quote.buyAmount,
                feeAmount: quote.feeAmount,
                sellAmount: quote.sellAmount // This is the amount of WXDAI needed + fee
            });
            setOrderStatus('quote_received');
            setIsLoading(false);
            return quote;

        } catch (err) {
            console.error("[useSwapWxdaiToCurrency] Error fetching quote:", err);
            setError(err.message || "Failed to fetch CoW Swap quote.");
            setOrderStatus('quote_error');
            setIsLoading(false);
            return null;
        }
    }, [account, chainId, currencyToken, stopPolling]);

    // --- Check and Approve WXDAI --- 
    const checkAndApproveWxdai = useCallback(async (amountInWei) => {
        if (!signer || !account || amountInWei.isZero()) {
            setError("Cannot approve: Wallet not connected or amount is zero.");
            return false; // Indicate approval not attempted or failed preconditions
        }
        
        setOrderStatus('checking_allowance');
        setError(null);
        setIsLoading(true);

        try {
            const wxdaiContract = new ethers.Contract(WXDAI_ADDRESS, ERC20_ABI_MINIMAL, signer);
            const currentAllowance = await wxdaiContract.allowance(account, COW_VAULT_RELAYER_ADDRESS);

            console.log(`[useSwapWxdaiToCurrency] Current WXDAI allowance for CoW Relayer: ${ethers.utils.formatUnits(currentAllowance, sellTokenDecimals)}`);

            if (currentAllowance.gte(amountInWei)) {
                console.log("[useSwapWxdaiToCurrency] WXDAI allowance sufficient.");
                setIsLoading(false); // Stop loading indicator if approval not needed
                // No status change needed here, executeSwap will proceed to 'signing_order'
                return true; // Indicate approval exists
            }
            
            // If allowance is insufficient, proceed with approval
            console.log("[useSwapWxdaiToCurrency] WXDAI allowance insufficient. Requesting approval...");
            setOrderStatus('awaiting_approval');
            
            // Use MaxUint256 for simplicity, avoids repeated approvals
            const approveTx = await wxdaiContract.approve(COW_VAULT_RELAYER_ADDRESS, ethers.constants.MaxUint256);
            console.log(`[useSwapWxdaiToCurrency] WXDAI approval transaction sent: ${approveTx.hash}. Waiting for confirmation...`);
            
            await approveTx.wait(); // Wait for the transaction to be mined
            
            console.log("[useSwapWxdaiToCurrency] WXDAI approval confirmed.");
            setIsLoading(false); // Stop loading indicator after approval confirmation
            // Status will be updated by executeSwap after this returns
            return true; // Indicate approval was successful

        } catch (err) {
            console.error("[useSwapWxdaiToCurrency] Error during WXDAI approval:", err);
            let message = err.message || "Failed to approve WXDAI.";
            if (err.code === 4001 || err.code === 'ACTION_REJECTED') {
                message = "Approval transaction rejected by user.";
            }
            setError(message);
            setOrderStatus('approval_error'); // Add a specific error status if needed
            setIsLoading(false);
            return false; // Indicate approval failed
        }

    }, [signer, account, sellTokenDecimals]);

    // --- Execute Swap (Sign and Send Order) --- 
    const executeSwap = useCallback(async (quote) => {
        if (!signer || !account || !quote || !currencyToken?.address || chainId !== GNOSIS_CHAIN_ID) {
            setError("Invalid state for executing swap.");
            return null;
        }
        if (!quote.sellAmount) {
             setError("Invalid quote data for swap execution.");
             return null;
        }
        
        // The amount to approve is the total sell amount from the quote (input + fee)
        const amountToApprove = ethers.BigNumber.from(quote.sellAmount); 

        // *** Step 1: Check and perform approval ***
        setIsLoading(true); // Ensure loading is true during approval check
        setError(null);
        const approvalSuccessful = await checkAndApproveWxdai(amountToApprove);

        if (!approvalSuccessful) {
            // Error/status is set within checkAndApproveWxdai
            // Keep isLoading true until user dismisses error or retries?
            // For now, just return null to stop execution flow.
            setIsLoading(false); // Stop loading if approval failed/rejected
            return null;
        }
        // If approval existed or was successful, approval check sets isLoading=false
        
        // *** Step 2: Sign and send order ***
        setIsLoading(true); // Set loading true again for signing/submission
        setOrderStatus('signing_order');
        stopPolling();

        try {
            const cowSdk = new CowSdk(GNOSIS_CHAIN_ID, { signer });
            const orderToSign = {
                kind: OrderKind.SELL,
                partiallyFillable: false,
                sellToken: WXDAI_ADDRESS, // Explicitly WXDAI
                buyToken: quote.buyToken,
                receiver: quote.receiver || account,
                sellAmount: quote.sellAmount,
                buyAmount: quote.buyAmount,
                validTo: quote.validTo,
                appData: quote.appData,
                feeAmount: "0",
            };

            console.log("[useSwapWxdaiToCurrency] Signing CoW Order:", orderToSign);
            const signedOrder = await cowSdk.signOrder(orderToSign);
            const orderPayload = { ...orderToSign, ...signedOrder };

            console.log("[useSwapWxdaiToCurrency] Sending CoW Order:", orderPayload);
            const submittedOrderId = await cowSdk.cowApi.sendOrder({ order: orderPayload, owner: account });

            console.log("[useSwapWxdaiToCurrency] CoW Order Submitted. ID:", submittedOrderId);
            setOrderId(submittedOrderId);
            setOrderStatus('submitted');
            setIsLoading(false);
            startPolling(submittedOrderId);
            return submittedOrderId;

        } catch (err) {
            console.error("[useSwapWxdaiToCurrency] Error executing swap:", err);
            let message = err.message || "Failed to execute CoW Swap.";
            if (err.code === 4001 || err.code === 'ACTION_REJECTED') {
                message = "Transaction signature rejected by user.";
            } else if (err.response?.data?.description) {
                message = `CoW API Error: ${err.response.data.description}`;
            }
            setError(message);
            setOrderStatus('submission_error');
            setIsLoading(false);
            return null;
        }
    }, [signer, account, chainId, currencyToken, stopPolling, checkAndApproveWxdai]);

    // --- Poll Order Status ---
    const startPolling = useCallback((idToPoll) => {
        stopPolling();
        if (!idToPoll) return;

        console.log("[useSwapWxdaiToCurrency] Starting polling for Order ID:", idToPoll);
        setOrderStatus('tracking');

        const interval = setInterval(async () => {
            try {
                const cowSdk = new CowSdk(GNOSIS_CHAIN_ID);
                const details = await cowSdk.cowApi.getOrder(idToPoll);
                console.log(`[useSwapWxdaiToCurrency] Poll Status (${idToPoll}): ${details.status}`);

                // Only update status if it has changed to avoid unnecessary re-renders
                // (unless it's fulfilled, where we always want to process)
                if (details.status !== orderStatus || details.status === 'fulfilled') {
                    setOrderStatus(details.status);
                }

                // If fulfilled, fetch final details, store amount, then stop.
                if (details.status === 'fulfilled') {
                    console.log(`[useSwapWxdaiToCurrency] Order fulfilled. Fetching final details for ${idToPoll}...`);
                    stopPolling(); // Stop polling first to prevent race conditions
                    try {
                        // Fetch details one last time to ensure executedBuyAmount is present
                        const finalDetails = await cowSdk.cowApi.getOrder(idToPoll);
                        if (finalDetails.executedBuyAmount) {
                            console.log(`[useSwapWxdaiToCurrency] Storing executedBuyAmount: ${finalDetails.executedBuyAmount}`);
                            setExecutedBuyAmount(finalDetails.executedBuyAmount);
                        } else {
                            console.warn(`[useSwapWxdaiToCurrency] Fulfilled order ${idToPoll} missing executedBuyAmount in final details.`);
                        }
                    } catch (finalFetchError) {
                        console.error(`[useSwapWxdaiToCurrency] Error fetching final details for fulfilled order ${idToPoll}:`, finalFetchError);
                        // Still consider it fulfilled, but log that we couldn't get the final amount
                    }
                    setIsLoading(false); // Set loading false AFTER final fetch attempt

                } else if (['expired', 'cancelled'].includes(details.status)) {
                    console.log(`[useSwapWxdaiToCurrency] Order reached final state: ${details.status}. Stopping polling.`);
                    stopPolling();
                    setIsLoading(false);
                }
            } catch (pollError) {
                console.error(`[useSwapWxdaiToCurrency] Error polling status for ${idToPoll}:`, pollError);
                if (pollError.response?.status === 404) {
                    setError(`Order ${idToPoll} not found.`);
                    setOrderStatus('failed');
                    stopPolling();
                    setIsLoading(false);
                }
            }
        }, 10000);

        setPollingIntervalId(interval);
    }, [stopPolling]);

    // --- Reset Hook State ---
    const resetSwapState = useCallback(() => {
        setIsLoading(false);
        setError(null);
        setQuoteData(null);
        setOrderId(null);
        setOrderStatus(null);
        stopPolling();
        setExecutedBuyAmount(null);
    }, [stopPolling]);

    // --- Effect for Cleanup ---
    // Ensure polling stops if the component using the hook unmounts
    useEffect(() => {
        return () => {
            stopPolling();
        };
    }, [stopPolling]);

    // --- Returned values and functions ---
    return {
        isLoading,
        error,
        quoteData,
        orderId,
        orderStatus,
        fetchQuote,
        executeSwap,    // This now includes approval check
        resetSwapState,
        currencyTokenSymbol: currencyToken?.symbol || 'Currency',
        sellTokenSymbol: sellTokenSymbol, // WXDAI
        currencyTokenDecimals: currencyToken?.decimals || 18,
        sellTokenDecimals: sellTokenDecimals, // 18
        executedBuyAmount,
    };
}; 