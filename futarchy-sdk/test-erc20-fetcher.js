#!/usr/bin/env node

// test-erc20-fetcher.js - Test ERC20Fetcher with DataLayer

import 'dotenv/config';
import { DataLayer } from './DataLayer.js';
import { createERC20Fetcher, CHAIN_NAMES } from './fetchers/ERC20Fetcher.js';
import chalk from 'chalk';

// Test configuration - Well-known tokens on different chains
const TEST_TOKENS = {
    gnosis: {
        chainId: 100,
        rpcUrl: 'https://rpc.gnosischain.com',
        tokens: {
            SDAI: '0xaf204776c7245bF4147c2612BF6e5972Ee483701',
            WXDAI: '0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d',
            GNO: '0x9C58BAcC331c9aa871AFD802DB6379a98e80CEdb'
        }
    },
    polygon: {
        chainId: 137,
        rpcUrl: 'https://polygon-rpc.com',
        tokens: {
            USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            WMATIC: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            WETH: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619'
        }
    },
    mainnet: {
        chainId: 1,
        rpcUrl: 'https://eth.llamarpc.com',
        tokens: {
            USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
            DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F'
        }
    }
};

// Get test configuration from command line or use default
function getTestConfig() {
    const args = process.argv.slice(2);
    const chainArg = args.find(arg => arg.startsWith('--chain='));
    const rpcArg = args.find(arg => arg.startsWith('--rpc='));
    const tokenArg = args.find(arg => arg.startsWith('--token='));

    let chain = 'gnosis';
    if (chainArg) {
        chain = chainArg.split('=')[1];
    }

    const config = TEST_TOKENS[chain] || TEST_TOKENS.gnosis;

    if (rpcArg) {
        config.rpcUrl = rpcArg.split('=')[1];
    }

    if (tokenArg) {
        const tokenAddress = tokenArg.split('=')[1];
        config.customToken = tokenAddress;
    }

    return config;
}

// =============================================================================
// TEST FUNCTIONS
// =============================================================================

