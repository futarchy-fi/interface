#!/usr/bin/env node
/**
 * contracts.mjs — viem-based contract helpers for the harness.
 *
 * Phase 4 slice 2: foundation for scripted contract calls. The wallet
 * stub (`fixtures/wallet-stub.mjs`) handles raw RPC + signing. This
 * module wraps it in a typed interface for read/write/event-decode.
 *
 * Public surface:
 *
 *   readContract({rpcUrl, address, abi, fn, args})
 *     → eth_call result (raw, viem-decoded)
 *
 *   writeContract({provider, address, abi, fn, args, value})
 *     → tx hash (signed and submitted via provider, which signs via
 *        the wallet stub's eth_sendTransaction handler)
 *
 *   getReceipt({rpcUrl, txHash, mineFirst})
 *     → tx receipt with viem-parsed logs
 *
 *   parseEventLogs({receipt, abi})
 *     → array of decoded events matching the ABI
 *
 * Public address constants — known Gnosis contracts the harness uses
 * for foundational tests. Sourced from production code:
 *   - sDAI: src/utils/getSdaiRate.js + src/services/rate-provider.js
 *   - WXDAI: production deployments (canonical wrapped xDAI)
 */

import {
    createPublicClient,
    http,
    encodeFunctionData,
    decodeFunctionResult,
    parseEventLogs as viemParseEventLogs,
} from 'viem';
import { gnosis } from 'viem/chains';

// ────────────────────────────────────────────────────────────────────
// Known Gnosis contract addresses
// ────────────────────────────────────────────────────────────────────

export const GNOSIS_CONTRACTS = {
    /** sDAI — Savings xDAI vault, ERC4626 + ERC20.
     *  Used as the futarchy collateral asset and rate provider. */
    sDAI: '0xaf204776c7245bF4147c2612BF6e5972Ee483701',

    /** sDAI rate provider — implements `getRate()` per ERC-4626 spec.
     *  Used by src/services/rate-provider.js (rateProvider on Gnosis). */
    sDAI_RATE_PROVIDER: '0x89C80A4540A00b5270347E02e2E144c71da2EceD',

    /** WXDAI — Wrapped xDAI (deposit ETH → mint WXDAI 1:1). */
    WXDAI: '0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d',
};

// ────────────────────────────────────────────────────────────────────
// Common ABIs (minimal slices)
// ────────────────────────────────────────────────────────────────────

export const ERC20_ABI = [
    { type: 'function', name: 'symbol', stateMutability: 'view',
        inputs: [], outputs: [{ type: 'string' }] },
    { type: 'function', name: 'decimals', stateMutability: 'view',
        inputs: [], outputs: [{ type: 'uint8' }] },
    { type: 'function', name: 'totalSupply', stateMutability: 'view',
        inputs: [], outputs: [{ type: 'uint256' }] },
    { type: 'function', name: 'balanceOf', stateMutability: 'view',
        inputs: [{ name: 'owner', type: 'address' }],
        outputs: [{ type: 'uint256' }] },
    { type: 'function', name: 'transfer', stateMutability: 'nonpayable',
        inputs: [
            { name: 'to', type: 'address' },
            { name: 'amount', type: 'uint256' },
        ],
        outputs: [{ type: 'bool' }] },
    { type: 'event', name: 'Transfer', anonymous: false,
        inputs: [
            { indexed: true, name: 'from', type: 'address' },
            { indexed: true, name: 'to', type: 'address' },
            { indexed: false, name: 'value', type: 'uint256' },
        ] },
];

export const WXDAI_ABI = [
    ...ERC20_ABI,
    { type: 'function', name: 'deposit', stateMutability: 'payable',
        inputs: [], outputs: [] },
    { type: 'function', name: 'withdraw', stateMutability: 'nonpayable',
        inputs: [{ name: 'value', type: 'uint256' }],
        outputs: [] },
    // WXDAI follows the WETH9 pattern: deposit/withdraw emit Deposit
    // /Withdrawal events, NOT Transfer. (Verified against the live
    // deployed contract — see Phase 4 slice 2 smoke test for the
    // topic hash that pinpointed this.)
    { type: 'event', name: 'Deposit', anonymous: false,
        inputs: [
            { indexed: true, name: 'dst', type: 'address' },
            { indexed: false, name: 'wad', type: 'uint256' },
        ] },
    { type: 'event', name: 'Withdrawal', anonymous: false,
        inputs: [
            { indexed: true, name: 'src', type: 'address' },
            { indexed: false, name: 'wad', type: 'uint256' },
        ] },
];

export const RATE_PROVIDER_ABI = [
    { type: 'function', name: 'getRate', stateMutability: 'view',
        inputs: [], outputs: [{ type: 'uint256' }] },
];

// ────────────────────────────────────────────────────────────────────
// Read path — eth_call wrapper
// ────────────────────────────────────────────────────────────────────

