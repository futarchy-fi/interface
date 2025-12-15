# RPC Selection and Reliability Logic

This document explains how the application selects the best Remote Procedure Call (RPC) endpoint to ensure reliability and prevent UI loading errors (showing `-` or `N/A`).

## Overview

The application does **not** use a simple "try one, then try another" sequential retry loop. Instead, it uses a **proactive parallel testing** strategy to select the best available RPC *before* making critical data requests.

The core logic resides in `src/utils/getBestRpc.js`.

## How `getBestRpc` Works

When `getBestRpc(chainId)` is called:

1.  **Cache Check**: It first checks if there is a recently used (within 5 minutes) working RPC in the local cache.
2.  **Parallel Testing**: If no cache exists, it takes the full list of hardcoded RPCs for that chain and tests them **all simultaneously**.
    *   It sends a lightweight `eth_blockNumber` request to each.
    *   It measures the latency (response time).
    *   It checks for CORS errors (browser security blocks) and HTTP errors.
3.  **Selection**: 
    *   It filters out any RPCs that failed or returned errors.
    *   It sorts the remaining working RPCs by latency (fastest first).
    *   It returns the **single best working URL**.
4.  **Fallback**: If *all* RPCs fail the test, it falls back to the first one in the list, hoping it might work for the actual request even if the test failed.

## Does it retry if the request fails?

**No, `ConfirmSwapModal` does not have a secondary retry loop.**

Once `getBestRpc` returns the "best" URL, the application assumes it is reliable. `ConfirmSwapModal` uses this selected RPC to fetch quotes.

*   **If `getBestRpc` succeeds:** It returns a URL that was proven to work milliseconds ago.
*   **If the Quote Fetch fails:** If that specific RPC fails during the complex quote fetching (e.g., due to rate limits or missing archive data), the modal **will show an error or `-`**. It does *not* go back to `getBestRpc` to ask for the "second best" RPC.

### Summary of Reliability

*   **Prevents Initial Failure:** The parallel testing strategy effectively prevents failures caused by offline or slow RPCs by filtering them out *before* use.
*   **No Sequential Retry:** There is no logic to "try RPC A, catch error, try RPC B". Reliability relies entirely on the initial selection process.

## Protocol-Specific Behavior

*   **Uniswap (Mainnet):** Explicitly uses the provider from `getBestRpcProvider`, ensuring the quote is fetched via the fastest responding public node.
*   **Algebra (Gnosis):** Calls `getBestRpc` but primarily relies on the wallet's connected provider (`wagmi` public client) for consistency, utilizing the specific RPC mainly for logging or specific SDK requirements if configured.
