// smoke-eth-call-inspector — exercises fixtures/eth-call-inspector.mjs
// without touching the network. Each test feeds a known-shape
// eth_call body (built with viem's encodeFunctionData so the
// encoding side is also covered) and asserts the decoder produces
// the original arguments back.
//
// Why this is worth a smoke: the eth_call interceptor is the single
// load-bearing piece between "a regression in fetchPoolTwap's call
// shape" and "scenario fails loudly." Selector typos, batch-vs-
// single confusion, BigInt-vs-Number coercion — any of these
// would silently swallow the catch. These tests pin the contract.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeFunctionData } from 'viem';

import {
    ALGEBRA_POOL_TIMEPOINTS_ABI,
    ALGEBRA_POOL_TIMEPOINTS_SELECTOR,
    parseEthCallParams,
    decodeEthCallData,
    decodeGetTimepointsArgs,
    sameAddress,
} from '../fixtures/eth-call-inspector.mjs';

// ── Selector ─────────────────────────────────────────────────────────

test('ALGEBRA_POOL_TIMEPOINTS_SELECTOR — matches keccak256("getTimepoints(uint32[])")[0:4]', () => {
    // Sanity-pin: the selector for `getTimepoints(uint32[])` is the
    // canonical value 0x9d3a5241 (verified via
    // `cast sig "getTimepoints(uint32[])"`). If viem's selector
    // computation regresses or the ABI signature drifts, this test
    // catches it.
    assert.equal(ALGEBRA_POOL_TIMEPOINTS_SELECTOR, '0x9d3a5241');
});

// ── parseEthCallParams ───────────────────────────────────────────────

test('parseEthCallParams — extracts to+data from eth_call body', () => {
    const body = {
        jsonrpc: '2.0', id: 1,
        method: 'eth_call',
        params: [{
            to:   '0x1111111111111111111111111111111111111111',
            data: '0xabcdef',
        }, 'latest'],
    };
    const result = parseEthCallParams(body);
    assert.deepEqual(result, {
        to:   '0x1111111111111111111111111111111111111111',
        data: '0xabcdef',
    });
});

test('parseEthCallParams — returns null for non-eth_call methods', () => {
    assert.equal(parseEthCallParams({ method: 'eth_blockNumber', params: [] }), null);
    assert.equal(parseEthCallParams({ method: 'eth_getBalance', params: [] }), null);
});

test('parseEthCallParams — returns null for malformed bodies', () => {
    assert.equal(parseEthCallParams(null), null);
    assert.equal(parseEthCallParams({}), null);
    assert.equal(parseEthCallParams({ method: 'eth_call' }), null);
    assert.equal(parseEthCallParams({ method: 'eth_call', params: [] }), null);
    assert.equal(parseEthCallParams({ method: 'eth_call', params: [{ to: '0xnotanaddr', data: '0x' }] }), null);
    assert.equal(parseEthCallParams({ method: 'eth_call', params: [{ to: '0x1111111111111111111111111111111111111111', data: 'notHex' }] }), null);
});

// ── decodeGetTimepointsArgs — happy path (round-trip) ────────────────

test('decodeGetTimepointsArgs — round-trips a [3600, 0] call (pre-fix shape)', () => {
    // Encode the function call the way the page would, then decode it
    // back through the inspector.
    const encoded = encodeFunctionData({
        abi: ALGEBRA_POOL_TIMEPOINTS_ABI,
        functionName: 'getTimepoints',
        args: [[3600, 0]],
    });
    const decoded = decodeGetTimepointsArgs(encoded);
    assert.deepEqual(decoded, [3600, 0]);
});

