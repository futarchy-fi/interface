#!/usr/bin/env node
/**
 * debug-balance-quirk.mjs — isolate the Phase 4 slice 1 mystery.
 *
 * THE QUIRK: After a successful 1-ETH transfer between anvil dev
 * addresses on a Gnosis fork, the recipient's eth_getBalance reads
 * as 0 (not pre+1ETH) even though the receipt is status=0x1 and the
 * sender is correctly debited.
 *
 * This script runs the same scenario against a fresh anvil fork
 * across THREE recipient kinds, using ONLY raw JSON-RPC (no viem,
 * no wallet stub) so we isolate whether the bug is in:
 *   - anvil's fork mode + pre-funded dev accounts (recipient = dev[1])
 *   - the wallet stub or viem (raw RPC bypasses both)
 *   - some quirk specific to certain address classes
 *
 * Recipient kinds:
 *   1. anvil dev[1] (the failing case from smoke-wallet-stub.test.mjs)
 *   2. a high-numbered "vanity" address (0xff…ffff)
 *   3. a freshly-generated random address
 *
 * Usage:
 *   node scripts/debug-balance-quirk.mjs
 *
 * Prints a table of (recipient kind, pre, post, delta, expected).
 */

import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';

import { privateKeyToAccount, mnemonicToAccount, generatePrivateKey } from 'viem/accounts';

const ANVIL_PATH = (() => {
    const r = spawnSync('which', ['anvil'], { encoding: 'utf8' });
    return r.status === 0 ? r.stdout.trim() : null;
})();
const PORT = 8552;
const RPC = `http://127.0.0.1:${PORT}`;
const FORK_URL = process.env.FORK_URL || 'https://rpc.gnosis.gateway.fm';
const ONE_ETH = '0xde0b6b3a7640000';
const HUNDRED_ETH = '0x56bc75e2d63100000';

if (!ANVIL_PATH) {
    console.error('anvil not on PATH — install foundry first');
    process.exit(1);
}

let _id = 0;
async function rpc(method, params = []) {
    const r = await fetch(RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: ++_id, method, params }),
    });
    const j = await r.json();
    if (j.error) throw new Error(`${method}: ${j.error.message}`);
    return j.result;
}

async function spawnAnvil() {
    const child = spawn(ANVIL_PATH, [
        '--host', '0.0.0.0',
        '--port', String(PORT),
        '--fork-url', FORK_URL,
        '--chain-id', '100',
        '--no-mining',
    ], { stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', () => {});
    child.stderr.on('data', () => {});
    const start = Date.now();
    while (Date.now() - start < 30_000) {
        try {
            await fetch(RPC, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jsonrpc: '2.0', id: 0, method: 'eth_blockNumber' }),
                signal: AbortSignal.timeout(1000),
            });
            return child;
        } catch { await wait(250); }
    }
    child.kill('SIGTERM');
    throw new Error('anvil did not start');
}

function freshAddress() {
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    return { address: account.address, privateKey };
}

async function signAndSend(senderPriv, to, valueHex) {
    // Sign a legacy tx (type 0) so we don't depend on EIP-1559 base fee.
    const sender = privateKeyToAccount(senderPriv);
    const nonce = await rpc('eth_getTransactionCount', [sender.address, 'latest']);
    // Use anvil's gas price
    const gasPrice = await rpc('eth_gasPrice');
    // Ample gas
    const tx = {
        to,
        value: valueHex,
        gas: '0x186a0', // 100000
        gasPrice,
        nonce,
        type: '0x0',
        chainId: 100,
    };
    const serialized = await sender.signTransaction({
        ...tx,
        gasPrice: BigInt(gasPrice),
        nonce: parseInt(nonce, 16),
        gas: 100000n,
    });
    return rpc('eth_sendRawTransaction', [serialized]);
}

async function tryRecipient(label, recipientAddr, senderPriv, senderAddr) {
    console.log(`\n── ${label} ──`);
    console.log(`  recipient: ${recipientAddr}`);

    // Always re-fund sender to a known amount
    await rpc('anvil_setBalance', [senderAddr, HUNDRED_ETH]);

    const pre = await rpc('eth_getBalance', [recipientAddr, 'latest']);
    const senderPre = await rpc('eth_getBalance', [senderAddr, 'latest']);
    console.log(`  pre  recipient: ${BigInt(pre)} wei (${BigInt(pre)/10n**18n} ETH)`);
    console.log(`  pre  sender:    ${BigInt(senderPre)} wei (${BigInt(senderPre)/10n**18n} ETH)`);

    const txHash = await signAndSend(senderPriv, recipientAddr, ONE_ETH);
    await rpc('evm_mine');

    const receipt = await rpc('eth_getTransactionReceipt', [txHash]);
    const post = await rpc('eth_getBalance', [recipientAddr, 'latest']);
    const senderPost = await rpc('eth_getBalance', [senderAddr, 'latest']);

    console.log(`  receipt status: ${receipt?.status}, block: ${receipt?.blockNumber}`);
    console.log(`  post recipient: ${BigInt(post)} wei (${BigInt(post)/10n**18n} ETH)`);
    console.log(`  post sender:    ${BigInt(senderPost)} wei (${BigInt(senderPost)/10n**18n} ETH)`);

    const delta = BigInt(post) - BigInt(pre);
    const senderDelta = BigInt(senderPre) - BigInt(senderPost);
    console.log(`  Δ recipient: ${delta} wei (expected +${BigInt(ONE_ETH)})`);
    console.log(`  Δ sender:    -${senderDelta} wei (~1 ETH + gas expected)`);

    const recipientOk = delta === BigInt(ONE_ETH);
    console.log(`  recipient credit: ${recipientOk ? '✓ EXPECTED' : '✗ ANOMALOUS'}`);
    return { recipientOk, delta };
}

(async () => {
    const child = await spawnAnvil();
    try {
        const sender = mnemonicToAccount(
            'test test test test test test test test test test test junk',
            { addressIndex: 0 },
        );
        const senderPriv = `0x${Buffer.from(sender.getHdKey().privateKey).toString('hex')}`;

        // 1. anvil dev[1]
        const dev1 = mnemonicToAccount(
            'test test test test test test test test test test test junk',
            { addressIndex: 1 },
        );
        await tryRecipient('Recipient = anvil dev[1] (the failing case)',
            dev1.address, senderPriv, sender.address);

        // 2. high-numbered "vanity" address
        await tryRecipient('Recipient = vanity 0xff...ffff',
            '0xffffffffffffffffffffffffffffffffffffffff',
            senderPriv, sender.address);

        // 3. freshly-generated random address
        const fresh = freshAddress();
        await tryRecipient('Recipient = freshly-generated address',
            fresh.address, senderPriv, sender.address);

        // 4. zero address (special-cased by some EVMs)
        await tryRecipient('Recipient = 0x0...0001 (low non-zero)',
            '0x0000000000000000000000000000000000000001',
            senderPriv, sender.address);
    } finally {
        child.kill('SIGTERM');
        await new Promise((res) => child.once('exit', res));
    }
})();
