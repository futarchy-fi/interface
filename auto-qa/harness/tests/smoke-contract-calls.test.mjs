/**
 * smoke-contract-calls.test.mjs — Phase 4 slice 2: contract-call surface.
 *
 * Validates that the harness can read from + write to + observe events
 * from real Gnosis contracts on the fork. Uses sDAI (ERC4626 vault, also
 * ERC20) and WXDAI (wrapped xDAI) as the test targets — both are real
 * deployed contracts the futarchy app interacts with in production.
 *
 * Cases:
 *
 *   1. readContract(sDAI.symbol) → "sDAI"
 *   2. readContract(sDAI.decimals) → 18
 *   3. readContract(sDAI.totalSupply) → > 0 (real Gnosis state)
 *   4. readContract(sDAI rate provider.getRate) → > 1e18
 *      (sDAI rate is monotonically increasing; should be > 1.0 by now)
 *   5. writeContract(WXDAI.deposit) with value=1 ETH:
 *      - tx mines, status 0x1
 *      - parseEventLogs finds Transfer(0x0 → wallet, 1 ETH)
 *      - readContract(WXDAI.balanceOf(wallet)) returns 1 ETH worth
 *
 * Skip behavior:
 *   - SKIP if anvil not on PATH
 *
 * Runtime: ~5s (anvil startup + several RPC roundtrips + 1 mine).
 *
 * Run via:   node --test auto-qa/harness/tests/smoke-contract-calls.test.mjs
 *       or:  npm run auto-qa:e2e:smoke:contracts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';

import { createProvider, nStubWallets } from '../fixtures/wallet-stub.mjs';
import {
    GNOSIS_CONTRACTS,
    ERC20_ABI,
    WXDAI_ABI,
    RATE_PROVIDER_ABI,
    readContract,
    writeContract,
    getReceipt,
    parseEventLogs,
} from '../scripts/contracts.mjs';

const PORT = Number(process.env.HARNESS_CONTRACT_TEST_PORT) || 8553;
const RPC = `http://127.0.0.1:${PORT}`;
const FORK_URL = process.env.FORK_URL || 'https://rpc.gnosis.gateway.fm';

function whichAnvil() {
    const r = spawnSync('which', ['anvil'], { encoding: 'utf8' });
    return r.status === 0 ? r.stdout.trim() : null;
}

async function spawnAnvil(port) {
    const anvilPath = whichAnvil();
    if (!anvilPath) return null;
    const child = spawn(anvilPath, [
        '--host', '0.0.0.0',
        '--port', String(port),
        '--fork-url', FORK_URL,
        '--chain-id', '100',
        '--no-mining',
    ], { stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', () => {});
    child.stderr.on('data', () => {});
    const start = Date.now();
    while (Date.now() - start < 30_000) {
        try {
            const r = await fetch(`http://127.0.0.1:${port}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0', id: 1, method: 'eth_blockNumber',
                }),
                signal: AbortSignal.timeout(1000),
            });
            if (r.ok && (await r.json()).result) return child;
        } catch { /* not ready */ }
        await wait(250);
    }
    child.kill('SIGTERM');
    throw new Error('anvil did not start within 30s');
}

async function killAnvil(child) {
    if (!child || child.killed) return;
    child.kill('SIGTERM');
    await new Promise((res) => child.once('exit', res));
}

