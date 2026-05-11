// smoke-fork-state — exercises fixtures/fork-state.mjs against an
// in-process JSON-RPC stub. No live anvil needed.
//
// Phase 7 fork-bootstrap step 2 sister test. The helpers ship as
// thin wrappers around fetch() against an anvil-compatible JSON-RPC
// surface; this test stands up a node:http server that records
// each request and returns canned responses, then asserts the
// helpers issue the right method + params and parse results
// correctly. Catches:
//   - method-name typos (anvil_setBalances vs anvil_setBalance)
//   - param ordering bugs (address before amount, or vice versa)
//   - hex conversion regressions (passing a decimal string when
//     anvil expects 0x-hex)
//   - error path that swallows RPC errors silently

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';

import {
    anvilRpc,
    toHex,
    setEthBalance,
    getEthBalance,
    impersonateAndSend,
    getChainId,
} from '../fixtures/fork-state.mjs';

// ── Stub server fixture ──────────────────────────────────────────────

function startStub(handler) {
    return new Promise((resolve) => {
        const server = createServer((req, res) => {
            let body = '';
            req.on('data', (chunk) => { body += chunk; });
            req.on('end', () => {
                let parsed;
                try {
                    parsed = JSON.parse(body);
                } catch (err) {
                    res.statusCode = 400;
                    res.end(JSON.stringify({ error: { message: `bad json: ${err.message}` } }));
                    return;
                }
                const result = handler(parsed);
                res.statusCode = 200;
                res.setHeader('content-type', 'application/json');
                res.end(JSON.stringify({ jsonrpc: '2.0', id: parsed.id ?? 1, ...result }));
            });
        });
        server.listen(0, '127.0.0.1', () => {
            const { port } = server.address();
            resolve({ url: `http://127.0.0.1:${port}`, server });
        });
    });
}

const closeStub = (s) => new Promise((resolve) => s.close(resolve));

// ── Helper unit tests ────────────────────────────────────────────────

test('toHex — converts bigint, number, decimal string, 0x-prefixed string', () => {
    assert.equal(toHex(0n), '0x0');
    assert.equal(toHex(255n), '0xff');
    assert.equal(toHex(0), '0x0');
    assert.equal(toHex(255), '0xff');
    assert.equal(toHex('255'), '0xff');
    assert.equal(toHex('0xff'), '0xff');
    // bigint > Number.MAX_SAFE_INTEGER
    assert.equal(toHex(10n ** 30n), '0xc9f2c9cd04674edea40000000');
});

test('toHex — rejects negative numbers + bad types', () => {
    assert.throws(() => toHex(-1), /non-negative integer/);
    assert.throws(() => toHex(1.5), /non-negative integer/);
    assert.throws(() => toHex({}), /unsupported type/);
});

test('anvilRpc — POSTs JSON-RPC envelope + returns result', async () => {
    const calls = [];
    const { url, server } = await startStub((req) => {
        calls.push(req);
        return { result: '0x42' };
    });
    try {
        const r = await anvilRpc(url, 'evm_blockNumber', []);
        assert.equal(r, '0x42');
        assert.equal(calls.length, 1);
        assert.equal(calls[0].method, 'evm_blockNumber');
        assert.deepEqual(calls[0].params, []);
        assert.equal(calls[0].jsonrpc, '2.0');
    } finally {
        await closeStub(server);
    }
});

test('anvilRpc — surfaces RPC errors as thrown errors', async () => {
    const { url, server } = await startStub(() => ({
        error: { code: -32601, message: 'method not found' },
    }));
    try {
        await assert.rejects(
            () => anvilRpc(url, 'bogus_method', []),
            /RPC error.*method not found/,
        );
    } finally {
        await closeStub(server);
    }
});

test('anvilRpc — surfaces non-200 HTTP as thrown errors', async () => {
    const server = createServer((_req, res) => {
        res.statusCode = 503;
        res.end('upstream down');
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
        const { port } = server.address();
        await assert.rejects(
            () => anvilRpc(`http://127.0.0.1:${port}`, 'eth_chainId', []),
            /HTTP 503/,
        );
    } finally {
        await closeStub(server);
    }
});

test('setEthBalance — sends anvil_setBalance with [address, hex(amount)]', async () => {
    const calls = [];
    const { url, server } = await startStub((req) => {
        calls.push(req);
        return { result: null };
    });
    try {
        await setEthBalance(url, '0xabc', 1n * 10n ** 18n);
        assert.equal(calls.length, 1);
        assert.equal(calls[0].method, 'anvil_setBalance');
        assert.deepEqual(calls[0].params, ['0xabc', '0xde0b6b3a7640000']);
    } finally {
        await closeStub(server);
    }
});

test('getEthBalance — parses hex result as bigint', async () => {
    const { url, server } = await startStub(() => ({ result: '0xde0b6b3a7640000' }));
    try {
        const balance = await getEthBalance(url, '0xabc');
        assert.equal(balance, 1n * 10n ** 18n);
        assert.equal(typeof balance, 'bigint');
    } finally {
        await closeStub(server);
    }
});

test('getChainId — parses hex result as Number', async () => {
    const { url, server } = await startStub(() => ({ result: '0x64' }));
    try {
        const id = await getChainId(url);
        assert.equal(id, 100);
    } finally {
        await closeStub(server);
    }
});

test('impersonateAndSend — impersonates, sends tx, ALWAYS stops impersonating (success)', async () => {
    const calls = [];
    const { url, server } = await startStub((req) => {
        calls.push(req.method);
        if (req.method === 'eth_sendTransaction') return { result: '0xdeadbeef' };
        return { result: null };
    });
    try {
        const hash = await impersonateAndSend(url, '0xwhale', {
            to: '0xrecipient',
            value: 100n,
            data: '0xabcd',
        });
        assert.equal(hash, '0xdeadbeef');
        // Sequence: impersonate, sendTransaction, stopImpersonating
        assert.deepEqual(calls, [
            'anvil_impersonateAccount',
            'eth_sendTransaction',
            'anvil_stopImpersonatingAccount',
        ]);
    } finally {
        await closeStub(server);
    }
});

test('impersonateAndSend — stops impersonating EVEN ON FAILURE (finally)', async () => {
    const calls = [];
    const { url, server } = await startStub((req) => {
        calls.push(req.method);
        if (req.method === 'eth_sendTransaction') {
            return { error: { code: -32000, message: 'execution reverted' } };
        }
        return { result: null };
    });
    try {
        await assert.rejects(
            () => impersonateAndSend(url, '0xwhale', { to: '0xrecipient' }),
            /execution reverted/,
        );
        // Crucial — even after the send failure, stopImpersonating
        // must have been called. Otherwise the next test inherits
        // the impersonation state.
        assert.deepEqual(calls, [
            'anvil_impersonateAccount',
            'eth_sendTransaction',
            'anvil_stopImpersonatingAccount',
        ]);
    } finally {
        await closeStub(server);
    }
});
