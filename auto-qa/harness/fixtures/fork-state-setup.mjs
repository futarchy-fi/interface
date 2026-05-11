/**
 * fork-state-setup.mjs — Playwright globalSetup for the forked-anvil
 * state baseline.
 *
 * Phase 7 fork-bootstrap step 2. Runs ONCE before all Playwright
 * tests in a run (after `webServer` brings anvil up, before any
 * test executes). The `globalSetup` field in `playwright.config.mjs`
 * points at this file's default export.
 *
 * **What it does NOW** (this slice):
 *   - Verifies anvil is reachable at the configured RPC URL
 *     (`HARNESS_FRONTEND_RPC_URL` or default localhost:8546)
 *   - Verifies the fork's chain id matches Gnosis (100) — a
 *     mismatch means anvil started against the wrong fork URL
 *     and silently every scenario would assert against the wrong
 *     chain
 *   - Verifies the synthetic wallet's account 0 has the expected
 *     pre-funded ETH balance (anvil's default for derived dev
 *     accounts is 10000 ETH; if it's 0 the wallet stub will fail
 *     to send transactions, which is the SILENT failure mode that
 *     bit us in earlier iterations before this check existed)
 *   - SKIPS cleanly when anvil isn't reachable (e.g.,
 *     `HARNESS_NO_ANVIL=1` or scenarios are running pure-mock).
 *     Logs a one-line warning instead of failing.
 *
 * **What it will do in subsequent slices**:
 *   - Pre-fund the wallet with sDAI (impersonate a known whale +
 *     ERC20 transfer)
 *   - Mint ERC1155 conditional-token positions for the wallet on
 *     the probe market (call splitPosition through the futarchy
 *     router, OR directly write storage slots)
 *   - Snapshot the post-setup state so per-scenario hooks can
 *     `evm_revert` to it for isolation
 *
 * Per-scenario state customization (e.g., specific block pin,
 * specific positions per scenario) lands in step 3.
 */

import { nStubWallets } from './wallet-stub.mjs';
import { getChainId, getEthBalance } from './fork-state.mjs';

const RPC_URL =
    process.env.HARNESS_FRONTEND_RPC_URL ||
    process.env.HARNESS_ANVIL_URL ||
    'http://localhost:8546';

const EXPECTED_CHAIN_ID = 100; // Gnosis
const MIN_WALLET_ETH_WEI = 1n * 10n ** 18n; // 1 ETH; default funding is 10000

/**
 * @returns {Promise<void>}
 */
export default async function globalSetup() {
    if (process.env.HARNESS_NO_ANVIL) {
        console.log('[fork-state-setup] HARNESS_NO_ANVIL set — skipping fork checks');
        return;
    }

    let chainId;
    try {
        chainId = await getChainId(RPC_URL);
    } catch (err) {
        console.warn(`[fork-state-setup] anvil unreachable at ${RPC_URL}: ${err.message}`);
        console.warn('[fork-state-setup] proceeding without fork checks; on-chain assertions will not be meaningful');
        return;
    }

    if (chainId !== EXPECTED_CHAIN_ID) {
        throw new Error(
            `[fork-state-setup] anvil at ${RPC_URL} reports chainId ${chainId}, expected ${EXPECTED_CHAIN_ID} (Gnosis). ` +
            `The wallet stub forces chainId 100 in-page; a mismatch means scenarios will assert against the wrong chain. ` +
            `Check FORK_URL — it should point at a Gnosis RPC.`
        );
    }

    const [wallet] = nStubWallets(1);
    const balance = await getEthBalance(RPC_URL, wallet.address);
    if (balance < MIN_WALLET_ETH_WEI) {
        throw new Error(
            `[fork-state-setup] synthetic wallet ${wallet.address} has only ${balance} wei on the fork ` +
            `(expected ≥ ${MIN_WALLET_ETH_WEI}). Anvil should have pre-funded it via --accounts 10. ` +
            `Possible causes: --accounts flag stripped from anvil args, OR a different mnemonic was used.`
        );
    }

    console.log(`[fork-state-setup] anvil OK at ${RPC_URL} — chain ${chainId}, wallet ${wallet.address} has ${balance / 10n ** 18n} ETH`);
}