test('Phase 4 slice 2 — contract calls: read + write + event observation', async (t) => {
    if (!whichAnvil()) {
        t.skip('anvil not on PATH');
        return;
    }

    const child = await spawnAnvil(PORT);
    try {
        // ── READ PATH ──
        const symbol = await readContract({
            rpcUrl: RPC, address: GNOSIS_CONTRACTS.sDAI,
            abi: ERC20_ABI, fn: 'symbol',
        });
        assert.equal(symbol, 'sDAI', `sDAI.symbol() should be "sDAI" (got "${symbol}")`);
        t.diagnostic(`sDAI.symbol() → "${symbol}"`);

        const decimals = await readContract({
            rpcUrl: RPC, address: GNOSIS_CONTRACTS.sDAI,
            abi: ERC20_ABI, fn: 'decimals',
        });
        assert.equal(decimals, 18, `sDAI.decimals() should be 18 (got ${decimals})`);
        t.diagnostic(`sDAI.decimals() → ${decimals}`);

        const totalSupply = await readContract({
            rpcUrl: RPC, address: GNOSIS_CONTRACTS.sDAI,
            abi: ERC20_ABI, fn: 'totalSupply',
        });
        assert.ok(totalSupply > 0n,
            `sDAI.totalSupply() should be > 0 (got ${totalSupply})`);
        t.diagnostic(`sDAI.totalSupply() → ${totalSupply / 10n ** 18n} sDAI`);

        // sDAI rate provider — production-critical invariant
        const rate = await readContract({
            rpcUrl: RPC, address: GNOSIS_CONTRACTS.sDAI_RATE_PROVIDER,
            abi: RATE_PROVIDER_ABI, fn: 'getRate',
        });
        assert.ok(rate > 10n ** 18n,
            `sDAI rate should be > 1.0 by now (got ${Number(rate) / 1e18})`);
        t.diagnostic(`sDAI rate → ${Number(rate) / 1e18}`);

        // ── WRITE PATH ──
        const wallets = nStubWallets(1);
        const provider = createProvider({
            privateKey: wallets[0].privateKey,
            rpcUrl: RPC,
            chainId: 100,
        });

        // Fund the wallet
        const oneEth = 10n ** 18n;
        const tenEth = 10n * oneEth;
        await provider.request({
            method: 'anvil_setBalance',
            params: [wallets[0].address, `0x${tenEth.toString(16)}`],
        });

        // Snapshot WXDAI balance before deposit
        const balBefore = await readContract({
            rpcUrl: RPC, address: GNOSIS_CONTRACTS.WXDAI,
            abi: WXDAI_ABI, fn: 'balanceOf', args: [wallets[0].address],
        });
        t.diagnostic(`WXDAI.balanceOf(wallet) BEFORE: ${balBefore}`);

        // Deposit 1 xDAI → mints 1 WXDAI, emits Transfer event
        const txHash = await writeContract({
            provider,
            address: GNOSIS_CONTRACTS.WXDAI,
            abi: WXDAI_ABI, fn: 'deposit',
            value: oneEth,
        });
        assert.match(txHash, /^0x[0-9a-f]{64}$/i);
        t.diagnostic(`WXDAI.deposit() tx → ${txHash.slice(0, 18)}…`);

        // Mine + fetch receipt
        const receipt = await getReceipt({ rpcUrl: RPC, txHash, mineFirst: true });
        assert.ok(receipt, 'receipt should be present after mining');
        assert.equal(receipt.status, '0x1',
            `tx should succeed (got status ${receipt.status})`);
        t.diagnostic(`receipt status: ${receipt.status} block: ${receipt.blockNumber}`);
        t.diagnostic(`receipt log count: ${receipt.logs?.length}`);
        if (receipt.logs?.length > 0) {
            t.diagnostic(`first log: ${JSON.stringify(receipt.logs[0])}`);
        }
        t.diagnostic(`receipt to: ${receipt.to}`);

        // Decode events — WXDAI follows the WETH9 pattern: deposit
        // emits Deposit (NOT Transfer). Topic
        // 0xe1fffcc4923d04b559f4d29a8bfc6cda04eb5b0d3c460751c2402c5c5cc9109c
        // is keccak256("Deposit(address,uint256)").
        const events = parseEventLogs({ receipt, abi: WXDAI_ABI });
        const deposits = events.filter((e) => e.eventName === 'Deposit');
        assert.ok(deposits.length >= 1,
            `should have at least 1 Deposit event (got ${deposits.length}). ` +
                `All event names: [${events.map((e) => e.eventName).join(', ')}]`);

        const ourDeposit = deposits.find(
            (e) => e.args.dst.toLowerCase() === wallets[0].address.toLowerCase(),
        );
        assert.ok(ourDeposit,
            `should find Deposit to our wallet (got ${deposits.map(d => d.args.dst).join(', ')})`);
        assert.equal(ourDeposit.args.wad, oneEth,
            `Deposit wad should be ${oneEth} (got ${ourDeposit.args.wad})`);
        t.diagnostic(
            `Deposit event: dst=${ourDeposit.args.dst.slice(0, 10)}… ` +
            `wad=${ourDeposit.args.wad / 10n ** 18n} WXDAI`,
        );

        // Confirm the balance update
        const balAfter = await readContract({
            rpcUrl: RPC, address: GNOSIS_CONTRACTS.WXDAI,
            abi: WXDAI_ABI, fn: 'balanceOf', args: [wallets[0].address],
        });
        assert.equal(balAfter - balBefore, oneEth,
            `wallet should have +1 WXDAI (got delta ${balAfter - balBefore})`);
        t.diagnostic(`WXDAI.balanceOf(wallet) AFTER: ${balAfter} (delta +${oneEth})`);
    } finally {
        await killAnvil(child);
    }
});