async function testERC20Fetcher() {
    console.log(chalk.cyan.bold('\n======================================'));
    console.log(chalk.cyan.bold('   ERC20 FETCHER TEST'));
    console.log(chalk.cyan.bold('======================================\n'));

    const config = getTestConfig();

    // Step 1: Initialize DataLayer
    console.log(chalk.yellow('📊 Initializing DataLayer...'));
    const dataLayer = new DataLayer();

    // Step 2: Create and register ERC20Fetcher
    console.log(chalk.yellow(`🔌 Creating ERC20Fetcher for ${CHAIN_NAMES[config.chainId] || 'Chain ' + config.chainId}...`));
    console.log(chalk.gray(`   RPC: ${config.rpcUrl}`));

    try {
        const erc20Fetcher = createERC20Fetcher(config.rpcUrl, config.chainId);
        dataLayer.registerFetcher(erc20Fetcher);
        console.log(chalk.green('✅ ERC20Fetcher registered successfully'));
    } catch (error) {
        console.error(chalk.red('❌ Failed to create ERC20Fetcher:'), error.message);
        process.exit(1);
    }

    // Step 3: Display available operations
    console.log(chalk.cyan('\n📋 Available Operations:'));
    const operations = dataLayer.getAvailableOperations();
    operations.forEach(op => {
        if (op.startsWith('erc20.')) {
            console.log(chalk.green(`  • ${op}`));
        } else {
            console.log(chalk.gray(`  • ${op}`));
        }
    });

    // Step 4: Test with custom token if provided
    if (config.customToken) {
        console.log(chalk.yellow('\n\n🎯 Testing Custom Token'));
        console.log(chalk.gray('─'.repeat(50)));
        await testSingleToken(dataLayer, config.customToken, 'Custom Token');
        return;
    }

    // Step 5: Test token metadata retrieval
    console.log(chalk.yellow('\n\n📝 Test 1: Token Metadata (Name, Symbol, Decimals)'));
    console.log(chalk.gray('─'.repeat(50)));

    for (const [tokenName, tokenAddress] of Object.entries(config.tokens)) {
        console.log(chalk.cyan(`\n🪙 ${tokenName}:`));

        try {
            const result = await dataLayer.fetch('erc20.metadata', {
                tokenAddress
            });

            if (result.status === 'success') {
                const data = result.data;
                console.log(chalk.gray('  ├─ Address:'), data.address);
                console.log(chalk.gray('  ├─ Name:'), chalk.green(data.name));
                console.log(chalk.gray('  ├─ Symbol:'), chalk.green(data.symbol));
                console.log(chalk.gray('  ├─ Decimals:'), chalk.yellow(data.decimals));
                console.log(chalk.gray('  └─ Chain:'), data.chainName);
            } else {
                console.error(chalk.red(`  ❌ Failed: ${result.reason}`));
            }
        } catch (error) {
            console.error(chalk.red(`  💥 Error: ${error.message}`));
        }
    }

    // Step 6: Test comprehensive token info
    console.log(chalk.yellow('\n\n📊 Test 2: Comprehensive Token Info'));
    console.log(chalk.gray('─'.repeat(50)));

    const firstToken = Object.entries(config.tokens)[0];
    if (firstToken) {
        const [tokenName, tokenAddress] = firstToken;
        console.log(chalk.cyan(`\nFetching full info for ${tokenName}...`));

        try {
            const result = await dataLayer.fetch('erc20.info', {
                tokenAddress
            });

            if (result.status === 'success') {
                const data = result.data;
                console.log(chalk.green('\n✅ Token Information:'));
                console.log(chalk.gray('  ├─ Name:'), data.name);
                console.log(chalk.gray('  ├─ Symbol:'), data.symbol);
                console.log(chalk.gray('  ├─ Decimals:'), data.decimals);
                console.log(chalk.gray('  ├─ Total Supply:'), chalk.green(data.totalSupplyFormatted));
                console.log(chalk.gray('  ├─ Raw Supply:'), data.totalSupply);
                console.log(chalk.gray('  └─ Cached:'), result.cached ? '✅' : '❌');
            } else {
                console.error(chalk.red(`❌ Failed: ${result.reason}`));
            }
        } catch (error) {
            console.error(chalk.red(`💥 Error: ${error.message}`));
        }
    }

    // Step 7: Test token balance (with example address)
    console.log(chalk.yellow('\n\n💰 Test 3: Token Balance'));
    console.log(chalk.gray('─'.repeat(50)));

    const testAddress = process.env.TEST_ADDRESS || '0x0000000000000000000000000000000000000000';
    const [tokenName, tokenAddress] = firstToken;

    console.log(chalk.cyan(`\nChecking ${tokenName} balance for:`));
    console.log(chalk.gray(`  ${testAddress}`));

    try {
        const result = await dataLayer.fetch('erc20.balance', {
            tokenAddress,
            userAddress: testAddress
        });

        if (result.status === 'success') {
            const data = result.data;
            console.log(chalk.green('\n✅ Balance Information:'));
            console.log(chalk.gray('  ├─ Token:'), data.symbol);
            console.log(chalk.gray('  ├─ Balance:'), chalk.green(data.balanceFormatted));
            console.log(chalk.gray('  ├─ Raw:'), data.balance);
            console.log(chalk.gray('  └─ Number:'), data.balanceNumber);
        } else {
            console.error(chalk.red(`❌ Failed: ${result.reason}`));
        }
    } catch (error) {
        console.error(chalk.red(`💥 Error: ${error.message}`));
    }

    // Step 8: Test multiple tokens at once
    console.log(chalk.yellow('\n\n🎭 Test 4: Multiple Tokens'));
    console.log(chalk.gray('─'.repeat(50)));

    const tokenAddresses = Object.values(config.tokens);
    console.log(chalk.cyan(`\nFetching info for ${tokenAddresses.length} tokens simultaneously...`));

    try {
        const result = await dataLayer.fetch('erc20.multi', {
            tokenAddresses
        });

        if (result.status === 'success') {
            console.log(chalk.green(`\n✅ Fetched ${result.count} tokens:\n`));
            result.data.forEach(token => {
                if (token.error) {
                    console.log(chalk.red(`  ❌ ${token.address}: ${token.error}`));
                } else {
                    console.log(chalk.green(`  ✅ ${token.symbol}`) + chalk.gray(` - ${token.name}`));
                }
            });
        } else {
            console.error(chalk.red(`❌ Failed: ${result.reason}`));
        }
    } catch (error) {
        console.error(chalk.red(`💥 Error: ${error.message}`));
    }

    // Step 9: Test total supply
    console.log(chalk.yellow('\n\n📈 Test 5: Total Supply'));
    console.log(chalk.gray('─'.repeat(50)));

    const [supplyTokenName, supplyTokenAddress] = firstToken;
    console.log(chalk.cyan(`\nFetching total supply for ${supplyTokenName}...`));

    try {
        const result = await dataLayer.fetch('erc20.supply', {
            tokenAddress: supplyTokenAddress
        });

        if (result.status === 'success') {
            const data = result.data;
            console.log(chalk.green('\n✅ Supply Information:'));
            console.log(chalk.gray('  ├─ Token:'), `${data.symbol} (${data.name})`);
            console.log(chalk.gray('  ├─ Total Supply:'), chalk.green(data.totalSupplyFormatted));
            console.log(chalk.gray('  └─ Supply Number:'), data.totalSupplyNumber.toLocaleString());
        } else {
            console.error(chalk.red(`❌ Failed: ${result.reason}`));
        }
    } catch (error) {
        console.error(chalk.red(`💥 Error: ${error.message}`));
    }

    console.log(chalk.cyan('\n======================================'));
    console.log(chalk.cyan('   TEST COMPLETED'));
    console.log(chalk.cyan('======================================\n'));
}

