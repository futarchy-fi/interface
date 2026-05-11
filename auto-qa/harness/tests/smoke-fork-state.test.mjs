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
    setStorageAt,
    mappingStorageKey,
    setErc20Balance,
    getErc20Balance,
    fundWalletWithSDAI,
    SDAI_TOKEN_GNOSIS_ADDRESS,
    SDAI_BALANCE_SLOT,
    nestedMappingStorageKey,
    setErc1155Balance,
    getErc1155Balance,
    CT_GNOSIS_ADDRESS,
    CT_BALANCE_SLOT,
    EMPTY_COLLECTION_ID,
    ctGetCollectionId,
    ctGetPositionId,
    ctDerivePositionId,
    setConditionalPosition,
    getConditionalPosition,
    proposalGetConditionId,
    deriveYesNoPositionIds,
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

// ── Step 2.5: ERC20 storage-write helpers ───────────────────────────

test('setStorageAt — calls anvil_setStorageAt with [addr, slotHex, paddedValue]', async () => {
    const calls = [];
    const { url, server } = await startStub((req) => {
        calls.push(req);
        return { result: null };
    });
    try {
        await setStorageAt(url, '0xabc', 5n, 42n);
        assert.equal(calls.length, 1);
        assert.equal(calls[0].method, 'anvil_setStorageAt');
        assert.equal(calls[0].params[0], '0xabc');
        assert.equal(calls[0].params[1], '0x5');
        // Value pads to 32 bytes (64 hex chars + '0x' prefix).
        assert.equal(calls[0].params[2].length, 66);
        assert.match(calls[0].params[2], /0x0+2a$/); // 42 = 0x2a
    } finally {
        await closeStub(server);
    }
});

test('mappingStorageKey — Solidity mapping-slot hash matches known reference', () => {
    // Reference values from a deterministic ethers/web3 keccak run:
    // mapping(address => uint256) at slot 0
    //   key = 0x0000000000000000000000000000000000000001
    //   slot = 0
    //   keccak256(abi.encode(key, slot))
    //     = 0xada5013122d395ba3c54772283fb069b10426056ef8ca54750cb9bb552a59e7d
    const key = mappingStorageKey('0x0000000000000000000000000000000000000001', 0);
    assert.equal(
        key.toLowerCase(),
        '0xada5013122d395ba3c54772283fb069b10426056ef8ca54750cb9bb552a59e7d',
    );
    // Slot 1 (different slot → different key).
    const keySlot1 = mappingStorageKey('0x0000000000000000000000000000000000000001', 1);
    assert.notEqual(key, keySlot1);
});

test('setErc20Balance — issues setStorageAt at the mapping slot', async () => {
    const calls = [];
    const { url, server } = await startStub((req) => {
        calls.push(req);
        return { result: null };
    });
    try {
        const holder = '0xabcdef0000000000000000000000000000000000';
        const expected = mappingStorageKey(holder, 0);
        await setErc20Balance(url, '0xtoken', holder, 100n);
        assert.equal(calls.length, 1);
        assert.equal(calls[0].method, 'anvil_setStorageAt');
        assert.equal(calls[0].params[0].toLowerCase(), '0xtoken');
        assert.equal(calls[0].params[1].toLowerCase(), expected.toLowerCase());
    } finally {
        await closeStub(server);
    }
});

test('setErc20Balance — non-zero slot produces a DIFFERENT storage key', async () => {
    const calls = [];
    const { url, server } = await startStub((req) => {
        calls.push(req);
        return { result: null };
    });
    try {
        const holder = '0xabcdef0000000000000000000000000000000000';
        await setErc20Balance(url, '0xtoken', holder, 100n, 0);
        await setErc20Balance(url, '0xtoken', holder, 100n, 5);
        // Different slots → different storage keys; catches a
        // regression that ignores the slot arg.
        assert.notEqual(calls[0].params[1], calls[1].params[1]);
    } finally {
        await closeStub(server);
    }
});

test('getErc20Balance — encodes balanceOf(address) + decodes uint256 result', async () => {
    const calls = [];
    const { url, server } = await startStub((req) => {
        calls.push(req);
        // Result: 42 as 32-byte big-endian uint256.
        return { result: '0x000000000000000000000000000000000000000000000000000000000000002a' };
    });
    try {
        const holder = '0x0000000000000000000000000000000000000001';
        const balance = await getErc20Balance(url, '0xtoken', holder);
        assert.equal(balance, 42n);
        assert.equal(typeof balance, 'bigint');
        assert.equal(calls.length, 1);
        assert.equal(calls[0].method, 'eth_call');
        // Calldata starts with the balanceOf(address) selector.
        assert.match(calls[0].params[0].data, /^0x70a08231/); // keccak("balanceOf(address)")[0:4]
        // Calldata includes the holder address, lowercased + padded.
        assert.match(calls[0].params[0].data.toLowerCase(), /0+1$/);
    } finally {
        await closeStub(server);
    }
});

