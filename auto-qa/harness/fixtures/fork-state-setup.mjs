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
import { MARKET_PROBE_ADDRESS } from './api-mocks.mjs';
import {
    getChainId,
    getEthBalance,
    getErc20Balance,
    fundWalletWithSDAI,
    SDAI_TOKEN_GNOSIS_ADDRESS,
    deriveYesNoPositionIds,
    setConditionalPosition,
    getConditionalPosition,
    evmSnapshot,
} from './fork-state.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Step 7: snapshot ID written to disk so the per-scenario reverter
// (in flows/scenarios.spec.mjs) can read it. globalSetup runs once
// in Node before all tests; the runner runs per-scenario in a
// separate worker. A file is the simplest cross-process channel
// that doesn't require coupling Playwright's global state plumbing.
export const SNAPSHOT_ID_FILE = join(__dirname, '..', '.fork-snapshot-id');

const RPC_URL =
    process.env.HARNESS_FRONTEND_RPC_URL ||
    process.env.HARNESS_ANVIL_URL ||
    'http://localhost:8546';

const EXPECTED_CHAIN_ID = 100; // Gnosis
const MIN_WALLET_ETH_WEI = 1n * 10n ** 18n; // 1 ETH; default funding is 10000
const SDAI_FUND_AMOUNT_WEI = 1000n * 10n ** 18n; // 1000 sDAI
const POSITION_FUND_AMOUNT_WEI = 100n * 10n ** 18n; // 100 YES + 100 NO ERC1155 units

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

    // Fund the wallet with sDAI (1000 tokens) by writing directly to
    // the _balances mapping storage. Verified live in step 2.6 that
    // SDAI_BALANCE_SLOT=0 produces the expected post-write balance
    // for the actual sDAI token at SDAI_TOKEN_GNOSIS_ADDRESS.
    //
    // VERIFICATION step (post-write read-back) is what catches the
    // slot constant going wrong if the sDAI contract upgrades — a
    // wrong slot writes to garbage storage and leaves the real
    // balanceOf() unchanged, so the read returns 0 instead of the
    // expected 1000e18. Hard-fail in that case so the breakage is
    // loud at globalSetup time, not silently downstream when a
    // scenario reads positions and sees zero balance.
    await fundWalletWithSDAI(RPC_URL, wallet.address, SDAI_FUND_AMOUNT_WEI);
    const sdaiBalance = await getErc20Balance(RPC_URL, SDAI_TOKEN_GNOSIS_ADDRESS, wallet.address);
    if (sdaiBalance !== SDAI_FUND_AMOUNT_WEI) {
        throw new Error(
            `[fork-state-setup] sDAI funding verification FAILED — wrote ${SDAI_FUND_AMOUNT_WEI} ` +
            `at slot SDAI_BALANCE_SLOT, but balanceOf() returned ${sdaiBalance}. ` +
            `The slot constant in fixtures/fork-state.mjs is wrong (likely the sDAI contract upgraded ` +
            `and changed its storage layout). Re-derive via:\n` +
            `  anvil --fork-url <gnosis-rpc> --port 8546 &\n` +
            `  node -e "import('./fixtures/fork-state.mjs').then(m => /* probe slots 0..10 */)"\n` +
            `Then update SDAI_BALANCE_SLOT in fixtures/fork-state.mjs.`
        );
    }
    console.log(`[fork-state-setup] sDAI funded — wallet ${wallet.address} now holds ${sdaiBalance / 10n ** 18n} sDAI`);

    // Mint YES + NO ConditionalTokens positions for the probe market
    // (GIP-145). Approach mirrors the sDAI funding above: derive the
    // position IDs from the live FutarchyProposal contract, write to
    // the CT contract's _balances mapping at CT_BALANCE_SLOT, read
    // back via balanceOf to verify the slot constant + position-ID
    // derivation worked.
    //
    // 100 YES + 100 NO is enough for the positions panel to show
    // non-zero balances; scenarios that need specific values can
    // override per-test (step 3).
    const { conditionId, yes: yesPositionId, no: noPositionId } =
        await deriveYesNoPositionIds(RPC_URL, MARKET_PROBE_ADDRESS, SDAI_TOKEN_GNOSIS_ADDRESS);

    await setConditionalPosition(RPC_URL, wallet.address, yesPositionId, POSITION_FUND_AMOUNT_WEI);
    await setConditionalPosition(RPC_URL, wallet.address, noPositionId,  POSITION_FUND_AMOUNT_WEI);

    const yesBalance = await getConditionalPosition(RPC_URL, wallet.address, yesPositionId);
    const noBalance  = await getConditionalPosition(RPC_URL, wallet.address, noPositionId);

    if (yesBalance !== POSITION_FUND_AMOUNT_WEI || noBalance !== POSITION_FUND_AMOUNT_WEI) {
        throw new Error(
            `[fork-state-setup] conditional-position funding verification FAILED — ` +
            `wrote ${POSITION_FUND_AMOUNT_WEI} to YES + NO at CT_BALANCE_SLOT, but balanceOf returned ` +
            `YES=${yesBalance}, NO=${noBalance}. ` +
            `Either CT_BALANCE_SLOT is wrong (it was live-verified at 1 in step 2.8 — re-derive if CT upgraded), ` +
            `OR the probe market's conditionId getter (proposal.conditionId() at ${MARKET_PROBE_ADDRESS}) ` +
            `returned a value that doesn't match what the CT contract was initialized with for this market.`
        );
    }
    console.log(
        `[fork-state-setup] CT positions funded (derived) — wallet ${wallet.address} now holds ` +
        `${yesBalance / 10n ** 18n} YES + ${noBalance / 10n ** 18n} NO ` +
        `(market ${MARKET_PROBE_ADDRESS}, conditionId ${conditionId})`
    );

    // Step 5c: ALSO fund the position IDs that
    // `src/hooks/useContractConfig.js` returns as `MERGE_CONFIG.
    // currencyPositions.{yes,no}.positionId` for the GIP-145 fallback
    // path. Those literals are baked into the hook (lines 400 + 408)
    // and DON'T match the IDs derived above (the hook hard-codes
    // production GIP-145 values that go through a different
    // collateral; ours derive from the live `proposal.conditionId()`
    // call against MARKET_PROBE_ADDRESS on the fork). Without these
    // ALSO funded, `useBalanceManager`'s ERC1155 balanceOf reads
    // `0x0da8…` and `0xc493…` and gets 0 — the panel renders "0 sDAI"
    // even though the balanceOf call succeeded against the fork.
    //
    // Funding both sets keeps the harness backwards-compatible with
    // future code paths that DO use the derived IDs (e.g., a refactor
    // that computes positionIds from chain state instead of reading
    // hard-coded constants).
    const HOOK_FALLBACK_POSITION_IDS = {
        currencyYes: '0x0da8ddb6e1511c1b897fa0fdabac151efbe8a6a1cee0d042035a10bd8ca50566',
        currencyNo:  '0xc493e87c029b70d6dd6a58ea51d2bb5e7c5e19a61833547e3f3876242665b501',
        companyYes:  '0x15883231add67852d8d5ae24898ec21779cc1a99897a520f12ba52021266e218',
        companyNo:   '0x50b02574e86d37993b7a6ebd52414f9deea42ecfe9c3f1e8556a6d91ead41cc7',
    };
    for (const [label, positionId] of Object.entries(HOOK_FALLBACK_POSITION_IDS)) {
        await setConditionalPosition(RPC_URL, wallet.address, BigInt(positionId), POSITION_FUND_AMOUNT_WEI);
        const got = await getConditionalPosition(RPC_URL, wallet.address, BigInt(positionId));
        if (got !== POSITION_FUND_AMOUNT_WEI) {
            throw new Error(
                `[fork-state-setup] hook-fallback position funding verification FAILED for ${label} ` +
                `(positionId ${positionId}) — wrote ${POSITION_FUND_AMOUNT_WEI}, balanceOf returned ${got}. ` +
                `If CT_BALANCE_SLOT changed, both the derived AND fallback funding paths break together.`
            );
        }
    }
    console.log(
        `[fork-state-setup] CT positions funded (hook-fallback IDs) — ` +
        `currencyYes/No + companyYes/No each set to ${POSITION_FUND_AMOUNT_WEI / 10n ** 18n}`
    );

    // Step 7: snapshot the post-funding state so per-scenario hooks
    // can revert here for isolation. This MUST be the last side-effect
    // in globalSetup — anything after the snapshot won't be in the
    // restored state. Snapshot ID written to disk so the per-scenario
    // beforeEach (in flows/scenarios.spec.mjs) can pick it up across
    // process boundaries.
    const snapshotId = await evmSnapshot(RPC_URL);
    mkdirSync(dirname(SNAPSHOT_ID_FILE), { recursive: true });
    writeFileSync(SNAPSHOT_ID_FILE, snapshotId, 'utf8');
    console.log(
        `[fork-state-setup] snapshot taken — id=${snapshotId} ` +
        `written to ${SNAPSHOT_ID_FILE} for per-scenario revert`
    );
}