// Helper function to test a single token
async function testSingleToken(dataLayer, tokenAddress, tokenName) {
    console.log(chalk.cyan(`\nTesting token: ${tokenAddress}`));

    try {
        const result = await dataLayer.fetch('erc20.info', {
            tokenAddress
        });

        if (result.status === 'success') {
            const data = result.data;
            console.log(chalk.green('\n✅ Token Information:'));
            console.log(chalk.gray('  ├─ Name:'), chalk.green(data.name));
            console.log(chalk.gray('  ├─ Symbol:'), chalk.green(data.symbol));
            console.log(chalk.gray('  ├─ Decimals:'), chalk.yellow(data.decimals));
            console.log(chalk.gray('  ├─ Total Supply:'), chalk.green(data.totalSupplyFormatted));
            console.log(chalk.gray('  ├─ Chain:'), data.chainName);
            console.log(chalk.gray('  └─ Address:'), data.address);
        } else {
            console.error(chalk.red(`❌ Failed: ${result.reason}`));
        }
    } catch (error) {
        console.error(chalk.red(`💥 Error: ${error.message}`));
    }
}

// =============================================================================
// RUN THE TEST
// =============================================================================

// Handle errors gracefully
process.on('unhandledRejection', (error) => {
    console.error(chalk.red('\n💥 Unhandled error:'), error);
    process.exit(1);
});

// Show help if requested
if (process.argv.includes('--help')) {
    console.log(chalk.cyan('ERC20 Fetcher Test'));
    console.log(chalk.gray('─'.repeat(40)));
    console.log('Usage: node test-erc20-fetcher.js [options]');
    console.log('\nOptions:');
    console.log('  --help                Show this help message');
    console.log('  --chain=NAME          Test on specific chain (gnosis, polygon, mainnet)');
    console.log('  --rpc=URL             Use custom RPC URL');
    console.log('  --token=ADDRESS       Test specific token address');
    console.log('\nExamples:');
    console.log('  node test-erc20-fetcher.js --chain=polygon');
    console.log('  node test-erc20-fetcher.js --token=0xaf204776c7245bF4147c2612BF6e5972Ee483701');
    console.log('  node test-erc20-fetcher.js --chain=mainnet --rpc=https://eth.llamarpc.com');
    process.exit(0);
}

// Run the test
console.log(chalk.gray('Starting ERC20 Fetcher test...'));
testERC20Fetcher()
    .then(() => {
        console.log(chalk.green('✨ All tests completed successfully'));
        process.exit(0);
    })
    .catch((error) => {
        console.error(chalk.red('💥 Test failed:'), error);
        process.exit(1);
    });