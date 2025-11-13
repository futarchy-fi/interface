// Test wallet connection with private key

import { createWalletClient, createPublicClient, http, formatEther } from 'viem';
import { gnosis } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import chalk from 'chalk';
import dotenv from 'dotenv';

dotenv.config();

async function testWalletConnection() {
    console.log(chalk.cyan.bold('\n🔐 Testing Wallet Connection\n'));
    
    if (!process.env.PRIVATE_KEY) {
        console.log(chalk.yellow('⚠️  No private key found in .env'));
        return;
    }
    
    try {
        // Format private key
        const privateKey = process.env.PRIVATE_KEY.startsWith('0x') 
            ? process.env.PRIVATE_KEY 
            : `0x${process.env.PRIVATE_KEY}`;
        
        // Create account from private key
        const account = privateKeyToAccount(privateKey);
        console.log(chalk.green('✓ Account created from private key'));
        console.log(chalk.gray('Address:'), chalk.white(account.address));
        
        // Create public client
        const publicClient = createPublicClient({
            chain: gnosis,
            transport: http(process.env.RPC_URL || 'https://rpc.gnosischain.com')
        });
        
        // Get xDAI balance
        const balance = await publicClient.getBalance({
            address: account.address
        });
        
        console.log(chalk.gray('xDAI Balance:'), chalk.white(formatEther(balance)), 'xDAI');
        
        // Check sDAI balance
        const SDAI = process.env.SDAI_ADDRESS || '0xaf204776c7245bF4147c2612BF6e5972Ee483701';
        
        const sdaiBalance = await publicClient.readContract({
            address: SDAI,
            abi: [{
                name: 'balanceOf',
                type: 'function',
                stateMutability: 'view',
                inputs: [{ name: 'account', type: 'address' }],
                outputs: [{ name: '', type: 'uint256' }]
            }],
            functionName: 'balanceOf',
            args: [account.address]
        });
        
        console.log(chalk.gray('sDAI Balance:'), chalk.white(formatEther(sdaiBalance)), 'sDAI');
        
        // Create wallet client
        const walletClient = createWalletClient({
            account,
            chain: gnosis,
            transport: http(process.env.RPC_URL || 'https://rpc.gnosischain.com')
        });
        
        console.log(chalk.green('\n✅ Wallet successfully connected!'));
        console.log(chalk.dim('Ready for transactions on Gnosis Chain'));
        
        return {
            account,
            publicClient,
            walletClient,
            balances: {
                xdai: formatEther(balance),
                sdai: formatEther(sdaiBalance)
            }
        };
        
    } catch (error) {
        console.log(chalk.red(`✗ Error: ${error.message}`));
        return null;
    }
}

// Run test
testWalletConnection().then(result => {
    if (result) {
        console.log(chalk.cyan('\n📋 Connection Summary:'));
        console.log(chalk.gray('• Account:'), chalk.white(result.account.address));
        console.log(chalk.gray('• xDAI:'), chalk.white(result.balances.xdai));
        console.log(chalk.gray('• sDAI:'), chalk.white(result.balances.sdai));
        console.log(chalk.gray('• Chain:'), chalk.white('Gnosis (100)'));
        console.log(chalk.green.bold('\n✨ Ready to use Futarchy CLI with full transaction capabilities!'));
        console.log(chalk.dim('\nRun: npm run futarchy-cli'));
    }
});