test('decodeGetTimepointsArgs — round-trips a [86400, 7200] call (post-fix ended-proposal shape)', () => {
    const encoded = encodeFunctionData({
        abi: ALGEBRA_POOL_TIMEPOINTS_ABI,
        functionName: 'getTimepoints',
        args: [[86400, 7200]],
    });
    const decoded = decodeGetTimepointsArgs(encoded);
    assert.deepEqual(decoded, [86400, 7200]);
    // The PR #54 catch hinges on the SECOND arg being non-zero.
    assert.ok(decoded[1] > 0, 'post-fix ended-proposal shape has aEnd > 0');
});

test('decodeGetTimepointsArgs — returns null on selector mismatch', () => {
    // A random non-getTimepoints selector + zero args. Should not
    // decode as a getTimepoints call.
    const fakeData = '0xdeadbeef' + '00'.repeat(32);
    assert.equal(decodeGetTimepointsArgs(fakeData), null);
});

test('decodeGetTimepointsArgs — returns null on truncated data', () => {
    // Selector present but body chopped. viem rejects the decode;
    // we wrap and return null.
    const truncated = ALGEBRA_POOL_TIMEPOINTS_SELECTOR + '00';
    assert.equal(decodeGetTimepointsArgs(truncated), null);
});

test('decodeGetTimepointsArgs — returns null on non-string input', () => {
    assert.equal(decodeGetTimepointsArgs(null), null);
    assert.equal(decodeGetTimepointsArgs(undefined), null);
    assert.equal(decodeGetTimepointsArgs(42), null);
    assert.equal(decodeGetTimepointsArgs('not-hex'), null);
});

// ── decodeEthCallData (generic) ──────────────────────────────────────

test('decodeEthCallData — generic decoder also handles getTimepoints', () => {
    const encoded = encodeFunctionData({
        abi: ALGEBRA_POOL_TIMEPOINTS_ABI,
        functionName: 'getTimepoints',
        args: [[100, 50]],
    });
    const decoded = decodeEthCallData(encoded, ALGEBRA_POOL_TIMEPOINTS_ABI);
    assert.equal(decoded.functionName, 'getTimepoints');
    const [secondsAgos] = decoded.args;
    assert.deepEqual([...secondsAgos], [100, 50]);
});

test('decodeEthCallData — returns null on unknown selector with given ABI', () => {
    const unknown = '0xdeadbeef' + '00'.repeat(64);
    assert.equal(decodeEthCallData(unknown, ALGEBRA_POOL_TIMEPOINTS_ABI), null);
});

// ── sameAddress ──────────────────────────────────────────────────────

test('sameAddress — case-insensitive match', () => {
    assert.ok(sameAddress(
        '0xAABBCCDDEEFF00112233445566778899AABBCCDD',
        '0xaabbccddeeff00112233445566778899aabbccdd',
    ));
});

test('sameAddress — mismatch returns false', () => {
    assert.equal(sameAddress(
        '0xAABBCCDDEEFF00112233445566778899AABBCCDD',
        '0xbbccddeeff00112233445566778899aabbccddee',
    ), false);
});

test('sameAddress — non-addresses return false (no exceptions)', () => {
    assert.equal(sameAddress('not-an-address', '0x1111111111111111111111111111111111111111'), false);
    assert.equal(sameAddress(null, '0x1111111111111111111111111111111111111111'), false);
    assert.equal(sameAddress('0x1111111111111111111111111111111111111111', undefined), false);
});

// ── End-to-end: parse + decode ───────────────────────────────────────

test('parse + decode — full eth_call body → secondsAgos array', () => {
    const data = encodeFunctionData({
        abi: ALGEBRA_POOL_TIMEPOINTS_ABI,
        functionName: 'getTimepoints',
        args: [[1800, 60]],
    });
    const body = {
        jsonrpc: '2.0', id: 1,
        method: 'eth_call',
        params: [{
            to:   '0xaaaa000000000000000000000000000000000aaa',
            data,
        }, 'latest'],
    };
    const call = parseEthCallParams(body);
    assert.ok(call, 'parse should succeed');
    const args = decodeGetTimepointsArgs(call.data);
    assert.deepEqual(args, [1800, 60]);
});
