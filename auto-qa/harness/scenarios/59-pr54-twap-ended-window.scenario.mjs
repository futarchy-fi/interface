/**
 * 59-pr54-twap-ended-window.scenario.mjs — catches PR #54 (TWAP
 * window for ended proposals). The canonical TIME-EVOLUTION-class
 * catch the harness has been building toward across slices 90-94.
 *
 * ── What KIND of bug this catches ───────────────────────────────────
 * TwapCountdown's `fetchPoolTwap` calls `poolContract.getTimepoints(
 * [secondsAgoStart, secondsAgoEnd])` to read the TWAP. Pre-PR-54,
 * the second argument was ALWAYS zero (the page queried the
 * trailing window ending NOW); post-fix, for ended proposals it
 * becomes `now - twapEndTimestamp` (the historical window ending
 * at twapEnd).
 *
 * The shape difference is invisible in the DOM — both produce a
 * Promise that resolves to SOME number — but the on-chain call
 * shape is what reveals the regression.
 *
 * ── How the scenario catches it ─────────────────────────────────────
 *
 *   1. Registry mock injects TWAP metadata such that `twapStart +
 *      twapDurationHours*3600` is in the past relative to wall-
 *      clock `Date.now()`. The TwapCountdown component reads from
 *      `Date.now()` to set `hasEnded === true` (it doesn't read
 *      chain time — confirmed in MarketPageShowcase.jsx:577-609).
 *
 *   2. Page mounts, TwapCountdown's useEffect fires. With
 *      `(isActive || hasEnded) && yesPoolConfig?.address &&
 *      noPoolConfig?.address`, it dispatches two fetchPoolTwap
 *      calls (YES + NO) which each issue
 *      `getTimepoints([aStart, aEnd])` against the configured
 *      pool addresses.
 *
 *   3. A Playwright route handler on the anvil RPC URL parses the
 *      JSON-RPC body, matches eth_call requests whose `to` field
 *      is one of our YES/NO probe pool addresses, and decodes the
 *      data field with the slice-94 eth_call inspector
 *      (`decodeGetTimepointsArgs`).
 *
 *   4. The decoded `secondsAgos` array is pushed to a scenario-
 *      scoped capture list (factory-form mocks + ctx, the slice
 *      86 pattern).
 *
 *   5. The handler returns a SYNTHETIC response (encoded
 *      tickCumulatives = [0, 0]) so the page's fetchPoolTwap
 *      promise resolves without error — we don't want page-error
 *      noise to confound the catch.
 *
 *   6. Assertion: at least one captured getTimepoints call, AND
 *      EVERY captured call has `args[1] > 0` (the post-fix shape).
 *      A regression to `[secondsWindow, 0]` makes args[1] === 0
 *      and the assertion fails.
 *
 * ── Why requires anvil ──────────────────────────────────────────────
 * The page's wagmi provider connects to the configured RPC URL
 * during mount. Without a reachable anvil, the connection-side
 * machinery errors out before fetchPoolTwap runs. The route
 * handler intercepts eth_calls BEFORE they hit anvil, so anvil
 * never actually serves the pool — but anvil must be UP for the
 * provider to consider the chain online.
 *
 * ── Verification protocol ───────────────────────────────────────────
 *
 *   1. Current code + anvil running: assertion passes. At least
 *      one getTimepoints call captured, every one has aEnd > 0.
 *
 *   2. Mutate `src/components/futarchyFi/marketPage/MarketPageShowcase.jsx`:
 *      replace the line
 *        `const secondsAgoEnd = hasEnded ? Math.max(0, now - twapEndTimestamp) : 0;`
 *      with the pre-PR-54 form
 *        `const secondsAgoEnd = 0;`
 *      (or simpler: drop the `secondsAgoEnd` argument from
 *      fetchPoolTwap to revert to the legacy default of 0).
 *      → assertion FAILS with `args[1] === 0`.
 *
 *   3. Restore → assertion passes.
 *
 *   4. Without anvil (`HARNESS_NO_ANVIL=1`): scenario SKIPS via
 *      the slice 93 `requiresAnvil` flag.
 */

