#!/usr/bin/env node

import { DataLayer } from './DataLayer.js';
import { createERC20Fetcher } from './fetchers/ERC20Fetcher.js';

const dl = new DataLayer();
const f = createERC20Fetcher('https://rpc.gnosischain.com', 100);
dl.registerFetcher(f);

// Test addresses
const addresses = [
    { name: 'Proposal Contract', address: '0xDA36a35CA4Fe6214C37a452159C0C9EAd45D5919' },
    { name: 'Futarchy Router', address: '0x7495a583ba85875d59407781b4958ED6e0E1228f' },
    { name: 'Random User', address: '0xF863Da42f750A9a792a2c13c1Fc8E6Edaa81CA28' }
];

console.log('\n🪙 sDAI Balance Check\n' + '─'.repeat(50));

for (const addr of addresses) {
    const result = await dl.fetch('erc20.balance', {
        tokenAddress: '0xaf204776c7245bF4147c2612BF6e5972Ee483701',
        userAddress: addr.address
    });

    if (result.status === 'success') {
        const balance = parseFloat(result.data.balanceFormatted);
        console.log(`\n${addr.name}:`);
        console.log(`  Address: ${addr.address}`);
        console.log(`  Balance: ${balance > 0 ? '✅ ' + balance.toLocaleString() : '❌ 0'} sDAI`);
        if (balance > 0) {
            console.log(`  Raw: ${result.data.balance}`);
        }
    }
}

console.log('\n' + '─'.repeat(50));