test('fundWalletWithSDAI — targets sDAI on Gnosis at the configured slot', async () => {
    const calls = [];
    const { url, server } = await startStub((req) => {
        calls.push(req);
        return { result: null };
    });
    try {
        const holder = '0xabcdef0000000000000000000000000000000000';
        await fundWalletWithSDAI(url, holder);
        assert.equal(calls.length, 1);
        assert.equal(calls[0].method, 'anvil_setStorageAt');
        assert.equal(calls[0].params[0].toLowerCase(), SDAI_TOKEN_GNOSIS_ADDRESS.toLowerCase());
        // Storage key matches mappingStorageKey at the configured
        // slot — catches a regression that ignores SDAI_BALANCE_SLOT.
        assert.equal(
            calls[0].params[1].toLowerCase(),
            mappingStorageKey(holder, SDAI_BALANCE_SLOT).toLowerCase(),
        );
    } finally {
        await closeStub(server);
    }
});

test('fundWalletWithSDAI — defaults amount to 1000 sDAI (1e21 wei)', async () => {
    const calls = [];
    const { url, server } = await startStub((req) => {
        calls.push(req);
        return { result: null };
    });
    try {
        await fundWalletWithSDAI(url, '0xabcdef0000000000000000000000000000000000');
        // 1000e18 = 0x3635c9adc5dea00000
        assert.match(calls[0].params[2], /0+3635c9adc5dea00000$/);
    } finally {
        await closeStub(server);
    }
});

// ── Step 2.7: ERC1155 storage-write helpers ─────────────────────────

test('nestedMappingStorageKey — matches deterministic reference value', () => {
    // For mapping(uint256 => mapping(address => uint256)) at outer slot 0,
    // accessing [tokenId=1][holder=0x...01]:
    //   inner_slot   = keccak256(abi.encode(uint256(1), uint256(0)))
    //   actual_slot  = keccak256(abi.encode(address(0x...01), uint256(inner_slot)))
    const key = nestedMappingStorageKey(
        1n, '0x0000000000000000000000000000000000000001', 0,
    );
    assert.equal(
        key.toLowerCase(),
        '0xe3be84349242383ed4b31bbb7ede08a8080ac9d5e828342f449d34bf731539e9',
    );
});

test('nestedMappingStorageKey — different outerKey produces different storage key', () => {
    const k1 = nestedMappingStorageKey(1n, '0x0000000000000000000000000000000000000001', 0);
    const k2 = nestedMappingStorageKey(2n, '0x0000000000000000000000000000000000000001', 0);
    assert.notEqual(k1, k2);
});

test('nestedMappingStorageKey — different innerKey produces different storage key', () => {
    const k1 = nestedMappingStorageKey(1n, '0x0000000000000000000000000000000000000001', 0);
    const k2 = nestedMappingStorageKey(1n, '0x0000000000000000000000000000000000000002', 0);
    assert.notEqual(k1, k2);
});

test('nestedMappingStorageKey — different outerSlot produces different storage key', () => {
    const k1 = nestedMappingStorageKey(1n, '0x0000000000000000000000000000000000000001', 0);
    const k2 = nestedMappingStorageKey(1n, '0x0000000000000000000000000000000000000001', 5);
    assert.notEqual(k1, k2);
});

test('setErc1155Balance — issues setStorageAt at the nested mapping slot', async () => {
    const calls = [];
    const { url, server } = await startStub((req) => {
        calls.push(req);
        return { result: null };
    });
    try {
        const holder = '0xabcdef0000000000000000000000000000000000';
        const tokenId = 42n;
        const expected = nestedMappingStorageKey(tokenId, holder, 0, 'uint256', 'address');
        await setErc1155Balance(url, '0xtoken1155', holder, tokenId, 100n);
        assert.equal(calls.length, 1);
        assert.equal(calls[0].method, 'anvil_setStorageAt');
        assert.equal(calls[0].params[0].toLowerCase(), '0xtoken1155');
        assert.equal(calls[0].params[1].toLowerCase(), expected.toLowerCase());
    } finally {
        await closeStub(server);
    }
});

test('getErc1155Balance — encodes balanceOf(address, uint256) + decodes uint256 result', async () => {
    const calls = [];
    const { url, server } = await startStub((req) => {
        calls.push(req);
        return { result: '0x000000000000000000000000000000000000000000000000000000000000007b' };
    });
    try {
        const balance = await getErc1155Balance(
            url,
            '0xtoken1155',
            '0x0000000000000000000000000000000000000001',
            42n,
        );
        assert.equal(balance, 123n); // 0x7b = 123
        assert.equal(calls.length, 1);
        assert.equal(calls[0].method, 'eth_call');
        // ERC1155 balanceOf selector: keccak256("balanceOf(address,uint256)")[0:4] = 0x00fdd58e
        assert.match(calls[0].params[0].data, /^0x00fdd58e/);
    } finally {
        await closeStub(server);
    }
});