import { expect } from '@playwright/test';
import { encodeAbiParameters } from 'viem';

import {
    REGISTRY_GRAPHQL_URL,
    CANDLES_GRAPHQL_URL,
    MARKET_PROBE_ADDRESS,
    MARKET_PROBE_YES_POOL,
    MARKET_PROBE_NO_POOL,
    PUBLIC_GNOSIS_RPC_URLS,
    fakeMarketProposalEntity,
    makeGraphqlMockHandler,
    makeSubgraphAwareCandlesHandler,
} from '../fixtures/api-mocks.mjs';

import {
    parseEthCallParams,
    decodeGetTimepointsArgs,
    sameAddress,
} from '../fixtures/eth-call-inspector.mjs';

// TWAP metadata: end the window 7 days ago. With twapStart = -10
// days and twapDurationHours = 24, twapEnd = -9 days. hasEnded
// will be true at scenario run time.
const NOW_SECONDS              = Math.floor(Date.now() / 1000);
const TWAP_START_TIMESTAMP     = NOW_SECONDS - 10 * 24 * 3600;
const TWAP_DURATION_HOURS      = 24;


// Synthetic response for getTimepoints. Returns four arrays each
// of length matching the input array. We don't know the input
// length at encode time, but `tickCumulatives = [0, 0, ...]` etc.
// of length 2 covers the common `[start, end]` shape the page
// sends. If a future regression sends a longer array, viem will
// still decode the synthetic response — the consumer's `[0]` /
// `[1]` indexing is what reads the entries.
const SYNTHETIC_TIMEPOINTS_RETURN_DATA = encodeAbiParameters(
    [
        { name: 'tickCumulatives',                  type: 'int56[]' },
        { name: 'secondsPerLiquidityCumulatives',   type: 'uint160[]' },
        { name: 'volatilityCumulatives',            type: 'uint112[]' },
        { name: 'volumePerLiquidityCumulatives',    type: 'uint144[]' },
    ],
    [
        [0n, 0n],
        [0n, 0n],
        [0n, 0n],
        [0n, 0n],
    ],
);

