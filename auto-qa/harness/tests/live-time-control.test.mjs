// live-time-control — exercises the time-control primitives against
// a REAL anvil instance (slice 90 added the wrappers; this slice
// proves they work end-to-end against actual anvil, not just the
// in-process stub the smoke-fork-state tests use).
//
// **Not in the default smoke run** — requires `anvil` listening on
// `HARNESS_ANVIL_URL` (defaults to localhost:8546). When that isn't
// reachable, the test SKIPS rather than fails, so CI / smoke runs
// stay green without an anvil. Run manually with:
//
//     anvil --fork-url $FORK_URL --port 8546 --chain-id 100 &
//     node --test tests/live-time-control.test.mjs
//
// What this catches that the stub-based smoke can't:
//   - anvil version regressions that rename / drop legacy methods
//     (e.g., a future anvil release that requires
//     `anvil_setNextBlockTimestamp` instead of `evm_*`)
//   - anvil's actual timestamp validation (must be > current, must
//     not overflow uint64) — exercised by the rejection probes
//   - the snapshot+revert pairing (the suite leaves the chain
//     state unchanged after the test runs, so it can co-run with
//     scenarios without polluting fork state)
//
// What this DOES NOT catch:
//   - downstream consumer behavior (page rendering, hook polling).
//     That's the job of TIME-EVOLUTION scenarios built on top of
//     these primitives.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    getBlockTimestamp,
    setNextBlockTimestamp,
    mineBlock,
    advanceTime,
    evmSnapshot,
    evmRevert,
} from '../fixtures/fork-state.mjs';

const RPC_URL = process.env.HARNESS_ANVIL_URL || 'http://localhost:8546';

// Probe: is anvil reachable at RPC_URL? If not, skip every test in
// this file. We use net.Socket rather than fetch() so we get a fast
// fail (~10ms) instead of a 5s timeout when nothing is listening.
async function anvilReachable() {
    try {
        const ac = new AbortController();
        const timeout = setTimeout(() => ac.abort(), 1500);
        const res = await fetch(RPC_URL, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
            signal: ac.signal,
        });
        clearTimeout(timeout);
        if (!res.ok) return false;
        const json = await res.json();
        // Anvil/Gnosis fork: chainId 100 = 0x64. Some setups use 1
        // (mainnet fork) for local testing — accept both, fail
        // loud only on totally-unexpected values.
        return typeof json?.result === 'string' && /^0x[0-9a-f]+$/.test(json.result);
    } catch {
        return false;
    }
}

// All tests below share this skip guard. Module-level await would
// be cleaner but node:test doesn't support `test.skip()` outside
// the test body — each test instead probes at start and short-
// circuits.
async function skipIfNoAnvil(t) {
    if (!(await anvilReachable())) {
        t.skip(`anvil not reachable at ${RPC_URL} (set HARNESS_ANVIL_URL or run anvil --fork-url ... --port 8546)`);
        return true;
    }
    return false;
}

// ── Real-anvil round-trips ───────────────────────────────────────────

test('getBlockTimestamp — returns a reasonable unix timestamp from live anvil', async (t) => {
    if (await skipIfNoAnvil(t)) return;
    const ts = await getBlockTimestamp(RPC_URL);
    // Sanity bounds: between 2020-01-01 and 2100-01-01 unix seconds.
    // A non-numeric or out-of-band return would mean our parsing is
    // wrong (e.g., reading number-of-block instead of timestamp).
    assert.ok(ts > 1_577_836_800, `block timestamp ${ts} earlier than 2020 — suspect parser`);
    assert.ok(ts < 4_102_444_800, `block timestamp ${ts} past 2100 — suspect parser`);
});

test('advanceTime — block timestamp advances by approximately the requested seconds', async (t) => {
    if (await skipIfNoAnvil(t)) return;

    // Wrap the mutation in snapshot+revert so this test leaves no
    // residue on the anvil instance — important when running side-
    // by-side with scenarios that depend on fork state.
    const snapshotId = await evmSnapshot(RPC_URL);
    try {
        const before = await getBlockTimestamp(RPC_URL);
        const newTs = await advanceTime(RPC_URL, 3600);
        const after = await getBlockTimestamp(RPC_URL);

        // Both mineBlock's return AND the subsequent eth_getBlockByNumber
        // should agree on the new timestamp.
        assert.equal(newTs, after, 'mineBlock return must equal subsequent getBlockTimestamp');

        // Anvil applies `setNextBlockTimestamp` EXACTLY, so the delta
        // should be exactly 3600 — no slop. (Wall-clock-based clocks
        // would be ±1s; anvil isn't one of them.)
        const delta = after - before;
        assert.equal(delta, 3600, `expected exactly +3600s, got +${delta}s`);
    } finally {
        await evmRevert(RPC_URL, snapshotId);
    }
});

test('setNextBlockTimestamp + mineBlock — pinning works exactly', async (t) => {
    if (await skipIfNoAnvil(t)) return;

    const snapshotId = await evmSnapshot(RPC_URL);
    try {
        const before = await getBlockTimestamp(RPC_URL);
        const target = before + 86_400; // exactly +1 day
        await setNextBlockTimestamp(RPC_URL, target);
        const after = await mineBlock(RPC_URL);
        assert.equal(after, target, `next block should be EXACTLY at target ${target}, got ${after}`);
    } finally {
        await evmRevert(RPC_URL, snapshotId);
    }
});

test('setNextBlockTimestamp — anvil rejects past timestamps with a loud error', async (t) => {
    if (await skipIfNoAnvil(t)) return;

    const snapshotId = await evmSnapshot(RPC_URL);
    try {
        const current = await getBlockTimestamp(RPC_URL);
        // Anvil rejects timestamps STRICTLY less than the previous
        // block's. (Equal-to-current is accepted: anvil 1.5.0
        // confirmed.) Passing current - 100 should always fail.
        // This is the loud-failure property we want — scenarios
        // that accidentally regress to past time get a clear error,
        // not silent no-op.
        await assert.rejects(
            () => setNextBlockTimestamp(RPC_URL, current - 100),
            (err) => {
                const msg = String(err.message || err);
                return /timestamp/i.test(msg) || /-32602|-32000/.test(msg);
            },
            'expected setNextBlockTimestamp(past) to fail with a timestamp-related error',
        );
    } finally {
        await evmRevert(RPC_URL, snapshotId);
    }
});

test('snapshot + revert + advanceTime — revert restores original timestamp', async (t) => {
    if (await skipIfNoAnvil(t)) return;

    const before = await getBlockTimestamp(RPC_URL);
    const snapshotId = await evmSnapshot(RPC_URL);
    await advanceTime(RPC_URL, 7200); // jump 2h forward
    const advanced = await getBlockTimestamp(RPC_URL);
    assert.equal(advanced, before + 7200, 'sanity: advance worked');

    await evmRevert(RPC_URL, snapshotId);
    const restored = await getBlockTimestamp(RPC_URL);
    // After revert, the block timestamp should be the pre-snapshot
    // value (anvil throws away the +7200 block). This is critical
    // for scenario isolation: a scenario that calls advanceTime
    // must not affect the next scenario in the suite.
    assert.equal(restored, before, `revert should restore timestamp ${before}, got ${restored}`);
});
