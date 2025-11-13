#!/usr/bin/env node

// test-datalayer-swap.mjs - Test DataLayer with UniswapRouterCartridge for token swaps

import 'dotenv/config';
import { DataLayer } from './DataLayer.js';
import { ViemExecutor } from './executors/ViemExecutor.js';
import { UniswapRouterCartridge } from './executors/UniswapRouterCartridge.js';
import { privateKeyToAccount } from 'viem/accounts';
import { polygon } from 'viem/chains';
import { createWalletClient, createPublicClient, http } from 'viem';
import chalk from 'chalk';

// Test tokens on Polygon
const TEST_TOKENS = {
    YES_DAI: '0xfaaD724286C3f774158a45a98B6F82Ae6e7F3E2D',
    YES_AAVE: '0xC558183b4cC78465A2C00a8598bD9f310455966E',
};

// =============================================================================
// MAIN TEST
// =============================================================================

async function main() {
    console.log(chalk.cyan.bold('\n======================================'));
    console.log(chalk.cyan.bold('   DATA LAYER SWAP TEST'));
    console.log(chalk.cyan.bold('======================================\n'));
    
    // Step 1: Initialize DataLayer
    console.log(chalk.yellow('📊 Initializing DataLayer...'));
    const dataLayer = new DataLayer();
    
    // Step 2: Get private key from env
    let privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
        console.error(chalk.red('❌ Missing PRIVATE_KEY in .env'));
        process.exit(1);
    }
    
    if (!privateKey.startsWith('0x')) {
        privateKey = '0x' + privateKey;
    }
    
    const account = privateKeyToAccount(privateKey);
    console.log(chalk.green(`✅ Using account: ${account.address}`));
    
    // Step 3: Create and configure ViemExecutor with wallet
    console.log(chalk.yellow('\n🔧 Setting up ViemExecutor with wallet...'));
    
    const walletClient = createWalletClient({
        account,
        chain: polygon,
        transport: http('https://polygon-rpc.com')
    });
    
    const publicClient = createPublicClient({
        chain: polygon,
        transport: http('https://polygon-rpc.com')
    });
    
    const viemExecutor = new ViemExecutor({
        chain: polygon,
        rpcUrl: 'https://polygon-rpc.com',
        account,
        walletClient,
        publicClient
    });
    
    // Step 4: Create UniswapRouterCartridge
    console.log(chalk.yellow('🦄 Creating UniswapRouterCartridge...'));
    const uniswapCartridge = new UniswapRouterCartridge({
        chainId: 137, // Polygon
        defaultFee: 500 // 0.05%
    });
    
    // Step 5: Register cartridge with executor
    console.log(chalk.yellow('🔌 Registering cartridge with executor...'));
    viemExecutor.registerCartridge(uniswapCartridge);
    
    // Step 6: Register executor with DataLayer
    console.log(chalk.yellow('📝 Registering executor with DataLayer...'));
    dataLayer.registerExecutor(viemExecutor);
    
    // Step 7: Show available operations
    console.log(chalk.cyan('\n📋 Available Operations:'));
    const operations = dataLayer.getAvailableOperations();
    operations.forEach(op => {
        console.log(chalk.gray(`  • ${op}`));
    });
    
    // Step 8: Test approval check
    console.log(chalk.yellow('\n\n🔍 Testing: Check Approval Status'));
    console.log(chalk.gray('─'.repeat(40)));
    
    try {
        const checkIterator = dataLayer.execute('uniswap.universal.checkApprovals', {
            tokenAddress: TEST_TOKENS.YES_DAI
        });
        
        for await (const update of checkIterator) {
            if (update.status === 'pending') {
                console.log(chalk.blue(`⏳ ${update.message}`));
            } else if (update.status === 'success') {
                console.log(chalk.green(`✅ ${update.message}`));
                if (update.data) {
                    console.log(chalk.gray('\n  Token Info:'));
                    console.log(chalk.gray(`    • Symbol: ${update.data.symbol}`));
                    console.log(chalk.gray(`    • Decimals: ${update.data.decimals}`));
                    console.log(chalk.gray(`    • Balance: ${update.data.balanceFormatted}`));
                    console.log(chalk.gray(`    • ERC20 Approved: ${update.data.erc20Approved ? '✅' : '❌'}`));
                    console.log(chalk.gray(`    • Permit2 Approved: ${update.data.permit2Approved ? '✅' : '❌'}`));
                }
            } else if (update.status === 'error') {
                console.log(chalk.red(`❌ ${update.message}`));
            }
        }
    } catch (error) {
        console.error(chalk.red('❌ Check approval failed:'), error.message);
    }
    
    // Step 9: Test a minimal swap
    console.log(chalk.yellow('\n\n💱 Testing: Minimal Swap (0.00000001 YES_DAI → YES_AAVE)'));
    console.log(chalk.gray('─'.repeat(40)));
    
    const shouldExecuteSwap = process.argv.includes('--execute');
    
    if (!shouldExecuteSwap) {
        console.log(chalk.yellow('ℹ️  Swap simulation only. Use --execute flag to perform actual swap'));
        console.log(chalk.gray('   Example: node test-datalayer-swap.mjs --execute'));
    } else {
        try {
            console.log(chalk.blue('🚀 Executing swap through DataLayer...'));
            
            const swapIterator = dataLayer.execute('uniswap.universal.testSwap', {
                tokenIn: TEST_TOKENS.YES_DAI,
                tokenOut: TEST_TOKENS.YES_AAVE,
                fee: 500 // 0.05%
            });
            
            for await (const update of swapIterator) {
                if (update.status === 'pending') {
                    console.log(chalk.blue(`⏳ ${update.step}: ${update.message}`));
                    if (update.data?.transactionHash) {
                        console.log(chalk.gray(`   Tx: ${update.data.transactionHash}`));
                    }
                } else if (update.status === 'success') {
                    console.log(chalk.green(`✅ ${update.message}`));
                    if (update.data?.explorerUrl) {
                        console.log(chalk.cyan(`   View on Polygonscan: ${update.data.explorerUrl}`));
                    }
                    if (update.data?.gasUsed) {
                        console.log(chalk.gray(`   Gas used: ${update.data.gasUsed.toString()}`));
                    }
                } else if (update.status === 'error') {
                    console.log(chalk.red(`❌ ${update.message}`));
                    if (update.error) {
                        console.log(chalk.gray(`   Error: ${update.error}`));
                    }
                }
            }
        } catch (error) {
            console.error(chalk.red('❌ Swap failed:'), error.message);
        }
    }
    
    // Step 10: Test complete swap flow (with auto-approvals)
    console.log(chalk.yellow('\n\n🔄 Testing: Complete Swap Flow (with auto-approvals)'));
    console.log(chalk.gray('─'.repeat(40)));
    
    if (process.argv.includes('--complete')) {
        try {
            const completeIterator = dataLayer.execute('uniswap.universal.completeSwap', {
                tokenIn: TEST_TOKENS.YES_DAI,
                tokenOut: TEST_TOKENS.YES_AAVE,
                amountIn: '0.00000001',
                minAmountOut: '0',
                fee: 500
            });
            
            for await (const update of completeIterator) {
                if (update.status === 'pending') {
                    console.log(chalk.blue(`⏳ ${update.step}: ${update.message}`));
                } else if (update.status === 'success') {
                    console.log(chalk.green(`✅ ${update.message}`));
                } else if (update.status === 'error') {
                    console.log(chalk.red(`❌ ${update.message}`));
                }
            }
        } catch (error) {
            console.error(chalk.red('❌ Complete swap failed:'), error.message);
        }
    } else {
        console.log(chalk.yellow('ℹ️  Use --complete flag to test complete swap flow with auto-approvals'));
    }
    
    // Summary
    console.log(chalk.cyan.bold('\n\n======================================'));
    console.log(chalk.cyan.bold('   TEST SUMMARY'));
    console.log(chalk.cyan.bold('======================================'));
    console.log(chalk.green('\n✅ DataLayer initialized successfully'));
    console.log(chalk.green('✅ UniswapRouterCartridge registered'));
    console.log(chalk.green('✅ Operations available through DataLayer'));
    console.log(chalk.gray('\nNext steps:'));
    console.log(chalk.gray('  1. Run with --execute to perform actual swap'));
    console.log(chalk.gray('  2. Run with --complete for full flow with approvals'));
    console.log(chalk.gray('  3. Check token balances before and after'));
}

// Error handling
process.on('unhandledRejection', (error) => {
    console.error(chalk.red('\n❌ Unhandled error:'), error);
    process.exit(1);
});

// Run main
main().catch((error) => {
    console.error(chalk.red('\n❌ Fatal error:'), error);
    process.exit(1);
});