export default {
    name:        '59-pr54-twap-ended-window',
    description: 'Catches PR #54 (TWAP window for ended proposals). Intercepts the page\'s getTimepoints eth_call on the YES/NO pools and asserts the post-fix shape (secondsAgoEnd > 0 when hasEnded). A regression to the pre-fix shape [secondsWindow, 0] fails the assertion.',
    bugShape:    'fetchPoolTwap regresses to secondsAgoEnd=0 for ended proposals → TWAP window is the trailing 24h instead of the historical voting window → Final TWAP Window displays post-resolution drift values',
    route:       `/markets/${MARKET_PROBE_ADDRESS}`,

    requiresAnvil: true,

    // Factory form so the route handler's closure shares state with
    // the assertion (slice 86 pattern).
    mocks: (ctx) => {
        // Scenario-scoped capture: every decoded getTimepoints call.
        ctx.timepointsCalls = [];

        // Build the eth_call interceptor. Used as the handler for
        // every URL in `PUBLIC_GNOSIS_RPC_URLS` + localhost:8546
        // (wagmi rotates through these; we route them ALL to
        // catch whichever one wins).
        const ethCallInterceptor = async (route) => {
            const req = route.request();
            const post = req.postData() || '{}';
            let body;
            try {
                body = JSON.parse(post);
            } catch {
                return route.continue();
            }

            const call = parseEthCallParams(body);
            if (call && (sameAddress(call.to, MARKET_PROBE_YES_POOL)
                      || sameAddress(call.to, MARKET_PROBE_NO_POOL))) {
                const decoded = decodeGetTimepointsArgs(call.data);
                if (decoded) {
                    ctx.timepointsCalls.push({
                        pool:        call.to,
                        secondsAgos: decoded,
                    });
                    // Return synthetic response so the page's
                    // promise resolves without a revert.
                    return route.fulfill({
                        status: 200,
                        contentType: 'application/json',
                        body: JSON.stringify({
                            jsonrpc: '2.0',
                            id: body.id ?? 1,
                            result: SYNTHETIC_TIMEPOINTS_RETURN_DATA,
                        }),
                    });
                }
            }

            // Default: forward to anvil. The page's wagmi config
            // rotates through PUBLIC_GNOSIS_RPC_URLS but the
            // playwright config sets NEXT_PUBLIC_RPC_URL to anvil,
            // so most pages prefer localhost. route.continue() lets
            // the request hit its original URL (the public RPC),
            // which in CI/test mode is unreachable — but the page
            // is resilient enough to retry against localhost.
            return route.continue();
        };

        // Build the full route map. Cover every URL the page might
        // POST eth_calls to so we don't miss any.
        const allRpcUrls = [
            'http://localhost:8546/',
            ...PUBLIC_GNOSIS_RPC_URLS,
        ];
        const rpcRoutes = {};
        for (const rpcUrl of allRpcUrls) {
            // Glob match: trailing slash optional, any path suffix.
            rpcRoutes[`${rpcUrl}**`] = ethCallInterceptor;
        }

        return {
            [REGISTRY_GRAPHQL_URL]: makeGraphqlMockHandler({
                proposals: [fakeMarketProposalEntity({
                    metadataExtra: {
                        // String values per parseInt(...) in
                        // extractTwapFromMetadata.
                        twapStartTimestamp: String(TWAP_START_TIMESTAMP),
                        twapDurationHours:  String(TWAP_DURATION_HOURS),
                        twapDescription:    'Harness probe TWAP — ended proposal window',
                    },
                })],
            }),
            [CANDLES_GRAPHQL_URL]: makeSubgraphAwareCandlesHandler({
                marketName: 'Harness probe TWAP — ended proposal window',
            }),
            ...rpcRoutes,
        };
    },

    assertions: [
        // Wait for the TwapCountdown value section to render. That
        // section is gated on `(isActive || hasEnded) &&
        // yesPoolConfig?.address && noPoolConfig?.address`; once the
        // "Final TWAP Window" label is visible we know the useEffect
        // has fired its YES + NO getTimepoints calls. Polling for the
        // DOM is more deterministic than a fixed sleep — if the page
        // takes 1s or 8s, the assertion proceeds the moment the
        // surface materializes.
        async (page) => {
            await expect(
                page.getByText(/Final TWAP Window/i).first(),
            ).toBeVisible({ timeout: 30_000 });
        },

        // Core assertion: at least one call captured AND every one
        // has aEnd > 0 (post-fix shape). If `secondsAgoEnd=0`
        // regresses back into fetchPoolTwap, ALL captured calls
        // would have aEnd === 0, and this fails.
        async (page, ctx) => {
            const calls = ctx.timepointsCalls ?? [];
            if (calls.length === 0) {
                throw new Error(
                    'Scenario 59 captured ZERO getTimepoints calls. ' +
                    'Either TwapCountdown didn\'t mount (check fakeMarketProposalEntity ' +
                    'twap metadata flow into config.marketInfo.twapStartTimestamp), or ' +
                    'the route handler\'s URL pattern doesn\'t match the page\'s RPC URL.',
                );
            }
            const preFixShape = calls.filter((c) => c.secondsAgos[1] === 0);
            if (preFixShape.length > 0) {
                const summary = preFixShape
                    .slice(0, 4)
                    .map((c, i) => `  ${i + 1}. pool=${c.pool} secondsAgos=[${c.secondsAgos.join(', ')}]`)
                    .join('\n');
                throw new Error(
                    `Scenario 59 found ${preFixShape.length} of ${calls.length} ` +
                    `getTimepoints call(s) with PRE-FIX shape (secondsAgoEnd=0). ` +
                    `Expected post-PR-54 shape: [secondsAgoStart, secondsAgoEnd > 0] ` +
                    `for ended proposals.\n${summary}`,
                );
            }
        },
    ],

    timeout: 180_000,
};