/**
 * Call a view/pure function. Returns the decoded result.
 *
 * @param {Object} opts
 * @param {string} opts.rpcUrl  — e.g. http://127.0.0.1:8546
 * @param {`0x${string}`} opts.address
 * @param {Array<Object>} opts.abi
 * @param {string} opts.fn      — function name
 * @param {any[]}  [opts.args]  — function args
 */
export async function readContract({ rpcUrl, address, abi, fn, args = [] }) {
    const data = encodeFunctionData({ abi, functionName: fn, args });
    const r = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jsonrpc: '2.0', id: 1, method: 'eth_call',
            params: [{ to: address, data }, 'latest'],
        }),
    });
    const j = await r.json();
    if (j.error) {
        const e = new Error(`readContract ${fn}: ${j.error.message}`);
        e.code = j.error.code;
        throw e;
    }
    return decodeFunctionResult({ abi, functionName: fn, data: j.result });
}

// ────────────────────────────────────────────────────────────────────
// Write path — eth_sendTransaction via the wallet stub provider
// ────────────────────────────────────────────────────────────────────

/**
 * Call a state-changing function via the wallet stub provider.
 * The provider signs and submits.
 *
 * @param {Object} opts
 * @param {Object} opts.provider — from createProvider()
 * @param {`0x${string}`} opts.address
 * @param {Array<Object>} opts.abi
 * @param {string} opts.fn
 * @param {any[]}  [opts.args]
 * @param {bigint|string} [opts.value]
 * @param {bigint|string} [opts.gas]
 */
export async function writeContract({
    provider,
    address,
    abi,
    fn,
    args = [],
    value,
    gas,
}) {
    const data = encodeFunctionData({ abi, functionName: fn, args });
    const tx = { from: provider.address, to: address, data };
    if (value !== undefined) {
        tx.value = typeof value === 'bigint' ? `0x${value.toString(16)}` : value;
    }
    if (gas !== undefined) {
        tx.gas = typeof gas === 'bigint' ? `0x${gas.toString(16)}` : gas;
    }
    return provider.request({
        method: 'eth_sendTransaction',
        params: [tx],
    });
}

// ────────────────────────────────────────────────────────────────────
// Receipt + event helpers
// ────────────────────────────────────────────────────────────────────

/**
 * Mine pending txs (if requested) and fetch the receipt.
 *
 * @param {Object} opts
 * @param {string} opts.rpcUrl
 * @param {`0x${string}`} opts.txHash
 * @param {boolean} [opts.mineFirst] — call evm_mine before fetching
 */
export async function getReceipt({ rpcUrl, txHash, mineFirst = true }) {
    if (mineFirst) {
        await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0', id: 1, method: 'evm_mine', params: [],
            }),
        });
    }
    const r = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jsonrpc: '2.0', id: 1, method: 'eth_getTransactionReceipt',
            params: [txHash],
        }),
    });
    const j = await r.json();
    if (j.error) throw new Error(`getReceipt: ${j.error.message}`);
    return j.result;
}

/**
 * Decode logs in a receipt against the given ABI. Returns only the
 * events matching the ABI's event definitions.
 *
 * @param {Object} opts
 * @param {Object} opts.receipt
 * @param {Array<Object>} opts.abi
 * @returns {Array<{eventName: string, args: Object, address: string, topics: string[], data: string}>}
 */
export function parseEventLogs({ receipt, abi }) {
    if (!receipt?.logs) return [];
    return viemParseEventLogs({ abi, logs: receipt.logs });
}

// ────────────────────────────────────────────────────────────────────
// Convenience: spin up a viem public client (read-only)
// ────────────────────────────────────────────────────────────────────

export function publicClient(rpcUrl) {
    return createPublicClient({
        chain: { ...gnosis, rpcUrls: { default: { http: [rpcUrl] } } },
        transport: http(rpcUrl),
    });
}

// ────────────────────────────────────────────────────────────────────
// CLI entry — quick read-only inspection
// ────────────────────────────────────────────────────────────────────

if (import.meta.url === `file://${process.argv[1]}`) {
    const rpcUrl = process.argv[2] || 'http://127.0.0.1:8546';
    console.log(`[contracts] inspecting ${rpcUrl}`);
    try {
        const symbol = await readContract({
            rpcUrl, address: GNOSIS_CONTRACTS.sDAI,
            abi: ERC20_ABI, fn: 'symbol',
        });
        const decimals = await readContract({
            rpcUrl, address: GNOSIS_CONTRACTS.sDAI,
            abi: ERC20_ABI, fn: 'decimals',
        });
        const totalSupply = await readContract({
            rpcUrl, address: GNOSIS_CONTRACTS.sDAI,
            abi: ERC20_ABI, fn: 'totalSupply',
        });
        console.log(`sDAI:`);
        console.log(`  address: ${GNOSIS_CONTRACTS.sDAI}`);
        console.log(`  symbol: ${symbol}`);
        console.log(`  decimals: ${decimals}`);
        console.log(`  totalSupply: ${totalSupply} (${BigInt(totalSupply) / 10n ** BigInt(decimals)} sDAI)`);
    } catch (err) {
        console.error(`✗ ${err.message}`);
        process.exit(1);
    }
}
