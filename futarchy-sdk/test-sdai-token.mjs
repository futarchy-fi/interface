#!/usr/bin/env node

// test-sdai-token.mjs - Test ERC20Fetcher with sDAI token

import 'dotenv/config';
import { DataLayer } from './DataLayer.js';
import { createERC20Fetcher } from './fetchers/ERC20Fetcher.js';
import chalk from 'chalk';

// sDAI configuration from .env.example
const SDAI_CONFIG = {
    address: process.env.SDAI_ADDRESS || '0xaf204776c7245bF4147c2612BF6e5972Ee483701',
    chainId: 100, // Gnosis Chain
    rpcUrl: process.env.RPC_URL || 'https://rpc.gnosischain.com'
};

// Test addresses
const TEST_ADDRESSES = {
    zero: '0x0000000000000000000000000000000000000000',
    futarchyRouter: process.env.FUTARCHY_ROUTER || '0x7495a583ba85875d59407781b4958ED6e0E1228f',
    userAddress: process.env.TEST_ADDRESS || null
};

async function testSDAI() {
    console.log(chalk.cyan.bold('\n======================================'));
    console.log(chalk.cyan.bold('   sDAI TOKEN TEST (ERC20 Fetcher)'));
    console.log(chalk.cyan.bold('======================================\n'));

    // Initialize DataLayer
    console.log(chalk.yellow('📊 Initializing DataLayer...'));
    const dataLayer = new DataLayer();

    // Create and register ERC20Fetcher
    console.log(chalk.yellow('🔌 Creating ERC20Fetcher for Gnosis Chain...'));
    console.log(chalk.gray(`   RPC: ${SDAI_CONFIG.rpcUrl}`));
    console.log(chalk.gray(`   sDAI Address: ${SDAI_CONFIG.address}\n`));

    const erc20Fetcher = createERC20Fetcher(SDAI_CONFIG.rpcUrl, SDAI_CONFIG.chainId);
    dataLayer.registerFetcher(erc20Fetcher);

    // Test 1: Get sDAI metadata
    console.log(chalk.yellow('\n📝 Test 1: sDAI Metadata'));
    console.log(chalk.gray('─'.repeat(50)));

    try {
        const metadata = await dataLayer.fetch('erc20.metadata', {
            tokenAddress: SDAI_CONFIG.address
        });

        if (metadata.status === 'success') {
            console.log(chalk.green('✅ sDAI Metadata:'));
            console.log(chalk.gray('  ├─ Name:'), chalk.green(metadata.data.name));
            console.log(chalk.gray('  ├─ Symbol:'), chalk.green(metadata.data.symbol));
            console.log(chalk.gray('  ├─ Decimals:'), chalk.yellow(metadata.data.decimals));
            console.log(chalk.gray('  ├─ Address:'), metadata.data.address);
            console.log(chalk.gray('  └─ Chain:'), metadata.data.chainName);
        }
    } catch (error) {
        console.error(chalk.red('❌ Failed to fetch metadata:'), error.message);
    }

    // Test 2: Get comprehensive sDAI info
    console.log(chalk.yellow('\n\n📊 Test 2: Comprehensive sDAI Information'));
    console.log(chalk.gray('─'.repeat(50)));

    try {
        const info = await dataLayer.fetch('erc20.info', {
            tokenAddress: SDAI_CONFIG.address
        });

        if (info.status === 'success') {
            console.log(chalk.green('✅ sDAI Information:'));
            console.log(chalk.gray('  ├─ Name:'), info.data.name);
            console.log(chalk.gray('  ├─ Symbol:'), info.data.symbol);
            console.log(chalk.gray('  ├─ Total Supply:'), chalk.green(parseFloat(info.data.totalSupplyFormatted).toLocaleString()));
            console.log(chalk.gray('  ├─ Raw Supply:'), info.data.totalSupply);
            console.log(chalk.gray('  └─ Decimals:'), info.data.decimals);
        }
    } catch (error) {
        console.error(chalk.red('❌ Failed to fetch info:'), error.message);
    }

    // Test 3: Check balances for different addresses
    console.log(chalk.yellow('\n\n💰 Test 3: sDAI Balances'));
    console.log(chalk.gray('─'.repeat(50)));

    // Check zero address balance
    console.log(chalk.cyan('\n1. Zero Address:'));
    try {
        const balance = await dataLayer.fetch('erc20.balance', {
            tokenAddress: SDAI_CONFIG.address,
            userAddress: TEST_ADDRESSES.zero
        });

        if (balance.status === 'success') {
            console.log(chalk.gray('  └─ Balance:'), chalk.green(balance.data.balanceFormatted), 'sDAI');
        }
    } catch (error) {
        console.error(chalk.red('  ❌ Failed:'), error.message);
    }

    // Check Futarchy Router balance
    console.log(chalk.cyan('\n2. Futarchy Router:'));
    console.log(chalk.gray(`  Address: ${TEST_ADDRESSES.futarchyRouter}`));
    try {
        const balance = await dataLayer.fetch('erc20.balance', {
            tokenAddress: SDAI_CONFIG.address,
            userAddress: TEST_ADDRESSES.futarchyRouter
        });

        if (balance.status === 'success') {
            const formatted = parseFloat(balance.data.balanceFormatted);
            console.log(chalk.gray('  └─ Balance:'),
                formatted > 0 ? chalk.green(formatted.toLocaleString()) : chalk.gray(formatted),
                'sDAI');
        }
    } catch (error) {
        console.error(chalk.red('  ❌ Failed:'), error.message);
    }

    // Check user address if provided
    if (TEST_ADDRESSES.userAddress) {
        console.log(chalk.cyan('\n3. User Address:'));
        console.log(chalk.gray(`  Address: ${TEST_ADDRESSES.userAddress}`));
        try {
            const balance = await dataLayer.fetch('erc20.balance', {
                tokenAddress: SDAI_CONFIG.address,
                userAddress: TEST_ADDRESSES.userAddress
            });

            if (balance.status === 'success') {
                const formatted = parseFloat(balance.data.balanceFormatted);
                console.log(chalk.gray('  └─ Balance:'),
                    formatted > 0 ? chalk.green(formatted.toLocaleString()) : chalk.gray(formatted),
                    'sDAI');
            }
        } catch (error) {
            console.error(chalk.red('  ❌ Failed:'), error.message);
        }
    } else {
        console.log(chalk.gray('\n3. User Address: Not configured (set TEST_ADDRESS in .env)'));
    }

    // Test 4: Get total supply details
    console.log(chalk.yellow('\n\n📈 Test 4: sDAI Total Supply'));
    console.log(chalk.gray('─'.repeat(50)));

    try {
        const supply = await dataLayer.fetch('erc20.supply', {
            tokenAddress: SDAI_CONFIG.address
        });

        if (supply.status === 'success') {
            console.log(chalk.green('✅ Supply Information:'));
            console.log(chalk.gray('  ├─ Token:'), `${supply.data.symbol} (${supply.data.name})`);
            console.log(chalk.gray('  ├─ Total Supply:'), chalk.green(parseFloat(supply.data.totalSupplyFormatted).toLocaleString()));
            console.log(chalk.gray('  ├─ Supply (raw):'), supply.data.totalSupply);
            console.log(chalk.gray('  └─ Supply (number):'), supply.data.totalSupplyNumber.toLocaleString());
        }
    } catch (error) {
        console.error(chalk.red('❌ Failed to fetch supply:'), error.message);
    }

    // Test 5: Check allowances (example with Futarchy Router)
    console.log(chalk.yellow('\n\n🔓 Test 5: sDAI Allowances'));
    console.log(chalk.gray('─'.repeat(50)));

    if (TEST_ADDRESSES.userAddress) {
        console.log(chalk.cyan('Checking allowance from user to Futarchy Router...'));
        try {
            const allowance = await dataLayer.fetch('erc20.allowance', {
                tokenAddress: SDAI_CONFIG.address,
                ownerAddress: TEST_ADDRESSES.userAddress,
                spenderAddress: TEST_ADDRESSES.futarchyRouter
            });

            if (allowance.status === 'success') {
                console.log(chalk.green('✅ Allowance Information:'));
                console.log(chalk.gray('  ├─ Owner:'), TEST_ADDRESSES.userAddress.substring(0, 10) + '...');
                console.log(chalk.gray('  ├─ Spender:'), TEST_ADDRESSES.futarchyRouter.substring(0, 10) + '...');
                console.log(chalk.gray('  ├─ Amount:'), chalk.green(allowance.data.allowanceFormatted), 'sDAI');
                console.log(chalk.gray('  ├─ Approved:'), allowance.data.isApproved ? '✅' : '❌');
                console.log(chalk.gray('  └─ Unlimited:'), allowance.data.isUnlimited ? '♾️' : '❌');
            }
        } catch (error) {
            console.error(chalk.red('❌ Failed to check allowance:'), error.message);
        }
    } else {
        console.log(chalk.gray('Skipped: No user address configured'));
    }

    // Summary
    console.log(chalk.cyan('\n\n======================================'));
    console.log(chalk.cyan('   TEST SUMMARY'));
    console.log(chalk.cyan('======================================'));

    // Fetch final info for summary
    const finalInfo = await dataLayer.fetch('erc20.info', {
        tokenAddress: SDAI_CONFIG.address
    });

    if (finalInfo.status === 'success') {
        const data = finalInfo.data;
        console.log(chalk.green('\n✅ sDAI Token verified successfully!'));
        console.log(chalk.gray('\nToken Details:'));
        console.log(chalk.gray('├─ Contract:'), data.address);
        console.log(chalk.gray('├─ Name:'), chalk.green(data.name));
        console.log(chalk.gray('├─ Symbol:'), chalk.green(data.symbol));
        console.log(chalk.gray('├─ Decimals:'), chalk.yellow(data.decimals));
        console.log(chalk.gray('├─ Chain:'), data.chainName);
        console.log(chalk.gray('└─ Supply:'), chalk.green(parseFloat(data.totalSupplyFormatted).toLocaleString()), 'sDAI');
    }

    console.log(chalk.cyan('\n======================================\n'));
}

// Run the test
console.log(chalk.gray('Starting sDAI token test...'));

// Handle errors
process.on('unhandledRejection', (error) => {
    console.error(chalk.red('\n💥 Unhandled error:'), error);
    process.exit(1);
});

// Show command line options
if (process.argv.includes('--help')) {
    console.log(chalk.cyan('sDAI Token Test'));
    console.log(chalk.gray('─'.repeat(40)));
    console.log('Tests the ERC20Fetcher with the sDAI token on Gnosis Chain');
    console.log('\nUsage: node test-sdai-token.mjs');
    console.log('\nEnvironment variables:');
    console.log('  SDAI_ADDRESS     sDAI token address (default: 0xaf204776...)');
    console.log('  RPC_URL          RPC endpoint (default: https://rpc.gnosischain.com)');
    console.log('  TEST_ADDRESS     User address to check balance');
    console.log('  FUTARCHY_ROUTER  Futarchy router address');
    process.exit(0);
}

testSDAI()
    .then(() => {
        console.log(chalk.green('✨ Test completed successfully'));
        process.exit(0);
    })
    .catch((error) => {
        console.error(chalk.red('💥 Test failed:'), error);
        process.exit(1);
    });