// ── Step 2.8: ConditionalTokens position-ID helpers ─────────────────

test('CT constants — pinned to known Gnosis values', () => {
    assert.equal(
        CT_GNOSIS_ADDRESS,
        '0xCeAfDD6bc0bEF976fdCd1112955828E00543c0Ce',
        'CT_GNOSIS_ADDRESS must match the constant in src/components/futarchyFi/marketPage/constants/contracts.js',
    );
    assert.equal(
        CT_BALANCE_SLOT, 1,
        'CT_BALANCE_SLOT live-verified at slot 1 in step 2.8 (NOT slot 0 — Gnosis CT inherits a base that uses slot 0 for something else)',
    );
    assert.equal(EMPTY_COLLECTION_ID, '0x' + '00'.repeat(32));
});

test('ctGetCollectionId — eth_call to CT contract with bytes32+bytes32+uint256 args', async () => {
    const calls = [];
    const { url, server } = await startStub((req) => {
        calls.push(req);
        return { result: '0x6259f0343995a15d8536eb787d54fc267cb9b6d9a58ce3f9023e74c7547f2c59' };
    });
    try {
        const condId = '0x9c89eb71b3b54134a6099fdced88df75254606b9a08d0c9b5f96fa3905e2db3d';
        const result = await ctGetCollectionId(url, EMPTY_COLLECTION_ID, condId, 1n);
        assert.equal(
            result.toLowerCase(),
            '0x6259f0343995a15d8536eb787d54fc267cb9b6d9a58ce3f9023e74c7547f2c59',
        );
        assert.equal(calls[0].method, 'eth_call');
        assert.equal(calls[0].params[0].to.toLowerCase(), CT_GNOSIS_ADDRESS.toLowerCase());
        // getCollectionId(bytes32,bytes32,uint256) selector:
        // keccak256("getCollectionId(bytes32,bytes32,uint256)")[0:4] = 0x856296f7
        assert.match(calls[0].params[0].data, /^0x856296f7/);
    } finally {
        await closeStub(server);
    }
});

test('ctGetPositionId — eth_call to CT contract with address+bytes32 args', async () => {
    const calls = [];
    const { url, server } = await startStub((req) => {
        calls.push(req);
        // Result: 0x668e2de525bf95c1b7ecdc79bd47a46605f77cd472cef3707626bf76fb0a743d
        return { result: '0x668e2de525bf95c1b7ecdc79bd47a46605f77cd472cef3707626bf76fb0a743d' };
    });
    try {
        const result = await ctGetPositionId(
            url,
            '0xaf204776c7245bF4147c2612BF6e5972Ee483701',
            '0x6259f0343995a15d8536eb787d54fc267cb9b6d9a58ce3f9023e74c7547f2c59',
        );
        assert.equal(typeof result, 'bigint');
        assert.equal(
            '0x' + result.toString(16).padStart(64, '0'),
            '0x668e2de525bf95c1b7ecdc79bd47a46605f77cd472cef3707626bf76fb0a743d',
        );
        // getPositionId(address,bytes32) selector:
        // keccak256("getPositionId(address,bytes32)")[0:4] = 0x39dd7530
        assert.match(calls[0].params[0].data, /^0x39dd7530/);
    } finally {
        await closeStub(server);
    }
});

test('ctDerivePositionId — chains getCollectionId → getPositionId in two eth_calls', async () => {
    const methods = [];
    let callIdx = 0;
    const { url, server } = await startStub((req) => {
        methods.push(req.method);
        const responses = [
            // First call: getCollectionId
            { result: '0x6259f0343995a15d8536eb787d54fc267cb9b6d9a58ce3f9023e74c7547f2c59' },
            // Second call: getPositionId
            { result: '0x668e2de525bf95c1b7ecdc79bd47a46605f77cd472cef3707626bf76fb0a743d' },
        ];
        return responses[callIdx++];
    });
    try {
        const positionId = await ctDerivePositionId(
            url,
            '0xaf204776c7245bF4147c2612BF6e5972Ee483701',
            '0x9c89eb71b3b54134a6099fdced88df75254606b9a08d0c9b5f96fa3905e2db3d',
            1n,
        );
        assert.equal(typeof positionId, 'bigint');
        assert.equal(callIdx, 2, 'must issue exactly 2 eth_calls');
        assert.deepEqual(methods, ['eth_call', 'eth_call']);
    } finally {
        await closeStub(server);
    }
});

test('setConditionalPosition — pins to CT contract + CT_BALANCE_SLOT', async () => {
    const calls = [];
    const { url, server } = await startStub((req) => {
        calls.push(req);
        return { result: null };
    });
    try {
        const holder = '0xabcdef0000000000000000000000000000000000';
        const positionId = 0x668e2de525bf95c1b7ecdc79bd47a46605f77cd472cef3707626bf76fb0a743dn;
        const expected = nestedMappingStorageKey(positionId, holder, CT_BALANCE_SLOT, 'uint256', 'address');
        await setConditionalPosition(url, holder, positionId, 100n);
        assert.equal(calls[0].method, 'anvil_setStorageAt');
        // Pinned to CT contract address
        assert.equal(calls[0].params[0].toLowerCase(), CT_GNOSIS_ADDRESS.toLowerCase());
        // Storage key uses CT_BALANCE_SLOT (1, NOT 0); a regression that
        // ignored the slot constant would silently write to slot 0 and
        // be invisible until end-to-end runs against the live fork.
        assert.equal(calls[0].params[1].toLowerCase(), expected.toLowerCase());
    } finally {
        await closeStub(server);
    }
});

test('getConditionalPosition — eth_call balanceOf on CT contract', async () => {
    const calls = [];
    const { url, server } = await startStub((req) => {
        calls.push(req);
        return { result: '0x000000000000000000000000000000000000000000000000000000000000000a' };
    });
    try {
        const balance = await getConditionalPosition(
            url,
            '0xabcdef0000000000000000000000000000000000',
            42n,
        );
        assert.equal(balance, 10n);
        assert.equal(calls[0].method, 'eth_call');
        assert.equal(calls[0].params[0].to.toLowerCase(), CT_GNOSIS_ADDRESS.toLowerCase());
        // ERC1155 balanceOf selector
        assert.match(calls[0].params[0].data, /^0x00fdd58e/);
    } finally {
        await closeStub(server);
    }
});

// ── Step 2.9: probe-market position-ID derivation ───────────────────

test('proposalGetConditionId — eth_call to FutarchyProposal at the given address', async () => {
    const calls = [];
    const { url, server } = await startStub((req) => {
        calls.push(req);
        return { result: '0xf3a4bd711370dbcb82ec9b91d111041925a62333faa9cad9f614658d76136163' };
    });
    try {
        const PROBE = '0x45e1064348fd8a407d6d1f59fc64b05f633b28fc';
        const condId = await proposalGetConditionId(url, PROBE);
        assert.equal(
            condId.toLowerCase(),
            '0xf3a4bd711370dbcb82ec9b91d111041925a62333faa9cad9f614658d76136163',
        );
        assert.equal(calls[0].method, 'eth_call');
        assert.equal(calls[0].params[0].to.toLowerCase(), PROBE);
        // conditionId() selector: keccak256("conditionId()")[0:4] = 0x2ddc7de7
        assert.match(calls[0].params[0].data, /^0x2ddc7de7/);
    } finally {
        await closeStub(server);
    }
});

test('deriveYesNoPositionIds — issues 3 eth_calls (proposal.conditionId + 2× CT pair)', async () => {
    let callIdx = 0;
    const { url, server } = await startStub(() => {
        callIdx++;
        const responses = [
            // 1. proposal.conditionId() → bytes32
            { result: '0xf3a4bd711370dbcb82ec9b91d111041925a62333faa9cad9f614658d76136163' },
            // 2. ct.getCollectionId(0, condId, 1) → bytes32
            { result: '0x' + '11'.repeat(32) },
            // 3. ct.getPositionId(token, collectionId) → uint256
            { result: '0x000000000000000000000000000000000000000000000000000000000000000a' },
            // 4. ct.getCollectionId(0, condId, 2) → bytes32
            { result: '0x' + '22'.repeat(32) },
            // 5. ct.getPositionId(token, collectionId) → uint256
            { result: '0x0000000000000000000000000000000000000000000000000000000000000014' },
        ];
        return responses[callIdx - 1];
    });
    try {
        const result = await deriveYesNoPositionIds(
            url,
            '0x45e1064348fd8a407d6d1f59fc64b05f633b28fc',
            '0xaf204776c7245bF4147c2612BF6e5972Ee483701',
        );
        // 5 eth_calls total: 1 proposal + 2 (collectionId+positionId) pairs
        assert.equal(callIdx, 5);
        assert.equal(
            result.conditionId.toLowerCase(),
            '0xf3a4bd711370dbcb82ec9b91d111041925a62333faa9cad9f614658d76136163',
        );
        assert.equal(result.yes, 10n);
        assert.equal(result.no, 20n);
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
